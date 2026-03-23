"""
BLE driver for Sphero RVR+ follower robots via gatttool.

Controls RVR+ units over Bluetooth Low Energy using the Sphero V2 protocol.
Uses gatttool (via pexpect) since bleak's BlueZ dbus backend cannot reliably
complete GATT discovery before the RVR+ drops the connection.

The connection flow:
  1. gatttool interactive mode with random address type
  2. Retry connect until RVR+ responds (short advertising window)
  3. Send anti-DOS string on handle 0x0011
  4. Send wake command
  5. All subsequent commands also go to handle 0x0011

Sphero V2 packet: [SOP=0x8D] [FLAGS] [TGT] [SRC] [DID] [CID] [SEQ] [DATA...] [CHK] [EOP=0xD8]
"""
from __future__ import annotations

import asyncio
import math
import struct
from typing import Any, Dict, List, Optional, Tuple

import pexpect
import structlog

log = structlog.get_logger(__name__)

# ── Sphero V2 Protocol Constants ─────────────────────────────────────────────

SOP = 0x8D
EOP = 0xD8

# Flags
FLAGS_CMD = 0x38  # is_activity(0x08) + has_target(0x10) + has_source(0x20) — no response requested

# Targets
TARGET_NORDIC = 0x01   # Nordic BLE processor (power, connection)
TARGET_ST = 0x02       # ST MCU (drive, sensors, LEDs)
SOURCE = 0x01          # We are the controller

# Device IDs
DID_POWER = 0x13
DID_DRIVE = 0x16
DID_IO = 0x1A

# Command IDs
CID_WAKE = 0x0D
CID_DRIVE_WITH_HEADING = 0x07
CID_RESET_YAW = 0x06
CID_SET_ALL_LEDS = 0x1A

# BLE handles (from GATT discovery)
HANDLE_CMD = "0x000e"   # Characteristic 00010002 — ALL commands (anti-DOS, wake, drive)
HANDLE_NOTIFY_CCCD = "0x000f"  # CCCD for 0x000e notifications
HANDLE_NOTIFY2_CCCD = "0x0012"  # CCCD for 0x0011 notifications

# Anti-DOS string (hex-encoded)
ANTIDOS_HEX = "757365746865666f7263652e2e2e62616e64"  # "usetheforce...band"

# Connection
MAX_CONNECT_RETRIES = 5
RETRY_DELAY = 1.0


ESC = 0xAB
ESC_SOP = 0x05
ESC_EOP = 0x50
ESC_ESC = 0x23


def _escape(data: bytes) -> bytes:
    """Escape special bytes in the packet body."""
    out = bytearray()
    for b in data:
        if b == SOP:
            out.extend([ESC, ESC_SOP])
        elif b == EOP:
            out.extend([ESC, ESC_EOP])
        elif b == ESC:
            out.extend([ESC, ESC_ESC])
        else:
            out.append(b)
    return bytes(out)


def _build_packet(did: int, cid: int, seq: int, data: bytes = b"",
                  target: int = TARGET_ST) -> bytes:
    """Build a Sphero V2 command packet with proper escaping."""
    body = bytes([FLAGS_CMD, target, SOURCE, did, cid, seq]) + data
    chk = (~sum(body)) & 0xFF
    escaped = _escape(body + bytes([chk]))
    return bytes([SOP]) + escaped + bytes([EOP])


async def scan_for_rvr_plus(timeout: float = 10.0) -> List[Dict[str, str]]:
    """Scan for RVR+ devices via BLE using hcitool/bluetoothctl.

    Returns list of dicts with 'address' and 'name' keys.
    """
    loop = asyncio.get_running_loop()

    def _scan():
        import subprocess
        result = subprocess.run(
            ["bluetoothctl", "scan", "on"],
            capture_output=True, text=True, timeout=timeout + 2,
        )
        # This won't work well; use a different approach
        return []

    # Use bleak just for scanning (it works for discovery, just not connect)
    try:
        from bleak import BleakScanner
        devices = await BleakScanner.discover(timeout=timeout)
        rvr_devices = []
        for d in devices:
            name = d.name or ""
            if name.startswith("RV-") or name.startswith("SB-") or "RVR" in name.upper():
                rvr_devices.append({"address": d.address, "name": name})
                log.info("ble_rvr.found", address=d.address, name=name)
        log.info("ble_rvr.scan_complete", found=len(rvr_devices))
        return rvr_devices
    except Exception as exc:
        log.error("ble_rvr.scan_error", error=str(exc))
        return []


