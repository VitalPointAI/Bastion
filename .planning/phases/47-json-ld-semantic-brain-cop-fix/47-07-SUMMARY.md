---
phase: 47-json-ld-semantic-brain-cop-fix
plan: "07"
subsystem: cop-sub-agents
tags: [cop, semantic, jsonld, confidence, provenance, sub-agents]
dependency_graph:
  requires: ["47-06"]
  provides: ["semantic-entity-cop-pipeline-complete"]
  affects: ["cop-layer-generation", "cop-symbol-visual-encoding"]
tech_stack:
  added: []
  patterns:
    - "normalizeType() helper for jsonldType matching (strip colons/underscores, lowercase)"
    - "SemanticEntity confidence passthrough to COPSymbolSpec.confidenceTier"
    - "ConfidenceTier visual encoding: high/medium/low from entity.confidence score"
key_files:
  created: []
  modified:
    - backend/src/cop/layers/layer-types.ts
    - backend/src/cop/agents/layer-sub-agents/intel-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/force-disposition.ts
    - backend/src/cop/agents/layer-sub-agents/objectives-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/c2-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/control-measures.ts
    - backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts
    - backend/src/robot/vision-cop-pipeline.ts
    - backend/src/cop/agents/cop-coordinator.test.ts
    - backend/src/cop/layers/layer-store.test.ts
    - backend/src/cop/layers/version-store.test.ts
decisions:
  - "Use normalizeType() to strip colons/spaces/underscores before jsonldType comparison — handles cco:MilitaryOrganization vs stored cco:militaryorganization variations"
  - "confidenceTier required (not optional) in COPSymbolSpec — enforces all sub-agents provide confidence visual encoding"
  - "provenanceSummary as human-readable tooltip string combining sourceAuthority + assertedVia + confidence%"
metrics:
  duration_seconds: 664
  completed_date: "2026-03-16"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 11
---

# Phase 47 Plan 07: COP Sub-Agent SemanticEntity Upgrade Summary

**One-liner:** All 6 COP layer sub-agents upgraded to filter by jsonldType ontology class and output ConfidenceTier + provenance in every symbol.

## What Was Built

Upgraded all 6 COP layer sub-agents (intel, force-disposition, objectives, c2, control-measures, logistics) to consume `SemanticEntity[]` input and produce confidence-aware COP symbols. Added `confidenceTier`, `assertedVia`, and `provenanceSummary` fields to `COPSymbolSpec`. Each sub-agent now filters graph entities using normalized jsonldType matching against CCO/JC3IEDM ontology class URIs.

## Task Completion

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Update layer-types + intel/force/objectives sub-agents | db5dabca | Complete |
| 2 | Update c2/control-measures/logistics sub-agents | d41a60ee | Complete |
| Fix | Normalize jsonldType comparison (colon handling bug) | df2ce2f0 | Complete |

## Key Changes

### layer-types.ts
- Import `ConfidenceTier` from `../../graph/provenance-types.js`
- Added `confidenceTier: ConfidenceTier` (required) to `COPSymbolSpec`
- Added `assertedVia?: string` (provenance source method)
- Added `provenanceSummary?: string` (human-readable tooltip string)

### All 6 Sub-Agents
Each sub-agent now:
1. Defines a list of canonical jsonldType patterns (CCO/JC3IEDM class URIs)
2. Uses `normalizeType()` helper to strip `:`, spaces, and underscores before comparison
3. Passes `entity.confidence` and `entity.provenance.assertedVia` into symbol output
4. Calls `getConfidenceTier(confidence)` to compute visual tier
5. Generates `provenanceSummary` tooltip string
6. Uses `attributes_*` promoted property names with fallback to legacy property names

### jsonldType Filter Patterns by Sub-Agent
- **intel-overlay (J2):** `cco:militaryorganization`, `jc3:unit`, `jc3:facility`, `cco:organization` + hostile/enemy affiliation
- **force-disposition (J3):** `cco:militaryorganization`, `jc3:unit` + friendly affiliation
- **objectives-overlay (J35):** `objective`, `nai`, `tai`, `geospatialregion`, `areaofinterest`
- **c2-overlay (C2):** `headquarters`, `commandpost`, `hq`, `militaryunit`, `cco:militaryorganization`
- **control-measures:** `boundary`, `phaseline`, `axisofadvance`, `route`, `controlmeasure`, `geospatialregion`
- **logistics-overlay (J4):** `cco:artifact`, `jc3:facility`, `facility`, `logisticsnode`, `supplyroute`, `artifact`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsonldType colon normalization**
- **Found during:** Task 2 test run
- **Issue:** `e.jsonldType.toLowerCase()` returns `'cco:militaryorganization'` (with colon), but filter was stripping only the colon from the pattern keyword, causing `includes()` to not match
- **Fix:** Created consistent `normalizeType()` helper that strips colons, spaces, underscores from both sides before comparison
- **Files modified:** All 6 sub-agent files
- **Commit:** df2ce2f0

**2. [Rule 2 - Missing required fields] Test fixtures and vision-cop-pipeline missing confidenceTier**
- **Found during:** Task 1 TypeScript check
- **Issue:** Making `confidenceTier` required (not optional) broke existing test fixtures and vision-cop-pipeline.ts that built COPSymbolSpec objects without the new field
- **Fix:** Added `confidenceTier` with appropriate values to all affected test fixtures and vision-cop-pipeline symbol builder
- **Files modified:** cop-coordinator.test.ts, layer-store.test.ts, version-store.test.ts, vision-cop-pipeline.ts
- **Commit:** db5dabca

## Verification

- TypeScript compilation: PASSED (no errors)
- Sub-agent tests: 12/12 PASSED (`sub-agents.test.ts` and compiled `sub-agents.test.js`)
- No sub-agent accesses legacy `e.type` flat property — all use `e.jsonldType` or `e.properties.attributes_*`
- All symbols include `confidenceTier` (required field enforced by TypeScript)

## Self-Check: PASSED

Files exist:
- backend/src/cop/layers/layer-types.ts — FOUND
- backend/src/cop/agents/layer-sub-agents/intel-overlay.ts — FOUND
- backend/src/cop/agents/layer-sub-agents/force-disposition.ts — FOUND
- backend/src/cop/agents/layer-sub-agents/objectives-overlay.ts — FOUND
- backend/src/cop/agents/layer-sub-agents/c2-overlay.ts — FOUND
- backend/src/cop/agents/layer-sub-agents/control-measures.ts — FOUND
- backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts — FOUND

Commits exist:
- db5dabca — feat(47-07): upgrade layer-types + intel/force/objectives sub-agents
- d41a60ee — feat(47-07): upgrade c2/control-measures/logistics sub-agents
- df2ce2f0 — fix(47-07): normalize jsonldType comparison across all 6 COP sub-agents
