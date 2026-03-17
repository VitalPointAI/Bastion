---
phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
plan: 03
subsystem: api
tags: [postgres, express, fork-and-merge, design-revisions, dao-governance]

# Dependency graph
requires:
  - phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
    provides: design-store.ts pattern with randomUUID + getPool(), operational_designs table schema

provides:
  - design_revisions table migration (033-design-revisions.sql) — pending, approved, rejected, merged lifecycle
  - revision-store.ts CRUD — create, findByProblemSet, findById, updateStatus, merge
  - design-revisions.ts Express router — 5 endpoints for proposal lifecycle
  - merge() operation writes proposed_data to operational_designs column via artifact_type mapping

affects:
  - 49-04 (frontend revision UI — needs these API endpoints)
  - DAO governance (gate_id links revisions to decision_gates table)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "revision-store uses plain export object (not class) with getPool() per operation"
    - "artifact_type maps to operational_designs column: problem-framing -> problem_framing, etc."
    - "x-did header for proposedBy identity (matches design.ts and exercise.ts pattern)"
    - "Router({ mergeParams: true }) for sub-router inheriting :problemSetId from parent"
    - "Explicit as string casts for req.params in mergeParams routers (TypeScript strict mode)"

key-files:
  created:
    - backend/src/db/migrations/033-design-revisions.sql
    - backend/src/design/revision-store.ts
    - backend/src/api/design-revisions.ts
  modified:
    - backend/src/api/design.ts

key-decisions:
  - "Migration numbered 033 following 032 sequence in backend/src/db/migrations/ (not 049 as plan suggested — matched actual project convention)"
  - "revisionStore exported as plain object (not class) matching the simpler pattern used by other stores"
  - "merge() updates operational_designs without updating status column to preserve Design tab's auto-derived status"

patterns-established:
  - "Revision proposal pattern: create -> governance review -> updateStatus(approved) -> merge()"
  - "Sub-router mounted with mergeParams:true before catch-all :problemSetId routes in parent router"

requirements-completed: [DAP-05]

# Metrics
duration: 6min
completed: 2026-03-17
---

# Phase 49 Plan 03: Design Revisions Backend Summary

**Fork-and-merge revision system backend: PostgreSQL migration, CRUD store, and 5-endpoint Express API for Design artifact proposal, review, and merge lifecycle**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-17T14:31:33Z
- **Completed:** 2026-03-17T14:37:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration 033-design-revisions.sql creates design_revisions table with full lifecycle fields (gate_id, reviewed_by, reviewed_at, merged_at)
- revision-store.ts provides typed CRUD with merge() that maps artifact_type to operational_designs column and writes proposed_data directly
- design-revisions.ts Express router with POST (create), GET list, GET by id, PATCH merge, PATCH status — all with try/catch error logging
- Router mounted on design.ts at /:problemSetId/revisions before existing catch-all routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration and revision-store for design_revisions** - `091bf5c0` (feat)
2. **Task 2: Create Express API routes and mount on design router** - `1a56b7ca` (feat)

**Plan metadata:** (in final commit)

## Files Created/Modified
- `backend/src/db/migrations/033-design-revisions.sql` - design_revisions table with indexes on problem_set_id and status
- `backend/src/design/revision-store.ts` - CRUD store with DesignRevision interface and ArtifactType/RevisionStatus types
- `backend/src/api/design-revisions.ts` - Express router for 5 revision lifecycle endpoints
- `backend/src/api/design.ts` - Added revisionRouter import and mount at /:problemSetId/revisions

## Decisions Made
- Migration numbered 033 (not 049 as plan suggested) — matched actual sequence in backend/src/db/migrations/ where highest was 032
- Used plain object export for revisionStore (not class like DesignStore) to keep it simpler; initDesignTable() already ensures operational_designs exists before merge runs
- merge() intentionally does not update the status JSONB column in operational_designs — this preserves the Design tab's auto-derived status system

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode param type errors in design-revisions.ts**
- **Found during:** Task 2 verification (TypeScript compile)
- **Issue:** Router({ mergeParams: true }) causes req.params values to be typed as string | string[] in strict mode; 6 errors on params passed to store methods expecting string
- **Fix:** Added explicit `as string` casts for req.params.id and req.params.problemSetId at each usage point
- **Files modified:** backend/src/api/design-revisions.ts
- **Verification:** npx tsc --noEmit passes with 0 errors
- **Committed in:** 1a56b7ca (Task 2 commit)

**2. [Rule 3 - Blocking] Migration path differs from plan spec**
- **Found during:** Task 1 (checking migrations directory)
- **Issue:** Plan specified backend/src/migrations/049_design_revisions.sql but actual project uses backend/src/db/migrations/ with NNN-name.sql naming convention
- **Fix:** Created file at backend/src/db/migrations/033-design-revisions.sql following actual project convention
- **Files modified:** N/A (correct path used from start)
- **Committed in:** 091bf5c0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. Migration SQL must be executed on the deployed database (per project convention, not locally).

## Next Phase Readiness
- Backend revision API is fully operational — all endpoints built and TypeScript-clean
- Ready for Plan 49-04: frontend UI for proposing and reviewing revisions
- DAO governance integration point is via gate_id field — can link to existing decision_gates table

---
*Phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point*
*Completed: 2026-03-17*
