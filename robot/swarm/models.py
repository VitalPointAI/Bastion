"""
Pydantic models for swarm coordination protocol.

Defines data structures for swarm roles, formations, movement techniques,
and inter-robot messaging used between the swarm leader (vision-equipped
RVR+/Orin Nano) and follower units.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ResourceType(str, Enum):
    """Type of resource in the swarm — supports heterogeneous fleets."""

    rvr_plus = "rvr_plus"      # Sphero RVR+ ground robot
    drone = "drone"            # Aerial drone (quadcopter, fixed-wing)
    ugv = "ugv"                # Other unmanned ground vehicle
    sensor = "sensor"          # Static or mobile sensor node
    relay = "relay"            # Communications relay node


class SwarmRole(str, Enum):
    """Role of a robot within the swarm."""

    leader = "leader"
    follower = "follower"
    unassigned = "unassigned"


class FormationType(str, Enum):
    """Doctrinal formation types for multi-robot movement."""

    line = "line"            # Single file, one behind another
    wedge = "wedge"          # Inverted V, leader at apex
    column = "column"        # Side-by-side columns
    echelon_left = "echelon_left"    # Staggered left of leader
    echelon_right = "echelon_right"  # Staggered right of leader
    vee = "vee"              # V-shape, leader at rear center


class MovementTechnique(str, Enum):
    """Doctrinal movement techniques for tactical advance."""

    traveling = "traveling"
    """All elements move simultaneously — fastest, least security."""

    traveling_overwatch = "traveling_overwatch"
    """Lead element moves, trail element follows at overwatch distance."""

    bounding_overwatch = "bounding_overwatch"
    """Alternating bounds: one element moves while the other overwatches."""

    successive_bounds = "successive_bounds"
    """Each element bounds forward to the previous element's position."""


class SwarmState(str, Enum):
    """Overall swarm operational state."""

    forming = "forming"        # Assembling swarm, awaiting members
    ready = "ready"            # All members registered and positioned
    moving = "moving"          # Executing a movement command
    holding = "holding"        # Stationary in formation
    dispersing = "dispersing"  # Breaking formation


# ---------------------------------------------------------------------------
# Position and geometry
# ---------------------------------------------------------------------------


class Position2D(BaseModel):
    """Room-relative position in meters."""

    x: float
    y: float


class FormationSlot(BaseModel):
    """A slot within a formation, defining offset from leader."""

    slot_index: int
    """Zero-based index (0 = leader)."""

    offset_x: float
    """Lateral offset from leader in meters (positive = right of heading)."""

    offset_y: float
    """Longitudinal offset from leader in meters (positive = forward of heading)."""

    assigned_robot_id: Optional[str] = None
    """Robot ID occupying this slot, or None if empty."""


# ---------------------------------------------------------------------------
# Swarm member tracking
# ---------------------------------------------------------------------------


class SwarmMember(BaseModel):
    """Tracked state of a single swarm member (any resource type)."""

    robot_id: str
    resource_type: ResourceType = ResourceType.rvr_plus
    role: SwarmRole = SwarmRole.unassigned
    position: Position2D = Field(default_factory=lambda: Position2D(x=0.0, y=0.0))
    heading: float = 0.0
    altitude_m: Optional[float] = None
    """Altitude in meters — used for drones, None for ground units."""
    battery_pct: int = 100
    slot_index: Optional[int] = None
    capabilities: List[str] = Field(default_factory=list)
    last_seen: datetime = Field(default_factory=datetime.utcnow)
    connected: bool = True
    did: Optional[str] = None
    """DID of the resource, if registered via Bastion identity system."""


# ---------------------------------------------------------------------------
# Swarm commands (leader → followers)
# ---------------------------------------------------------------------------


class FormationCommand(BaseModel):
    """Command from leader to set or change formation."""

    type: str = "swarm:formation"
    formation: FormationType
    spacing_m: float = Field(default=1.0, ge=0.3, le=5.0)
    """Distance between slots in meters."""
    heading: float = 0.0
    """Formation heading in degrees (0 = north)."""
    slots: List[FormationSlot] = Field(default_factory=list)


