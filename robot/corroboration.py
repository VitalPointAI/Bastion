"""
Top-level re-export of corroboration helpers.

Canonical implementation lives in robot/swarm/corroboration.py.
"""
from robot.swarm.corroboration import (  # noqa: F401
    VISION_PIPELINE_WEIGHT,
    fuse_detection_confidence,
)

__all__ = ["VISION_PIPELINE_WEIGHT", "fuse_detection_confidence"]
