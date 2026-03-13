"""
Unit tests for pre-flight mission validation.

Tests validate DID-based capability constraints, speed limits,
autonomy level enforcement, and national caveat handling.
"""
from datetime import datetime
import pytest
import sys
import os

# Add robot dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import MissionJSON, MissionParams
from pre_flight import validate_mission


def make_mission(
    command: str = "patrol_route",
    speed: int = 100,
    issued_by: str = "did:example:dao123",
) -> MissionJSON:
    """Helper to build a minimal MissionJSON for testing."""
    return MissionJSON(
        mission_id="test-mission-001",
        robot_id="robot-alpha",
        command=command,
        params=MissionParams(speed=speed),
        issued_by=issued_by,
        timestamp=datetime.utcnow(),
        auth_token="token-abc",
    )


class TestUnsupportedCommand:
    def test_unsupported_command(self):
        mission = make_mission(command="unknown_cmd")
        result = validate_mission(mission, robot_capabilities=["patrol_route"])
        assert result is not None
        assert "Unsupported command" in result
        assert "unknown_cmd" in result


class TestVisionCapability:
    def test_missing_vision_capability(self):
        """recon_area requires vision capability; patrol_route does not provide it."""
        mission = make_mission(command="recon_area")
        result = validate_mission(mission, robot_capabilities=["patrol_route"])
        assert result is not None
        assert "vision" in result.lower()

    def test_vision_command_with_capability(self):
        """recon_area passes when robot has vision capability."""
        mission = make_mission(command="recon_area")
        result = validate_mission(mission, robot_capabilities=["vision", "recon_area"])
        assert result is None

    def test_visual_search_requires_vision(self):
        """visual_search is a vision command."""
        mission = make_mission(command="visual_search")
        result = validate_mission(mission, robot_capabilities=["patrol_route"])
        assert result is not None

    def test_overwatch_requires_vision(self):
        """overwatch is a vision command."""
        mission = make_mission(command="overwatch")
        result = validate_mission(mission, robot_capabilities=[])
        assert result is not None


class TestSpeedLimits:
    def test_speed_exceeds_limit(self):
        """Mission speed 200 > max_speed 150 should be rejected."""
        mission = make_mission(command="patrol_route", speed=200)
        result = validate_mission(
            mission, robot_capabilities=["patrol_route"], max_speed=150
        )
        assert result is not None
        assert "200" in result or "speed" in result.lower()

    def test_speed_at_limit_passes(self):
        """Speed exactly at max_speed should pass."""
        mission = make_mission(command="patrol_route", speed=150)
        result = validate_mission(
            mission, robot_capabilities=["patrol_route"], max_speed=150
        )
        assert result is None

    def test_speed_below_limit_passes(self):
        """Speed below max_speed should pass."""
        mission = make_mission(command="patrol_route", speed=100)
        result = validate_mission(
            mission, robot_capabilities=["patrol_route"], max_speed=255
        )
        assert result is None


class TestValidMission:
    def test_valid_mission_passes(self):
        """A patrol_route mission with matching capabilities should pass."""
        mission = make_mission(command="patrol_route")
        result = validate_mission(mission, robot_capabilities=["patrol_route"])
        assert result is None


class TestAutonomyLevel:
    def test_find_engage_low_autonomy(self):
        """find_engage requires autonomy_level >= 3; level 1 should be rejected."""
        mission = make_mission(command="find_engage")
        result = validate_mission(
            mission, robot_capabilities=["patrol_route"], autonomy_level=1
        )
        assert result is not None
        assert "autonomy" in result.lower() or "level" in result.lower()

    def test_find_engage_sufficient_autonomy(self):
        """find_engage with autonomy_level=3 should pass capability/autonomy checks."""
        mission = make_mission(command="find_engage")
        result = validate_mission(
            mission, robot_capabilities=["patrol_route"], autonomy_level=3
        )
        assert result is None

    def test_find_engage_autonomy_level_2_rejected(self):
        """find_engage with autonomy_level=2 should still be rejected (need >= 3)."""
        mission = make_mission(command="find_engage")
        result = validate_mission(
            mission, robot_capabilities=["patrol_route"], autonomy_level=2
        )
        assert result is not None

    def test_patrol_route_any_autonomy_level(self):
        """patrol_route has no elevated autonomy requirement."""
        mission = make_mission(command="patrol_route")
        result = validate_mission(
            mission, robot_capabilities=["patrol_route"], autonomy_level=1
        )
        assert result is None


class TestIssuedByValidation:
    def test_invalid_issued_by_format(self):
        """issued_by not starting with 'did:' should be rejected."""
        mission = make_mission(issued_by="not-a-did")
        result = validate_mission(mission, robot_capabilities=["patrol_route"])
        assert result is not None
        assert "did" in result.lower() or "issued_by" in result.lower()

    def test_valid_did_issued_by(self):
        """issued_by with valid DID format should pass."""
        mission = make_mission(issued_by="did:near:dao.testnet")
        result = validate_mission(mission, robot_capabilities=["patrol_route"])
        assert result is None


class TestNationalCaveats:
    def test_national_caveat_restricts_command(self):
        """A command restricted by national caveat should be rejected."""
        mission = make_mission(command="find_engage")
        caveats = {"restricted_commands": ["find_engage"]}
        result = validate_mission(
            mission,
            robot_capabilities=["patrol_route"],
            autonomy_level=3,
            national_caveats=caveats,
        )
        assert result is not None
        assert "caveat" in result.lower() or "restricted" in result.lower()

    def test_no_national_caveats_passes(self):
        """No caveats should not block a valid mission."""
        mission = make_mission(command="patrol_route")
        result = validate_mission(
            mission,
            robot_capabilities=["patrol_route"],
            national_caveats=None,
        )
        assert result is None

    def test_empty_national_caveats_passes(self):
        """Empty caveat dict should not block a valid mission."""
        mission = make_mission(command="patrol_route")
        result = validate_mission(
            mission,
            robot_capabilities=["patrol_route"],
            national_caveats={},
        )
        assert result is None
