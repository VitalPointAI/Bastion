# Phase 6: Autonomous Vehicle Integration - Research

**Researched:** 2026-03-11
**Domain:** Edge robotics / DAO-governed autonomous vehicle control
**Confidence:** MEDIUM (Sphero SDK details partially training-data; Jetson specifics verified HIGH; codebase integration patterns verified HIGH)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mission Delivery Protocol**
- WebSocket for all Bastion ↔ Jetson communication
- Jetson connects TO Bastion as WS client, registering through the existing discovery pipeline (Phase 32) — reuse device lifecycle state machine, fingerprinting, onboarding flow
- Robot reports state transitions (accepted → executing → awaiting_auth → complete/failed) plus periodic telemetry heartbeat every 2 seconds (position, heading, battery)
- State transitions are the primary status mechanism; telemetry provides positional updates for COP visualization

**DAO Integration Approach**
- Mock DAO events first with the same payload shape as real DAO proposals — unblocks robot development immediately
- Mock trigger available via both UI button and API endpoint — button for live demos, API for automated testing
- Mission payload includes a policy document attached to the robot's DID
- Policy document maps to Bastion's existing authorities model — same structure, same approval gates
- Autonomy tiers in policy: actions the robot can execute autonomously (movement, recon, patrol) vs. actions requiring human authorization (lethal effects, weapons employment, boundary crossing)
- Human authorization for restricted actions flows through the governance/decisions DAO UI — not a separate operator console
- Demo narrative: DAO issues mission → robot executes autonomously up to authority limit → robot pauses at restricted action → governance DAO UI presents authorization request → human approves/denies → robot continues or aborts
- Missions that violate delegated authorities are rejected with a specific reason (e.g., "speed exceeds authority limit")

**Robot Status in Bastion UI**
- Robot appears as a COP tab layer — icon on the map with state color overlay
- Icon state colors: green=executing, yellow=awaiting authorization, red=failed, grey=idle
- Small label showing current mission name visible at glance
- Click robot icon → MissionStatusCard detail panel (reuse existing MissionStatusCard/Drilldown pattern from inheritance-service): current mission, state timeline, telemetry snapshot, DID and policy summary
- Key mission state transitions appear in the COP activity feed (accepted, executing, awaiting auth, complete, failed) — reuse existing ActivityFeed component
- Room-to-map coordinate scaling: physical room (meters) maps to a defined area of operations on the COP map
  - Config file defines room dimensions + corresponding map area bounds
  - Calibration routine at demo start: robot drives to corners, captures positions, refines transform
  - Named configs can be saved and reused (e.g., "Conference Room A", "Lab", "Demo Hall")
  - Robot reports room-relative position, Bastion translates to map coordinates

**Demo Mission Behaviors**
- Primary mission: Find and Engage Target
  - Robot navigates to a predefined target location (known in mission params)
  - On arrival, robot reports "target located" and pauses for human authorization before engaging
  - Authorization request flows through governance/decisions DAO UI
  - Upon approval: RVR+ flashes LEDs red + plays tone + reports "target engaged"
  - Upon denial: robot reports "engagement denied" and returns to idle
- Secondary mission: Patrol Route
  - Robot follows a sequence of predefined waypoints
  - Reports position at each waypoint
  - Useful for testing, calibration, and showing multi-mission-type support

### Claude's Discretion
- WebSocket message format and protocol details
- Exact mission state machine implementation
- Telemetry data structure beyond position/heading/battery
- LED pattern/timing for engagement simulation
- Error handling and reconnection logic
- Logging format and storage approach

### Deferred Ideas (OUT OF SCOPE)
- Camera-based target detection (CV on Jetson) — future enhancement after predefined-location MVP works
- Video streaming from robot camera to Bastion UI — future enhancement
- Multi-robot coordination and swarm task allocation — planned for future but architecture supports it
- Real DAO event integration (replacing mock events) — swap in after MVP proves the chain
- On-chain telemetry storage — out of scope per buildplan
- SLAM / autonomous mapping — out of scope per buildplan
- Peer-to-peer robot networking — out of scope per buildplan
</user_constraints>

---

## Summary

