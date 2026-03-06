---
phase: 22-training-operational-global-mode
plan: 06
subsystem: api, ui, documents
tags: [pdfkit, docx, watermark, exercise, localStorage, scenario, workspace]

# Dependency graph
requires:
  - phase: 22-01
    provides: mode middleware (req.userMode)
  - phase: 22-02
    provides: ModeContext with useMode hook
  - phase: 22-03
    provides: mode-aware WorkspaceContext, workspace mode filtering
  - phase: 22-04
    provides: exercise dashboard and scenario store
provides:
  - EXERCISE watermark utility for training-mode documents
  - Per-mode workspace memory via mode-keyed localStorage
  - Scenario-to-workspace creation endpoint and frontend service method
affects: [exercise-dashboard, document-export, workspace-selection]

# Tech tracking
tech-stack:
  added: []
  patterns: [mode-keyed-localStorage, exercise-watermark-injection, scenario-workspace-creation]

key-files:
  created:
    - backend/src/middleware/exercise-watermark.ts
  modified:
    - backend/src/planning/documents/types.ts
    - backend/src/planning/documents/generators/pdf-generator.ts
    - backend/src/planning/documents/generators/docx-generator.ts
    - backend/src/api/planning.ts
    - frontend/src/context/WorkspaceContext.tsx
    - frontend/src/lib/workspace-service.ts
    - backend/src/api/workspaces.ts

key-decisions:
  - "Exercise watermark uses PDFKit save/restore pattern with 0.15 opacity red diagonal text"
  - "Mode-keyed localStorage uses workspace-active-id-{mode} pattern for independent workspace memory"
  - "Scenario workspace always created as training mode regardless of user's current mode"

patterns-established:
  - "Exercise watermark: isTrainingMode(req) check + addPdfExerciseWatermark/addExerciseHeader utilities"
  - "Mode-keyed storage: getActiveWorkspaceKey(mode) function for mode-scoped localStorage keys"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 22 Plan 06: Watermark, Workspace Memory, and Scenario Wiring Summary

**EXERCISE watermark on training-mode documents, per-mode workspace persistence via mode-keyed localStorage, and scenario-to-workspace creation API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T00:20:38Z
- **Completed:** 2026-03-06T00:25:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Training-mode document exports (PDF and DOCX) automatically stamped with EXERCISE watermark, header, and filename prefix
- Each mode independently remembers the user's last-active workspace via mode-keyed localStorage keys
- POST /api/workspaces/from-scenario endpoint creates training workspaces pre-populated with scenario data
- Frontend workspace service exposes createFromScenario method for ExerciseDashboard integration

## Task Commits

Each task was committed atomically:

1. **Task 1: EXERCISE watermark on training-mode document exports** - `c7ebe94` (feat)
2. **Task 2: Per-mode workspace memory and scenario-to-workspace creation** - `e25a802` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `backend/src/middleware/exercise-watermark.ts` - Utility: isTrainingMode, addPdfExerciseWatermark, addExerciseHeader, getExerciseFilenamePrefix
- `backend/src/planning/documents/types.ts` - Added exerciseMode option to OPORDGeneratorOptions
- `backend/src/planning/documents/generators/pdf-generator.ts` - Exercise watermark and header injection in PDF output
- `backend/src/planning/documents/generators/docx-generator.ts` - Exercise header paragraph and filename prefix in DOCX output
- `backend/src/api/planning.ts` - modeMiddleware on document routes, passes exerciseMode to generators
- `frontend/src/context/WorkspaceContext.tsx` - Mode-keyed localStorage for per-mode workspace persistence
- `frontend/src/lib/workspace-service.ts` - Added createFromScenario method
- `backend/src/api/workspaces.ts` - POST /api/workspaces/from-scenario endpoint

## Decisions Made
- Exercise watermark uses PDFKit save/restore with 0.15 opacity red diagonal text -- low visual impact but clearly marks documents
- Mode-keyed localStorage pattern (workspace-active-id-{mode}) ensures independent workspace memory per mode
- Scenario workspaces always created with mode='training' regardless of user's current mode, since scenarios are inherently training artifacts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 22 plans complete
- EXERCISE watermark ready for document export flows
- Per-mode workspace memory active for mode switching
- Scenario-to-workspace API ready for ExerciseDashboard integration in future plans

## Self-Check: PASSED

All 8 files verified present. Both task commits (c7ebe94, e25a802) confirmed in git log.

---
*Phase: 22-training-operational-global-mode*
*Completed: 2026-03-06*
