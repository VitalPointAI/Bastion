"""
Vision engine module for Bastion robot vision subsystem.

Wraps jetson-inference ``detectNet`` for object detection with a full simulate
mode (``MockVisionEngine``) for development and CI environments.

Architecture note
-----------------
``VisionEngine.detect_once`` runs synchronous inference inside
``asyncio.to_thread`` so it never blocks the robot's asyncio event loop.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

try:
    import structlog

    log = structlog.get_logger(__name__)
except ImportError:
    log = logging.getLogger(__name__)  # type: ignore[assignment]

from vision.camera import Camera, MockCamera
from vision.models import DetectionResult


# ---------------------------------------------------------------------------
# Mock implementation (simulate mode / no hardware)
# ---------------------------------------------------------------------------


class MockVisionEngine:
    """
    Simulated vision engine for use in simulate mode or non-Jetson environments.

    Returns a predictable mock detection every 5th call to ``detect_once`` so
    downstream code can be exercised without real camera hardware.
    """

    def __init__(self) -> None:
        self._frame_count: int = 0

    async def detect_once(self, camera=None) -> List[DetectionResult]:
        """
        Return a mock detection list.

        Every 5th call returns a single :class:`DetectionResult` for a
        ``"person"`` with plausible bounding-box coordinates.  All other calls
        return an empty list.
        """
        self._frame_count += 1
        if self._frame_count % 5 == 0:
            return [
                DetectionResult(
                    class_desc="person",
                    confidence=0.85,
                    bbox={"left": 100.0, "top": 80.0, "right": 300.0, "bottom": 420.0},
                    center_x=200.0,
                    center_y=250.0,
                )
            ]
        return []

    async def get_keyframe_jpeg(
        self, camera=None, quality: int = 50
    ) -> Optional[bytes]:
        """Return a minimal valid JPEG from MockCamera."""
        mock_cam = MockCamera()
        return mock_cam.capture_jpeg(quality=quality)

    @property
    def is_mock(self) -> bool:
        """Always True for MockVisionEngine."""
        return True


# ---------------------------------------------------------------------------
# Real implementation (Jetson hardware with jetson-inference)
# ---------------------------------------------------------------------------


class VisionEngine:
    """
    detectNet-based vision engine for Jetson hardware.

    Falls back to :class:`MockVisionEngine` when:
    - ``simulate=True`` is passed, or
    - ``jetson.inference`` cannot be imported (non-Jetson machine).

    The ``detect_once`` coroutine offloads synchronous inference to a thread
    pool via ``asyncio.to_thread`` so it never blocks the event loop.

    Usage::

        engine = VisionEngine(simulate=False)
        camera = Camera(sensor_id=0)
        detections = await engine.detect_once(camera)
    """

    def __init__(
        self,
        model: str = "ssd-mobilenet-v2",
        threshold: float = 0.5,
        simulate: bool = False,
    ) -> None:
        self._mock: Optional[MockVisionEngine] = None
        self._net = None  # jetson.inference.detectNet, if available

        if simulate:
            self._mock = MockVisionEngine()
            return

        try:
            import jetson.inference  # noqa: F401  — Jetson hardware only

            self._net = jetson.inference.detectNet(model, threshold=threshold)
        except (ImportError, ModuleNotFoundError):
            log.warning(
                "jetson.inference not available — falling back to MockVisionEngine",
                model=model,
            )
            self._mock = MockVisionEngine()
        except Exception as exc:  # pragma: no cover — hardware-only path
            log.warning(
                "Failed to load detectNet — falling back to MockVisionEngine",
                model=model,
                error=str(exc),
            )
            self._mock = MockVisionEngine()

    # ------------------------------------------------------------------
    # Synchronous inference helper (runs in thread pool)
    # ------------------------------------------------------------------

    def _capture_and_detect(self, camera) -> List[DetectionResult]:
        """
        Synchronous: capture a frame from *camera* and run detectNet inference.

        This method is designed to be called via ``asyncio.to_thread`` so that
        blocking GPU inference does not stall the event loop.
        """
        img = camera.Capture()
        if img is None:
            return []

        raw_detections = self._net.Detect(img)  # type: ignore[union-attr]
        results: List[DetectionResult] = []
        for det in raw_detections:
            results.append(
                DetectionResult(
                    class_desc=self._net.GetClassDesc(det.ClassID),  # type: ignore[union-attr]
                    confidence=float(det.Confidence),
                    bbox={
                        "left": float(det.Left),
                        "top": float(det.Top),
                        "right": float(det.Right),
                        "bottom": float(det.Bottom),
                    },
                    center_x=float(det.Center[0]),
                    center_y=float(det.Center[1]),
                )
            )
        return results

    # ------------------------------------------------------------------
    # Public async API
    # ------------------------------------------------------------------

    async def detect_once(self, camera=None) -> List[DetectionResult]:
        """
        Run one detection pass and return the results.

        In simulate mode, delegates to :class:`MockVisionEngine`.
        In real mode, offloads blocking inference to a thread via
        ``asyncio.to_thread`` to keep the event loop responsive.
        """
        if self._mock is not None:
            return await self._mock.detect_once(camera)

        return await asyncio.to_thread(self._capture_and_detect, camera)

    async def get_keyframe_jpeg(
        self, camera=None, quality: int = 50
    ) -> Optional[bytes]:
        """
        Capture and compress a JPEG keyframe.

        Returns bytes on success, or None if capture/compression fails.
        In simulate mode, delegates to :class:`MockVisionEngine`.
        """
        if self._mock is not None:
            return await self._mock.get_keyframe_jpeg(camera, quality=quality)

        if camera is None:
            return None

        # Run blocking capture + compression in thread pool
        def _do_capture() -> Optional[bytes]:
            img = camera.Capture()
            return camera.capture_jpeg(img_cuda=img, quality=quality)

        return await asyncio.to_thread(_do_capture)

    @property
    def is_mock(self) -> bool:
        """True when using MockVisionEngine internally."""
        return self._mock is not None
