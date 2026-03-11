"""
Bastion robot mission client — main entry point for the Jetson Orin Nano.

Connects to Bastion as a WebSocket client, handles the full mission lifecycle:
  - Registration on connect
  - Telemetry heartbeat every 2 seconds
  - Mission assignment dispatch
  - State transition reporting
  - Graceful shutdown on SIGINT/SIGTERM
  - Exponential-backoff reconnection

Run with:
    python3 mission_client.py

Environment variables must be set (copy .env.example to .env and fill in values).
"""
from __future__ import annotations

import asyncio
import json
import signal
import sys
from datetime import datetime
from typing import Optional

import structlog
import websockets
from websockets.exceptions import ConnectionClosed

import config as cfg
from calibration import load_profile
from mission_executor import MissionExecutor
from models import MissionJSON, RegisterMsg, StateUpdateMsg, TelemetryMsg
from rvr_driver import RVRDriver

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Globals shared between tasks
# ---------------------------------------------------------------------------

_executor: Optional[MissionExecutor] = None
_driver: Optional[RVRDriver] = None
_shutdown_event: asyncio.Event = asyncio.Event()

# ---------------------------------------------------------------------------
# WebSocket send helpers
# ---------------------------------------------------------------------------


async def _ws_send(ws: websockets.WebSocketClientProtocol, msg: dict) -> None:
    """Send a JSON message on the WebSocket, swallowing closed-connection errors."""
    try:
        await ws.send(json.dumps(msg))
    except (ConnectionClosed, RuntimeError) as exc:
        log.warning("mission_client.send_failed", error=str(exc))


async def _send_state(ws: websockets.WebSocketClientProtocol, msg: StateUpdateMsg) -> None:
    await _ws_send(ws, msg.model_dump(mode="json"))


