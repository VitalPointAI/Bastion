"""
Tests for bridge.scanner.MDNSScanner and SSDPScanner.

Uses mocks to avoid real network I/O.  Verifies:
  - MDNSScanner.scan() returns normalized device dicts
  - SSDPScanner.scan() returns normalized device dicts
  - run_full_scan() merges both and deduplicates by raw_identifier
  - All results conform to {transport_type, raw_identifier, raw_data, origin} schema
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from bridge.scanner import MDNSScanner, SSDPScanner, run_full_scan

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

EXPECTED_FIELDS = {"transport_type", "raw_identifier", "raw_data", "origin"}


def _assert_schema(device: dict) -> None:
    assert EXPECTED_FIELDS.issubset(
        device.keys()
    ), f"Missing keys in device dict: {device.keys()}"
    assert device["transport_type"] == "wifi"
    assert device["origin"] == "bridge"


# ---------------------------------------------------------------------------
# MDNSScanner
# ---------------------------------------------------------------------------


class TestMDNSScanner:
    async def test_mdns_scan_returns_devices(self):
        """MDNSScanner.scan() with mocked AsyncZeroconf returns normalized device dicts."""
        fake_info = MagicMock()
        fake_info.name = "Robot-Alpha._bastion-robot._tcp.local."
        fake_info.addresses = [b"\xc0\xa8\x01\x01"]  # 192.168.1.1
        fake_info.port = 9000
        fake_info.properties = {b"robot_id": b"alpha"}

        with (
            patch("bridge.scanner.AsyncZeroconf") as MockAZC,
            patch("bridge.scanner.AsyncServiceBrowser"),
            patch("bridge.scanner.asyncio.sleep", new_callable=AsyncMock),
        ):
            azc_instance = AsyncMock()
            azc_instance.async_get_service_info = AsyncMock(return_value=fake_info)
            MockAZC.return_value.__aenter__ = AsyncMock(return_value=azc_instance)
            MockAZC.return_value.__aexit__ = AsyncMock(return_value=False)

            # Simulate listener discovering a service
            def fake_browser(azc, svc_type, listener, **kwargs):
                listener.add_service(azc, svc_type, fake_info.name)
                return MagicMock()

            with patch("bridge.scanner.AsyncServiceBrowser", side_effect=fake_browser):
                scanner = MDNSScanner()
                results = await scanner.scan(duration_sec=0.01)

        assert len(results) == 1
        _assert_schema(results[0])
        assert results[0]["raw_identifier"] == fake_info.name

    async def test_mdns_scan_empty_when_no_services(self):
        """MDNSScanner.scan() returns empty list when no services are discovered."""
        with (
            patch("bridge.scanner.AsyncZeroconf") as MockAZC,
            patch("bridge.scanner.asyncio.sleep", new_callable=AsyncMock),
        ):
            azc_instance = AsyncMock()
            MockAZC.return_value.__aenter__ = AsyncMock(return_value=azc_instance)
            MockAZC.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("bridge.scanner.AsyncServiceBrowser", return_value=MagicMock()):
                scanner = MDNSScanner()
                results = await scanner.scan(duration_sec=0.01)

        assert results == []

    async def test_scanner_normalizes_to_discovery_schema(self):
        """scan() result conforms to {transport_type, raw_identifier, raw_data, origin} format."""
        fake_info = MagicMock()
        fake_info.name = "SomeDevice._http._tcp.local."
        fake_info.addresses = [b"\n\x00\x00\x01"]  # 10.0.0.1
        fake_info.port = 80
        fake_info.properties = {b"model": b"cam-v2"}

        with (
            patch("bridge.scanner.AsyncZeroconf") as MockAZC,
            patch("bridge.scanner.asyncio.sleep", new_callable=AsyncMock),
        ):
            azc_instance = AsyncMock()
            azc_instance.async_get_service_info = AsyncMock(return_value=fake_info)
            MockAZC.return_value.__aenter__ = AsyncMock(return_value=azc_instance)
            MockAZC.return_value.__aexit__ = AsyncMock(return_value=False)

            def fake_browser(azc, svc_type, listener, **kwargs):
                listener.add_service(azc, svc_type, fake_info.name)
                return MagicMock()

            with patch("bridge.scanner.AsyncServiceBrowser", side_effect=fake_browser):
                scanner = MDNSScanner()
                results = await scanner.scan(duration_sec=0.01)

        assert len(results) == 1
        d = results[0]
        _assert_schema(d)
        assert "addresses" in d["raw_data"]
        assert "port" in d["raw_data"]
        assert "properties" in d["raw_data"]


# ---------------------------------------------------------------------------
# SSDPScanner
# ---------------------------------------------------------------------------


class TestSSDPScanner:
    async def test_ssdp_scan_returns_devices(self):
        """SSDPScanner.scan() with mocked ssdp returns normalized device dicts."""
        fake_response = MagicMock()
        fake_response.location = "http://192.168.1.50:1900/desc.xml"
        fake_response.usn = "uuid:device-001::upnp:rootdevice"
        fake_response.headers = {"SERVER": "Linux UPnP/1.0", "ST": "upnp:rootdevice"}

        with patch("bridge.scanner.ssdp") as mock_ssdp:
            mock_ssdp.discover = AsyncMock(return_value=[fake_response])
            scanner = SSDPScanner()
            results = await scanner.scan(timeout_sec=0.1)

        assert len(results) == 1
        _assert_schema(results[0])

    async def test_ssdp_scan_empty_when_no_devices(self):
        with patch("bridge.scanner.ssdp") as mock_ssdp:
            mock_ssdp.discover = AsyncMock(return_value=[])
            scanner = SSDPScanner()
            results = await scanner.scan(timeout_sec=0.1)

        assert results == []


# ---------------------------------------------------------------------------
# run_full_scan
# ---------------------------------------------------------------------------


class TestRunFullScan:
    async def test_run_full_scan_merges_results(self):
        """run_full_scan() returns combined list from both scanners."""
        mdns_device = {
            "transport_type": "wifi",
            "raw_identifier": "Device-A._http._tcp.local.",
            "raw_data": {},
            "origin": "bridge",
        }
        ssdp_device = {
            "transport_type": "wifi",
            "raw_identifier": "uuid:device-b::upnp:rootdevice",
            "raw_data": {},
            "origin": "bridge",
        }

        with (
            patch.object(MDNSScanner, "scan", new_callable=AsyncMock, return_value=[mdns_device]),
            patch.object(SSDPScanner, "scan", new_callable=AsyncMock, return_value=[ssdp_device]),
        ):
            results = await run_full_scan(mdns_duration=0.01, ssdp_timeout=0.01)

        assert len(results) == 2

    async def test_run_full_scan_deduplicates_by_identifier(self):
        """Devices with the same raw_identifier appear only once."""
        duplicate = {
            "transport_type": "wifi",
            "raw_identifier": "same-id",
            "raw_data": {},
            "origin": "bridge",
        }

        with (
            patch.object(MDNSScanner, "scan", new_callable=AsyncMock, return_value=[duplicate]),
            patch.object(SSDPScanner, "scan", new_callable=AsyncMock, return_value=[duplicate]),
        ):
            results = await run_full_scan(mdns_duration=0.01, ssdp_timeout=0.01)

        assert len(results) == 1
