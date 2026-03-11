"""
Mission state machine and behavior dispatcher for the Bastion robot.

Receives a MissionJSON from the mission client and executes it on the
Sphero RVR+ driver. Reports state transitions back to Bastion via callback
functions supplied at construction time.

Supported commands:
  - find_engage  : Navigate to target, pause for human authorization, engage
  - patrol_route : Follow a sequence of waypoints
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Awaitable, Callable, Optional

import structlog

from models import MissionJSON, MissionParams, MissionState, StateUpdateMsg, TelemetryMsg
from rvr_driver import RVRDriver

log = structlog.get_logger(__name__)

# Type aliases for the callback functions injected by the mission client
SendStateFn = Callable[[StateUpdateMsg], Awaitable[None]]
SendTelemetryFn = Callable[[TelemetryMsg], Awaitable[None]]


class MissionExecutor:
    """
    Executes missions on the RVR+ and reports state transitions to Bastion.

    Args:
        driver: Initialized RVRDriver instance.
        send_state_fn: Async callback to send a StateUpdateMsg to Bastion.
        send_telemetry_fn: Async callback to send a TelemetryMsg to Bastion.
        robot_id: Robot identifier (used in telemetry messages).
    """

    def __init__(
        self,
        driver: RVRDriver,
        send_state_fn: SendStateFn,
        send_telemetry_fn: SendTelemetryFn,
        robot_id: str,
    ) -> None:
        self._driver = driver
        self._send_state = send_state_fn
        self._send_telemetry = send_telemetry_fn
        self._robot_id = robot_id

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
        supported_commands = {"find_engage", "patrol_route"}
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
            battery_pct=await self._driver.get_battery_pct(),
            timestamp=datetime.utcnow(),
        )
        await self._send_telemetry(msg)