class MoveCommand(BaseModel):
    """Command from leader to move the swarm to a waypoint."""

    type: str = "swarm:move"
    target: Position2D
    speed: int = Field(default=100, ge=0, le=255)
    heading: float = 0.0
    technique: MovementTechnique = MovementTechnique.traveling
    formation: FormationType = FormationType.wedge


class HaltCommand(BaseModel):
    """Command from leader to halt all movement."""

    type: str = "swarm:halt"


class DismissCommand(BaseModel):
    """Command from leader to dissolve the swarm."""

    type: str = "swarm:dismiss"


# ---------------------------------------------------------------------------
# Swarm messages (peer-to-peer via mDNS mesh)
# ---------------------------------------------------------------------------


class SwarmHeartbeat(BaseModel):
    """Periodic heartbeat broadcast by each swarm member."""

    type: str = "swarm:heartbeat"
    robot_id: str
    role: SwarmRole
    position: Position2D
    heading: float
    battery_pct: int
    slot_index: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SwarmJoinRequest(BaseModel):
    """Sent by a resource wanting to join the swarm."""

    type: str = "swarm:join"
    robot_id: str
    resource_type: ResourceType = ResourceType.rvr_plus
    capabilities: List[str] = Field(default_factory=list)
    position: Position2D = Field(default_factory=lambda: Position2D(x=0.0, y=0.0))
    did: Optional[str] = None


class SwarmJoinAck(BaseModel):
    """Leader's response to a join request."""

    type: str = "swarm:join_ack"
    robot_id: str
    accepted: bool
    assigned_role: SwarmRole = SwarmRole.follower
    slot_index: Optional[int] = None
    leader_id: str = ""


class SwarmVisionShare(BaseModel):
    """Leader shares vision detections with the swarm."""

    type: str = "swarm:vision"
    leader_id: str
    detections: List[Dict[str, Any]] = Field(default_factory=list)
    scene_description: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Swarm mission extension
# ---------------------------------------------------------------------------


class SwarmMissionParams(BaseModel):
    """Extended mission params for swarm-coordinated missions."""

    formation: FormationType = FormationType.wedge
    spacing_m: float = 1.0
    technique: MovementTechnique = MovementTechnique.traveling
    swarm_robot_ids: List[str] = Field(default_factory=list)
    """Specific robot IDs to include in swarm. Empty = accept all discoverable."""


# ---------------------------------------------------------------------------
# DAO-driven dynamic membership (Bastion → leader via WebSocket)
# ---------------------------------------------------------------------------


class SwarmAddResource(BaseModel):
    """DAO directive to add a resource to the swarm."""

    type: str = "swarm:add_resource"
    robot_id: str
    resource_type: ResourceType = ResourceType.rvr_plus
    did: Optional[str] = None
    capabilities: List[str] = Field(default_factory=list)
    dao_proposal_id: Optional[str] = None
    """Reference to the DAO proposal that authorized this addition."""


class SwarmRemoveResource(BaseModel):
    """DAO directive to remove a resource from the swarm."""

    type: str = "swarm:remove_resource"
    robot_id: str
    reason: str = "dao_directive"
    dao_proposal_id: Optional[str] = None


class SwarmReconfigureFormation(BaseModel):
    """DAO directive to reconfigure the swarm formation."""

    type: str = "swarm:reconfigure"
    formation: FormationType
    spacing_m: float = 1.0
    technique: MovementTechnique = MovementTechnique.traveling
    dao_proposal_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Aggregate telemetry for Bastion COP
# ---------------------------------------------------------------------------


class SwarmTelemetry(BaseModel):
    """Aggregated swarm state sent from leader to Bastion."""

    type: str = "swarm:telemetry"
    swarm_id: str
    leader_id: str
    state: SwarmState
    formation: FormationType
    member_count: int
    members: List[SwarmHeartbeat] = Field(default_factory=list)
    center_of_mass: Position2D = Field(default_factory=lambda: Position2D(x=0.0, y=0.0))
    heading: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
