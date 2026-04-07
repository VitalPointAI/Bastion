"""
WiFi connection manager for pyDrone.
"""

import network
import time

import config as cfg


_wlan = None


def connect(timeout_ms=15000):
    """Connect to WiFi. Returns the interface on success, raises on timeout."""
    global _wlan
    _wlan = network.WLAN(network.STA_IF)
    _wlan.active(True)

    if _wlan.isconnected():
        print("[wifi] already connected:", _wlan.ifconfig())
        return _wlan

    print(f"[wifi] connecting to {cfg.WIFI_SSID}...")
    _wlan.connect(cfg.WIFI_SSID, cfg.WIFI_PASS)

    start = time.ticks_ms()
    while not _wlan.isconnected():
        if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:
            raise OSError("WiFi connection timeout")
        time.sleep_ms(200)

    print("[wifi] connected:", _wlan.ifconfig())
    return _wlan


def is_connected():
    return _wlan is not None and _wlan.isconnected()


def ip():
    if _wlan and _wlan.isconnected():
        return _wlan.ifconfig()[0]
    return None


def disconnect():
    global _wlan
    if _wlan:
        _wlan.disconnect()
        _wlan.active(False)
        _wlan = None
