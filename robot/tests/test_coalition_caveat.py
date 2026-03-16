"""
Wave 0 test scaffolds for coalition caveat enforcement.

These tests define the expected behavior of check_swarm_caveat(), which validates
whether a swarm mission type is permitted given the national profiles of all
member robots. Tests cover the three demo nations: Taiwan (full authority),
US (ROE restrictions on urban offensive ops), Australia (observer/recon only).

All tests are marked skip (Wave 0 scaffold) — they will pass once implementation
plans create robot/swarm/coalition_caveats.py.
"""
import pytest


# ---------------------------------------------------------------------------
# Fixtures: national caveat profiles
# ---------------------------------------------------------------------------


def _make_profiles():
    """
    Return the three national caveat profiles used in the Taiwan defense demo.

    Each profile specifies:
      - allowed_missions: list of mission type strings the nation permits
      - blocked_contexts: list of operational contexts where restrictions apply
      - authority_level: "full" | "restricted" | "observer"
    """
    return {
        "did:near:resource-taiwan-coalition": {
            "nation": "TW",
            "authority_level": "full",
            "allowed_missions": [
                "recon_area",
                "swarm_recon",
                "swarm_advance",
                "find_engage",
                "swarm_hold",
            ],
            "blocked_contexts": [],
        },
        "did:near:resource-us-coalition": {
            "nation": "US",
            "authority_level": "restricted",
            "allowed_missions": [
                "recon_area",
                "swarm_recon",
                "swarm_hold",
            ],
            "blocked_missions": ["swarm_advance", "find_engage"],
            "blocked_contexts": ["urban"],
        },
        "did:near:resource-au-coalition": {
            "nation": "AU",
            "authority_level": "observer",
            "allowed_missions": [
                "recon_area",
                "swarm_recon",
            ],
            "blocked_missions": ["swarm_advance", "find_engage", "swarm_hold"],
            "blocked_contexts": ["urban", "combat"],
        },
    }


def _make_us_member():
    return {
        "robot_id": "robot-us-01",
        "national_did": "did:near:resource-us-coalition",
        "role": "overwatch",
    }


def _make_au_member():
    return {
        "robot_id": "robot-au-01",
        "national_did": "did:near:resource-au-coalition",
        "role": "recon",
    }


def _make_tw_member():
    return {
        "robot_id": "robot-tw-01",
        "national_did": "did:near:resource-taiwan-coalition",
        "role": "point",
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.skip(reason="Wave 0 scaffold — implementation pending")
def test_us_urban_advance_blocked():
    """
    US profile has a national restriction on swarm_advance in urban contexts.

    check_swarm_caveat("swarm_advance", "urban", [us_member], profiles) must:
      - return allowed=False
      - include robot-us-01 in blocked_robots list
      - include a reason string referencing the US caveat
    """
    from robot.swarm.coalition_caveats import check_swarm_caveat

    profiles = _make_profiles()
    us_member = _make_us_member()

    result = check_swarm_caveat(
        mission_type="swarm_advance",
        context="urban",
        members=[us_member],
        profiles=profiles,
    )

    assert result["allowed"] is False, "US swarm_advance in urban must be blocked"
    assert "robot-us-01" in result["blocked_robots"], (
        "US robot must appear in blocked_robots"
    )
    assert result["reason"], "A reason string must be provided"


@pytest.mark.skip(reason="Wave 0 scaffold — implementation pending")
def test_au_recon_only():
    """
    AU observer profile allows recon_area and swarm_recon, but blocks swarm_advance.

    Two sub-checks:
      1. recon_area in any context → allowed=True, no blocked_robots
      2. swarm_advance in any context → allowed=False, robot-au-01 in blocked_robots
    """
    from robot.swarm.coalition_caveats import check_swarm_caveat

    profiles = _make_profiles()
    au_member = _make_au_member()

    # Allow: recon_area
    allow_result = check_swarm_caveat(
        mission_type="recon_area",
        context="open",
        members=[au_member],
        profiles=profiles,
    )
    assert allow_result["allowed"] is True, "AU must be allowed to execute recon_area"
    assert len(allow_result.get("blocked_robots", [])) == 0

    # Block: swarm_advance
    block_result = check_swarm_caveat(
        mission_type="swarm_advance",
        context="open",
        members=[au_member],
        profiles=profiles,
    )
    assert block_result["allowed"] is False, "AU must be blocked from swarm_advance"
    assert "robot-au-01" in block_result["blocked_robots"]


@pytest.mark.skip(reason="Wave 0 scaffold — implementation pending")
def test_tw_full_authority():
    """
    Taiwan profile has full authority — all mission types including find_engage.

    check_swarm_caveat for any mission type with only TW members must return
    allowed=True with no blocked_robots, even for find_engage in urban context.
    """
    from robot.swarm.coalition_caveats import check_swarm_caveat

    profiles = _make_profiles()
    tw_member = _make_tw_member()

    for mission_type in ["recon_area", "swarm_recon", "swarm_advance", "find_engage"]:
        result = check_swarm_caveat(
            mission_type=mission_type,
            context="urban",
            members=[tw_member],
            profiles=profiles,
        )
        assert result["allowed"] is True, (
            f"Taiwan full authority must allow {mission_type} in urban context"
        )
        assert len(result.get("blocked_robots", [])) == 0


@pytest.mark.skip(reason="Wave 0 scaffold — implementation pending")
def test_mixed_swarm_blocks_on_any_member():
    """
    A mixed swarm with TW leader + US follower executing swarm_advance in urban
    must be blocked because the US member cannot participate.

    The entire mission is blocked if ANY member's national profile prohibits it.
    The result must include:
      - allowed=False
      - robot-us-01 in blocked_robots
      - robot-tw-01 NOT in blocked_robots (TW has full authority)
      - suggested_alternative pointing to a TW-only asset or mission reassignment
    """
    from robot.swarm.coalition_caveats import check_swarm_caveat

    profiles = _make_profiles()
    tw_member = _make_tw_member()
    us_member = _make_us_member()

    result = check_swarm_caveat(
        mission_type="swarm_advance",
        context="urban",
        members=[tw_member, us_member],
        profiles=profiles,
    )

    assert result["allowed"] is False, (
        "Mixed swarm must be blocked if any member is restricted"
    )
    assert "robot-us-01" in result["blocked_robots"]
    assert "robot-tw-01" not in result["blocked_robots"], (
        "TW robot must not appear in blocked_robots (it has full authority)"
    )
    # System should suggest an alternative asset or approach
    assert "suggested_alternative" in result or "suggestion" in result, (
        "Result must include a suggested_alternative or suggestion field"
    )
