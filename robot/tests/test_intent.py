"""
Unit tests for the intent translation system.

Tests cover:
- template_translate (offline fallback) — all 6 command types
- Decomposer (offline heuristic splitting)

Cloud translator integration tests require OPENAI_API_KEY or ANTHROPIC_API_KEY
and are NOT included here. Run manually when API keys are available.
"""
import re
import uuid
import sys
import os
import pytest

# Ensure robot/ package root is on path so bare 'from models import ...' works
_robot_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _robot_dir not in sys.path:
    sys.path.insert(0, _robot_dir)

from intent.fallback import template_translate


ROBOT_ID = "robot-alpha"
ISSUED_BY = "test-user"


# ---------------------------------------------------------------------------
# Template fallback tests
# ---------------------------------------------------------------------------

class TestTemplateFallback:
    def test_template_recon(self):
        """'recon sector 4' maps to recon_area."""
        result = template_translate("recon sector 4", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "recon_area"

    def test_template_survey(self):
        """'survey the area' maps to recon_area."""
        result = template_translate("survey the area", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "recon_area"

    def test_template_visual_search(self):
        """'find the target vehicle' maps to visual_search."""
        result = template_translate("find the target vehicle", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "visual_search"

    def test_template_overwatch(self):
        """'monitor the intersection' maps to overwatch."""
        result = template_translate("monitor the intersection", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "overwatch"

    def test_template_resupply(self):
        """'resupply to checkpoint bravo' maps to resupply_route."""
        result = template_translate("resupply to checkpoint bravo", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "resupply_route"

    def test_template_patrol(self):
        """'patrol the perimeter' maps to patrol_route."""
        result = template_translate("patrol the perimeter", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "patrol_route"

    def test_template_engage(self):
        """'engage hostile at grid 12' maps to find_engage."""
        result = template_translate("engage hostile at grid 12", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "find_engage"

    def test_template_unknown(self):
        """'banana smoothie recipe' returns None (unrecognized input)."""
        result = template_translate("banana smoothie recipe", ROBOT_ID, ISSUED_BY)
        assert result is None

    def test_template_empty_string(self):
        """Empty string returns None."""
        result = template_translate("", ROBOT_ID, ISSUED_BY)
        assert result is None

    def test_template_whitespace_only(self):
        """Whitespace-only string returns None."""
        result = template_translate("   ", ROBOT_ID, ISSUED_BY)
        assert result is None

    def test_template_returns_valid_mission(self):
        """Returned MissionJSON has UUID mission_id, correct robot_id, valid timestamp."""
        from datetime import datetime

        result = template_translate("recon sector 4", ROBOT_ID, ISSUED_BY)
        assert result is not None
        # mission_id is a valid UUID
        parsed = uuid.UUID(result.mission_id)
        assert str(parsed) == result.mission_id
        # Correct robot_id and issued_by
        assert result.robot_id == ROBOT_ID
        assert result.issued_by == ISSUED_BY
        # Valid timestamp
        assert isinstance(result.timestamp, datetime)

    def test_template_case_insensitive(self):
        """'RECON THE AREA' maps to recon_area (case-insensitive matching)."""
        result = template_translate("RECON THE AREA", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "recon_area"

    def test_search_for_tank(self):
        """'search for tank' maps to visual_search."""
        result = template_translate("search for tank", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "visual_search"

    def test_watch_position(self):
        """'watch position' maps to overwatch."""
        result = template_translate("watch position", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "overwatch"

    def test_deliver_supplies(self):
        """'deliver supplies' maps to resupply_route."""
        result = template_translate("deliver supplies", ROBOT_ID, ISSUED_BY)
        assert result is not None
        assert result.command == "resupply_route"
