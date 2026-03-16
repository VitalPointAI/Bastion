"""
Bastion robot mission client — main entry point for the Jetson Orin Nano.

Connects to Bastion as a WebSocket client, handles the full mission lifecycle:
  - mDNS bridge discovery with fallback to BRIDGE_HOST/BRIDGE_PORT
  - DID-based authentication (one-time token → persisted DID)
  - Backward-compatible AUTH_TOKEN for legacy deployments
  - Registration on connect
  - Telemetry heartbeat every 2 seconds
  - Mission assignment dispatch
  - State transition reporting
  - Dual-path connectivity: direct cloud → bridge relay on disconnect
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
from common.mdns import advertise_service, browse_service
from common.ws_protocol import send_stamped, stamp
from intent.fallback import template_translate
from mission_executor import MissionExecutor
from models import MissionJSON, RegisterMsg, StateUpdateMsg, TelemetryMsg
from pre_flight import validate_mission
from rvr_driver import RVRDriver
from swarm.coordinator import SwarmCoordinator
from swarm.models import SwarmAddResource, SwarmRemoveResource, SwarmRole, SwarmTelemetry
from swarm.ble_follower_manager import BLEFollowerManager
from vision.camera import Camera
from vision.models import VisionConfig, VisionMsg
from vision.vision_engine import VisionEngine

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Globals shared between tasks
# ---------------------------------------------------------------------------

_executor: Optional[MissionExecutor] = None
_driver: Optional[RVRDriver] = None
_shutdown_event: asyncio.Event = asyncio.Event()

# Vision components initialized in run() and passed to MissionExecutor
_camera: Optional[Camera] = None
_vision_engine: Optional[VisionEngine] = None
_vision_config: Optional[VisionConfig] = None

# Swarm coordinator initialized in run() for swarm-capable robots
_swarm: Optional[SwarmCoordinator] = None
_ble_followers: Optional[BLEFollowerManager] = None

# ---------------------------------------------------------------------------
# Registration helpers
# ---------------------------------------------------------------------------


def _build_register_msg() -> dict:
    """Build the registration message dict for the current auth configuration.

    Auth priority:
    1. Persisted DID (from DID_FILE or ROBOT_DID env var)
    2. One-time REGISTRATION_TOKEN (first-time registration)
    3. Legacy AUTH_TOKEN (backward-compatible shared secret)

    Returns:
        A plain dict ready for stamping and JSON serialisation.
    """
    robot_id = cfg.ROBOT_ID
    capabilities = [
        "patrol", "find_engage", "resupply",
        "recon_area", "visual_search", "overwatch", "resupply_route",
    ]
    if cfg.VISION_ENABLED:
        capabilities.extend(["vision", "ISR"])
    if cfg.SWARM_ENABLED:
        capabilities.extend(["swarm_patrol", "swarm_recon", "swarm_advance", "swarm_leader"])

    # Priority 1: persisted DID
    did = cfg.load_persisted_did() or cfg.ROBOT_DID
    if did:
        return {
            "type": "robot:register",
            "robot_id": robot_id,
            "did": did,
            "capabilities": capabilities,
        }

    # Priority 2: one-time registration token
    if cfg.REGISTRATION_TOKEN:
        return {
            "type": "robot:register",
            "robot_id": robot_id,
            "token": cfg.REGISTRATION_TOKEN,
            "capabilities": capabilities,
        }

    # Priority 3: legacy shared AUTH_TOKEN
    return {
        "type": "robot:register",
        "robot_id": robot_id,
        "auth_token": cfg.AUTH_TOKEN,
        "capabilities": capabilities,
    }


# ---------------------------------------------------------------------------
# mDNS bridge discovery
# ---------------------------------------------------------------------------


async def discover_bridge() -> Optional[str]:
    """Discover a local Bastion bridge via mDNS.

    Browses for ``_bastion._tcp.local.`` services. On success, extracts the
    relay_port TXT record and constructs a WebSocket URL.

    Falls back to ``BRIDGE_HOST``/``BRIDGE_PORT`` env vars if mDNS times out
    and no services are found.

    Returns:
        WebSocket URL string (``ws://{host}:{port}/ws/robot``) or ``None``
        if no bridge is available.
    """
    log.info("mission_client.bridge_discovery.start", timeout=cfg.MDNS_BROWSE_TIMEOUT_SEC)
    try:
        results = await browse_service("_bastion._tcp.local.", timeout=cfg.MDNS_BROWSE_TIMEOUT_SEC)
    except Exception as exc:  # noqa: BLE001
        log.warning("mission_client.bridge_discovery.browse_error", error=str(exc))
        results = []

    if results:
        svc = results[0]
        address = svc.addresses[0] if svc.addresses else cfg.BRIDGE_HOST
        # Prefer relay_port from TXT record; fall back to service port
        relay_port = svc.properties.get("relay_port", str(svc.port)) or str(svc.port)
        url = f"ws://{address}:{relay_port}/ws/robot"
        log.info("mission_client.bridge_discovery.found", url=url, service=svc.name)
        return url

    # mDNS timed out — fall back to manual config
    if cfg.BRIDGE_HOST:
        url = f"ws://{cfg.BRIDGE_HOST}:{cfg.BRIDGE_PORT}/ws/robot"
        log.info("mission_client.bridge_discovery.fallback", url=url)
        return url

    log.info("mission_client.bridge_discovery.none_found")
    return None


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
    await send_stamped(ws, msg.model_dump(mode="json"))


async def _send_telemetry(ws: websockets.WebSocketClientProtocol, msg: TelemetryMsg) -> None:
    await send_stamped(ws, msg.model_dump(mode="json"))


async def _send_vision(ws: websockets.WebSocketClientProtocol, msg: VisionMsg) -> None:
    await send_stamped(ws, msg.model_dump(mode="json"))


async def _send_swarm_telemetry(ws: websockets.WebSocketClientProtocol, msg: SwarmTelemetry) -> None:
    await send_stamped(ws, msg.model_dump(mode="json"))


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
                # Leader telemetry
                x, y = driver.position
                battery = await driver.get_battery_pct()
                msg = TelemetryMsg(
                    robot_id=robot_id,
                    position={"x": x, "y": y},
                    heading=driver.heading,
                    battery=battery,
                    timestamp=datetime.utcnow(),
                )
                await _send_telemetry(ws, msg)

                # BLE follower telemetry — send each follower's position
                if _ble_followers and _ble_followers.connected_count > 0:
                    for follower in _ble_followers.followers:
                        if follower.driver.connected:
                            fx, fy = follower.driver.position
                            fbat = await follower.driver.get_battery_pct()
                            fmsg = TelemetryMsg(
                                robot_id=follower.robot_id,
                                position={"x": fx, "y": fy},
                                heading=follower.driver.heading,
                                battery=fbat,
                                timestamp=datetime.utcnow(),
                            )
                            await _send_telemetry(ws, fmsg)
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
    capabilities_list: Optional[list] = None,
) -> None:
    """
    Main receive loop — parse incoming messages and dispatch by type.

    Handles ``robot:registered`` to persist the DID on first-time registration.
    Exits when the connection closes or shutdown is requested.

    Args:
        ws: Active WebSocket connection.
        executor: MissionExecutor instance for dispatching missions.
        capabilities_list: Robot capability strings for pre-flight validation.
    """
    log.info("mission_client.receive_loop.start")
    if capabilities_list is None:
        capabilities_list = []
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

            if msg_type == "robot:registered":
                # Server confirmed registration and may return a DID
                did = msg.get("did")
                if did:
                    cfg.persist_did(did)
                    log.info("mission_client.registered.did_persisted", did=did)
                else:
                    log.info("mission_client.registered", robot_id=cfg.ROBOT_ID)

            elif msg_type == "mission:assign":
                log.info("mission_client.received.mission_assign", payload_keys=list(msg.keys()))
                try:
                    mission = MissionJSON.model_validate(msg.get("mission") or msg.get("payload") or msg)
                    # Pre-flight validation before dispatching to hardware
                    rejection = validate_mission(
                        mission,
                        robot_capabilities=capabilities_list,
                        autonomy_level=cfg.ROBOT_AUTONOMY_LEVEL,
                    )
                    if rejection:
                        log.warning("mission_client.pre_flight_rejected", reason=rejection)
                        await executor._transition(mission.mission_id, "rejected", {"reason": rejection})
                        continue
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

            elif msg_type == "robot:profile_response":
                log.info("mission_client.profile_response", profile=msg.get("profile"))

            elif msg_type == "robot:manual_nudge":
                try:
                    heading = float(msg.get("heading", 0))
                    speed = int(msg.get("speed", 100))
                    duration = float(msg.get("duration_sec", 1.0))
                    log.info("mission_client.manual_nudge", heading=heading, speed=speed, duration=duration)
                    asyncio.create_task(driver.drive(speed, heading, duration))
                except Exception as exc:
                    log.error("mission_client.manual_nudge.error", error=str(exc))

            elif msg_type == "robot:manual_navigate":
                try:
                    tx = float(msg.get("target_x", 0))
                    ty = float(msg.get("target_y", 0))
                    speed = int(msg.get("speed", 100))
                    log.info("mission_client.manual_navigate", target_x=tx, target_y=ty, speed=speed)
                    asyncio.create_task(driver.drive_to_point(tx, ty, speed))
                except Exception as exc:
                    log.error("mission_client.manual_navigate.error", error=str(exc))

            elif msg_type == "robot:manual_stop":
                log.info("mission_client.manual_stop")
                asyncio.create_task(driver.safe_stop())

            elif msg_type == "swarm:add_resource":
                log.info("mission_client.received.swarm_add_resource", robot_id=msg.get("robot_id"))
                if _swarm is not None:
                    try:
                        add_msg = SwarmAddResource.model_validate(msg.get("payload", msg))
                        await _swarm.add_resource(add_msg)
                    except Exception as exc:
                        log.error("mission_client.swarm_add.error", error=str(exc))

            elif msg_type == "swarm:remove_resource":
                log.info("mission_client.received.swarm_remove_resource", robot_id=msg.get("robot_id"))
                if _swarm is not None:
                    try:
                        rm_msg = SwarmRemoveResource.model_validate(msg.get("payload", msg))
                        await _swarm.remove_resource(rm_msg)
                    except Exception as exc:
                        log.error("mission_client.swarm_remove.error", error=str(exc))

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


async def connect_and_run(driver: RVRDriver, ws_url: str) -> None:
    """
    Open a WS connection to *ws_url*, register, start loops, await disconnect.

    Raises websockets exceptions on connection failure; caller handles backoff.

    Args:
        driver: Initialised RVRDriver instance.
        ws_url: WebSocket URL to connect to (direct cloud or bridge relay).
    """
    log.info("mission_client.connecting", url=ws_url)

    async with websockets.connect(ws_url) as ws:
        log.info("mission_client.connected", url=ws_url)

        # Build and send registration message (stamped with message_id)
        reg_msg = _build_register_msg()
        # Extract capabilities list for pre-flight validation in receive loop
        capabilities_list = reg_msg.get("capabilities", [])
        await send_stamped(ws, reg_msg)
        log.info("mission_client.registered", robot_id=cfg.ROBOT_ID)

        # Register BLE followers as sub-resources of the leader
        if _ble_followers and _ble_followers.connected_count > 0:
            leader_did = reg_msg.get("did", "")
            for follower in _ble_followers.followers:
                if follower.driver.connected:
                    follower_reg = {
                        "type": "robot:register",
                        "robot_id": follower.robot_id,
                        "did": f"did:ble:{follower.driver.address.replace(':', '')}",
                        "capabilities": ["patrol", "find_engage"],
                        "parent_robot_id": cfg.ROBOT_ID,
                    }
                    await send_stamped(ws, follower_reg)
                    log.info("mission_client.follower_registered",
                             robot_id=follower.robot_id,
                             address=follower.driver.address)

        # Build executor with bound WS callbacks and vision components
        executor = MissionExecutor(
            driver=driver,
            send_state_fn=lambda msg: _send_state(ws, msg),
            send_telemetry_fn=lambda msg: _send_telemetry(ws, msg),
            robot_id=cfg.ROBOT_ID,
            vision_engine=_vision_engine,
            send_vision_fn=(lambda msg: _send_vision(ws, msg)) if _vision_engine else None,
            vision_config=_vision_config,
            camera=_camera,
        )

        # Attach swarm coordinator if available
        if _swarm is not None:
            executor.set_swarm(_swarm)
            _swarm._send_telemetry = lambda msg: _send_swarm_telemetry(ws, msg)

        # Store global reference so shutdown can abort active missions
        global _executor
        _executor = executor

        # Run telemetry and receive loops concurrently
        telemetry_task = asyncio.create_task(
            telemetry_loop(ws, driver, cfg.ROBOT_ID),
            name="telemetry-loop",
        )
        receive_task = asyncio.create_task(
            receive_loop(ws, executor, capabilities_list=capabilities_list),
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
# Main run loop with reconnection and dual-path failover
# ---------------------------------------------------------------------------


async def run() -> None:
    """
    Main execution loop.

    Initialises hardware, discovers the bridge via mDNS, then enters a
    reconnection loop with exponential backoff and dual-path failover:

    - Primary path: direct cloud WebSocket (BASTION_WS_URL)
    - Fallback path: bridge relay WebSocket (mDNS-discovered or BRIDGE_HOST)

    On disconnect from the primary path, the robot switches to the bridge
    relay. On bridge disconnect, it attempts direct again. Only one active
    connection at a time.
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

    # Initialize vision engine and camera from config
    global _camera, _vision_engine, _vision_config
    if cfg.VISION_ENABLED:
        _camera = Camera(sensor_id=cfg.CAMERA_SENSOR_ID, simulate=cfg.SIMULATE)
        _vision_engine = VisionEngine(
            model=cfg.VISION_MODEL,
            threshold=cfg.VISION_THRESHOLD,
            simulate=cfg.SIMULATE,
        )
        _vision_config = VisionConfig(
            enabled=True,
            model=cfg.VISION_MODEL,
            threshold=cfg.VISION_THRESHOLD,
            keyframe_enabled=cfg.KEYFRAME_ENABLED,
            keyframe_quality=cfg.KEYFRAME_JPEG_QUALITY,
            vlm_enabled=cfg.VISION_VLM_ENABLED,
            vision_cadence_ms=cfg.VISION_CADENCE_MS,
        )
        log.info(
            "mission_client.vision_initialized",
            model=cfg.VISION_MODEL,
            simulate=cfg.SIMULATE,
            mock=_vision_engine.is_mock,
        )

    # Initialize swarm coordinator if enabled
    global _swarm, _ble_followers
    if cfg.SWARM_ENABLED:
        # Determine role: auto = leader if vision-equipped, else follower
        if cfg.SWARM_ROLE == "leader":
            swarm_role = SwarmRole.leader
        elif cfg.SWARM_ROLE == "follower":
            swarm_role = SwarmRole.follower
        else:  # auto
            swarm_role = SwarmRole.leader if cfg.VISION_ENABLED else SwarmRole.follower

        _swarm = SwarmCoordinator(
            robot_id=cfg.ROBOT_ID,
            role=swarm_role,
            drive_to_fn=driver.drive_to_point,
            simulate=cfg.SIMULATE,
        )
        await _swarm.start()
        log.info(
            "mission_client.swarm_initialized",
            role=swarm_role,
            simulate=cfg.SIMULATE,
        )

        # Connect to BLE followers if configured and we're the leader
        if swarm_role == SwarmRole.leader and cfg.BLE_FOLLOWERS:
            addresses = [a.strip() for a in cfg.BLE_FOLLOWERS.split(",") if a.strip()]
            if addresses:
                _ble_followers = BLEFollowerManager(
                    exclude_addresses=[],
                    max_followers=len(addresses),
                )
                for i, addr in enumerate(addresses):
                    name = f"ble-{addr[-5:].replace(':', '')}"
                    success = await _ble_followers.connect_by_address(
                        address=addr, name=name, slot_index=i + 1,
                    )
                    if success:
                        log.info("mission_client.ble_follower_connected",
                                 address=addr, name=name, slot=i + 1)
                    else:
                        log.warning("mission_client.ble_follower_failed",
                                    address=addr)

                log.info("mission_client.ble_followers_ready",
                         connected=_ble_followers.connected_count,
                         total=len(addresses))

                # Wire follower drivers into swarm coordinator
                if _ble_followers.connected_count > 0:
                    _swarm.set_ble_followers(_ble_followers)

    # Discover bridge via mDNS before entering the connection loop
    bridge_url: Optional[str] = await discover_bridge()

    # Build full capabilities string for mDNS advertisement
    all_caps = "patrol_route,find_engage,recon_area,visual_search,overwatch,resupply_route"
    if cfg.VISION_ENABLED:
        all_caps += ",vision"

    # Start mDNS advertisement so other peers can discover this robot
    advert_task: Optional[asyncio.Task] = None
    if not _shutdown_event.is_set():
        advert_task = asyncio.create_task(
            advertise_service(
                service_type="_bastion-robot._tcp.local.",
                name=f"robot-{cfg.ROBOT_ID}",
                port=0,  # Not listening; port is informational
                properties={
                    "robot_id": cfg.ROBOT_ID,
                    "capabilities": all_caps,
                },
                shutdown_event=_shutdown_event,
            ),
            name="mdns-advertise",
        )

    delay = cfg.RECONNECT_INITIAL_DELAY
    # Track current path: start on direct, fail over to bridge, then back
    active_path: str = "direct"

    while not _shutdown_event.is_set():
        if active_path == "direct":
            ws_url = f"{cfg.BASTION_WS_URL}/ws/robot"
        else:
            ws_url = bridge_url or f"{cfg.BASTION_WS_URL}/ws/robot"

        try:
            await connect_and_run(driver, ws_url)
            # Clean disconnect — stay on same path, apply backoff
        except (OSError, ConnectionRefusedError, websockets.InvalidURI) as exc:
            log.warning(
                "mission_client.connection_error",
                path=active_path,
                url=ws_url,
                error=str(exc),
                retry_in=delay,
            )
            # Failover to the other path if available
            if active_path == "direct" and bridge_url:
                log.info("mission_client.failover.direct_to_bridge")
                active_path = "bridge"
            elif active_path == "bridge":
                log.info("mission_client.failover.bridge_to_direct")
                active_path = "direct"
        except Exception as exc:  # noqa: BLE001
            log.error("mission_client.unexpected_error", error=str(exc), retry_in=delay)

        if _shutdown_event.is_set():
            break

        log.info("mission_client.reconnecting_in", delay_sec=delay, path=active_path)
        try:
            await asyncio.wait_for(_shutdown_event.wait(), timeout=delay)
        except asyncio.TimeoutError:
            pass

        # Exponential backoff
        delay = min(delay * 2, cfg.RECONNECT_MAX_DELAY)

    # Graceful shutdown
    log.info("mission_client.shutdown")
    if advert_task is not None:
        advert_task.cancel()
        try:
            await advert_task
        except (asyncio.CancelledError, Exception):
            pass
    if _ble_followers is not None:
        await _ble_followers.stop_all()
        await _ble_followers.disconnect_all()
    if _swarm is not None:
        await _swarm.stop()
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
