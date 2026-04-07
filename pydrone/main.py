"""
pyDrone BASTION client — main entry point.

Boot sequence:
  1. Initialize LEDs (blue = booting)
  2. Initialize flight controller (if available)
  3. Wait for IMU calibration
  4. Initialize camera
  5. Connect to WiFi (green = connected)
  6. Connect to BASTION bridge
  7. Run telemetry + mission loop
"""

import time
import led
import wifi
import cam
import flight
import bastion_client


def main():
    print("=" * 40)
    print("  pyDrone BASTION Client")
    print("=" * 40)

    # 1. LEDs
    led.init()
    led.blue(True)
    print("[boot] LEDs initialized")

    # 2. Flight controller
    has_flight = flight.init(flightmode=0, debug=0)
    if has_flight:
        # 3. Wait for calibration (blue blinks during cal)
        print("[boot] waiting for IMU calibration...")
        print("[boot] place drone on flat surface")
        if flight.wait_calibration(timeout_ms=30000):
            led.blink("blue", count=3, on_ms=100, off_ms=100)
            print("[boot] calibration OK")
        else:
            led.blink("blue", count=10, on_ms=50, off_ms=50)
            print("[boot] calibration timeout — flight may be unstable")
    else:
        print("[boot] flight controller unavailable (camera-only mode)")

    # 4. Camera
    if cam.init():
        print("[boot] camera OK")
    else:
        print("[boot] camera failed — continuing without camera")

    # 5. WiFi
    try:
        wifi.connect()
        led.green(True)
        led.blue(False)
        print(f"[boot] WiFi OK — {wifi.ip()}")
    except OSError as e:
        print(f"[boot] WiFi failed: {e}")
        led.blink("green", count=5, on_ms=500, off_ms=500)
        return

    # 6-7. Connect to BASTION and run
    print("[boot] connecting to BASTION...")
    led.blue(True)
    led.green(True)

    try:
        bastion_client.connect_and_run()
    except KeyboardInterrupt:
        print("[boot] interrupted")
    finally:
        flight.stop()
        cam.deinit()
        wifi.disconnect()
        led.off()
        print("[boot] shutdown complete")


main()
