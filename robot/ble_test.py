"""Quick BLE test — retries connection until RVR+ responds."""
import pexpect
import sys
import time

ADDR = sys.argv[1] if len(sys.argv) > 1 else "D4:86:01:19:88:77"
MAX_RETRIES = 30

print(f"Trying to connect to {ADDR}...")
print("Press the RVR+ power button NOW and keep it awake.\n")

for attempt in range(1, MAX_RETRIES + 1):
    child = pexpect.spawn(f"gatttool -b {ADDR} -t random -I", timeout=5)
    try:
        child.expect(r"\[LE\]>")
        child.sendline("connect")
        idx = child.expect(["Connection successful", "not connected", pexpect.TIMEOUT], timeout=5)

        if idx == 0:
            print(f"\n=== CONNECTED on attempt {attempt}! ===\n")

            # Anti-DOS
            child.sendline("char-write-cmd 0x0011 757365746865666f7263652e2e2e62616e64")
            child.expect(r"\[LE\]>", timeout=3)
            print("Anti-DOS sent")
            time.sleep(0.5)

            # Wake
            child.sendline("char-write-cmd 0x0011 8d360101130d019cd8")
            child.expect(r"\[LE\]>", timeout=3)
            print("Wake sent")
            time.sleep(2)

            # LEDs green
            flags, target, source = 0x36, 0x01, 0x01
            did, cid, seq = 0x1A, 0x1A, 0x02
            led = bytes([0xFF]) + bytes([0, 255, 0] * 10)
            body = bytes([flags, target, source, did, cid, seq]) + led
            chk = (~sum(body)) & 0xFF
            packet = bytes([0x8D]) + body + bytes([chk, 0xD8])
            child.sendline("char-write-cmd 0x0011 " + packet.hex())
            child.expect(r"\[LE\]>", timeout=3)
            print("LED GREEN sent -- check the robot!")
            time.sleep(2)

            # Drive forward: speed=60 heading=0 flags=0
            import struct
            did, cid, seq = 0x16, 0x07, 0x03
            drive_data = struct.pack(">BHB", 60, 0, 0)  # speed, heading, flags
            body = bytes([flags, 0x02, source, did, cid, seq]) + drive_data  # target=0x02 (ST MCU)
            chk = (~sum(body)) & 0xFF
            packet = bytes([0x8D]) + body + bytes([chk, 0xD8])
            child.sendline("char-write-cmd 0x0011 " + packet.hex())
            child.expect(r"\[LE\]>", timeout=3)
            print("DRIVE FORWARD sent (speed=60, heading=0, 2sec)...")
            time.sleep(2)

            # Stop
            did, cid, seq = 0x16, 0x07, 0x04
            drive_data = struct.pack(">BHB", 0, 0, 0)  # speed=0
            body = bytes([flags, 0x02, source, did, cid, seq]) + drive_data
            chk = (~sum(body)) & 0xFF
            packet = bytes([0x8D]) + body + bytes([chk, 0xD8])
            child.sendline("char-write-cmd 0x0011 " + packet.hex())
            child.expect(r"\[LE\]>", timeout=3)
            print("STOP sent")

            time.sleep(1)
            child.sendline("disconnect")
            child.expect(r"\[LE\]>", timeout=3)
            child.sendline("quit")
            print("\nDone! BLE control is working.")
            sys.exit(0)
        else:
            print(f"  Attempt {attempt}/{MAX_RETRIES} — not connected, retrying...")
    except (pexpect.TIMEOUT, pexpect.EOF):
        print(f"  Attempt {attempt}/{MAX_RETRIES} — timeout, retrying...")
    finally:
        child.close()
    time.sleep(1)

print("\nFailed after all retries. Make sure the RVR+ is powered on and BLE is advertising.")
