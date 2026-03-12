"""
Tests for bridge.bridge_relay module.

Covers:
  - robot messages are forwarded to cloud via relay
  - queued commands are drained and sent on robot connect
  - cloud commands are routed to locally connected robots
  - is_robot_connected / send_to_robot helpers
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from bridge.command_queue import CommandQueue


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _AsyncIterWS:
    """Mock WebSocket that yields the given messages then stops."""

    def __init__(self, messages=None):
        self._messages = list(messages or [])
        self._index = 0
        self.remote_address = ("127.0.0.1", 9999)
        self.send = AsyncMock()
        self.close = AsyncMock()

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._messages):
            raise StopAsyncIteration
        msg = self._messages[self._index]
        self._index += 1
        return msg


def _make_ws(messages=None):
    """Create a mock WebSocket that yields the given messages then closes."""
    return _AsyncIterWS(messages)


# ---------------------------------------------------------------------------
# RobotRelay helpers
# ---------------------------------------------------------------------------

class TestRobotRelayHelpers:
    """Tests for is_robot_connected and send_to_robot."""

    def test_is_robot_connected_false_initially(self):
        from bridge.bridge_relay import RobotRelay
        relay = RobotRelay()
        assert relay.is_robot_connected("alpha") is False

    def test_is_robot_connected_true_after_register(self):
        from bridge.bridge_relay import RobotRelay
        relay = RobotRelay()
        fake_ws = MagicMock()
        relay._connected_robots["alpha"] = fake_ws
        assert relay.is_robot_connected("alpha") is True

    async def test_send_to_robot_returns_false_when_not_connected(self):
        from bridge.bridge_relay import RobotRelay
        relay = RobotRelay()
        sent = await relay.send_to_robot("alpha", {"cmd": "move"})
        assert sent is False

    async def test_send_to_robot_sends_and_returns_true(self):
        from bridge.bridge_relay import RobotRelay
        relay = RobotRelay()
        fake_ws = MagicMock()
        fake_ws.send = AsyncMock()
        relay._connected_robots["alpha"] = fake_ws

        sent = await relay.send_to_robot("alpha", {"cmd": "move"})
        assert sent is True
        fake_ws.send.assert_awaited_once()


# ---------------------------------------------------------------------------
# handle_robot_connection
# ---------------------------------------------------------------------------

class TestHandleRobotConnection:
    """Tests for the per-robot connection handler."""

    async def test_robot_register_drains_queue(self):
        """On robot:register, queued commands are drained and sent."""
        from bridge.bridge_relay import RobotRelay

        queue = CommandQueue()
        queue.enqueue("alpha", {"type": "mission:assign", "seq": 1})
        queue.enqueue("alpha", {"type": "mission:assign", "seq": 2})

        register_msg = json.dumps({"type": "robot:register", "robot_id": "alpha"})
        robot_ws = _make_ws(messages=[register_msg])

        relay = RobotRelay()
        cloud_ws = AsyncMock()
        relay._cloud_ws = cloud_ws

        await relay._handle_robot_connection(robot_ws, queue)

        # Commands should have been sent to the robot
        assert robot_ws.send.await_count == 2
        sent_payloads = [json.loads(c.args[0]) for c in robot_ws.send.await_args_list]
        seqs = [p["seq"] for p in sent_payloads]
        assert seqs == [1, 2]

    async def test_robot_message_forwarded_to_cloud(self):
        """Non-register robot messages are forwarded to cloud WS."""
        from bridge.bridge_relay import RobotRelay

        telemetry_msg = json.dumps({
            "type": "robot:telemetry",
            "robot_id": "alpha",
            "message_id": "msg-001",
        })
        robot_ws = _make_ws(messages=[telemetry_msg])

        relay = RobotRelay()
        cloud_ws = AsyncMock()
        relay._cloud_ws = cloud_ws

        queue = CommandQueue()
        await relay._handle_robot_connection(robot_ws, queue)

        # Cloud WS should have received the relay envelope
        cloud_ws.send.assert_awaited_once()
        envelope = json.loads(cloud_ws.send.await_args.args[0])
        assert envelope["type"] == "bridge:robot_relay"
        assert envelope["robot_message"]["message_id"] == "msg-001"

    async def test_robot_disconnected_on_exit(self):
        """Robot is removed from connected_robots when connection ends."""
        from bridge.bridge_relay import RobotRelay

        register_msg = json.dumps({"type": "robot:register", "robot_id": "alpha"})
        robot_ws = _make_ws(messages=[register_msg])

        relay = RobotRelay()
        relay._cloud_ws = AsyncMock()

        queue = CommandQueue()
        await relay._handle_robot_connection(robot_ws, queue)

        assert relay.is_robot_connected("alpha") is False
