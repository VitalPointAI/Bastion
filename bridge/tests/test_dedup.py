"""
Tests for message_id pass-through in bridge_ws._relay_robot_message.

Verifies that:
  - Original message_id from robot message is preserved in the envelope
  - Robot messages with no message_id result in envelope with message_id=None
  - No new stamp is injected (cloud handles dedup for messages that have a message_id)
"""
import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from bridge.bridge_ws import _relay_robot_message


class TestMessageIdPassThrough:
    async def test_relay_preserves_original_message_id(self):
        """_relay_robot_message preserves the original message_id from the robot message."""
        ws = AsyncMock()
        robot_msg = {
            "type": "robot:telemetry",
            "robot_id": "alpha",
            "message_id": "abc-123",
        }

        await _relay_robot_message(ws, robot_msg, bridge_id="bridge-01")

        ws.send.assert_awaited_once()
        envelope = json.loads(ws.send.await_args.args[0])
        assert envelope["type"] == "bridge:robot_relay"
        assert envelope["message_id"] == "abc-123"
        assert envelope["robot_message"]["message_id"] == "abc-123"

    async def test_relay_no_message_id_passes_none(self):
        """Robot message with no message_id results in envelope with message_id=None."""
        ws = AsyncMock()
        robot_msg = {
            "type": "robot:telemetry",
            "robot_id": "alpha",
            # no message_id key
        }

        await _relay_robot_message(ws, robot_msg, bridge_id="bridge-01")

        ws.send.assert_awaited_once()
        envelope = json.loads(ws.send.await_args.args[0])
        assert envelope["message_id"] is None
        # Ensure message_id key is explicitly present in envelope (cloud checks for it)
        assert "message_id" in envelope

    async def test_relay_does_not_inject_new_stamp(self):
        """Envelope should not have a different message_id than the robot message."""
        ws = AsyncMock()
        original_id = "robot-original-uuid"
        robot_msg = {
            "type": "robot:state_update",
            "robot_id": "beta",
            "message_id": original_id,
        }

        await _relay_robot_message(ws, robot_msg, bridge_id="bridge-01")

        envelope = json.loads(ws.send.await_args.args[0])
        # Must be the robot's original ID, never a freshly generated UUID
        assert envelope["message_id"] == original_id

    async def test_relay_includes_bridge_id(self):
        """Envelope includes the bridge_id for routing."""
        ws = AsyncMock()
        robot_msg = {"type": "robot:telemetry", "robot_id": "alpha", "message_id": "x"}

        await _relay_robot_message(ws, robot_msg, bridge_id="my-bridge")

        envelope = json.loads(ws.send.await_args.args[0])
        assert envelope["bridge_id"] == "my-bridge"
