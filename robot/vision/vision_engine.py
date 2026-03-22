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

    def _detect_and_encode(self, camera, jpeg_quality: int = 50):
        """
        Single synchronous pass: capture → detect → annotate → JPEG encode.

        Returns (detections, jpeg_bytes). Everything runs in one thread call
        to avoid extra thread dispatch overhead and frame/detection state races.
        """
        import cv2

        with self._lock:
            img_np = self._prepare_frame(camera)
            if img_np is None:
                return [], None

            # Run YOLO inference at training resolution (imgsz handles resize)
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
                                "left": x1, "top": y1,
                                "right": x2, "bottom": y2,
                            },
                            center_x=(x1 + x2) / 2.0,
                            center_y=(y1 + y2) / 2.0,
                        )
                    )

            # Draw bounding boxes directly on the frame (no copy if no detections)
            if results:
                for det in results:
                    bx = det.bbox
                    ix1, iy1 = int(bx["left"]), int(bx["top"])
                    ix2, iy2 = int(bx["right"]), int(bx["bottom"])
                    label = f"{det.class_desc} {det.confidence:.0%}"
                    color = (0, 0, 255)  # BGR red
                    cv2.rectangle(img_np, (ix1, iy1), (ix2, iy2), color, 2)
                    (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                    cv2.rectangle(img_np, (ix1, iy1 - th - 6), (ix1 + tw + 4, iy1), color, -1)
                    cv2.putText(img_np, label, (ix1 + 2, iy1 - 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # Resize for WebSocket transport — send at inference size, not full res
            h, w = img_np.shape[:2]
            target_w = self._imgsz
            if w > target_w:
                scale = target_w / w
                img_np = cv2.resize(img_np, (target_w, int(h * scale)))

            _, jpeg = cv2.imencode('.jpg', img_np, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
            return results, jpeg.tobytes()

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

        results, jpeg = await asyncio.to_thread(self._detect_and_encode, camera)
        self._last_jpeg = jpeg
        return results

    async def get_keyframe_jpeg(
        self, camera=None, quality: int = 50
    ) -> Optional[bytes]:
        """
        Return the annotated JPEG from the last detect_once call.

        Must be called after detect_once — returns the pre-encoded JPEG with
        bounding boxes already drawn. No separate capture or thread dispatch.
        """
        if self._mock is not None:
            return await self._mock.get_keyframe_jpeg(camera, quality=quality)

        return getattr(self, '_last_jpeg', None)

    @property
    def is_mock(self) -> bool:
        """True when using MockVisionEngine internally."""
        return self._mock is not None
