"""
Tactical Mission Planner

Calls Claude to generate a tactical execution plan from high-level mission
parameters. Converts operator intent (e.g. "recce screen between grid A
and grid B") into concrete waypoints, formations, speeds, and phase
sequences that the mission executor can drive.

Uses the Anthropic API with OAuth token from ~/.claude/.credentials.json
(same credential chain as the Bastion backend), falling back to
ANTHROPIC_API_KEY env var.

When the LLM is unavailable, falls back to geometric planning
(boustrophedon sweep, direct waypoints, etc.).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog

log = structlog.get_logger(__name__)

# OAuth token pushed by the backend over WebSocket on robot registration.
# Set by mission_client.py when it receives a config:credentials message.
_pushed_oauth_token: Optional[str] = None


def _resolve_api_key() -> Optional[str]:
    """Resolve Anthropic API key using the same chain as the backend.

    0. Token pushed by backend over WebSocket (freshest — backend has mounted creds)
    1. Claude Code credential file (~/.claude/.credentials.json)
    2. ANTHROPIC_OAUTH_TOKEN env var
    3. ANTHROPIC_API_KEY env var
    """
    # 0. Token pushed by backend on robot registration (always fresh)
    if _pushed_oauth_token and _pushed_oauth_token.startswith("sk-ant-oat"):
        return _pushed_oauth_token

    # 1. Claude Code credentials — check current user home
    creds_paths = [
        Path.home() / ".claude" / ".credentials.json",
    ]
    for creds_path in creds_paths:
        try:
            if creds_path.exists():
                creds = json.loads(creds_path.read_text())
                token = creds.get("claudeAiOauth", {}).get("accessToken", "")
                if token.startswith("sk-ant-oat"):
                    return token
        except Exception:
            pass

    # 2. Env var (OAuth)
    token = os.environ.get("ANTHROPIC_OAUTH_TOKEN", "")
    if token.startswith("sk-ant-oat"):
        return token

    # 3. Env var (API key)
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if key.startswith("sk-ant-"):
        return key

    return None


TACTICAL_SYSTEM_PROMPT = """You are a tactical mission planner for an autonomous ground robot (Sphero RVR+).
You receive a mission command and parameters, and produce a concrete execution plan.

The robot operates in a room-scale environment (0-5 meters on each axis).
Coordinates are in meters: x=east, y=north. The robot has:
- Drive capability (speed 0-255, heading 0-359 degrees)
- Camera with object detection (YOLO - detects tanks, vehicles)
- LED indicators (RGB)
- Optional BLE-connected follower robots

Your output MUST be valid JSON matching this schema:
{
  "phases": [
    {
      "name": "Phase name",
      "description": "What this phase accomplishes tactically",
      "waypoints": [{"x": 1.0, "y": 1.0}],
      "speed": 80,
      "formation": "wedge|line|echelon|column|spread",
      "technique": "traveling|bounding|successive",
      "vision_mode": "continuous|periodic|off",
      "leds": {"r": 0, "g": 200, "b": 0},
      "halt_on_detection": false,
      "follower_positions": [{"robot_id": "bravo", "offset_x": -0.7, "offset_y": -0.7}]
    }
  ],
  "rules_of_engagement": "What to do on contact/detection",
  "abort_conditions": "When to abort the mission",
  "estimated_duration_sec": 120
}

Tactical principles:
- Use terrain (room boundaries) for cover/concealment
- Vary speed: faster in open, slower near objectives/threats
- Patrol routes should cover the area systematically (boustrophedon/serpentine)
- Recon missions: multiple observation points with pauses
- Overwatch: find dominant terrain (high ground / good sightlines)
- Avoid predictable patterns when in threat areas
- Position followers to provide mutual support / crossfire
- Use bounding overwatch when threat is expected

