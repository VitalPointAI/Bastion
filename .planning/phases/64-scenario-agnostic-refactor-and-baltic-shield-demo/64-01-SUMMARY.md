---
phase: 64-scenario-agnostic-refactor-and-baltic-shield-demo
plan: 01
subsystem: robot
tags: [calibration, vehicle-database, team-config, react-context, singleton, coordinate-conversion]

# Dependency graph
requires:
  - phase: 48-robot-swarm-end-to-end-demo
    provides: robot mission service, swarm COP bridge, vision pipeline
  - phase: 14-friendly-adversary-ipb-complete-cycle
    provides: OrderEditor, IPBPanel, ExerciseDashboard exercise UI components
provides:
  - CalibrationService singleton (backend/src/robot/calibration-service.ts) — single source of truth for room-to-geo coordinate conversion
  - VehicleDatabase singleton (backend/src/robot/vehicle-database.ts) — consolidated vehicle identification replacing 3 separate tables
  - TeamConfigProvider context (frontend/src/context/TeamConfigProvider.tsx) — centralized team labels replacing 5 hardcoded Pacific scenario names
affects:
  - 64-02
  - 64-03
  - 64-04
  - all future robot subsystem plans
  - all future exercise UI plans

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CalibrationService: singleton with lazy synchronous readFileSync, saveProfiles() invalidates cache"
    - "VehicleDatabase: static data singleton with Map index for O(1) lookups"
    - "TeamConfigProvider: React context with default fallback, no throw outside provider"
    - "ESM path resolution: import.meta.url + fileURLToPath for all file paths"

key-files:
  created:
    - backend/src/robot/calibration-service.ts
    - backend/src/robot/vehicle-database.ts
    - frontend/src/context/TeamConfigProvider.tsx
  modified:
    - backend/src/robot/robot-mission-service.ts
    - backend/src/robot/swarm-cop-bridge.ts
    - backend/src/api/robot-routes.ts
    - backend/src/coordinates/mgrs-coordinator.ts
    - backend/src/robot/vision-cop-pipeline.ts
    - backend/src/robot/skills/symbology-skill.ts
    - frontend/src/components/exercise/OrderEditor.tsx
    - frontend/src/components/exercise/IPBPanel.tsx
    - frontend/src/components/exercise/ExerciseDashboard.tsx

key-decisions:
  - "CalibrationService uses synchronous readFileSync at first access (lazy init, not async) — matches existing ESM pattern in codebase"
  - "mgrs-coordinator.ts gets calibration via getBounds() helper that calls calibrationService.getProfile() on every use — ensures consistency with active profile"
  - "ExerciseDashboard uses inner/outer component split (ExerciseDashboardInner + ExerciseDashboard wrapper) so TeamConfigProvider wraps the full exercise tree"
  - "VehicleEntry uses threat_class instead of affiliation to avoid collision with FHIR/HL7 or other affiliation terminology in the broader codebase"

patterns-established:
  - "Singleton pattern: class with private _cache = null, lazy load on first method call, invalidateCache() for writes"
  - "Context provider with defaults: createContext(DEFAULT), Provider merges partial config with defaults, hook returns useContext (never throws)"

requirements-completed:
  - SA-64-01
  - SA-64-02
  - SA-64-03

# Metrics
duration: 30min
completed: 2026-03-29
---

# Phase 64 Plan 01: Scenario-Agnostic Foundation Services Summary

**CalibrationService singleton, VehicleDatabase consolidation, and TeamConfigProvider context — three foundation services replacing 5 duplicate coordinate loaders, 3 separate vehicle tables, and 5 hardcoded Pacific coalition name locations**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-29T22:16:48Z
- **Completed:** 2026-03-29T22:50:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created `CalibrationService` singleton that all robot subsystems delegate room-to-geo conversion to — eliminated 2 duplicate `loadDefaultCalibration()` implementations and 4 hardcoded `CAL_*` constants
- Created `VehicleDatabase` singleton consolidating `KNOWN_VEHICLES` (symbology-skill.ts), `THREAT_CLASS_MAP` (vision-cop-pipeline.ts) into one authoritative source with `getByClassification()`, `getAllVehicles()`, `getThreatClasses()` methods
- Created `TeamConfigProvider` React context with `useTeamConfig()` hook; replaced all 5 hardcoded "CJTF WestPAC" / "PRC/TCC" locations in exercise UI components with generic defaults
- All TypeScript compilation passes cleanly (both backend and frontend)

