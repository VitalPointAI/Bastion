"""
LED status indicators for pyDrone.
"""

import machine
import config as cfg

_blue = None
_green = None


def init():
    global _blue, _green
    _blue = machine.Pin(cfg.LED_BLUE, machine.Pin.OUT)
    _green = machine.Pin(cfg.LED_GREEN, machine.Pin.OUT)
    off()


def blue(on=True):
    if _blue:
        _blue.value(1 if on else 0)


def green(on=True):
    if _green:
        _green.value(1 if on else 0)


def off():
    blue(False)
    green(False)


def blink(color="blue", count=3, on_ms=200, off_ms=200):
    """Blink an LED for status indication."""
    import time
    fn = blue if color == "blue" else green
    for _ in range(count):
        fn(True)
        time.sleep_ms(on_ms)
        fn(False)
        time.sleep_ms(off_ms)
