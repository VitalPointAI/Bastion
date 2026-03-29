---
phase: 64-scenario-agnostic-refactor-and-baltic-shield-demo
plan: 03
subsystem: exercise, cop, intelligence
tags: [ipb, exercise-dashboard, cop-map, calibration, scenario-agnostic, baltic-shield]

requires:
  - phase: 64-01
    provides: "CalibrationService singleton for backend coordinate parameterization"
  - phase: 64-02
    provides: "Mission execution and robot mission parameters parameterized"

provides:
  - "IPB theater context reads from calibrationService.getProfile(), not hardcoded Taiwan/Western Pacific values"
  - "Exercise phases default to doctrinal JP 3-0 names, not Pacific Strategy 6-phase array"
  - "Strategic force disposition seed uses Baltic Shield coalition forces and calibration-derived positions"
  - "Engagement zoom derives from notification threat position payload, not hardcoded room coordinates"
  - "COP map default center updated to Sector Latgale, Latvia matching calibration profile defaults"
  - "Frontend mgrs-coordinator default calibration aligned to Baltic AO"

affects:
  - cop, exercise, ipb-service, robot-routes, seed-strategic-cop, gate-notifications

tech-stack:
  added: []
  patterns:
    - "IPB LLM prompts use calibration-derived theater coordinates — no hardcoded scenario geography"
    - "GateNotification type carries optional threatLat/threatLng for data-driven COP zoom"
    - "Strategic COP seed handler uses calibration-relative offsets for force positions"

key-files:
  created: []
  modified:
    - backend/src/exercise/ipb-service.ts
    - frontend/src/components/exercise/ExerciseDashboard.tsx
    - backend/src/api/robot-routes.ts
    - scripts/seed-strategic-cop.ts
    - frontend/src/components/cop/COPGateNotifications.tsx
    - frontend/src/hooks/useCOPGateNotifications.ts
    - frontend/src/components/cop/COPMapView.tsx
    - frontend/src/lib/mgrs-coordinator.ts

key-decisions:
  - "THEATER_DEFAULTS in ipb-service.ts converted to lazy function calling calibrationService.getProfile() — avoids import-time side effects while ensuring fresh calibration data"
  - "buildFallbackExtraction() replaced with generic scenario-agnostic terrain/NAI templates using calibration-derived coordinates"
  - "COP engagement zoom uses notification payload threatLat/threatLng; no fallback to hardcoded room coords since frontend lacks server-side calibration context"
  - "Strategic seed data replaced with Baltic Shield NATO coalition forces (9 friendly + 9 OPFOR) using absolute Sector Latgale coordinates for demo reliability"

patterns-established:
  - "Pattern: All LLM prompt geography uses theater.center/adversaryStaging from THEATER_DEFAULTS() rather than literal coordinates"
  - "Pattern: GateNotification type extended with optional geo fields; hook maps from payload fields (threat_lat/threat_lng)"

requirements-completed:
  - SA-64-06
  - SA-64-07
  - SA-64-09
  - SA-64-10

duration: 9min
completed: 2026-03-29
---

# Phase 64 Plan 03: Parameterized IPB Theater Context, Exercise Phases, Force Disposition, and Engagement Zoom Summary

**IPB service now reads theater coordinates from CalibrationService, exercise phases default to JP 3-0 doctrinal names, strategic COP seed uses Baltic Shield NATO coalition forces, and gate notification zoom targets derive from payload lat/lng**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-29T22:41:00Z
- **Completed:** 2026-03-29T22:50:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Eliminated all hardcoded Taiwan/Western Pacific/Indo-Pacific/INDOPACOM strings from IPB service prompt templates and fallback extraction data
- Replaced 6-phase Pacific Strategy array in ExerciseDashboard with 6 doctrinal JP 3-0 phase names
- Replaced 18 hardcoded PLA/Taiwan force symbols in robot-routes.ts and seed-strategic-cop.ts with 18 Baltic Shield NATO coalition + OPFOR symbols
- Removed hardcoded roomToLatLng(2.5, 3.5) engagement zoom — now driven by notification's threatLat/threatLng payload fields
- Updated COP map default center from Taipei (25.0, 121.5) to Sector Latgale, Latvia (56.849, 27.698)
- Aligned frontend mgrs-coordinator default calibration to Baltic AO

## Task Commits

1. **Task 1: Parameterize IPB theater context and exercise phases** - `bcdf6d6e` (feat)
2. **Task 2: Parameterize force disposition seed and engagement zoom** - `424181b1` (feat)

## Files Created/Modified