class BLERVRDriver:
    """
    Controls a Sphero RVR+ over BLE using gatttool.

    Same API surface as RVRDriver (UART) so it can be used interchangeably.

    Args:
        address: BLE MAC address (e.g. "D4:86:01:19:88:77").
        name: Human-readable name for logging.
    """

    def __init__(self, address: str, name: str = "ble-rvr") -> None:
        self._address = address
        self._name = name
        self._child: Optional[pexpect.spawn] = None
        self._seq = 0
        self._connected = False
        self._lock = asyncio.Lock()

        self._keepalive_task: Optional[asyncio.Task] = None

        # Dead-reckoning state
        self._position: Tuple[float, float] = (0.0, 0.0)
        self._heading: float = 0.0
        self._battery_pct: int = 100

    def _next_seq(self) -> int:
        seq = self._seq
        self._seq = (self._seq + 1) & 0xFF
        return seq

    async def _send_raw(self, hex_data: str, handle: str = HANDLE_CMD) -> bool:
        """Write hex data to a BLE handle via gatttool."""
        if not self._connected or not self._child:
            log.warning("ble_rvr.send_raw.no_connection", name=self._name,
                        connected=self._connected, has_child=self._child is not None)
            return False

        loop = asyncio.get_running_loop()

        def _write():
            try:
                self._child.sendline(f"char-write-cmd {handle} {hex_data}")
                self._child.expect(r"\[LE\]>", timeout=3)
                return True
            except (pexpect.TIMEOUT, pexpect.EOF) as exc:
                log.warning("ble_rvr.send_raw.failed", name=self._name, error=str(exc))
                return False

        async with self._lock:
            ok = await loop.run_in_executor(None, _write)
            if not ok and handle == HANDLE_CMD:
                # Connection likely dropped — attempt reconnect
                log.warning("ble_rvr.connection_lost", name=self._name)
                self._connected = False
                await self._reconnect()
                if self._connected:
                    ok = await loop.run_in_executor(None, _write)
            return ok

    async def _reconnect(self) -> None:
        """Attempt to reconnect to the RVR+ after a connection drop."""
        log.info("ble_rvr.reconnecting", name=self._name, address=self._address)
        if self._child:
            try:
                self._child.close()
            except Exception:
                pass
            self._child = None

        loop = asyncio.get_running_loop()

        def _connect():
            for attempt in range(1, 10):
                child = pexpect.spawn(
                    f"gatttool -b {self._address} -t random -I",
                    timeout=5,
                )
                try:
                    child.expect(r"\[LE\]>")
                    child.sendline("connect")
                    idx = child.expect(
                        ["Connection successful", "not connected", pexpect.TIMEOUT],
                        timeout=5,
                    )
                    if idx == 0:
                        log.info("ble_rvr.reconnected", name=self._name, attempt=attempt)
                        return child
                except (pexpect.TIMEOUT, pexpect.EOF):
                    pass
                child.close()
                import time
                time.sleep(RETRY_DELAY)
            return None

        child = await loop.run_in_executor(None, _connect)
        if child:
            self._child = child
            self._connected = True
            # Enable notifications first
            await self._send_raw("0100", HANDLE_NOTIFY_CCCD)
            await self._send_raw("0100", HANDLE_NOTIFY2_CCCD)
            await asyncio.sleep(0.3)
            # Re-send anti-DOS
            await self._send_raw(ANTIDOS_HEX, HANDLE_CMD)
            await asyncio.sleep(0.3)
            # Re-send wake
            seq = self._next_seq()
            wake_pkt = _build_packet(DID_POWER, CID_WAKE, seq, target=TARGET_NORDIC)
            await self._send_raw(wake_pkt.hex(), HANDLE_CMD)
            await asyncio.sleep(1)
            # Reset yaw
            await self._send_packet(DID_DRIVE, CID_RESET_YAW, b"", TARGET_ST)
            await asyncio.sleep(0.3)
        else:
            log.error("ble_rvr.reconnect_failed", name=self._name)

    async def start_keepalive(self, interval: float = 15.0) -> None:
        """Periodically ping the RVR+ to keep the BLE connection alive."""
        self._keepalive_task = asyncio.create_task(self._keepalive_loop(interval))

    async def _keepalive_loop(self, interval: float) -> None:
        """Send a periodic LED pulse to keep the connection active."""
        while self._connected:
            try:
                await asyncio.sleep(interval)
                if not self._connected:
                    break
                # Send a no-op LED set (dim blue) as keepalive
                led = bytes([0xFF]) + bytes([0, 0, 10] * 10)
                ok = await self._send_packet(DID_IO, CID_SET_ALL_LEDS, led, TARGET_ST)
                if not ok:
                    log.warning("ble_rvr.keepalive.failed", name=self._name)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                log.warning("ble_rvr.keepalive.error", name=self._name, error=str(exc))

    async def _send_packet(self, did: int, cid: int, data: bytes = b"",
                           target: int = TARGET_ST) -> bool:
        """Build and send a Sphero V2 command packet."""
        seq = self._next_seq()
        packet = _build_packet(did, cid, seq, data, target)
        return await self._send_raw(packet.hex())

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def wake(self) -> None:
        """Connect to the RVR+ via BLE and wake it.

        Retries connection since the RVR+ has a short BLE advertising window.
        """
        loop = asyncio.get_running_loop()

        def _connect():
            for attempt in range(1, MAX_CONNECT_RETRIES + 1):
                child = pexpect.spawn(
                    f"gatttool -b {self._address} -t random -I",
                    timeout=5,
                )
                try:
                    child.expect(r"\[LE\]>")
                    child.sendline("connect")
                    idx = child.expect(
                        ["Connection successful", "not connected", pexpect.TIMEOUT],
                        timeout=5,
                    )
                    if idx == 0:
                        log.info("ble_rvr.connected", name=self._name,
                                 address=self._address, attempt=attempt)
                        return child
                    else:
                        log.debug("ble_rvr.connect_retry", name=self._name,
                                  attempt=attempt)
                except (pexpect.TIMEOUT, pexpect.EOF):
                    log.debug("ble_rvr.connect_retry", name=self._name,
                              attempt=attempt)
                child.close()
                import time
                time.sleep(RETRY_DELAY)
            return None

        log.info("ble_rvr.connecting", name=self._name, address=self._address)
        child = await loop.run_in_executor(None, _connect)

        if child is None:
            log.error("ble_rvr.wake.error", name=self._name,
                      error=f"Failed after {MAX_CONNECT_RETRIES} attempts")
            return

        self._child = child
        self._connected = True

        # Enable notifications BEFORE anti-DOS (required for BLE command channel)
        await self._send_raw("0100", HANDLE_NOTIFY_CCCD)
        await self._send_raw("0100", HANDLE_NOTIFY2_CCCD)
        await asyncio.sleep(0.3)

        # Anti-DOS on command handle
        await self._send_raw(ANTIDOS_HEX, HANDLE_CMD)
        await asyncio.sleep(0.5)
        log.info("ble_rvr.antidos_sent", name=self._name)

        # Wake
        seq = self._next_seq()
        wake_pkt = _build_packet(DID_POWER, CID_WAKE, seq, target=TARGET_NORDIC)
        await self._send_raw(wake_pkt.hex(), HANDLE_CMD)
        await asyncio.sleep(2)

        # Reset yaw so heading=0 means current facing direction
        await self._send_packet(DID_DRIVE, CID_RESET_YAW, b"", TARGET_ST)
        await asyncio.sleep(0.5)

        # Start keepalive to prevent BLE timeout disconnect
        await self.start_keepalive(interval=10.0)

        log.info("ble_rvr.wake.ok", name=self._name)

    async def close(self) -> None:
        """Disconnect from the RVR+."""
        if self._keepalive_task:
            self._keepalive_task.cancel()
            self._keepalive_task = None
        if self._child and self._connected:
            try:
                await self.safe_stop()
                loop = asyncio.get_running_loop()

                def _disconnect():
                    try:
                        self._child.sendline("disconnect")
                        self._child.expect(r"\[LE\]>", timeout=3)
                        self._child.sendline("quit")
                    except (pexpect.TIMEOUT, pexpect.EOF):
                        pass
                    self._child.close()

                await loop.run_in_executor(None, _disconnect)
                log.info("ble_rvr.close", name=self._name)
            except Exception as exc:
                log.error("ble_rvr.close.error", name=self._name, error=str(exc))
        self._connected = False
        self._child = None

    # ------------------------------------------------------------------
    # Movement
    # ------------------------------------------------------------------

    async def drive(self, speed: int, heading: float, duration_sec: float) -> None:
        """Drive at speed/heading for duration, then stop."""
        if not self._connected:
            log.warning("ble_rvr.drive.not_connected", name=self._name)
            return

        try:
            self._heading = heading
            data = struct.pack(">BHB", int(speed) & 0xFF, int(heading) % 360, 0)
            ok = await self._send_packet(DID_DRIVE, CID_DRIVE_WITH_HEADING, data, TARGET_ST)
            log.info("ble_rvr.drive.sent", name=self._name, speed=speed, heading=heading, ok=ok)

            # Dead-reckoning
            speed_ms = (speed / 255) * 1.0
            rad = math.radians(heading)
            dx = math.sin(rad) * speed_ms * duration_sec
            dy = math.cos(rad) * speed_ms * duration_sec
            self._position = (self._position[0] + dx, self._position[1] + dy)

            await asyncio.sleep(duration_sec)
            await self.safe_stop()
        except asyncio.CancelledError:
            log.info("ble_rvr.drive.cancelled", name=self._name)
            await self.safe_stop()
            raise
        except Exception as exc:
            log.error("ble_rvr.drive.error", name=self._name, error=str(exc))
            await self.safe_stop()

    async def drive_to_point(self, x: float, y: float, speed: int) -> None:
        """Drive toward a target using dead-reckoning."""
        cx, cy = self._position
        dx = x - cx
        dy = y - cy
        distance = math.sqrt(dx**2 + dy**2)

        if distance < 0.05:
            return

        heading = math.degrees(math.atan2(dx, dy)) % 360
        speed_ms = max(0.1, (speed / 255) * 1.0)
        duration = distance / speed_ms

        log.info("ble_rvr.drive_to_point", name=self._name,
                 target_x=x, target_y=y, heading=round(heading, 1),
                 distance_m=round(distance, 2))

        await self.drive(speed=speed, heading=heading, duration_sec=duration)
        self._position = (x, y)

    # ------------------------------------------------------------------
    # LEDs
    # ------------------------------------------------------------------

    async def set_leds(self, r: int, g: int, b: int) -> None:
        """Set all LEDs to a solid color."""
        if not self._connected:
            return
        try:
            led_data = bytes([0xFF]) + bytes([r & 0xFF, g & 0xFF, b & 0xFF] * 10)
            await self._send_packet(DID_IO, CID_SET_ALL_LEDS, led_data, TARGET_ST)
        except Exception as exc:
            log.error("ble_rvr.set_leds.error", name=self._name, error=str(exc))

    async def flash_leds(
        self, r: int, g: int, b: int, count: int = 3, interval: float = 0.3
    ) -> None:
        """Flash LEDs a given number of times."""
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
        if not self._connected:
            return
        try:
            data = struct.pack(">BHB", 0, int(self._heading) % 360, 0)
            await self._send_packet(DID_DRIVE, CID_DRIVE_WITH_HEADING, data, TARGET_ST)
        except Exception as exc:
            log.error("ble_rvr.safe_stop.error", name=self._name, error=str(exc))

    # ------------------------------------------------------------------
    # Sensors
    # ------------------------------------------------------------------

    async def get_battery_pct(self) -> int:
        """Return cached battery percentage (BLE read not yet implemented)."""
        return self._battery_pct

    # ------------------------------------------------------------------
    # State accessors
    # ------------------------------------------------------------------

    @property
    def position(self) -> Tuple[float, float]:
        return self._position

    @position.setter
    def position(self, value: Tuple[float, float]) -> None:
        self._position = value

    @property
    def heading(self) -> float:
        return self._heading

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def name(self) -> str:
        return self._name

    @property
    def address(self) -> str:
        return self._address


# ── CLI test ─────────────────────────────────────────────────────────────────

async def _test_main():
    import sys
    addr = sys.argv[1] if len(sys.argv) > 1 else "D4:86:01:19:88:77"
    name = sys.argv[2] if len(sys.argv) > 2 else "test-rvr"

    print(f"Connecting to {addr}...")
    print("Press the RVR+ power button if needed.\n")

    driver = BLERVRDriver(address=addr, name=name)
    await driver.wake()

    if not driver.connected:
        print("Failed to connect.")
        return

    print("Flashing green...")
    await driver.flash_leds(0, 255, 0, count=3)

    print("Driving forward (speed 60, 2 sec)...")
    await driver.drive(speed=60, heading=0, duration_sec=2.0)

    print("Closing...")
    await driver.close()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(_test_main())
