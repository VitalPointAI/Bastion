"""
Top-level re-export of swarm graph helpers.

This module provides convenient access to build_swarm_event_id and
build_swarm_event_assertion without needing to know the sub-module path.

Canonical implementations live in robot/swarm/graph_events.py.
"""
from robot.swarm.graph_events import (  # noqa: F401
    build_swarm_event_id,
    build_swarm_event_assertion,
)

__all__ = ["build_swarm_event_id", "build_swarm_event_assertion"]
