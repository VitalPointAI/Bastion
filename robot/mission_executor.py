"""
Mission state machine and behavior dispatcher for the Bastion robot.

Receives a MissionJSON from the mission client and executes it on the
Sphero RVR+ driver. Reports state transitions back to Bastion via callback
functions supplied at construction time.

Supported commands:
  - find_engage     : Navigate to target, pause for human authorization, engage
  - patrol_route    : Follow a sequence of waypoints
  - recon_area      : Boustrophedon sweep of an area with vision detection
  - visual_search   : Sweep area searching for a reference image target
  - overwatch       : Drive to position, hold, and monitor with continuous vision
  - resupply_route  : Navigate waypoints with obstacle-aware vision
"""
from __future__ import annotations

import asyncio
import base64
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Optional

import structlog

from models import MissionJSON, MissionParams, MissionState, StateUpdateMsg, TelemetryMsg
from rvr_driver import RVRDriver
from swarm.coordinator import SwarmCoordinator
from swarm.models import (
    FormationType,
    MovementTechnique,
    Position2D,
    SwarmMissionParams,
    SwarmRole,
)
from vision.models import VisionMsg

log = structlog.get_logger(__name__)

# Type aliases for the callback functions injected by the mission client
SendStateFn = Callable[[StateUpdateMsg], Awaitable[None]]
SendTelemetryFn = Callable[[TelemetryMsg], Awaitable[None]]
SendVisionFn = Callable[[VisionMsg], Awaitable[None]]


