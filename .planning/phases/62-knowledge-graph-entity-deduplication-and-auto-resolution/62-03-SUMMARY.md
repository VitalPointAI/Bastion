---
phase: 62-knowledge-graph-entity-deduplication-and-auto-resolution
plan: 03
subsystem: api
tags: [graph, entity-resolution, deduplication, neo4j, vitest, tdd]

# Dependency graph
requires:
  - phase: 62-01
    provides: EntityResolutionService with findDuplicates and autoMergeDuplicates

provides:
  - POST /graph/resolution/batch-merge endpoint with dryRun preview and execute modes
  - GET /graph/stats endpoint with actor counts and dedup metrics
  - Behavioral unit tests for both endpoints (7 tests, fully mocked)

affects: [frontend-dedup-ui, monitoring, ops-cleanup-scripts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Export handler functions from Express router files for testability without supertest"
    - "Graceful degradation: stats endpoint returns zero dedup metrics when resolution scan fails"
    - "Batch merge skips LLM verification to avoid per-record API cost (batch-safe pattern)"

key-files:
  created:
    - backend/src/api/graph-dedup.test.ts
  modified:
    - backend/src/api/graph.ts

key-decisions:
  - "Export batchMergeHandler and graphStatsHandler as named exports from graph.ts to enable direct unit testing without supertest"
  - "Batch merge uses autoMerge bucket only (score >= 0.95); no LLM verification for batch to avoid per-record cost"
  - "Stats endpoint degrades gracefully: actor counts always returned, dedup metrics zero if resolution scan fails"
  - "Use top-level import of executeReadQuery rather than dynamic import to align with project patterns"

patterns-established:
  - "Handler export pattern: export async function handlerName(req, res) then router.method('/path', handlerName)"

requirements-completed: [DEDUP-05, DEDUP-06]

# Metrics
duration: 8min
completed: 2026-03-29
---

# Phase 62 Plan 03: Batch-Merge and Graph Stats Endpoints Summary

**POST /resolution/batch-merge with dryRun preview and GET /stats with actor counts + dedup metrics, verified by 7 behavioral unit tests via direct handler export pattern**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-29T16:55:00Z
- **Completed:** 2026-03-29T16:59:08Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- POST /graph/resolution/batch-merge: dry-run returns autoMergeCandidates, reviewCandidates, totalCandidates, and sample array without triggering merges; execute mode calls autoMergeDuplicates and returns mergedCount + merges
- GET /graph/stats: returns all 6 required fields (totalActors, activeActors, softDeletedActors, duplicateCandidates, autoMergeCandidates, humanReviewCandidates) with graceful degradation to zero dedup metrics on resolution failure
- 7 behavioral unit tests using direct handler exports (no supertest needed); all tests pass

## Task Commits

Each task was committed atomically (TDD pattern):

1. **RED: graph-dedup.test.ts failing tests** - `a22d9a9d` (test)
2. **GREEN: batch-merge + stats implementation** - `9d209ea9` (feat)

## Files Created/Modified

- `backend/src/api/graph-dedup.test.ts` - 7 behavioral tests: batch-merge dry-run (3), batch-merge execute (2), stats (2) with mocked resolution service and neo4j client
- `backend/src/api/graph.ts` - Added `batchMergeHandler`, `graphStatsHandler` as exported async functions, registered on router; added top-level `executeReadQuery` import

## Decisions Made

- Used direct handler export pattern (`export async function batchMergeHandler`) instead of supertest to avoid adding supertest as a dev dependency
- Batch merge uses `autoMerge` bucket only (score >= 0.95) and never calls LLM verification — aligns with research Pitfall 6 (per-record LLM cost prohibitive for bulk operations)
- Stats endpoint wraps the dedup resolution scan in an inner try/catch so actor count queries always succeed independently
- Top-level import of `executeReadQuery` replaces the dynamic import pattern suggested in the plan — cleaner and consistent with project patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted implementation to actual MergeResult interface**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan code used `m.sourceId`, `m.targetId`, `m.mergedActor.name` but actual `MergeResult` has `canonicalActorId`, `mergedActorIds`, `aliasesAdded`
- **Fix:** Used actual interface fields throughout implementation and tests
- **Files modified:** backend/src/api/graph.ts, backend/src/api/graph-dedup.test.ts
- **Verification:** TypeScript compiles with exit 0, all 7 tests pass
- **Committed in:** 9d209ea9

**2. [Rule 1 - Bug] Adapted MatchCandidate fields in sample mapper**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan used `c.actor1.id`, `c.actor1.name` but `MatchCandidate` has `actor1Id`, `actor1Name`
- **Fix:** Used flat field names matching actual interface
- **Files modified:** backend/src/api/graph.ts
- **Verification:** TypeScript compiles with exit 0
- **Committed in:** 9d209ea9

---

**Total deviations:** 2 auto-fixed (Rule 1 — interface field name mismatches between plan pseudocode and actual types)
**Impact on plan:** Both fixes required for type correctness. No scope creep. Functionality unchanged.

## Issues Encountered

- Plan pseudocode referenced hypothetical `Actor` interface fields (`actor.id`, `actor.name`) not present in the actual `MatchCandidate` type — adapted silently per deviation Rule 1

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Batch-merge endpoint ready for one-time cleanup of existing 28,800+ duplicate nodes via `POST /graph/resolution/batch-merge` with `dryRun: false`
- Graph stats endpoint available for monitoring at `GET /graph/stats`
- Frontend dedup management UI (if planned) can consume both endpoints

---
*Phase: 62-knowledge-graph-entity-deduplication-and-auto-resolution*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: backend/src/api/graph-dedup.test.ts
- FOUND: backend/src/api/graph.ts
- FOUND: .planning/phases/62-.../62-03-SUMMARY.md
- FOUND: commit a22d9a9d (RED: failing tests)
- FOUND: commit 9d209ea9 (GREEN: implementation)
