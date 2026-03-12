"""Tests for mDNS browse/advertise helpers in robot.common.mdns."""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from robot.common.mdns import browse_service, advertise_service, ServiceResult


class TestBrowseService:
    """Tests for browse_service() async helper."""

    @pytest.mark.asyncio
    async def test_mdns_browse_returns_info(self):
        """browse_service() with mocked AsyncZeroconf returns discovered service info list."""
        mock_info = MagicMock()
        mock_info.name = "bastion-bridge._bastion._tcp.local."
        mock_info.addresses = [b"\xc0\xa8\x01\x01"]  # 192.168.1.1
        mock_info.port = 8765
        mock_info.properties = {b"bridge_id": b"b1", b"version": b"1.0"}

        mock_zeroconf = AsyncMock()
        mock_zeroconf.async_get_service_info = AsyncMock(return_value=mock_info)
        mock_zeroconf.__aenter__ = AsyncMock(return_value=mock_zeroconf)
        mock_zeroconf.__aexit__ = AsyncMock(return_value=False)

        def fake_browser_constructor(zc, service_type, listener):
            # Immediately notify listener of a discovered service synchronously
            listener.add_service(zc, service_type, mock_info.name)
            return MagicMock()

        with patch("robot.common.mdns.AsyncZeroconf", return_value=mock_zeroconf):
            with patch(
                "robot.common.mdns.AsyncServiceBrowser",
                side_effect=fake_browser_constructor,
            ):
                with patch("robot.common.mdns.asyncio.sleep", new_callable=AsyncMock):
                    results = await browse_service(
                        "_bastion._tcp.local.", timeout=0.01
                    )

        assert isinstance(results, list)
        assert len(results) >= 1
        result = results[0]
        assert isinstance(result, ServiceResult)
        assert result.name == mock_info.name
        assert result.port == 8765

    @pytest.mark.asyncio
    async def test_mdns_browse_timeout_returns_empty(self):
        """browse_service with no services found returns empty list after timeout."""
        mock_zeroconf = AsyncMock()
        mock_zeroconf.async_get_service_info = AsyncMock(return_value=None)
        mock_zeroconf.__aenter__ = AsyncMock(return_value=mock_zeroconf)
        mock_zeroconf.__aexit__ = AsyncMock(return_value=False)

        def fake_browser_constructor(zc, service_type, listener):
            # Do not notify — simulate no services found
            return MagicMock()

        with patch("robot.common.mdns.AsyncZeroconf", return_value=mock_zeroconf):
            with patch(
                "robot.common.mdns.AsyncServiceBrowser",
                side_effect=fake_browser_constructor,
            ):
                with patch("robot.common.mdns.asyncio.sleep", new_callable=AsyncMock):
                    results = await browse_service(
                        "_bastion._tcp.local.", timeout=0.01
                    )

        assert results == []


class TestAdvertiseService:
    """Tests for advertise_service() async helper."""

    @pytest.mark.asyncio
    async def test_mdns_advertise_registers_service(self):
        """advertise_service() calls async_register_service with correct service type and TXT records."""
        mock_zeroconf = AsyncMock()
        mock_zeroconf.async_register_service = AsyncMock()
        mock_zeroconf.async_unregister_service = AsyncMock()
        mock_zeroconf.__aenter__ = AsyncMock(return_value=mock_zeroconf)
        mock_zeroconf.__aexit__ = AsyncMock(return_value=False)

        shutdown_event = asyncio.Event()
        # Set shutdown immediately so the coroutine doesn't hang
        shutdown_event.set()

        properties = {"bridge_id": "b1", "version": "1.0"}

        with patch("robot.common.mdns.AsyncZeroconf", return_value=mock_zeroconf):
            with patch("robot.common.mdns.get_local_ip", return_value="192.168.1.1"):
                await advertise_service(
                    service_type="_bastion._tcp.local.",
                    name="test-bridge",
                    port=8765,
                    properties=properties,
                    shutdown_event=shutdown_event,
                )

        # Verify async_register_service was called
        mock_zeroconf.async_register_service.assert_called_once()
        call_args = mock_zeroconf.async_register_service.call_args
        service_info = call_args[0][0]
        assert service_info.type == "_bastion._tcp.local."
        assert service_info.port == 8765

    @pytest.mark.asyncio
    async def test_mdns_advertise_unregisters_on_shutdown(self):
        """advertise_service() unregisters when shutdown_event is set."""
        mock_zeroconf = AsyncMock()
        mock_zeroconf.async_register_service = AsyncMock()
        mock_zeroconf.async_unregister_service = AsyncMock()
        mock_zeroconf.__aenter__ = AsyncMock(return_value=mock_zeroconf)
        mock_zeroconf.__aexit__ = AsyncMock(return_value=False)

        shutdown_event = asyncio.Event()
        shutdown_event.set()

        with patch("robot.common.mdns.AsyncZeroconf", return_value=mock_zeroconf):
            with patch("robot.common.mdns.get_local_ip", return_value="192.168.1.1"):
                await advertise_service(
                    service_type="_bastion._tcp.local.",
                    name="test-bridge",
                    port=8765,
                    properties={},
                    shutdown_event=shutdown_event,
                )

        # Verify cleanup was done
        mock_zeroconf.async_unregister_service.assert_called_once()
