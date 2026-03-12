"""
Per-robot TTL command queue for the local discovery bridge.

When a robot is offline, commands destined for it are held in a per-robot
queue with a configurable TTL.  When the robot reconnects, the relay drains
the queue and delivers all non-expired commands.

Usage:
    from bridge.command_queue import CommandQueue

    queue = CommandQueue(default_ttl_sec=300.0)
    queue.enqueue("robot-alpha", {"type": "mission:assign", "mission_id": "m1"})
    commands = queue.drain("robot-alpha")  # returns list of live command payloads
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List

logger = logging.getLogger(__name__)


@dataclass
class QueuedCommand:
    """A single command held in the per-robot queue."""

    payload: dict
    ttl_expires_at: float  # UNIX epoch seconds


class CommandQueue:
    """Thread-safe* per-robot command queue with TTL expiry.

    (*) This implementation is not thread-safe in the traditional sense —
    it is designed for use within a single asyncio event loop.
    """

    def __init__(self, default_ttl_sec: float = 300.0) -> None:
        self.default_ttl_sec = default_ttl_sec
        self._queues: Dict[str, List[QueuedCommand]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def enqueue(self, robot_id: str, command: dict) -> None:
        """Add *command* to the queue for *robot_id*.

        The command is assigned a TTL based on the current time plus
        ``self.default_ttl_sec``.

        Args:
            robot_id: Identifier of the target robot.
            command: Arbitrary command payload dict.
        """
        expires_at = time.time() + self.default_ttl_sec
        queued = QueuedCommand(payload=command, ttl_expires_at=expires_at)
        self._queues.setdefault(robot_id, []).append(queued)

    def drain(self, robot_id: str) -> List[dict]:
        """Pop all live (non-expired) commands for *robot_id* and return them in order.

        Expired commands are silently discarded.  After calling drain() the queue
        for *robot_id* is empty.

        Args:
            robot_id: Identifier of the target robot.

        Returns:
            List of command payload dicts in enqueue order (FIFO).
        """
        queue = self._queues.pop(robot_id, [])
        now = time.time()
        live = [cmd.payload for cmd in queue if cmd.ttl_expires_at > now]
        return live

    def cleanup(self) -> int:
        """Remove expired commands from all queues.

        Runs in O(n) over all queued entries.  Logs expired counts at WARN level.

        Returns:
            Total number of expired commands removed across all robots.
        """
        now = time.time()
        total_expired = 0
        for robot_id in list(self._queues.keys()):
            before = len(self._queues[robot_id])
            self._queues[robot_id] = [
                cmd for cmd in self._queues[robot_id] if cmd.ttl_expires_at > now
            ]
            expired = before - len(self._queues[robot_id])
            if expired:
                logger.warning(
                    "CommandQueue.cleanup: removed %d expired command(s) for robot %s",
                    expired,
                    robot_id,
                )
            total_expired += expired
        return total_expired

    async def cleanup_loop(
        self,
        interval_sec: float = 60.0,
        shutdown: asyncio.Event = None,
    ) -> None:
        """Background coroutine that calls :meth:`cleanup` every *interval_sec*.

        Runs until *shutdown* is set.

        Args:
            interval_sec: How often (seconds) to run cleanup.
            shutdown: asyncio.Event that signals when to stop.
        """
        if shutdown is None:
            shutdown = asyncio.Event()

        while not shutdown.is_set():
            try:
                await asyncio.wait_for(shutdown.wait(), timeout=interval_sec)
                break  # shutdown fired during wait
            except asyncio.TimeoutError:
                pass  # interval elapsed, run cleanup
            self.cleanup()

    def size(self, robot_id: str) -> int:
        """Return the number of queued commands for *robot_id* (including expired).

        Note: includes expired entries until :meth:`drain` or :meth:`cleanup` runs.

        Args:
            robot_id: Identifier of the target robot.

        Returns:
            Count of queued commands.
        """
        return len(self._queues.get(robot_id, []))
