---
phase: 21-ai-cop-layer-agent-team
plan: 05
subsystem: linkage, graph, embeddings
tags: [cop, entity-linkage, neo4j, openai-embeddings, cosine-similarity, confidence-threshold, graph-traversal]

# Dependency graph
requires:
  - phase: 21-01
    provides: COP type system (COPSymbolSpec, layer-types), directory structure
  - phase: 21-02
    provides: Event bus (copEventBus, linkage:discovered event type)
provides:
  - Hybrid entity linker with graph traversal + embedding similarity discovery
  - Confidence threshold evaluator with auto-commit vs human review classification
  - Entity-data linkage PostgreSQL persistence store with CRUD operations
  - Entity context retrieval for hover tooltips (name, affiliation, linked entities, functions, tensions)
affects: [21-06, 21-07, 21-08, 21-09, 21-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [hybrid-graph-embedding-discovery, confidence-threshold-auto-commit, in-memory-test-subclass]

key-files:
  created:
    - backend/src/cop/linkage/confidence-threshold.ts
    - backend/src/cop/linkage/linkage-store.ts
    - backend/src/cop/linkage/entity-linker.ts
    - backend/src/cop/linkage/entity-linker.test.ts
  modified: []

key-decisions:
  - "In-memory LinkageStore subclass pattern for unit testing without PostgreSQL dependency"
  - "Graph traversal 2-hop linkages get 0.9 confidence vs 1.0 for direct relationships"
  - "Embedding similarity candidate threshold at 0.7, separate from auto-commit threshold at 0.85"
  - "Store embeddings as Neo4j entity property for future vector index use"

patterns-established:
  - "Hybrid discovery: graph traversal first, embedding fallback for entities with < 3 graph relationships"
  - "Confidence evaluation: score >= threshold auto-commits, below threshold queues for human review"
  - "Deduplication by entity pair (sorted IDs), keeping highest confidence result"
  - "Affiliation detection: strongest alliance relationship > 0.5 strength"

requirements-completed: [ENTITY-LINKAGE, HYBRID-DISCOVERY, AUTO-COMMIT-THRESHOLD]

# Metrics
duration: 6min
completed: 2026-03-05
---

# Phase 21 Plan 05: Entity Linkage System Summary

**Hybrid graph traversal + embedding similarity entity linker with 0.85 auto-commit threshold and PostgreSQL linkage persistence**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-05T19:51:30Z
- **Completed:** 2026-03-05T19:57:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Confidence threshold evaluator correctly classifies linkages at boundary values (0.80 = review, 0.85 = auto-commit, 0.90 = auto-commit) with custom threshold support
- LinkageStore with PostgreSQL persistence: create, query by entity/symbol, pending reviews, review approval/rejection
- Hybrid EntityLinker: graph traversal (1-2 hops, confidence 1.0/0.9) + embedding similarity (text-embedding-3-large, cosine > 0.7) with deduplication
- Entity context retrieval for hover tooltips (name, type, affiliation, linked entities, functions, tensions)
- 12 tests passing via vitest with in-memory LinkageStore subclass

## Task Commits

Each task was committed atomically:

1. **Task 1: Confidence threshold and linkage store** - `66337dd` (test:RED), `9a6455b` (feat:GREEN)
2. **Task 2: Hybrid entity linker** - `8bcb3b4` (feat)

## Files Created/Modified
- `backend/src/cop/linkage/confidence-threshold.ts` - Confidence evaluation with 0.85 default threshold, custom config support
- `backend/src/cop/linkage/linkage-store.ts` - PostgreSQL persistence for entity-data linkages with CRUD and review workflow
- `backend/src/cop/linkage/entity-linker.ts` - Hybrid EntityLinker: graph traversal + embedding similarity discovery, entity context retrieval
- `backend/src/cop/linkage/entity-linker.test.ts` - 12 tests for confidence threshold and linkage store (vitest, in-memory)

## Decisions Made
- **In-memory test subclass**: Created InMemoryLinkageStore extending LinkageStore to test CRUD logic without PostgreSQL. Overrides all methods to use array storage.
- **2-hop confidence decay**: Direct graph relationships get confidence=1.0, 2-hop relationships get 0.9 to reflect reduced certainty at distance.
- **Embedding fallback strategy**: Only runs embedding similarity when graph traversal finds fewer than 3 relationships, avoiding unnecessary API calls for well-connected entities.
- **Embedding storage on entities**: Stores generated embeddings as Neo4j entity properties for reuse. Falls back gracefully if storage fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest imports required for test file**
- **Found during:** Task 1 (RED test execution)
- **Issue:** Test file used bare `describe/it/expect` which work with jest but the project uses vitest
- **Fix:** Added `import { describe, it, expect, beforeEach } from 'vitest'` to test file
- **Files modified:** backend/src/cop/linkage/entity-linker.test.ts
- **Verification:** `npx vitest run src/cop/linkage` passes all 12 tests
- **Committed in:** 9a6455b (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor import fix to match project test runner. No scope creep.

## Issues Encountered
None - plan executed cleanly after vitest import fix.

## User Setup Required
None - no external service configuration required. OpenAI embeddings use existing @langchain/openai dependency.

## Next Phase Readiness
- Entity linker ready for integration with layer generation agents (21-06, 21-07)
- Linkage store ready for UI tooltip/detail view consumption (21-08, 21-09)
- Confidence threshold configurable per workspace for operational tuning
- Event bus integration enables activity feed visibility for discovered linkages

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
