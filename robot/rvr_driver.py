"""
Thin asyncio wrapper over the Sphero RVR+ SDK.

When SIMULATE=True (from config), all operations are logged instead of
forwarded to real hardware. This allows the full mission stack to be
developed and tested without a physical robot.

The Sphero SDK (sphero-sdk-raspberrypi-python) is NOT installed via pip;
it is installed via git clone on the Jetson. Import is deferred to runtime
so the rest of the codebase can be imported without the SDK present.

Uses SpheroRvrObserver (synchronous/blocking API). The SDK is constructed
and woken in a dedicated thread to avoid "event loop already running"
conflicts. All subsequent SDK calls are dispatched to a thread pool.
"""
from __future__ import annotations

import asyncio
import functools
import math
import threading
import time
from typing import Any, Optional, Tuple

import structlog

log = structlog.get_logger(__name__)


def _init_sdk_in_thread(serial_port: str) -> Any:
    """Construct and wake the SpheroRvrObserver in a dedicated thread.

    The SDK internally calls asyncio.get_event_loop() for firmware checks,
    so we create a throwaway loop for this thread before constructing.

    Returns the rvr instance or None on failure.
    """
    try:
        # SDK internals expect an event loop even in the Observer (sync) API
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        from sphero_sdk.observer.client.dal.serial_observer_dal import SerialObserverDal  # type: ignore

        _orig_init = SerialObserverDal.__init__

        def _patched_init(self_dal, port_id='/dev/ttyS0', baud=115200):
            _orig_init(self_dal, port_id=serial_port, baud=baud)

        SerialObserverDal.__init__ = _patched_init
        try:
            from sphero_sdk import SpheroRvrObserver  # type: ignore
            rvr = SpheroRvrObserver()
        finally:
            SerialObserverDal.__init__ = _orig_init

        rvr.wake()
        time.sleep(2)
        return rvr
    except Exception as exc:  # noqa: BLE001
        log.error("rvr_driver._init_sdk_in_thread.error", error=str(exc))
        return None


