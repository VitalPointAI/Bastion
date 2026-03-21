"""
Vision engine module for Bastion robot vision subsystem.

Uses ultralytics YOLOv8 for object detection with a full simulate mode
(``MockVisionEngine``) for development and CI environments.

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
# Real implementation (YOLOv8 via ultralytics)
# ---------------------------------------------------------------------------


class VisionEngine:
    """
    YOLOv8-based vision engine for object detection.

    Falls back to :class:`MockVisionEngine` when:
    - ``simulate=True`` is passed, or
    - ``ultralytics`` cannot be imported.

    The ``detect_once`` coroutine offloads synchronous inference to a thread
    pool via ``asyncio.to_thread`` so it never blocks the event loop.

    Usage::

        engine = VisionEngine(simulate=False)
        camera = Camera(sensor_id=0)
        detections = await engine.detect_once(camera)
    """

    def __init__(
        self,
        model: str = "yolov8n.pt",
        threshold: float = 0.5,
        simulate: bool = False,
        imgsz: int = 320,
    ) -> None:
        self._mock: Optional[MockVisionEngine] = None
        self._model = None
        self._threshold = threshold
        self._imgsz = imgsz

        if simulate:
            self._mock = MockVisionEngine()
            return

        try:
            from ultralytics import YOLO

            self._model = YOLO(model)
            log.info("vision_engine.yolo_loaded", model=model)
        except (ImportError, ModuleNotFoundError):
            log.warning(
                "ultralytics not available — falling back to MockVisionEngine",
                model=model,
            )
            self._mock = MockVisionEngine()
        except Exception as exc:
            log.warning(
                "Failed to load YOLO model — falling back to MockVisionEngine",
                model=model,
                error=str(exc),
            )
            self._mock = MockVisionEngine()

    # ------------------------------------------------------------------
    # Synchronous inference helper (runs in thread pool)
    # ------------------------------------------------------------------

    def _capture_and_detect(self, camera) -> List[DetectionResult]:
        """
        Synchronous: capture a frame from *camera* and run YOLO inference.

        This method is designed to be called via ``asyncio.to_thread`` so that
        blocking GPU inference does not stall the event loop.
        """
        img = camera.Capture()
        if img is None:
            return []

        # Convert CUDA image to numpy, fix color channels, flip for upside-down camera
        import cv2

        # Step 1: CUDA to numpy
        try:
            import jetson_utils
            img_np = jetson_utils.cudaToNumpy(img)
        except ImportError:
            img_np = img  # Already numpy (e.g. from OpenCV capture)

        # Step 2: RGB to BGR (jetson_utils returns RGB, YOLO expects BGR)
        try:
            if hasattr(img_np, 'shape') and len(img_np.shape) == 3 and img_np.shape[2] >= 3:
                img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        except Exception as e:
            log.warning("vision_engine.color_convert_failed", error=str(e))

        # Step 3: Flip 180° (camera mounted upside down)
        try:
            img_np = cv2.flip(img_np, -1)
        except Exception as e:
            log.warning("vision_engine.flip_failed", error=str(e))

        raw_results = self._model(img_np, conf=self._threshold, imgsz=self._imgsz, verbose=False)
        results: List[DetectionResult] = []

        for r in raw_results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cls_id = int(box.cls[0])
                results.append(
                    DetectionResult(
                        class_desc=self._model.names[cls_id],
                        confidence=float(box.conf[0]),
                        bbox={
                            "left": x1,
                            "top": y1,
                            "right": x2,
                            "bottom": y2,
                        },
                        center_x=(x1 + x2) / 2.0,
                        center_y=(y1 + y2) / 2.0,
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
            if img is None:
                return None
            # Flip 180° for upside-down camera, then compress
            try:
                import jetson_utils
                import cv2
                img_np = jetson_utils.cudaToNumpy(img)
                img_np = cv2.flip(img_np, -1)
                # Convert RGB to BGR for cv2 encoding
                img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
                _, jpeg = cv2.imencode('.jpg', img_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
                return jpeg.tobytes()
            except (ImportError, Exception):
                return camera.capture_jpeg(img_cuda=img, quality=quality)

        return await asyncio.to_thread(_do_capture)

    @property
    def is_mock(self) -> bool:
        """True when using MockVisionEngine internally."""
        return self._mock is not None
