"""Tests for robot/vision/models.py: VisionMsg, DetectionResult, VisionConfig, TargetMatchResult."""
import pytest
from datetime import datetime


class TestDetectionResult:
    """DetectionResult serializes correctly and validates fields."""

    def test_detection_result_serialization(self):
        """DetectionResult serializes to JSON with required keys."""
        from robot.vision.models import DetectionResult
        det = DetectionResult(
            class_desc="person",
            confidence=0.92,
            bbox={"left": 10.0, "top": 20.0, "right": 110.0, "bottom": 180.0},
        )
        data = det.model_dump()
        assert "class_desc" in data
        assert "confidence" in data
        assert "bbox" in data
        assert data["class_desc"] == "person"
        assert data["confidence"] == 0.92
        assert data["bbox"]["left"] == 10.0

    def test_detection_result_optional_center(self):
        """DetectionResult center_x and center_y are optional."""
        from robot.vision.models import DetectionResult
        det = DetectionResult(
            class_desc="chair",
            confidence=0.75,
            bbox={"left": 0.0, "top": 0.0, "right": 50.0, "bottom": 50.0},
            center_x=25.0,
            center_y=25.0,
        )
        assert det.center_x == 25.0
        assert det.center_y == 25.0

    def test_detection_result_center_defaults_none(self):
        """DetectionResult center_x and center_y default to None."""
        from robot.vision.models import DetectionResult
        det = DetectionResult(
            class_desc="dog",
            confidence=0.6,
            bbox={"left": 5.0, "top": 5.0, "right": 60.0, "bottom": 80.0},
        )
        assert det.center_x is None
        assert det.center_y is None


class TestTargetMatchResult:
    """TargetMatchResult validates correctly."""

    def test_target_match_result(self):
        """TargetMatchResult fields validate correctly."""
        from robot.vision.models import TargetMatchResult
        result = TargetMatchResult(found=True, confidence=0.88, match_count=3)
        assert result.found is True
        assert result.confidence == 0.88
        assert result.match_count == 3

    def test_target_match_result_default_match_count(self):
        """TargetMatchResult match_count defaults to 0."""
        from robot.vision.models import TargetMatchResult
        result = TargetMatchResult(found=False, confidence=0.0)
        assert result.match_count == 0


class TestVisionMsg:
    """VisionMsg validates with various combinations of fields."""

    def test_vision_msg_defaults(self):
        """VisionMsg with empty detections list validates and has correct defaults."""
        from robot.vision.models import VisionMsg
        msg = VisionMsg(
            robot_id="r1",
            timestamp=datetime.utcnow(),
        )
        assert msg.type == "robot:vision"
        assert msg.detections == []
        assert msg.scene_description is None
        assert msg.target_match is None
        assert msg.keyframe_jpeg_b64 is None
        assert msg.message_id is None

    def test_vision_msg_full(self):
        """VisionMsg with detections + scene_description + keyframe_jpeg_b64 validates."""
        from robot.vision.models import VisionMsg, DetectionResult, TargetMatchResult
        msg = VisionMsg(
            robot_id="r1",
            mission_id="m1",
            timestamp=datetime.utcnow(),
            detections=[
                DetectionResult(
                    class_desc="person",
                    confidence=0.9,
                    bbox={"left": 0.0, "top": 0.0, "right": 100.0, "bottom": 200.0},
                )
            ],
            scene_description="A person standing in a hallway",
            target_match=TargetMatchResult(found=True, confidence=0.85),
            keyframe_jpeg_b64="/9j/fakejpegdata==",
        )
        assert len(msg.detections) == 1
        assert msg.detections[0].class_desc == "person"
        assert msg.scene_description == "A person standing in a hallway"
        assert msg.target_match.found is True
        assert msg.keyframe_jpeg_b64 == "/9j/fakejpegdata=="

    def test_vision_msg_type_default(self):
        """VisionMsg.type defaults to 'robot:vision'."""
        from robot.vision.models import VisionMsg
        msg = VisionMsg(robot_id="r1", timestamp=datetime.utcnow())
        assert msg.type == "robot:vision"


class TestVisionConfig:
    """VisionConfig has all expected fields with sensible defaults."""

    def test_vision_config_defaults(self):
        """VisionConfig has all required fields with expected default values."""
        from robot.vision.models import VisionConfig
        cfg = VisionConfig()
        assert cfg.enabled is True
        assert cfg.model == "ssd-mobilenet-v2"
        assert cfg.threshold == 0.5
        assert cfg.keyframe_enabled is False
        assert cfg.keyframe_quality == 50
        assert cfg.vlm_enabled is False
        assert cfg.vision_cadence_ms == 500

    def test_vision_config_custom_values(self):
        """VisionConfig accepts custom values."""
        from robot.vision.models import VisionConfig
        cfg = VisionConfig(
            enabled=False,
            model="ssd-inception-v2",
            threshold=0.7,
            keyframe_enabled=True,
            keyframe_quality=80,
            vlm_enabled=True,
            vision_cadence_ms=1000,
        )
        assert cfg.enabled is False
        assert cfg.model == "ssd-inception-v2"
        assert cfg.threshold == 0.7
        assert cfg.keyframe_enabled is True
        assert cfg.keyframe_quality == 80
        assert cfg.vlm_enabled is True
        assert cfg.vision_cadence_ms == 1000
