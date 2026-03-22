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
import threading
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
        self._last_frame = None  # Last captured BGR numpy frame
        self._last_detections: List[DetectionResult] = []  # Last detection results
        self._lock = threading.Lock()  # Prevent concurrent camera/model access

        if simulate:
            self._mock = MockVisionEngine()
            return

        try:
            from ultralytics import YOLO

            self._model = YOLO(model)
            log.info(
                "vision_engine.yolo_loaded",
                model=model,
                threshold=threshold,
                imgsz=imgsz,
                classes=getattr(self._model, 'names', None),
            )
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

    def _prepare_frame(self, camera):
        """Capture and preprocess a single frame. Returns numpy BGR image or None."""
        img = camera.Capture()
        if img is None:
            log.debug("vision_engine.capture_returned_none")
            return None

        import cv2

        try:
            import jetson_utils
            img_np = jetson_utils.cudaToNumpy(img)
        except ImportError:
            img_np = img

        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        img_np = cv2.flip(img_np, -1)
        return img_np

    def _capture_and_detect(self, camera) -> List[DetectionResult]:
        """
        Synchronous: capture a frame from *camera* and run YOLO inference.

        Image processing matches test_detect.py exactly:
        1. CUDA → numpy via jetson_utils.cudaToNumpy
        2. RGB → BGR via cv2.cvtColor (unconditional)
        3. Flip 180° via cv2.flip (unconditional)

        This method is designed to be called via ``asyncio.to_thread`` so that
        blocking GPU inference does not stall the event loop. A threading lock
        prevents concurrent camera/model access from multiple async loops.
        """
        with self._lock:
            img_np = self._prepare_frame(camera)
            if img_np is None:
                return []

            # Store the last frame for annotated keyframe generation
            self._last_frame = img_np

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

            # Store detections so get_keyframe_jpeg can draw them
            self._last_detections = results
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
        Return an annotated JPEG keyframe with bounding boxes drawn on detections.

        Uses the last frame captured by ``_capture_and_detect`` so the keyframe
        matches exactly what was analyzed. If no frame is cached, captures a fresh one.
        In simulate mode, delegates to :class:`MockVisionEngine`.
        """
        if self._mock is not None:
            return await self._mock.get_keyframe_jpeg(camera, quality=quality)

        if camera is None:
            return None

        def _do_annotate() -> Optional[bytes]:
            import cv2

            frame = self._last_frame
            if frame is None:
                # No cached frame — capture a fresh one
                frame = self._prepare_frame(camera)
            if frame is None:
                return None

            # Draw bounding boxes for each detection
            annotated = frame.copy()
            for det in self._last_detections:
                bbox = det.bbox
                x1, y1 = int(bbox["left"]), int(bbox["top"])
                x2, y2 = int(bbox["right"]), int(bbox["bottom"])
                label = f"{det.class_desc} {det.confidence:.0%}"

                # Red box + label for hostile vehicles
                color = (0, 0, 255)  # BGR red
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

                # Label background
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(annotated, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
                cv2.putText(annotated, label, (x1 + 2, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            _, jpeg = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, quality])
            return jpeg.tobytes()

        return await asyncio.to_thread(_do_annotate)

    @property
    def is_mock(self) -> bool:
        """True when using MockVisionEngine internally."""
        return self._mock is not None
