"""
Bridge service entry point.

Wires together all bridge components and starts the asyncio event loop.

Components:
  - bridge_cloud_loop: outbound WebSocket to Bastion cloud
  - robot_relay_server: local WebSocket server for robot connections
  - advertise_bridge: mDNS advertisement and robot browsing
  - command_queue.cleanup_loop: periodic TTL-expiry cleanup

Usage:
    python bridge/bridge_main.py [--ui]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal
import sys

# Ensure the project root is on sys.path when running as a script
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from bridge.bridge_relay import RobotRelay, robot_relay_server
from bridge.bridge_ws import bridge_cloud_loop
from bridge.command_queue import CommandQueue
from bridge.config import BridgeConfig
from bridge.mdns_advertise import advertise_bridge
from bridge.scanner import MDNSScanner, SSDPScanner, run_full_scan

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bastion Local Discovery Bridge")
    parser.add_argument(
        "--ui",
        action="store_true",
        default=False,
        help="Enable the built-in browser UI (overrides ENABLE_UI env var)",
    )
    return parser.parse_args()


async def main() -> None:
    """Entry point: wire and run all bridge components concurrently."""
    args = _parse_args()

    # Config (loads from .env / environment)
    cfg = BridgeConfig()
    if args.ui:
        cfg.ENABLE_UI = True

    # Validate required config
    if not cfg.CLOUD_WS_URL:
        logger.error("CLOUD_WS_URL is required. Set it in .env or environment.")
        sys.exit(1)
    if not cfg.BRIDGE_ID:
        logger.error("BRIDGE_ID is required. Set it in .env or environment.")
        sys.exit(1)

    # Shared state
    shutdown = asyncio.Event()
    queue = CommandQueue(default_ttl_sec=cfg.COMMAND_TTL_SEC)
    relay = RobotRelay()

    # Scanner callable
    async def _scanner_run():
        return await run_full_scan(
            mdns_duration=cfg.SCAN_DURATION_SEC,
            ssdp_timeout=5.0,
        )

    # Signal handling
    def _handle_signal(sig, _frame):
        logger.info("bridge_main: received signal %s, shutting down", sig.name)
        shutdown.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    logger.info("bridge_main: starting bridge %s -> %s", cfg.BRIDGE_ID, cfg.CLOUD_WS_URL)

    # Build task list
    tasks = [
        asyncio.create_task(
            bridge_cloud_loop(cfg, relay, _scanner_run, queue),
            name="cloud-uplink",
        ),
        asyncio.create_task(
            robot_relay_server(cfg, relay, queue, shutdown),
            name="robot-relay",
        ),
        asyncio.create_task(
            advertise_bridge(cfg, shutdown),
            name="mdns-advertise",
        ),
        asyncio.create_task(
            queue.cleanup_loop(interval_sec=60.0, shutdown=shutdown),
            name="queue-cleanup",
        ),
    ]

    if cfg.ENABLE_UI:
        try:
            from bridge.ui_app import create_app
            import uvicorn

            app = create_app(relay, queue)
            config = uvicorn.Config(app, host="0.0.0.0", port=cfg.UI_PORT, log_level="warning")
            server = uvicorn.Server(config)
            tasks.append(asyncio.create_task(server.serve(), name="ui-server"))
            logger.info("bridge_main: UI enabled on port %d", cfg.UI_PORT)
        except ImportError:
            logger.warning("bridge_main: UI requested but bridge.ui_app not available (plan 05)")

    # Run until any task raises or shutdown is requested
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)

    for task in done:
        if task.exception():
            logger.error("bridge_main: task %s failed: %s", task.get_name(), task.exception())

    shutdown.set()
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
    logger.info("bridge_main: shutdown complete")


if __name__ == "__main__":
    asyncio.run(main())
