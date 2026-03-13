"""
Template-based local fallback for offline intent translation.

Converts natural language mission commands to MissionJSON without requiring
a cloud LLM. Uses regex pattern matching against a priority-ordered template
list. This enables offline operation when no API key or network is available.

Exports:
    template_translate: Map a natural language string to a MissionJSON or None.
"""

import re
import uuid
from datetime import datetime
from typing import Optional

from models import MissionJSON, MissionParams

# ---------------------------------------------------------------------------
# Template registry — ordered by priority (most specific first).
#
# Each entry is (compiled_regex, command_name).
# The first matching pattern wins, so more specific patterns must appear
# before broader ones.
# ---------------------------------------------------------------------------

TEMPLATES = [
    # resupply_route — check before generic "survey" to avoid false positives
    (re.compile(r"\b(resupply|deliver|supply|logistics)\b", re.I), "resupply_route"),
    # recon_area — "survey" / "recon" / "sweep area" keywords
    (re.compile(r"\b(recon|reconn|surveil|survey|sweep\s+area)\b", re.I), "recon_area"),
    # patrol_route — "patrol" / "sweep perimeter" / "circuit"
    (re.compile(r"\b(patrol|sweep\s+perimeter|circuit)\b", re.I), "patrol_route"),
    # visual_search — "find" / "search" / "locate" / "look for" / "identify"
    (re.compile(r"\b(find|search|locate|look\s+for|identify)\b", re.I), "visual_search"),
    # overwatch — "watch" / "overwatch" / "monitor" / "observe"
    (re.compile(r"\b(watch|overwatch|monitor|observe)\b", re.I), "overwatch"),
    # find_engage — "engage" / "intercept" / "neutralize"
    (re.compile(r"\b(engage|intercept|neutralize)\b", re.I), "find_engage"),
]


def template_translate(
    text: str,
    robot_id: str,
    issued_by: str,
) -> Optional[MissionJSON]:
    """Map a natural language command to a MissionJSON using regex templates.

    Returns None if the input is empty, whitespace-only, or does not match
    any known pattern.

    Args:
        text: Natural language command from the operator.
        robot_id: ID of the robot that will execute the mission.
        issued_by: Identity of the operator issuing the command.

    Returns:
        A MissionJSON with a fresh UUID mission_id and an empty MissionParams,
        or None if no template matched.
    """
    if not text or not text.strip():
        return None

    for pattern, command in TEMPLATES:
        if pattern.search(text):
            return MissionJSON(
                mission_id=str(uuid.uuid4()),
                robot_id=robot_id,
                command=command,
                params=MissionParams(),
                issued_by=issued_by,
                timestamp=datetime.utcnow(),
                auth_token="",
            )

    return None