- `backend/src/exercise/ipb-service.ts` — THEATER_DEFAULTS converted to lazy function using calibrationService; all LLM prompt geography genericized; buildFallbackExtraction() replaced with calibration-derived generic content
- `frontend/src/components/exercise/ExerciseDashboard.tsx` — DEFAULT_EXERCISE_PHASES replaced with doctrinal JP 3-0 phase names
- `backend/src/api/robot-routes.ts` — seed-strategic-cop handler force arrays replaced with 9 friendly NATO + 9 OPFOR units using calibration-relative offsets
- `scripts/seed-strategic-cop.ts` — Complete rewrite of force arrays with Baltic Shield coalition data; updated metadata to remove Pacific Strategy references
- `frontend/src/components/cop/COPGateNotifications.tsx` — Removed hardcoded CAL_* constants and roomToLatLng function; zoom now uses criticalGate.threatLat/threatLng
- `frontend/src/hooks/useCOPGateNotifications.ts` — Added threatLat/threatLng to GateNotification type; maps from payload threat_lat/threat_lng
- `frontend/src/components/cop/COPMapView.tsx` — DEFAULT_CENTER updated from Taipei to Sector Latgale; zoom adjusted from 6 to 13
- `frontend/src/lib/mgrs-coordinator.ts` — DEFAULT_CALIBRATION updated from Taipei Zhongzheng to Sector Latgale, Latvia

## Decisions Made

- Converted THEATER_DEFAULTS from a constant object to a lazy function (`THEATER_DEFAULTS()`) to avoid import-time side effects while still reading from the calibration profile. Calling `calibrationService.getProfile()` at call time ensures the latest calibration is used.
- The `buildFallbackExtraction()` method had extensive Taiwan/PLA-specific terrain descriptions. Replaced entirely with scenario-agnostic placeholders that instruct the user to upload documents for IPB extraction.
- For engagement zoom: frontend has no direct access to backend calibration profiles, so only the notification payload path is supported. When no lat/lng is in the payload, no auto-zoom occurs (map stays at current view). This is the correct behavior — better to show nothing than to zoom to a wrong location.
- Baltic Shield seed data uses absolute Sector Latgale coordinates (not calibration-derived relative offsets) for script reliability. The API route uses calibration-relative offsets since it has direct access to calibrationService.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated COPMapView default center from Taipei to Sector Latgale**
- **Found during:** Task 2 (engagement zoom and display layer review)
- **Issue:** COPMapView had `DEFAULT_CENTER: [25.0, 121.5]` — hardcoded Taipei coordinates with comment "Indo-Pacific — aligned with Pacific Strategy scenario". Map would open centered on Taiwan for Baltic Shield demo.
- **Fix:** Updated to `[56.849, 27.698]` (Sector Latgale, Latvia AO center) with zoom adjusted from 6 to 13
- **Files modified:** frontend/src/components/cop/COPMapView.tsx
- **Verification:** Both tsc --noEmit pass
- **Committed in:** 424181b1 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Updated frontend mgrs-coordinator default calibration from Taipei to Baltic AO**
- **Found during:** Task 2 (reviewing COPGateNotifications calibration constants removal)
- **Issue:** Frontend mgrs-coordinator.ts had `DEFAULT_CALIBRATION` with Taipei Zhongzheng coordinates (south: 25.0420, north: 25.0540, west: 121.5120, east: 121.5180) — would produce wrong room-to-geo conversions for Baltic theater
- **Fix:** Updated to Sector Latgale coordinates matching backend calibration-service.ts fallback profile
- **Files modified:** frontend/src/lib/mgrs-coordinator.ts
- **Verification:** Both tsc --noEmit pass
- **Committed in:** 424181b1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical display correctness)
**Impact on plan:** Both auto-fixes directly relevant to scenario-agnostic display layer — COPMapView opening in wrong country would undermine the Baltic Shield demo. No scope creep.

## Issues Encountered

None — both tasks executed cleanly. TypeScript compilation passed on all changes.

## User Setup Required

None — no external service configuration required. The seed data changes will take effect next time `/api/scenarios/seed-strategic-cop` is called for a problem set. Existing seeded layers (Pacific Strategy data) must be cleared first via `/api/scenarios/clear-strategic-cop`.

## Next Phase Readiness

- Plans 01-03 complete: all core mission execution, intelligence/exercise display, and force disposition layers now scenario-agnostic
- Plan 04 (Baltic Shield demo setup) can proceed — calibration, seed data, and display layer all aligned to Sector Latgale theater

---
*Phase: 64-scenario-agnostic-refactor-and-baltic-shield-demo*
*Completed: 2026-03-29*
