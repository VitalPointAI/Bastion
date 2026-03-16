"""
Tests for the coalition caveat checker (Python side).

Phase 48 Plan 03: Validates that check_swarm_caveat correctly enforces
national DID caveats for Taiwan, US, and Australia profiles.

All tests use inline profile dicts — no file I/O.
"""
import sys
import os

# Ensure robot/ root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from coalition_caveat import check_swarm_caveat, suggest_alternative_asset


# ---------------------------------------------------------------------------
# Inline test profiles (mirrors coalition-profiles.json)
# ---------------------------------------------------------------------------

TEST_PROFILES = {
    "tw-defense": {
        "nation": "Taiwan",
        "did": "did:near:resource-tw-coalition",
        "authority": "full",
        "allowed_missions": ["recon_area", "swarm_recon", "swarm_advance", "find_engage", "swarm_patrol"],
        "restrictions": [],
    },
    "us-coalition": {
        "nation": "United States",
        "did": "did:near:resource-us-coalition",
        "authority": "restricted",
        "allowed_missions": ["recon_area", "swarm_recon", "swarm_patrol", "swarm_advance"],
        "restrictions": [
            {
                "mission_type": "swarm_advance",
                "area_type": "urban",
                "reason": "US national policy: no offensive urban ops",
            },
            {
                "mission_type": "find_engage",
                "reason": "US ROE: engagement requires host-nation lead",
            },
        ],
    },
    "au-observer": {
        "nation": "Australia",
        "did": "did:near:resource-au-coalition",
        "authority": "observer",
        "allowed_missions": ["recon_area", "swarm_recon"],
        "restrictions": [
            {
                "mission_type": "*",
                "except": ["recon_area", "swarm_recon"],
                "reason": "Australia observer status: recon only",
            },
        ],
    },
}

# ─── Member helpers ───────────────────────────────────────────────────────────

TW_MEMBER = {"robot_id": "robot-tw-01", "national_did": "did:near:resource-tw-coalition"}
US_MEMBER = {"robot_id": "robot-us-01", "national_did": "did:near:resource-us-coalition"}
AU_MEMBER = {"robot_id": "robot-au-01", "national_did": "did:near:resource-au-coalition"}


# ---------------------------------------------------------------------------
# Test: us_urban_blocked
# ---------------------------------------------------------------------------


def test_us_urban_advance_blocked():
    """US robot cannot perform swarm_advance in urban area."""
    result = check_swarm_caveat("swarm_advance", "urban", [US_MEMBER], TEST_PROFILES)
    assert result["allowed"] is False
    assert len(result["blocked_robots"]) == 1
    blocked = result["blocked_robots"][0]
    assert blocked["robot_id"] == "robot-us-01"
    assert blocked["nation"] == "United States"
    assert blocked["reason"] == "US national policy: no offensive urban ops"


def test_us_find_engage_blocked_globally():
    """US find_engage is blocked globally (no area_type constraint)."""
    result = check_swarm_caveat("find_engage", "rural", [US_MEMBER], TEST_PROFILES)
    assert result["allowed"] is False
    assert result["blocked_robots"][0]["reason"] == "US ROE: engagement requires host-nation lead"


def test_us_swarm_advance_rural_allowed():
    """US swarm_advance restriction only applies to urban — rural is permitted."""
    result = check_swarm_caveat("swarm_advance", "rural", [US_MEMBER], TEST_PROFILES)
    assert result["allowed"] is True
    assert result["blocked_robots"] == []


# ---------------------------------------------------------------------------
# Test: au_recon_only
# ---------------------------------------------------------------------------


def test_au_recon_only_swarm_recon_passes():
    """Australia observer status allows swarm_recon in any area."""
    result = check_swarm_caveat("swarm_recon", "urban", [AU_MEMBER], TEST_PROFILES)
    assert result["allowed"] is True
    assert result["blocked_robots"] == []


