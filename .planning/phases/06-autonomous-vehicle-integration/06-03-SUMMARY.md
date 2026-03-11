---
phase: 06-autonomous-vehicle-integration
plan: 03
subsystem: api
tags: [gates, dao, robot, authorization, rest-api, typescript]

# Dependency graph
requires:
  - phase: 06
    plan: 01
    provides: robot mission service, robot types, robot store
  - phase: 28
    plan: 01
    provides: gate service, gate types, gate store

produces:
  - robot REST API (POST /api/robot/missions/trigger, GET /missions/:id, GET /robots, POST /missions/:id/auth)
  - robot_action_auth gate type in gate-types.ts
  - Gate creation on awaiting_auth state in mission service
  - Gate polling and auth response flow
---

## Result

### What was built
Mock DAO trigger API, policy validation, and governance gate integration for human authorization of restricted robot actions. When a robot mission enters `awaiting_auth`, the mission service creates a `robot_action_auth` hard-block gate through the existing gate service. A polling loop checks gate resolution every 2 seconds and sends `auth:response` WS messages back to the robot.

### Key files

#### key-files.created
| File | Purpose |
|------|---------|
| `backend/src/api/robot-routes.ts` | REST API: trigger missions, query status, list robots, manual auth |

#### key-files.modified
| File | Change |
|------|--------|
| `backend/src/gates/gate-types.ts` | Added `robot_action_auth` to GateType and GATE_DEFAULTS |
| `backend/src/robot/robot-mission-service.ts` | Gate creation on awaiting_auth, gate polling, handleGateResolution |
| `backend/src/index.ts` | Mount robotRouter at /api/robot |

### Decisions
- Used polling (2s interval, 10min timeout) for gate resolution instead of event emitter — gate-service has no event system, polling is acceptable for MVP
- Policy validation checks speed against autonomy_policy.max_speed, returns 403 on violation
- Manual auth endpoint (/missions/:id/auth) serves as backup for gate flow

## Self-Check: PASSED
- [x] POST /api/robot/missions/trigger creates and dispatches a mock DAO mission
- [x] Mission payload mirrors real DAO proposal shape (MissionJSONSchema validated)
- [x] Policy validation rejects missions that violate delegated authorities
- [x] Robot reaching awaiting_auth state creates a hard_block gate
- [x] Gate approval sends auth:response approved to robot via WS
- [x] Gate rejection sends auth:response denied to robot via WS
- [x] TypeScript compiles cleanly
