"""
LAN device scanner for the local discovery bridge.

Implements two scanners:
  - MDNSScanner: Browses mDNS service types using zeroconf AsyncServiceBrowser.
  - SSDPScanner: Sends an SSDP M-SEARCH for "ssdp:all" via raw UDP socket.

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
import struct
from typing import List

from zeroconf import Zeroconf, ServiceBrowser, ServiceInfo

logger = logging.getLogger(__name__)

# mDNS service types to browse during a full scan.
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
    """Browse common mDNS service types to discover LAN devices.

    Uses synchronous Zeroconf + ServiceBrowser running in a thread executor
    to avoid AsyncZeroconf API compatibility issues across versions.
    """

    async def scan(self, duration_sec: float = 30.0) -> List[dict]:
        """Browse all registered mDNS service types and return normalized device dicts."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._scan_sync, duration_sec)

    def _scan_sync(self, duration_sec: float) -> List[dict]:
        """Synchronous mDNS scan — runs in a thread."""
        import time

        discovered: List[tuple[str, str]] = []  # (service_type, name)

        class _Listener:
            def __init__(self, svc_type: str) -> None:
                self._svc_type = svc_type

            def add_service(self, zc: Zeroconf, type_: str, name: str) -> None:
                discovered.append((self._svc_type, name))

            def remove_service(self, zc: Zeroconf, type_: str, name: str) -> None:
                pass

            def update_service(self, zc: Zeroconf, type_: str, name: str) -> None:
                pass

        results: List[dict] = []
        zc = Zeroconf()
        try:
            browsers = []
            for svc_type in _MDNS_SERVICE_TYPES:
                listener = _Listener(svc_type)
                browser = ServiceBrowser(zc, svc_type, listener)
                browsers.append(browser)

            time.sleep(duration_sec)

            seen_names: set[str] = set()
            for svc_type, name in discovered:
                if name in seen_names:
                    continue
                seen_names.add(name)
                try:
                    info = ServiceInfo(svc_type, name)
                    info.request(zc, 3000)  # 3 second timeout
                    if info.addresses:
                        addresses = [
                            _decode_address(a) for a in info.addresses if len(a) == 4
                        ]
                        properties = _decode_properties(info.properties) if info.properties else {}
                        results.append({
                            "transport_type": "mdns",
                            "raw_identifier": info.name or name,
                            "raw_data": {
                                "addresses": addresses,
                                "port": info.port,
                                "properties": properties,
                                "service_type": svc_type,
                                "hostname": info.server,
                            },
                            "origin": "bridge",
                        })
                except Exception as exc:
                    logger.warning("MDNSScanner: failed to get info for %s: %s", name, exc)

            for browser in browsers:
                browser.cancel()
        finally:
            zc.close()

        logger.info("MDNSScanner: discovered %d device(s)", len(results))
        return results


# ---------------------------------------------------------------------------
# SSDP Scanner — raw UDP M-SEARCH (no external library dependency)
# ---------------------------------------------------------------------------

_SSDP_ADDR = "239.255.255.250"
_SSDP_PORT = 1900
_MSEARCH_MSG = (
    "M-SEARCH * HTTP/1.1\r\n"
    "HOST: 239.255.255.250:1900\r\n"
    'MAN: "ssdp:discover"\r\n'
    "MX: 3\r\n"
    "ST: ssdp:all\r\n"
    "\r\n"
)


class SSDPScanner:
    """Send SSDP M-SEARCH for 'ssdp:all' via raw UDP and return normalized device dicts."""

    async def scan(self, timeout_sec: float = 5.0) -> List[dict]:
        """Discover SSDP devices on the LAN via raw multicast UDP."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._scan_sync, timeout_sec)

    def _scan_sync(self, timeout_sec: float) -> List[dict]:
        """Synchronous SSDP M-SEARCH — runs in a thread."""
        results: List[dict] = []

        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.settimeout(timeout_sec)

            # Join multicast group on all interfaces
            mreq = struct.pack("4sL", socket.inet_aton(_SSDP_ADDR), socket.INADDR_ANY)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

            # Send M-SEARCH
            sock.sendto(_MSEARCH_MSG.encode("utf-8"), (_SSDP_ADDR, _SSDP_PORT))

            seen_usns: set[str] = set()
            while True:
                try:
                    data, addr = sock.recvfrom(4096)
                    text = data.decode("utf-8", errors="replace")
                    headers = self._parse_headers(text)
                    usn = headers.get("USN", "")
                    location = headers.get("LOCATION", "")
                    identifier = usn or location or f"{addr[0]}:{addr[1]}"

                    if identifier in seen_usns:
                        continue
                    seen_usns.add(identifier)

                    results.append({
                        "transport_type": "ssdp",
                        "raw_identifier": identifier,
                        "raw_data": {
                            "location": location,
                            "usn": usn,
                            "server": headers.get("SERVER", ""),
                            "st": headers.get("ST", ""),
                            "source_ip": addr[0],
                            "headers": headers,
                        },
                        "origin": "bridge",
                    })
                except socket.timeout:
                    break
                except Exception as exc:
                    logger.debug("SSDPScanner: recv error: %s", exc)
                    break

            sock.close()
        except Exception as exc:
            logger.warning("SSDPScanner: scan failed: %s", exc)

        logger.info("SSDPScanner: discovered %d device(s)", len(results))
        return results

    @staticmethod
    def _parse_headers(text: str) -> dict[str, str]:
        """Parse HTTP-like SSDP response headers into a dict."""
        headers: dict[str, str] = {}
        for line in text.split("\r\n"):
            if ":" in line:
                key, _, value = line.partition(":")
                headers[key.strip().upper()] = value.strip()
        return headers


async def run_full_scan(
    mdns_duration: float = 30.0,
    ssdp_timeout: float = 5.0,
) -> List[dict]:
    """Run MDNSScanner and SSDPScanner concurrently, merge, and deduplicate.

    Deduplication is by ``raw_identifier`` — if both scanners return a device
    with the same identifier, only the first occurrence is kept.
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
