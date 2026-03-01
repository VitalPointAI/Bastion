---
phase: 14-friendly-adversary-ipb-complete-cycle
plan: 11
subsystem: api
tags: [express, typescript, ipb, sitrep, delta-preview, llm]

# Dependency graph
requires:
  - phase: 14-friendly-adversary-ipb-complete-cycle
    provides: "IPBService.updateIPBFromSITREP, IPBPanel delta preview UI (Plans 14-03, 14-07)"
provides:
  - "POST /api/exercise/ipb/:assessmentId/sitrep-preview endpoint (no-persist delta preview)"
  - "IPBService.previewIPBFromSITREP() method returning SITREPDeltaPreview"
  - "SITREPDeltaPreview interface exported from ipb-service.ts"
affects:
  - "14-friendly-adversary-ipb-complete-cycle"
  - "frontend IPBPanel delta preview modal (end-to-end flow unblocked)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step SITREP update flow: preview (no persist) then confirm (createNewVersion)"
    - "Synthetic IPBAssessment construction for delta comparison without DB write"

key-files:
  created: []
  modified:
    - "backend/src/exercise/ipb-service.ts"
    - "backend/src/api/exercise.ts"

key-decisions:
  - "Reuse existing LLM delta extraction logic (deltaPrompt) in previewIPBFromSITREP, stopping before createNewVersion — avoids duplication while keeping the no-persist guarantee"
  - "Build a synthetic IPBAssessment object for generateDeltaSummary comparison so the preview uses identical delta logic as the actual update"
  - "Query scenario_coas for affectedCOAs using same scenario+team as the assessment — any COA for that scenario/team is potentially impacted by IPB changes"
  - "Place sitrep-preview route BEFORE update-from-sitrep in exercise.ts to avoid any path ambiguity"

patterns-established:
  - "Preview-then-commit pattern: separate endpoint returns delta without side effects; commit endpoint (update-from-sitrep) persists the change"

requirements-completed: [EX-15]

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 14 Plan 11: SITREP Delta Preview Backend Summary

**LLM-powered SITREP delta preview endpoint (POST /ipb/:assessmentId/sitrep-preview) that returns changedFields, affectedCOAs, and sitrepSummary without persisting any IPB version**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T03:13:48Z
- **Completed:** 2026-03-01T03:16:05Z
- **Tasks:** 1 of 1
- **Files modified:** 2

## Accomplishments

- Added `SITREPDeltaPreview` interface to `ipb-service.ts` matching the frontend type shape exactly
- Implemented `IPBService.previewIPBFromSITREP()` — runs same LLM delta extraction as `updateIPBFromSITREP` but stops before calling `ipbStore.createNewVersion()`
- Added `POST /api/exercise/ipb/:assessmentId/sitrep-preview` Express route in `exercise.ts` before the existing `update-from-sitrep` route
- Frontend IPBPanel delta preview modal is now fully unblocked end-to-end (no more 404)
- Requirement EX-15 closed

## Task Commits

Each task was committed atomically:

1. **Task 1: Add previewIPBFromSITREP method and Express route** - `ccb1d43` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/src/exercise/ipb-service.ts` - Added `SITREPDeltaPreview` interface and `previewIPBFromSITREP()` method (~160 lines)
- `backend/src/api/exercise.ts` - Added `POST /ipb/:assessmentId/sitrep-preview` route before `update-from-sitrep`

## Decisions Made

- Reused existing LLM delta extraction logic (deltaPrompt template) from `updateIPBFromSITREP` rather than creating a separate prompt — ensures consistent delta identification between preview and commit paths
- Built a synthetic `IPBAssessment` object to pass to `generateDeltaSummary()` — avoids writing to DB while using the exact same comparison logic
- Queried `scenario_coas` for affected COAs via pool directly (constructor already receives pool) — any COA for the same scenario+team is potentially impacted by IPB changes
- `sitrepSummary` is the first 500 characters of the SITREP text content — a quick excerpt for staff context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The Node.js version in the shell context was v12 (which can't run tsc) but NVM v22 was available and resolved this transparently during type checking.

## Next Phase Readiness

- EX-15 is closed — the SITREP two-step flow (preview then confirm) is fully implemented end-to-end
- Frontend IPBPanel can call `previewIPBFromSITREP`, display the delta modal, and then call `updateIPBFromSITREP` on confirm
- No further backend work needed for the SITREP delta preview gap

---
*Phase: 14-friendly-adversary-ipb-complete-cycle*
*Completed: 2026-03-01*
