"""
Shared message models for the robot agent and local discovery bridge.

Extends the base models in robot/models.py by adding an optional `message_id`
field to all outbound message types for deduplication. Also adds bridge-specific
message types (BridgeRegisterMsg, BridgeDiscoveryReportMsg).

Usage:
    from robot.common.models import StateUpdateMsg, TelemetryMsg, RegisterMsg
    from robot.common.models import BridgeRegisterMsg, BridgeDiscoveryReportMsg
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# Re-export base types from the existing robot/models.py so callers can import
# everything from robot.common without needing to know the split location.
from models import (  # noqa: F401 — intentional re-export
    MissionState,
    TargetLocation,
    Waypoint,
    MissionParams,
    MissionJSON,
)


class StateUpdateMsg(BaseModel):
    """State transition update sent from robot to Bastion.

    Extends the base StateUpdateMsg with message_id for deduplication.
    """

    type: str = "robot:state_update"
    mission_id: str
    state: MissionState
    timestamp: str = Field(default="")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    message_id: Optional[str] = None

    model_config = {"populate_by_name": True}


class TelemetryMsg(BaseModel):
    """Periodic telemetry heartbeat from robot to Bastion.

    Extends the base TelemetryMsg with message_id for deduplication.
    """

    type: str = "robot:telemetry"
    robot_id: str
    position: Dict[str, float]
    heading: float
    battery_pct: int
    timestamp: str = Field(default="")
    message_id: Optional[str] = None

    model_config = {"populate_by_name": True}


class RegisterMsg(BaseModel):
    """Registration message sent by robot on WS connect.

    Extends the base RegisterMsg with message_id for deduplication.
    """

    type: str = "robot:register"
    robot_id: str
    auth_token: str
    capabilities: List[str] = Field(default_factory=list)
    message_id: Optional[str] = None

    model_config = {"populate_by_name": True}


class BridgeRegisterMsg(BaseModel):
    """Registration message sent by bridge to Bastion cloud on first connect.

    Exchanges a one-time registration token for persistent DID + auth credentials.
    """

    type: str = "bridge:register"
    bridge_id: str
    token: Optional[str] = None
    did: Optional[str] = None
    capabilities: List[str] = Field(default_factory=list)
    message_id: Optional[str] = None

    model_config = {"populate_by_name": True}


class BridgeDiscoveryReportMsg(BaseModel):
    """Discovery scan report sent from bridge to Bastion cloud.

    Contains all devices discovered on the local LAN during a scan cycle.
    """

    type: str = "bridge:discovery_report"
    bridge_id: str
    devices: List[Dict[str, Any]] = Field(default_factory=list)
    scanned_at: str
    message_id: Optional[str] = None

    model_config = {"populate_by_name": True}
