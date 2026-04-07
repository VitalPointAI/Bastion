"""
Flight controller wrapper for pyDrone.

Wraps the C-level drone module (only available on 01Studio custom firmware).
Provides a safe no-op fallback when the module is unavailable (e.g. on generic
firmware used for camera-only testing).
"""

_drone = None
_available = False


def init(flightmode=0, debug=0):
    """Initialize the flight controller. Returns True if available."""
    global _drone, _available

    try:
        import drone
        _drone = drone.DRONE(flightmode=flightmode, debug=debug)
        _available = True
        print("[flight] controller initialized")
        return True
    except ImportError:
        print("[flight] drone module not available (camera-only firmware)")
        _available = False
        return False


def is_available():
    return _available


def wait_calibration(timeout_ms=30000):
    """Block until IMU calibration completes. Returns True on success."""
    if not _available:
        return False

    import time
    start = time.ticks_ms()
    while True:
        cal = _drone.read_cal_data()
        if _drone.read_calibrated():
            print(f"[flight] calibrated: {cal}")
            return True
        if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:
            print(f"[flight] calibration timeout: {cal}")
            return False
        time.sleep_ms(100)


def take_off(distance_cm=120):
    """Take off and hover at the given altitude (cm). Range: 30-2000."""
    if not _available:
        return
    _drone.take_off(distance=distance_cm)


def land():
    """Initiate landing (allows continued control during descent)."""
    if not _available:
        return
    _drone.landing()


def stop():
    """Emergency stop — kills motors immediately."""
    if not _available:
        return
    _drone.stop()


def control(rol=0, pit=0, yaw=0, thr=0):
    """Send control input. Each axis: -100 to 100."""
    if not _available:
        return
    _drone.control(rol=rol, pit=pit, yaw=yaw, thr=thr)


def trim():
    """Save trim offsets for level flight."""
    if not _available:
        return
    _drone.trim()


def read_imu():
    """Read accelerometer data. Returns tuple or None."""
    if not _available:
        return None
    return _drone.read_accelerometer()


def read_compass():
    """Read compass data. Returns tuple or None."""
    if not _available:
        return None
    return _drone.read_compass()


def read_pressure():
    """Read barometric pressure. Returns value or None."""
    if not _available:
        return None
    return _drone.read_air_pressure()


def read_states():
    """Read full flight state vector. Returns tuple or None."""
    if not _available:
        return None
    return _drone.read_states()