Keep waypoint count reasonable (5-15 per phase). Each phase should have a clear tactical purpose."""


async def generate_tactical_plan(
    command: str,
    params: Dict[str, Any],
    mission_id: str,
    robot_id: str = "alpha",
    available_followers: Optional[List[str]] = None,
    terrain_context: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Call Claude to generate a tactical execution plan.

    Args:
        command: Mission command (patrol_route, recon_area, find_engage, etc.)
        params: Mission parameters (waypoints, area bounds, target, etc.)
        mission_id: Mission ID for logging
        robot_id: This robot's ID
        available_followers: List of follower robot IDs available
        terrain_context: Optional terrain description for the LLM

    Returns:
        Tactical plan dict with phases, or None if LLM unavailable.
    """
    api_key = _resolve_api_key()
    if not api_key:
        log.warning("tactical_planner.no_api_key", mission_id=mission_id)
        return None

    try:
        import anthropic

        is_oauth = api_key.startswith("sk-ant-oat")

        client_kwargs: Dict[str, Any] = {}
        if is_oauth:
            client_kwargs["auth_token"] = api_key
            client_kwargs["default_headers"] = {"anthropic-beta": "oauth-2025-04-20"}
        else:
            client_kwargs["api_key"] = api_key

        client = anthropic.Anthropic(**client_kwargs)

        # Build the mission context prompt
        followers_str = ""
        if available_followers:
            followers_str = f"\nAvailable follower robots: {available_followers}"

        terrain_str = ""
        if terrain_context:
            terrain_str = f"\nTerrain context: {terrain_context}"

        user_prompt = f"""Generate a tactical execution plan for this mission:

Command: {command}
Robot ID: {robot_id}
Mission ID: {mission_id}
Parameters: {json.dumps(params, default=str)}
{followers_str}
{terrain_str}

Generate a plan with concrete waypoints (x,y in meters, 0-5 range), speeds, and phases.
Respond ONLY with the JSON plan, no markdown or explanation."""

        log.info(
            "tactical_planner.calling_llm",
            command=command,
            mission_id=mission_id,
        )

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=TACTICAL_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        # Extract text from response
        text = response.content[0].text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:])
            if text.endswith("```"):
                text = text[:-3].strip()

        # Extract JSON object — LLM may include trailing text after the closing brace
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            text = json_match.group(0)

        try:
            plan = json.loads(text)
        except json.JSONDecodeError:
            # Try fixing common LLM JSON issues: trailing commas, comments
            cleaned = re.sub(r',\s*([}\]])', r'\1', text)  # trailing commas
            cleaned = re.sub(r'//[^\n]*', '', cleaned)       # line comments
            plan = json.loads(cleaned)  # let it raise if still invalid

        log.info(
            "tactical_planner.plan_generated",
            mission_id=mission_id,
            phases=len(plan.get("phases", [])),
            estimated_sec=plan.get("estimated_duration_sec"),
        )

        return plan

    except ImportError:
        log.warning("tactical_planner.anthropic_not_installed")
        return None
    except json.JSONDecodeError as exc:
        log.error("tactical_planner.invalid_json", error=str(exc), mission_id=mission_id)
        raise RuntimeError(
            f"Tactical planner LLM returned invalid JSON (likely truncated response). "
            f"Error: {exc}"
        ) from exc
    except Exception as exc:
        error_str = str(exc)
        log.error("tactical_planner.error", error=error_str, mission_id=mission_id)
        # Auth errors should NOT silently fall back — the cron job should keep
        # the OAuth token fresh. Raise so the mission fails visibly.
        if "401" in error_str or "authentication" in error_str.lower() or "expired" in error_str.lower():
            raise RuntimeError(
                f"Tactical planner OAuth token expired — refresh credentials "
                f"(~/.claude/.credentials.json) and retry. Error: {error_str}"
            ) from exc
        return None


def fallback_plan(
    command: str,
    params: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate a geometric fallback plan when LLM is unavailable.

    Uses simple patterns: boustrophedon for area coverage, direct waypoints
    for patrol, single-point for overwatch/find_engage.
    """
    from models import Waypoint

    waypoints_raw = params.get("waypoints", [])
    area = params.get("area")
    target = params.get("target_location")
    speed = params.get("speed", 100)

    if command in ("recon_area", "visual_search") and area:
        # Boustrophedon sweep
        from sweep.path_planner import generate_sweep_path
        sweep_wps = generate_sweep_path(area, strip_width=0.3)
        return {
            "phases": [{
                "name": "Area Sweep",
                "description": f"Boustrophedon sweep of area",
                "waypoints": [{"x": w.x, "y": w.y} for w in sweep_wps],
                "speed": speed,
                "formation": "column",
                "technique": "traveling",
                "vision_mode": "continuous",
                "leds": {"r": 0, "g": 0, "b": 200},
                "halt_on_detection": command == "visual_search",
            }],
            "rules_of_engagement": "Report detections, halt on target match" if command == "visual_search" else "Report all detections",
            "abort_conditions": "Target found" if command == "visual_search" else "Area fully covered",
            "estimated_duration_sec": len(sweep_wps) * 3,
        }

    elif command == "overwatch" and target:
        return {
            "phases": [{
                "name": "Move to Overwatch",
                "description": "Navigate to observation position",
                "waypoints": [{"x": target.get("x", 2.5), "y": target.get("y", 2.5)}],
                "speed": speed,
                "formation": "column",
                "technique": "bounding",
                "vision_mode": "continuous",
                "leds": {"r": 200, "g": 200, "b": 0},
                "halt_on_detection": False,
            }],
            "rules_of_engagement": "Hold position, report all detections",
            "abort_conditions": "Duration elapsed or mission cancelled",
            "estimated_duration_sec": params.get("duration_sec", 300),
        }

    elif command == "find_engage" and target:
        return {
            "phases": [
                {
                    "name": "Approach",
                    "description": "Navigate to target area",
                    "waypoints": [{"x": target.get("x", 2.5), "y": target.get("y", 2.5)}],
                    "speed": min(speed, 100),
                    "formation": "wedge",
                    "technique": "bounding",
                    "vision_mode": "continuous",
                    "leds": {"r": 0, "g": 200, "b": 0},
                    "halt_on_detection": True,
                },
            ],
            "rules_of_engagement": "Halt on detection, request authorization for engagement",
            "abort_conditions": "Target neutralized or auth denied",
            "estimated_duration_sec": 60,
        }

    else:
        # Default: use provided waypoints or generate a simple patrol
        if waypoints_raw:
            wps = [{"x": w.get("x", w.get("x", 0)), "y": w.get("y", w.get("y", 0))}
                   for w in (waypoints_raw if isinstance(waypoints_raw, list) else [])]
        else:
            # Generate a simple square patrol
            wps = [
                {"x": 1.0, "y": 1.0}, {"x": 4.0, "y": 1.0},
                {"x": 4.0, "y": 4.0}, {"x": 1.0, "y": 4.0},
            ]
        return {
            "phases": [{
                "name": "Patrol",
                "description": "Patrol route",
                "waypoints": wps,
                "speed": speed,
                "formation": "column",
                "technique": "traveling",
                "vision_mode": "continuous",
                "leds": {"r": 0, "g": 200, "b": 0},
                "halt_on_detection": False,
            }],
            "rules_of_engagement": "Report detections",
            "abort_conditions": "Route complete",
            "estimated_duration_sec": len(wps) * 5,
        }
