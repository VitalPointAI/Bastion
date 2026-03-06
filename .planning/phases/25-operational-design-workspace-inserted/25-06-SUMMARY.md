---
phase: 25-operational-design-workspace-inserted
plan: 06
subsystem: ai, api, ui
tags: [cog-analysis, loe-gap-analysis, ai-agents, strange-framework, design-tab]

# Dependency graph
requires:
  - phase: 25-operational-design-workspace-inserted
    provides: "AI panel infrastructure (Plan 02), CoG section (Plan 03), LOE section (Plan 04)"
provides:
  - "CoG analysis AI agent with Strange's CG-CC-CR-CV validation and suggestions"
  - "LOE gap analysis AI agent identifying unaddressed CVs and missing linkages"
  - "Section-specific AI panel rendering for CoG and LOE sections"
  - "Apply handler for inserting AI-suggested CoG nodes into trees"
affects: [phase-29-contextual-ai]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Rule-based AI agent stub pattern with confidence bounds", "Section-specific AI panel rendering with typed result cards"]

key-files:
  created:
    - backend/src/agents/cog-analysis.ts
    - backend/src/agents/loe-gap-analysis.ts
  modified:
    - backend/src/api/design.ts
    - frontend/src/components/design/DesignAIPanel.tsx
    - frontend/src/components/design/CoGAnalysisSection.tsx

key-decisions:
  - "Rule-based v1 agents with conservative 0.3-0.7 confidence bounds for INVARIANT 5 compliance"
  - "LOE gap cards are advisory only (no Apply button) since gaps require manual LOE restructuring"
  - "CoG suggestions include Apply to directly insert nodes into the tree hierarchy"

patterns-established:
  - "Section-specific AI result rendering: each design section gets typed result cards in DesignAIPanel"
  - "AI suggestion Apply pattern: suggestion data mapped to domain model and inserted with auto-save"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 25 Plan 06: CoG & LOE AI Analysis Agents Summary

**Rule-based CoG validation and LOE gap analysis agents with section-specific AI panel rendering including Apply/Dismiss actions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T07:30:46Z
- **Completed:** 2026-03-06T07:36:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created CoG analysis agent that validates tree structure and suggests missing CG-CC-CR-CV elements
- Created LOE gap analysis agent that identifies unaddressed CVs, missing linkages, and phase gaps
- Replaced backend stubs with real agent calls for cog-analysis and lines-of-effort sections
- Added section-specific rendering in DesignAIPanel with typed cards, confidence badges, and score bars
- Integrated AI panel into CoGAnalysisSection with Apply handler for inserting suggested nodes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CoG and LOE analysis agents + wire backend endpoint** - `613eab7` (feat)
2. **Task 2: Update frontend AI panel to render CoG and LOE analysis results** - `bb4dbc5` (feat)

## Files Created/Modified
- `backend/src/agents/cog-analysis.ts` - CoG analysis agent with Strange's framework validation and suggestions
- `backend/src/agents/loe-gap-analysis.ts` - LOE gap analysis agent identifying unaddressed CVs and phase gaps
- `backend/src/api/design.ts` - Updated analyze endpoint to call real agents for CoG and LOE sections
- `frontend/src/components/design/DesignAIPanel.tsx` - Section-specific rendering for CoG suggestions and LOE gaps
- `frontend/src/components/design/CoGAnalysisSection.tsx` - AI panel integration with Apply handler

## Decisions Made
- Rule-based v1 agents with conservative confidence bounds (0.3-0.7) per INVARIANT 5
- LOE gap cards are advisory-only (no Apply button) -- gaps require manual LOE restructuring
- CoG suggestions include Apply button that inserts nodes into correct tree hierarchy position
- Immediate save on Apply (no debounce) for applied suggestions vs 2s debounce for manual edits

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 25 verification gaps are now closed
- CoG and LOE AI analysis fully functional alongside existing problem-framing analysis
- Ready for Phase 26 (Strategic Environment Inheritance) or Phase 29 (Contextual AI Staff Integration)

---
*Phase: 25-operational-design-workspace-inserted*
*Completed: 2026-03-06*
