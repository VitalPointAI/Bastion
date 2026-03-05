---
phase: 21-ai-cop-layer-agent-team
plan: 03
subsystem: layers, persistence, lifecycle
tags: [cop, layer-store, state-machine, version-snapshot, conflict-detection, haversine, audit-trail]

# Dependency graph
requires:
  - phase: 21-01
    provides: COP type system (COPLayerSpec, COPLayer, LayerState, etc.) and backend layer-types
provides:
  - Layer CRUD store with PostgreSQL persistence and in-memory testing variant
  - 4-state lifecycle state machine (Draft->Review->Published->COP) with audit trail
  - Version snapshot store with full/patch strategy and reconstruction
  - Layer assembler for merging sub-agent specs with symbol deduplication
  - Cross-section conflict detector with source authority ranking
affects: [21-04, 21-05, 21-06, 21-07, 21-08, 21-09, 21-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [lifecycle-state-machine, full-vs-patch-snapshots, haversine-distance, source-authority-ranking, in-memory-store-for-testing]

key-files:
  created:
    - backend/src/cop/layers/layer-store.ts
    - backend/src/cop/layers/layer-store.test.ts
    - backend/src/cop/layers/version-store.ts
    - backend/src/cop/layers/version-store.test.ts
    - backend/src/cop/layers/layer-assembler.ts
    - backend/src/cop/layers/conflict-detector.ts
  modified: []

key-decisions:
  - "In-memory store pattern for unit testing: LayerStoreMemory and VersionStoreMemory implement same interface as PostgreSQL variants"
  - "Shallow field-level diff for version patches instead of JSON Patch library -- simpler, sufficient for COPLayerSpec structure"
  - "Haversine distance calculation for position conflict threshold (100m) instead of simple coordinate comparison"

patterns-established:
  - "ILayerStore interface: both memory and PostgreSQL implementations conform to same contract"
  - "State machine as transition map: VALID_TRANSITIONS record defines legal state transitions"
  - "Snapshot strategy: full at COP promotion or first version, patch diffs for intermediate transitions"
  - "Conflict severity ordering: affiliation > position > designation for triage prioritization"

requirements-completed: [LAYER-LIFECYCLE, VERSION-HISTORY, CONFLICT-DETECTION]

# Metrics
duration: 6min
completed: 2026-03-05
---

# Phase 21 Plan 03: Layer Persistence & Lifecycle Summary

**Layer CRUD store with 4-state lifecycle state machine, version snapshots (full at COP/patch for intermediate), layer assembler with symbol dedup, and haversine-based cross-section conflict detector**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-05T19:50:45Z
- **Completed:** 2026-03-05T19:56:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Layer store with full CRUD and lifecycle state machine enforcing Draft->Review->Published->COP transitions with audit trail on every transition
- Version store saves full snapshots at COP promotion and JSON patch diffs for intermediate transitions, with reconstruction from nearest full snapshot
- Layer assembler merges sub-agent specs deduplicating symbols by entityId (highest confidence wins), union of temporal phases by phaseNumber
- Conflict detector identifies position (haversine >100m), affiliation, and designation conflicts across sections with SIGINT>HUMINT>IMINT>OSINT source authority ranking
- 37 tests passing across both test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Layer store with lifecycle state machine** - `9911b70` (test:RED), `7b25b17` (feat:GREEN)
2. **Task 2: Version store, layer assembler, conflict detector** - `6b9b527` (test:RED), `c79a9fb` (feat:GREEN)

## Files Created/Modified
- `backend/src/cop/layers/layer-store.ts` - LayerStore (PostgreSQL) and LayerStoreMemory with CRUD + lifecycle state machine
- `backend/src/cop/layers/layer-store.test.ts` - 20 tests covering CRUD, transitions, audit trail, review feedback
- `backend/src/cop/layers/version-store.ts` - VersionStore with full/patch snapshot strategy and reconstruction
- `backend/src/cop/layers/version-store.test.ts` - 17 tests covering snapshots, assembler, conflict detection
- `backend/src/cop/layers/layer-assembler.ts` - Merges sub-agent specs with symbol dedup and phase union
- `backend/src/cop/layers/conflict-detector.ts` - Cross-section conflict detection with severity sorting and authority ranking

## Decisions Made
- **In-memory store pattern**: Created LayerStoreMemory and VersionStoreMemory implementing same ILayerStore/IVersionStore interfaces as PostgreSQL variants. Enables fast unit testing without database dependency.
- **Shallow field-level diff**: Used simple JSON.stringify comparison per field instead of RFC 6902 JSON Patch library. The COPLayerSpec structure is flat enough that field-level diffs capture all meaningful changes.
- **Haversine for position conflicts**: Used actual geographic distance calculation (meters) rather than simple coordinate comparison, ensuring the 100m threshold is geographically accurate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- System Node.js v12 too old for vitest; resolved by using NVM node v20.18.0 with explicit PATH override (same approach as prior plans in this phase)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layer store ready for API endpoints (plan 21-07 or later)
- Version store ready for snapshot creation on layer transitions
- Conflict detector ready for cross-section analysis during COP promotion
- All exports (LayerStore, layerStore, LayerAssembler, ConflictDetector, detectConflicts, VersionStore, versionStore) available for downstream plans

## Self-Check: PASSED

---
*Phase: 21-ai-cop-layer-agent-team*
*Completed: 2026-03-05*