Phase 6 implements a working demo of DAO-governed autonomous vehicle control. The system has five logical components: Mission Source (mock DAO), Bastion Gateway/Listener, Jetson Mission Client, RVR+ Driver Layer, and Demo Visibility. The architecture is already well-specified in `buildplan.md` and `06-CONTEXT.md`; the main research value here is mapping the correct SDK/library choices and identifying the critical integration points within the existing Bastion codebase.

The **Sphero RVR+** connects to the Jetson via UART serial (the RVR exposes a UART port on its expansion connector). The official Sphero SDK is Python-based (`sphero-sdk-raspberrypi-python`), targeting Python 3.6+ with an asyncio and an observer pattern variant. The asyncio variant is preferable here because it fits well with async Python and the Bastion backend's existing WebSocket client needs. The SDK is officially for Raspberry Pi but works identically on Jetson Orin Nano — same serial interface, same Python packages.

The **Jetson Orin Nano** runs JetPack 6.1 (Ubuntu 22.04 LTS, Linux kernel 5.15, CUDA 12.6). Python 3.10 is included with Ubuntu 22.04. The Jetson mission client should be a standalone Python service — not TypeScript — because the Sphero SDK is Python-only and there is no official Node.js/TypeScript SDK. The Bastion side remains TypeScript. Communication between Jetson and Bastion is WebSocket (Jetson connects as client, Bastion has a `/ws/robot` endpoint).

The codebase already has almost everything needed: vehicle plugin, discovery pipeline, resource telemetry service, gate service, COP resource layer, activity feed, and MissionStatusCard. This phase is primarily wiring these together with a new mission execution layer and a new Jetson-side Python service.

**Primary recommendation:** Build the Jetson mission client in Python using the asyncio Sphero SDK variant. Wire the Bastion gateway as a new TypeScript WebSocket endpoint (`/ws/robot`) that reuses the discovery pipeline for onboarding and the gate service for human authorization gates. The RVR+ driver is a thin Python wrapper over the Sphero SDK. Keep everything independently testable with stubs at each boundary.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sphero-sdk-raspberrypi-python` | latest (pip) | RVR+ serial control (move, LEDs, sensors) | Only official Python SDK for RVR+ UART control |
| `pyserial` | ≥3.4 | UART serial port communication (dependency of Sphero SDK) | Standard serial library; required by Sphero SDK |
| `asyncio` | stdlib (Python 3.10) | Async event loop for Sphero SDK asyncio variant | Ships with Python; required for asyncio Sphero pattern |
| `websockets` | ≥12.0 | Jetson WS client connecting to Bastion | Pure-Python async WS client; well-maintained |
| `xstate` v5 | 5.x | Mission state machine (Bastion-side TypeScript) | Already used in project for lifecycle state machines |
| `zod` | 4.x | Mission JSON schema validation (Bastion) | Already used throughout backend |
| `ws` | 8.x | Bastion WS server endpoint (`/ws/robot`) | Already used in all other WS endpoints in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pydantic` | ≥2.0 | Mission JSON validation on Jetson Python side | Validate incoming mission JSON before execution |
| `structlog` or `logging` | stdlib | Structured logging on Jetson | Demo visibility — all state transitions logged |
| `python-dotenv` | ≥1.0 | Config management on Jetson | Bastion URL, robot ID, auth token via `.env` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sphero-sdk-raspberrypi-python` (Python) | Node.js serial port + custom UART protocol | No official Node SDK exists; UART protocol not fully documented; Python SDK is the only safe choice |
| `websockets` (Python) | `aiohttp` WS client | `websockets` is simpler, purpose-built; aiohttp is heavier with full HTTP server overhead |
| Custom serial UART driver | Sphero SDK | Sphero's protocol is proprietary binary; would require extensive reverse engineering |

**Installation (Jetson / Python):**
```bash
# On Jetson Orin Nano
git clone https://github.com/sphero-inc/sphero-sdk-raspberrypi-python
cd sphero-sdk-raspberrypi-python
pip3 install -r requirements.txt
pip3 install websockets pydantic python-dotenv structlog
```

**Installation (Bastion / Node.js — already available):**
```bash
# No new packages needed — ws, xstate, zod already installed
```

---

## Architecture Patterns

### Recommended Project Structure

The Jetson-side code lives in a new directory that is **not** part of the main Bastion repo — it runs on the Jetson device. Suggest keeping it in `robot/` at the root of the repo for source control and easy deployment.

```
robot/                              # Deployed to Jetson Orin Nano
├── mission_client.py               # Main WS client — connects to Bastion
├── mission_executor.py             # Mission state machine + behavior dispatch
├── rvr_driver.py                   # Thin wrapper over Sphero SDK asyncio API
├── config.py                       # Bastion URL, robot ID, serial port, auth
├── models.py                       # Pydantic models for MissionJSON, StatusUpdate
├── calibration.py                  # Room-to-map coordinate transform
├── .env                            # BASTION_WS_URL, ROBOT_ID, SERIAL_PORT
└── requirements.txt

