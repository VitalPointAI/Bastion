# Robot Bridge

> Docker-Based Local Network Bridge for Physical Robot Integration — Phase 43

## Purpose

The Robot Bridge connects cloud-hosted BASTION to physical robots operating on a
local network. It solves a fundamental connectivity problem: BASTION runs in the
cloud; robots run on a local LAN or tactical network. The bridge maintains a
persistent outbound WebSocket connection to BASTION, enabling bidirectional
command-and-telemetry relay without requiring the robot or its local network to
be publicly addressable.

The architecture was chosen over a Pi edge-node design for accessibility:
Docker Compose runs anywhere without specialized hardware procurement, and the
Python robot agent runs natively on Jetson Orin Nano without modification.

---

## Architecture

```
  Cloud (BASTION)
  +---------------------+
  | WebSocket Server    |
  | Command Channel     |
  | Telemetry Ingestion |
  +---------------------+
          ^
          | Outbound WebSocket
          | (self-registration)
          |
  Local Network (Tactical LAN)
  +---------------------+
  |   Robot Bridge      |  <-- Docker container
  |   (Docker Compose)  |
  +---------------------+
          ^
          | mDNS auto-discovery
          |
  +---------------------+
  |   Python Robot      |  <-- Jetson Orin Nano
  |   Agent             |
  +---------------------+
          |
          v
     Physical Robot
     (RVR+, Mecanum, etc.)
```

### Docker-Based Bridge

- Runs as a **Docker Compose** service on any machine on the local tactical network.
- Maintains a persistent outbound WebSocket connection to BASTION cloud.
- No inbound ports required — the connection is always initiated from the local side.
- Configured via environment variables: BASTION cloud URL, bridge identity, and
  authentication token.
- **Self-registration**: On startup, the bridge registers itself with BASTION and
  announces the robots reachable on its local network.

### Python Robot Agent (Jetson Orin Nano)

- Runs as a Python service on the **Jetson Orin Nano** edge compute platform.
- Interfaces with the physical robot's SDK (Sphero RVR+ SDK for ground units).
- Advertises its presence via **mDNS** on the local network.
- The bridge discovers the robot agent via mDNS and establishes a local channel.

### mDNS Auto-Discovery

- Robot agents broadcast an mDNS service record on startup.
- The bridge listens for mDNS announcements and automatically connects to any
  robot agent it discovers on the local network.
- No manual IP configuration required — agents and bridge self-assemble when
  placed on the same network.
- Supports multiple robot agents per bridge — one bridge can manage several robots.

### WebSocket Command Channel

Commands flow from BASTION cloud through the bridge to the robot agent:

1. Operator sends a command in BASTION (e.g., `recon_area`, `move_to_waypoint`).
2. BASTION serializes the command and pushes it to the bridge via WebSocket.
3. Bridge forwards the command to the appropriate robot agent on the local network.
4. Robot agent translates the command into robot SDK calls.
5. Execution status is returned through the reverse path.

Command types include: movement, formation change, mission profile start/stop,
camera control, and emergency stop.

### Telemetry Relay

Robot status flows continuously from the physical robot up to BASTION:

- **Position**: GPS coordinates or estimated position from odometry.
- **Heading**: Current bearing.
- **Speed**: Current velocity.
- **Battery**: State of charge.
- **Status**: Active, idle, executing mission, fault, or lost-contact.
- **Vision events**: Detection events from the camera pipeline (if vision-equipped).

Telemetry updates are relayed to BASTION at the configured heartbeat interval
(default: 5 seconds). COP tab renders current telemetry as map symbols.

### Dual-Path Connectivity

To support degraded communications:

- **Primary path**: WiFi bridge-to-cloud WebSocket.
- **Backup path**: LTE/cellular modem on the bridge host (if available).
- Bridge monitors connection health and switches paths on failure.
- Robot agents continue local execution during cloud connectivity loss;
  telemetry is buffered and flushed on reconnect.

---

## Setup

### Bridge Setup (Docker Compose)

```bash
# Clone the robot bridge repository
git clone https://github.com/bastion/robot-bridge
cd robot-bridge

# Configure environment
cp .env.example .env
# Edit .env: BASTION_WS_URL, BRIDGE_TOKEN, BRIDGE_ID

# Start the bridge
docker compose up -d
```

### Robot Agent Startup (Jetson Orin Nano)

```bash
# Install dependencies
pip install sphero-sdk websockets zeroconf

# Start the robot agent
python robot_agent.py --config robot_agent.yaml
```

The agent advertises via mDNS immediately on startup. The bridge will discover
and connect within seconds.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Sends mission commands. Views robot telemetry on COP. |
| **J3 Operations** | Manages robot assignments and mission tasking. |
| **J6 Communications** | Manages bridge configuration and connectivity. |
| **Robot Operator** | Physical setup of robot agent on Jetson. |

---

## Doctrinal Reference

- **BASTION Phase 43**: Robot Bridge Architecture and Implementation
- See also: [Robot Vision](robot-vision.md) — Camera and detection on Jetson
- See also: [Swarm Behavior](swarm-behavior.md) — Formation and movement coordination

---

*Part of the [BASTION Capability Tabs](/) documentation.*