class MissionExecutor:
    """
    Executes missions on the RVR+ and reports state transitions to Bastion.

    Args:
        driver: Initialized RVRDriver instance.
        send_state_fn: Async callback to send a StateUpdateMsg to Bastion.
        send_telemetry_fn: Async callback to send a TelemetryMsg to Bastion.
        robot_id: Robot identifier (used in telemetry messages).
        vision_engine: Optional VisionEngine or MockVisionEngine instance.
        send_vision_fn: Optional async callback to send a VisionMsg to Bastion.
        vision_config: Optional VisionConfig controlling cadence and keyframe settings.
        camera: Optional Camera or MockCamera instance for vision capture.
    """

    def __init__(
        self,
        driver: RVRDriver,
        send_state_fn: SendStateFn,
        send_telemetry_fn: SendTelemetryFn,
        robot_id: str,
        vision_engine: Optional[Any] = None,
        send_vision_fn: Optional[SendVisionFn] = None,
        vision_config: Optional[Any] = None,
        camera: Optional[Any] = None,
    ) -> None:
        self._driver = driver
        self._send_state = send_state_fn
        self._send_telemetry = send_telemetry_fn
        self._robot_id = robot_id
        self._vision_engine = vision_engine
        self._send_vision_fn = send_vision_fn
        self._vision_config = vision_config
        self._camera = camera
        self._swarm: Optional[SwarmCoordinator] = None

        self.current_mission: Optional[MissionJSON] = None
        self.current_state: Optional[MissionState] = None
        self._mission_task: Optional[asyncio.Task] = None

        # Event set when an authorization response arrives from Bastion
        self._auth_event: asyncio.Event = asyncio.Event()
        self._auth_approved: bool = False

        # Resource allocation: event + granted robot list
        self._resource_event: asyncio.Event = asyncio.Event()
        self._granted_robots: List[Dict[str, Any]] = []
        self._resource_denied: bool = False
        self._ws_send_fn: Optional[Any] = None  # Set by mission_client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def execute_mission(self, mission: MissionJSON) -> None:
        """
        Main mission entry point called by the mission client.

        Validates the mission, dispatches to the appropriate behavior, and
        ensures state transitions are always reported even if behavior raises.
        """
        log_ctx = log.bind(mission_id=mission.mission_id, command=mission.command)

        # Validate command
        supported_commands = {
            "find_engage",
            "patrol_route",
            "recon_area",
            "visual_search",
            "overwatch",
            "resupply_route",
            "swarm_patrol",
            "swarm_recon",
            "swarm_advance",
        }
        if mission.command not in supported_commands:
            log_ctx.warning("mission_executor.unsupported_command")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": f"Unsupported command: {mission.command}"},
            )
            return

        # find_engage always requires a target location (gate-based flow)
        if mission.command == "find_engage" and mission.params.target_location is None:
            log_ctx.warning("mission_executor.missing_target_location")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "find_engage requires params.target_location"},
            )
            return
        # Other missions: tactical planner will generate waypoints if not provided

        # Accept the mission
        self.current_mission = mission
        self.current_state = MissionState.accepted
        await self._transition(mission.mission_id, MissionState.accepted)
        log_ctx.info("mission_executor.accepted")

        # Set initial position from mission params if provided (applies to all commands)
        start_pos = getattr(mission.params, 'start_position', None)
        if start_pos is None and hasattr(mission.params, '__dict__'):
            # Also check as dict key (Pydantic model may not have the attribute)
            start_pos = getattr(mission.params, '__dict__', {}).get('start_position')
        if start_pos and hasattr(self._driver, 'set_position'):
            x = start_pos.get('x', 0) if isinstance(start_pos, dict) else getattr(start_pos, 'x', 0)
            y = start_pos.get('y', 0) if isinstance(start_pos, dict) else getattr(start_pos, 'y', 0)
            self._driver.set_position(x, y)
            log_ctx.info("mission_executor.start_position_set", x=x, y=y)

        # Dispatch to behavior — tactical planner generates the plan, then
        # _execute_tactical_plan drives the phases. Swarm missions use their
        # own dispatcher. find_engage keeps its gate-based flow.
        try:
            if mission.command in ("swarm_patrol", "swarm_recon", "swarm_advance"):
                await self._execute_swarm_mission(mission)
            elif mission.command == "find_engage":
                await self._execute_find_engage(mission)
            else:
                await self._execute_with_tactical_plan(mission)
        except asyncio.CancelledError:
            log_ctx.warning("mission_executor.cancelled")
            await self._transition(
                mission.mission_id,
                MissionState.failed,
                {"reason": "Mission task cancelled"},
            )
            raise
        except Exception as exc:  # noqa: BLE001
            log_ctx.error("mission_executor.error", error=str(exc))
            await self._transition(
                mission.mission_id,
                MissionState.failed,
                {"reason": str(exc)},
            )
        finally:
            self.current_mission = None
            self.current_state = None

    async def handle_auth_response(self, approved: bool) -> None:
        """
        Called by the mission client when a mission:auth_response arrives.

        Resolves the authorization gate in _execute_find_engage.
        """
        self._auth_approved = approved
        self._auth_event.set()
        log.info("mission_executor.auth_response", approved=approved)

    async def handle_resource_granted(self, granted_robots: List[Dict[str, Any]]) -> None:
        """Called when Bastion grants requested resources."""
        self._granted_robots = granted_robots
        self._resource_denied = False
        self._resource_event.set()
        log.info(
            "mission_executor.resources_granted",
            robots=[r["robot_id"] for r in granted_robots],
        )

    async def handle_resource_denied(self, reason: str) -> None:
        """Called when Bastion denies a resource request."""
        self._granted_robots = []
        self._resource_denied = True
        self._resource_event.set()
        log.info("mission_executor.resources_denied", reason=reason)

    async def request_resources(
        self,
        mission_id: str,
        count: int = 2,
        capabilities: Optional[List[str]] = None,
        reason: str = "Mission requires additional resources",
        preferred_robots: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Request resources from Bastion and wait for approval.

        Sends a resource:request message and blocks until the gate is resolved.
        Returns list of granted robot dicts [{robot_id, capabilities}] or empty
        list if denied.
        """
        if not self._ws_send_fn:
            log.warning("mission_executor.request_resources.no_ws")
            return []

        self._resource_event.clear()
        self._granted_robots = []
        self._resource_denied = False

        request_msg = {
            "type": "resource:request",
            "robot_id": self._robot_id,
            "mission_id": mission_id,
            "required_capabilities": capabilities or [],
            "count": count,
            "reason": reason,
            "preferred_robots": preferred_robots or [],
            "timestamp": datetime.utcnow().isoformat(),
        }

        await self._ws_send_fn(request_msg)
        log.info(
            "mission_executor.resource_request_sent",
            mission_id=mission_id,
            count=count,
            reason=reason,
        )

        # Wait for response (no timeout — gate decides timing)
        await self._resource_event.wait()

        if self._resource_denied:
            log.info("mission_executor.resource_request.denied")
            return []

        return self._granted_robots

    async def command_resource(
        self,
        target_robot_id: str,
        mission_id: str,
        action: str,
        params: Dict[str, Any],
    ) -> None:
        """Send a command to a granted resource via Bastion relay."""
        if not self._ws_send_fn:
            return

        cmd_msg = {
            "type": "resource:command",
            "from_robot_id": self._robot_id,
            "target_robot_id": target_robot_id,
            "mission_id": mission_id,
            "command": {
                "action": action,
                "params": params,
            },
        }
        await self._ws_send_fn(cmd_msg)
        log.info(
            "mission_executor.resource_command",
            target=target_robot_id,
            action=action,
        )

    async def abort(self) -> None:
        """Cancel the running mission task and stop the robot immediately."""
        # Cancel the running mission task — this triggers CancelledError
        # which the execute_mission dispatcher catches and transitions to failed.
        if self._mission_task and not self._mission_task.done():
            self._mission_task.cancel()
            try:
                await self._mission_task
            except (asyncio.CancelledError, Exception):
                pass
        await self._driver.safe_stop()
        if self.current_mission:
            await self._transition(
                self.current_mission.mission_id,
                MissionState.failed,
                {"reason": "Mission aborted"},
            )
            self.current_mission = None
        log.info("mission_executor.aborted")

    # ------------------------------------------------------------------
    # Vision loop helper
    # ------------------------------------------------------------------

    async def _vision_loop(
        self, mission_id: str, stop_event: asyncio.Event,
        obstacle_event: Optional[asyncio.Event] = None,
    ) -> None:
        """Run detection loop at profile-determined cadence. Sends VisionMsg on detections.

        If *obstacle_event* is provided, large centered detections set the event
        so the patrol behaviour can stop and perform an avoidance manoeuvre.
        """
        cadence_sec = (self._vision_config.vision_cadence_ms / 1000.0) if self._vision_config else 0.5
        # Obstacle thresholds (pixel-space):
        # – bbox occupies > 30 % of frame width → "close"
        # – centre_x within ±20 % of frame centre → "ahead"
        FRAME_W = 640  # assumed capture width
        OBS_WIDTH_FRAC = 0.30
        OBS_CENTRE_TOL = 0.20 * FRAME_W  # ±128 px

        while not stop_event.is_set():
            try:
                detections = await self._vision_engine.detect_once(self._camera)

                # Send annotated keyframe — detect_once already encoded the JPEG
                # with bounding boxes in a single thread pass (no extra capture).
                if self._send_vision_fn:
                    keyframe = None
                    jpeg = await self._vision_engine.get_keyframe_jpeg(self._camera)
                    if jpeg:
                        keyframe = base64.b64encode(jpeg).decode()
                    vision_msg = VisionMsg(
                        robot_id=self._robot_id,
                        mission_id=mission_id,
                        timestamp=datetime.utcnow(),
                        detections=detections,
                        keyframe_jpeg_b64=keyframe,
                    )
                    await self._send_vision_fn(vision_msg)
                    if detections:
                        log.info(
                            "mission_executor.vision_loop.detection",
                            mission_id=mission_id,
                            count=len(detections),
                            classes=[d.class_desc if hasattr(d, 'class_desc') else str(d) for d in detections],
                        )

                # Obstacle check — signal patrol to dodge if something big is ahead
                if obstacle_event and detections:
                    for det in detections:
                        bbox = det.bbox if hasattr(det, 'bbox') else {}
                        left = bbox.get("left", 0)
                        right = bbox.get("right", 0)
                        box_w = right - left
                        cx = det.center_x if hasattr(det, 'center_x') and det.center_x else (left + right) / 2

                        if box_w > FRAME_W * OBS_WIDTH_FRAC and abs(cx - FRAME_W / 2) < OBS_CENTRE_TOL:
                            log.info(
                                "mission_executor.obstacle_detected",
                                class_desc=det.class_desc,
                                box_w=box_w,
                                cx=cx,
                            )
                            obstacle_event.set()
                            break
            except Exception as exc:
                log.warning("mission_executor.vision_loop.error", error=str(exc))
            await asyncio.sleep(cadence_sec)

    # ------------------------------------------------------------------
    # Tactical plan execution
    # ------------------------------------------------------------------

    async def _execute_with_tactical_plan(self, mission: MissionJSON) -> None:
        """Generate a tactical plan via LLM, then execute its phases.

        Falls back to geometric planning if the LLM is unavailable.
        """
        from tactical_planner import generate_tactical_plan, fallback_plan

        log_ctx = log.bind(mission_id=mission.mission_id, command=mission.command)

        # Build params dict for the planner
        params_dict = mission.params.model_dump(exclude_none=True)

        # Get available followers
        followers = []
        if self._swarm and hasattr(self._swarm, '_ble_followers') and self._swarm._ble_followers:
            mgr = self._swarm._ble_followers
            followers = [f"follower-{i}" for i in range(mgr.connected_count)]

        # Try LLM tactical planning
        plan = await generate_tactical_plan(
            command=mission.command,
            params=params_dict,
            mission_id=mission.mission_id,
            robot_id=self._robot_id,
            available_followers=followers if followers else None,
        )

        if plan is None:
            log_ctx.info("tactical_planner.fallback", reason="LLM unavailable")
            plan = fallback_plan(mission.command, params_dict)

        phases = plan.get("phases", [])
        if not phases:
            log_ctx.warning("tactical_planner.no_phases")
            await self._transition(mission.mission_id, MissionState.failed, {"reason": "Planner generated no phases"})
            return

        log_ctx.info(
            "tactical_planner.executing",
            phase_count=len(phases),
            roe=plan.get("rules_of_engagement", ""),
        )

        await self._transition(mission.mission_id, MissionState.executing)

        # Execute each phase
        stop_event = asyncio.Event()
        vision_task = None

        for phase_idx, phase in enumerate(phases):
            phase_name = phase.get("name", f"Phase {phase_idx + 1}")
            waypoints = phase.get("waypoints", [])
            speed = phase.get("speed", 100)
            vision_mode = phase.get("vision_mode", "continuous")
            leds = phase.get("leds", {})
            halt_on_detection = phase.get("halt_on_detection", False)

            log_ctx.info(
                "tactical_planner.phase_start",
                phase=phase_name,
                phase_idx=phase_idx,
                waypoints=len(waypoints),
                speed=speed,
            )

            # Set LEDs for this phase
            if leds:
                await self._driver.set_leds(
                    leds.get("r", 0), leds.get("g", 0), leds.get("b", 0),
                )

            # Start vision loop if needed
            if self._vision_engine and vision_mode != "off":
                if vision_task is None or vision_task.done():
                    stop_event.clear()
                    obstacle_event = asyncio.Event()
                    vision_task = asyncio.ensure_future(
                        self._vision_loop(mission.mission_id, stop_event, obstacle_event)
                    )

            # Drive waypoints
            for wp_idx, wp in enumerate(waypoints):
                wp_x = wp.get("x", 0) if isinstance(wp, dict) else getattr(wp, "x", 0)
                wp_y = wp.get("y", 0) if isinstance(wp, dict) else getattr(wp, "y", 0)

                log_ctx.info(
                    "tactical_planner.waypoint",
                    phase=phase_name,
                    wp_idx=wp_idx,
                    total=len(waypoints),
                    x=wp_x,
                    y=wp_y,
                )

                await self._driver.drive_to_point(wp_x, wp_y, speed)
                await self._emit_telemetry(mission.mission_id)

            # Command followers for this phase if available
            follower_positions = phase.get("follower_positions", [])
            if follower_positions and self._ws_send_fn:
                for fp in follower_positions:
                    target_id = fp.get("robot_id", "")
                    fx = fp.get("x", fp.get("offset_x", 0))
                    fy = fp.get("y", fp.get("offset_y", 0))
                    await self.command_resource(
                        target_id, mission.mission_id,
                        "drive_to_point", {"x": fx, "y": fy, "speed": speed},
                    )

        # Cleanup
        if vision_task and not vision_task.done():
            stop_event.set()
            vision_task.cancel()

        await self._transition(mission.mission_id, MissionState.complete)
        log_ctx.info("tactical_planner.mission_complete")

    # ------------------------------------------------------------------
    # Behaviors (legacy — used by find_engage and swarm)
    # ------------------------------------------------------------------

    async def _execute_find_engage(self, mission: MissionJSON) -> None:
        """
        Find-and-engage behavior.

        1. Navigate to target location
        2. Pause at awaiting_auth for human authorization
        3. Engage (flash red LEDs) or deny based on authorization response
        """
        log_ctx = log.bind(mission_id=mission.mission_id)
        target = mission.params.target_location
        speed = mission.params.speed

        # --- Executing: drive to target ---
        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(0, 200, 0)  # green: en route

        log_ctx.info("mission_executor.find_engage.navigating", target_x=target.x, target_y=target.y)
        await self._driver.drive_to_point(target.x, target.y, speed)

        # Send telemetry on arrival
        await self._emit_telemetry(mission.mission_id)

        # --- Awaiting authorization ---
        self._auth_event.clear()
        self._auth_approved = False

        await self._transition(
            mission.mission_id,
            MissionState.awaiting_auth,
            {"action": "engage_target", "location": {"x": target.x, "y": target.y}},
        )
        log_ctx.info("mission_executor.find_engage.awaiting_auth")

        # Wait for operator decision (no timeout by design — DAO decides)
        await self._auth_event.wait()

        # --- Process authorization decision ---
        if self._auth_approved:
            log_ctx.info("mission_executor.find_engage.approved")
            await self._transition(mission.mission_id, MissionState.executing)
            await self._driver.flash_leds(200, 0, 0, count=5, interval=0.25)  # red: engaging
            await self._transition(
                mission.mission_id,
                MissionState.complete,
                {"result": "target_engaged"},
            )
        else:
            log_ctx.info("mission_executor.find_engage.denied")
            await self._driver.set_leds(200, 200, 0)  # yellow: denied
            await self._transition(
                mission.mission_id,
                MissionState.complete,
                {"result": "engagement_denied"},
            )

    async def _drive_with_avoidance(
        self,
        target_x: float,
        target_y: float,
        speed: int,
        obstacle_event: asyncio.Event,
    ) -> None:
        """Drive toward (target_x, target_y) with obstacle avoidance.

        Uses ``drive_to_point`` for normal movement (no stop-start overhead).
        Between waypoints the ``obstacle_event`` is checked. If set, the robot
        stops, backs up, turns away, clears the event, and re-targets.
        """
        import math

        MAX_AVOIDANCE = 3
        avoidance_count = 0

        while True:
            cx, cy = self._driver.position
            dx = target_x - cx
            dy = target_y - cy
            dist = math.sqrt(dx**2 + dy**2)

            if dist < 0.1:
                break  # close enough

            # Drive toward the target in one shot (no stop-start choppiness)
            await self._driver.drive_to_point(target_x, target_y, speed)

            # After arriving (or the drive completing), check obstacle flag
            if obstacle_event.is_set() and avoidance_count < MAX_AVOIDANCE:
                avoidance_count += 1
                obstacle_event.clear()
                log.info(
                    "mission_executor.avoiding_obstacle",
                    attempt=avoidance_count,
                )

                # Back up slightly
                heading = self._driver.heading
                reverse_heading = (heading + 180) % 360
                await self._driver.drive(speed=60, heading=reverse_heading, duration_sec=0.5)

                # Turn away (alternate left/right)
                turn_offset = 60 if avoidance_count % 2 == 1 else -60
                avoidance_heading = (heading + turn_offset) % 360
                await self._driver.drive(speed=speed, heading=avoidance_heading, duration_sec=0.8)

                # Loop back to re-target the waypoint from new position
                continue

            # drive_to_point sets position to target on completion, so we're done
            break

    async def _execute_patrol_route(self, mission: MissionJSON) -> None:
        """
        Patrol-route behavior with obstacle avoidance.

        Drives to each waypoint in sequence. The vision loop detects obstacles
        and signals the drive to stop and manoeuvre around them.
        """
        log_ctx = log.bind(mission_id=mission.mission_id)
        waypoints = mission.params.waypoints
        speed = mission.params.speed

        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(0, 200, 0)  # green: patrolling

        stop_event = asyncio.Event()
        obstacle_event = asyncio.Event()
        vision_task = None
        if self._vision_engine:
            vision_task = asyncio.ensure_future(
                self._vision_loop(mission.mission_id, stop_event, obstacle_event)
            )

        try:
            for idx, wp in enumerate(waypoints):
                log_ctx.info(
                    "mission_executor.patrol_route.waypoint",
                    index=idx,
                    total=len(waypoints),
                    x=wp.x,
                    y=wp.y,
                )
                if self._vision_engine:
                    await self._drive_with_avoidance(wp.x, wp.y, speed, obstacle_event)
                else:
                    await self._driver.drive_to_point(wp.x, wp.y, speed)
                await self._emit_telemetry(mission.mission_id)
        finally:
            stop_event.set()
            if vision_task:
                vision_task.cancel()

        await self._transition(mission.mission_id, MissionState.complete)
        log_ctx.info("mission_executor.patrol_route.complete")

    async def _execute_recon_area(self, mission: MissionJSON) -> None:
        """
        Recon-area behavior with obstacle avoidance.

        Generates a boustrophedon sweep path over the specified area and drives
        each waypoint while running a concurrent vision detection loop.
        """
        from sweep.path_planner import generate_sweep_path

        log_ctx = log.bind(mission_id=mission.mission_id)
        area = mission.params.area
        speed = mission.params.speed

        waypoints = generate_sweep_path(area)

        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(0, 0, 200)  # blue: recon

        stop_event = asyncio.Event()
        obstacle_event = asyncio.Event()
        vision_task = None
        if self._vision_engine:
            vision_task = asyncio.ensure_future(
                self._vision_loop(mission.mission_id, stop_event, obstacle_event)
            )

        try:
            # Continue sweeping until a threat is detected or mission is cancelled.
            sweep_count = 0
            while not stop_event.is_set():
                sweep_count += 1
                path = waypoints if sweep_count % 2 == 1 else list(reversed(waypoints))
                log_ctx.info(
                    "mission_executor.recon_area.sweep_pass",
                    sweep=sweep_count,
                    waypoints=len(path),
                )
                for idx, wp in enumerate(path):
                    if stop_event.is_set():
                        break
                    log_ctx.info(
                        "mission_executor.recon_area.waypoint",
                        index=idx,
                        total=len(path),
                        x=wp.x,
                        y=wp.y,
                    )
                    if self._vision_engine:
                        await self._drive_with_avoidance(wp.x, wp.y, speed, obstacle_event)
                    else:
                        await self._driver.drive_to_point(wp.x, wp.y, speed)
                    await self._emit_telemetry(mission.mission_id)
        finally:
            stop_event.set()
            if vision_task:
                vision_task.cancel()
                try:
                    await vision_task
                except (asyncio.CancelledError, Exception):
                    pass

        await self._transition(mission.mission_id, MissionState.complete)
        log_ctx.info("mission_executor.recon_area.complete")

    async def _execute_visual_search(self, mission: MissionJSON) -> None:
        """
        Visual-search behavior.

        Sweeps an area using the boustrophedon path while matching each frame
        against a reference image using ORB feature matching.
        """
        from sweep.path_planner import generate_sweep_path

        log_ctx = log.bind(mission_id=mission.mission_id)
        speed = mission.params.speed

        # Decode and load reference image
        try:
            ref_bytes = base64.b64decode(mission.params.reference_image_b64)
        except Exception as exc:
            log_ctx.error("mission_executor.visual_search.invalid_reference", error=str(exc))
            await self._transition(
                mission.mission_id,
                MissionState.failed,
                {"reason": f"Invalid reference_image_b64: {exc}"},
            )
            return

        # Attempt feature matcher setup if vision engine available
        feature_matcher = None
        if self._vision_engine:
            try:
                from vision.feature_matcher import FeatureMatcher
                feature_matcher = FeatureMatcher()
                if not feature_matcher.set_reference(ref_bytes):
                    log_ctx.warning("mission_executor.visual_search.reference_load_failed")
                    feature_matcher = None
            except Exception as exc:
                log_ctx.warning("mission_executor.visual_search.feature_matcher_error", error=str(exc))
                feature_matcher = None

        # Generate sweep path (use area if provided, else default small area)
        area = mission.params.area or {"x_min": 0.0, "y_min": 0.0, "x_max": 1.0, "y_max": 1.0}
        waypoints = generate_sweep_path(area)

        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(128, 0, 128)  # purple: searching

        stop_event = asyncio.Event()
        vision_task = None
        if self._vision_engine:
            vision_task = asyncio.ensure_future(
                self._vision_loop(mission.mission_id, stop_event)
            )

        target_found = False
        try:
            for idx, wp in enumerate(waypoints):
                if target_found:
                    break
                log_ctx.info(
                    "mission_executor.visual_search.waypoint",
                    index=idx,
                    total=len(waypoints),
                    x=wp.x,
                    y=wp.y,
                )
                await self._driver.drive_to_point(wp.x, wp.y, speed)
                await self._emit_telemetry(mission.mission_id)

                # Run feature matching on current frame if matcher is available
                if feature_matcher and self._vision_engine:
                    try:
                        import numpy as np
                        import cv2
                        # Capture a frame via keyframe if possible, else skip match
                        jpeg = await self._vision_engine.get_keyframe_jpeg(
                            self._camera, 80
                        )
                        if jpeg:
                            arr = np.frombuffer(jpeg, dtype=np.uint8)
                            frame_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                            if frame_bgr is not None:
                                frame_gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
                                match_result = feature_matcher.match(frame_gray)
                                if match_result.found:
                                    target_found = True
                                    log_ctx.info("mission_executor.visual_search.target_found")
                                    if self._send_vision_fn:
                                        vision_msg = VisionMsg(
                                            robot_id=self._robot_id,
                                            mission_id=mission.mission_id,
                                            timestamp=datetime.utcnow(),
                                            target_match=match_result,
                                        )
                                        await self._send_vision_fn(vision_msg)
                    except Exception as exc:
                        log_ctx.warning("mission_executor.visual_search.match_error", error=str(exc))
        finally:
            stop_event.set()
            if vision_task:
                vision_task.cancel()
                try:
                    await vision_task
                except (asyncio.CancelledError, Exception):
                    pass

        result = "target_found" if target_found else "target_not_found"
        await self._transition(
            mission.mission_id,
            MissionState.complete,
            {"result": result},
        )
        log_ctx.info("mission_executor.visual_search.complete", result=result)

    async def _execute_overwatch(self, mission: MissionJSON) -> None:
        """
        Overwatch behavior.

        Drives to target position, orients toward threat (if face_target provided),
        holds, and continuously monitors with vision.
        Completes on duration_sec timeout or external abort.
        """
        log_ctx = log.bind(mission_id=mission.mission_id)
        target = mission.params.target_location
        speed = mission.params.speed
        duration_sec = mission.params.duration_sec

        await self._driver.drive_to_point(target.x, target.y, speed)

        # Orient toward the threat so camera faces the enemy
        face_target = getattr(mission.params, 'face_target', None)
        if face_target and isinstance(face_target, dict):
            ft_x = face_target.get('x', target.x)
            ft_y = face_target.get('y', target.y)
            log_ctx.info("mission_executor.overwatch.face_toward", x=ft_x, y=ft_y)
            await self._driver.face_toward(ft_x, ft_y)

        await self._emit_telemetry(mission.mission_id)

        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(0, 200, 200)  # cyan: overwatch

        stop_event = asyncio.Event()
        vision_task = None
        if self._vision_engine:
            vision_task = asyncio.ensure_future(
                self._vision_loop(mission.mission_id, stop_event)
            )

        try:
            if duration_sec is not None:
                await asyncio.sleep(duration_sec)
            else:
                # Hold indefinitely until cancelled
                await asyncio.Event().wait()
        finally:
            stop_event.set()
            if vision_task:
                vision_task.cancel()
                try:
                    await vision_task
                except (asyncio.CancelledError, Exception):
                    pass

        await self._transition(mission.mission_id, MissionState.complete)
        log_ctx.info("mission_executor.overwatch.complete")

    async def _execute_resupply_route(self, mission: MissionJSON) -> None:
        """
        Resupply-route behavior.

        Navigates a sequence of waypoints with obstacle-aware vision monitoring.
        Vision detections are logged/sent but do not alter the route.
        """
        log_ctx = log.bind(mission_id=mission.mission_id)
        waypoints = mission.params.waypoints
        speed = mission.params.speed

        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(0, 200, 0)  # green: navigating

        stop_event = asyncio.Event()
        vision_task = None
        if self._vision_engine:
            vision_task = asyncio.ensure_future(
                self._vision_loop(mission.mission_id, stop_event)
            )

        try:
            for idx, wp in enumerate(waypoints):
                log_ctx.info(
                    "mission_executor.resupply_route.waypoint",
                    index=idx,
                    total=len(waypoints),
                    x=wp.x,
                    y=wp.y,
                )
                await self._driver.drive_to_point(wp.x, wp.y, speed)
                await self._emit_telemetry(mission.mission_id)
        finally:
            stop_event.set()
            if vision_task:
                vision_task.cancel()
                try:
                    await vision_task
                except (asyncio.CancelledError, Exception):
                    pass

        await self._transition(mission.mission_id, MissionState.complete)
        log_ctx.info("mission_executor.resupply_route.complete")

    # ------------------------------------------------------------------
    # Swarm coordinator integration
    # ------------------------------------------------------------------

    def set_swarm(self, swarm: SwarmCoordinator) -> None:
        """Attach a swarm coordinator to this executor."""
        self._swarm = swarm

    async def _execute_swarm_mission(self, mission: MissionJSON) -> None:
        """
        Swarm-coordinated mission behaviors.

        Only executable by the swarm leader. Coordinates the swarm through
        formation setup, doctrinal movement, and vision sharing.

        Supported swarm commands:
          - swarm_patrol:  Formation patrol along waypoints
          - swarm_recon:   Formation sweep of an area with shared vision
          - swarm_advance: Doctrinal advance toward a target using movement technique
        """
        log_ctx = log.bind(mission_id=mission.mission_id, command=mission.command)

        if self._swarm is None:
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "Swarm coordinator not initialized"},
            )
            return

        if self._swarm.role != SwarmRole.leader:
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "Only the swarm leader can execute swarm missions"},
            )
            return

        # Parse swarm params from mission (uses extra fields in params)
        raw_swarm = mission.params.model_extra or {}
        formation = FormationType(raw_swarm.get("formation", "wedge"))
        spacing = raw_swarm.get("spacing_m", 1.0)
        technique = MovementTechnique(raw_swarm.get("technique", "traveling"))

        await self._transition(mission.mission_id, MissionState.executing)

        # Set formation
        await self._swarm.set_formation(formation, spacing)
        await self._driver.set_leds(200, 100, 0)  # orange: swarm leader active

        if mission.command == "swarm_patrol":
            await self._swarm_patrol(mission, technique, log_ctx)
        elif mission.command == "swarm_recon":
            await self._swarm_recon(mission, technique, log_ctx)
        elif mission.command == "swarm_advance":
            await self._swarm_advance(mission, technique, log_ctx)

        await self._transition(mission.mission_id, MissionState.complete)
        log_ctx.info("mission_executor.swarm_mission.complete")

    async def _swarm_patrol(self, mission: MissionJSON, technique: MovementTechnique, log_ctx: Any) -> None:
        """Formation patrol: swarm moves through waypoints in formation."""
        waypoints = mission.params.waypoints or []
        speed = mission.params.speed

        for idx, wp in enumerate(waypoints):
            log_ctx.info(
                "mission_executor.swarm_patrol.waypoint",
                index=idx,
                total=len(waypoints),
                x=wp.x,
                y=wp.y,
            )
            target = Position2D(x=wp.x, y=wp.y)
            await self._swarm.move_swarm(target, speed=speed, technique=technique)
            await self._emit_telemetry(mission.mission_id)

            # Share vision at each waypoint if vision engine available
            if self._vision_engine and self._camera:
                detections = await self._vision_engine.detect_once(self._camera)
                if detections:
                    det_dicts = [d.model_dump(mode="json") for d in detections]
                    await self._swarm.share_vision(det_dicts)

    async def _swarm_recon(self, mission: MissionJSON, technique: MovementTechnique, log_ctx: Any) -> None:
        """Formation recon: sweep an area with the swarm providing shared vision."""
        from sweep.path_planner import generate_sweep_path

        area = mission.params.area or {"x_min": 0.0, "y_min": 0.0, "x_max": 2.0, "y_max": 2.0}
        speed = mission.params.speed
        waypoints = generate_sweep_path(area)

        stop_event = asyncio.Event()
        vision_task = None
        if self._vision_engine:
            vision_task = asyncio.ensure_future(
                self._vision_loop(mission.mission_id, stop_event)
            )

        try:
            for idx, wp in enumerate(waypoints):
                log_ctx.info(
                    "mission_executor.swarm_recon.waypoint",
                    index=idx,
                    total=len(waypoints),
                    x=wp.x,
                    y=wp.y,
                )
                target = Position2D(x=wp.x, y=wp.y)
                await self._swarm.move_swarm(target, speed=speed, technique=technique)
                await self._emit_telemetry(mission.mission_id)

                # Share vision with swarm
                if self._vision_engine and self._camera:
                    detections = await self._vision_engine.detect_once(self._camera)
                    if detections:
                        det_dicts = [d.model_dump(mode="json") for d in detections]
                        await self._swarm.share_vision(det_dicts)
        finally:
            stop_event.set()
            if vision_task:
                vision_task.cancel()
                try:
                    await vision_task
                except (asyncio.CancelledError, Exception):
                    pass

    async def _swarm_advance(self, mission: MissionJSON, technique: MovementTechnique, log_ctx: Any) -> None:
        """Doctrinal advance: swarm advances toward target using movement technique.

        Uses bounding overwatch, traveling overwatch, or successive bounds
        to advance the formation toward the target location.
        """
        target_loc = mission.params.target_location
        if target_loc is None:
            log_ctx.warning("mission_executor.swarm_advance.no_target")
            return

        speed = mission.params.speed
        target = Position2D(x=target_loc.x, y=target_loc.y)

        log_ctx.info(
            "mission_executor.swarm_advance",
            target_x=target.x,
            target_y=target.y,
            technique=technique,
        )

        # Share vision before advance begins
        if self._vision_engine and self._camera:
            detections = await self._vision_engine.detect_once(self._camera)
            if detections:
                det_dicts = [d.model_dump(mode="json") for d in detections]
                await self._swarm.share_vision(det_dicts)

        await self._swarm.move_swarm(target, speed=speed, technique=technique)
        await self._emit_telemetry(mission.mission_id)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _transition(
        self,
        mission_id: str,
        state: MissionState,
        metadata: Optional[dict] = None,
    ) -> None:
        """Build and send a state update message."""
        self.current_state = state
        msg = StateUpdateMsg(
            robot_id=self._robot_id,
            mission_id=mission_id,
            state=state,
            timestamp=datetime.utcnow(),
            metadata=metadata or {},
        )
        await self._send_state(msg)
        log.info("mission_executor.state_transition", mission_id=mission_id, state=state)

    async def _emit_telemetry(self, mission_id: str) -> None:
        """Send a one-off telemetry snapshot (used at waypoint arrivals)."""
        x, y = self._driver.position
        msg = TelemetryMsg(
            robot_id=self._robot_id,
            position={"x": x, "y": y},
            heading=self._driver.heading,
            battery=await self._driver.get_battery_pct(),
            timestamp=datetime.utcnow(),
        )
        await self._send_telemetry(msg)
