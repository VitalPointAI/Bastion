"""Tests for WebSocket protocol helpers in robot.common.ws_protocol."""
import uuid
import pytest
from robot.common.ws_protocol import stamp, send_stamped


class TestStamp:
    """Tests for stamp() helper function."""

    def test_stamp_injects_message_id(self):
        """stamp({}) returns dict with 'message_id' key that is a valid UUID v4 string."""
        result = stamp({})
        assert "message_id" in result
        # Verify it is a valid UUID v4
        parsed = uuid.UUID(result["message_id"], version=4)
        assert str(parsed) == result["message_id"]

    def test_stamp_preserves_existing_id(self):
        """stamp({"message_id": "abc"}) keeps "abc", does not overwrite."""
        result = stamp({"message_id": "abc"})
        assert result["message_id"] == "abc"

    def test_stamp_preserves_other_fields(self):
        """stamp() retains all original keys."""
        original = {"type": "telemetry", "robot_id": "alpha"}
        result = stamp(original)
        assert result["type"] == "telemetry"
        assert result["robot_id"] == "alpha"
        assert "message_id" in result

    def test_stamp_does_not_mutate_original(self):
        """stamp() returns a new dict, does not mutate the input."""
        original = {"type": "telemetry"}
        original_copy = dict(original)
        result = stamp(original)
        assert original == original_copy  # original not mutated
        assert result is not original  # new dict returned

    def test_stamp_empty_string_message_id_not_overwritten(self):
        """stamp() treats empty string message_id as existing (key present), no overwrite."""
        result = stamp({"message_id": ""})
        assert result["message_id"] == ""

    def test_stamp_uuid_is_uuid4(self):
        """Injected UUID is version 4."""
        result = stamp({})
        parsed = uuid.UUID(result["message_id"])
        assert parsed.version == 4


class TestSendStamped:
    """Tests for async send_stamped() helper."""

    @pytest.mark.asyncio
    async def test_send_stamped_calls_send(self):
        """send_stamped() calls ws.send() with JSON-encoded stamped message."""
        import json

        sent_data = []

        class MockWS:
            async def send(self, data):
                sent_data.append(data)

        ws = MockWS()
        msg = {"type": "test", "value": 42}
        await send_stamped(ws, msg)

        assert len(sent_data) == 1
        parsed = json.loads(sent_data[0])
        assert parsed["type"] == "test"
        assert parsed["value"] == 42
        assert "message_id" in parsed
        # Verify valid UUID v4
        uuid.UUID(parsed["message_id"], version=4)

    @pytest.mark.asyncio
    async def test_send_stamped_preserves_existing_message_id(self):
        """send_stamped() preserves existing message_id in sent data."""
        import json

        sent_data = []

        class MockWS:
            async def send(self, data):
                sent_data.append(data)

        ws = MockWS()
        msg = {"type": "test", "message_id": "existing-id"}
        await send_stamped(ws, msg)

        parsed = json.loads(sent_data[0])
        assert parsed["message_id"] == "existing-id"
