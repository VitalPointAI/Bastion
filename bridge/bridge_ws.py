"""
Cloud WebSocket uplink for the local discovery bridge.

Manages a persistent outbound WebSocket connection to Bastion cloud.
On connect:
  - Registers with DID (if persisted) or one-time token
  - Persists received DID for future restarts
Runs two concurrent background tasks:
  - _receive_loop: routes cloud commands to locally connected robots or queues them
  - _scan_report_loop: periodically scans LAN and reports to cloud

Usage:
    from bridge.bridge_ws import bridge_cloud_loop

    await bridge_cloud_loop(cfg, relay, scanner, queue)
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

import websockets

if TYPE_CHECKING:
    from bridge.bridge_relay import RobotRelay
    from bridge.command_queue import CommandQueue
    from bridge.scanner import MDNSScanner, SSDPScanner

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public helpers (exported for tests)
# ---------------------------------------------------------------------------


async def _relay_robot_message(ws, robot_msg: dict, bridge_id: str) -> None:
    """Forward a robot message to cloud, preserving the original message_id.

    The envelope has:
        type: "bridge:robot_relay"
        bridge_id: <bridge_id>
        robot_message: <original robot message>
        message_id: <robot_msg.get("message_id")>  -- may be None

    We do NOT call stamp() here -- the cloud side uses message_id for dedup and
    must receive None (not a freshly generated UUID) when the robot didn't send one.

    Args:
        ws: Cloud WebSocket connection.
        robot_msg: Raw message dict from the robot.
        bridge_id: This bridge's identifier.
    """
    envelope = {
        "type": "bridge:robot_relay",
        "bridge_id": bridge_id,
        "robot_message": robot_msg,
        "message_id": robot_msg.get("message_id"),  # explicit None is valid
    }
    await ws.send(json.dumps(envelope))


# ---------------------------------------------------------------------------
# Internal loops
# ---------------------------------------------------------------------------


async def _receive_loop(
    ws,
    queue: "CommandQueue",
    relay: "RobotRelay",
) -> None:
    """Receive cloud messages and dispatch them.

    - ``mission:assign`` → try to deliver to locally connected robot;
      enqueue if offline.
    - Other messages → log and ignore (future: extend per message type).
    """
    async for raw in ws:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("bridge_ws: received non-JSON message, ignoring")
            continue

        msg_type = msg.get("type", "")
        if msg_type == "mission:assign":
            robot_id = msg.get("robot_id", "")
            if robot_id and relay.is_robot_connected(robot_id):
                sent = await relay.send_to_robot(robot_id, msg)
                if sent:
                    logger.info("bridge_ws: delivered mission to online robot %s", robot_id)
                    continue
            # Robot offline or no robot_id — queue it
            if robot_id:
                queue.enqueue(robot_id, msg)
                logger.info("bridge_ws: queued mission for offline robot %s", robot_id)
            else:
                logger.warning("bridge_ws: mission:assign missing robot_id, dropping")
        elif msg_type == "bridge:registered":
            # Handled in connect loop — ignore here
            pass
        else:
            logger.debug("bridge_ws: unhandled message type %r", msg_type)


async def _scan_report_loop(
    ws,
    cfg,
    scanner_run,  # callable: async () -> list[dict]
) -> None:
    """Periodically run a full LAN scan and send results to cloud.

    Args:
        ws: Cloud WebSocket connection.
        cfg: BridgeConfig instance.
        scanner_run: Async callable that returns list of device dicts.
    """
    from datetime import datetime, timezone

    while True:
        await asyncio.sleep(cfg.SCAN_INTERVAL_SEC)
        try:
            devices = await scanner_run()
            report = {
                "type": "bridge:discovery_report",
                "bridge_id": cfg.BRIDGE_ID,
                "devices": devices,
                "scanned_at": datetime.now(timezone.utc).isoformat(),
            }
            await ws.send(json.dumps(report))
            logger.info(
                "bridge_ws: sent discovery report with %d device(s)", len(devices)
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("bridge_ws: scan report failed: %s", exc)


# ---------------------------------------------------------------------------
# Main cloud connection loop
# ---------------------------------------------------------------------------


async def bridge_cloud_loop(
    cfg,
    relay: "RobotRelay",
    scanner_run,  # async callable: () -> list[dict]
    queue: "CommandQueue",
) -> None:
    """Connect to Bastion cloud, register, and run receive + scan report loops.

    Reconnects with exponential backoff on disconnect.

    Args:
        cfg: BridgeConfig instance.
        relay: RobotRelay for routing to local robots.
        scanner_run: Async callable that runs the full LAN scan.
        queue: CommandQueue for offline robot commands.
    """
    delay = cfg.RECONNECT_INITIAL_DELAY
    url = f"{cfg.CLOUD_WS_URL}/ws/bridge"

    while not cfg.shutdown.is_set() if hasattr(cfg, "shutdown") else True:
        try:
            logger.info("bridge_ws: connecting to %s", url)
            async with websockets.connect(url) as ws:
                # Registration
                if cfg.BRIDGE_DID:
                    reg_msg = {
                        "type": "bridge:register",
                        "bridge_id": cfg.BRIDGE_ID,
                        "did": cfg.BRIDGE_DID,
                    }
                elif cfg.REGISTRATION_TOKEN:
                    reg_msg = {
                        "type": "bridge:register",
                        "bridge_id": cfg.BRIDGE_ID,
                        "token": cfg.REGISTRATION_TOKEN,
                    }
                else:
                    reg_msg = {
                        "type": "bridge:register",
                        "bridge_id": cfg.BRIDGE_ID,
                    }
                await ws.send(json.dumps(reg_msg))
                logger.info("bridge_ws: sent registration for bridge %s", cfg.BRIDGE_ID)

                # Wait for bridge:registered response
                raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
                resp = json.loads(raw)
                if resp.get("type") == "bridge:registered":
                    did = resp.get("did", "")
                    if did:
                        cfg.persist_did(did)
                        logger.info("bridge_ws: registered, DID=%s", did)

                # Share cloud WS ref with relay
                relay._cloud_ws = ws

                # Run receive and scan loops concurrently
                receive_task = asyncio.create_task(
                    _receive_loop(ws, queue, relay)
                )
                scan_task = asyncio.create_task(
                    _scan_report_loop(ws, cfg, scanner_run)
                )
                try:
                    await asyncio.gather(receive_task, scan_task)
                except (websockets.ConnectionClosed, Exception) as inner_exc:
                    logger.warning("bridge_ws: connection error: %s", inner_exc)
                    receive_task.cancel()
                    scan_task.cancel()

                # Reset backoff on successful connection
                delay = cfg.RECONNECT_INITIAL_DELAY

        except Exception as exc:  # noqa: BLE001
            logger.warning("bridge_ws: failed to connect: %s", exc)

        logger.info("bridge_ws: reconnecting in %.1fs", delay)
        await asyncio.sleep(delay)
        delay = min(delay * 2, cfg.RECONNECT_MAX_DELAY)
