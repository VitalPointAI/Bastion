"""
BASTION WebSocket client for pyDrone.

Implements the robot WebSocket protocol to connect to BASTION via the local
bridge relay or directly to the cloud backend. Handles:
  - Registration (token-based first time, DID-based reconnect)
  - Telemetry heartbeat (IMU, battery, position)
  - Mission assignment dispatch
  - Camera capture on demand (vision events)
  - Flight control commands
"""

import json
import time
import ubinascii
import os

import config as cfg
import flight
import cam

# Optional: websocket client (uwebsocket or custom)
_ws = None
_did = None
_mission_id = None


def _load_did():
    """Load persisted DID from flash."""
    global _did
    try:
        with open(cfg.DID_FILE, "r") as f:
            data = json.load(f)
            _did = data.get("did")
            if _did:
                print(f"[bastion] loaded DID: {_did[:20]}...")
    except Exception:
        _did = None


def _save_did(did):
    """Persist DID to flash for reconnection."""
    global _did
    _did = did
    with open(cfg.DID_FILE, "w") as f:
        json.dump({"did": did, "robot_id": cfg.ROBOT_ID}, f)
    print(f"[bastion] saved DID: {did[:20]}...")


def _msg_id():
    """Generate a unique message ID."""
    return ubinascii.hexlify(os.urandom(8)).decode()


def _timestamp():
    """ISO-ish timestamp from RTC."""
    t = time.localtime()
    return f"{t[0]:04d}-{t[1]:02d}-{t[2]:02d}T{t[3]:02d}:{t[4]:02d}:{t[5]:02d}Z"


def _send(msg):
    """Send a JSON message over WebSocket."""
    if _ws:
        _ws.send(json.dumps(msg))


def _build_register_msg():
    """Build the registration message."""
    msg = {
        "type": "robot:register",
        "robot_id": cfg.ROBOT_ID,
        "name": cfg.ROBOT_NAME,
        "capabilities": [
            "flight",
            "camera",
            "telemetry",
            "recon_area",
            "overwatch",
            "visual_search",
        ],
        "hardware_info": {
            "platform": "01Studio pyDrone ESP32-S3P",
            "camera": "OV2640",
            "imu": "MPU6050",
            "motors": "716 coreless x4",
            "resource_type": "drone",
        },
        "message_id": _msg_id(),
    }

    if _did:
        msg["did"] = _did
    elif cfg.REG_TOKEN:
        msg["token"] = cfg.REG_TOKEN

    return msg


def _build_telemetry_msg():
    """Build a telemetry heartbeat message."""
    imu = flight.read_imu()
    states = flight.read_states()

    # Extract heading from compass if available
    heading = 0
    compass = flight.read_compass()
    if compass:
        heading = compass[0] if len(compass) > 0 else 0

    # Battery: read ADC if available, otherwise placeholder
    battery = 100
    try:
        import machine
        adc = machine.ADC(machine.Pin(3))
        adc.atten(machine.ADC.ATTN_11DB)
        raw = adc.read()
        # Rough conversion for 1S LiPo through voltage divider
        battery = min(100, max(0, int((raw / 4095.0 * 4.2 - 3.0) / 1.2 * 100)))
    except Exception:
        pass

    msg = {
        "type": "robot:telemetry",
        "robot_id": cfg.ROBOT_ID,
        "position": {"x": 0, "y": 0},  # No GPS — relative position TBD
        "heading": heading,
        "battery": battery,
        "timestamp": _timestamp(),
        "message_id": _msg_id(),
    }

    if _mission_id:
        msg["mission_id"] = _mission_id

    # Append raw IMU data as extra telemetry
    if imu:
        msg["imu"] = {
            "ax": imu[0], "ay": imu[1], "az": imu[2],
            "gx": imu[3], "gy": imu[4], "gz": imu[5],
        }

    if states:
        msg["flight_states"] = list(states)

    return msg


def _send_vision_event(jpeg_bytes, description=""):
    """Send a vision capture event to BASTION."""
    b64 = ubinascii.b2a_base64(jpeg_bytes).decode().strip()
    msg = {
        "type": "robot:vision",
        "robot_id": cfg.ROBOT_ID,
        "timestamp": _timestamp(),
        "detections": [],
        "scene_description": description,
        "keyframe_jpeg_b64": b64,
        "message_id": _msg_id(),
    }
    if _mission_id:
        msg["mission_id"] = _mission_id
    _send(msg)


