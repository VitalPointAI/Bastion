---
phase: 25-operational-design-workspace-inserted
plan: 02
subsystem: ui, api
tags: [operational-design, jp5-0, problem-framing, ai-panel, react, express]

requires:
  - phase: 25-operational-design-workspace-inserted
    provides: Design types, store, API, design-service, DesignTab shell with sidebar
provides:
  - ProblemFramingSection with all JP 5-0 fields and auto-save
  - DesignAIPanel collapsible right-side panel with section-aware caching
  - AIFramingCard with confidence badges and Adopt/Merge/Dismiss actions
  - POST /api/design/:id/analyze endpoint calling problem-framing agent
  - designService.analyzeSection() frontend API method
affects: [25-03, 25-04]

tech-stack:
  added: []
  patterns: [explicit-trigger-ai, section-aware-caching, debounced-auto-save, merge-modal-selective-fields]

key-files:
  created:
    - frontend/src/components/design/ProblemFramingSection.tsx
    - frontend/src/components/design/DesignAIPanel.tsx
    - frontend/src/components/design/AIFramingCard.tsx
  modified:
    - backend/src/api/design.ts
    - frontend/src/lib/design-service.ts
    - frontend/src/components/tabs/DesignTab.tsx

key-decisions:
  - "Explicit trigger model for AI (Analyze button, no auto-run) to maintain user control"
  - "Section-keyed Map cache in AI panel prevents stale results on section switch"
  - "Adopt replaces form wholesale; Merge opens modal for selective field integration"
  - "Problem statement auto-generates from current/desired state gap with obstacle/constraint counts"

patterns-established:
  - "Explicit AI trigger: user clicks Analyze, no auto-run on section load"
  - "Section-aware AI caching: Map<sectionKey, results> in panel state"
  - "Debounced auto-save: 2-second timeout with Saving/Saved status indicator"
  - "Merge modal: checkbox-based selective field merge from AI suggestion to form"
  - "Dynamic list pattern: text inputs with add/remove for array fields (tensions, obstacles, etc.)"

requirements-completed: [OD-PROBLEM-FRAMING, OD-AI-PANEL]

duration: 3min
completed: 2026-03-06
---

# Phase 25 Plan 02: Problem Framing & AI Panel Summary

**JP 5-0 problem framing form with auto-generated problem statement, debounced auto-save, and collapsible AI panel with Adopt/Merge/Dismiss framing cards**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T06:49:32Z
- **Completed:** 2026-03-06T06:52:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete problem framing form with all 8 JP 5-0 field groups (Current State, Desired End State, Problem Statement, Key Tensions, Obstacles, Opportunities, Assumptions, Constraints)
- Auto-generated problem statement that updates from current/desired state gap with obstacle/constraint counts
- Collapsible AI panel with explicit trigger model, section-aware result caching, and framing cards with confidence badges
- Adopt (replace form), Merge (selective modal), and Dismiss actions on AI framing cards
- Backend analyze endpoint that calls existing problem-framing agent and returns framings

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend AI analyze endpoint and frontend AI panel components** - `77cee3d` (feat)
2. **Task 2: Problem Framing section form with auto-save and AI panel integration** - `603f76b` (feat)

## Files Created/Modified
- `frontend/src/components/design/ProblemFramingSection.tsx` - Structured JP 5-0 form with auto-save and AI integration
- `frontend/src/components/design/DesignAIPanel.tsx` - Collapsible right-side AI panel with section-aware caching
- `frontend/src/components/design/AIFramingCard.tsx` - Interactive framing card with confidence badges and actions
- `backend/src/api/design.ts` - Added POST /api/design/:id/analyze endpoint
- `frontend/src/lib/design-service.ts` - Added analyzeSection() method
- `frontend/src/components/tabs/DesignTab.tsx` - Wired ProblemFramingSection replacing placeholder

## Decisions Made
- Explicit trigger model for AI (Analyze button, no auto-run) to maintain user control per HYBRID_HUMAN_LED safety classification
- Section-keyed Map cache in AI panel prevents stale results on section switch
- Adopt replaces form wholesale; Merge opens modal for selective field integration
- Problem statement auto-generates from current/desired state gap with obstacle/constraint counts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compiler could not run due to Node v12 in current shell (requires Node 14+ for nullish coalescing). Previous plan 25-01 had same environment and compiled successfully on dev machine. Code follows same patterns.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Problem Framing section fully functional and ready for user interaction
- AI panel pattern (DesignAIPanel + card components) ready to be reused by CoG Analysis (Plan 03) and LOE (Plan 03/04)
- Analyze endpoint handles section routing, ready for cog-analysis and lines-of-effort handlers

---
*Phase: 25-operational-design-workspace-inserted*
*Completed: 2026-03-06*
