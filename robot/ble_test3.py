"""Test drive with correct SDK flags."""
import pexpect
import struct
import sys
import time

ADDR = sys.argv[1] if len(sys.argv) > 1 else "D4:86:01:19:88:77"
HANDLE = "0x0011"
ANTIDOS_HEX = "757365746865666f7263652e2e2e62616e64"

SOP, EOP = 0x8D, 0xD8
ESC, ESC_SOP, ESC_EOP, ESC_ESC = 0xAB, 0x05, 0x50, 0x23
SOURCE = 0x01

# SDK flags: is_activity(0x08) + has_target(0x10) + has_source(0x20) = 0x38
FLAGS_ACTIVITY = 0x38
# For commands wanting response: add requests_response(0x02) = 0x3A
FLAGS_WITH_RESPONSE = 0x3A

def escape(data):
    out = bytearray()
    for b in data:
        if b == SOP: out.extend([ESC, ESC_SOP])
        elif b == EOP: out.extend([ESC, ESC_EOP])
        elif b == ESC: out.extend([ESC, ESC_ESC])
        else: out.append(b)
    return bytes(out)

def build(did, cid, seq, data=b"", target=0x02, flags=FLAGS_ACTIVITY):
    body = bytes([flags, target, SOURCE, did, cid, seq]) + data
    chk = (~sum(body)) & 0xFF
    escaped = escape(body + bytes([chk]))
    return bytes([SOP]) + escaped + bytes([EOP])

def send(child, pkt_hex, label):
    child.sendline(f"char-write-cmd {HANDLE} {pkt_hex}")
    child.expect(r"\[LE\]>", timeout=3)
    print(f"  Sent: {label}")

# Connect with retry
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
    print("Failed to connect")
    sys.exit(1)

# Anti-DOS
send(child, ANTIDOS_HEX, "anti-DOS")
time.sleep(0.5)

# Wake (Power device=0x13, Wake=0x0D, target=Nordic=0x01)
send(child, build(0x13, 0x0D, 0x01, target=0x01).hex(), "wake")
time.sleep(2)

# Reset yaw (Drive device=0x16, reset_yaw=0x06, target=ST=0x02)
send(child, build(0x16, 0x06, 0x02, target=0x02).hex(), "reset_yaw")
time.sleep(0.5)

# LED green to confirm alive
led = bytes([0xFF]) + bytes([0, 255, 0] * 10)
send(child, build(0x1A, 0x1A, 0x03, led, target=0x01).hex(), "LED green")
time.sleep(1)

# Drive forward: speed=80, heading=0, flags=0
print("\n--- Driving forward (flags=0x38, target=ST) ---")
drive_data = struct.pack(">BHB", 80, 0, 0)
send(child, build(0x16, 0x07, 0x04, drive_data, target=0x02, flags=FLAGS_ACTIVITY).hex(),
     "drive speed=80 heading=0")
print("  Waiting 3 seconds...")
time.sleep(3)

# Stop
drive_stop = struct.pack(">BHB", 0, 0, 0)
send(child, build(0x16, 0x07, 0x05, drive_stop, target=0x02, flags=FLAGS_ACTIVITY).hex(), "stop")
time.sleep(1)

# LED off
led_off = bytes([0xFF]) + bytes([0, 0, 0] * 10)
send(child, build(0x1A, 0x1A, 0x06, led_off, target=0x01).hex(), "LED off")

child.sendline("disconnect")
child.expect(r"\[LE\]>", timeout=3)
child.sendline("quit")
print("\nDone! Did it move?")
