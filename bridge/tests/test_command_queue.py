"""
Tests for bridge.command_queue.CommandQueue.

Covers:
  - enqueue and drain in order
  - TTL expiry filters out stale commands
  - drain clears the queue (idempotent)
  - background cleanup() removes expired entries
"""
import asyncio
import time

import pytest

from bridge.command_queue import CommandQueue


class TestEnqueueAndDrain:
    def test_enqueue_and_drain_in_order(self):
        q = CommandQueue()
        q.enqueue("alpha", {"cmd": "move", "seq": 1})
        q.enqueue("alpha", {"cmd": "stop", "seq": 2})
        q.enqueue("alpha", {"cmd": "report", "seq": 3})

        result = q.drain("alpha")
        assert len(result) == 3
        assert result[0]["seq"] == 1
        assert result[1]["seq"] == 2
        assert result[2]["seq"] == 3

    def test_drain_unknown_robot_returns_empty(self):
        q = CommandQueue()
        assert q.drain("ghost") == []

    def test_drain_clears_queue(self):
        q = CommandQueue()
        q.enqueue("alpha", {"cmd": "move"})
        first = q.drain("alpha")
        assert len(first) == 1
        second = q.drain("alpha")
        assert second == []

    def test_size_reflects_enqueued_count(self):
        q = CommandQueue()
        assert q.size("alpha") == 0
        q.enqueue("alpha", {"cmd": "a"})
        q.enqueue("alpha", {"cmd": "b"})
        assert q.size("alpha") == 2


class TestTTLExpiry:
    def test_ttl_expiry_filters_stale_commands(self):
        q = CommandQueue(default_ttl_sec=0.05)  # 50 ms
        q.enqueue("alpha", {"cmd": "move"})
        time.sleep(0.1)  # outlive TTL
        result = q.drain("alpha")
        assert result == []

    def test_live_commands_returned_within_ttl(self):
        q = CommandQueue(default_ttl_sec=10.0)
        q.enqueue("alpha", {"cmd": "move"})
        result = q.drain("alpha")
        assert len(result) == 1

    def test_mixed_ttl_returns_only_live(self):
        """Enqueue with short TTL, sleep, enqueue another with long TTL, drain returns only live."""
        q = CommandQueue(default_ttl_sec=100.0)
        # Manually enqueue an already-expired entry by manipulating time
        import time as _time
        from bridge.command_queue import QueuedCommand
        expired_cmd = QueuedCommand(payload={"cmd": "expired"}, ttl_expires_at=_time.time() - 1)
        q._queues.setdefault("alpha", []).append(expired_cmd)
        q.enqueue("alpha", {"cmd": "live"})
        result = q.drain("alpha")
        assert len(result) == 1
        assert result[0]["cmd"] == "live"


class TestCleanup:
    def test_background_cleanup_removes_expired(self):
        q = CommandQueue(default_ttl_sec=0.05)
        q.enqueue("alpha", {"cmd": "gone"})
        q.enqueue("beta", {"cmd": "also_gone"})
        time.sleep(0.1)
        expired_count = q.cleanup()
        assert expired_count >= 2
        assert q.size("alpha") == 0
        assert q.size("beta") == 0

    def test_cleanup_leaves_live_entries(self):
        q = CommandQueue(default_ttl_sec=100.0)
        q.enqueue("alpha", {"cmd": "keep"})
        expired_count = q.cleanup()
        assert expired_count == 0
        assert q.size("alpha") == 1

    async def test_cleanup_loop_runs_until_shutdown(self):
        q = CommandQueue(default_ttl_sec=0.01)
        q.enqueue("alpha", {"cmd": "will_expire"})
        shutdown = asyncio.Event()

        async def stop_soon():
            await asyncio.sleep(0.15)
            shutdown.set()

        await asyncio.gather(
            stop_soon(),
            q.cleanup_loop(interval_sec=0.05, shutdown=shutdown),
        )
        assert q.size("alpha") == 0
