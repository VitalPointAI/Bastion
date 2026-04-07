"""
pyDrone configuration — edit these values for your deployment.
"""

# WiFi credentials
WIFI_SSID = ""
WIFI_PASS = ""

# BASTION bridge connection
# If empty, will attempt mDNS discovery for 'bastion-bridge._tcp'
BRIDGE_HOST = ""
BRIDGE_PORT = 9001

# Direct cloud connection (fallback if bridge unavailable)
CLOUD_URL = ""  # e.g. "ws://bastion-server:3001/ws/robot"

# Robot identity
ROBOT_ID = "pydrone-01"
ROBOT_NAME = "pyDrone Alpha"

# One-time registration token (get from BASTION admin panel)
# After first registration, DID is persisted and token is no longer needed.
REG_TOKEN = ""

# Persisted DID file path (written after first successful registration)
DID_FILE = "/did.json"

# Telemetry heartbeat interval (ms)
TELEMETRY_INTERVAL_MS = 2000

# Camera settings
CAMERA_FRAME_SIZE = "VGA"  # QQVGA, QVGA, VGA, SVGA, XGA
CAMERA_QUALITY = 12  # JPEG quality 0-63 (lower = better quality, bigger file)

# Camera pin mapping (01Studio pyDrone ESP32-S3P)
CAM_DATA_PINS = [47, 38, 39, 48, 21, 13, 12, 10]
CAM_VSYNC = 8
CAM_HREF = 9
CAM_PCLK = 14
CAM_XCLK = 11
CAM_SDA = 17
CAM_SCL = 18
CAM_XCLK_FREQ = 20000000

# Motor PWM pins (used by drone C module, listed here for reference)
MOTOR_M1 = 4
MOTOR_M2 = 5
MOTOR_M3 = 40
MOTOR_M4 = 41

# IMU I2C pins
IMU_SCL = 15
IMU_SDA = 16
IMU_ADDR = 0x68

# LED pins
LED_BLUE = 46
LED_GREEN = 42
