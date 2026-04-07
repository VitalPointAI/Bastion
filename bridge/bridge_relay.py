"""
Local WebSocket relay server for the local discovery bridge.

Accepts incoming WebSocket connections from robot agents on the LAN.
On connection:
  - Tracks robot_id from robot:register message
  - Drains queued commands and delivers them
  - Proxies all robot messages to cloud via cloud WebSocket
  - Removes robot from connected set on disconnect

Usage:
    from bridge.bridge_relay import RobotRelay, robot_relay_server

    relay = RobotRelay()
    await robot_relay_server(cfg, relay, queue, shutdown)
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Optional

import websockets

logger = logging.getLogger(__name__)


class RobotRelay:
    """Manages locally connected robot WebSocket connections."""

    def __init__(self) -> None:
        self._connected_robots: Dict[str, websockets.WebSocketServerProtocol] = {}
        self._cloud_ws: Optional[websockets.WebSocketClientProtocol] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_robot_connected(self, robot_id: str) -> bool:
        """Return True if *robot_id* currently has an active local WS connection."""
        return robot_id in self._connected_robots

    async def send_to_robot(self, robot_id: str, msg: dict) -> bool:
        """Send *msg* to the locally connected *robot_id*.

        Args:
            robot_id: Target robot identifier.
            msg: Message payload dict (will be JSON-serialized).

        Returns:
            True if message was sent, False if robot is not connected.
        """
        ws = self._connected_robots.get(robot_id)
        if ws is None:
            return False
        try:
            await ws.send(json.dumps(msg))
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("relay: failed to send to robot %s: %s", robot_id, exc)
            return False

    # ------------------------------------------------------------------
    # Internal connection handler
    # ------------------------------------------------------------------

    async def _handle_robot_connection(self, robot_ws, queue) -> None:
        """Handle the lifecycle of a single robot WebSocket connection.

        Args:
            robot_ws: Incoming robot WebSocket connection.
            queue: CommandQueue to drain queued commands from.
        """
        robot_id: Optional[str] = None
        remote = getattr(robot_ws, "remote_address", ("unknown", 0))
        logger.info("relay: robot connected from %s", remote)

        try:
            async for raw in robot_ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    logger.warning("relay: non-JSON message from robot, ignoring")
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "robot:register":
                    robot_id = msg.get("robot_id", "")
                    if robot_id:
                        self._connected_robots[robot_id] = robot_ws
                        logger.info("relay: registered robot %s", robot_id)

                        # Drain queued commands and deliver them
                        queued = queue.drain(robot_id)
                        if queued:
                            logger.info(
                                "relay: draining %d queued command(s) for %s",
                                len(queued),
                                robot_id,
                            )
                            for cmd in queued:
                                await robot_ws.send(json.dumps(cmd))

                # Forward all messages to cloud
                logger.info("relay: forwarding %s from %s (cloud_ws=%s)", msg_type, robot_id, self._cloud_ws is not None)
                if self._cloud_ws is not None:
                    try:
                        from bridge.bridge_ws import _relay_robot_message
                        bridge_id = "bridge"  # fallback; real bridge_id set in bridge_cloud_loop
                        await _relay_robot_message(self._cloud_ws, msg, bridge_id=bridge_id)
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("relay: failed to forward to cloud: %s", exc)
                else:
                    logger.warning("relay: no cloud_ws — message dropped")

        except Exception as exc:  # noqa: BLE001
            logger.info("relay: robot connection closed: %s", exc)
        finally:
            if robot_id and robot_id in self._connected_robots:
                del self._connected_robots[robot_id]
                logger.info("relay: robot %s disconnected", robot_id)


# ---------------------------------------------------------------------------
# Server entry point
# ---------------------------------------------------------------------------


async def robot_relay_server(
    cfg,
    relay: RobotRelay,
    queue,
    shutdown: asyncio.Event,
) -> None:
    """Start the local robot WebSocket relay server.

    Listens on ``0.0.0.0:{cfg.RELAY_PORT}`` and accepts robot connections
    until *shutdown* is set.

    Args:
        cfg: BridgeConfig instance.
        relay: RobotRelay instance tracking connected robots.
        queue: CommandQueue for draining offline-robot commands on connect.
        shutdown: asyncio.Event that signals graceful shutdown.
    """
    handler = lambda ws: relay._handle_robot_connection(ws, queue)

    async with websockets.serve(handler, "0.0.0.0", cfg.RELAY_PORT, ping_interval=30, ping_timeout=60) as server:
        logger.info("relay: listening on port %d", cfg.RELAY_PORT)
        await shutdown.wait()
        logger.info("relay: shutdown signal received, stopping")
