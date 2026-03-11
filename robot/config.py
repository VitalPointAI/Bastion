"""
Configuration loading for the Bastion robot mission client.

Reads settings from environment variables (via .env file). Raises clear errors
if required variables are missing so problems are caught at startup.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

# Load .env file from the robot/ directory (or project root fallback)
load_dotenv()


def _require(name: str) -> str:
    """Return env var value or raise a descriptive error."""
    val = os.environ.get(name)
    if not val:
        raise EnvironmentError(
            f"Required environment variable '{name}' is not set. "
            f"Copy robot/.env.example to robot/.env and fill in the values."
        )
    return val


def _optional(name: str, default: str) -> str:
    return os.environ.get(name, default)


# ---------------------------------------------------------------------------
# Required settings
# ---------------------------------------------------------------------------

BASTION_WS_URL: str = _require("BASTION_WS_URL")
"""WebSocket URL of the Bastion server, e.g. ws://192.168.1.100:3001"""

AUTH_TOKEN: str = _require("AUTH_TOKEN")
"""Shared secret token for robot authentication."""

# ---------------------------------------------------------------------------
# Optional settings (have sensible defaults)
# ---------------------------------------------------------------------------

ROBOT_ID: str = _optional("ROBOT_ID", "alpha")
"""Unique robot identifier used in all messages."""

SERIAL_PORT: str = _optional("SERIAL_PORT", "/dev/ttyTHS1")
"""Serial port for the Sphero RVR+ (Jetson UART)."""

CALIBRATION_PROFILE: str = _optional("CALIBRATION_PROFILE", "default")
"""Named calibration profile for room-to-map coordinate transform."""

SIMULATE: bool = _optional("SIMULATE", "false").lower() in ("true", "1", "yes")
"""When True, log driver actions instead of calling the real Sphero SDK."""

TELEMETRY_INTERVAL_SEC: float = float(_optional("TELEMETRY_INTERVAL_SEC", "2.0"))
"""How often (seconds) to send a telemetry heartbeat."""

RECONNECT_INITIAL_DELAY: float = float(_optional("RECONNECT_INITIAL_DELAY", "5.0"))
"""Initial reconnect delay in seconds; doubles up to RECONNECT_MAX_DELAY."""

RECONNECT_MAX_DELAY: float = float(_optional("RECONNECT_MAX_DELAY", "60.0"))
"""Maximum reconnect backoff delay in seconds."""
