"""
Tests for VisionEngine and MockVisionEngine in simulate mode.

These tests run on any machine (no Jetson hardware required).  They verify
the behaviour of MockVisionEngine and that VisionEngine correctly delegates to
it when jetson-inference is unavailable or simulate=True is passed.
"""
from __future__ import annotations

import pytest
import pytest_asyncio  # noqa: F401 — ensures asyncio mode is available

from vision.vision_engine import MockVisionEngine, VisionEngine
from vision.models import DetectionResult


# ---------------------------------------------------------------------------
# MockVisionEngine behaviour
# ---------------------------------------------------------------------------


def test_mock_engine_returns_empty_initially():
    """First call to detect_once should return an empty list."""
    engine = MockVisionEngine()
    import asyncio

    result = asyncio.run(engine.detect_once())
    assert result == [], "Expected empty list on frame 1"


def test_mock_engine_returns_detection_every_5th():
    """The 5th call to detect_once should return a non-empty detection list."""
    engine = MockVisionEngine()
    import asyncio

    results = []
    for _ in range(5):
        r = asyncio.run(engine.detect_once())
        results.append(r)

    # Frames 1–4 should be empty; frame 5 should have detections
    assert all(r == [] for r in results[:4]), "Frames 1-4 should be empty"
    assert len(results[4]) > 0, "Frame 5 should have at least one detection"


def test_mock_engine_detection_has_required_fields():
    """Detection returned on the 5th frame must have class_desc, confidence, bbox."""
    engine = MockVisionEngine()
    import asyncio

    # Advance to the 5th frame
    for _ in range(4):
        asyncio.run(engine.detect_once())
    result = asyncio.run(engine.detect_once())

    assert len(result) > 0, "Expected at least one detection on frame 5"
    det = result[0]
    assert isinstance(det, DetectionResult)
    assert isinstance(det.class_desc, str) and det.class_desc != ""
    assert 0.0 <= det.confidence <= 1.0
    assert isinstance(det.bbox, dict)
    assert all(k in det.bbox for k in ("left", "top", "right", "bottom"))


def test_vision_engine_simulate_mode():
    """VisionEngine created with simulate=True must report is_mock=True."""
    engine = VisionEngine(simulate=True)
    assert engine.is_mock is True


@pytest.mark.asyncio
async def test_vision_engine_detect_once_async():
    """detect_once on a simulate VisionEngine must return a list (may be empty)."""
    engine = VisionEngine(simulate=True)
    result = await engine.detect_once()
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_mock_engine_keyframe_jpeg():
    """get_keyframe_jpeg on MockVisionEngine must return non-empty bytes."""
    engine = MockVisionEngine()
    jpeg = await engine.get_keyframe_jpeg()
    assert isinstance(jpeg, bytes) and len(jpeg) > 0