def _handle_message(raw):
    """Process an incoming message from BASTION."""
    global _mission_id

    try:
        msg = json.loads(raw)
    except Exception:
        print(f"[bastion] invalid JSON: {raw[:50]}")
        return

    msg_type = msg.get("type", "")

    if msg_type == "robot:registered":
        did = msg.get("did")
        if did:
            _save_did(did)
        print(f"[bastion] registered OK")

    elif msg_type == "mission:assign":
        mission = msg.get("mission", {})
        _mission_id = mission.get("mission_id")
        command = mission.get("command", "")
        params = mission.get("params", {})
        print(f"[bastion] mission: {command} ({_mission_id})")
        _execute_mission(command, params)

    elif msg_type == "robot:manual_nudge":
        # Direct flight control from BASTION UI
        rol = msg.get("rol", 0)
        pit = msg.get("pit", 0)
        yaw = msg.get("yaw", 0)
        thr = msg.get("thr", 0)
        flight.control(rol=rol, pit=pit, yaw=yaw, thr=thr)

    elif msg_type == "robot:manual_stop":
        flight.stop()

    elif msg_type == "ack":
        pass  # Acknowledged

    elif msg_type == "error":
        print(f"[bastion] error: {msg.get('message', '')}")

    else:
        print(f"[bastion] unhandled: {msg_type}")


def _execute_mission(command, params):
    """Execute a mission command."""
    # Report accepted
    _send({
        "type": "robot:state_update",
        "robot_id": cfg.ROBOT_ID,
        "mission_id": _mission_id,
        "state": "accepted",
        "timestamp": _timestamp(),
        "message_id": _msg_id(),
    })

    try:
        if command == "recon_area":
            _mission_recon(params)
        elif command == "overwatch":
            _mission_overwatch(params)
        elif command == "visual_search":
            _mission_visual_search(params)
        else:
            print(f"[bastion] unknown command: {command}")
            _send_state("rejected", reason=f"Unknown command: {command}")
            return

        _send_state("complete")

    except Exception as e:
        print(f"[bastion] mission failed: {e}")
        _send_state("failed", reason=str(e))
        flight.land()


def _send_state(state, reason=""):
    """Report mission state transition."""
    msg = {
        "type": "robot:state_update",
        "robot_id": cfg.ROBOT_ID,
        "mission_id": _mission_id,
        "state": state,
        "timestamp": _timestamp(),
        "message_id": _msg_id(),
    }
    if reason:
        msg["reason"] = reason
    _send(msg)


def _mission_recon(params):
    """Recon area: take off, capture images, land."""
    _send_state("executing")
    altitude = params.get("altitude_cm", 120)
    duration = params.get("duration_sec", 30)

    flight.take_off(distance_cm=altitude)
    time.sleep_ms(3000)  # Wait for altitude

    # Capture images during recon
    start = time.ticks_ms()
    while time.ticks_diff(time.ticks_ms(), start) < duration * 1000:
        jpeg = cam.capture()
        _send_vision_event(jpeg, description="recon capture")
        time.sleep_ms(2000)

    flight.land()
    time.sleep_ms(3000)


def _mission_overwatch(params):
    """Overwatch: take off, hover, stream images."""
    _send_state("executing")
    altitude = params.get("altitude_cm", 150)
    duration = params.get("duration_sec", 60)

    flight.take_off(distance_cm=altitude)
    time.sleep_ms(3000)

    start = time.ticks_ms()
    while time.ticks_diff(time.ticks_ms(), start) < duration * 1000:
        jpeg = cam.capture()
        _send_vision_event(jpeg, description="overwatch")
        time.sleep_ms(5000)

    flight.land()
    time.sleep_ms(3000)


def _mission_visual_search(params):
    """Visual search: take off, rotate, capture from multiple angles."""
    _send_state("executing")
    altitude = params.get("altitude_cm", 100)

    flight.take_off(distance_cm=altitude)
    time.sleep_ms(3000)

    # Rotate and capture at 8 compass points
    for i in range(8):
        flight.control(yaw=50)
        time.sleep_ms(500)
        flight.control(yaw=0)
        time.sleep_ms(500)
        jpeg = cam.capture()
        _send_vision_event(jpeg, description=f"visual search bearing {i * 45}")

    flight.land()
    time.sleep_ms(3000)


def connect_and_run():
    """Main connection loop — connect, register, send telemetry."""
    global _ws

    import uwebsocket

    _load_did()

    url = ""
    if cfg.BRIDGE_HOST:
        url = f"ws://{cfg.BRIDGE_HOST}:{cfg.BRIDGE_PORT}"
    elif cfg.CLOUD_URL:
        url = cfg.CLOUD_URL
    else:
        # TODO: mDNS discovery for bastion-bridge._tcp
        print("[bastion] no bridge or cloud URL configured")
        return

    print(f"[bastion] connecting to {url}")

    while True:
        try:
            _ws = uwebsocket.connect(url)
            print("[bastion] WebSocket connected")

            # Register
            _send(_build_register_msg())

            # Main loop: send telemetry + process incoming
            last_telem = 0
            while True:
                now = time.ticks_ms()

                # Send telemetry heartbeat
                if time.ticks_diff(now, last_telem) >= cfg.TELEMETRY_INTERVAL_MS:
                    _send(_build_telemetry_msg())
                    last_telem = now

                # Check for incoming messages (non-blocking)
                try:
                    data = _ws.recv()
                    if data:
                        _handle_message(data)
                except OSError:
                    pass  # No data available

                time.sleep_ms(50)

        except Exception as e:
            print(f"[bastion] connection error: {e}")
            _ws = None
            # Exponential backoff
            time.sleep_ms(5000)
            print("[bastion] reconnecting...")