class RVRDriver:
    """
    Thin asyncio wrapper over the Sphero RVR+ SDK.

    Provides drive, LED control, and safe-stop operations. Wraps every SDK
    call in try/except so hardware failures never crash the mission client.

    The SDK is initialized in a dedicated thread to avoid event-loop
    conflicts, and all subsequent calls use run_in_executor.

    Args:
        serial_port: Serial device path (e.g. /dev/ttyTHS1).
        simulate: When True, log actions instead of calling the real SDK.
    """

    def __init__(self, serial_port: str, simulate: bool = False) -> None:
        self._serial_port = serial_port
        self._simulate = simulate
        self._rvr: Any = None  # SpheroRvrObserver instance

        # Dead-reckoning state
        self._position: Tuple[float, float] = (0.0, 0.0)  # (x, y) room meters
        self._heading: float = 0.0  # degrees, 0 = north
        self._battery_pct: int = 100

    def set_position(self, x: float, y: float) -> None:
        """Set the robot's current position (used to sync with map coordinates)."""
        self._position = (x, y)
        log.info("rvr_driver.position_set", x=x, y=y)

    # ------------------------------------------------------------------
    # Helper: run blocking SDK call in executor
    # ------------------------------------------------------------------

    async def _run(self, fn: Any, *args: Any, **kwargs: Any) -> Any:
        """Run a blocking SDK function in the default thread pool executor."""
        loop = asyncio.get_running_loop()
        call = functools.partial(fn, *args, **kwargs)
        return await loop.run_in_executor(None, call)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def wake(self) -> None:
        """Wake the RVR+ and wait for it to become ready."""
        if self._simulate:
            log.info("rvr_driver.wake", simulate=True)
            await asyncio.sleep(0.1)
            return

        log.info("rvr_driver.wake.calling", serial_port=self._serial_port)
        try:
            # Run SDK construction + wake in a plain thread (no asyncio loop)
            # to avoid "This event loop is already running" from the SDK internals.
            result: list = [None]
            error: list = [None]

            def _thread_target():
                try:
                    result[0] = _init_sdk_in_thread(self._serial_port)
                except Exception as exc:  # noqa: BLE001
                    error[0] = exc

            t = threading.Thread(target=_thread_target, daemon=True, name="sphero-init")
            t.start()
            # Wait up to 15 seconds for init
            await asyncio.get_running_loop().run_in_executor(
                None, lambda: t.join(timeout=15.0)
            )

            if t.is_alive():
                log.error("rvr_driver.wake.timeout", serial_port=self._serial_port,
                          msg="SDK init did not complete within 15s")
                # Thread is stuck but daemon so it won't block shutdown
                return

            if error[0]:
                log.error("rvr_driver.wake.error", error=str(error[0]))
                return

            if result[0] is None:
                log.error("rvr_driver.wake.error", error="SDK init returned None")
                return

            self._rvr = result[0]
            log.info("rvr_driver.wake.ok", serial_port=self._serial_port)
        except Exception as exc:  # noqa: BLE001
            log.error("rvr_driver.wake.error", error=str(exc))
            self._rvr = None

    async def close(self) -> None:
        """Cleanly close the connection to the RVR+."""
        if self._simulate:
            log.info("rvr_driver.close", simulate=True)
            return

        if self._rvr is not None:
            try:
                await self._run(self._rvr.close)
                log.info("rvr_driver.close")
            except Exception as exc:  # noqa: BLE001
                log.error("rvr_driver.close.error", error=str(exc))

    # ------------------------------------------------------------------
    # Movement
    # ------------------------------------------------------------------

    async def drive(self, speed: int, heading: float, duration_sec: float) -> None:
        """
        Drive at a fixed speed and heading for a set duration, then stop.

        Args:
            speed: Motor speed 0-255.
            heading: Direction in degrees (0=north, 90=east).
            duration_sec: How long to drive before stopping.
        """
        if self._simulate:
            log.info(
                "rvr_driver.drive",
                speed=speed,
                heading=heading,
                duration_sec=duration_sec,
                simulate=True,
            )
            # Update simulated position via dead-reckoning
            # Approximate: 128 speed ≈ 0.5 m/s
            speed_ms = (speed / 255) * 1.0  # up to 1 m/s
            rad = math.radians(heading)
            dx = math.sin(rad) * speed_ms * duration_sec
            dy = math.cos(rad) * speed_ms * duration_sec
            self._position = (self._position[0] + dx, self._position[1] + dy)
            self._heading = heading
            await asyncio.sleep(duration_sec)
            return

        try:
            self._heading = heading
            if self._rvr:
                log.info("rvr_driver.drive.sending", speed=speed, heading=heading)
                await self._run(
                    self._rvr.drive_with_heading,
                    speed=int(speed),
                    heading=int(heading),
                    flags=0,
                )
            else:
                log.warning("rvr_driver.drive.no_rvr", msg="SDK not initialized, skipping")
            await asyncio.sleep(duration_sec)
            # Update dead-reckoning position (same formula as simulate mode)
            speed_ms = (speed / 255) * 1.0
            rad = math.radians(heading)
            dx = math.sin(rad) * speed_ms * duration_sec
            dy = math.cos(rad) * speed_ms * duration_sec
            self._position = (self._position[0] + dx, self._position[1] + dy)
            await self.safe_stop()
        except Exception as exc:  # noqa: BLE001
            log.error("rvr_driver.drive.error", error=str(exc))
            await self.safe_stop()

    async def drive_to_point(self, x: float, y: float, speed: int) -> None:
        """
        Drive toward a room-relative target using simple dead-reckoning.

        Calculates the heading from the current position to the target, then
        drives for an estimated duration based on distance and speed.

        Args:
            x: Target x position in room meters.
            y: Target y position in room meters.
            speed: Motor speed 0-255.
        """
        cx, cy = self._position
        dx = x - cx
        dy = y - cy
        distance = math.sqrt(dx**2 + dy**2)

        if distance < 0.05:  # Already at target
            log.info("rvr_driver.drive_to_point.already_at_target", x=x, y=y)
            return

        # Heading: atan2(east, north) → degrees from north
        heading = math.degrees(math.atan2(dx, dy)) % 360

        # Estimated travel time: speed 128 ≈ 0.5 m/s, speed 255 ≈ 1.0 m/s
        speed_ms = max(0.1, (speed / 255) * 1.0)
        duration = distance / speed_ms

        log.info(
            "rvr_driver.drive_to_point",
            target_x=x,
            target_y=y,
            heading=round(heading, 1),
            distance_m=round(distance, 2),
            duration_sec=round(duration, 2),
        )

        await self.drive(speed=speed, heading=heading, duration_sec=duration)
        # Update dead-reckoning position to target after drive completes
        self._position = (x, y)

    async def face_toward(self, x: float, y: float) -> None:
        """
        Rotate in place to face a target position without driving forward.

        Sends a zero-speed drive command at the computed heading so the robot
        orients its camera toward the target.
        """
        cx, cy = self._position
        dx = x - cx
        dy = y - cy
        distance = math.sqrt(dx**2 + dy**2)
        if distance < 0.01:
            return  # target is at our position

        heading = math.degrees(math.atan2(dx, dy)) % 360
        log.info("rvr_driver.face_toward", target_x=x, target_y=y, heading=round(heading, 1))

        self._heading = heading
        if not self._simulate and self._rvr:
            # Brief drive at speed 0 with heading sets orientation
            await self._run(
                self._rvr.drive_with_heading,
                speed=0,
                heading=int(heading),
                flags=0,
            )
            await asyncio.sleep(0.5)  # allow time to rotate

    # ------------------------------------------------------------------
    # LEDs
    # ------------------------------------------------------------------

    async def set_leds(self, r: int, g: int, b: int) -> None:
        """Set all RVR+ LEDs to a solid color."""
        if self._simulate:
            log.info("rvr_driver.set_leds", r=r, g=g, b=b, simulate=True)
            return

        try:
            if self._rvr:
                # RVR+ has multiple LED groups; set all to the same color
                await self._run(
                    self._rvr.set_all_leds,
                    led_group=0xFF,
                    led_brightness_values=[r, g, b] * 10,  # 10 LED groups × 3 channels
                )
        except Exception as exc:  # noqa: BLE001
            log.error("rvr_driver.set_leds.error", error=str(exc))

    async def flash_leds(
        self, r: int, g: int, b: int, count: int = 3, interval: float = 0.3
    ) -> None:
        """
        Flash all RVR+ LEDs a given number of times.

        Args:
            r, g, b: Flash color (0-255).
            count: Number of on/off cycles.
            interval: Duration of each on and off phase in seconds.
        """
        for _ in range(count):
            await self.set_leds(r, g, b)
            await asyncio.sleep(interval)
            await self.set_leds(0, 0, 0)
            await asyncio.sleep(interval)

    # ------------------------------------------------------------------
    # Safety
    # ------------------------------------------------------------------

    async def safe_stop(self) -> None:
        """Immediately stop all motors."""
        if self._simulate:
            log.info("rvr_driver.safe_stop", simulate=True)
            return

        try:
            if self._rvr:
                await self._run(
                    self._rvr.drive_with_heading,
                    speed=0,
                    heading=int(self._heading),
                    flags=0,
                )
        except Exception as exc:  # noqa: BLE001
            log.error("rvr_driver.safe_stop.error", error=str(exc))

    # ------------------------------------------------------------------
    # Sensors
    # ------------------------------------------------------------------

    async def get_battery_pct(self) -> int:
        """
        Return the current battery percentage.

        Returns a simulated value if the sensor is unavailable or if
        running in simulate mode.
        """
        if self._simulate:
            return self._battery_pct

        try:
            if self._rvr is None:
                return self._battery_pct

            # Observer API uses callbacks; bridge with threading.Event
            result_holder: dict = {}
            done = threading.Event()

            def _handler(percentage: dict) -> None:
                result_holder.update(percentage)
                done.set()

            await self._run(self._rvr.get_battery_percentage, handler=_handler)
            # Wait up to 2 seconds for the callback
            got = await asyncio.get_running_loop().run_in_executor(
                None, lambda: done.wait(timeout=2.0)
            )
            if got and "percentage" in result_holder:
                pct = int(result_holder["percentage"])
                self._battery_pct = pct
                return pct
            return self._battery_pct
        except Exception as exc:  # noqa: BLE001
            log.warning("rvr_driver.get_battery_pct.error", error=str(exc))
            return self._battery_pct

    # ------------------------------------------------------------------
    # State accessors (used by telemetry loop)
    # ------------------------------------------------------------------

    @property
    def position(self) -> Tuple[float, float]:
        """Current (x, y) position in room meters (dead-reckoning)."""
        return self._position

    @property
    def heading(self) -> float:
        """Current heading in degrees (0 = north)."""
        return self._heading
