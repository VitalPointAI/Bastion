"""
Pydantic models for Bastion robot mission protocol.

Defines data structures for mission JSON, state updates, telemetry, and
registration messages exchanged between the Jetson mission client and Bastion.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class MissionState(str, Enum):
    """Mission execution states reported to Bastion."""

    accepted = "accepted"
    executing = "executing"
    awaiting_auth = "awaiting_auth"
    complete = "complete"
    failed = "failed"
    rejected = "rejected"


class TargetLocation(BaseModel):
    """Room-relative target location in meters."""

    x: float
    y: float


class Waypoint(BaseModel):
    """A single waypoint in room-relative meters."""

    x: float
    y: float


class AutonomyPolicy(BaseModel):
    """Scoping what the robot can do without human authorization."""

    autonomous_actions: List[str] = Field(default_factory=list)
    restricted_actions: List[str] = Field(default_factory=list)
    max_speed: int = Field(default=255, ge=0, le=255)
    lethal_effects_permitted: bool = False


class MissionParams(BaseModel):
    """Parameters for a mission command."""

    model_config = {"extra": "allow"}

    target_location: Optional[TargetLocation] = None
    waypoints: Optional[List[Waypoint]] = None
    speed: int = Field(default=100, ge=0, le=255)
    duration_sec: Optional[float] = None
    autonomy_policy: AutonomyPolicy = Field(default_factory=AutonomyPolicy)
    profile_name: Optional[str] = None
    """Behavior profile reference (e.g. 'stealth_recon', 'patrol'). Resolved by backend."""
    area: Optional[Dict[str, float]] = None
    """Bounding box for sweep missions: {x_min, y_min, x_max, y_max} in room-relative meters."""
    reference_image_b64: Optional[str] = None
    """Base64-encoded reference image for visual_search missions."""


class MissionJSON(BaseModel):
    """Full mission assignment from Bastion."""

    mission_id: str
    robot_id: str
    command: str
    params: MissionParams
    issued_by: str
    timestamp: datetime
    auth_token: Optional[str] = None


class StateUpdateMsg(BaseModel):
    """State transition update sent from robot to Bastion."""

    type: str = "robot:state_update"
    robot_id: str
    mission_id: str
    state: MissionState
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    message_id: Optional[str] = None


class TelemetryMsg(BaseModel):
    """Periodic telemetry heartbeat from robot to Bastion."""

    type: str = "robot:telemetry"
    robot_id: str
    position: Dict[str, float]  # {"x": float, "y": float} room-relative meters
    heading: float  # degrees, 0=north
    battery: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message_id: Optional[str] = None


class RegisterMsg(BaseModel):
    """Registration message sent by robot on WS connect.

    Supports three authentication modes:
    - Legacy: ``auth_token`` (shared secret, backward-compatible)
    - First-time: ``token`` (one-time registration token; server returns a DID)
    - Subsequent: ``did`` (persisted DID from prior registration)

    All auth fields are optional — the client populates whichever is applicable.
    """

    type: str = "robot:register"
    robot_id: str
    auth_token: Optional[str] = None
    """Legacy shared-secret auth token (backward-compatible)."""
    token: Optional[str] = None
    """One-time registration token for first-time DID acquisition."""
    did: Optional[str] = None
    """Persisted DID for subsequent connections after first registration."""
    capabilities: List[str] = Field(default_factory=list)
    message_id: Optional[str] = None