def test_au_recon_only_recon_area_passes():
    """Australia observer status allows recon_area."""
    result = check_swarm_caveat("recon_area", "rural", [AU_MEMBER], TEST_PROFILES)
    assert result["allowed"] is True


def test_au_find_engage_blocked():
    """Australia is blocked from find_engage (observer status: recon only)."""
    result = check_swarm_caveat("find_engage", "rural", [AU_MEMBER], TEST_PROFILES)
    assert result["allowed"] is False
    blocked = result["blocked_robots"][0]
    assert blocked["robot_id"] == "robot-au-01"
    assert blocked["nation"] == "Australia"
    assert "recon only" in blocked["reason"]


def test_au_swarm_advance_blocked():
    """Australia is blocked from swarm_advance (not a recon mission)."""
    result = check_swarm_caveat("swarm_advance", "rural", [AU_MEMBER], TEST_PROFILES)
    assert result["allowed"] is False


# ---------------------------------------------------------------------------
# Test: tw_full_authority
# ---------------------------------------------------------------------------


def test_tw_full_authority_all_missions():
    """Taiwan full authority: all mission types pass in any area."""
    for mission in ["recon_area", "swarm_recon", "swarm_advance", "find_engage", "swarm_patrol"]:
        result = check_swarm_caveat(mission, "urban", [TW_MEMBER], TEST_PROFILES)
        assert result["allowed"] is True, f"Taiwan must allow {mission} in urban"
        assert result["blocked_robots"] == []


# ---------------------------------------------------------------------------
# Test: mixed_swarm_blocks
# ---------------------------------------------------------------------------


def test_mixed_swarm_blocks_on_any_member():
    """A single blocked member blocks the entire swarm mission."""
    result = check_swarm_caveat(
        "swarm_advance",
        "urban",
        [TW_MEMBER, US_MEMBER],
        TEST_PROFILES,
    )
    assert result["allowed"] is False
    assert len(result["blocked_robots"]) == 1
    assert result["blocked_robots"][0]["robot_id"] == "robot-us-01"


def test_tw_and_au_mixed_advance_au_blocked():
    """TW is allowed; AU is blocked from swarm_advance."""
    result = check_swarm_caveat(
        "swarm_advance",
        "rural",
        [TW_MEMBER, AU_MEMBER],
        TEST_PROFILES,
    )
    assert result["allowed"] is False
    assert result["blocked_robots"][0]["robot_id"] == "robot-au-01"


def test_all_three_recon_all_pass():
    """All three nations can perform swarm_recon — recon is universally permitted."""
    result = check_swarm_caveat(
        "swarm_recon",
        "urban",
        [TW_MEMBER, US_MEMBER, AU_MEMBER],
        TEST_PROFILES,
    )
    assert result["allowed"] is True
    assert result["blocked_robots"] == []


# ---------------------------------------------------------------------------
# Test: suggest_alternative_asset
# ---------------------------------------------------------------------------


def test_suggests_tw_when_us_blocked():
    """When US is blocked, suggest Taiwan robot as alternative."""
    blocked = [
        {
            "robot_id": "robot-us-01",
            "national_did": "did:near:resource-us-coalition",
            "nation": "United States",
            "reason": "US national policy: no offensive urban ops",
        }
    ]
    suggestion = suggest_alternative_asset(
        blocked, [TW_MEMBER, US_MEMBER], TEST_PROFILES, "swarm_advance"
    )
    assert suggestion == "robot-tw-01"


def test_returns_none_when_no_alternative():
    """Returns None when no swarm member can satisfy the mission."""
    blocked = [
        {
            "robot_id": "robot-au-01",
            "national_did": "did:near:resource-au-coalition",
            "nation": "Australia",
            "reason": "Australia observer status: recon only",
        }
    ]
    suggestion = suggest_alternative_asset(
        blocked, [AU_MEMBER], TEST_PROFILES, "find_engage"
    )
    assert suggestion is None
