---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "04"
subsystem: robot-swarm-brain-graph
tags:
  - swarm
  - brain-graph
  - provenance
  - corroboration
  - neo4j
  - prov-o
dependency_graph:
  requires:
    - "48-02 (SwarmFormationSpec in layer-types, COP layer patterns)"
    - "Phase 47 (PROV-O model, confidence fusion formula, VISION_PIPELINE_WEIGHT)"
  provides:
    - "writeSwarmEventToGraph for all 9 swarm event types with PROV-O national DID"
    - "Multi-robot corroboration via fuseDetectionConfidence weighted product formula"
    - "corroborationStatus ghosted/low/solid for COP visual encoding"
    - "Python robot.swarm.graph_events for pre-build assertions on robot side"
    - "Python robot.swarm.corroboration for robot-side confidence pre-computation"
    - "Python robot.swarm.cop_utils for COP polygon hull ordering and state colors"
  affects:
    - "backend/src/robot/robot-mission-service.ts (caller of vision pipeline)"
    - "COP layer visual rendering (corroboration status affects opacity)"
tech_stack:
  added: []
  patterns:
    - "MERGE + deterministic ID with 5s dedup window for Neo4j event idempotency"
    - "Complementary probability fusion: 1 - product(1 - c*w) for multi-source confidence"
    - "TDD red-green cycle: unskipped Wave 0 scaffold tests, then implemented"
key_files:
  created:
    - backend/src/robot/swarm-graph-writer.ts
    - robot/swarm/graph_events.py
    - robot/swarm/corroboration.py
    - robot/swarm/cop_utils.py
    - robot/swarm_graph.py
    - robot/corroboration.py
  modified:
    - backend/src/robot/vision-cop-pipeline.ts
    - robot/tests/test_swarm_graph.py
    - robot/tests/test_corroboration.py
    - robot/tests/test_swarm_cop.py
decisions:
  - "Python modules in robot/swarm/ subpackage (graph_events.py, corroboration.py, cop_utils.py) — tests import from robot.swarm.* so canonical implementations go there; top-level re-exports (robot/swarm_graph.py, robot/corroboration.py) added for backward compatibility"
  - "corroborateDetections() deduplicates by class+affiliation category + 50m proximity before fusing confidence — same design as single actor MERGE pattern in updateKnowledgeGraph"
metrics:
  duration_minutes: 12
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_created: 6
  files_modified: 4
---

# Phase 48 Plan 04: Swarm Brain Graph Write Path + Multi-Robot Corroboration Summary

**One-liner:** Neo4j MERGE-based swarm lifecycle events with PROV-O national DID provenance and complementary probability fusion for multi-robot threat corroboration.

## What Was Built

### Task 1: swarm-graph-writer.ts + Python graph_events module

`backend/src/robot/swarm-graph-writer.ts` exports three things:

- `SwarmEventContext` interface — 9 event types covering full mission lifecycle
- `buildSwarmEventId(swarmId, eventType, timestamp)` — rounds epoch to nearest 5s window (`Math.floor(epoch / 5000) * 5000`) for deterministic dedup IDs
- `writeSwarmEventToGraph(event)` — MERGE Cypher query with ON CREATE for PROV-O fields (`prov:wasAttributedTo` = nationalDid, `prov:wasGeneratedBy` = "swarm_coordinator", `cco:Process` type) and ON MATCH to update `xsd:validThrough`

`robot/swarm/graph_events.py` ports both functions to Python for robot-side pre-computation before sending to backend.

### Task 2: vision-cop-pipeline.ts corroboration + Python utilities

`backend/src/robot/vision-cop-pipeline.ts` additions:

- New adversary classes: `t-99`, `zbd-04`/`zbd04`, `btr-82`/`btr82` in `THREAT_CLASS_MAP`
- `fuseDetectionConfidence(detections)` — Phase 47 weighted product: `1 - product(1 - c * 0.70)`
- `corroborationStatus(confidence)` — `< 0.5` ghosted, `0.5-0.85` low, `> 0.85` solid
- `corroborateDetections(incoming, existing)` — dedup by category+affiliation+50m, fuses confidence on match

Python modules:
- `robot/swarm/corroboration.py` — `fuse_detection_confidence(detections, source_weight=0.70)`
- `robot/swarm/cop_utils.py` — `order_polygon_hull()` (CCW sort by atan2 from centroid) + `FORMATION_STATE_COLORS` dict

## Test Results

All 7 Wave 0 scaffold tests unskipped and passing:
```
robot/tests/test_swarm_graph.py::test_event_dedup PASSED
robot/tests/test_swarm_graph.py::test_national_provenance PASSED
robot/tests/test_corroboration.py::test_confidence_fusion_two_sources PASSED
robot/tests/test_corroboration.py::test_confidence_fusion_single_source PASSED
robot/tests/test_corroboration.py::test_confidence_fusion_three_sources PASSED
robot/tests/test_swarm_cop.py::test_polygon_hull_ordering PASSED
robot/tests/test_swarm_cop.py::test_formation_state_colors PASSED
7 passed in 0.02s
```

TypeScript: `npx tsc --noEmit` — clean, 0 errors.

## Deviations from Plan

### Auto-detected module path mismatch (Rule 1 - Auto-fixed)

**Found during:** Task 1
**Issue:** Plan specified `robot/swarm_graph.py` with functions `build_swarm_event_id` / `build_swarm_event_assertion`, but Wave 0 test scaffolds import from `robot.swarm.graph_events` — `from robot.swarm.graph_events import build_swarm_event_id`.
**Fix:** Created canonical implementation at `robot/swarm/graph_events.py` (matching test imports), with `robot/swarm_graph.py` as a top-level re-export. Same pattern applied to `robot/corroboration.py` vs `robot/swarm/corroboration.py`.
**Files modified:** robot/swarm/graph_events.py (created), robot/swarm_graph.py (re-export)

## Self-Check

- [x] `backend/src/robot/swarm-graph-writer.ts` — exports `writeSwarmEventToGraph`, `SwarmEventContext`, `buildSwarmEventId`
- [x] `robot/swarm/graph_events.py` — `build_swarm_event_id` + `build_swarm_event_assertion`
- [x] `robot/swarm/corroboration.py` — `fuse_detection_confidence`
- [x] `robot/swarm/cop_utils.py` — `order_polygon_hull` + `FORMATION_STATE_COLORS`
- [x] `backend/src/robot/vision-cop-pipeline.ts` — T-99, ZBD-04, BTR-82, `fuseDetectionConfidence`, `corroborationStatus`
- [x] All 7 tests passing
- [x] TypeScript compiles
