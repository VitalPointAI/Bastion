---
phase: 47-json-ld-semantic-brain-cop-fix
plan: "02"
subsystem: graph-semantic
tags: [tdd, test-scaffolding, confidence, contradiction, entity-resolution, temporal, brain-timeline]
dependency_graph:
  requires: []
  provides:
    - confidence-calculator-tests
    - contradiction-detector-tests
    - actor-store-tests
    - resolution-service-tests
    - brain-timeline-tests
  affects:
    - 47-03-plan (actor-store JSON-LD implementation — tests go GREEN)
    - 47-04-plan (brain timeline temporal filter — tests go GREEN)
    - 47-05-plan (contradiction detector — tests go GREEN)
    - 47-06-plan (entity resolution hybrid scoring — tests go GREEN)
tech_stack:
  added: []
  patterns:
    - vitest dynamic import for RED-phase test scaffolding (module does not exist yet)
    - vi.mock for Neo4j client isolation in unit tests
    - toBeCloseTo for floating-point confidence comparisons
key_files:
  created:
    - backend/src/graph/confidence-calculator.test.ts
    - backend/src/graph/contradiction-detector.test.ts
    - backend/src/graph/raft/actor-store.test.ts
    - backend/src/graph/resolution/resolution-service.test.ts
    - frontend/src/components/brain/hooks/useBrainTimeline.test.ts
  modified: []
decisions:
  - Dynamic `import()` inside test `it()` blocks allows test files to compile even when the implementation module does not exist yet — chosen for RED-phase scaffolding
  - contradiction-detector tests mock Neo4j client entirely; behavioral assertions check that executeWriteQuery is called with CONTRADICTS in the query string
  - useBrainTimeline tests separate pure utilities (filterByTemporalValidity, getStalenessOpacity) from React hook state — allows node.js test environment without DOM
  - actor-store tests verify Cypher query string content to ensure JSON-LD properties are included in CREATE statements
metrics:
  duration_seconds: 352
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 47 Plan 02: TDD Test Scaffolding Summary

**One-liner:** Wave 0 TDD scaffolds for confidence decay/fusion, contradiction detection, actor JSON-LD storage, hybrid entity resolution, and brain timeline temporal filtering — 25 tests GREEN, remaining 4 files RED awaiting implementation.

## What Was Built

Five test files created to define expected behavior before implementation. These tests drive the subsequent implementation plans (03–06) via TDD. The confidence-calculator tests run GREEN immediately (implementation already existed). The remaining four are RED, importing modules that don't exist yet.

### Task 1: confidence-calculator.test.ts + contradiction-detector.test.ts

**confidence-calculator.test.ts** (25 tests — GREEN):
- `computeDecayedConfidence`: half-life decay at 1x/2x, zero-age no-op, very old near-zero
- `fuseConfidence`: empty array → 0, single source → identity, two-source (0.95+0.65=0.9825), three-source, commutativity
- `SOURCE_WEIGHTS`: all 6 sources defined, values in 0-1, ordering (manual > sigint > ... > ai)
- `HALF_LIFE_DEFAULTS`: all 5 fact types, personnel=180, geographic=1825, political=90

**contradiction-detector.test.ts** (8 test cases — RED until Plan 05):
- Detects: same entity + same property + different values + overlapping temporal range
- Returns null for: non-overlapping ranges (historical succession — Pitfall 7 guard), same values, different entities, different properties
- Confidence penalty: verifies `executeWriteQuery` called with `:CONTRADICTS` in query
- Handles validTo=null on assertion A (currently valid) correctly

### Task 2: actor-store.test.ts + resolution-service.test.ts + useBrainTimeline.test.ts

**actor-store.test.ts** (3 suites — RED until Plan 03):
- `createActor (JSON-LD)`: jsonldType (CCO URI), jsonldContext (canonical URL), assertedBy, assertedVia, derivedFrom (JSON string), confidence, sourceWeight, validFrom, validTo=null, halfLifeDays; Cypher CREATE includes all new properties
- `temporal queries`: listActorsAtTime uses `(validTo IS NULL OR validTo > atTime)` Pitfall 3 guard
- `staleness decay`: listActorsWithDecay returns decayedConfidence in query projection

**resolution-service.test.ts** (4 suites — RED until Plan 06):
- `computeHybridScore`: 0.4*string + 0.4*embedding + 0.2*type formula verified at known inputs
- `classifyHybridScore`: >= 0.85 auto_merge, 0.5–0.85 human_review, < 0.5 distinct; boundary conditions at 0.85 and 0.5
- `computeEmbeddingSimilarity`: uses LLM factory, returns 0-1, high similarity for identical text
- `computeOntologyTypeScore`: same type = 1.0, different type = 0.0, undefined = 0.0

**useBrainTimeline.test.ts** (3 suites — RED until Plan 04):
- `filterByTemporalValidity`: expired excluded, null validTo included, within-window included, future excluded, backward-compat (no temporal fields included), mixed array correctly filtered
- `getStalenessOpacity`: high (>0.85) → 1.0, medium (0.5–0.85) → 0.7, low (<0.5) → 0.4; boundary conditions
- `playback state`: API shape verification, time-advance produces correct filter results

## Deviations from Plan

None — plan executed exactly as written. The confidence-calculator implementation was already present from a prior task, so those tests are immediately GREEN rather than RED. This is a positive deviation (implementation ahead of tests) that accelerates Plan 02 progress.

## Test Results Summary

| File | Status | Tests |
|------|--------|-------|
| confidence-calculator.test.ts | GREEN (25/25) | All passing — implementation exists |
| contradiction-detector.test.ts | RED (module missing) | Activates in Plan 05 |
| actor-store.test.ts | RED (methods missing) | Activates in Plan 03 |
| resolution-service.test.ts | RED (functions missing) | Activates in Plan 06 |
| useBrainTimeline.test.ts | RED (exports missing) | Activates in Plan 04 |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| backend/src/graph/confidence-calculator.test.ts | FOUND |
| backend/src/graph/contradiction-detector.test.ts | FOUND |
| backend/src/graph/raft/actor-store.test.ts | FOUND |
| backend/src/graph/resolution/resolution-service.test.ts | FOUND |
| frontend/src/components/brain/hooks/useBrainTimeline.test.ts | FOUND |
| Commit d103d564 (Task 1) | FOUND |
| Commit 4bd207df (Task 2) | FOUND |
