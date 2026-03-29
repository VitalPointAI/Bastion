---
phase: 64-scenario-agnostic-refactor-and-baltic-shield-demo
plan: 02
subsystem: robot
tags: [robot, mission-orchestration, calibration, navigation, simulation, scenario-agnostic]

requires:
  - phase: 64-scenario-agnostic-refactor-and-baltic-shield-demo
    plan: 01
    provides: CalibrationService singleton with roomToGeo() and getProfile(), VehicleDatabase with getThreatClasses()

provides:
  - startMissionSequence() with DEFAULT_MISSION_CONFIG derived from calibration profile
  - DEFAULT_AREA_MAP open terrain track network replacing Taipei street grid
  - Parameterized recon sweep waypoints derived from active area map
  - Enemy spawn positions via calibrationService.roomToGeo() not hardcoded Taipei coords
  - vehicleDatabase.getThreatClasses() replacing inline CHN-99G/T-90 arrays

affects:
  - 64-03 (force disposition seeding — depends on scenario-agnostic mission layer)
  - 64-04 (Baltic Shield demo — consumes startMissionSequence and DEFAULT_AREA_MAP)

tech-stack:
  added: []
  patterns:
    - "DEFAULT_MISSION_CONFIG positions computed from calibrationService.getProfile() proportions at module load"
    - "DEFAULT_AREA_MAP built from buildDefaultAreaMap() using calibration bounds and room dimensions"
    - "scenarioAreaMap module variable replaces activeMap for clarity; setActiveMap/getActiveMap API unchanged"
    - "Boustrophedon sweep pattern derived from active N-S tracks within recon area bounds"
    - "vehicleDatabase.getThreatClasses().slice(0,2) replaces all inline threat class arrays"

key-files:
  created: []
  modified:
    - backend/src/robot/mission-sequence-orchestrator.ts
    - backend/src/robot/autonomous-mission-orchestrator.ts
    - backend/src/robot/tactical-ai-service.ts
    - backend/src/robot/skills/navigation-skill.ts
    - backend/src/robot/mission-simulator.ts
    - backend/src/api/robot-routes.ts

key-decisions:
  - "Kept startIronBastion() as deprecated alias (delegates to startMissionSequence()) for zero-breakage backward compat"
  - "DEFAULT_AREA_MAP uses 5x15m room dimensions with 3 N-S tracks and 3 E-W lines — same 9-intersection grid topology the A* pathfinder already handles"
  - "scenarioAreaMap variable name replaces activeMap for semantic clarity; public setActiveMap/getActiveMap API unchanged"
  - "advanceAxis in tactical-ai-service fallback reads active map primary EW road name instead of hardcoded Zhongxiao West"
  - "Manual detection triggers in autonomous-mission-orchestrator use calibrationService.getProfile() proportions for position derivation"

patterns-established:
  - "Scenario-agnostic positioning: always multiply room dimensions by a proportion factor rather than using fixed coordinates"
  - "VehicleDatabase as single source for threat class enumeration — no inline class arrays anywhere in mission stack"

requirements-completed: [SA-64-04, SA-64-05, SA-64-08, SA-64-11]

duration: 18min
completed: 2026-03-29
---

# Phase 64 Plan 02: Mission Orchestration Generalization Summary

**Mission sequence fully generalized: startMissionSequence() with CalibrationService-derived positions, DEFAULT_AREA_MAP open terrain track network replacing Taipei street grid, and vehicleDatabase-driven threat class enumeration throughout**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-29T22:28:00Z
- **Completed:** 2026-03-29T22:46:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Renamed `IRON_BASTION_DEFAULTS` to `DEFAULT_MISSION_CONFIG` with all positions derived from `calibrationService.getProfile()` proportions (10% width for home base, 80% height for overwatch, etc.)
- Replaced `ZHONGZHENG_MAP` (12 Taipei streets + 4 urban landmarks) with `DEFAULT_AREA_MAP` built by `buildDefaultAreaMap()` using a 3-track x 3-line open terrain grid with geoBounds from calibration profile
- Parameterized recon sweep waypoints to boustrophedon pattern over active N-S tracks within recon area bounds
- Replaced all hardcoded `['CHN-99G', 'T-90']` threat class arrays with `vehicleDatabase.getThreatClasses().slice(0, 2)`
- Added `/scenarios/mission-sequence` route; kept `/scenarios/iron-bastion` as deprecated alias

## Task Commits

1. **Task 1: Generalize mission config and orchestrator** - `85b3fb70` (feat)
2. **Task 2: Replace ZHONGZHENG_MAP and parameterize simulation events** - `d7d30c10` (feat)

## Files Created/Modified

- `backend/src/robot/mission-sequence-orchestrator.ts` — IRON_BASTION_DEFAULTS → DEFAULT_MISSION_CONFIG; startIronBastion → startMissionSequence; import calibrationService
- `backend/src/robot/autonomous-mission-orchestrator.ts` — classDesc 't-99' → vehicleDatabase.getThreatClasses()[0]; manual detection positions use calibration profile; import vehicleDatabase + calibrationService
- `backend/src/robot/tactical-ai-service.ts` — hardcoded 'Zhongxiao West' advance axis → active map primary road lookup via getActiveMap()
- `backend/src/robot/skills/navigation-skill.ts` — ZHONGZHENG_MAP → DEFAULT_AREA_MAP (buildDefaultAreaMap()); activeMap → scenarioAreaMap; import calibrationService
- `backend/src/robot/mission-simulator.ts` — Taipei recon sweep → map-derived boustrophedon; hardcoded enemy positions → calibrationService.roomToGeo(); import vehicleDatabase + calibrationService + getActiveMap
- `backend/src/api/robot-routes.ts` — startIronBastion → startMissionSequence; new /scenarios/mission-sequence route; hardcoded homeBase/threatClasses → calibration+vehicleDatabase; import vehicleDatabase

## Decisions Made

- Kept `startIronBastion()` as a deprecated alias (one-liner delegating to `startMissionSequence()`) rather than hard-removing it — zero risk of breaking any external integrations still using the old name
- `DEFAULT_AREA_MAP` uses `buildDefaultAreaMap()` factory function that reads from `calibrationService.getProfile()` at module load time — correctly picks up any profile changes
- Module-level variable renamed from `activeMap` to `scenarioAreaMap` for clarity while keeping the exported `setActiveMap`/`getActiveMap` API identical — no consumers need changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed robot-routes.ts homeBase type mismatch in autonomous route**
- **Found during:** Task 2 (replacing threat class arrays in robot-routes.ts)
- **Issue:** The autonomous scenario route had `homeBase: overrides.homeBase ?? { x: 0.3, y: 0.5 }` (hardcoded Taipei coordinates) plus hardcoded `reconArea` defaults — inconsistent with the new calibration pattern
- **Fix:** Applied the same calibration-proportional defaults pattern as the mission-sequence route
- **Files modified:** backend/src/api/robot-routes.ts
- **Committed in:** d7d30c10 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Auto-fix essential for consistency — the autonomous route would have used Taipei coords while mission-sequence used calibration-derived coords.

## Issues Encountered

None — TypeScript caught the remaining `activeMap` references that needed renaming, resolved in a single pass.

## Next Phase Readiness

- Mission orchestration layer fully scenario-agnostic — ready for Plan 03 (force disposition seeding from adversary ORBAT)
- `setActiveMap()` hook available for Plan 04 to load Baltic Shield terrain map for demo
- All position derivation uses calibration proportions — switching scenarios requires only updating calibration-profiles.json

---
*Phase: 64-scenario-agnostic-refactor-and-baltic-shield-demo*
*Completed: 2026-03-29*
