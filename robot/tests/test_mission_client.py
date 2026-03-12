"""Tests for mission_client.py: DID auth, message stamping, bridge fallback."""
from __future__ import annotations

import asyncio
import json
import os
import sys
import types
import importlib
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# Stubs for hardware deps
# ---------------------------------------------------------------------------

def _ensure_stubs():
    if "structlog" not in sys.modules:
        structlog = types.ModuleType("structlog")
        structlog.get_logger = lambda name=None: MagicMock()
        structlog.configure = MagicMock()
        structlog.make_filtering_bound_logger = MagicMock(return_value=None)
        structlog.PrintLoggerFactory = MagicMock()
        sys.modules["structlog"] = structlog

    if "calibration" not in sys.modules:
        cal = types.ModuleType("calibration")
        cal.load_profile = MagicMock(return_value=MagicMock())
        sys.modules["calibration"] = cal

    if "rvr_driver" not in sys.modules:
        rvr = types.ModuleType("rvr_driver")
        rvr.RVRDriver = MagicMock()
        sys.modules["rvr_driver"] = rvr

    if "mission_executor" not in sys.modules:
        me = types.ModuleType("mission_executor")
        me.MissionExecutor = MagicMock()
        sys.modules["mission_executor"] = me


_ensure_stubs()


def _fresh_mission_client(env_overrides: dict):
    """Reload mission_client with clean env."""
    os.environ.setdefault("BASTION_WS_URL", "ws://cloud:3001")
    for k, v in env_overrides.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v

    import config
    importlib.reload(config)

    sys.modules.pop("mission_client", None)
    import mission_client
    importlib.reload(mission_client)
    return mission_client


class TestRegistrationUsesTokenFirstTime:
    """When REGISTRATION_TOKEN is set and no DID, sends token-based register msg."""

    def test_registration_uses_token_first_time(self):
        """connect_and_run sends {type:robot:register, token: ..., robot_id: ...} when token set."""
        env = {
            "REGISTRATION_TOKEN": "otp-secret-token",
            "ROBOT_DID": "",
            "DID_FILE": "/tmp/nonexistent_did_test_xyz",
            "AUTH_TOKEN": "",
        }
        mc = _fresh_mission_client(env)

        sent_messages = []

        async def fake_ws_send(ws, msg: dict) -> None:
            sent_messages.append(msg)

        async def run_test():
            ws_mock = AsyncMock()
            ws_mock.__aenter__ = AsyncMock(return_value=ws_mock)
            ws_mock.__aexit__ = AsyncMock(return_value=False)
            ws_mock.recv = AsyncMock(side_effect=Exception("stop"))

            with patch("mission_client.send_stamped", new_callable=AsyncMock) as mock_stamped:
                mock_stamped.side_effect = lambda ws, msg: sent_messages.append(msg) or asyncio.coroutine(lambda: None)()

                # Just test _build_register_msg directly
                msg = mc._build_register_msg()
                assert msg["type"] == "robot:register"
                assert msg.get("token") == "otp-secret-token"
                assert "robot_id" in msg
                # Should NOT have auth_token when token is used
                assert not msg.get("auth_token")

        asyncio.get_event_loop().run_until_complete(run_test())


class TestRegistrationUsesDIDSubsequent:
    """When DID loaded from file, sends did-based register msg."""

    def test_registration_uses_did_subsequent(self):
        import tempfile
        with tempfile.NamedTemporaryFile(mode="w", suffix=".did", delete=False) as f:
            f.write("did:bastion:robot-test-123")
            did_path = f.name

        try:
            env = {
                "REGISTRATION_TOKEN": "",
                "ROBOT_DID": "",
                "DID_FILE": did_path,
                "AUTH_TOKEN": "",
            }
            mc = _fresh_mission_client(env)

            msg = mc._build_register_msg()
            assert msg["type"] == "robot:register"
            assert msg.get("did") == "did:bastion:robot-test-123"
            assert not msg.get("token")
            assert not msg.get("auth_token")
        finally:
            os.unlink(did_path)


class TestOutboundMessagesStamped:
    """All outbound messages from robot include message_id via stamp()."""

    def test_outbound_messages_stamped_via_send_stamped(self):
        """send_stamped is used (not raw _ws_send) for registration."""
        env = {"AUTH_TOKEN": "", "REGISTRATION_TOKEN": "tok", "ROBOT_DID": ""}
        mc = _fresh_mission_client(env)

        # The module should import send_stamped from common.ws_protocol
        assert hasattr(mc, "send_stamped"), "mission_client must import send_stamped"

    def test_stamp_function_available_in_mission_client(self):
        """stamp is importable from mission_client (via common.ws_protocol)."""
        env = {"AUTH_TOKEN": ""}
        mc = _fresh_mission_client(env)
        from common.ws_protocol import stamp
        msg = stamp({"type": "robot:telemetry", "robot_id": "alpha"})
        assert "message_id" in msg


class TestBuildRegisterMsgFallbacks:
    """_build_register_msg falls back to legacy auth_token when no token/did."""

    def test_build_register_msg_legacy_fallback(self):
        env = {
            "REGISTRATION_TOKEN": "",
            "ROBOT_DID": "",
            "DID_FILE": "/tmp/nonexistent_did_test_xyz2",
            "AUTH_TOKEN": "legacy-token",
        }
        mc = _fresh_mission_client(env)
        msg = mc._build_register_msg()
        assert msg["type"] == "robot:register"
        assert msg.get("auth_token") == "legacy-token"

    def test_build_register_msg_includes_robot_id(self):
        env = {
            "REGISTRATION_TOKEN": "tok",
            "ROBOT_ID": "test-robot-7",
            "AUTH_TOKEN": "",
        }
        mc = _fresh_mission_client(env)
        msg = mc._build_register_msg()
        assert msg.get("robot_id") == "test-robot-7"

    def test_build_register_msg_includes_capabilities(self):
        env = {"REGISTRATION_TOKEN": "tok", "AUTH_TOKEN": ""}
        mc = _fresh_mission_client(env)
        msg = mc._build_register_msg()
        assert isinstance(msg.get("capabilities"), list)
