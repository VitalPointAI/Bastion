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
import base64
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
from ble_rvr_driver import scan_for_rvr_plus
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
# Background vision feed (sends keyframes independently of mission detections)
# ---------------------------------------------------------------------------

VISION_FEED_INTERVAL_SEC = 1.0  # Send a camera frame every 1 second


async def vision_feed_loop(
    ws: websockets.WebSocketClientProtocol,
    robot_id: str,
) -> None:
    """
    Periodically run detection and send an annotated JPEG keyframe as a
    VisionMsg regardless of whether there is an active mission. This enables
    the robot detail panel on the COP to show a live camera feed with
    bounding boxes at all times.

    Runs whenever VISION_ENABLED is true (no separate keyframe gate).
    Detection runs first so the keyframe is annotated with bounding boxes.
    """
    if not _vision_engine or not _camera:
        return

    log.info("mission_client.vision_feed_loop.start", interval_sec=VISION_FEED_INTERVAL_SEC)
    try:
        while not _shutdown_event.is_set():
            # Skip when a mission is active — the mission's own _vision_loop
            # handles detection and keyframes. Two loops competing for the
            # same camera corrupts the shared _last_frame/_last_detections state.
            if _executor and _executor.current_mission:
                await asyncio.sleep(VISION_FEED_INTERVAL_SEC)
                continue

            try:
                # Single-pass: detect_once captures, detects, annotates, and
                # encodes JPEG in one thread call. get_keyframe_jpeg returns it.
                detections = await _vision_engine.detect_once(_camera)
                jpeg = await _vision_engine.get_keyframe_jpeg(_camera)
                keyframe_b64 = base64.b64encode(jpeg).decode() if jpeg else None
                msg = VisionMsg(
                    robot_id=robot_id,
                    timestamp=datetime.utcnow(),
                    detections=detections or [],
                    keyframe_jpeg_b64=keyframe_b64,
                )
                await _send_vision(ws, msg)
            except (ConnectionClosed, RuntimeError):
                log.warning("mission_client.vision_feed_loop.ws_closed")
                break
            except Exception as exc:  # noqa: BLE001
                log.error("mission_client.vision_feed_loop.error", error=str(exc))

            await asyncio.sleep(VISION_FEED_INTERVAL_SEC)
    except asyncio.CancelledError:
        pass
    finally:
        log.info("mission_client.vision_feed_loop.stop")


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

            if msg_type == "config:credentials":
                # Backend pushes fresh OAuth token so tactical planner can use LLM
                token = msg.get("oauth_token", "")
                if token.startswith("sk-ant-oat"):
                    import tactical_planner
                    tactical_planner._pushed_oauth_token = token
                    log.info("mission_client.oauth_token_received",
                             token_prefix=token[:15] + "...")

            elif msg_type == "robot:registered":
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

                    # Check if this mission is for a BLE follower, not this robot
                    target_robot = getattr(mission, 'robot_id', None) or msg.get("robot_id")
                    if target_robot and target_robot != cfg.ROBOT_ID:
                        # Relay to BLE follower
                        if not _ble_followers:
                            log.warning(
                                "mission_client.relay_failed.no_ble_manager",
                                target=target_robot,
                                command=mission.command,
                                hint="BLE follower manager not initialized",
                            )
                            continue
                        # Log all known followers for debugging relay matching
                        known = [(f.robot_id, f.driver.connected, f.driver.address)
                                 for f in _ble_followers.followers]
                        log.info("mission_client.relay_lookup",
                                 target=target_robot,
                                 known_followers=known,
                                 count=len(known))
                        follower = next(
                            (f for f in _ble_followers.followers if f.robot_id == target_robot),
                            None,
                        )
                        if not follower:
                            # Try matching by suffix (e.g. "bravo" in "ble-bravo")
                            follower = next(
                                (f for f in _ble_followers.followers
                                 if target_robot in f.robot_id or f.robot_id in target_robot),
                                None,
                            )
                        if follower and follower.driver.connected:
                            log.info(
                                "mission_client.relay_to_follower",
                                target=target_robot,
                                follower_id=follower.robot_id,
                                command=mission.command,
                                connected=follower.driver.connected,
                            )
                            # For patrol_route, drive the follower through waypoints
                            if mission.command == "patrol_route" and mission.params.waypoints:
                                face = getattr(mission.params, 'face_target', None)
                                mid = mission.mission_id
                                async def _drive_follower(f, wps, spd, face_tgt, m_id, _ws=ws):
                                    for wp in wps:
                                        log.info("mission_client.follower_driving",
                                                 follower=f.robot_id, x=wp.x, y=wp.y, speed=spd)
                                        await f.driver.drive_to_point(wp.x, wp.y, spd)
                                    # Orient toward threat after reaching firing position
                                    if face_tgt:
                                        fx = face_tgt.x if hasattr(face_tgt, 'x') else face_tgt.get('x', 0)
                                        fy = face_tgt.y if hasattr(face_tgt, 'y') else face_tgt.get('y', 0)
                                        log.info("mission_client.follower_facing_target",
                                                 follower=f.robot_id, target_x=fx, target_y=fy)
                                        await f.driver.face_toward(fx, fy)
                                    log.info("mission_client.follower_route_complete", follower=f.robot_id)
                                    # Report arrival to Bastion so the orchestrator
                                    # knows the follower is in position
                                    try:
                                        await send_stamped(_ws, {
                                            "type": "robot:state_update",
                                            "robot_id": f.robot_id,
                                            "mission_id": m_id,
                                            "state": "complete",
                                        })
                                        log.info("mission_client.follower_arrival_reported",
                                                 follower=f.robot_id, mission_id=m_id)
                                    except Exception as exc:
                                        log.warning("mission_client.follower_arrival_report_failed",
                                                    error=str(exc))
                                asyncio.create_task(
                                    _drive_follower(follower, mission.params.waypoints, mission.params.speed, face, mid),
                                    name=f"follower-{target_robot}-{mission.mission_id}",
                                )
                            elif mission.command == "find_engage" and mission.params.target_location:
                                tgt = mission.params.target_location
                                asyncio.create_task(
                                    follower.driver.drive_to_point(tgt.x, tgt.y, mission.params.speed),
                                    name=f"follower-{target_robot}-{mission.mission_id}",
                                )
                        else:
                            connected = follower.driver.connected if follower else "N/A"
                            available = [f.robot_id for f in _ble_followers.followers]
                            log.warning(
                                "mission_client.follower_not_found",
                                target=target_robot,
                                follower_matched=follower.robot_id if follower else None,
                                ble_connected=connected,
                                available_followers=available,
                                ble_count=_ble_followers.connected_count,
                            )
                        continue

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
                    # Run mission in a background task so receive loop stays responsive.
                    # Store the task ref so abort() can cancel it on mission:cancel.
                    executor._mission_task = asyncio.create_task(
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

            elif msg_type == "resource:granted":
                granted = msg.get("granted_robots", [])
                log.info("mission_client.resource_granted", robots=[r["robot_id"] for r in granted])
                await executor.handle_resource_granted(granted)

            elif msg_type == "resource:denied":
                reason = msg.get("reason", "unknown")
                log.info("mission_client.resource_denied", reason=reason)
                await executor.handle_resource_denied(reason)

            elif msg_type == "robot:profile_response":
                log.info("mission_client.profile_response", profile=msg.get("profile"))

            elif msg_type == "robot:manual_nudge":
                try:
                    target_robot = msg.get("robot_id", cfg.ROBOT_ID)
                    heading = float(msg.get("heading", 0))
                    speed = int(msg.get("speed", 100))
                    duration = float(msg.get("duration_sec", 1.0))
                    log.info("mission_client.manual_nudge", target=target_robot, heading=heading, speed=speed, duration=duration)

                    # Route to BLE follower if target is not this robot
                    if target_robot != cfg.ROBOT_ID and _ble_followers:
                        follower = next(
                            (f for f in _ble_followers.followers if f.robot_id == target_robot),
                            None,
                        )
                        if follower and follower.driver.connected:
                            asyncio.create_task(follower.driver.drive(speed, heading, duration))
                        else:
                            log.warning("mission_client.manual_nudge.follower_not_found",
                                        target=target_robot,
                                        available=[f.robot_id for f in _ble_followers.followers] if _ble_followers else [])
                    else:
                        asyncio.create_task(_driver.drive(speed, heading, duration))
                except Exception as exc:
                    log.error("mission_client.manual_nudge.error", error=str(exc))

            elif msg_type == "robot:manual_navigate":
                try:
                    tx = float(msg.get("target_x", 0))
                    ty = float(msg.get("target_y", 0))
                    speed = int(msg.get("speed", 100))
                    log.info("mission_client.manual_navigate", target_x=tx, target_y=ty, speed=speed)
                    asyncio.create_task(_driver.drive_to_point(tx, ty, speed))
                except Exception as exc:
                    log.error("mission_client.manual_navigate.error", error=str(exc))

            elif msg_type == "mission:pause":
                log.info("mission_client.mission_pause")
                await executor.pause()
                # Also stop BLE followers
                if _ble_followers:
                    for follower in _ble_followers.followers:
                        if follower.driver.connected:
                            await follower.driver.safe_stop()

            elif msg_type == "mission:resume":
                log.info("mission_client.mission_resume")
                await executor.resume()

            elif msg_type == "robot:manual_stop":
                log.info("mission_client.manual_stop")
                # If a mission is active, abort it (cancels task + stops motors).
                # Otherwise just stop the motors directly.
                if executor.current_mission:
                    await executor.abort()
                else:
                    asyncio.create_task(_driver.safe_stop())

            elif msg_type == "robot:reset_position":
                # Full reset for a fresh scenario run — abort all missions, stop all
                # motors, reset positions and yaw. Guarantees a clean slate.
                log.info("mission_client.full_reset_start")

                # 1. Abort any running mission on alpha
                if executor.current_mission:
                    log.info("mission_client.reset_aborting_mission",
                             mission_id=executor.current_mission.mission_id)
                    await executor.abort()
                else:
                    await _driver.safe_stop()

                # 2. Stop all BLE followers and cancel their tasks
                if _ble_followers:
                    for follower in _ble_followers.followers:
                        if follower.driver.connected:
                            await follower.driver.safe_stop()
                    for task in asyncio.all_tasks():
                        if task.get_name().startswith("follower-"):
                            task.cancel()
                    log.info("mission_client.reset_followers_stopped")

                # 3. Reset dead-reckoned positions and heading
                pos = msg.get("position", {})
                px = float(pos.get("x", 0.0))
                py = float(pos.get("y", 0.0))
                hdg = float(msg.get("heading", 0.0))
                _driver.set_position(px, py)
                _driver._heading = hdg

                # 4. Reset yaw on hardware so heading 0 = current facing direction
                await _driver.reset_yaw()

                # 5. Reset BLE follower positions and yaw
                if _ble_followers:
                    from ble_rvr_driver import DID_DRIVE, CID_RESET_YAW, TARGET_ST
                    for follower in _ble_followers.followers:
                        if follower.driver.connected:
                            follower.driver.position = (px, py)
                            follower.driver._heading = hdg
                            await follower.driver._send_packet(DID_DRIVE, CID_RESET_YAW, b"", TARGET_ST)

                log.info("mission_client.full_reset_complete", x=px, y=py, heading=hdg)

            elif msg_type == "mission:cancel":
                log.info("mission_client.mission_cancel")
                # Abort cancels the running asyncio task (stopping drive loops),
                # stops the motors, and transitions the mission to failed.
                await executor.abort()
                # Also stop all BLE follower tasks and motors
                if _ble_followers:
                    for follower in _ble_followers.followers:
                        if follower.driver.connected:
                            log.info("mission_client.cancel_follower", robot_id=follower.robot_id)
                            await follower.driver.safe_stop()
                    # Cancel any running follower asyncio tasks
                    for task in asyncio.all_tasks():
                        if task.get_name().startswith("follower-"):
                            task.cancel()

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

        # Connect and register BLE followers in the background (non-blocking).
        # First re-registers any already-connected followers (e.g. after WS reconnect),
        # then scans for new ones that haven't connected yet.
        async def _connect_ble_followers_bg():
            if not _ble_followers:
                return

            # Re-register already-connected followers immediately (WS reconnect case)
            already_connected = 0
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
                    log.info("mission_client.follower_re_registered",
                             robot_id=follower.robot_id,
                             address=follower.driver.address)
                    already_connected += 1
            if already_connected > 0:
                log.info("mission_client.ble_followers_re_registered", count=already_connected)
                if _swarm:
                    _swarm.set_ble_followers(_ble_followers)

            addresses = [a.strip().upper() for a in cfg.BLE_FOLLOWERS.split(",") if a.strip()]
            # Only scan for followers that aren't already connected
            connected_addrs = {f.driver.address.upper() for f in _ble_followers.followers if f.driver.connected}
            pending = {addr: i for i, addr in enumerate(addresses) if addr not in connected_addrs}

            if not pending:
                log.info("mission_client.ble_all_followers_already_connected")
                return

            max_rounds = 12  # ~2 minutes of retrying (10s scan + pause per round)

            for round_num in range(1, max_rounds + 1):
                if not pending:
                    break

                # Scan for devices currently advertising — only try to connect to those
                log.info("mission_client.ble_scan_round", round=round_num,
                         pending=list(pending.keys()))
                discovered = await scan_for_rvr_plus(timeout=8.0)
                discovered_addrs = {d["address"].upper() for d in discovered}

                # Connect to each pending follower that is currently advertising
                for addr in list(pending.keys()):
                    if addr not in discovered_addrs:
                        continue

                    idx = pending[addr]
                    name = f"ble-{addr[-5:].replace(':', '')}"
                    success = await _ble_followers.connect_by_address(
                        address=addr, name=name, slot_index=idx + 1,
                    )
                    if success:
                        log.info("mission_client.ble_follower_connected",
                                 address=addr, name=name, slot=idx + 1)
                        follower = next(
                            (f for f in _ble_followers.followers
                             if f.driver.address.upper() == addr),
                            None,
                        )
                        if follower and follower.driver.connected:
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
                            if _swarm:
                                _swarm.set_ble_followers(_ble_followers)
                        del pending[addr]
                    else:
                        log.warning("mission_client.ble_follower_connect_failed",
                                    address=addr, round=round_num)

                if pending:
                    log.info("mission_client.ble_waiting_for_followers",
                             pending=list(pending.keys()), next_scan_in="10s")
                    await asyncio.sleep(10)

            if pending:
                log.warning("mission_client.ble_followers_gave_up",
                            not_connected=list(pending.keys()))

            log.info("mission_client.ble_followers_ready",
                     connected=_ble_followers.connected_count,
                     total=len(addresses))

        if _ble_followers is not None:
            # Re-register already-connected followers SYNCHRONOUSLY before starting
            # the receive loop. This ensures the backend knows about bravo/charlie
            # before any mission:assign messages arrive.
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
                    log.info("mission_client.follower_registered_sync",
                             robot_id=follower.robot_id)
            # Background task handles scanning for NEW followers not yet connected
            asyncio.create_task(_connect_ble_followers_bg(), name="ble-follower-connect")

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

        # Set WS send function for resource requests
        executor._ws_send_fn = lambda msg: _ws_send(ws, msg)

        # Attach swarm coordinator if available
        if _swarm is not None:
            executor.set_swarm(_swarm)
            _swarm._send_telemetry = lambda msg: _send_swarm_telemetry(ws, msg)

        # Store global reference so shutdown can abort active missions
        global _executor
        _executor = executor

        # Run telemetry, receive, and vision feed loops concurrently
        telemetry_task = asyncio.create_task(
            telemetry_loop(ws, driver, cfg.ROBOT_ID),
            name="telemetry-loop",
        )
        receive_task = asyncio.create_task(
            receive_loop(ws, executor, capabilities_list=capabilities_list),
            name="receive-loop",
        )
        vision_feed_task = asyncio.create_task(
            vision_feed_loop(ws, cfg.ROBOT_ID),
            name="vision-feed-loop",
        )

        # Wait for any loop to exit (connection closed or shutdown)
        done, pending = await asyncio.wait(
            [telemetry_task, receive_task, vision_feed_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Abort the executor's active mission — its internal vision loop
        # holds the camera lock and uses the (now dead) WS callbacks.
        # Without this, the vision loop becomes a zombie on reconnect.
        if executor.current_mission:
            log.info("mission_client.aborting_stale_mission",
                     mission_id=executor.current_mission.mission_id)
            await executor.abort()

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
            imgsz=cfg.VISION_IMGSZ,
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

        # Prepare BLE follower manager (connections happen in background after WS is up)
        if swarm_role == SwarmRole.leader and cfg.BLE_FOLLOWERS:
            addresses = [a.strip() for a in cfg.BLE_FOLLOWERS.split(",") if a.strip()]
            if addresses:
                _ble_followers = BLEFollowerManager(
                    exclude_addresses=[],
                    max_followers=len(addresses),
                )
                log.info("mission_client.ble_followers_deferred",
                         count=len(addresses),
                         hint="BLE connections will start after WebSocket is established")

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
