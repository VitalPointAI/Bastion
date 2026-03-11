---
phase: 06-autonomous-vehicle-integration
plan: 02
subsystem: robotics
tags: [python, pydantic, websockets, sphero-rvr, asyncio, structlog, jetson]

# Dependency graph
requires:
  - phase: 06-autonomous-vehicle-integration-plan-01
    provides: Bastion WS server endpoint at /ws/robot and mission message protocol definitions
provides:
  - Jetson-side Python mission client that connects to Bastion as WS client
  - MissionExecutor state machine implementing find_engage and patrol_route behaviors
  - RVRDriver asyncio wrapper over Sphero SDK with SIMULATE mode
  - Pydantic v2 models for all robot-to-Bastion messages
  - Room-to-map coordinate calibration system with named profiles
  - Config loading from .env with startup validation
affects: [06-autonomous-vehicle-integration, cop-layer-visualization, demo-scenarios]

# Tech tracking
tech-stack:
  added:
    - websockets>=12.0 (Jetson WS client)
    - pydantic>=2.0 (message models with validation)
    - python-dotenv>=1.0 (env config loading)
    - structlog>=23.0 (structured logging on Jetson)
  patterns:
    - SIMULATE flag pattern — env var toggles SDK calls to log-only for hardware-free testing
    - Callback injection pattern — MissionExecutor receives send_state_fn and send_telemetry_fn from client
    - Exponential backoff reconnection — initial 5s, doubles up to 60s max
    - Dead-reckoning position tracking — heading + speed + time = estimated position update
    - Named calibration profiles — room-to-map configs saved to JSON, loaded by name

key-files:
  created:
    - robot/mission_client.py
    - robot/mission_executor.py
    - robot/rvr_driver.py
    - robot/models.py
    - robot/config.py
    - robot/calibration.py
    - robot/requirements.txt
    - robot/.env.example
  modified: []

key-decisions:
  - "MissionExecutor receives WS send callbacks at construction time (not direct WS reference) — allows executor to be unit-tested independently of WebSocket"
  - "find_engage awaiting_auth uses asyncio.Event (no timeout) — DAO/human operator decides timing, robot waits indefinitely"
  - "Dead-reckoning for position tracking — simplest approach that unblocks demo without requiring SLAM or external positioning"
  - "SIMULATE=true default in .env.example — safe default prevents accidental hardware commands during development"
  - "Mission tasks run as asyncio.create_task — receive loop stays responsive while mission executes"

patterns-established:
  - "Python robot service pattern: config.py loads env at import time, raises EnvironmentError with clear message if required vars missing"
  - "All Sphero SDK calls wrapped in try/except — driver failures log errors but never crash mission client"
  - "Calibration profiles stored as named dataclasses in DEFAULT_PROFILES dict, persisted to calibration_profiles.json for venue-specific configs"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 6 Plan 02: Jetson Mission Client, Executor, and RVR Driver Summary

**Python asyncio service with WS client, MissionExecutor state machine (find_engage + patrol_route), RVR+ driver with SIMULATE mode, and room-to-map calibration — ready for Jetson Orin Nano deployment**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T10:53:31Z
- **Completed:** 2026-03-11T10:57:53Z
- **Tasks:** 2
- **Files created:** 8

## Accomplishments
- Complete Python service in `robot/` directory with all 8 files ready for Jetson deployment
- Mission executor implements full state machine: accepted → executing → awaiting_auth → complete/failed with find_engage and patrol_route behaviors
- find_engage behavior includes human authorization gate via asyncio.Event — robot pauses at awaiting_auth until Bastion sends auth:response
- RVR driver has SIMULATE mode — entire mission stack runs without physical hardware for development and testing
- Room-to-map calibration with named profiles (default, conference_room_a, lab) and JSON persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Python models, config, calibration, and RVR driver** - `ab56fd4` (feat)
2. **Task 2: Mission client and mission executor** - `a25492e` (feat)

## Files Created/Modified
- `robot/models.py` - Pydantic v2 models: MissionJSON, MissionState (6 states), StateUpdateMsg, TelemetryMsg, RegisterMsg
- `robot/config.py` - dotenv config loader with required/optional vars and clear startup errors
- `robot/calibration.py` - room_to_map linear transform, CalibrationProfile dataclass, named profile persistence
- `robot/rvr_driver.py` - asyncio RVR+ wrapper: drive, drive_to_point, set_leds, flash_leds, safe_stop, get_battery_pct; SIMULATE mode
- `robot/mission_executor.py` - MissionExecutor: execute_mission, _execute_find_engage, _execute_patrol_route, handle_auth_response, abort
- `robot/mission_client.py` - Main entry point: WS connect, register, telemetry_loop, receive_loop, exponential backoff reconnect, SIGINT/SIGTERM shutdown
- `robot/requirements.txt` - websockets, pydantic, python-dotenv, structlog
- `robot/.env.example` - template with SIMULATE=true default

## Decisions Made
- MissionExecutor receives WS send callbacks at construction time rather than a direct WS reference, allowing unit testing without a live WebSocket connection
- find_engage awaiting_auth uses asyncio.Event with no timeout — the DAO/human operator decides the timing and the robot waits indefinitely (correct for the human-in-the-loop authorization pattern)
- Dead-reckoning used for position tracking — simplest approach that unblocks the demo without requiring SLAM or external positioning hardware
- SIMULATE=true is the default in .env.example to prevent accidental hardware commands during development
- Mission tasks run as asyncio.create_task so the receive loop stays responsive while a mission executes concurrently

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all files created and validated cleanly.

## User Setup Required
**Jetson deployment steps:**
1. Clone repo to Jetson Orin Nano
2. Install Sphero SDK via git clone: `git clone https://github.com/sphero-inc/sphero-sdk-raspberrypi-python.git` then `pip3 install -e sphero-sdk-raspberrypi-python/`
3. Install Python deps: `cd robot && pip3 install -r requirements.txt`
4. Copy `.env.example` to `.env` and fill in `BASTION_WS_URL` and `AUTH_TOKEN`
5. Set `SIMULATE=false` when connected to physical RVR+
6. Run: `python3 mission_client.py`

## Next Phase Readiness
- Jetson Python service is complete and self-contained
- Connects to the Bastion /ws/robot endpoint built in plan 06-01
- SIMULATE=true allows end-to-end testing without physical hardware
- Remaining work: COP map layer to visualize robot position and state in Bastion UI

---
*Phase: 06-autonomous-vehicle-integration*
*Completed: 2026-03-11*