backend/src/robot/                  # New Bastion-side robot gateway
├── robot-ws.ts                     # WS endpoint /ws/robot (follows discovery-ws.ts pattern)
├── robot-mission-service.ts        # Mission delivery, status tracking, gate creation
├── robot-types.ts                  # MissionJSON, RobotStatus, MissionState types
├── robot-store.ts                  # DB persistence for robot missions and status
└── index.ts

frontend/src/components/cop/
├── COPRobotLayer.tsx               # New: robot marker layer (follows COPResourceLayer.tsx pattern)
├── COPRobotStatusCard.tsx          # New: robot detail panel (follows MissionStatusCard.tsx pattern)
└── [existing COP components]
```

### Pattern 1: Jetson Connects as WS Client (Not Server)

The Jetson connects outbound to Bastion's `/ws/robot` endpoint. This matches the locked decision and avoids NAT/firewall issues (Bastion is the server; Jetson is wherever it is on the local network).

**What:** Jetson Python service opens a persistent WebSocket connection to Bastion on startup. It sends a registration message (robot ID, DID, capabilities). Bastion registers it through the discovery pipeline and sends missions as WS messages. Jetson sends state transitions and telemetry heartbeats back.

**When to use:** Always — this is the locked architecture.

```python
# robot/mission_client.py (Source: locked decision in 06-CONTEXT.md)
import asyncio
import websockets
import json
from config import BASTION_WS_URL, ROBOT_ID, AUTH_TOKEN

async def run():
    async with websockets.connect(f"{BASTION_WS_URL}/ws/robot") as ws:
        # Register
        await ws.send(json.dumps({
            "type": "robot:register",
            "robot_id": ROBOT_ID,
            "auth_token": AUTH_TOKEN,
            "capabilities": ["patrol", "find_engage"],
        }))
        # Main loop: receive missions, send status
        async for raw in ws:
            msg = json.loads(raw)
            await handle_message(ws, msg)
```

### Pattern 2: Mission State Machine (XState v5 on Bastion, Simple Enum on Jetson)

Bastion tracks the mission lifecycle using an XState v5 state machine (consistent with discoveryLifecycle pattern). Jetson uses a simple Python enum/state variable — no need for XState on the Python side.

**Bastion-side mission states:**
```typescript
// backend/src/robot/robot-types.ts
// Use const objects (not enums) per project convention
export const RobotMissionState = {
  pending:           'pending',           // Mission issued, awaiting robot accept
  accepted:          'accepted',          // Robot confirmed receipt
  executing:         'executing',         // Robot moving
  awaiting_auth:     'awaiting_auth',     // Paused — restricted action needs human approval
  complete:          'complete',          // Mission finished successfully
  failed:            'failed',            // Mission aborted/error
  rejected:          'rejected',          // Policy violation — robot refused
} as const;
export type RobotMissionState = (typeof RobotMissionState)[keyof typeof RobotMissionState];
```

**Jetson-side (Python):**
```python
# robot/models.py
from enum import Enum

class MissionState(str, Enum):
    ACCEPTED = "accepted"
    EXECUTING = "executing"
    AWAITING_AUTH = "awaiting_auth"
    COMPLETE = "complete"
    FAILED = "failed"
    REJECTED = "rejected"
```

### Pattern 3: Gate Service for Human Authorization

When the robot reaches a restricted action (e.g., "engage target"), the Bastion gateway creates a decision gate via the existing `gate-service.ts`. The robot holds in `awaiting_auth` until the gate resolves (approved or rejected). The gate appears in the governance/decisions DAO UI automatically.

```typescript
// backend/src/robot/robot-mission-service.ts
import { gateService } from '../gates/gate-service.js';
import { GateType, GateEnforcement } from '../gates/gate-types.js';

