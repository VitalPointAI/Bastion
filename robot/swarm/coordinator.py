"""
Swarm coordinator for multi-robot doctrinal movement.

The coordinator runs on every robot in the swarm. On the vision-equipped
leader (RVR+ with Orin Nano), it manages formation geometry, broadcasts
commands, and shares vision data. On followers, it listens for commands
and executes relative positioning.

Peer discovery uses mDNS — each robot advertises ``_bastion-robot._tcp``
and the coordinator discovers peers via the existing common.mdns module.

Communication between swarm members uses a lightweight UDP broadcast
protocol on the local network for low-latency formation updates, with
the existing WebSocket link to Bastion used for swarm telemetry aggregation.
"""
from __future__ import annotations

import asyncio
import json
import socket
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Optional

import structlog

from swarm.formations import compute_formation_slots, slots_to_world_positions
from swarm.models import (
    DismissCommand,
    FormationCommand,
    FormationSlot,
    FormationType,
    HaltCommand,
    MoveCommand,
    MovementTechnique,
    Position2D,
    ResourceType,
    SwarmAddResource,
    SwarmHeartbeat,
    SwarmJoinAck,
    SwarmJoinRequest,
    SwarmMember,
    SwarmRemoveResource,
    SwarmRole,
    SwarmState,
    SwarmTelemetry,
    SwarmVisionShare,
)

log = structlog.get_logger(__name__)

# Type alias for the callback that drives the local robot to a position
DriveToFn = Callable[[float, float, int], Awaitable[None]]
# Type alias for sending swarm telemetry to Bastion
SendSwarmTelemetryFn = Callable[[SwarmTelemetry], Awaitable[None]]

SWARM_UDP_PORT = 5807
HEARTBEAT_INTERVAL_SEC = 1.0
MEMBER_TIMEOUT_SEC = 5.0


