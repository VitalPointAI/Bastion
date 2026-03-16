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

AUTH_TOKEN: str = _optional("AUTH_TOKEN", "")
"""Shared secret token for robot authentication (optional — legacy auth mode)."""

# ---------------------------------------------------------------------------
# DID-based authentication (replaces shared AUTH_TOKEN)
# ---------------------------------------------------------------------------

REGISTRATION_TOKEN: str = _optional("REGISTRATION_TOKEN", "")
"""One-time token for first registration. Server exchanges it for a persistent DID."""

ROBOT_DID: str = _optional("ROBOT_DID", "")
"""Persisted DID from a prior registration. Used for subsequent connections."""

DID_FILE: str = _optional("DID_FILE", ".robot_did")
"""File path where the persisted DID is stored after successful registration."""

# ---------------------------------------------------------------------------
# Bridge connectivity (mDNS discovery + manual fallback)
# ---------------------------------------------------------------------------

BRIDGE_HOST: str = _optional("BRIDGE_HOST", "")
"""Manual fallback bridge IP or hostname. Used if mDNS discovery times out."""

BRIDGE_PORT: int = int(_optional("BRIDGE_PORT", "8765"))
"""Bridge relay WebSocket port (default 8765)."""

BRIDGE_WS_URL: str = _optional("BRIDGE_WS_URL", "")
"""Pre-computed bridge WebSocket URL (overrides mDNS + BRIDGE_HOST/BRIDGE_PORT)."""

MDNS_BROWSE_TIMEOUT_SEC: float = float(_optional("MDNS_BROWSE_TIMEOUT_SEC", "10.0"))
"""How long (seconds) to wait for mDNS bridge discovery before falling back."""

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

# ---------------------------------------------------------------------------
# Vision settings
# ---------------------------------------------------------------------------

VISION_ENABLED: bool = _optional("VISION_ENABLED", "true").lower() in ("true", "1", "yes")
"""When True, initialize camera and vision engine at startup."""

VISION_MODEL: str = _optional("VISION_MODEL", "yolov8n.pt")
"""YOLO model name (e.g. yolov8n.pt, yolov8s.pt, yolov8m.pt)."""

VISION_THRESHOLD: float = float(_optional("VISION_THRESHOLD", "0.5"))
"""Minimum detection confidence threshold (0.0 - 1.0)."""

CAMERA_SENSOR_ID: int = int(_optional("CAMERA_SENSOR_ID", "0"))
"""CSI camera sensor ID (0 = first camera)."""

KEYFRAME_ENABLED: bool = _optional("KEYFRAME_ENABLED", "false").lower() in ("true", "1", "yes")
"""When True, send JPEG key frames on detection events over WebSocket."""

KEYFRAME_JPEG_QUALITY: int = int(_optional("KEYFRAME_JPEG_QUALITY", "50"))
"""JPEG compression quality for key frames (0-100)."""

KEYFRAME_RESOLUTION: str = _optional("KEYFRAME_RESOLUTION", "640x480")
"""Downsampled resolution for key frames (WxH)."""

VISION_VLM_ENABLED: bool = _optional("VISION_VLM_ENABLED", "false").lower() in ("true", "1", "yes")
"""When True, enable VLM scene description (heavy — disable by default due to memory pressure)."""

VISION_CADENCE_MS: int = int(_optional("VISION_CADENCE_MS", "500"))
"""Default vision detection loop interval in milliseconds (profile can override)."""

# ---------------------------------------------------------------------------
# Intent translation settings
# ---------------------------------------------------------------------------

INTENT_LLM_ENABLED: bool = _optional("INTENT_LLM_ENABLED", "false").lower() in ("true", "1", "yes")
"""When True, use cloud LLM for intent translation. When False, template fallback only."""

OPENAI_API_KEY: str = _optional("OPENAI_API_KEY", "")
"""OpenAI API key for cloud intent translation via instructor library."""

ANTHROPIC_API_KEY: str = _optional("ANTHROPIC_API_KEY", "")
"""Anthropic API key for cloud intent translation (alternative to OpenAI)."""

# ---------------------------------------------------------------------------
# Robot authority settings (from DID document / operator config)
# ---------------------------------------------------------------------------

ROBOT_AUTONOMY_LEVEL: int = int(_optional("ROBOT_AUTONOMY_LEVEL", "1"))
"""Robot's authorized autonomy level (1-5). Default 1 (safest). Set from DID document or operator config."""

# ---------------------------------------------------------------------------
# Swarm settings
# ---------------------------------------------------------------------------

SWARM_ENABLED: bool = _optional("SWARM_ENABLED", "false").lower() in ("true", "1", "yes")
"""When True, initialize swarm coordinator at startup."""

SWARM_ROLE: str = _optional("SWARM_ROLE", "auto")
"""Swarm role: 'leader', 'follower', or 'auto' (leader if vision-equipped)."""

# BLE follower addresses — comma-separated list of BLE MAC addresses
# for RVR+ units to control as followers (only used when SWARM_ENABLED=true and role=leader)
BLE_FOLLOWERS: str = _optional("BLE_FOLLOWERS", "")
"""Comma-separated BLE MAC addresses of follower RVR+ units (e.g. 'D4:86:01:19:88:77,ED:E5:09:52:A6:33')."""


# ---------------------------------------------------------------------------
# DID persistence helpers
# ---------------------------------------------------------------------------


def load_persisted_did() -> str:
    """Read the persisted DID from DID_FILE.

    Returns an empty string if the file does not exist or is empty.
    """
    did_path = os.environ.get("DID_FILE", DID_FILE)
    try:
        with open(did_path, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    except (OSError, FileNotFoundError):
        return ""


def persist_did(did: str) -> None:
    """Write *did* to DID_FILE for use on subsequent connections.

    Args:
        did: The DID string to persist (e.g. ``"did:bastion:robot-abc"``).
    """
    did_path = os.environ.get("DID_FILE", DID_FILE)
    with open(did_path, "w", encoding="utf-8") as fh:
        fh.write(did)
