"""Test: anti-DOS on 0x0011, commands on 0x000e."""
import pexpect
import struct
import sys
import time

ADDR = sys.argv[1] if len(sys.argv) > 1 else "D4:86:01:19:88:77"
HANDLE_INIT = "0x0011"  # char 00010003 — anti-DOS handshake
HANDLE_API = "0x000e"   # char 00010002 — API commands
ANTIDOS_HEX = "757365746865666f7263652e2e2e62616e64"

SOP, EOP = 0x8D, 0xD8
ESC, ESC_SOP, ESC_EOP, ESC_ESC = 0xAB, 0x05, 0x50, 0x23
SOURCE = 0x01
FLAGS = 0x38  # is_activity + has_target + has_source

def escape(data):
    out = bytearray()
    for b in data:
        if b == SOP: out.extend([ESC, ESC_SOP])
        elif b == EOP: out.extend([ESC, ESC_EOP])
        elif b == ESC: out.extend([ESC, ESC_ESC])
        else: out.append(b)
    return bytes(out)

def build(did, cid, seq, data=b"", target=0x02):
    body = bytes([FLAGS, target, SOURCE, did, cid, seq]) + data
    chk = (~sum(body)) & 0xFF
    escaped = escape(body + bytes([chk]))
    return bytes([SOP]) + escaped + bytes([EOP])

def send(child, handle, pkt_hex, label):
    child.sendline(f"char-write-cmd {handle} {pkt_hex}")
    child.expect(r"\[LE\]>", timeout=3)
    print(f"  [{handle}] {label}")

# Connect
print(f"Connecting to {ADDR}... press RVR+ button NOW")
child = None
for attempt in range(1, 21):
    child = pexpect.spawn(f"gatttool -b {ADDR} -t random -I", timeout=5)
    try:
        child.expect(r"\[LE\]>")
        child.sendline("connect")
        idx = child.expect(["Connection successful", "not connected", pexpect.TIMEOUT], timeout=5)
        if idx == 0:
            print(f"Connected on attempt {attempt}!\n")
            break
    except (pexpect.TIMEOUT, pexpect.EOF):
        pass
    child.close()
    child = None
    time.sleep(1)

if not child:
    print("Failed")
    sys.exit(1)

# Anti-DOS on INIT handle
send(child, HANDLE_INIT, ANTIDOS_HEX, "anti-DOS")
time.sleep(0.5)

# Wake on INIT handle (power commands go to Nordic)
send(child, HANDLE_INIT, build(0x13, 0x0D, 0x01, target=0x01).hex(), "wake")
time.sleep(2)

# Now try API commands on the API handle (0x000e)
print("\n--- Using API handle (0x000e) for commands ---")

# Reset yaw
send(child, HANDLE_API, build(0x16, 0x06, 0x02, target=0x02).hex(), "reset_yaw")
time.sleep(0.5)

# LED green
led = bytes([0xFF]) + bytes([0, 255, 0] * 10)
send(child, HANDLE_API, build(0x1A, 0x1A, 0x03, led, target=0x02).hex(), "LED green")
time.sleep(1)

# Drive forward
drive_data = struct.pack(">BHB", 80, 0, 0)
send(child, HANDLE_API, build(0x16, 0x07, 0x04, drive_data, target=0x02).hex(), "drive speed=80")
print("  Waiting 3 sec...")
time.sleep(3)

# Stop
send(child, HANDLE_API, build(0x16, 0x07, 0x05, struct.pack(">BHB", 0, 0, 0), target=0x02).hex(), "stop")
time.sleep(1)

# Cleanup
child.sendline("disconnect")
child.expect(r"\[LE\]>", timeout=3)
child.sendline("quit")
print("\nDone! Did LEDs and drive work?")
