"""
mDNS browse and advertise helpers for the robot agent and local discovery bridge.

Uses the ``zeroconf`` library (AsyncZeroconf / AsyncServiceBrowser) to:
  - browse_service: discover services of a given type on the local LAN
  - advertise_service: register a local service until a shutdown event fires

Usage (browsing):
    from robot.common.mdns import browse_service
    results = await browse_service("_bastion._tcp.local.", timeout=10.0)
    for svc in results:
        print(svc.name, svc.addresses, svc.port, svc.properties)

Usage (advertising):
    import asyncio
    from robot.common.mdns import advertise_service
    shutdown = asyncio.Event()
    await advertise_service(
        service_type="_bastion._tcp.local.",
        name="my-bridge",
        port=8765,
        properties={"bridge_id": "b1", "version": "1.0"},
        shutdown_event=shutdown,
    )
"""
from __future__ import annotations

import asyncio
import socket
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from zeroconf import ServiceInfo
from zeroconf.asyncio import AsyncServiceBrowser, AsyncZeroconf


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


@dataclass
class ServiceResult:
    """A discovered mDNS service."""

    name: str
    addresses: List[str] = field(default_factory=list)
    port: int = 0
    properties: Dict[str, str] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_local_ip() -> str:
    """Return the first non-loopback IPv4 address of this machine.

    Falls back to '127.0.0.1' if no suitable interface is found.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # Connect to an external address to determine the local interface;
            # no actual packet is sent because UDP is connectionless.
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def _decode_address(raw: bytes) -> str:
    """Convert a 4-byte packed IPv4 address to dotted-decimal string."""
    return socket.inet_ntoa(raw)


def _decode_properties(raw: Dict[bytes, Optional[bytes]]) -> Dict[str, str]:
    """Decode zeroconf TXT record bytes to plain strings."""
    result: Dict[str, str] = {}
    for k, v in raw.items():
        key = k.decode("utf-8", errors="replace") if isinstance(k, bytes) else str(k)
        val = v.decode("utf-8", errors="replace") if isinstance(v, bytes) else (v or "")
        result[key] = val
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def browse_service(
    service_type: str,
    timeout: float = 10.0,
) -> List[ServiceResult]:
    """Discover mDNS services of *service_type* on the local LAN.

    Opens an ``AsyncZeroconf`` instance, starts an ``AsyncServiceBrowser``,
    and waits up to *timeout* seconds for services to appear.  Returns all
    services discovered within that window.  Returns an empty list if none
    are found before the timeout.

    Args:
        service_type: mDNS service type, e.g. ``"_bastion._tcp.local."``.
        timeout: Seconds to wait before returning, even if no services found.

    Returns:
        List of :class:`ServiceResult` instances.
    """
    discovered: List[ServiceResult] = []
    # Track pending service names so we can look them up after the browse ends
    pending_names: List[str] = []

    class _Listener:
        def add_service(self, zc, type_: str, name: str) -> None:
            pending_names.append(name)

        def remove_service(self, zc, type_: str, name: str) -> None:
            pass

        def update_service(self, zc, type_: str, name: str) -> None:
            pass

    async with AsyncZeroconf() as azc:
        listener = _Listener()
        _browser = AsyncServiceBrowser(azc, service_type, listener)  # noqa: F841
        # Wait up to timeout for services to show up
        await asyncio.sleep(timeout)
        # Now fetch info for all discovered service names
        for name in pending_names:
            info = await azc.async_get_service_info(service_type, name)
            if info is None:
                continue
            addresses = [_decode_address(a) for a in info.addresses if len(a) == 4]
            properties = _decode_properties(info.properties)
            discovered.append(
                ServiceResult(
                    name=info.name,
                    addresses=addresses,
                    port=info.port,
                    properties=properties,
                )
            )

    return discovered


async def advertise_service(
    service_type: str,
    name: str,
    port: int,
    properties: Dict[str, str],
    shutdown_event: asyncio.Event,
) -> None:
    """Register a local mDNS service and advertise it until *shutdown_event* is set.

    On shutdown (when *shutdown_event* fires), the service is unregistered
    cleanly before returning.

    Args:
        service_type: mDNS service type, e.g. ``"_bastion-robot._tcp.local."``.
        name: Human-readable service name (unique on the LAN).
        port: TCP port the service listens on.
        properties: TXT record key/value pairs (strings).
        shutdown_event: ``asyncio.Event`` that signals when to stop advertising.
    """
    local_ip = get_local_ip()
    packed_ip = socket.inet_aton(local_ip)

    # Encode string properties to bytes for zeroconf TXT records
    encoded_props = {
        k.encode("utf-8"): v.encode("utf-8") for k, v in properties.items()
    }

    full_name = f"{name}.{service_type}"
    info = ServiceInfo(
        type_=service_type,
        name=full_name,
        addresses=[packed_ip],
        port=port,
        properties=encoded_props,
    )

    async with AsyncZeroconf() as azc:
        await azc.async_register_service(info)
        try:
            await shutdown_event.wait()
        finally:
            await azc.async_unregister_service(info)
