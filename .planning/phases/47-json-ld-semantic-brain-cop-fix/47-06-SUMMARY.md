---
phase: 47-json-ld-semantic-brain-cop-fix
plan: "06"
subsystem: cop-pipeline
tags: [cop, semantic-query, json-ld, provenance, confidence, sub-agents]
dependency_graph:
  requires: ["47-01", "47-03"]
  provides: ["semantic-entity-query", "cop-semantic-wiring"]
  affects: ["cop-coordinator", "cop-index", "cop-handlers", "all-cop-sub-agents"]
tech_stack:
  added: []
  patterns: ["semantic-entity-query", "confidence-decay", "matchesEntityType-helper"]
key_files:
  created:
    - backend/src/cop/agents/semantic-entity-query.ts
  modified:
    - backend/src/cop/agents/layer-sub-agents/sub-agent-types.ts
    - backend/src/cop/agents/cop-coordinator.ts
    - backend/src/cop/index.ts
    - backend/src/cop/api/cop-handlers.ts
    - backend/src/cop/agents/layer-sub-agents/force-disposition.ts
    - backend/src/cop/agents/layer-sub-agents/intel-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/c2-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/objectives-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/control-measures.ts
    - backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/sub-agents.test.ts
decisions:
  - "matchesEntityType() helper uses both properties.type (legacy) and jsonldType (CCO URI) for backward compat"
  - "Awaited<ReturnType<typeof fetchAllSemanticEntities>> used instead of inline type to keep single source of truth"
metrics:
  duration: 8 min
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_created: 1
  files_modified: 10
requirements_addressed: [COP-01, COP-02]
---

# Phase 47 Plan 06: Semantic Entity Query Module + COP Pipeline Wiring Summary

Semantic entity query module for ontology-typed Neo4j queries with W3C PROV-O provenance and exponential confidence decay, replacing flat actorStore.listActors across the COP pipeline.

## Tasks Completed

| Task | Description | Status | Commit |
|------|-------------|--------|--------|
| 1 | Create semantic-entity-query.ts + update SubAgentInput types | Done | e5583c8a |
| 2 | Wire coordinator + COP index + handlers to semantic queries | Done | 1c2377a5 |

## What Was Built

### semantic-entity-query.ts
New module at `backend/src/cop/agents/semantic-entity-query.ts` providing:
- `fetchSemanticEntities(workspaceId, typeFilters, affiliationFilters?)` — filtered by CCO/BFO jsonldType and optional affiliation
- `fetchAllSemanticEntities(workspaceId)` — all temporally valid entities for a workspace

Both functions:
- Apply temporal validity filter (`validTo IS NULL OR validTo > datetime()`)
- Compute confidence decay via Cypher: `baseConf * (0.5 ^ (ageDays / halfLifeDays))`
- Default halfLifeDays=180, default confidence=0.5 when node properties are null
- Map Neo4j records to `SemanticEntity[]` with parsed `ProvenanceProps`
- Return empty array and log error on failure (non-fatal, pipeline continues)

### SubAgentInput Type Update
`sub-agent-types.ts` updated:
- `graphEntities` type changed from `Array<{ id, name, type, properties }>` to `SemanticEntity[]`
- `LegacyGraphEntity` type alias added for backward compat
- `matchesEntityType(entity, keywords)` helper added — checks `properties.type` (legacy flat) AND `jsonldType` (CCO URI keyword match)
- `getEntityAffiliation(entity)` helper added — checks `properties.affiliation` and `properties.attributes_affiliation`

### All 6 Sub-Agents Updated
Each sub-agent's graph entity filter updated from `.filter(e => [].includes(e.type))` to use `matchesEntityType()`:
- force-disposition: matches organization/military_unit/unit/militaryorganization/agent
- intel-overlay: matches same types + filters by hostile/enemy/suspect/unknown affiliation via `getEntityAffiliation()`
- c2-overlay: matches headquarters/command_post/hq/commandpost
- objectives-overlay: matches objective/nai/tai/area_of_interest/geospatialregion
- control-measures: matches boundary/phase_line/axis_of_advance/route/control_measure/controlmeasure
- logistics-overlay: matches logistics_node/supply_route/facility/logistics/artifact

### COP Coordinator + Pipeline Wiring
- `COPCoordinatorState.graphEntities` annotation updated to `SemanticEntity[]`
- Diagnostic logging added: entity count at fetch boundary + per-sub-agent invocation
- `cop/index.ts`: `actorStore.listActors` replaced with `fetchAllSemanticEntities`
- `cop-handlers.ts` manualTrigger: same replacement with logging

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in all 6 sub-agents after SubAgentInput type change**
- **Found during:** Task 1 TypeScript verification
- **Issue:** All 6 sub-agents filtered `graphEntities` by `.type` property which no longer exists on `SemanticEntity`. Caused 7 TypeScript compilation errors.
- **Fix:** Added `matchesEntityType()` and `getEntityAffiliation()` helpers to `sub-agent-types.ts`. Updated all 6 sub-agents to use helpers. Updated `sub-agents.test.ts` to use `SemanticEntity` shape.
- **Files modified:** sub-agent-types.ts, force-disposition.ts, intel-overlay.ts, c2-overlay.ts, objectives-overlay.ts, control-measures.ts, logistics-overlay.ts, sub-agents.test.ts
- **Commit:** e5583c8a

**2. [Note] Task 2 files included in earlier 47-05 commit due to git stash pop timing**
- The coordinator, index, and handler changes were restored from stash at the same time as the 47-05 plan execution was being committed. The 47-05 commit (1c2377a5) included the Task 2 files.
- All changes are correctly committed and TypeScript-verified. No behavioral impact.

## Verification

- TypeScript check passes (0 errors from plan-06 files)
- `actorStore.listActors` fully replaced in COP module (only remains in a code comment)
- `SubAgentInput.graphEntities` typed as `SemanticEntity[]` with jsonldType, confidence, provenance
- Coordinator logs entity count at fetch boundary
- Both COP entry points (event bus trigger and API handler) use `fetchAllSemanticEntities`

## Self-Check: PASSED
