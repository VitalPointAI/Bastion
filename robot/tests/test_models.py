"""Tests for shared message models in robot.common.models."""
import pytest
from robot.common.models import (
    StateUpdateMsg,
    TelemetryMsg,
    RegisterMsg,
    BridgeRegisterMsg,
    BridgeDiscoveryReportMsg,
)
from robot.models import MissionState


class TestModelsHaveMessageId:
    """All outbound message types must accept optional message_id field."""

    def test_state_update_msg_has_message_id(self):
        msg = StateUpdateMsg(
            robot_id="r1",
            mission_id="m1",
            state=MissionState.executing,
            message_id=None,
        )
        assert hasattr(msg, "message_id")
        assert msg.message_id is None

    def test_state_update_msg_accepts_message_id(self):
        msg = StateUpdateMsg(
            robot_id="r1",
            mission_id="m1",
            state=MissionState.executing,
            message_id="test-id-123",
        )
        assert msg.message_id == "test-id-123"

    def test_telemetry_msg_has_message_id(self):
        msg = TelemetryMsg(
            robot_id="r1",
            position={"x": 1.0, "y": 2.0},
            heading=90.0,
            battery=80,
            message_id=None,
        )
        assert hasattr(msg, "message_id")
        assert msg.message_id is None

    def test_telemetry_msg_accepts_message_id(self):
        msg = TelemetryMsg(
            robot_id="r1",
            position={"x": 1.0, "y": 2.0},
            heading=90.0,
            battery=80,
            message_id="uuid-xyz",
        )
        assert msg.message_id == "uuid-xyz"

    def test_register_msg_has_message_id(self):
        msg = RegisterMsg(
            robot_id="r1",
            auth_token="tok",
            message_id=None,
        )
        assert hasattr(msg, "message_id")
        assert msg.message_id is None

    def test_register_msg_accepts_message_id(self):
        msg = RegisterMsg(
            robot_id="r1",
            auth_token="tok",
            message_id="uuid-abc",
        )
        assert msg.message_id == "uuid-abc"

    def test_bridge_register_msg_fields(self):
        msg = BridgeRegisterMsg(
            bridge_id="b1",
            token="t1",
            did=None,
            capabilities=["scan", "relay"],
        )
        assert msg.type == "bridge:register"
        assert msg.bridge_id == "b1"
        assert msg.token == "t1"
        assert msg.did is None
        assert "scan" in msg.capabilities
        assert hasattr(msg, "message_id")

    def test_bridge_discovery_report_msg_fields(self):
        msg = BridgeDiscoveryReportMsg(
            bridge_id="b1",
            devices=[{"ip": "192.168.1.10"}],
            scanned_at="2026-03-12T00:00:00Z",
        )
        assert msg.type == "bridge:discovery_report"
        assert msg.bridge_id == "b1"
        assert len(msg.devices) == 1
        assert msg.scanned_at == "2026-03-12T00:00:00Z"
        assert hasattr(msg, "message_id")
        assert msg.message_id is None
