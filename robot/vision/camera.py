"""
Camera module for Bastion robot vision subsystem.

Wraps Jetson CSI camera (jetson.utils.videoSource) with a MockCamera fallback
for simulate mode and non-Jetson machines (e.g. CI, development workstations).
"""
from __future__ import annotations

import logging
from typing import Optional

try:
    import structlog

    log = structlog.get_logger(__name__)
except ImportError:
    log = logging.getLogger(__name__)  # type: ignore[assignment]

# ---------------------------------------------------------------------------
# Minimal 1x1 pixel JPEG (50 bytes) — valid JPEG for testing without OpenCV
# ---------------------------------------------------------------------------
_MOCK_JPEG: bytes = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\x1e\x1b"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
    b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
    b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
    b"\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04"
    b"\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xf8\xbe(\xa2\x8a\x00"
    b"\xff\xd9"
)


class MockCamera:
    """
    Simulated camera for use in simulate mode or when jetson-utils is unavailable.

    ``Capture()`` always returns ``None`` — no CUDA image is produced.
    ``capture_jpeg()`` returns a minimal valid JPEG bytes constant for testing.
    """

    def Capture(self) -> None:
        """Return None — no real frame is produced in simulate mode."""
        return None

    def capture_jpeg(
        self,
        img_cuda=None,
        quality: int = 50,
        max_width: int = 640,
    ) -> bytes:
        """Return a minimal valid JPEG bytes constant."""
        return _MOCK_JPEG

    @property
    def is_mock(self) -> bool:
        """Always True for MockCamera."""
        return True


class Camera:
    """
    CSI camera wrapper for Jetson hardware.

    Falls back transparently to :class:`MockCamera` when:
    - ``simulate=True`` is passed, or
    - ``jetson.utils`` cannot be imported (non-Jetson machine).

    Usage::

        cam = Camera(sensor_id=0, simulate=False)
        img = cam.Capture()          # CUDA image or None
        jpeg = cam.capture_jpeg(img) # JPEG bytes
    """

    def __init__(self, sensor_id: int = 0, simulate: bool = False) -> None:
        self._mock: Optional[MockCamera] = None
        self._source = None  # jetson.utils.videoSource, if available

        if simulate:
            self._mock = MockCamera()
            return

        try:
            import jetson.utils  # noqa: F401  — Jetson hardware only

            self._source = jetson.utils.videoSource(f"csi://{sensor_id}")
        except (ImportError, ModuleNotFoundError):
            log.warning(
                "jetson.utils not available — falling back to MockCamera",
                sensor_id=sensor_id,
            )
            self._mock = MockCamera()
        except Exception as exc:  # pragma: no cover — hardware-only path
            log.warning(
                "Failed to open CSI camera — falling back to MockCamera",
                sensor_id=sensor_id,
                error=str(exc),
            )
            self._mock = MockCamera()

    def Capture(self):
        """
        Capture a single frame.

        Returns a CUDA image on real hardware, or None in mock mode.
        """
        if self._mock is not None:
            return self._mock.Capture()
        return self._source.Capture()  # type: ignore[union-attr]

    def capture_jpeg(
        self,
        img_cuda=None,
        quality: int = 50,
        max_width: int = 640,
    ) -> Optional[bytes]:
        """
        Compress *img_cuda* to JPEG bytes.

        Parameters
        ----------
        img_cuda:
            CUDA image returned by ``Capture()``.  If ``None``, the mock JPEG is
            returned (or the image is captured first in real mode).
        quality:
            JPEG compression quality (0–100).
        max_width:
            Downsample to at most this width before encoding.

        Returns
        -------
        bytes or None
            JPEG bytes, or None if compression fails.
        """
        if self._mock is not None:
            return self._mock.capture_jpeg(img_cuda=img_cuda, quality=quality, max_width=max_width)

        # Real Jetson path — requires jetson.utils and OpenCV
        try:
            import jetson.utils  # noqa: F401
            import numpy as np  # noqa: F401
            import cv2  # noqa: F401

            frame = img_cuda if img_cuda is not None else self.Capture()
            if frame is None:
                return None
            img_np = jetson.utils.cudaToNumpy(frame)
            h, w = img_np.shape[:2]
            if w > max_width:
                scale = max_width / w
                img_np = cv2.resize(img_np, (max_width, int(h * scale)))
            ok, buf = cv2.imencode(
                ".jpg", img_np, [int(cv2.IMWRITE_JPEG_QUALITY), quality]
            )
            return bytes(buf) if ok else None
        except Exception as exc:  # pragma: no cover — hardware-only path
            log.warning("capture_jpeg failed", error=str(exc))
            return None

    @property
    def is_mock(self) -> bool:
        """True when using MockCamera internally."""
        return self._mock is not None
