"""
Pre-flight mission validation against DID-declared constraints.

Validates a MissionJSON before dispatch to robot hardware:
- Command is in the supported set
- Vision commands require the 'vision' capability in the robot DID
- Speed does not exceed the authorized max_speed
- Elevated autonomy commands require sufficient autonomy_level
- issued_by field must be a valid DID format
- National caveats are honoured

Returns None if validation passes; a human-readable rejection reason string otherwise.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from models import MissionJSON

# ---------------------------------------------------------------------------
# Command registries
# ---------------------------------------------------------------------------

SUPPORTED_COMMANDS = {
    "patrol_route",
    "find_engage",
    "recon_area",
    "visual_search",
    "overwatch",
    "resupply_route",
}

# Commands that require the robot to declare 'vision' in its DID capabilities
VISION_COMMANDS = {"recon_area", "visual_search", "overwatch", "resupply_route"}

# Commands that require an elevated autonomy level (command -> minimum level required)
RESTRICTED_COMMANDS: Dict[str, int] = {
    "find_engage": 3,  # level 3+ required for lethal/engagement missions
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def validate_mission(
    mission: MissionJSON,
    robot_capabilities: List[str],
    autonomy_level: int = 1,
    max_speed: int = 255,
    national_caveats: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Validate a MissionJSON against DID-declared constraints.

    Args:
        mission: The mission assignment to validate.
        robot_capabilities: Capability strings from the robot's DID document.
        autonomy_level: The robot's authorized autonomy level (1-5).
        max_speed: Maximum authorized speed from DID or mission profile.
        national_caveats: Optional dict of national policy restrictions.

    Returns:
        None if the mission passes all checks, or a rejection reason string.
    """
    # 1. Command must be in the supported set
    if mission.command not in SUPPORTED_COMMANDS:
        return f"Unsupported command: {mission.command}"

    # 2. Vision commands require 'vision' in DID capabilities
    if mission.command in VISION_COMMANDS and "vision" not in robot_capabilities:
        return (
            f"Command {mission.command} requires vision capability not declared in DID"
        )

    # 3. Speed must not exceed authorized maximum
    if mission.params.speed > max_speed:
        return (
            f"Speed {mission.params.speed} exceeds authorized limit {max_speed}"
        )

    # 4. Restricted commands require sufficient autonomy level
    min_level = RESTRICTED_COMMANDS.get(mission.command, 1)
    if autonomy_level < min_level:
        return (
            f"Command {mission.command} requires autonomy level {min_level}, "
            f"robot has {autonomy_level}"
        )

    # 5. issued_by must be a DID-formatted identifier
    #    Full DAO proposal lookup deferred pending queryable DAO store index.
    if mission.issued_by and not mission.issued_by.startswith("did:"):
        return f"Invalid issued_by DID format: {mission.issued_by}"

    # 6. National caveat enforcement (extensible per coalition policy)
    if national_caveats:
        restricted_cmds = national_caveats.get("restricted_commands", [])
        if mission.command in restricted_cmds:
            return f"Command {mission.command} restricted by national caveat"

    return None  # all checks passed