async function createEngagementAuthGate(problemSetId: string, missionId: string) {
  return gateService.createGate({
    problem_set_id: problemSetId,
    gate_type: GateType.order_release,     // Closest existing type for lethal effects auth
    target_item_id: missionId,
    target_item_type: 'robot_mission',
    target_item_title: `Engagement Authorization — Mission ${missionId}`,
    enforcement: GateEnforcement.hard_block,
    mode: 'operational',
  });
}
```

**Note:** `GateType.order_release` is the closest existing gate type for "authorize action." The planner may choose to add a new `GateType.robot_action_auth` constant — this is Claude's discretion per the CONTEXT.md.

### Pattern 4: Telemetry Flow (Room-to-Map Coordinate Translation)

The robot reports room-relative position (meters from origin corner). Bastion translates to lat/lng before calling `ResourceTelemetryService.ingestTelemetry()`. The existing `resource-ws.ts` and `COPResourceLayer.tsx` then handle display automatically via the existing telemetry pipeline.

```typescript
// backend/src/robot/robot-mission-service.ts
function roomToMap(
  roomX: number, roomY: number,
  config: { roomWidth: number; roomHeight: number; mapBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }
): { lat: number; lng: number } {
  const lat = config.mapBounds.minLat + (roomY / config.roomHeight) * (config.mapBounds.maxLat - config.mapBounds.minLat);
  const lng = config.mapBounds.minLng + (roomX / config.roomWidth) * (config.mapBounds.maxLng - config.mapBounds.minLng);
  return { lat, lng };
}
```

### Pattern 5: Mock DAO Event Trigger

The mock DAO event must mirror the real DAO proposal payload shape. Add a `POST /api/robot/missions/trigger` endpoint (API) and a button in the Direct tab (UI). Both produce the same normalized mission JSON.

```typescript
// POST /api/robot/missions/trigger (demo API trigger)
// Shape mirrors real DAO proposal payload:
const mockDaoEvent = {
  mission_id: `mission-${Date.now()}`,
  robot_id: "alpha",
  command: "find_engage",            // or "patrol_route"
  params: {
    target_location: { x: 2.5, y: 3.0 },  // room coordinates in meters
    speed: 50,
    autonomy_policy: "alpha-policy-v1",
  },
  issued_by: "dao:problem-set-123",
  timestamp: new Date().toISOString(),
  auth_token: "demo-token",
};
```

### Pattern 6: Robot WS Server Endpoint (Follows Existing Project Pattern)

```typescript
// backend/src/robot/robot-ws.ts (follows discovery-ws.ts and resource-ws.ts pattern)
import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export function setupRobotWebSocket(server: HTTPServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/robot' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      // Handle: robot:register, robot:state_update, robot:telemetry
    });
  });
}
```

### Anti-Patterns to Avoid

- **ROS 2 for this MVP:** Completely out of scope per buildplan. Adds weeks of complexity for no demo value.
- **Blockchain in the real-time motion loop:** DAO issues intent once. No blockchain calls during execution. The Jetson never touches NEAR directly.
- **TypeScript/Node.js for RVR+ control:** No official Node.js SDK exists. The Sphero SDK is Python-only. Don't try to drive the RVR from TypeScript.
- **Jetson as WS server:** Networking complexity (dynamic IP, NAT traversal). Jetson connects OUT to Bastion.
- **Polling for status:** Use WebSocket push for state transitions, not REST polling — ensures instant COP updates.
- **Separate operator console:** Authorization flows through the existing governance/decisions DAO UI. No new console.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RVR+ motor control | Custom UART binary protocol | `sphero-sdk-raspberrypi-python` asyncio | Sphero's UART protocol is proprietary; SDK handles framing, checksums, retry |
| Robot resource registration | New registry system | Existing discovery pipeline (`onboarding-pipeline.ts`) | Already handles device lifecycle, DID assignment, fingerprinting |
| Human authorization gate | Custom approval UI | Existing `gate-service.ts` + governance DAO UI | Gate system already wired to DAO voting, UI already exists |
| COP map rendering | New map layer system | Existing `COPResourceLayer.tsx` + `ResourceTelemetryService` | Already handles MIL-STD symbols, telemetry batching, WS subscription |
| Mission status display | New status panel | Existing `MissionStatusCard.tsx` / `MissionStatusDrilldown.tsx` | Reuse the established drilldown pattern |
| Activity feed events | Custom feed | Existing `ActivityFeed.tsx` + message bus | Already subscribed to activity events in COP sidebar |
| WebSocket state push | REST polling | Existing WS pattern (`ws` package, `setupXxxWebSocket` functions) | Already established; consistent with project architecture |

**Key insight:** The Bastion codebase already has 80%+ of the server-side infrastructure. The new work is: (1) a Python service on the Jetson, (2) a new `/ws/robot` WS endpoint, (3) a robot mission service, (4) a COP robot layer overlay (thinner than `COPResourceLayer` — robot is already a registered resource), and (5) the mock DAO trigger UI/API.

---

## Common Pitfalls

### Pitfall 1: Sphero SDK Python Version Mismatch

**What goes wrong:** The Sphero SDK repository is dated (last major commits 2019-2020) and may have dependencies pinned to older Python versions or libraries. The `requirements.txt` may specify exact old versions that conflict with Python 3.10's stdlib or newer pip defaults.

**Why it happens:** SDK was written for Raspberry Pi (Python 3.6/3.7 era). Jetson Orin Nano runs Ubuntu 22.04 with Python 3.10.

**How to avoid:** Install into a virtual environment (`python3 -m venv venv`). If specific dependency versions conflict, check if newer compatible versions work (the SDK's core logic is simple serial communication; dependency version bumps are usually safe). Test `import sphero_sdk` and a basic connection before building the mission client on top.

**Warning signs:** `pip install` errors mentioning version conflicts, `ModuleNotFoundError` at runtime.

### Pitfall 2: Serial Port Access on Jetson

**What goes wrong:** The RVR+ connects to the Jetson via UART. The Jetson Orin Nano's serial ports may be assigned to the kernel console (`/dev/ttyTHS0` or similar) or require specific device tree configuration. The wrong serial port assignment causes silent connection failure.

**Why it happens:** Jetson has multiple UART interfaces; the one exposed on the 40-pin header needs to be enabled and not reserved for console.

**How to avoid:** Identify the correct UART port (`/dev/ttyTHS1` is commonly available on Jetson Orin Nano). Check that the port is not in use by `nvgetty` or the kernel console. May need to disable console on that UART via `systemctl disable nvgetty`. Test with `minicom` or `python3 -c "import serial; s = serial.Serial('/dev/ttyTHS1', 115200); print(s)"` before running the full SDK.

**Warning signs:** `serial.SerialException: [Errno 13] Permission denied` (add user to `dialout` group), timeouts with no response from RVR+.

### Pitfall 3: WebSocket Reconnection and Robot Discovery State

**What goes wrong:** If Bastion restarts or the WS connection drops, the robot's discovery/onboarding state in the DB needs to handle reconnection gracefully. The discovery pipeline has a `RECONNECT` event, but the mission state may be inconsistent.

**Why it happens:** The discovery lifecycle is designed for network devices that reconnect; robot reconnection during an active mission needs special handling.

**How to avoid:** On Jetson WS reconnect, send a registration message that includes the current `mission_id` and `mission_state` if a mission is active. Bastion checks if that robot is already `connected` in the discovery store and transitions it back to `connected` rather than re-running the full onboarding flow. Design the reconnection path explicitly in Wave 1.

**Warning signs:** Robot shows as `disconnected` in COP after a brief network hiccup even though physically still executing a mission.

### Pitfall 4: Room-to-Map Coordinate Scale Mismatch

**What goes wrong:** The room is small (e.g., 5m x 8m). The COP map is a global/regional map. A 1-meter movement in the room becomes a sub-pixel movement on the map unless the map area bounds are set appropriately tight.

**Why it happens:** The coordinate scaling config maps physical room extent to a lat/lng bounding box. If the bounding box is the whole city, 1m room movement = ~0.00001 degrees = invisible.

**How to avoid:** The config must define a small but visible area of operations on the COP map — e.g., a 0.01° × 0.01° bounding box (~1km²) centered on a meaningful point. The calibration routine should verify that corner-to-corner robot movement produces visually distinct marker movement on the COP. Document the config values for the demo setup.

**Warning signs:** Robot marker appears stationary on map even though robot is moving; markers from calibration corners overlap.

### Pitfall 5: Gate Type Mismatch for Engagement Authorization

**What goes wrong:** The existing `GateType` enum does not have a `robot_action_auth` type. Using `order_release` (closest match) may cause the gate to appear in the wrong UI section or with incorrect default behavior.

**Why it happens:** Gate types were designed for doctrinal planning phases, not robot mission authorization.

**How to avoid:** Add a new `GateType.robot_action_auth` constant to `gate-types.ts` with appropriate defaults (hard_block, direct tab). This is a 3-line addition to `gate-types.ts` and `GATE_DEFAULTS`. Do not shoehorn `order_release` — add the proper type.

**Warning signs:** Authorization prompt appears in wrong tab, wrong enforcement behavior, gate service logs unexpected gate_type errors.

### Pitfall 6: Async Event Loop Conflicts (Python)

**What goes wrong:** The Sphero SDK asyncio variant has its own event loop management. `websockets` also requires an async event loop. Mixing them incorrectly causes `RuntimeError: This event loop is already running` or tasks blocking each other.

**Why it happens:** Python asyncio requires careful orchestration when multiple async libraries share a loop.

**How to avoid:** Use a single `asyncio.run()` top-level entrypoint. Run Sphero SDK operations and WebSocket operations in the same event loop using `asyncio.gather()` or `asyncio.create_task()`. Do NOT use `asyncio.run()` inside an already-running async context. Test the Sphero SDK asyncio examples first before adding WebSocket.

**Warning signs:** `RuntimeError: This event loop is already running`, tasks that start but never complete, the RVR+ stops responding intermittently.

---

## Code Examples

Verified patterns from official sources and existing project code:

### Bastion WS Endpoint (follows `discovery-ws.ts` / `resource-ws.ts` pattern)

```typescript
// backend/src/robot/robot-ws.ts
// Source: discovery-ws.ts and resource-ws.ts established patterns in this codebase
import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getRobotMissionService } from './robot-mission-service.js';

