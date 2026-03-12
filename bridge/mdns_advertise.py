"""
mDNS service advertisement for the local discovery bridge.

Registers the bridge as ``_bastion._tcp.local.`` on the LAN so that
robot agents can discover it without manual configuration.

Also browses for ``_bastion-robot._tcp.local.`` to detect robots
that advertise themselves.

Usage:
    from bridge.mdns_advertise import advertise_bridge

    shutdown = asyncio.Event()
    await advertise_bridge(cfg, shutdown)
"""
from __future__ import annotations

import asyncio
import logging
import socket
from typing import Any

from zeroconf import ServiceInfo
from zeroconf.asyncio import AsyncServiceBrowser, AsyncZeroconf

logger = logging.getLogger(__name__)


# Indirection for shutdown wait -- allows tests to patch without touching asyncio.Event
async def shutdown_event_wait(event: asyncio.Event) -> None:
    """Await the shutdown event. Extracted for testability."""
    await event.wait()


class _RobotListener:
    """mDNS listener that logs discovered robot services."""

    def add_service(self, zc: Any, type_: str, name: str) -> None:
        logger.info("mdns_advertise: discovered robot service: %s (%s)", name, type_)

    def remove_service(self, zc: Any, type_: str, name: str) -> None:
        logger.info("mdns_advertise: robot service removed: %s (%s)", name, type_)

    def update_service(self, zc: Any, type_: str, name: str) -> None:
        pass


async def advertise_bridge(cfg: Any, shutdown: asyncio.Event) -> None:
    """Register this bridge as ``_bastion._tcp.local.`` and browse for robots.

    Registers with TXT records:
        bridge_id, cloud_url, version, relay_port

    Also starts a browser for ``_bastion-robot._tcp.local.`` to auto-discover
    robot agents on the LAN.

    Awaits the *shutdown* event, then unregisters cleanly.

    Args:
        cfg: BridgeConfig instance (uses BRIDGE_ID, RELAY_PORT, CLOUD_WS_URL).
        shutdown: asyncio.Event that signals when to stop advertising.
    """
    service_type = "_bastion._tcp.local."
    robot_service_type = "_bastion-robot._tcp.local."

    # Build TXT records (bytes -> bytes for zeroconf)
    properties = {
        b"bridge_id": cfg.BRIDGE_ID.encode("utf-8"),
        b"cloud_url": cfg.CLOUD_WS_URL.encode("utf-8"),
        b"version": b"1.0",
        b"relay_port": str(cfg.RELAY_PORT).encode("utf-8"),
    }

    # Determine local IP
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            local_ip = sock.getsockname()[0]
    except OSError:
        local_ip = "127.0.0.1"

    packed_ip = socket.inet_aton(local_ip)
    full_name = f"{cfg.BRIDGE_ID}.{service_type}"

    info = ServiceInfo(
        type_=service_type,
        name=full_name,
        addresses=[packed_ip],
        port=cfg.RELAY_PORT,
        properties=properties,
    )

    async with AsyncZeroconf() as azc:
        await azc.async_register_service(info)
        logger.info(
            "mdns_advertise: registered %s on port %d", full_name, cfg.RELAY_PORT
        )

        # Browse for robots
        robot_listener = _RobotListener()
        _robot_browser = AsyncServiceBrowser(azc, robot_service_type, robot_listener)  # noqa: F841
        logger.info("mdns_advertise: browsing for %s", robot_service_type)

        try:
            await shutdown_event_wait(shutdown)
        finally:
            await azc.async_unregister_service(info)
            logger.info("mdns_advertise: unregistered bridge service")
