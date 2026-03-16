"""
BLE Follower Manager — manages headless RVR+ followers via Bluetooth.

When follower RVR+ units don't have their own compute (no Orin Nano),
the swarm leader controls them directly over BLE. This module:

1. Scans for available RVR+ units via BLE
2. Connects and wakes each follower
3. Provides a unified interface for the SwarmCoordinator to dispatch
   drive commands to all followers in parallel
4. Reports follower battery levels in swarm telemetry

Usage:
    manager = BLEFollowerManager()
    await manager.scan_and_connect()       # Find and connect to RVR+ units
    await manager.drive_all_to_slots(...)  # Move all followers to formation slots
"""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional, Tuple

import structlog

from ..ble_rvr_driver import BLERVRDriver, scan_for_rvr_plus

log = structlog.get_logger(__name__)


class BLEFollower:
    """A BLE-connected follower with its driver and swarm metadata."""

    def __init__(self, driver: BLERVRDriver, slot_index: int = -1) -> None:
        self.driver = driver
        self.slot_index = slot_index
        self.robot_id = f"ble-{driver.name}"


class BLEFollowerManager:
    """
    Manages a fleet of BLE-connected RVR+ followers.

    The leader's SwarmCoordinator computes formation geometry and calls
    this manager to dispatch drive commands to all followers in parallel.

    Args:
        exclude_addresses: BLE addresses to skip during scan (e.g. the leader).
        max_followers: Maximum number of followers to connect.
    """

    def __init__(
        self,
        exclude_addresses: Optional[List[str]] = None,
        max_followers: int = 8,
    ) -> None:
        self._exclude = set(a.upper() for a in (exclude_addresses or []))
        self._max_followers = max_followers
        self._followers: Dict[str, BLEFollower] = {}  # keyed by BLE address

    @property
    def followers(self) -> List[BLEFollower]:
        return list(self._followers.values())

    @property
    def count(self) -> int:
        return len(self._followers)

    @property
    def connected_count(self) -> int:
        return sum(1 for f in self._followers.values() if f.driver.connected)

    def get_follower_by_slot(self, slot_index: int) -> Optional[BLEFollower]:
        """Get follower assigned to a formation slot."""
        for f in self._followers.values():
            if f.slot_index == slot_index:
                return f
        return None

    # ------------------------------------------------------------------
    # Discovery & Connection
    # ------------------------------------------------------------------

    async def scan_and_connect(self, scan_timeout: float = 15.0) -> int:
        """Scan for RVR+ devices and connect to each one.

        Returns:
            Number of successfully connected followers.
        """
        devices = await scan_for_rvr_plus(timeout=scan_timeout)

        # Filter out excluded addresses and limit count
        candidates = [
            d for d in devices
            if d["address"].upper() not in self._exclude
        ][:self._max_followers]

        if not candidates:
            log.warning("ble_follower_mgr.no_devices_found")
            return 0

        log.info("ble_follower_mgr.connecting", count=len(candidates))

        # Connect to all candidates in parallel
        tasks = []
        for i, dev in enumerate(candidates):
            name = dev.get("name", f"rvr-{i+1}")
            driver = BLERVRDriver(address=dev["address"], name=name)
            tasks.append(self._connect_one(driver, dev["address"], slot_index=i + 1))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        connected = sum(1 for r in results if r is True)
        log.info("ble_follower_mgr.scan_complete",
                 found=len(candidates), connected=connected)
        return connected

    async def _connect_one(self, driver: BLERVRDriver, address: str, slot_index: int) -> bool:
        """Connect to a single follower."""
        try:
            await driver.wake()
            if driver.connected:
                follower = BLEFollower(driver=driver, slot_index=slot_index)
                self._followers[address] = follower
                # Flash green to confirm connection
                await driver.flash_leds(0, 255, 0, count=2, interval=0.2)
                log.info("ble_follower_mgr.connected",
                         name=driver.name, address=address, slot=slot_index)
                return True
            return False
        except Exception as exc:
            log.error("ble_follower_mgr.connect_error",
                      address=address, error=str(exc))
            return False

    async def connect_by_address(self, address: str, name: str = "rvr", slot_index: int = 1) -> bool:
        """Connect to a specific RVR+ by BLE address.

        Useful when you already know the addresses of your followers.
        """
        driver = BLERVRDriver(address=address, name=name)
        return await self._connect_one(driver, address, slot_index)

    # ------------------------------------------------------------------
    # Slot Assignment
    # ------------------------------------------------------------------

    def assign_slots(self, slot_assignments: Dict[str, int]) -> None:
        """Assign followers to formation slots.

        Args:
            slot_assignments: Maps BLE address → slot index.
        """
        for address, slot in slot_assignments.items():
            if address in self._followers:
                self._followers[address].slot_index = slot

    def auto_assign_slots(self, start_index: int = 1) -> None:
        """Auto-assign slot indices starting from start_index."""
        for i, follower in enumerate(self._followers.values()):
            follower.slot_index = start_index + i

    # ------------------------------------------------------------------
    # Movement Commands
    # ------------------------------------------------------------------

    async def drive_follower_to(
        self, slot_index: int, x: float, y: float, speed: int
    ) -> None:
        """Drive a specific follower (by slot index) to a position."""
        follower = self.get_follower_by_slot(slot_index)
        if follower and follower.driver.connected:
            await follower.driver.drive_to_point(x, y, speed)

    async def drive_all_to_slots(
        self,
        slot_positions: Dict[int, Tuple[float, float]],
        speed: int = 100,
    ) -> None:
        """Drive all followers to their formation slot positions in parallel.

        Args:
            slot_positions: Maps slot_index → (x, y) world position.
            speed: Motor speed 0-255.
        """
        tasks = []
        for slot_idx, (x, y) in slot_positions.items():
            follower = self.get_follower_by_slot(slot_idx)
            if follower and follower.driver.connected:
                tasks.append(follower.driver.drive_to_point(x, y, speed))

        if tasks:
            log.info("ble_follower_mgr.drive_all",
                     slots=len(tasks), speed=speed)
            await asyncio.gather(*tasks, return_exceptions=True)

    async def set_all_leds(self, r: int, g: int, b: int) -> None:
        """Set LED color on all connected followers."""
        tasks = [
            f.driver.set_leds(r, g, b)
            for f in self._followers.values()
            if f.driver.connected
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def stop_all(self) -> None:
        """Emergency stop all followers."""
        tasks = [
            f.driver.safe_stop()
            for f in self._followers.values()
            if f.driver.connected
        ]
        if tasks:
            log.info("ble_follower_mgr.stop_all")
            await asyncio.gather(*tasks, return_exceptions=True)

    # ------------------------------------------------------------------
    # Telemetry
    # ------------------------------------------------------------------

    async def get_all_battery(self) -> Dict[str, int]:
        """Get battery percentages for all followers.

        Returns:
            Maps follower name → battery percentage.
        """
        result = {}
        for f in self._followers.values():
            if f.driver.connected:
                pct = await f.driver.get_battery_pct()
                result[f.driver.name] = pct
        return result

    def get_all_positions(self) -> Dict[int, Tuple[float, float]]:
        """Get dead-reckoned positions for all followers.

        Returns:
            Maps slot_index → (x, y).
        """
        return {
            f.slot_index: f.driver.position
            for f in self._followers.values()
            if f.driver.connected
        }

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def disconnect_all(self) -> None:
        """Disconnect all followers."""
        tasks = [f.driver.close() for f in self._followers.values()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._followers.clear()
        log.info("ble_follower_mgr.disconnected_all")
