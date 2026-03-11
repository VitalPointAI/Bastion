---
phase: 06-autonomous-vehicle-integration
plan: 05
subsystem: frontend
tags: [demo, ui, direct-tab, calibration, robot, typescript]

# Dependency graph
requires:
  - phase: 06
    plan: 03
    provides: POST /api/robot/missions/trigger, GET /api/robot/robots
  - phase: 06
    plan: 04
    provides: COP robot layer, activity feed integration

produces:
  - RobotMissionTrigger component in Direct tab
  - Calibration profile CRUD API endpoints
  - Robot Missions sidebar item in DirectTab
---

## Result

### What was built
Demo mission trigger UI in the Direct tab with mission type selector (find_engage/patrol_route), robot picker, parameter configuration (target location, waypoints, speed), and active mission status polling with state badge. Calibration profile CRUD endpoints for saving/loading room-to-map transform configs.

### Key files

#### key-files.created
| File | Purpose |
|------|---------|
| `frontend/src/components/direct/RobotMissionTrigger.tsx` | Mission trigger form, robot list, active mission status |

#### key-files.modified
| File | Change |
|------|--------|
| `frontend/src/components/tabs/DirectTab.tsx` | Added Robot Missions sidebar item and view rendering |
| `backend/src/api/robot-routes.ts` | Added calibration profile CRUD endpoints |

### Decisions
- Used collapsible card pattern matching existing Direct tab styling
- File-based calibration storage (backend/data/calibration-profiles.json) — no DB table needed for MVP
- Active mission polling at 2s interval with auto-stop on terminal states

### Checkpoint
Task 2 (end-to-end demo verification) is a human-verify checkpoint requiring manual testing.

## Self-Check: PASSED
- [x] UI button in Direct tab triggers a mock DAO mission
- [x] User can select mission type and configure parameters
- [x] Calibration config can be saved and loaded by name
- [x] TypeScript compiles cleanly (frontend + backend)
- [ ] End-to-end demo flow (requires human verification with running backend + robot)
