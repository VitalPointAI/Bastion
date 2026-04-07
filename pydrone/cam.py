"""
Camera wrapper for pyDrone — works with both firmware variants.

Detects which camera module is available:
  - 'camera' module (cnadler86 generic firmware / newer builds)
  - 'sensor' module (01Studio custom firmware)
"""

import config as cfg

_cam = None
_backend = None  # 'camera' or 'sensor'


def init():
    """Initialize the camera. Call once at boot."""
    global _cam, _backend

    # Try the generic camera API first (cnadler86 / MicroPython 1.27+)
    try:
        from camera import Camera, PixelFormat, FrameSize

        size_map = {
            "QQVGA": FrameSize.QQVGA,
            "QVGA": FrameSize.QVGA,
            "VGA": FrameSize.VGA,
            "SVGA": FrameSize.SVGA,
            "XGA": FrameSize.XGA,
        }
        fs = size_map.get(cfg.CAMERA_FRAME_SIZE, FrameSize.VGA)

        _cam = Camera(
            data_pins=cfg.CAM_DATA_PINS,
            vsync_pin=cfg.CAM_VSYNC,
            href_pin=cfg.CAM_HREF,
            pclk_pin=cfg.CAM_PCLK,
            xclk_pin=cfg.CAM_XCLK,
            sda_pin=cfg.CAM_SDA,
            scl_pin=cfg.CAM_SCL,
            xclk_freq=cfg.CAM_XCLK_FREQ,
            pixel_format=PixelFormat.JPEG,
            frame_size=fs,
        )
        _cam.set_quality(cfg.CAMERA_QUALITY)
        _backend = "camera"
        print("[cam] initialized (generic camera API)")

        # Warm-up frames for auto-exposure
        import time
        for _ in range(3):
            _cam.capture()
            time.sleep_ms(200)

        return True
    except ImportError:
        pass

    # Fall back to 01Studio sensor module
    try:
        import sensor

        size_map = {
            "QQVGA": sensor.QQVGA,
            "QVGA": sensor.QVGA,
            "VGA": sensor.VGA,
        }
        fs = size_map.get(cfg.CAMERA_FRAME_SIZE, sensor.VGA)

        _cam = sensor.OV2640()
        _cam.set_framesize(fs)
        _backend = "sensor"
        print("[cam] initialized (01Studio sensor API)")
        return True
    except Exception as e:
        print(f"[cam] init failed: {e}")
        return False


def capture():
    """Capture a JPEG frame. Returns bytes."""
    if _cam is None:
        raise RuntimeError("Camera not initialized")

    if _backend == "camera":
        return _cam.capture()
    else:
        # 01Studio sensor API — snapshot to file, read back
        _cam.snapshot("/tmp_cap.jpg")
        with open("/tmp_cap.jpg", "rb") as f:
            return f.read()


def capture_b64():
    """Capture a JPEG frame and return as base64 string."""
    import ubinascii
    return ubinascii.b2a_base64(capture()).decode().strip()


def deinit():
    """Release the camera."""
    global _cam, _backend
    if _cam:
        _cam.deinit()
        _cam = None
        _backend = None
