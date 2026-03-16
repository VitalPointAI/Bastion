---
phase: 47-json-ld-semantic-brain-cop-fix
plan: 09
subsystem: graph-ingestion-pipelines
tags: [json-ld, provenance, osint, vision, doc-intelligence, graph-builder, entity-resolution, contradiction-detection]
dependency_graph:
  requires: [47-03, 47-05]
  provides: [all-ingestion-paths-write-jsonld-provenance]
  affects: [confidence-fusion, contradiction-detection, brain-visualization, cop-confidence-tiers]
tech_stack:
  added: []
  patterns:
    - "provenance second-parameter pattern on all RAFT store creates"
    - "JSON-LD fields written inline on direct Cypher MERGE queries"
    - "entity resolution triggered post-write from all ingestion paths"
key_files:
  modified:
    - backend/src/graph/construction/graph-builder.ts
    - backend/src/doc-intelligence/specialists/fact-extractor.ts
    - backend/src/osint/osint-graph-sync.ts
    - backend/src/robot/vision-cop-pipeline.ts
decisions:
  - "graph-builder defaults assertedVia='ai_inference' when not passed by caller — callers must override"
  - "OSINT entities use halfLifeDays=90 (political) as default; capability content not distinguished here"
  - "Vision detections use halfLifeDays=1 — tactical intelligence is maximally perishable"
  - "contradiction detection scoped to 'type' property on actor update — not all properties (avoids noise)"
  - "entity resolution triggered post-write for osint/vision — graph-builder already had this via runEntityResolution flag"
metrics:
  duration: 15 min
  completed: "2026-03-16"
  tasks_completed: 2
  files_modified: 4
---

# Phase 47 Plan 09: Ingestion Pipeline JSON-LD Wiring Summary

All 4 ingestion pathways now write JSON-LD native properties with correct source-specific provenance on every entity creation.

## What Was Built

### Task 1: graph-builder + fact-extractor

**graph-builder.ts** (LLM entity extraction):
- Added `assertedVia?: SourceMethod` and `assertedBy?: string` to `GraphBuildOptions`
- Imports `SOURCE_WEIGHTS`, `HALF_LIFE_DEFAULTS`, `ACTOR_TYPE_TO_CCO_MAP`, `detectContradiction`
- All `actorStore.createActor()`, `relationshipStore.createRelationship()`, `tensionStore.createTension()` calls now pass provenance second parameter
- Half-life derived from entity type: personnel=180 days, geographic=1825 days, political=90 days
- Contradiction detection called on actor `type` property conflicts when merging existing actors
- Default: `assertedVia='ai_inference'`, `assertedBy='system:llm-extraction'`

**fact-extractor.ts** (doc intelligence):
- Added `uploadedBy?: string` to `FactExtractorInput` for tracking document uploader
- `buildGraphEntities()` now passes `assertedVia: 'doc_intelligence'` and `assertedBy` to graphBuilder
- Every entity created through this path carries doc_intelligence provenance (sourceWeight=0.75)

### Task 2: OSINT sync + vision pipeline

**osint-graph-sync.ts**:
- Imports `SOURCE_WEIGHTS`, `ACTOR_TYPE_TO_CCO_MAP`, `entityResolutionService`
- All OSINT event Actor MERGE queries write JSON-LD fields inline:
  - `assertedVia='osint'`, `assertedBy='system:osint-feed-poller'`
  - `confidence=0.65` (SOURCE_WEIGHTS['osint']), `sourceWeight=0.65`
  - `validFrom` from article publication date (or now), `halfLifeDays=90`
  - `derivedFrom` = JSON.stringify([feedId, articleUrl])
- Actor and RELATES_TO edge both get full JSON-LD provenance sets
- Entity resolution triggered post-write (auto-merge threshold only)

**vision-cop-pipeline.ts**:
- Imports `SOURCE_WEIGHTS`, `entityResolutionService`
- All threat Actor, robot Actor, and RELATES_TO edge writes include JSON-LD fields:
  - `assertedVia='vision_pipeline'`, `assertedBy='system:yolov8-detector'`
  - `confidence = detectionConfidence * 0.70`, `sourceWeight=0.70`
  - `halfLifeDays=1` (tactical detections are maximally perishable)
  - `attributes_lat`, `attributes_lng`, `attributes_affiliation` promoted as top-level properties
  - `jsonldType = 'cco:Person'` for personnel, `'jc3:Equipment'` for vehicles/armor/aircraft
  - `derivedFrom = JSON.stringify([entityId, sourceDocumentId])`
- Entity resolution triggered after all symbols written

## Verification

TypeScript compilation: PASSED (0 errors) — all 4 files + full backend

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ResolutionResult type mismatch**
- **Found during:** Task 2 compilation check
- **Issue:** `findDuplicates()` returns `ResolutionResult` object (not array); code checked `.length` directly
- **Fix:** Changed to `resolution.autoMerge.length > 0` to check the auto-merge candidates array
- **Files modified:** osint-graph-sync.ts, vision-cop-pipeline.ts
- **Commit:** 4e6199d4

None other — plan executed as described with one minor type correction.

## Self-Check: PASSED

All 4 modified files verified present. Task commits a29a25f0 and 4e6199d4 verified in git log.
TypeScript: 0 errors.
