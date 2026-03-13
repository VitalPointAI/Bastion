"""
Pydantic models for robot vision subsystem.

Defines data structures for detection results, vision messages, and vision
configuration exchanged between the vision engine and Bastion.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class DetectionResult(BaseModel):
    """A single object detection result from the vision engine."""

    class_desc: str
    """Human-readable class label (e.g. 'person', 'chair')."""

    confidence: float
    """Detection confidence score (0.0 - 1.0)."""

    bbox: Dict[str, float]
    """Bounding box with keys: left, top, right, bottom (pixel coordinates)."""

    center_x: Optional[float] = None
    """Horizontal center of the bounding box in pixels."""

    center_y: Optional[float] = None
    """Vertical center of the bounding box in pixels."""


class TargetMatchResult(BaseModel):
    """Result of a visual target match operation."""

    found: bool
    """Whether the reference target was found in the scene."""

    confidence: float
    """Match confidence score (0.0 - 1.0)."""

    match_count: int = 0
    """Number of feature matches found."""


class VisionMsg(BaseModel):
    """Vision detection event sent from robot to Bastion."""

    type: str = "robot:vision"
    robot_id: str
    mission_id: Optional[str] = None
    timestamp: datetime
    detections: List[DetectionResult] = Field(default_factory=list)
    """List of object detections from this frame."""

    scene_description: Optional[str] = None
    """VLM-generated natural language scene description (if VLM enabled)."""

    target_match: Optional[TargetMatchResult] = None
    """Result of reference image matching (if visual_search mission)."""

    keyframe_jpeg_b64: Optional[str] = None
    """Base64-encoded JPEG keyframe (if keyframe sending is enabled)."""

    message_id: Optional[str] = None


class VisionConfig(BaseModel):
    """Configuration for the vision engine, derived from VisionConfig settings."""

    enabled: bool = True
    """When True, initialize camera and run detection loop."""

    model: str = "ssd-mobilenet-v2"
    """detectNet model name to load."""

    threshold: float = 0.5
    """Minimum detection confidence threshold (0.0 - 1.0)."""

    keyframe_enabled: bool = False
    """When True, send JPEG keyframes on detection events."""

    keyframe_quality: int = 50
    """JPEG compression quality for keyframes (0-100)."""

    vlm_enabled: bool = False
    """When True, enable VLM scene description (memory-intensive)."""

    vision_cadence_ms: int = 500
    """Vision detection loop interval in milliseconds."""