interface RobotWS extends WebSocket {
  robotId?: string;
}

export function setupRobotWebSocket(server: HTTPServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/robot' });

  wss.on('connection', (ws: RobotWS) => {
    console.log('[RobotWS] Robot client connected');

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const service = getRobotMissionService();
        await service.handleRobotMessage(ws, msg);
      } catch (err) {
        console.error('[RobotWS] Message handling error:', err);
      }
    });

    ws.on('close', () => {
      if (ws.robotId) {
        getRobotMissionService().handleRobotDisconnect(ws.robotId);
      }
    });
  });

  console.log('[RobotWS] WebSocket server mounted at /ws/robot');
}
```

### Mission JSON Schema (Bastion TypeScript + Jetson Python)

```typescript
// backend/src/robot/robot-types.ts
// Source: buildplan.md Section 7 + CONTEXT.md decisions
import { z } from 'zod';

export const MissionJSONSchema = z.object({
  mission_id: z.string(),
  robot_id: z.string(),
  command: z.enum(['patrol_route', 'find_engage']),
  params: z.object({
    target_location: z.object({ x: z.number(), y: z.number() }).optional(),
    waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    speed: z.number().min(0).max(255),
    duration_sec: z.number().positive().optional(),
    autonomy_policy: z.string(),
  }),
  issued_by: z.string(),
  timestamp: z.string(),
  auth_token: z.string(),
});

