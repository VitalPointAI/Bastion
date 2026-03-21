"""
Room-to-map coordinate calibration for the Bastion robot.

Transforms robot positions from room-relative meters (origin at room SW corner,
x = east, y = north) to geographic lat/lng coordinates used by the COP map.

Named calibration profiles can be loaded from DEFAULT_PROFILES or from a
JSON file (calibration_profiles.json) alongside this module, allowing different
venues to be configured without code changes.
"""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from typing import Dict, Optional, Tuple

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

_PROFILES_FILE = os.path.join(os.path.dirname(__file__), "calibration_profiles.json")


@dataclass
class MapBounds:
    """Geographic bounding box for a calibrated room."""

    minLat: float
    maxLat: float
    minLng: float
    maxLng: float


@dataclass
class CalibrationProfile:
    """Maps a physical room to a geographic bounding box on the COP map."""

    name: str
    room_width: float  # meters (x dimension, east-west)
    room_height: float  # meters (y dimension, north-south)
    map_bounds: MapBounds = field(default_factory=lambda: MapBounds(0, 0, 0, 0))

    @classmethod
    def from_dict(cls, d: dict) -> "CalibrationProfile":
        bounds = d.get("map_bounds", {})
        return cls(
            name=d["name"],
            room_width=float(d["room_width"]),
            room_height=float(d["room_height"]),
            map_bounds=MapBounds(
                minLat=float(bounds.get("minLat", 0)),
                maxLat=float(bounds.get("maxLat", 0)),
                minLng=float(bounds.get("minLng", 0)),
                maxLng=float(bounds.get("maxLng", 0)),
            ),
        )

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


# ---------------------------------------------------------------------------
# Built-in profiles
# ---------------------------------------------------------------------------

# Demo location: Taipei, Taiwan (Zhongzheng District) — aligns with COP map
# Must match backend/frontend calibration: CAL_SOUTH/NORTH/WEST/EAST
_COP_SOUTH = 25.0420
_COP_NORTH = 25.0480
_COP_WEST = 121.5120
_COP_EAST = 121.5180

DEFAULT_PROFILES: Dict[str, CalibrationProfile] = {
    "default": CalibrationProfile(
        name="default",
        room_width=5.0,
        room_height=5.0,
        map_bounds=MapBounds(
            minLat=_COP_SOUTH,
            maxLat=_COP_NORTH,
            minLng=_COP_WEST,
            maxLng=_COP_EAST,
        ),
    ),
    "conference_room_a": CalibrationProfile(
        name="conference_room_a",
        room_width=8.0,
        room_height=10.0,
        map_bounds=MapBounds(
            minLat=_COP_SOUTH,
            maxLat=_COP_NORTH,
            minLng=_COP_WEST,
            maxLng=_COP_EAST,
        ),
    ),
    "lab": CalibrationProfile(
        name="lab",
        room_width=4.0,
        room_height=6.0,
        map_bounds=MapBounds(
            minLat=_COP_SOUTH,
            maxLat=_COP_NORTH,
            minLng=_COP_WEST,
            maxLng=_COP_EAST,
        ),
    ),
}

# ---------------------------------------------------------------------------
# Transform function
# ---------------------------------------------------------------------------


def room_to_map(x: float, y: float, profile: CalibrationProfile) -> Tuple[float, float]:
    """
    Transform room-relative coordinates (meters) to geographic lat/lng.

    Args:
        x: Position in meters along the room's east-west axis (0 = west wall).
        y: Position in meters along the room's north-south axis (0 = south wall).
        profile: Calibration profile describing the room and its map bounding box.

    Returns:
        (lat, lng) tuple in decimal degrees.
    """
    bounds = profile.map_bounds

    # Clamp to [0, room_width/height] to avoid out-of-bounds mapping
    x_clamped = max(0.0, min(x, profile.room_width))
    y_clamped = max(0.0, min(y, profile.room_height))

    # Linear interpolation: (0,0) → (minLng, minLat), (W,H) → (maxLng, maxLat)
    lng = bounds.minLng + (x_clamped / profile.room_width) * (bounds.maxLng - bounds.minLng)
    lat = bounds.minLat + (y_clamped / profile.room_height) * (bounds.maxLat - bounds.minLat)

    return lat, lng


# ---------------------------------------------------------------------------
# Profile persistence
# ---------------------------------------------------------------------------


def load_profile(name: str) -> CalibrationProfile:
    """
    Load a calibration profile by name.

    Checks DEFAULT_PROFILES first, then looks in calibration_profiles.json.

    Raises:
        KeyError: If the profile name is not found anywhere.
    """
    if name in DEFAULT_PROFILES:
        return DEFAULT_PROFILES[name]

    if os.path.exists(_PROFILES_FILE):
        with open(_PROFILES_FILE, "r") as f:
            saved: dict = json.load(f)
        if name in saved:
            return CalibrationProfile.from_dict(saved[name])

    raise KeyError(
        f"Calibration profile '{name}' not found. "
        f"Available built-in profiles: {list(DEFAULT_PROFILES.keys())}. "
        f"Saved profiles are stored in {_PROFILES_FILE}."
    )


def save_profile(profile: CalibrationProfile) -> None:
    """
    Save a calibration profile to calibration_profiles.json.

    Creates the file if it does not exist. Overwrites existing profile with
    the same name.
    """
    saved: dict = {}
    if os.path.exists(_PROFILES_FILE):
        with open(_PROFILES_FILE, "r") as f:
            saved = json.load(f)

    saved[profile.name] = profile.to_dict()

    with open(_PROFILES_FILE, "w") as f:
        json.dump(saved, f, indent=2)


def list_profiles() -> list[str]:
    """Return names of all available profiles (built-in + saved)."""
    names = list(DEFAULT_PROFILES.keys())
    if os.path.exists(_PROFILES_FILE):
        with open(_PROFILES_FILE, "r") as f:
            saved = json.load(f)
        for name in saved:
            if name not in names:
                names.append(name)
    return names
