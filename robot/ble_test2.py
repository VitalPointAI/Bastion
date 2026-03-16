"""Test different drive command variants over BLE."""
import pexpect
import struct
import sys
import time

ADDR = sys.argv[1] if len(sys.argv) > 1 else "D4:86:01:19:88:77"
HANDLE = "0x0011"
ANTIDOS_HEX = "757365746865666f7263652e2e2e62616e64"

SOP, EOP = 0x8D, 0xD8
FLAGS = 0x36
SOURCE = 0x01

def build(did, cid, seq, data=b"", target=0x01):
    body = bytes([FLAGS, target, SOURCE, did, cid, seq]) + data
    chk = (~sum(body)) & 0xFF
    return bytes([SOP]) + body + bytes([chk, EOP])

def send(child, pkt_hex, label):
    child.sendline(f"char-write-cmd {HANDLE} {pkt_hex}")
    child.expect(r"\[LE\]>", timeout=3)
    print(f"  Sent: {label}")

# Connect
print(f"Connecting to {ADDR}...")
print("Press RVR+ power button NOW.\n")

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
    print(f"  Retry {attempt}...")
    time.sleep(1)

if not child:
    print("Failed to connect")
    sys.exit(1)

# Anti-DOS
send(child, ANTIDOS_HEX, "anti-DOS")
time.sleep(0.5)

# Wake (target=Nordic)
send(child, build(0x13, 0x0D, 0x01, target=0x01).hex(), "wake")
time.sleep(2)

# Reset yaw (target=ST)
send(child, build(0x16, 0x06, 0x02, target=0x02).hex(), "reset_yaw (target=ST)")
time.sleep(0.5)

# Also reset yaw (target=Nordic, in case routing differs)
send(child, build(0x16, 0x06, 0x03, target=0x01).hex(), "reset_yaw (target=Nordic)")
time.sleep(0.5)

# Flash green to confirm we're live
led = bytes([0xFF]) + bytes([0, 255, 0] * 10)
send(child, build(0x1A, 0x1A, 0x04, led, target=0x01).hex(), "LED green (target=Nordic)")
time.sleep(1)

# Test 1: drive_with_heading target=ST
print("\n--- Test 1: drive_with_heading target=ST (0x02) ---")
drive_data = struct.pack(">BHB", 80, 0, 0)
send(child, build(0x16, 0x07, 0x05, drive_data, target=0x02).hex(), "drive speed=80 heading=0")
time.sleep(3)
send(child, build(0x16, 0x07, 0x06, struct.pack(">BHB", 0, 0, 0), target=0x02).hex(), "stop")
time.sleep(1)

# Test 2: drive_with_heading target=Nordic
print("\n--- Test 2: drive_with_heading target=Nordic (0x01) ---")
drive_data = struct.pack(">BHB", 80, 0, 0)
send(child, build(0x16, 0x07, 0x07, drive_data, target=0x01).hex(), "drive speed=80 heading=0")
time.sleep(3)
send(child, build(0x16, 0x07, 0x08, struct.pack(">BHB", 0, 0, 0), target=0x01).hex(), "stop")
time.sleep(1)

# Test 3: raw_motors (CID=0x01) — left_mode, left_speed, right_mode, right_speed
# mode 1 = forward, mode 2 = reverse
print("\n--- Test 3: raw_motors target=ST ---")
raw_data = struct.pack(">BBBB", 1, 80, 1, 80)  # both forward at 80
send(child, build(0x16, 0x01, 0x09, raw_data, target=0x02).hex(), "raw_motors fwd 80/80")
time.sleep(3)
send(child, build(0x16, 0x01, 0x0A, struct.pack(">BBBB", 0, 0, 0, 0), target=0x02).hex(), "raw_motors stop")
time.sleep(1)

# Test 4: raw_motors target=Nordic
print("\n--- Test 4: raw_motors target=Nordic ---")
raw_data = struct.pack(">BBBB", 1, 80, 1, 80)
send(child, build(0x16, 0x01, 0x0B, raw_data, target=0x01).hex(), "raw_motors fwd 80/80")
time.sleep(3)
send(child, build(0x16, 0x01, 0x0C, struct.pack(">BBBB", 0, 0, 0, 0), target=0x01).hex(), "raw_motors stop")
time.sleep(1)

# Done
led_off = bytes([0xFF]) + bytes([0, 0, 0] * 10)
send(child, build(0x1A, 0x1A, 0x0D, led_off, target=0x01).hex(), "LED off")

child.sendline("disconnect")
child.expect(r"\[LE\]>", timeout=3)
child.sendline("quit")
print("\nDone! Which test made it move?")