## Task Commits

1. **Task 1: Create CalibrationService singleton and migrate all coordinate consumers** - `bab8e19f` (feat)
2. **Task 2: Create VehicleDatabase, TeamConfigProvider, and replace hardcoded team labels** - `5fbae560` (feat)

## Files Created/Modified
- `backend/src/robot/calibration-service.ts` — New singleton; loadProfiles(), getProfile(), roomToGeo(), saveProfiles() with cache invalidation
- `backend/src/robot/vehicle-database.ts` — New singleton; 23 vehicle entries, getByClassification(), getAllVehicles(), getThreatClasses()
- `frontend/src/context/TeamConfigProvider.tsx` — New React context provider and useTeamConfig() hook
- `backend/src/robot/robot-mission-service.ts` — Removed loadDefaultCalibration(), roomToGeo(); uses calibrationService
- `backend/src/robot/swarm-cop-bridge.ts` — Removed loadDefaultCalibration(), roomToGeo() export; uses calibrationService
- `backend/src/api/robot-routes.ts` — Removed inline loadProfiles(), saveProfiles(); uses calibrationService
- `backend/src/coordinates/mgrs-coordinator.ts` — Removed CAL_SOUTH/NORTH/WEST/EAST constants; derives bounds via getBounds() → calibrationService
- `backend/src/robot/vision-cop-pipeline.ts` — Removed THREAT_CLASS_MAP and inline CAL_* constants; uses vehicleDatabase + calibrationService
- `backend/src/robot/skills/symbology-skill.ts` — Removed KNOWN_VEHICLES; uses vehicleDatabase.getByClassification()
- `frontend/src/components/exercise/OrderEditor.tsx` — 3 locations replaced with useTeamConfig()
- `frontend/src/components/exercise/IPBPanel.tsx` — 1 location replaced with useTeamConfig()
- `frontend/src/components/exercise/ExerciseDashboard.tsx` — 1 location replaced; wrapped with TeamConfigProvider

## Decisions Made
- CalibrationService uses synchronous `readFileSync` at first access — async would require refactoring all callers and is unnecessary for a config file read at startup
- `mgrs-coordinator.ts` calls `getBounds()` on each `fromRoom()`/`toRoom()` call to ensure the coordinate system always reflects the active calibration profile
- ExerciseDashboard split into `ExerciseDashboardInner` + `ExerciseDashboard` wrapper so TeamConfigProvider wraps the entire exercise component tree without disrupting the existing component structure

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as specified with one minor addendum:

**Additional: vision-cop-pipeline.ts inline CAL_* constants removed**
- The plan listed `vision-cop-pipeline.ts` in `files_modified` but didn't explicitly call out the inline `CAL_SOUTH/NORTH/WEST/EAST` constants on line 168. These were removed as part of Task 1 since they were the same calibration duplication pattern.

### Deferred Items (out of scope)
- `backend/src/exercise/order-generator.ts` — hardcoded CJTF WestPAC/PRC-TCC in LLM prompts (backend order generation, not in plan scope)
- `frontend/src/components/cop/COPRobotLayer.tsx` — hardcoded CAL_SOUTH/NORTH (frontend COP layer, not in plan scope)
- `frontend/src/components/cop/COPGateNotifications.tsx` — hardcoded CAL_SOUTH/NORTH (frontend COP layer, not in plan scope)

See `.planning/phases/64-scenario-agnostic-refactor-and-baltic-shield-demo/deferred-items.md` for details.

## Issues Encountered
None — both TypeScript compilations passed on first attempt.

## Next Phase Readiness
- CalibrationService is ready for 64-02 to parameterize mission config and theater context
- VehicleDatabase is ready for 64-02/03 to wire ORBAT data from problem set metadata
- TeamConfigProvider is ready for 64-04 to wire `blueTeamLabel`/`redTeamLabel` from active problem set metadata

---
*Phase: 64-scenario-agnostic-refactor-and-baltic-shield-demo*
*Completed: 2026-03-29*
