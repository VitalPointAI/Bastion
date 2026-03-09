---
phase: 40-autonomous-document-intelligence-team
plan: 03
subsystem: api
tags: [typescript, langgraph, state-graph, llm-triage, ocr, tesseract, zod, multi-agent]

requires:
  - phase: 40-autonomous-document-intelligence-team
    provides: SpecialistBase, types.ts, schemas.ts, nato-ratings.ts
provides:
  - DocumentOrchestrator LangGraph StateGraph with LLM triage and conditional routing
  - createDocIntelligenceGraph() factory function
  - DocIntelligenceStateAnnotation with custom reducers for parallel execution
  - FormatConverter specialist with OCR and language detection
  - DocumentClassifier specialist with LLM-driven type/relevance/container classification
  - registerDocIntelligenceTeam() for all 11 specialists via TeamRegistry
affects: [40-04, 40-05, 40-06, 40-07, 40-08, 40-09, 40-10]

tech-stack:
  added: []
  patterns: [langgraph-conditional-fan-out, custom-state-reducers, dynamic-import-fallback, llm-output-coercion]

key-files:
  created:
    - backend/src/doc-intelligence/orchestrator.ts
    - backend/src/doc-intelligence/team-setup.ts
    - backend/src/doc-intelligence/specialists/format-converter.ts
    - backend/src/doc-intelligence/specialists/document-classifier.ts
  modified: []

key-decisions:
  - "Used graph-as-any cast for edge methods following existing supervisor.ts pattern for LangGraph TS typing limitations"
  - "FormatConverter uses dynamic import for tesseract.js to gracefully handle missing dependency"
  - "DocumentClassifier includes output coercion layer for common LLM response variations (lowercase types, string numbers)"
  - "Team registration uses try/catch with warn-and-continue for agent registry dependency timing"

patterns-established:
  - "DocIntelligenceStateAnnotation: custom reducers for all parallel-updated state keys (array append, object merge)"
  - "Specialist process/classify pattern: public method returning SpecialistResult with timing, validation, and progress callbacks"
  - "LLM output coercion: attempt parse, validate, coerce common issues, re-validate before failure"

requirements-completed: [DOCTEAM-02, DOCTEAM-03, DOCTEAM-04]

duration: 6min
completed: 2026-03-09
---

# Phase 40 Plan 03: Orchestrator, Team Registration, and First Specialists Summary

**LangGraph StateGraph orchestrator with LLM-driven triage and conditional fan-out, FormatConverter with OCR/language detection, DocumentClassifier with taxonomy-based relevance scoring, and team registration for all 11 specialists**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T21:20:53Z
- **Completed:** 2026-03-09T21:26:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Document Orchestrator StateGraph with LLM-driven triage node using TRIAGE_SYSTEM_PROMPT, conditional routing to Format Converter, parallel fan-out from Classifier to multiple specialists, and report assembly
- Custom state reducers for all parallel-updated keys (facts, perspectives, biasFindings, crossDocLinks use array append; specialistResults uses object merge) to avoid LangGraph superstep conflicts
- SSE progress callbacks via optional onProgress handler on DocumentOrchestrator for Mission Control UI
- FormatConverter specialist with OCR via tesseract.js (dynamic import), LLM language detection, and table/chart identification
- DocumentClassifier specialist with LLM-driven classification using DOCUMENT_TYPES taxonomy, problem-set-scoped relevance scoring, container placement suggestions, and Zod output validation with coercion
- Team registration for all 11 specialists with hierarchical workflow stages, escalation policy, and shared context keys

## Task Commits

Each task was committed atomically:

1. **Task 1: Document Orchestrator StateGraph and team registration** - `201f5dc` (feat)
2. **Task 2: Format Converter and Document Classifier specialists** - `2de50d9` (feat)

## Files Created/Modified
- `backend/src/doc-intelligence/orchestrator.ts` - LangGraph StateGraph with triage, conditional routing, parallel fan-out stubs, report assembly, and SSE progress callbacks
- `backend/src/doc-intelligence/team-setup.ts` - Team registration for all 11 specialists via TeamRegistry with hierarchical workflow stages
- `backend/src/doc-intelligence/specialists/format-converter.ts` - OCR via tesseract.js, LLM language detection, table/chart identification, Zod validation
- `backend/src/doc-intelligence/specialists/document-classifier.ts` - LLM-driven document type classification, relevance scoring, container placement, output coercion

## Decisions Made
- Used `graph as any` cast for edge method calls, matching the existing pattern in `supervisor.ts` for LangGraph TypeScript typing limitations with dynamic node names
- FormatConverter uses dynamic `import('tesseract.js')` so the specialist works even before the dependency is installed (graceful degradation)
- DocumentClassifier includes an output coercion layer that handles common LLM output variations (lowercase document types, string-typed numbers) before failing validation
- Team registration wrapped in try/catch with warn-and-continue because agent registry may not have all agents registered at startup time

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WorkflowStage schema field name mismatch**
- **Found during:** Task 1
- **Issue:** Plan used `agentIds` and `requiredApprovals: 0` but actual WorkflowStageSchema requires `assignedAgents`, `nextStages`, and `requiredApprovals` min is 1
- **Fix:** Changed `agentIds` to `assignedAgents`, added `nextStages` arrays, removed `requiredApprovals: 0`
- **Files modified:** backend/src/doc-intelligence/team-setup.ts
- **Verification:** TypeScript compiles without errors

**2. [Rule 3 - Blocking] EscalationPolicy notificationChannels type mismatch**
- **Found during:** Task 1
- **Issue:** Used `'mission-control-feed'` but schema only allows `'email' | 'webhook' | 'slack'`
- **Fix:** Changed to `'webhook'`
- **Files modified:** backend/src/doc-intelligence/team-setup.ts
- **Verification:** TypeScript compiles without errors

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for schema compliance. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. tesseract.js dependency should be installed when OCR is needed.

## Next Phase Readiness
- Orchestrator graph ready for specialist node replacement as remaining specialists are implemented (Plans 04-09)
- FormatConverter and DocumentClassifier ready to be wired into orchestrator graph nodes
- Team registration ready to be called during application startup
- All specialist stubs in orchestrator emit progress events for future Mission Control UI

---
*Phase: 40-autonomous-document-intelligence-team*
*Completed: 2026-03-09*
