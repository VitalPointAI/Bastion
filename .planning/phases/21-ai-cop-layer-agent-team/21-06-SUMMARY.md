---
phase: 21-ai-cop-layer-agent-team
plan: 06
subsystem: agents, langgraph, cop
tags: [cop-coordinator, langgraph, stategraph, sub-agents, mil-std-2525d, sidc, cco, parallel-agents, layer-generation]

# Dependency graph
requires:
  - phase: 21-01
    provides: COP type system, CCO validator, SVG sanitizer
  - phase: 21-02
    provides: Event bus, agent definitions, trigger handler
  - phase: 21-03
    provides: Layer store, layer assembler, conflict detector
  - phase: 21-04
    provides: SIDC builder (buildSIDCFromEntity), SVG spec builder
  - phase: 21-05
    provides: Entity linker (discoverLinkages)
provides:
  - LangGraph StateGraph COP coordinator with 5-node pipeline (route, generate, assemble, validate, persist)
  - 6 domain sub-agents: force disposition (J3), objectives (J35), control measures (J3 eng), intel (J2), logistics (J4), C2
  - Parallel sub-agent invocation with Promise.allSettled semantics
  - Deterministic SIDC generation for all sub-agents via buildSIDCFromEntity
  - CCO validation on all assembled symbols
  - Draft layer persistence with entity linkage integration
  - Convenience function runCOPGeneration for external callers
affects: [21-07, 21-08, 21-09, 21-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [langgraph-stategraph-coordinator, parallel-sub-agent-invocation, sub-agent-common-pattern, conditional-error-edge]

key-files:
  created:
    - backend/src/cop/agents/cop-coordinator.ts
    - backend/src/cop/agents/cop-coordinator.test.ts
    - backend/src/cop/agents/layer-sub-agents/sub-agent-types.ts
    - backend/src/cop/agents/layer-sub-agents/force-disposition.ts
    - backend/src/cop/agents/layer-sub-agents/objectives-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/control-measures.ts
    - backend/src/cop/agents/layer-sub-agents/intel-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/c2-overlay.ts
    - backend/src/cop/agents/layer-sub-agents/sub-agents.test.ts
  modified: []

key-decisions:
  - "SubAgentInput common interface with createEmptyLayerSpec helper for error/fallback consistency across all 6 sub-agents"
  - "Conditional edge in StateGraph skips assemble/validate and goes straight to persist with error status when zero specs produced"
  - "Entity linkage integration is best-effort in persist node -- failures don't block layer creation"

patterns-established:
  - "Sub-agent pattern: SubAgentInput -> LLM entity extraction -> deterministic SIDC via buildSIDCFromEntity -> CCO validation via suggestCCOClass -> COPLayerSpec"
  - "Coordinator routing: triggerContext.targetAgents filters which sub-agents to invoke; empty/missing = all 6"
  - "Error resilience: individual sub-agent failures produce errors array but don't halt generation pipeline"

requirements-completed: [COP-COORDINATOR, SUB-AGENTS, LAYER-GENERATION]

# Metrics
duration: 11min
completed: 2026-03-05
---

# Phase 21 Plan 06: COP Coordinator & Layer Sub-Agents Summary

**LangGraph StateGraph coordinator orchestrating 6 parallel domain sub-agents (J3/J35/J2/J4/C2) with deterministic SIDC generation, CCO validation, and draft layer persistence**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-05T20:00:55Z
- **Completed:** 2026-03-05T20:12:17Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- COP coordinator LangGraph StateGraph with 5 nodes (route, generate_layers, assemble, validate_cco, persist) and conditional error edge
- 6 domain sub-agents following common SubAgentInput -> COPLayerSpec pattern with LLM entity extraction
- All SIDC codes generated deterministically via buildSIDCFromEntity (never by LLM)
- CCO class validation on every assembled symbol with auto-correction
- 12 tests passing: coordinator routing (full/targeted/error/partial) and sub-agent output validation (SIDC format, affiliation, empty input)

## Task Commits

Each task was committed atomically:

1. **Task 1: Combat sub-agents (Force Disposition, Objectives, Control Measures)** - `250cc6b` (feat)
2. **Task 2: Support sub-agents (Intel, Logistics, C2) and COP coordinator** - `79f414c` (feat)
3. **Task 3: Behavioral tests for coordinator routing and sub-agent output** - `0d5e9e1` (test)

## Files Created/Modified
- `backend/src/cop/agents/cop-coordinator.ts` - LangGraph StateGraph orchestrator with 5 nodes, COPCoordinatorState, runCOPGeneration convenience function
- `backend/src/cop/agents/cop-coordinator.test.ts` - 6 behavioral tests for coordinator graph routing
- `backend/src/cop/agents/layer-sub-agents/sub-agent-types.ts` - Shared SubAgentInput interface and createEmptyLayerSpec helper
- `backend/src/cop/agents/layer-sub-agents/force-disposition.ts` - J3 sub-agent: unit positions, movement paths, friendly SIDC codes
- `backend/src/cop/agents/layer-sub-agents/objectives-overlay.ts` - J35 sub-agent: objectives, NAIs, TAIs with area polygons
- `backend/src/cop/agents/layer-sub-agents/control-measures.ts` - J3 engineer sub-agent: boundaries, phase lines, axes of advance
- `backend/src/cop/agents/layer-sub-agents/intel-overlay.ts` - J2 sub-agent: enemy positions, threat assessments with source authority
- `backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts` - J4 sub-agent: supply routes (MSR/ASR), logistics facilities
- `backend/src/cop/agents/layer-sub-agents/c2-overlay.ts` - C2 sub-agent: command posts, HQ markers, command relationship SVG annotations
- `backend/src/cop/agents/layer-sub-agents/sub-agents.test.ts` - 6 output validation tests for sub-agent spec generation

## Decisions Made
- **Common sub-agent interface**: All 6 sub-agents accept SubAgentInput and return COPLayerSpec via the same pattern (LLM extraction + deterministic SIDC + CCO validation). Error cases return createEmptyLayerSpec with error metadata.
- **Conditional error edge**: When generate_layers produces zero specs (all agents failed), the graph skips assemble/validate_cco and routes directly to persist with error status. This prevents LayerAssembler.assemble from throwing on empty spec list.
- **Best-effort entity linkage**: The persist node invokes EntityLinker.discoverLinkages in a try/catch. Linkage failures don't block layer creation since linkage is supplementary to layer generation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Persist node crashed on empty spec list when all sub-agents failed**
- **Found during:** Task 3 (coordinator error handling test)
- **Issue:** persistNode called LayerAssembler.assemble() even when layerSpecs was empty (all agents failed), causing "Cannot assemble empty spec list" error
- **Fix:** Changed persist guard condition from `state.status === 'error' && state.layerSpecs.length === 0` to `state.layerSpecs.length === 0` since LangGraph state status may not reflect 'error' when routed via conditional edge
- **Files modified:** backend/src/cop/agents/cop-coordinator.ts
- **Verification:** All 12 tests pass including the error handling test
- **Committed in:** 0d5e9e1 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for error handling correctness. No scope creep.

## Issues Encountered
- TypeScript compiler not available until `npm install` ran in backend directory (resolved by installing dependencies)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Coordinator graph ready for API endpoint integration (21-07)
- Sub-agents ready for document commit trigger integration
- runCOPGeneration convenience function available for direct invocation
- All exports (copCoordinatorGraph, COPCoordinatorState, runCOPGeneration, all 6 sub-agent functions) available for downstream plans

## Self-Check: PASSED
