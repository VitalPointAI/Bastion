---
phase: 40-autonomous-document-intelligence-team
plan: 05
subsystem: ai-agents
tags: [langgraph, perspective-analysis, bias-detection, intelligence, zod, specialist-agents]

# Dependency graph
requires:
  - phase: 40-01
    provides: "Foundation types, Zod schemas, SpecialistBase class, ProblemSetContext"
provides:
  - "PerspectiveAnalyst specialist with per-category instantiation (friendly/adversary/neutral/partner)"
  - "createPerspectiveAnalysts factory function for orchestrator fan-out"
  - "BiasIdentifier specialist with six-category bias detection taxonomy"
  - "Planning document mode for assumption-focused bias analysis"
affects: [40-06, 40-07, 40-08, 40-09, 40-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-category-instantiation, bias-taxonomy, planning-vs-propaganda-mode]

key-files:
  created:
    - backend/src/doc-intelligence/specialists/perspective-analyst.ts
    - backend/src/doc-intelligence/specialists/bias-identifier.ts
  modified: []

key-decisions:
  - "PerspectiveAnalyst uses nodeId property (perspective-{category}) for LangGraph registration rather than overriding specialistId"
  - "BiasIdentifier has dual mode: propaganda detection for OSINT/news vs assumption analysis for military orders/CONOPs"
  - "Actor resolution maps ProblemSetContext fields to perspectives (primaryActors for friendly/adversary, alliances for partner, excludedActors for neutral)"

patterns-established:
  - "Per-category instantiation: single class creates multiple LangGraph nodes via factory function"
  - "Taxonomy-driven prompts: bias categories defined as constant object, injected into system prompt"
  - "Document-type-aware analysis: specialist behavior adapts based on document classification"

requirements-completed: [DOCTEAM-07, DOCTEAM-09]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 40 Plan 05: Perspective Analyst & Bias Identifier Summary

**Per-container-category perspective analysis with four viewpoint types and six-category bias detection taxonomy with severity-rated findings**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T21:20:20Z
- **Completed:** 2026-03-09T21:23:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- PerspectiveAnalyst instantiates per container category (friendly/adversary/neutral/partner) with perspective-specific system prompts and focus guidance
- Factory function createPerspectiveAnalysts enables orchestrator to create 1-4 analysts for parallel LangGraph fan-out execution
- BiasIdentifier covers all six taxonomy categories with severity ratings, evidence quotation, and analyst recommendations
- Planning document mode shifts focus from propaganda/IO detection to assumption and cognitive bias analysis for military orders and CONOPs

## Task Commits

Each task was committed atomically:

1. **Task 1: Perspective Analyst specialist with per-category instantiation** - `5499a61` (feat)
2. **Task 2: Bias Identifier specialist** - `4937f19` (feat)

## Files Created/Modified
- `backend/src/doc-intelligence/specialists/perspective-analyst.ts` - Per-perspective analysis agent with factory function for parallel execution
- `backend/src/doc-intelligence/specialists/bias-identifier.ts` - Source bias detection with six-category taxonomy and severity levels

## Decisions Made
- PerspectiveAnalyst uses a `nodeId` getter (`perspective-{category}`) for unique LangGraph node registration while sharing the same `specialistId`
- BiasIdentifier adapts its system prompt based on document type: propaganda/IO focus for news and OSINT, assumption/cognitive bias focus for military orders
- Actor resolution maps ProblemSetContext fields to perspective categories rather than requiring explicit actor-to-perspective mapping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both specialists extend SpecialistBase and produce LangGraph-compatible nodes
- Ready for orchestrator integration (Plan 08/09) and parallel fan-out execution
- PerspectiveAnalyst array output feeds into the DocumentIntelligenceReport.perspectives field
- BiasIdentifier array output feeds into DocumentIntelligenceReport.biasFindings field

---
*Phase: 40-autonomous-document-intelligence-team*
*Completed: 2026-03-09*
