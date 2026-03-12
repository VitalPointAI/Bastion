"""
LAN device scanner for the local discovery bridge.

Implements two scanners:
  - MDNSScanner: Browses mDNS service types using AsyncZeroconf / AsyncServiceBrowser.
  - SSDPScanner: Sends an SSDP M-SEARCH for "ssdp:all" using the ``ssdp`` library.

Both scanners normalize results to the same discovery schema:
    {
        "transport_type": "wifi",
        "raw_identifier": "<unique identifier>",
        "raw_data": { ... raw fields ... },
        "origin": "bridge",
    }

Usage:
    from bridge.scanner import MDNSScanner, SSDPScanner, run_full_scan

    results = await run_full_scan(mdns_duration=30.0, ssdp_timeout=5.0)
"""
from __future__ import annotations

import asyncio
import logging
import socket
from typing import List

try:
    import ssdp
except ImportError:  # allow tests to patch if ssdp unavailable
    ssdp = None  # type: ignore[assignment]

from zeroconf.asyncio import AsyncServiceBrowser, AsyncZeroconf

logger = logging.getLogger(__name__)

# mDNS service types to browse during a full scan.
# We browse the most common service classes to discover printers, cameras,
# IoT devices, smart speakers, robots, etc.
_MDNS_SERVICE_TYPES = [
    "_http._tcp.local.",
    "_https._tcp.local.",
    "_ssh._tcp.local.",
    "_ftp._tcp.local.",
    "_smb._tcp.local.",
    "_afpovertcp._tcp.local.",
    "_printer._tcp.local.",
    "_ipp._tcp.local.",
    "_scanner._tcp.local.",
    "_googlecast._tcp.local.",
    "_airplay._tcp.local.",
    "_raop._tcp.local.",
    "_homekit._tcp.local.",
    "_hap._tcp.local.",
    "_mqtt._tcp.local.",
    "_coap._udp.local.",
    "_bastion._tcp.local.",
    "_bastion-robot._tcp.local.",
    "_workstation._tcp.local.",
]


def _decode_address(raw: bytes) -> str:
    """Convert a 4-byte packed IPv4 address to dotted-decimal string."""
    return socket.inet_ntoa(raw)


def _decode_properties(raw: dict) -> dict:
    """Decode zeroconf TXT record bytes to plain strings."""
    result: dict = {}
    for k, v in raw.items():
        key = k.decode("utf-8", errors="replace") if isinstance(k, bytes) else str(k)
        val = v.decode("utf-8", errors="replace") if isinstance(v, bytes) else (v or "")
        result[key] = val
    return result


class MDNSScanner:
    """Browse common mDNS service types to discover LAN devices."""

    async def scan(self, duration_sec: float = 30.0) -> List[dict]:
        """Browse all registered mDNS service types and return normalized device dicts.

        Opens an AsyncZeroconf instance, starts browsers for all service types,
        waits *duration_sec*, then fetches service info for all discovered names.

        Args:
            duration_sec: How long to browse before collecting results.

        Returns:
            List of normalized device dicts.
        """
        discovered_names: List[tuple[str, str]] = []  # (service_type, name)

        class _Listener:
            def __init__(self, svc_type: str) -> None:
                self._svc_type = svc_type

            def add_service(self, zc, type_: str, name: str) -> None:
                discovered_names.append((self._svc_type, name))

            def remove_service(self, zc, type_: str, name: str) -> None:
                pass

            def update_service(self, zc, type_: str, name: str) -> None:
                pass

        results: List[dict] = []

        async with AsyncZeroconf() as azc:
            browsers = []
            for svc_type in _MDNS_SERVICE_TYPES:
                listener = _Listener(svc_type)
                browser = AsyncServiceBrowser(azc, svc_type, listener)
                browsers.append(browser)

            await asyncio.sleep(duration_sec)

            seen_names: set[str] = set()
            for svc_type, name in discovered_names:
                if name in seen_names:
                    continue
                seen_names.add(name)
                try:
                    info = await azc.async_get_service_info(svc_type, name)
                    if info is None:
                        continue
                    addresses = [
                        _decode_address(a) for a in info.addresses if len(a) == 4
                    ]
                    properties = _decode_properties(info.properties)
                    results.append({
                        "transport_type": "wifi",
                        "raw_identifier": info.name,
                        "raw_data": {
                            "addresses": addresses,
                            "port": info.port,
                            "properties": properties,
                            "service_type": svc_type,
                        },
                        "origin": "bridge",
                    })
                except Exception as exc:  # noqa: BLE001
                    logger.warning("MDNSScanner: failed to get info for %s: %s", name, exc)

        logger.info("MDNSScanner: discovered %d device(s)", len(results))
        return results


class SSDPScanner:
    """Send SSDP M-SEARCH for 'ssdp:all' and return normalized device dicts."""

    async def scan(self, timeout_sec: float = 5.0) -> List[dict]:
        """Discover SSDP devices on the LAN.

        Args:
            timeout_sec: How long to wait for SSDP responses.

        Returns:
            List of normalized device dicts.
        """
        if ssdp is None:
            logger.warning("SSDPScanner: 'ssdp' library not available, skipping SSDP scan")
            return []

        try:
            responses = await ssdp.discover("ssdp:all", timeout=timeout_sec)
        except Exception as exc:  # noqa: BLE001
            logger.warning("SSDPScanner: scan failed: %s", exc)
            return []

        results: List[dict] = []
        for resp in responses:
            usn = getattr(resp, "usn", None) or getattr(resp, "headers", {}).get("USN", "")
            location = getattr(resp, "location", "") or getattr(resp, "headers", {}).get("LOCATION", "")
            headers = dict(getattr(resp, "headers", {})) if hasattr(resp, "headers") else {}
            results.append({
                "transport_type": "wifi",
                "raw_identifier": usn or location,
                "raw_data": {
                    "location": location,
                    "usn": usn,
                    "headers": headers,
                },
                "origin": "bridge",
            })

        logger.info("SSDPScanner: discovered %d device(s)", len(results))
        return results


async def run_full_scan(
    mdns_duration: float = 30.0,
    ssdp_timeout: float = 5.0,
) -> List[dict]:
    """Run MDNSScanner and SSDPScanner concurrently, merge, and deduplicate.

    Deduplication is by ``raw_identifier`` — if both scanners return a device
    with the same identifier, only the first occurrence is kept.

    Args:
        mdns_duration: Duration (seconds) to browse mDNS.
        ssdp_timeout: Timeout (seconds) for SSDP M-SEARCH.

    Returns:
        Merged, deduplicated list of normalized device dicts.
    """
    mdns_scanner = MDNSScanner()
    ssdp_scanner = SSDPScanner()

    mdns_results, ssdp_results = await asyncio.gather(
        mdns_scanner.scan(duration_sec=mdns_duration),
        ssdp_scanner.scan(timeout_sec=ssdp_timeout),
    )

    seen_ids: set[str] = set()
    merged: List[dict] = []
    for device in mdns_results + ssdp_results:
        rid = device.get("raw_identifier", "")
        if rid not in seen_ids:
            seen_ids.add(rid)
            merged.append(device)

    logger.info("run_full_scan: %d unique device(s) after dedup", len(merged))
    return merged
