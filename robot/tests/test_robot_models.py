"""Tests for robot/models.py: DID auth modes and message_id on all outbound types."""
import pytest
from robot.models import RegisterMsg, StateUpdateMsg, TelemetryMsg, MissionState, MissionParams


class TestRegisterMsgAuthModes:
    """RegisterMsg supports token=, did=, and legacy auth_token=."""

    def test_models_register_msg_token_optional(self):
        """RegisterMsg with no auth_token, just token= for one-time registration."""
        msg = RegisterMsg(
            robot_id="r1",
            token="one-time-token-abc",
        )
        assert msg.token == "one-time-token-abc"
        assert msg.auth_token is None

    def test_models_register_msg_did_optional(self):
        """RegisterMsg with did= for subsequent connections."""
        msg = RegisterMsg(
            robot_id="r1",
            did="did:bastion:robot-abc",
        )
        assert msg.did == "did:bastion:robot-abc"
        assert msg.auth_token is None

    def test_models_register_msg_legacy_auth_token(self):
        """RegisterMsg with legacy auth_token still works."""
        msg = RegisterMsg(
            robot_id="r1",
            auth_token="shared-secret",
        )
        assert msg.auth_token == "shared-secret"

    def test_models_register_msg_all_optional_auth(self):
        """RegisterMsg can be created with no auth fields (defaults all None)."""
        msg = RegisterMsg(robot_id="r1")
        assert msg.auth_token is None
        assert msg.token is None
        assert msg.did is None

    def test_models_register_msg_token_or_did(self):
        """Both token and did can coexist (server picks priority)."""
        msg = RegisterMsg(
            robot_id="r1",
            token="otp",
            did="did:bastion:r1",
        )
        assert msg.token == "otp"
        assert msg.did == "did:bastion:r1"


class TestModelsAllHaveMessageId:
    """StateUpdateMsg, TelemetryMsg, RegisterMsg all have message_id field."""

    def test_models_all_have_message_id_state_update(self):
        msg = StateUpdateMsg(robot_id="r1", mission_id="m1", state=MissionState.executing)
        assert hasattr(msg, "message_id")

    def test_models_all_have_message_id_telemetry(self):
        msg = TelemetryMsg(
            robot_id="r1",
            position={"x": 0.0, "y": 0.0},
            heading=0.0,
            battery=100,
        )
        assert hasattr(msg, "message_id")

    def test_models_all_have_message_id_register(self):
        msg = RegisterMsg(robot_id="r1")
        assert hasattr(msg, "message_id")


class TestMissionParamsExtended:
    """MissionParams accepts new optional fields without breaking existing usage."""

    def test_mission_params_backward_compat(self):
        """MissionParams with no new fields still validates (backward compat)."""
        params = MissionParams()
        assert params.profile_name is None
        assert params.area is None
        assert params.reference_image_b64 is None

    def test_mission_params_profile_name(self):
        """MissionParams accepts profile_name for behavior profile reference."""
        params = MissionParams(profile_name="stealth_recon")
        assert params.profile_name == "stealth_recon"

    def test_mission_params_area(self):
        """MissionParams accepts area bounding box dict."""
        params = MissionParams(area={"x_min": 0.0, "y_min": 0.0, "x_max": 5.0, "y_max": 5.0})
        assert params.area == {"x_min": 0.0, "y_min": 0.0, "x_max": 5.0, "y_max": 5.0}

    def test_mission_params_reference_image(self):
        """MissionParams accepts reference_image_b64 for visual_search missions."""
        params = MissionParams(reference_image_b64="base64data")
        assert params.reference_image_b64 == "base64data"

    def test_mission_params_all_fields(self):
        """MissionParams accepts all new optional fields together."""
        params = MissionParams(
            profile_name="patrol",
            area={"x_min": 1.0, "y_min": 1.0, "x_max": 10.0, "y_max": 10.0},
            reference_image_b64="abc123==",
            speed=150,
        )
        assert params.profile_name == "patrol"
        assert params.area["x_max"] == 10.0
        assert params.reference_image_b64 == "abc123=="
        assert params.speed == 150
