"""
Coalition Caveat Checker — Python side

Phase 48 Plan 03: Pre-flight coalition caveat enforcement for the robot agent.

This module runs on the Jetson (or any robot host) before a mission is
accepted.  It mirrors the TypeScript checkSwarmCaveat logic so that each
robot can independently validate its own national DID restrictions before
committing to a mission received from Bastion.

Usage:
    from coalition_caveat import load_coalition_profiles, check_swarm_caveat

    profiles = load_coalition_profiles()
    result = check_swarm_caveat(
        mission_type="swarm_advance",
        area_type="urban",
        swarm_members=[{"robot_id": "robot-us-01", "national_did": "did:near:resource-us-coalition"}],
        profiles=profiles,
    )
    if not result["allowed"]:
        for blocked in result["blocked_robots"]:
            print(f"Blocked: {blocked['robot_id']} — {blocked['reason']}")
"""

from __future__ import annotations

import json
import os
from typing import Optional

# ---------------------------------------------------------------------------
# Module-level profile cache (loaded once at startup)
# ---------------------------------------------------------------------------

_profile_cache: Optional[dict] = None

# Default path relative to *this* file's location:
#   robot/coalition_caveat.py  →  ../backend/data/coalition-profiles.json
_DEFAULT_PROFILES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "backend",
    "data",
    "coalition-profiles.json",
)


def load_coalition_profiles(path: str = None) -> dict:
    """
    Load and cache coalition profiles from the JSON data file.

    Parameters
    ----------
    path : str, optional
        Explicit path to coalition-profiles.json.  If omitted the module
        uses the default path relative to the project root.  Pass a path
        in tests to avoid file I/O (or pass a pre-built dict via the
        ``profiles`` argument of ``check_swarm_caveat``).

    Returns
    -------
    dict
        Mapping of profile key → profile dict with keys:
        nation, did, authority, allowed_missions, restrictions
    """
    global _profile_cache

    if _profile_cache is not None and path is None:
        return _profile_cache

    resolved = path or _DEFAULT_PROFILES_PATH
    with open(resolved, "r", encoding="utf-8") as fh:
        parsed = json.load(fh)

    if path is None:
        _profile_cache = parsed

    return parsed


# ---------------------------------------------------------------------------
# Core caveat check
# ---------------------------------------------------------------------------


def check_swarm_caveat(
    mission_type: str,
    area_type: str,
    swarm_members: list[dict],
    profiles: dict,
) -> dict:
    """
    Determine whether ALL members of a swarm are permitted for a mission.

    Mirrors the TypeScript ``checkSwarmCaveat`` function in
    ``backend/src/robot/coalition-caveat-service.ts``.

    Parameters
    ----------
    mission_type : str
        Mission command string, e.g. ``"swarm_advance"``.
    area_type : str
        Operational area classification: ``"urban"``, ``"rural"``,
        or ``"unknown"``.
    swarm_members : list[dict]
        Each element must have ``robot_id`` and ``national_did`` keys.
    profiles : dict
        Coalition profile registry.  Pass ``load_coalition_profiles()``
        in production or an inline dict in tests.

    Returns
    -------
    dict
        ``{"allowed": bool, "blocked_robots": [...]}``
        where each blocked entry has robot_id, national_did, nation, reason.
    """
    blocked_robots: list[dict] = []

    for member in swarm_members:
        block = _evaluate_member_caveat(member, mission_type, area_type, profiles)
        if block is not None:
            blocked_robots.append(block)

    return {"allowed": len(blocked_robots) == 0, "blocked_robots": blocked_robots}


def _evaluate_member_caveat(
    member: dict,
    mission_type: str,
    area_type: str,
    profiles: dict,
) -> Optional[dict]:
    """
    Evaluate a single swarm member against coalition profiles.

    Returns a block descriptor dict if the member is blocked, else None.
    """
    national_did = member.get("national_did", member.get("nationalDid", ""))
    robot_id = member.get("robot_id", member.get("robotId", ""))

    # Find the matching profile by DID
    profile = next(
        (p for p in profiles.values() if p["did"] == national_did),
        None,
    )

    if profile is None:
        return {
            "robot_id": robot_id,
            "national_did": national_did,
            "nation": "Unknown",
            "reason": f"No coalition profile found for DID {national_did}",
        }

    # 1. Check restrictions first — specific restriction reasons take precedence.
    for restriction in profile.get("restrictions", []):
        if _restriction_applies(restriction, mission_type, area_type):
            return {
                "robot_id": robot_id,
                "national_did": national_did,
                "nation": profile["nation"],
                "reason": restriction["reason"],
            }

    # 2. Fall back to allowed_missions check.
    if mission_type not in profile.get("allowed_missions", []):
        return {
            "robot_id": robot_id,
            "national_did": national_did,
            "nation": profile["nation"],
            "reason": f"{profile['nation']}: mission type '{mission_type}' not in allowed_missions",
        }

    return None  # Member is cleared


def _restriction_applies(restriction: dict, mission_type: str, area_type: str) -> bool:
    """
    Determine whether a restriction entry blocks a specific mission + area.

    Handles three cases:
    - Wildcard (mission_type == '*') with optional except list
    - Specific mission type with optional area_type constraint
    """
    restriction_mission = restriction.get("mission_type", "")
    except_list: list[str] = restriction.get("except", [])

    if restriction_mission == "*":
        # Wildcard: applies to everything except the `except` list
        if mission_type in except_list:
            return False
        # Area constraint for wildcard
        restriction_area = restriction.get("area_type")
        if restriction_area is not None and restriction_area != area_type:
            return False
        return True

    # Specific mission type
    if restriction_mission != mission_type:
        return False

    # Area constraint: only block the specified area
    restriction_area = restriction.get("area_type")
    if restriction_area is not None and restriction_area != area_type:
        return False

    return True


# ---------------------------------------------------------------------------
# Suggest alternative asset
# ---------------------------------------------------------------------------


def suggest_alternative_asset(
    blocked_robots: list[dict],
    all_members: list[dict],
    profiles: dict,
    mission_type: str,
) -> Optional[str]:
    """
    Given a set of blocked robots, suggest a replacement from the swarm
    whose national profile permits the requested mission type.

    Parameters
    ----------
    blocked_robots : list[dict]
        Robots that failed the caveat check.
    all_members : list[dict]
        All swarm members (blocked + unblocked), each with robot_id/national_did.
    profiles : dict
        Coalition profile registry.
    mission_type : str
        The mission type the blocked robots cannot perform.

    Returns
    -------
    str or None
        Robot ID of a suitable alternative, or ``None`` if none exists.
    """
    blocked_ids = {r.get("robot_id", r.get("robotId", "")) for r in blocked_robots}

    for member in all_members:
        robot_id = member.get("robot_id", member.get("robotId", ""))
        national_did = member.get("national_did", member.get("nationalDid", ""))

        if robot_id in blocked_ids:
            continue

        profile = next(
            (p for p in profiles.values() if p["did"] == national_did),
            None,
        )
        if profile is None:
            continue

        if mission_type in profile.get("allowed_missions", []):
            # Ensure no global (area-agnostic) restriction on this mission type
            global_block = next(
                (
                    r
                    for r in profile.get("restrictions", [])
                    if r.get("mission_type") == mission_type
                    and r.get("area_type") is None
                ),
                None,
            )
            if global_block is None:
                return robot_id

    return None
