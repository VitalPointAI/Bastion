---
phase: 62-knowledge-graph-entity-deduplication-and-auto-resolution
plan: 01
subsystem: database
tags: [neo4j, knowledge-graph, entity-resolution, deduplication, name-normalization, typescript, vitest]

# Dependency graph
requires: []
provides:
  - normalizeActorName() function — maps geopolitical/military actor name variants to canonical display names
  - CANONICAL_ALIASES registry — static lookup table for US, China (PRC), Korea, Russia, NATO, PLA, INDOPACOM variants
  - name-normalizer.ts re-export module — stable import path for downstream consumers
  - Resolution barrel export updated — normalizeActorName and CANONICAL_ALIASES accessible via index.ts
affects:
  - 62-02 (OSINT sync pre-normalization wiring)
  - 62-03 (graph builder pre-normalization wiring)
  - Any downstream code importing from backend/src/graph/resolution/

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-ingestion name canonicalization: call normalizeActorName() before any MERGE or createActor() call"
    - "Alias registry pattern: lowercase+whitespace-normalized keys in a static Record<string, string>"
    - "ROC/Taiwan is NOT China: 'Republic of China' must never map to 'China' — geopolitically distinct entities"

key-files:
  created:
    - backend/src/graph/resolution/canonical-aliases.ts
    - backend/src/graph/resolution/name-normalizer.ts
    - backend/src/graph/resolution/name-normalizer.test.ts
  modified:
    - backend/src/graph/resolution/index.ts

key-decisions:
  - "normalizeActorName() is for display-name canonicalization, not comparison — distinct from normalizeName() in string-matcher.ts which lowercases for similarity scoring"
  - "Republic of China is intentionally NOT mapped to China — Taiwan/ROC is a distinct geopolitical entity from PRC"
  - "Lookup key uses .toLowerCase().replace(/\\s+/g, ' ') to handle multi-space inputs without requiring exact whitespace matches"

patterns-established:
  - "Canonical alias lookup: trim → lowercase → collapse whitespace → lookup → return canonical or original trimmed"
  - "name-normalizer.ts as thin re-export wrapper: provides stable import path without duplicating logic"

requirements-completed: [DEDUP-01]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 62 Plan 01: Canonical Alias Registry and Name Normalizer Summary

**Static geopolitical alias registry (50 entries) and normalizeActorName() function with 31 unit tests, wired into the resolution barrel for downstream OSINT and graph-builder integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T16:48:49Z
- **Completed:** 2026-03-29T16:53:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `canonical-aliases.ts` with CANONICAL_ALIASES record covering US, China (PRC), North/South Korea, Russia, NATO, PLA, INDOPACOM variants and normalizeActorName() function
- Created `name-normalizer.ts` as thin re-export providing stable import path for downstream consumers
- Created `name-normalizer.test.ts` with 31 unit tests covering all alias groups, case insensitivity, whitespace trimming, ROC/Taiwan distinction, and pass-through behavior
- Updated `resolution/index.ts` barrel to export normalizeActorName and CANONICAL_ALIASES
- TypeScript compiles cleanly, all 31 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `9a6f8ad0` (test)
2. **Task 1 GREEN: canonical-aliases.ts + name-normalizer.ts** - `2685236c` (feat)
3. **Task 2: Resolution barrel update** - `920626c7` (feat)

_Note: TDD task produced test commit (RED) then implementation commit (GREEN)_

## Files Created/Modified
- `backend/src/graph/resolution/canonical-aliases.ts` - CANONICAL_ALIASES record and normalizeActorName() function
- `backend/src/graph/resolution/name-normalizer.ts` - Thin re-export wrapper for stable import paths
- `backend/src/graph/resolution/name-normalizer.test.ts` - 31 unit tests across all alias groups and edge cases
- `backend/src/graph/resolution/index.ts` - Added normalizeActorName and CANONICAL_ALIASES barrel exports

## Decisions Made
- normalizeActorName() maps to display-name canonical forms, NOT lowercase — distinct from normalizeName() in string-matcher.ts which lowercases for string similarity comparison
- ROC/Taiwan ("Republic of China") intentionally NOT mapped to "China" — per entity-resolution-agent.ts knowledge, these are distinct geopolitical entities; only "PRC" / "People's Republic of China" maps to "China"
- Internal whitespace normalized with `.replace(/\s+/g, ' ')` to handle double-space variants like "United  States  of  America"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- normalizeActorName() and CANONICAL_ALIASES are ready for Plans 02 and 03 to wire into OSINT sync and graph builder
- Import via barrel: `import { normalizeActorName } from '../graph/resolution/index.js'`
- Import directly: `import { normalizeActorName } from '../graph/resolution/name-normalizer.js'`

---
*Phase: 62-knowledge-graph-entity-deduplication-and-auto-resolution*
*Completed: 2026-03-29*

## Self-Check: PASSED

All files confirmed present:
- canonical-aliases.ts: FOUND
- name-normalizer.ts: FOUND
- name-normalizer.test.ts: FOUND
- index.ts: FOUND
- 62-01-SUMMARY.md: FOUND

All commits confirmed:
- 9a6f8ad0 (test - RED): FOUND
- 2685236c (feat - GREEN): FOUND
- 920626c7 (feat - barrel): FOUND
