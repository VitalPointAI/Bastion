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


class MissionParams(BaseModel):
    """Parameters for a mission command."""

    target_location: Optional[TargetLocation] = None
    waypoints: Optional[List[Waypoint]] = None
    speed: int = Field(default=100, ge=0, le=255)
    duration_sec: Optional[float] = None
    autonomy_policy: str = "default"


class MissionJSON(BaseModel):
    """Full mission assignment from Bastion."""

    mission_id: str
    robot_id: str
    command: str
    params: MissionParams
    issued_by: str
    timestamp: datetime
    auth_token: str


class StateUpdateMsg(BaseModel):
    """State transition update sent from robot to Bastion."""

    type: str = "robot:state_update"
    mission_id: str
    state: MissionState
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TelemetryMsg(BaseModel):
    """Periodic telemetry heartbeat from robot to Bastion."""

    type: str = "robot:telemetry"
    robot_id: str
    position: Dict[str, float]  # {"x": float, "y": float} room-relative meters
    heading: float  # degrees, 0=north
    battery_pct: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RegisterMsg(BaseModel):
    """Registration message sent by robot on WS connect."""

    type: str = "robot:register"
    robot_id: str
    auth_token: str
    capabilities: List[str] = Field(default_factory=list)
