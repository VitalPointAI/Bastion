"""
Tests for MissionExecutor — command acceptance/rejection for all 6 mission types.

Covers:
  - Existing commands: find_engage, patrol_route (kept for regression)
  - New commands: recon_area, visual_search, overwatch, resupply_route
  - Validation: required params → accepted; missing params → rejected
  - Vision loop helper is present and callable
"""
from __future__ import annotations

import asyncio
import sys
import types
from datetime import datetime
from typing import List, Optional
from unittest.mock import AsyncMock, MagicMock

import pytest

# ---------------------------------------------------------------------------
# Stub heavy hardware/library deps before importing robot modules
# ---------------------------------------------------------------------------

def _stub(name: str, **attrs):
    mod = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    sys.modules.setdefault(name, mod)


# structlog
if "structlog" not in sys.modules:
    sl = types.ModuleType("structlog")
    sl.get_logger = lambda name=None: MagicMock()
    sys.modules["structlog"] = sl

# cv2 (FeatureMatcher dependency)
if "cv2" not in sys.modules:
    cv2 = types.ModuleType("cv2")
    cv2.ORB_create = MagicMock(return_value=MagicMock())
    cv2.BFMatcher = MagicMock(return_value=MagicMock())
    cv2.NORM_HAMMING = 6
    cv2.imdecode = MagicMock(return_value=MagicMock())
    cv2.cvtColor = MagicMock(return_value=MagicMock())
    cv2.COLOR_BGR2GRAY = 6
    sys.modules["cv2"] = cv2

# numpy
if "numpy" not in sys.modules:
    import numpy as np  # likely available; if not, stub
    # numpy is typically available in test env

# ---------------------------------------------------------------------------
# Now import robot modules
# ---------------------------------------------------------------------------

import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Remove any stale stubs for modules that may have been injected as mocks
# by other test files (e.g. test_mission_client.py). We need the real
# MissionExecutor, swarm models, etc.
_stale_mods = [
    "mission_executor", "swarm", "swarm.models", "swarm.coordinator",
    "swarm.formations",
]
for _mod_name in _stale_mods:
    if _mod_name in sys.modules:
        _mod = sys.modules[_mod_name]
        # Remove if it's a mock or a stub without a __file__
        if isinstance(_mod, MagicMock) or not getattr(_mod, "__file__", None):
            del sys.modules[_mod_name]

from models import MissionJSON, MissionParams, MissionState, Waypoint, TargetLocation
from vision.models import VisionConfig, VisionMsg


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def make_mission(command: str, **param_overrides) -> MissionJSON:
    """Build a minimal MissionJSON for the given command."""
    params = MissionParams(**param_overrides)
    return MissionJSON(
        mission_id="test-mission-1",
        robot_id="robot-alpha",
        command=command,
        params=params,
        issued_by="test-user",
        timestamp=datetime.utcnow(),
        auth_token="test-token",
    )


class MockVisionEngine:
    """Lightweight mock — returns empty list on detect_once."""

    def __init__(self):
        self._frame_count = 0

    async def detect_once(self, camera=None):
        return []

    async def get_keyframe_jpeg(self, camera=None, quality: int = 50) -> Optional[bytes]:
        return None

    @property
    def is_mock(self) -> bool:
        return True


class MockCamera:
    pass


def make_executor(**extra_kwargs):
    """Create a MissionExecutor with a mock driver and callbacks."""
    from mission_executor import MissionExecutor

    driver = MagicMock()
    driver.position = (0.0, 0.0)
    driver.heading = 0.0
    driver.drive_to_point = AsyncMock()
    driver.set_leds = AsyncMock()
    driver.flash_leds = AsyncMock()
    driver.safe_stop = AsyncMock()
    driver.get_battery_pct = AsyncMock(return_value=80)

    send_state = AsyncMock()
    send_telemetry = AsyncMock()
    send_vision = AsyncMock()

    vision_engine = MockVisionEngine()
    vision_config = VisionConfig(vision_cadence_ms=50)

    ex = MissionExecutor(
        driver=driver,
        send_state_fn=send_state,
        send_telemetry_fn=send_telemetry,
        robot_id="robot-alpha",
        vision_engine=vision_engine,
        send_vision_fn=send_vision,
        vision_config=vision_config,
        camera=MockCamera(),
        **extra_kwargs,
    )
    return ex, send_state, send_telemetry, send_vision


def get_states(send_state_mock) -> list:
    """Extract list of MissionState values from send_state call args."""
    return [call.args[0].state for call in send_state_mock.call_args_list]


# ---------------------------------------------------------------------------
# Tests: existing commands still work (regression)
# ---------------------------------------------------------------------------


