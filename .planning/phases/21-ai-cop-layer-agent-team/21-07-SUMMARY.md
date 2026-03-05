---
phase: 21-ai-cop-layer-agent-team
plan: 07
subsystem: api, cop, triggers
tags: [cop-api, express-router, zod-validation, document-commit-trigger, layer-lifecycle, agent-control, conflict-detection]

# Dependency graph
requires:
  - phase: 21-02
    provides: Event bus (copEventBus), trigger handler, activity bridge, agent definitions
  - phase: 21-03
    provides: Layer store CRUD, lifecycle state machine, version store, conflict detector
  - phase: 21-05
    provides: Linkage store with pending reviews, review workflow
  - phase: 21-06
    provides: COP coordinator (runCOPGeneration), sub-agent invocation
provides:
  - REST API endpoints for all COP operations (layers, versions, agents, linkages, conflicts)
  - COP module initialization (initCOP) with CCO schema, tables, triggers, agent seeding
  - Document commit trigger wiring from strategic API objective approval and intent creation
  - copRouter mounted at /api/cop on Express application
  - getCOPTriggerHandler() for external trigger integration
affects: [21-08, 21-09, 21-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [handler-group-objects, zod-request-validation, param-helper-for-express-types, dependency-injection-via-setter]

key-files:
  created:
    - backend/src/cop/api/cop-handlers.ts
    - backend/src/cop/api/cop-routes.ts
    - backend/src/cop/index.ts
  modified:
    - backend/src/index.ts
    - backend/src/api/strategic.ts

key-decisions:
  - "Handler dependency injection via setHandlerDependencies() called from initCOP() rather than module-level singletons -- avoids circular import issues"
  - "Document commit trigger uses Option C from plan: lightweight copEventBus.emit in strategic.ts at approval points rather than middleware hooks"
  - "Non-fatal COP trigger: strategic API approval flow never fails due to COP trigger errors -- all trigger calls wrapped in try/catch"

patterns-established:
  - "COP handler groups: layerHandlers, versionHandlers, agentHandlers, linkageHandlers, conflictHandlers as named exports"
  - "qs() and param() helpers for Express query/params type safety (handles string | string[] union)"
  - "Zod schemas per request body with validateBody() helper returning null on error (response already sent)"
  - "initCOP() idempotent module initialization pattern with explicit dependency injection into handlers"

requirements-completed: [COP-API, LAYER-MANAGEMENT-API, AGENT-CONTROL-API]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 21 Plan 07: COP REST API & Module Initialization Summary

**Full COP REST API with 20 endpoints (layer CRUD, lifecycle, versions, agent control, linkage review, conflicts) plus module init with document commit trigger wiring from strategic API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T20:16:17Z
- **Completed:** 2026-03-05T20:22:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- 20 REST API endpoints across 5 handler groups: layer CRUD/lifecycle (7), version browsing (3), agent control (4), linkage review (3), conflict detection (1)
- Zod validation schemas for all request bodies with proper error responses (400/404/409/500)
- COP module initialization (initCOP) with CCO schema loading, table creation, event bus wiring, agent seeding, and dependency injection
- Document commit triggers wired: strategic.ts objective APPROVE and intent creation automatically fire COP layer generation via triggerHandler.handleCommitTrigger

## Task Commits

Each task was committed atomically:

1. **Task 1: COP API routes and handlers** - `9d12207` (feat)
2. **Task 2: COP module initialization with document commit trigger wiring** - `dae875f` (feat)

## Files Created/Modified
- `backend/src/cop/api/cop-handlers.ts` - 5 handler groups with Zod validation, type-safe param/query extraction, workspace-scoped access
- `backend/src/cop/api/cop-routes.ts` - Express router mounting 20 endpoints with requireAuth middleware
- `backend/src/cop/index.ts` - Module barrel with initCOP(), agent seeding, event bus wiring, getCOPTriggerHandler()
- `backend/src/index.ts` - Added COP router mount at /api/cop and initCOP() call in server startup
- `backend/src/api/strategic.ts` - Added COP trigger hooks at objective APPROVE and intent creation endpoints

## Decisions Made
- **Dependency injection via setter**: Used setHandlerDependencies() to inject TriggerHandler and ActivityBridge instances into handlers rather than importing singletons. This avoids circular imports between cop/index.ts (which creates instances) and cop-handlers.ts (which uses them).
- **Option C for document commit wiring**: Strategic.ts has no event system or middleware hooks, so added direct getCOPTriggerHandler().handleCommitTrigger() calls at approval points. Wrapped in try/catch so COP failures never break the strategic workflow.
- **Pairwise conflict deduplication**: The GET /cop/conflicts endpoint runs pairwise conflict detection across all COP-state layers, then deduplicates by sorted layer-pair + entity + conflict-type key to avoid reporting A-vs-B and B-vs-A as separate conflicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Express query/param type safety**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Express `req.query` returns `string | string[] | ParsedQs | ...` and `req.params` returns `string | string[]`, causing 15+ TypeScript errors when passed to functions expecting `string`
- **Fix:** Added `qs()` helper for query params and `param()` helper for route params that safely extract string values
- **Files modified:** backend/src/cop/api/cop-handlers.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 9d12207 (Task 1 commit)

**2. [Rule 3 - Blocking] Zod z.record() requires 2 args in project's version**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `z.record(z.unknown())` failed with "Expected 2-3 arguments, but got 1" -- project's zod version requires explicit key type
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** backend/src/cop/api/cop-handlers.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 9d12207 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were TypeScript type safety issues. No scope creep.

## Issues Encountered
None beyond the auto-fixed type safety issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All COP REST endpoints ready for frontend integration (21-08, 21-09)
- Document commit triggers active: approving objectives or creating intents fires COP generation
- Module initialization wired into server startup lifecycle
- All COP exports (copRouter, copEventBus, runCOPGeneration, layerStore, linkageStore, getCOPTriggerHandler) available for downstream plans

## Self-Check: PASSED

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
