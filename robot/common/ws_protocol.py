"""
WebSocket protocol helpers for the robot agent and local discovery bridge.

Provides message stamping (UUID v4 injection) and a convenience async send
helper that stamps and JSON-encodes in one call.

Usage:
    from robot.common.ws_protocol import stamp, send_stamped

    # Stamp a dict before sending
    msg = stamp({"type": "robot:telemetry", "robot_id": "alpha"})
    # -> {"type": "robot:telemetry", "robot_id": "alpha", "message_id": "<uuid4>"}

    # Or use the async helper directly
    await send_stamped(ws, {"type": "robot:telemetry", ...})
"""
from __future__ import annotations

import json
import uuid


def stamp(msg: dict) -> dict:
    """Inject a UUID v4 message_id into *msg* if one is not already present.

    Returns a new dict — the original is never mutated.  If 'message_id' is
    already a key in *msg* (even if its value is empty), it is left unchanged.

    Args:
        msg: Arbitrary message dict to stamp.

    Returns:
        A new dict with all original keys plus a guaranteed 'message_id'.
    """
    result = dict(msg)
    if "message_id" not in result:
        result["message_id"] = str(uuid.uuid4())
    return result


async def send_stamped(ws, msg: dict) -> None:
    """Stamp *msg* with a UUID v4 message_id and send it over *ws*.

    Handles JSON serialisation internally — callers pass plain dicts.

    Args:
        ws: Any websocket object with an async ``send(data: str)`` method.
        msg: Message dict to stamp and send.
    """
    stamped = stamp(msg)
    await ws.send(json.dumps(stamped))