class TestExistingCommandsRegression:
    def test_unsupported_command_rejected(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("fly_away")
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.rejected in states

    def test_find_engage_accepted(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("find_engage", target_location=TargetLocation(x=1.0, y=2.0))

        async def run():
            # Schedule auth approval so execute_mission doesn't hang at auth_event.wait()
            async def approve_after_accept():
                # Wait until mission is accepted before sending auth
                while ex.current_state != MissionState.awaiting_auth:
                    await asyncio.sleep(0.01)
                await ex.handle_auth_response(True)
            asyncio.ensure_future(approve_after_accept())
            await ex.execute_mission(mission)

        asyncio.get_event_loop().run_until_complete(run())
        states = get_states(send_state)
        assert MissionState.accepted in states

    def test_find_engage_rejected_no_target(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("find_engage")  # no target_location
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.rejected in states

    def test_patrol_route_accepted(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("patrol_route", waypoints=[Waypoint(x=1.0, y=0.0)])
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.accepted in states

    def test_patrol_route_rejected_no_waypoints(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("patrol_route")  # no waypoints
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.rejected in states


# ---------------------------------------------------------------------------
# Tests: new command acceptance
# ---------------------------------------------------------------------------


class TestNewCommandAcceptance:
    def test_recon_area_accepted(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission(
            "recon_area",
            area={"x_min": 0.0, "y_min": 0.0, "x_max": 2.0, "y_max": 2.0},
        )
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.accepted in states
        assert MissionState.rejected not in states

    def test_visual_search_accepted(self):
        import base64
        ref = base64.b64encode(b"fake-image-bytes").decode()
        ex, send_state, _, _ = make_executor()
        mission = make_mission(
            "visual_search",
            reference_image_b64=ref,
            area={"x_min": 0.0, "y_min": 0.0, "x_max": 1.0, "y_max": 1.0},
        )
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.accepted in states
        assert MissionState.rejected not in states

    def test_overwatch_accepted(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission(
            "overwatch",
            target_location=TargetLocation(x=3.0, y=4.0),
            duration_sec=0.05,
        )
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.accepted in states
        assert MissionState.rejected not in states

    def test_resupply_route_accepted(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission(
            "resupply_route",
            waypoints=[Waypoint(x=1.0, y=1.0), Waypoint(x=2.0, y=2.0)],
        )
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.accepted in states
        assert MissionState.rejected not in states


# ---------------------------------------------------------------------------
# Tests: new command rejection (missing required params)
# ---------------------------------------------------------------------------


class TestNewCommandRejection:
    def test_recon_area_rejected_no_area(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("recon_area")  # no area
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.rejected in states
        assert MissionState.accepted not in states

    def test_visual_search_rejected_no_reference(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("visual_search")  # no reference_image_b64
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.rejected in states
        assert MissionState.accepted not in states

    def test_overwatch_rejected_no_target(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("overwatch")  # no target_location
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.rejected in states
        assert MissionState.accepted not in states

    def test_resupply_route_rejected_no_waypoints(self):
        ex, send_state, _, _ = make_executor()
        mission = make_mission("resupply_route")  # no waypoints
        asyncio.get_event_loop().run_until_complete(ex.execute_mission(mission))
        states = get_states(send_state)
        assert MissionState.rejected in states
        assert MissionState.accepted not in states


# ---------------------------------------------------------------------------
# Tests: MissionExecutor constructor optional vision params
# ---------------------------------------------------------------------------


class TestConstructorBackwardCompat:
    def test_constructor_no_vision_args(self):
        """MissionExecutor should work with legacy positional args only."""
        from mission_executor import MissionExecutor

        driver = MagicMock()
        driver.position = (0.0, 0.0)
        driver.heading = 0.0
        driver.drive_to_point = AsyncMock()
        driver.set_leds = AsyncMock()
        driver.flash_leds = AsyncMock()
        driver.safe_stop = AsyncMock()
        driver.get_battery_pct = AsyncMock(return_value=80)

        ex = MissionExecutor(
            driver=driver,
            send_state_fn=AsyncMock(),
            send_telemetry_fn=AsyncMock(),
            robot_id="robot-beta",
        )
        assert ex._vision_engine is None
        assert ex._send_vision_fn is None

    def test_constructor_with_vision_args(self):
        ex, _, _, _ = make_executor()
        assert ex._vision_engine is not None
        assert ex._send_vision_fn is not None
        assert ex._vision_config is not None
        assert ex._camera is not None

    def test_vision_loop_method_exists(self):
        ex, _, _, _ = make_executor()
        assert hasattr(ex, "_vision_loop")
        import inspect
        assert inspect.iscoroutinefunction(ex._vision_loop)
