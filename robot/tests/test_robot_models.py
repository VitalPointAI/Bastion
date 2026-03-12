"""Tests for robot/models.py: DID auth modes and message_id on all outbound types."""
import pytest
from robot.models import RegisterMsg, StateUpdateMsg, TelemetryMsg, MissionState


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
        msg = StateUpdateMsg(mission_id="m1", state=MissionState.executing)
        assert hasattr(msg, "message_id")

    def test_models_all_have_message_id_telemetry(self):
        msg = TelemetryMsg(
            robot_id="r1",
            position={"x": 0.0, "y": 0.0},
            heading=0.0,
            battery_pct=100,
        )
        assert hasattr(msg, "message_id")

    def test_models_all_have_message_id_register(self):
        msg = RegisterMsg(robot_id="r1")
        assert hasattr(msg, "message_id")
