---
phase: 45-knowledge-graph-subspaces
plan: 02
subsystem: api
tags: [brain, subspaces, lenses, neo4j, n-hop, postgresql, rest-api]
dependency_graph:
  requires:
    - phase: 45-01
      provides: brain_subspaces table, brain_lenses table, BrainSubspace type, BrainLens type
  provides:
    - subspace-store.ts with createSubspace/getSubspaces/getSubspaceById/updateSubspace/deleteSubspace
    - lens-store.ts with createLens/getLenses/getLensById/updateLens/deleteLens/cloneLens
    - brain-subspaces.ts REST API router (11 endpoints)
    - N-hop neighbor query endpoint with LIMIT cap
  affects: [Phase 45 Plans 03-06 (frontend hooks consume these endpoints)]
tech_stack:
  added: []
  patterns: [getPool() for PostgreSQL access, executeReadQuery for Neo4j, x-did header for userId, router mounted alongside existing brain.ts at /api/brain]
key_files:
  created:
    - backend/src/graph/subspace/subspace-store.ts
    - backend/src/graph/subspace/lens-store.ts
    - backend/src/api/brain-subspaces.ts
  modified:
    - backend/src/index.ts
key_decisions:
  - "Mounted brainSubspacesRouter at /api/brain alongside existing brainRouter — no path collision since existing routes use /annotations and /snapshots, new routes use /subspaces, /lenses, /nhop"
  - "N-hop LIMIT: 200 nodes for hops<=2, 100 for hops>2 to cap result set size"
  - "Built-in lens deletion returns HTTP 403 (distinguished from 400) to allow frontend to show specific error"
  - "cloneLens produces name with (copy) suffix and sets cloned_from FK for lens inheritance tracing"
patterns-established:
  - "getPool() from lib/database.js — consistent PostgreSQL access pattern"
  - "x-did header for user identity (matches existing brain.ts)"
  - "Two-step N-hop query: first find neighbors, then fetch edges between them"
requirements-completed: [SUB-CRUD, LENS-CRUD, NHOP-ENDPOINT]
duration: 3min
completed: "2026-03-14"
---

# Phase 45 Plan 02: Backend Infrastructure for Subspaces, Lenses, and N-Hop Queries Summary

**PostgreSQL CRUD stores and Express REST API for brain subspaces and lenses, plus a two-step Neo4j N-hop neighbor query endpoint, wired into the API index at /api/brain.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T10:32:24Z
- **Completed:** 2026-03-14T10:35:12Z
- **Tasks:** 2
- **Files modified:** 4 (2 created stores, 1 created router, 1 modified index)

## Accomplishments
- subspace-store.ts: 5 CRUD functions for brain_subspaces table using parameterized SQL
- lens-store.ts: 6 CRUD functions for brain_lenses table including cloneLens with cloned_from FK reference and built-in deletion guard
- brain-subspaces.ts: 11 REST endpoints (4 subspace, 5 lens, 1 nhop) with input validation and appropriate HTTP status codes
- N-hop query uses two-step Cypher: first MATCH path to collect neighbors (LIMIT 100-200), then fetch edges between all result nodes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create subspace and lens PostgreSQL stores** - `d3afec4` (feat)
2. **Task 2: Create REST API router for subspaces, lenses, and N-hop queries** - `3da1827` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `backend/src/graph/subspace/subspace-store.ts` - CRUD for brain_subspaces table: createSubspace, getSubspaces (user's own + shared), getSubspaceById, updateSubspace, deleteSubspace
- `backend/src/graph/subspace/lens-store.ts` - CRUD for brain_lenses table: createLens, getLenses (own + shared + built-in), getLensById, updateLens, deleteLens (blocks built-in), cloneLens
- `backend/src/api/brain-subspaces.ts` - Express router with 11 endpoints: GET/POST /subspaces, PUT/DELETE /subspaces/:id, GET/POST /lenses, PUT/DELETE /lenses/:id, POST /lenses/:id/clone, GET /nhop
- `backend/src/index.ts` - Added import and mount of brainSubspacesRouter at /api/brain

## Decisions Made
- Mounted new router alongside existing brain.ts at the same `/api/brain` prefix — no collision because existing routes use `/annotations`/`/snapshots` and new routes use `/subspaces`/`/lenses`/`/nhop`
- N-hop LIMIT: 200 for hops <= 2, 100 for hops > 2 to cap result size
- Built-in lens delete returns 403 (not 400) so frontend can distinguish "you can't delete this" from "bad request"
- `cloneLens` appends "(copy)" to name and sets `cloned_from` FK for lens inheritance tracing

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All backend endpoints ready for Phase 45 Plans 03-06 (frontend hooks)
- Subspace CRUD: /api/brain/subspaces
- Lens CRUD: /api/brain/lenses
- N-hop query: /api/brain/nhop?workspaceId=X&nodeId=Y&hops=N

---
*Phase: 45-knowledge-graph-subspaces*
*Completed: 2026-03-14*
