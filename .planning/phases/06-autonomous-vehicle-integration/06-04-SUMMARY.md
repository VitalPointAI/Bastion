---
phase: 06-autonomous-vehicle-integration
plan: 04
subsystem: frontend
tags: [cop, leaflet, robot, visualization, activity-feed, typescript]

# Dependency graph
requires:
  - phase: 06
    plan: 01
    provides: robot types, mission service, GET /api/robot/robots endpoint

produces:
  - COPRobotLayer component rendering robot markers on COP map
  - COPRobotStatusCard detail panel on robot click
  - Robot layer toggle in COPTab
  - Robot mission events in ActivityFeed
  - Activity feed insertion on mission state transitions
---

## Result

### What was built
COP visualization layer for robot status with real-time position updates and state-colored markers on the Leaflet map. Clicking a robot opens a detail panel with mission status, state timeline, telemetry, and capabilities. Mission state transitions are logged to the activity feed via the existing problem_set_activity store.

### Key files

#### key-files.created
| File | Purpose |
|------|---------|
| `frontend/src/components/cop/COPRobotLayer.tsx` | Leaflet map layer with robot markers, polling, state colors |
| `frontend/src/components/cop/COPRobotStatusCard.tsx` | Detail panel: mission, timeline, telemetry, capabilities |

#### key-files.modified
| File | Change |
|------|--------|
| `frontend/src/components/cop/COPTab.tsx` | Robot layer toggle, status card rendering, props to MapView |
| `frontend/src/components/cop/COPMapView.tsx` | Robot layer props and rendering inside MapContainer |
| `frontend/src/components/problem-set/ActivityFeed.tsx` | Robot event types, icons, descriptions |
| `backend/src/robot/robot-mission-service.ts` | Activity feed logging on state transitions |

### Decisions
- Used polling (3s interval) for robot positions instead of WS subscription — /ws/robot is robot-to-bastion, not browser-facing. Clean and sufficient for MVP.
- Room-to-map coordinate transform uses simple linear mapping with hardcoded base position — real calibration config planned for Plan 05.
- Skipped ResourceTelemetryService integration — adds complexity with minimal MVP benefit. Robot positions come directly via REST polling.

## Self-Check: PASSED
- [x] Robot appears on COP map as icon with state-colored overlay
- [x] Icon color changes: green=executing, yellow=awaiting_auth, red=failed, grey=idle
- [x] Clicking robot icon opens status card detail panel
- [x] Status card shows current mission, state timeline, telemetry snapshot
- [x] Mission state transitions appear in activity feed
- [x] TypeScript compiles cleanly (frontend + backend)
