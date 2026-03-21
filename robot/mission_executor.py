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
from typing import Any, Awaitable, Callable, List, Optional

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

        # Event set when an authorization response arrives from Bastion
        self._auth_event: asyncio.Event = asyncio.Event()
        self._auth_approved: bool = False

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

        # Reject if params are missing for the command
        if mission.command == "find_engage" and mission.params.target_location is None:
            log_ctx.warning("mission_executor.missing_target_location")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "find_engage requires params.target_location"},
            )
            return

        if mission.command == "patrol_route" and not mission.params.waypoints:
            log_ctx.warning("mission_executor.missing_waypoints")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "patrol_route requires params.waypoints (non-empty list)"},
            )
            return

        if mission.command == "recon_area" and not mission.params.area:
            log_ctx.warning("mission_executor.missing_area")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "recon_area requires params.area (x_min, y_min, x_max, y_max)"},
            )
            return

        if mission.command == "visual_search" and not mission.params.reference_image_b64:
            log_ctx.warning("mission_executor.missing_reference_image")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "visual_search requires params.reference_image_b64"},
            )
            return

        if mission.command == "overwatch" and mission.params.target_location is None:
            log_ctx.warning("mission_executor.missing_target_location")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "overwatch requires params.target_location"},
            )
            return

        if mission.command == "resupply_route" and not mission.params.waypoints:
            log_ctx.warning("mission_executor.missing_waypoints")
            await self._transition(
                mission.mission_id,
                MissionState.rejected,
                {"reason": "resupply_route requires params.waypoints (non-empty list)"},
            )
            return

        # Accept the mission
        self.current_mission = mission
        self.current_state = MissionState.accepted
        await self._transition(mission.mission_id, MissionState.accepted)
        log_ctx.info("mission_executor.accepted")

        # Dispatch to behavior
        try:
            if mission.command == "find_engage":
                await self._execute_find_engage(mission)
            elif mission.command == "patrol_route":
                await self._execute_patrol_route(mission)
            elif mission.command == "recon_area":
                await self._execute_recon_area(mission)
            elif mission.command == "visual_search":
                await self._execute_visual_search(mission)
            elif mission.command == "overwatch":
                await self._execute_overwatch(mission)
            elif mission.command == "resupply_route":
                await self._execute_resupply_route(mission)
            elif mission.command in ("swarm_patrol", "swarm_recon", "swarm_advance"):
                await self._execute_swarm_mission(mission)
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

    async def abort(self) -> None:
        """Immediately stop the robot and send a failed state transition."""
        await self._driver.safe_stop()
        if self.current_mission:
            await self._transition(
                self.current_mission.mission_id,
                MissionState.failed,
                {"reason": "Mission aborted"},
            )
        log.info("mission_executor.aborted")

    # ------------------------------------------------------------------
    # Vision loop helper
    # ------------------------------------------------------------------

    async def _vision_loop(self, mission_id: str, stop_event: asyncio.Event) -> None:
        """Run detection loop at profile-determined cadence. Sends VisionMsg on detections."""
        cadence_sec = (self._vision_config.vision_cadence_ms / 1000.0) if self._vision_config else 0.5
        while not stop_event.is_set():
            try:
                detections = await self._vision_engine.detect_once(self._camera)
                if detections and self._send_vision_fn:
                    keyframe = None
                    if self._vision_config and self._vision_config.keyframe_enabled:
                        jpeg = await self._vision_engine.get_keyframe_jpeg(
                            self._camera, self._vision_config.keyframe_quality
                        )
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
                    log.info(
                        "mission_executor.vision_loop.detection",
                        mission_id=mission_id,
                        count=len(detections),
                        classes=[d.class_desc if hasattr(d, 'class_desc') else str(d) for d in detections],
                    )
            except Exception as exc:
                log.warning("mission_executor.vision_loop.error", error=str(exc))
            await asyncio.sleep(cadence_sec)

    # ------------------------------------------------------------------
    # Behaviors
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

    async def _execute_patrol_route(self, mission: MissionJSON) -> None:
        """
        Patrol-route behavior.

        Drives to each waypoint in sequence, emitting telemetry on arrival.
        """
        log_ctx = log.bind(mission_id=mission.mission_id)
        waypoints = mission.params.waypoints
        speed = mission.params.speed

        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(0, 200, 0)  # green: patrolling

        for idx, wp in enumerate(waypoints):
            log_ctx.info(
                "mission_executor.patrol_route.waypoint",
                index=idx,
                total=len(waypoints),
                x=wp.x,
                y=wp.y,
            )
            await self._driver.drive_to_point(wp.x, wp.y, speed)
            await self._emit_telemetry(mission.mission_id)

        await self._transition(mission.mission_id, MissionState.complete)
        log_ctx.info("mission_executor.patrol_route.complete")

    async def _execute_recon_area(self, mission: MissionJSON) -> None:
        """
        Recon-area behavior.

        Generates a boustrophedon sweep path over the specified area and drives
        each waypoint while running a concurrent vision detection loop.
        """
        from sweep.path_planner import generate_sweep_path

        log_ctx = log.bind(mission_id=mission.mission_id)
        area = mission.params.area
        speed = mission.params.speed

        # Set initial position from mission params if provided
        start_pos = getattr(mission.params, 'start_position', None)
        if start_pos and hasattr(self._driver, 'set_position'):
            self._driver.set_position(start_pos.get('x', 0), start_pos.get('y', 0))
            log_ctx.info("mission_executor.recon_area.start_position", x=start_pos.get('x'), y=start_pos.get('y'))

        waypoints = generate_sweep_path(area)

        await self._transition(mission.mission_id, MissionState.executing)
        await self._driver.set_leds(0, 0, 200)  # blue: recon

        stop_event = asyncio.Event()
        vision_task = None
        if self._vision_engine:
            vision_task = asyncio.ensure_future(
                self._vision_loop(mission.mission_id, stop_event)
            )

        try:
            # Continue sweeping until a threat is detected or mission is cancelled.
            # The sweep path repeats (reverse direction each pass) to maintain
            # continuous coverage of the area until the enemy is found.
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

        Drives to target position, holds, and continuously monitors with vision.
        Completes on duration_sec timeout or external abort.
        """
        log_ctx = log.bind(mission_id=mission.mission_id)
        target = mission.params.target_location
        speed = mission.params.speed
        duration_sec = mission.params.duration_sec

        await self._driver.drive_to_point(target.x, target.y, speed)
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