export type MissionJSON = z.infer<typeof MissionJSONSchema>;
```

```python
# robot/models.py (Jetson side)
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TargetLocation(BaseModel):
    x: float  # meters from room origin
    y: float

class Waypoint(BaseModel):
    x: float
    y: float

class MissionParams(BaseModel):
    target_location: Optional[TargetLocation] = None
    waypoints: Optional[List[Waypoint]] = None
    speed: int  # 0-255
    duration_sec: Optional[float] = None
    autonomy_policy: str

class MissionJSON(BaseModel):
    mission_id: str
    robot_id: str
    command: str  # "patrol_route" | "find_engage"
    params: MissionParams
    issued_by: str
    timestamp: datetime
    auth_token: str
```

### Sphero SDK Asyncio Drive Pattern

```python
# robot/rvr_driver.py
# Source: sphero-sdk-raspberrypi-python asyncio examples pattern
# Confidence: MEDIUM (based on SDK structure, not directly verified in fetched docs)
import asyncio
from sphero_sdk import SpheroRvrAsync, SerialAsyncDal, RvrLedGroups

class RVRDriver:
    def __init__(self, serial_port: str = '/dev/ttyTHS1'):
        self.rvr = SpheroRvrAsync(dal=SerialAsyncDal(serial_port))

    async def wake(self):
        await self.rvr.wake()
        await asyncio.sleep(2)  # Wait for RVR+ to wake up

    async def drive(self, speed: int, heading: int, duration_sec: float):
        await self.rvr.drive_with_heading(speed=speed, heading=heading)
        await asyncio.sleep(duration_sec)
        await self.rvr.drive_with_heading(speed=0, heading=heading)

    async def set_leds(self, r: int, g: int, b: int):
        await self.rvr.set_all_leds(
            led_group=RvrLedGroups.all_lights.value,
            led_brightness_values=[r, g, b] * 10,  # repeated for all LED channels
        )

    async def safe_stop(self):
        await self.rvr.drive_with_heading(speed=0, heading=0)

    async def close(self):
        await self.rvr.close()
