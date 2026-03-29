---
phase: 62-knowledge-graph-entity-deduplication-and-auto-resolution
plan: 02
subsystem: database
tags: [neo4j, knowledge-graph, entity-resolution, deduplication, name-normalization, osint, typescript, vitest]

# Dependency graph
requires:
  - 62-01 (normalizeActorName() and CANONICAL_ALIASES)
provides:
  - OSINT sync with pre-normalization (PRC→China before MERGE)
  - runPostSyncResolution() export for feed-poller integration
  - feed-poller calls runPostSyncResolution once per poll cycle
  - Graph builder normalizes actor names before lookup/creation
  - Resolution service filters soft-deleted actors from duplicate scans
affects:
  - 62-03 (graph dedup API endpoints — uses same resolution-service)
  - Any OSINT event ingestion creating actor nodes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-MERGE name canonicalization: normalizeActorName(trimmed) before ID generation and MERGE param"
    - "Post-batch resolution: fire-and-forget runPostSyncResolution after stored > 0, once per cycle"
    - "Soft-delete exclusion: listActors(workspaceId, undefined, new Date()) filters validTo actors"
    - "Alias bridging: raw pre-normalization name added as alias when canonical differs"

key-files:
  created:
    - backend/src/osint/osint-graph-sync.test.ts
  modified:
    - backend/src/osint/osint-graph-sync.ts
    - backend/src/osint/feed-poller.ts
    - backend/src/graph/construction/graph-builder.ts
    - backend/src/graph/resolution/resolution-service.ts

key-decisions:
  - "runPostSyncResolution runs once per poll cycle (not per event) to avoid redundant scans per research anti-pattern guidance"
  - "Raw actor name added as alias when canonical differs — ensures relationship lookups can still find the canonical node via original name"
  - "atTime: new Date() passed to listActors to activate temporal filter — excludes soft-deleted (validTo set) actors from resolution candidate scan"

requirements-completed: [DEDUP-02, DEDUP-03, DEDUP-04, DEDUP-07]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 62 Plan 02: OSINT Sync Normalization and Feed-Poller Resolution Integration Summary

**Pre-normalization wired into both ingestion pathways (OSINT sync + graph builder), post-batch entity resolution hooked into feed-poller, and soft-deleted actor exclusion fixed in resolution service**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-29T16:53:59Z
- **Completed:** 2026-03-29T16:57:50Z
- **Tasks:** 2
- **Files modified:** 5 (4 source, 1 test created)

## Accomplishments

- Modified `osint-graph-sync.ts` to call `normalizeActorName()` before MERGE — canonical name used for both `name:` param and actorId generation (PRC → China, ID becomes `ACT-osint-china`)
- Exported `runPostSyncResolution(workspaceId?)` from `osint-graph-sync.ts` — calls `findDuplicates` + `autoMergeDuplicates`, catches all errors so resolution failures never block ingestion
- Modified `feed-poller.ts` to import and call `runPostSyncResolution(feed.problemSetId)` once per poll cycle after `stored > 0`, fire-and-forget with `.catch` warning log
- Modified `graph-builder.ts` to import `normalizeActorName` and apply before `findActorsByName()` and `createActor()` — raw name added as alias when canonical differs
- Fixed `resolution-service.ts` `findDuplicates()` to pass `atTime: new Date()` to `listActors()`, activating temporal filter that excludes soft-deleted actors
- Created `osint-graph-sync.test.ts` with 9 behavioral tests — all pass (TDD GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: OSINT sync normalization + runPostSyncResolution + tests** — `b2b70de5`
2. **Task 2: Feed-poller, graph-builder, resolution-service** — `777b8feb`

## Files Created/Modified

- `backend/src/osint/osint-graph-sync.ts` — normalizeActorName import, canonical in MERGE, runPostSyncResolution export
- `backend/src/osint/osint-graph-sync.test.ts` — 9 tests: PRC→China normalization, actorId canonical, post-sync calls, error swallowing
- `backend/src/osint/feed-poller.ts` — runPostSyncResolution import + call after stored > 0
- `backend/src/graph/construction/graph-builder.ts` — normalizeActorName import + apply before lookup/creation + alias bridging
- `backend/src/graph/resolution/resolution-service.ts` — listActors with atTime filter for soft-delete exclusion

## Decisions Made

- `runPostSyncResolution` runs once per poll cycle not per event — per research pitfall guidance, per-event resolution would fire N times per feed fetch creating excessive Neo4j load
- Raw actor name stored as alias when canonical differs — enables downstream relationship lookups that use the original extracted name to find the canonical node without breaking existing references
- `atTime: new Date()` passed to `listActors` (third param) rather than filtering results inline — the actor-store signature already supports this and uses it for temporal validity filtering in the Cypher query

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Two pre-existing TypeScript errors in `src/api/graph-dedup.test.ts` (Plan 03 test file importing handlers not yet exported) were present before these changes and remain out of scope. My changes introduce zero new TypeScript errors.

## User Setup Required

None — changes are runtime behavior modifications; no migrations, env vars, or external services required.

## Next Phase Readiness

- Plans 62-03 (batch-merge API) and 62-04 (UI) do not depend on OSINT ingestion changes
- Resolution service is now soft-delete-safe for any callers
- Both ingestion pathways now produce canonical actor names, reducing duplicate creation going forward

---
*Phase: 62-knowledge-graph-entity-deduplication-and-auto-resolution*
*Completed: 2026-03-29*

## Self-Check: PASSED

All files confirmed present:
- osint-graph-sync.ts: FOUND
- osint-graph-sync.test.ts: FOUND
- feed-poller.ts: FOUND
- graph-builder.ts: FOUND
- resolution-service.ts: FOUND
- 62-02-SUMMARY.md: FOUND

All commits confirmed:
- b2b70de5 (feat - Task 1): FOUND
- 777b8feb (feat - Task 2): FOUND
