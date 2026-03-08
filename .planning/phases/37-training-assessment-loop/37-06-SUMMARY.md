---
phase: 37-training-assessment-loop
plan: 06
subsystem: api
tags: [typescript, llm, ai-suggestions, aar, metl, governance-gates, react]

requires:
  - phase: 37-04
    provides: "AARForm, AARObservationCard, METLTaskAssessment components"
  - phase: 37-05
    provides: "AssessEchelonRouter fully wired, assessment-service frontend client"
provides:
  - "AI suggestion service for AAR observations and METL ratings via LLM"
  - "Backend endpoints for AI observation and rating generation"
  - "Reframing auto-trigger wired to governance gate creation"
  - "Frontend AI suggestion buttons in AARForm and METLTaskAssessment"
affects: [training-assessment-loop]

tech-stack:
  added: []
  patterns: [llm-inline-suggestion, ai-suggestion-review-workflow, assessment-gate-trigger]

key-files:
  created:
    - backend/src/assessment/ai-suggestion-service.ts
  modified:
    - backend/src/api/assessment-routes.ts
    - backend/src/assessment/aggregation-service.ts
    - frontend/src/components/assess/AARForm.tsx
    - frontend/src/components/assess/METLTaskAssessment.tsx
    - frontend/src/lib/assessment-service.ts
    - frontend/src/components/assess/AssessEchelonRouter.css

key-decisions:
  - "Used inline LLM calls via createLLMForAgent rather than full staff agent pipeline for simpler AI suggestions"
  - "AI suggestions are persisted as observations with suggestedByAi=true for O/C review, not auto-applied"
  - "Reframing gate uses soft_warning enforcement with deduplication check before creation"

patterns-established:
  - "AI suggestion review workflow: generate -> display with AI label -> accept/reject/edit"
  - "Assessment-driven gate creation: threshold check triggers gateStore.create for governance"

requirements-completed: [TAL-14, TAL-15, TAL-13]

duration: 6min
completed: 2026-03-08
---

# Phase 37 Plan 06: AI-Assisted Assessment Suggestions Summary

**LLM-powered AAR observation and METL rating suggestions with O/C review workflow, plus reframing auto-trigger wired to governance gates**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T22:53:26Z
- **Completed:** 2026-03-08T22:59:41Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 6

## Accomplishments
- AI suggestion service with LLM-based observation generation (sustain/improve linked to METL tasks) and T/P/U rating recommendations with rationale
- Backend API endpoints: POST /aars/:id/ai-suggestions persists AI-tagged observations, POST /metl/assessments/ai-suggestions returns rating suggestions for O/C review
- Reframing auto-trigger now creates actual governance gate entries via gateStore when MOE/MOP thresholds are met (2+ declining MOEs or 3+ red MOPs)
- Frontend AARForm "Generate AI Suggestions" button with loading state and info text
- Frontend METLTaskAssessment "Get AI Rating Suggestions" button with per-task AI label, rationale tooltip, and pre-selected ratings
- MOE/MOP status update endpoints trigger reframing check automatically

## Task Commits

Each task was committed atomically:

1. **Task 1: AI suggestion service and API endpoints** - `a0494e2` (feat)
2. **Task 2: Frontend AI suggestion integration** - `87cf2b1` (feat)

## Files Created/Modified
- `backend/src/assessment/ai-suggestion-service.ts` - LLM-based observation and rating suggestion generation
- `backend/src/api/assessment-routes.ts` - Added AI suggestion endpoints and reframing trigger on MOE/MOP/AAR updates
- `backend/src/assessment/aggregation-service.ts` - Wired checkReframingTrigger to create governance gate entries via gateStore
- `frontend/src/components/assess/AARForm.tsx` - "Generate AI Suggestions" button with loading/error states
- `frontend/src/components/assess/METLTaskAssessment.tsx` - "Get AI Rating Suggestions" with per-task AI labels and tooltips
- `frontend/src/lib/assessment-service.ts` - Added generateAIObservations and generateAIRatingSuggestions methods
- `frontend/src/components/assess/AssessEchelonRouter.css` - AI suggestion button/label/error styles

## Decisions Made
- Used inline LLM calls via createLLMForAgent('assessment-observer') with fallback to 'default' agent, rather than full staff agent pipeline -- simpler for suggestion generation
- AI observation suggestions are persisted server-side as observations with suggestedByAi=true so O/C can accept/reject/edit
- AI rating suggestions are NOT auto-persisted -- returned to frontend for O/C review before submission
- Reframing gate creation includes deduplication check (skips if pending gate already exists)
- Reframing trigger check on AAR finalize is conditional on operational mode (not training)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All training assessment loop features are complete (AARs, METL tracking, dashboards, AI suggestions, governance integration)
- Phase 37 is fully implemented across all 6 plans
- Assessment data flows from tactical AARs through strategic dashboards to governance gates

---
*Phase: 37-training-assessment-loop*
*Completed: 2026-03-08*