class SwarmCoordinator:
    """
    Manages swarm membership, formation, and coordinated movement.

    Runs on both leaders and followers. The ``role`` determines behavior:
    - **leader**: Accepts join requests, computes formation geometry,
      broadcasts movement commands, shares vision detections.
    - **follower**: Listens for commands, drives to assigned formation slot.

    Args:
        robot_id: This robot's identifier.
        role: Initial role (leader if vision-equipped, else follower).
        drive_to_fn: Async callback to drive this robot to (x, y) at speed.
        send_telemetry_fn: Optional callback to send SwarmTelemetry to Bastion.
        simulate: When True, use loopback instead of real UDP broadcast.
    """

    def __init__(
        self,
        robot_id: str,
        role: SwarmRole = SwarmRole.unassigned,
        drive_to_fn: Optional[DriveToFn] = None,
        send_telemetry_fn: Optional[SendSwarmTelemetryFn] = None,
        simulate: bool = False,
    ) -> None:
        self._robot_id = robot_id
        self._role = role
        self._drive_to = drive_to_fn
        self._send_telemetry = send_telemetry_fn
        self._simulate = simulate

        # Swarm state
        self._swarm_id = f"swarm-{robot_id}"
        self._state = SwarmState.forming
        self._formation = FormationType.wedge
        self._spacing_m = 1.0
        self._heading = 0.0
        self._members: Dict[str, SwarmMember] = {}
        self._slots: List[FormationSlot] = []

        # Leader's current position (updated from driver)
        self._position = Position2D(x=0.0, y=0.0)

        # Follower state
        self._assigned_slot: Optional[int] = None
        self._leader_id: Optional[str] = None

        # BLE follower manager (set by mission_client when BLE followers are connected)
        self._ble_followers: Optional[Any] = None

        # UDP socket for peer mesh
        self._sock: Optional[socket.socket] = None
        self._recv_task: Optional[asyncio.Task] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        self._running = False

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def role(self) -> SwarmRole:
        return self._role

    @property
    def state(self) -> SwarmState:
        return self._state

    @property
    def member_count(self) -> int:
        return len(self._members) + 1  # +1 for self

    @property
    def members(self) -> Dict[str, SwarmMember]:
        return dict(self._members)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the swarm coordinator: open UDP socket, begin heartbeat."""
        if self._running:
            return

        self._running = True

        # Register self as a member
        self._members[self._robot_id] = SwarmMember(
            robot_id=self._robot_id,
            role=self._role,
            position=self._position,
            capabilities=["vision"] if self._role == SwarmRole.leader else [],
        )

        # Open UDP broadcast socket
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.setblocking(False)

        if self._simulate:
            # Bind to loopback for testing
            self._sock.bind(("127.0.0.1", SWARM_UDP_PORT))
        else:
            self._sock.bind(("", SWARM_UDP_PORT))

        loop = asyncio.get_running_loop()

        # Start receive loop
        self._recv_task = asyncio.create_task(
            self._receive_loop(loop), name="swarm-recv"
        )
        # Start heartbeat broadcast
        self._heartbeat_task = asyncio.create_task(
            self._heartbeat_loop(), name="swarm-heartbeat"
        )
        # Start stale member cleanup
        self._cleanup_task = asyncio.create_task(
            self._cleanup_loop(), name="swarm-cleanup"
        )

        log.info(
            "swarm.coordinator.started",
            robot_id=self._robot_id,
            role=self._role,
            simulate=self._simulate,
        )

    async def stop(self) -> None:
        """Stop the swarm coordinator and close UDP socket."""
        self._running = False

        for task in (self._recv_task, self._heartbeat_task, self._cleanup_task):
            if task is not None:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

        if self._sock is not None:
            self._sock.close()
            self._sock = None

        log.info("swarm.coordinator.stopped", robot_id=self._robot_id)

    # ------------------------------------------------------------------
    # Leader API
    # ------------------------------------------------------------------

    async def set_formation(
        self,
        formation: FormationType,
        spacing_m: float = 1.0,
        heading: Optional[float] = None,
    ) -> None:
        """Set the swarm formation and broadcast to all members."""
        if self._role != SwarmRole.leader:
            log.warning("swarm.set_formation.not_leader")
            return

        self._formation = formation
        self._spacing_m = spacing_m
        if heading is not None:
            self._heading = heading

        self._recompute_slots()

        cmd = FormationCommand(
            formation=formation,
            spacing_m=spacing_m,
            heading=self._heading,
            slots=self._slots,
        )
        self._broadcast(cmd.model_dump(mode="json"))
        log.info(
            "swarm.formation.set",
            formation=formation,
            members=self.member_count,
            spacing=spacing_m,
        )

    async def move_swarm(
        self,
        target: Position2D,
        speed: int = 100,
        technique: MovementTechnique = MovementTechnique.traveling,
    ) -> None:
        """
        Move the entire swarm to a target position.

        The movement technique determines how the swarm advances:
        - traveling: All move simultaneously
        - traveling_overwatch: Lead moves, trail follows at distance
        - bounding_overwatch: Alternating bounds with overwatch
        - successive_bounds: Each element bounds to predecessor's position
        """
        if self._role != SwarmRole.leader:
            log.warning("swarm.move.not_leader")
            return

        self._state = SwarmState.moving

        cmd = MoveCommand(
            target=target,
            speed=speed,
            heading=self._heading,
            technique=technique,
            formation=self._formation,
        )
        self._broadcast(cmd.model_dump(mode="json"))

        # Execute movement based on technique
        if technique == MovementTechnique.traveling:
            await self._move_traveling(target, speed)
        elif technique == MovementTechnique.traveling_overwatch:
            await self._move_traveling_overwatch(target, speed)
        elif technique == MovementTechnique.bounding_overwatch:
            await self._move_bounding_overwatch(target, speed)
        elif technique == MovementTechnique.successive_bounds:
            await self._move_successive_bounds(target, speed)

        self._state = SwarmState.holding
        await self._emit_swarm_telemetry()

    async def halt_swarm(self) -> None:
        """Halt all swarm movement."""
        self._state = SwarmState.holding
        self._broadcast(HaltCommand().model_dump(mode="json"))
        log.info("swarm.halt")

    async def dismiss_swarm(self) -> None:
        """Dissolve the swarm."""
        self._state = SwarmState.dispersing
        self._broadcast(DismissCommand().model_dump(mode="json"))
        log.info("swarm.dismissed")

    async def add_resource(self, msg: SwarmAddResource) -> None:
        """Add a resource to the swarm (DAO-driven directive from Bastion).

        Supports any ResourceType — RVR+ ground robots, drones, UGVs, sensors,
        or relay nodes. The swarm dynamically grows and recomputes formation slots.
        """
        if self._role != SwarmRole.leader:
            log.warning("swarm.add_resource.not_leader")
            return

        member = SwarmMember(
            robot_id=msg.robot_id,
            resource_type=msg.resource_type,
            role=SwarmRole.follower,
            capabilities=msg.capabilities,
            did=msg.did,
        )
        self._members[msg.robot_id] = member
        self._recompute_slots()

        # Send join ack so the new resource knows its slot
        ack = SwarmJoinAck(
            robot_id=msg.robot_id,
            accepted=True,
            assigned_role=SwarmRole.follower,
            slot_index=member.slot_index,
            leader_id=self._robot_id,
        )
        self._broadcast(ack.model_dump(mode="json"))

        # Broadcast updated formation to all members
        await self.set_formation(self._formation, self._spacing_m)

        log.info(
            "swarm.resource_added",
            robot_id=msg.robot_id,
            resource_type=msg.resource_type,
            dao_proposal=msg.dao_proposal_id,
            total_members=self.member_count,
        )

        if self.member_count >= 2:
            self._state = SwarmState.ready

        await self._emit_swarm_telemetry()

    async def remove_resource(self, msg: SwarmRemoveResource) -> None:
        """Remove a resource from the swarm (DAO-driven directive from Bastion).

        The swarm dynamically shrinks, recomputes formation slots, and
        broadcasts the updated formation to remaining members.
        """
        if self._role != SwarmRole.leader:
            log.warning("swarm.remove_resource.not_leader")
            return

        if msg.robot_id not in self._members:
            log.warning("swarm.remove_resource.not_found", robot_id=msg.robot_id)
            return

        del self._members[msg.robot_id]
        self._recompute_slots()

        # Broadcast updated formation
        await self.set_formation(self._formation, self._spacing_m)

        log.info(
            "swarm.resource_removed",
            robot_id=msg.robot_id,
            reason=msg.reason,
            dao_proposal=msg.dao_proposal_id,
            total_members=self.member_count,
        )

        await self._emit_swarm_telemetry()

    async def share_vision(
        self, detections: List[Dict[str, Any]], scene_description: Optional[str] = None
    ) -> None:
        """Broadcast vision detections from leader to all swarm members."""
        if self._role != SwarmRole.leader:
            return

        msg = SwarmVisionShare(
            leader_id=self._robot_id,
            detections=detections,
            scene_description=scene_description,
        )
        self._broadcast(msg.model_dump(mode="json"))

    def update_position(self, x: float, y: float, heading: float) -> None:
        """Update this robot's position (called from telemetry/driver)."""
        self._position = Position2D(x=x, y=y)
        self._heading = heading
        if self._robot_id in self._members:
            self._members[self._robot_id].position = self._position
            self._members[self._robot_id].heading = heading

    # ------------------------------------------------------------------
    # BLE follower integration
    # ------------------------------------------------------------------

    def set_ble_followers(self, ble_followers: Any) -> None:
        """Attach a BLEFollowerManager for direct BLE control of followers."""
        self._ble_followers = ble_followers
        log.info("swarm.ble_followers_attached", count=ble_followers.connected_count)

    async def _drive_ble_followers_to_formation(self, leader_target: Position2D, speed: int) -> None:
        """Drive BLE followers to their formation-relative positions around the leader target."""
        if not self._ble_followers or self._ble_followers.connected_count == 0:
            return

        # Compute world positions for each slot
        world_positions = slots_to_world_positions(
            self._slots, leader_target, self._heading,
        )

        # Build slot→position map for followers (skip slot 0 = leader)
        slot_targets: dict = {}
        for slot_idx, pos in world_positions:
            if slot_idx == 0:
                continue  # Leader drives itself
            slot_targets[slot_idx] = (pos.x, pos.y)

        if slot_targets:
            await self._ble_followers.drive_all_to_slots(slot_targets, speed)

    # ------------------------------------------------------------------
    # Movement techniques
    # ------------------------------------------------------------------

    async def _move_traveling(self, target: Position2D, speed: int) -> None:
        """All elements move simultaneously toward the target."""
        # Leader and BLE followers move concurrently
        tasks = []
        if self._drive_to:
            tasks.append(self._drive_to(target.x, target.y, speed))
        tasks.append(self._drive_ble_followers_to_formation(target, speed))
        await asyncio.gather(*tasks, return_exceptions=True)
        self._position = target

    async def _move_traveling_overwatch(self, target: Position2D, speed: int) -> None:
        """Lead element moves, trail follows at overwatch distance.

        Split swarm into two echelons: lead (odd slots) and trail (even slots).
        Lead moves first to half distance, trail then follows to full distance.
        """
        mid_x = (self._position.x + target.x) / 2
        mid_y = (self._position.y + target.y) / 2
        midpoint = Position2D(x=mid_x, y=mid_y)

        # Lead echelon moves to midpoint
        tasks = []
        if self._drive_to:
            tasks.append(self._drive_to(midpoint.x, midpoint.y, speed))
        tasks.append(self._drive_ble_followers_to_formation(midpoint, speed))
        await asyncio.gather(*tasks, return_exceptions=True)
        self._position = midpoint

        # Brief pause for overwatch establishment
        await asyncio.sleep(0.5)

        # Lead continues to target
        tasks = []
        if self._drive_to:
            tasks.append(self._drive_to(target.x, target.y, speed))
        tasks.append(self._drive_ble_followers_to_formation(target, speed))
        await asyncio.gather(*tasks, return_exceptions=True)
        self._position = target

    async def _move_bounding_overwatch(self, target: Position2D, speed: int) -> None:
        """Alternating bounds: one group moves while the other overwatches.

        Divides movement into bounds of ~1/3 total distance. Groups alternate:
        Group A bounds forward while Group B overwatches, then swap.
        """
        dx = target.x - self._position.x
        dy = target.y - self._position.y
        total_dist = (dx**2 + dy**2) ** 0.5

        if total_dist < 0.1:
            return

        # Number of bounds — each roughly spacing_m * 3
        bound_length = self._spacing_m * 3
        num_bounds = max(2, int(total_dist / bound_length))

        for bound in range(num_bounds):
            bound_target = Position2D(
                x=self._position.x + dx * (1.0 / num_bounds),
                y=self._position.y + dy * (1.0 / num_bounds),
            )

            # Leader bounds forward, followers follow in formation
            tasks = []
            if self._drive_to:
                tasks.append(self._drive_to(bound_target.x, bound_target.y, speed))
            tasks.append(self._drive_ble_followers_to_formation(bound_target, speed))
            await asyncio.gather(*tasks, return_exceptions=True)
            self._position = bound_target

            # Pause for overwatch
            await asyncio.sleep(0.3)

            # Update dx/dy for remaining distance
            dx = target.x - self._position.x
            dy = target.y - self._position.y

        # Final position correction
        tasks = []
        if self._drive_to:
            tasks.append(self._drive_to(target.x, target.y, speed))
        tasks.append(self._drive_ble_followers_to_formation(target, speed))
        await asyncio.gather(*tasks, return_exceptions=True)
        self._position = target

    async def _move_successive_bounds(self, target: Position2D, speed: int) -> None:
        """Each element bounds forward to the predecessor's last position.

        Leader moves to target. Each follower then moves to the position
        the element ahead of it just vacated, in slot order.
        """
        # Leader moves first
        if self._drive_to:
            await self._drive_to(target.x, target.y, speed)
        self._position = target

        # Then followers move to formation positions around new leader position
        await self._drive_ble_followers_to_formation(target, speed)

    # ------------------------------------------------------------------
    # Formation computation
    # ------------------------------------------------------------------

    def _recompute_slots(self) -> None:
        """Recompute formation slots based on current members."""
        self._slots = compute_formation_slots(
            formation=self._formation,
            member_count=self.member_count,
            spacing_m=self._spacing_m,
        )
        # Assign robots to slots
        # Slot 0 = leader
        if self._slots:
            self._slots[0].assigned_robot_id = self._robot_id

        # Assign followers to remaining slots in join order
        follower_ids = [
            rid for rid in self._members
            if rid != self._robot_id and self._members[rid].role == SwarmRole.follower
        ]
        for i, rid in enumerate(follower_ids):
            if i + 1 < len(self._slots):
                self._slots[i + 1].assigned_robot_id = rid
                self._members[rid].slot_index = i + 1

    # ------------------------------------------------------------------
    # UDP broadcast
    # ------------------------------------------------------------------

    def _broadcast(self, msg: dict) -> None:
        """Broadcast a JSON message to all swarm peers via UDP."""
        if self._sock is None:
            return

        data = json.dumps(msg).encode("utf-8")
        try:
            if self._simulate:
                self._sock.sendto(data, ("127.0.0.1", SWARM_UDP_PORT))
            else:
                self._sock.sendto(data, ("<broadcast>", SWARM_UDP_PORT))
        except OSError as exc:
            log.warning("swarm.broadcast.error", error=str(exc))

    # ------------------------------------------------------------------
    # Receive loop
    # ------------------------------------------------------------------

    async def _receive_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Receive and dispatch UDP messages from swarm peers."""
        while self._running:
            try:
                data, addr = await loop.run_in_executor(
                    None, lambda: self._sock.recvfrom(4096)
                )
                msg = json.loads(data.decode("utf-8"))
                await self._handle_message(msg, addr)
            except (asyncio.CancelledError, OSError):
                break
            except json.JSONDecodeError:
                continue
            except Exception as exc:
                log.warning("swarm.recv.error", error=str(exc))

    async def _handle_message(self, msg: dict, addr: tuple) -> None:
        """Dispatch an incoming swarm message by type."""
        msg_type = msg.get("type", "")
        sender_id = msg.get("robot_id") or msg.get("leader_id", "")

        # Ignore own messages
        if sender_id == self._robot_id:
            return

        if msg_type == "swarm:heartbeat":
            self._handle_heartbeat(msg)

        elif msg_type == "swarm:join":
            if self._role == SwarmRole.leader:
                await self._handle_join_request(msg)

        elif msg_type == "swarm:join_ack":
            if msg.get("robot_id") == self._robot_id:
                self._handle_join_ack(msg)

        elif msg_type == "swarm:formation":
            if self._role == SwarmRole.follower:
                await self._handle_formation_command(msg)

        elif msg_type == "swarm:move":
            if self._role == SwarmRole.follower:
                await self._handle_move_command(msg)

        elif msg_type == "swarm:halt":
            if self._role == SwarmRole.follower:
                log.info("swarm.follower.halt_received")
                # Follower would call safe_stop on its driver

        elif msg_type == "swarm:dismiss":
            log.info("swarm.dismissed_received")
            self._role = SwarmRole.unassigned
            self._state = SwarmState.dispersing

        elif msg_type == "swarm:vision":
            self._handle_vision_share(msg)

        elif msg_type == "swarm:add_resource":
            if self._role == SwarmRole.leader:
                await self.add_resource(SwarmAddResource.model_validate(msg))

        elif msg_type == "swarm:remove_resource":
            if self._role == SwarmRole.leader:
                await self.remove_resource(SwarmRemoveResource.model_validate(msg))

    def _handle_heartbeat(self, msg: dict) -> None:
        """Update tracked member from heartbeat."""
        rid = msg.get("robot_id", "")
        if rid and rid != self._robot_id:
            if rid in self._members:
                m = self._members[rid]
                m.position = Position2D(
                    x=msg.get("position", {}).get("x", 0.0),
                    y=msg.get("position", {}).get("y", 0.0),
                )
                m.heading = msg.get("heading", 0.0)
                m.battery_pct = msg.get("battery_pct", 100)
                m.last_seen = datetime.utcnow()
                m.connected = True
            elif self._role == SwarmRole.leader:
                # Unknown peer heartbeat — they may want to join
                pass

    async def _handle_join_request(self, msg: dict) -> None:
        """Leader handles a follower join request."""
        rid = msg.get("robot_id", "")
        if not rid:
            return

        # Accept the join
        resource_type_str = msg.get("resource_type", "rvr_plus")
        try:
            resource_type = ResourceType(resource_type_str)
        except ValueError:
            resource_type = ResourceType.rvr_plus

        member = SwarmMember(
            robot_id=rid,
            resource_type=resource_type,
            role=SwarmRole.follower,
            position=Position2D(
                x=msg.get("position", {}).get("x", 0.0),
                y=msg.get("position", {}).get("y", 0.0),
            ),
            capabilities=msg.get("capabilities", []),
            did=msg.get("did"),
        )
        self._members[rid] = member

        # Recompute slots with new member
        self._recompute_slots()
        slot_idx = member.slot_index

        # Send ack
        ack = SwarmJoinAck(
            robot_id=rid,
            accepted=True,
            assigned_role=SwarmRole.follower,
            slot_index=slot_idx,
            leader_id=self._robot_id,
        )
        self._broadcast(ack.model_dump(mode="json"))

        log.info(
            "swarm.leader.member_joined",
            robot_id=rid,
            slot=slot_idx,
            total_members=self.member_count,
        )

        # If we have at least 2 members (leader + 1 follower), swarm is ready
        if self.member_count >= 2:
            self._state = SwarmState.ready

    def _handle_join_ack(self, msg: dict) -> None:
        """Follower handles join acknowledgment from leader."""
        if msg.get("accepted"):
            self._role = SwarmRole.follower
            self._assigned_slot = msg.get("slot_index")
            self._leader_id = msg.get("leader_id", "")
            log.info(
                "swarm.follower.joined",
                leader_id=self._leader_id,
                slot=self._assigned_slot,
            )

    async def _handle_formation_command(self, msg: dict) -> None:
        """Follower handles a formation change command."""
        self._formation = FormationType(msg.get("formation", "wedge"))
        self._spacing_m = msg.get("spacing_m", 1.0)
        self._heading = msg.get("heading", 0.0)

        # Find our assigned slot
        slots = msg.get("slots", [])
        for slot_data in slots:
            if slot_data.get("assigned_robot_id") == self._robot_id:
                self._assigned_slot = slot_data.get("slot_index")
                break

        log.info(
            "swarm.follower.formation_update",
            formation=self._formation,
            slot=self._assigned_slot,
        )

    async def _handle_move_command(self, msg: dict) -> None:
        """Follower handles a move command — drive to formation-relative position."""
        if self._assigned_slot is None:
            log.warning("swarm.follower.move.no_slot")
            return

        target = Position2D(
            x=msg.get("target", {}).get("x", 0.0),
            y=msg.get("target", {}).get("y", 0.0),
        )
        speed = msg.get("speed", 100)
        heading = msg.get("heading", 0.0)
        formation = FormationType(msg.get("formation", "wedge"))
        spacing = self._spacing_m

        # Compute where our slot should be relative to the leader's target
        slots = compute_formation_slots(
            formation=formation,
            member_count=self._assigned_slot + 1,  # Need at least this many slots
            spacing_m=spacing,
        )

        # Find our slot offset
        our_slot = None
        for s in slots:
            if s.slot_index == self._assigned_slot:
                our_slot = s
                break

        if our_slot is None:
            log.warning("swarm.follower.move.slot_not_found", slot=self._assigned_slot)
            return

        # Convert slot offset to world position relative to leader's target
        world_positions = slots_to_world_positions(
            [our_slot], leader_pos=target, leader_heading=heading
        )

        if world_positions and self._drive_to:
            _, world_pos = world_positions[0]
            log.info(
                "swarm.follower.driving_to_slot",
                slot=self._assigned_slot,
                target_x=world_pos.x,
                target_y=world_pos.y,
            )
            await self._drive_to(world_pos.x, world_pos.y, speed)

    def _handle_vision_share(self, msg: dict) -> None:
        """Handle shared vision data from leader."""
        detections = msg.get("detections", [])
        scene = msg.get("scene_description")
        log.info(
            "swarm.vision_received",
            leader=msg.get("leader_id"),
            detection_count=len(detections),
            has_scene=scene is not None,
        )

    # ------------------------------------------------------------------
    # Heartbeat broadcast
    # ------------------------------------------------------------------

    async def _heartbeat_loop(self) -> None:
        """Broadcast heartbeat at regular intervals."""
        while self._running:
            try:
                hb = SwarmHeartbeat(
                    robot_id=self._robot_id,
                    role=self._role,
                    position=self._position,
                    heading=self._heading,
                    battery_pct=self._members.get(
                        self._robot_id, SwarmMember(robot_id=self._robot_id)
                    ).battery_pct,
                    slot_index=self._assigned_slot if self._role == SwarmRole.follower else 0,
                )
                self._broadcast(hb.model_dump(mode="json"))
            except Exception as exc:
                log.warning("swarm.heartbeat.error", error=str(exc))

            await asyncio.sleep(HEARTBEAT_INTERVAL_SEC)

    # ------------------------------------------------------------------
    # Stale member cleanup
    # ------------------------------------------------------------------

    async def _cleanup_loop(self) -> None:
        """Remove members that haven't sent a heartbeat recently."""
        while self._running:
            await asyncio.sleep(MEMBER_TIMEOUT_SEC)
            now = datetime.utcnow()
            stale = [
                rid for rid, m in self._members.items()
                if rid != self._robot_id
                and (now - m.last_seen).total_seconds() > MEMBER_TIMEOUT_SEC
            ]
            for rid in stale:
                self._members[rid].connected = False
                log.warning("swarm.member.stale", robot_id=rid)

    # ------------------------------------------------------------------
    # Telemetry aggregation
    # ------------------------------------------------------------------

    async def _emit_swarm_telemetry(self) -> None:
        """Send aggregated swarm telemetry to Bastion."""
        if self._send_telemetry is None or self._role != SwarmRole.leader:
            return

        # Compute center of mass
        positions = [m.position for m in self._members.values() if m.connected]
        if positions:
            cx = sum(p.x for p in positions) / len(positions)
            cy = sum(p.y for p in positions) / len(positions)
        else:
            cx, cy = self._position.x, self._position.y

        heartbeats = [
            SwarmHeartbeat(
                robot_id=m.robot_id,
                role=m.role,
                position=m.position,
                heading=m.heading,
                battery_pct=m.battery_pct,
                slot_index=m.slot_index,
            )
            for m in self._members.values()
            if m.connected
        ]

        telemetry = SwarmTelemetry(
            swarm_id=self._swarm_id,
            leader_id=self._robot_id,
            state=self._state,
            formation=self._formation,
            member_count=len(heartbeats),
            members=heartbeats,
            center_of_mass=Position2D(x=round(cx, 3), y=round(cy, 3)),
            heading=self._heading,
        )

        await self._send_telemetry(telemetry)

    # ------------------------------------------------------------------
    # Follower: request to join a swarm
    # ------------------------------------------------------------------

    async def request_join(self, capabilities: Optional[List[str]] = None) -> None:
        """Send a join request (used by followers discovering a leader)."""
        req = SwarmJoinRequest(
            robot_id=self._robot_id,
            capabilities=capabilities or [],
            position=self._position,
        )
        self._broadcast(req.model_dump(mode="json"))
        log.info("swarm.follower.join_requested")
