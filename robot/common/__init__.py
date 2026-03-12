"""
robot.common — shared package for the robot agent and local discovery bridge.

Exports key classes and helpers for consistent import across both components.
"""
from robot.common.models import (
    StateUpdateMsg,
    TelemetryMsg,
    RegisterMsg,
    BridgeRegisterMsg,
    BridgeDiscoveryReportMsg,
)
from robot.common.ws_protocol import stamp, send_stamped
from robot.common.mdns import advertise_service, browse_service, ServiceResult, get_local_ip

__all__ = [
    # Models
    "StateUpdateMsg",
    "TelemetryMsg",
    "RegisterMsg",
    "BridgeRegisterMsg",
    "BridgeDiscoveryReportMsg",
    # WS protocol
    "stamp",
    "send_stamped",
    # mDNS
    "advertise_service",
    "browse_service",
    "ServiceResult",
    "get_local_ip",
]