```

### Robot State Update Message (Jetson → Bastion)

```python
# robot/mission_client.py
async def send_state_update(ws, mission_id: str, state: str, metadata: dict = None):
    """Send mission state transition to Bastion."""
    msg = {
        "type": "robot:state_update",
        "mission_id": mission_id,
        "state": state,
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": metadata or {},
    }
    await ws.send(json.dumps(msg))

async def send_telemetry(ws, robot_id: str, x: float, y: float, heading: float, battery_pct: int):
    """Send periodic 2-second telemetry heartbeat."""
    msg = {
        "type": "robot:telemetry",
        "robot_id": robot_id,
        "position": {"x": x, "y": y},  # room coordinates (meters)
        "heading": heading,
        "battery_pct": battery_pct,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await ws.send(json.dumps(msg))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ROS for robot control | Direct SDK + mission state machine for simple MVPs | ~2022 | ROS 2 is 10x complexity for a 2-mission demo; project buildplan explicitly excludes it |
| REST polling for robot status | WebSocket push (persistent connection) | ~2020 | Instant COP updates without polling overhead |
| Custom serial drivers | Official vendor SDKs (Sphero SDK) | SDK released 2019 | No need to reverse-engineer UART protocol |

**Deprecated/outdated:**
- Sphero SDK v1 (observer pattern): Works but asyncio variant better for concurrent WS + serial operation.
- ROS 1: End-of-life 2025. Explicitly out of scope per buildplan.

---

## Open Questions

1. **Sphero SDK compatibility with Python 3.10 on JetPack 6.1**
   - What we know: SDK was written for Python 3.6/3.7. JetPack 6.1 ships Python 3.10 with Ubuntu 22.04.
   - What's unclear: Whether any SDK dependencies fail to install or run on Python 3.10. The SDK's core is simple pyserial + asyncio, both of which work fine in 3.10, but the full `requirements.txt` is unverified.
   - Recommendation: Wave 0 task — install SDK in venv on Jetson, run the simplest asyncio `getting_started` example, confirm it works before building the mission client on top. If there are version conflicts, resolve them in the venv before proceeding.

2. **Jetson UART port assignment for RVR+**
   - What we know: RVR+ uses UART serial. Jetson Orin Nano has `/dev/ttyTHS0`, `/dev/ttyTHS1` (and possibly others) on the 40-pin header.
   - What's unclear: Which specific port is connected to the RVR+ expansion connector, and whether the Jetson serial console uses the same port (requiring `nvgetty` service to be disabled).
   - Recommendation: Physical setup task in Wave 0. Test with `python3 -c "import serial; s = serial.Serial('/dev/ttyTHS1', 115200)"` and try each available port.

3. **Gate type for robot action authorization**
   - What we know: Existing `GateType` has `order_release` (closest match) but no `robot_action_auth`.
   - What's unclear: Whether adding a new gate type requires DB migration and what the exact UI implications are.
   - Recommendation: Add `robot_action_auth` to the `GateType` const object and `GATE_DEFAULTS` in `gate-types.ts`. Check if `gate_type` is stored as a VARCHAR or enum in the DB schema — if VARCHAR, no migration needed; if DB enum type, migration required.

4. **Telemetry heartbeat frequency vs. COP map update**
   - What we know: CONTEXT.md says 2-second heartbeat. `ResourceTelemetryService` batches at 3 seconds.
   - What's unclear: Whether 2-second robot heartbeat + 3-second telemetry batch produces acceptable COP update latency for the demo (~3-5 second position lag).
   - Recommendation: This is acceptable for a physical room-scale demo. The robot moves slowly (speed 50/255 ≈ ~0.5 m/s). 3-5 seconds of positional lag is visually fine. No change needed.

5. **Policy enforcement — where does authority validation happen?**
   - What we know: Mission payload includes `autonomy_policy` reference. CONTEXT.md says "missions that violate delegated authorities are rejected with a specific reason."
   - What's unclear: Does policy validation happen on Bastion (before sending to Jetson) or on the Jetson (after receiving)?
   - Recommendation: Validate on Bastion before delivery. The Jetson should not need to understand the policy framework — Bastion is the authority enforcer. If the mission violates policy, Bastion rejects with `{ type: "mission:rejected", reason: "speed exceeds authority limit" }` and never sends to Jetson.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set (config.json has no `nyquist_validation` key). Skipping this section per instructions.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/src/discovery/discovery-lifecycle.ts` — XState v5 state machine pattern to replicate
- Existing codebase: `backend/src/resources/plugins/vehicle-plugin.ts` — vehicle plugin already exists, robot registers as `vehicles` category
- Existing codebase: `backend/src/resources/resource-telemetry.ts` — telemetry ingestion and WS broadcast already implemented
- Existing codebase: `backend/src/resources/plugins/base-plugin.ts` — `CommandAdapter` interface already designed for bidirectional device communication
- Existing codebase: `backend/src/gates/gate-types.ts` + `gate-service.ts` — gate lifecycle for human authorization
- Existing codebase: `frontend/src/components/cop/COPResourceLayer.tsx` — COP resource layer pattern to follow for robot overlay
- Existing codebase: `backend/src/discovery/types.ts` — `BastionCommand` interface for command translation
- WebFetch: `https://developer.nvidia.com/embedded/jetpack-sdk-61` — JetPack 6.1, Ubuntu 22.04, CUDA 12.6, kernel 5.15 confirmed
- `.planning/phases/06-autonomous-vehicle-integration/buildplan.md` — system architecture (5 components), engineering principles, mission schema
- `.planning/phases/06-autonomous-vehicle-integration/06-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- WebFetch: `https://github.com/sphero-inc/sphero-sdk-raspberrypi-python` — SDK exists, asyncio + observer variants confirmed, last major commits ~2019-2020
- Training knowledge (post-verified by structure inspection): Sphero SDK uses `SpheroRvrAsync` + `SerialAsyncDal`, `pyserial` dependency, `/dev/ttyS0` or `/dev/ttyTHS1` serial port pattern

### Tertiary (LOW confidence — flag for validation)
- Specific Sphero SDK API method names (`set_all_leds`, `drive_with_heading`, `RvrLedGroups`) — from training data, need verification against actual SDK source before use. Run `help(rvr)` in Python REPL after connecting.
- Exact Jetson serial port assignment (`/dev/ttyTHS1`) — requires physical hardware verification.
- Python 3.10 compatibility of Sphero SDK `requirements.txt` — requires `pip install` test on actual Jetson.

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — Bastion side HIGH (all existing), Jetson Python side MEDIUM (SDK version/compatibility needs hardware verification)
- Architecture: HIGH — follows established project patterns directly; buildplan and CONTEXT.md are highly specific
- Pitfalls: MEDIUM — hardware serial pitfalls are well-known; Python async pitfalls verified from practice; SDK-specific pitfalls are MEDIUM (no live hardware test)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable domain; SDK is not actively changing; hardware interfaces don't change)