async def _send_telemetry(ws: websockets.WebSocketClientProtocol, msg: TelemetryMsg) -> None:
    await _ws_send(ws, msg.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# Telemetry heartbeat
# ---------------------------------------------------------------------------


async def telemetry_loop(
    ws: websockets.WebSocketClientProtocol,
    driver: RVRDriver,
    robot_id: str,
) -> None:
    """
    Send a TelemetryMsg every TELEMETRY_INTERVAL_SEC seconds.

    Exits cleanly when the WebSocket is closed or shutdown is requested.
    """
    log.info("mission_client.telemetry_loop.start", interval_sec=cfg.TELEMETRY_INTERVAL_SEC)
    try:
        while not _shutdown_event.is_set():
            try:
                x, y = driver.position
                battery = await driver.get_battery_pct()
                msg = TelemetryMsg(
                    robot_id=robot_id,
                    position={"x": x, "y": y},
                    heading=driver.heading,
                    battery_pct=battery,
                    timestamp=datetime.utcnow(),
                )
                await _send_telemetry(ws, msg)
            except (ConnectionClosed, RuntimeError):
                log.warning("mission_client.telemetry_loop.ws_closed")
                break
            except Exception as exc:  # noqa: BLE001
                log.error("mission_client.telemetry_loop.error", error=str(exc))

            await asyncio.sleep(cfg.TELEMETRY_INTERVAL_SEC)
    except asyncio.CancelledError:
        pass
    finally:
        log.info("mission_client.telemetry_loop.stop")


# ---------------------------------------------------------------------------
# Message receive loop
# ---------------------------------------------------------------------------


async def receive_loop(
    ws: websockets.WebSocketClientProtocol,
    executor: MissionExecutor,
) -> None:
    """
    Main receive loop — parse incoming messages and dispatch by type.

    Exits when the connection closes or shutdown is requested.
    """
    log.info("mission_client.receive_loop.start")
    try:
        async for raw in ws:
            if _shutdown_event.is_set():
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError as exc:
                log.warning("mission_client.receive_loop.parse_error", error=str(exc), raw=raw[:200])
                continue

            msg_type = msg.get("type", "")

            if msg_type == "mission:assign":
                log.info("mission_client.received.mission_assign", payload_keys=list(msg.keys()))
                try:
                    mission = MissionJSON.model_validate(msg.get("payload", msg))
                    # Run mission in a background task so receive loop stays responsive
                    asyncio.create_task(
                        executor.execute_mission(mission),
                        name=f"mission-{mission.mission_id}",
                    )
                except Exception as exc:  # noqa: BLE001
                    log.error("mission_client.received.mission_assign.invalid", error=str(exc))

            elif msg_type == "mission:rejected":
                reason = msg.get("reason", "unknown")
                log.warning("mission_client.received.mission_rejected", reason=reason)

            elif msg_type == "auth:response":
                approved = bool(msg.get("approved", False))
                log.info("mission_client.received.auth_response", approved=approved)
                await executor.handle_auth_response(approved)

            else:
                log.debug("mission_client.received.unknown_type", msg_type=msg_type)

    except (ConnectionClosed, asyncio.CancelledError):
        pass
    except Exception as exc:  # noqa: BLE001
        log.error("mission_client.receive_loop.unexpected_error", error=str(exc))
    finally:
        log.info("mission_client.receive_loop.stop")


# ---------------------------------------------------------------------------
# Single connection lifecycle
# ---------------------------------------------------------------------------


async def connect_and_run(driver: RVRDriver) -> None:
    """
    Open a WS connection to Bastion, register, start loops, await disconnect.

    Raises websockets exceptions on connection failure; caller handles backoff.
    """
    ws_url = f"{cfg.BASTION_WS_URL}/ws/robot"
    log.info("mission_client.connecting", url=ws_url)

    async with websockets.connect(ws_url) as ws:
        log.info("mission_client.connected", url=ws_url)

        # Register with Bastion
        reg = RegisterMsg(
            robot_id=cfg.ROBOT_ID,
            auth_token=cfg.AUTH_TOKEN,
            capabilities=["patrol_route", "find_engage"],
        )
        await _ws_send(ws, reg.model_dump(mode="json"))
        log.info("mission_client.registered", robot_id=cfg.ROBOT_ID)

        # Build executor with bound WS callbacks
        executor = MissionExecutor(
            driver=driver,
            send_state_fn=lambda msg: _send_state(ws, msg),
            send_telemetry_fn=lambda msg: _send_telemetry(ws, msg),
            robot_id=cfg.ROBOT_ID,
        )

        # Store global reference so shutdown can abort active missions
        global _executor
        _executor = executor

        # Run telemetry and receive loops concurrently
        telemetry_task = asyncio.create_task(
            telemetry_loop(ws, driver, cfg.ROBOT_ID),
            name="telemetry-loop",
        )
        receive_task = asyncio.create_task(
            receive_loop(ws, executor),
            name="receive-loop",
        )

        # Wait for either loop to exit (connection closed or shutdown)
        done, pending = await asyncio.wait(
            [telemetry_task, receive_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        log.info("mission_client.connection_closed")


# ---------------------------------------------------------------------------
# Main run loop with reconnection
# ---------------------------------------------------------------------------


async def run() -> None:
    """
    Main execution loop.

    Initialises hardware, then enters a reconnection loop with exponential
    backoff until shutdown is requested.
    """
    log.info(
        "mission_client.starting",
        robot_id=cfg.ROBOT_ID,
        bastion_url=cfg.BASTION_WS_URL,
        simulate=cfg.SIMULATE,
    )

    driver = RVRDriver(serial_port=cfg.SERIAL_PORT, simulate=cfg.SIMULATE)
    global _driver
    _driver = driver

    try:
        await driver.wake()
    except Exception as exc:  # noqa: BLE001
        log.warning("mission_client.wake_error", error=str(exc))

    delay = cfg.RECONNECT_INITIAL_DELAY

    while not _shutdown_event.is_set():
        try:
            await connect_and_run(driver)
        except (OSError, ConnectionRefusedError, websockets.InvalidURI) as exc:
            log.warning("mission_client.connection_error", error=str(exc), retry_in=delay)
        except Exception as exc:  # noqa: BLE001
            log.error("mission_client.unexpected_error", error=str(exc), retry_in=delay)

        if _shutdown_event.is_set():
            break

        log.info("mission_client.reconnecting_in", delay_sec=delay)
        try:
            await asyncio.wait_for(_shutdown_event.wait(), timeout=delay)
        except asyncio.TimeoutError:
            pass

        # Exponential backoff
        delay = min(delay * 2, cfg.RECONNECT_MAX_DELAY)

    # Graceful shutdown
    log.info("mission_client.shutdown")
    if _executor is not None:
        await _executor.abort()
    await driver.safe_stop()
    await driver.close()
    log.info("mission_client.stopped")


# ---------------------------------------------------------------------------
# Signal handling
# ---------------------------------------------------------------------------


def _handle_signal(sig: signal.Signals) -> None:
    log.info("mission_client.signal_received", signal=sig.name)
    _shutdown_event.set()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    # Configure structlog for human-readable output in development
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
        logger_factory=structlog.PrintLoggerFactory(),
    )

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, _handle_signal, sig)

    try:
        loop.run_until_complete(run())
    except KeyboardInterrupt:
        pass
    finally:
        loop.close()
        sys.exit(0)
