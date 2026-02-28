---
phase: 14-friendly-adversary-ipb-complete-cycle
plan: 08
subsystem: frontend
tags: [react, typescript, exercise, coa-scoring, decision-matrix, blockchain, commander-decision]

# Dependency graph
requires:
  - phase: 14-friendly-adversary-ipb-complete-cycle
    plan: 06
    provides: "exerciseService with scoreCOA, compareCOAs, updateNarrative, recordDecision methods; ScenarioCOA and COAComparisonResult types"

provides:
  - "COAScoringPanel: COA list with creation form, FASDC scoring trigger, color-coded decision matrix (5 doctrinal criteria), staff-editable AI narrative, rankings"
  - "CommanderDecisionPanel: full 5-type decision workflow (accept/reject/modify/combine/return), blockchain hash confirmation, decision history timeline"
  - "ExerciseDashboard COAs tab wired to COAScoringPanel (replaces placeholder)"

affects:
  - "14-09 (orders tab — same COA-scoring data flow pattern for ExerciseDashboard)"
  - "14-10 (gates/planning board — same ExerciseDashboard tab integration pattern)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Score color scale function: getScoreColor(score) -> hex color using 4-tier gradient (green/yellow/orange/red) at 75/50/25 thresholds"
    - "Per-item loading flags pattern: Record<string, boolean> for scoring/saving per COA ID to allow concurrent operations"
    - "CSS pulse animation for in-progress operations: @keyframes with opacity oscillation on .pulsing class"
    - "Underscore prefix for intentionally unused destructured props: scenarioId: _scenarioId (noUnusedParameters compliant)"
    - "Decision color/bg helper functions: decisionColor(type) and decisionBg(type) for consistent decision type theming"
    - "Blockchain hash display: formatHash truncates to 16 chars + '...' with copy-to-clipboard button"
    - "Timeline history visual: absolute-positioned ::before line with dot elements using borderColor from decision type"

key-files:
  created:
    - "frontend/src/components/exercise/COAScoringPanel.tsx"
    - "frontend/src/components/exercise/COAScoringPanel.css"
    - "frontend/src/components/exercise/CommanderDecisionPanel.tsx"
    - "frontend/src/components/exercise/CommanderDecisionPanel.css"
  modified:
    - "frontend/src/components/exercise/ExerciseDashboard.tsx"

key-decisions:
  - "COAScoringPanel renders both panels on the same COAs tab — COA scoring and commander decision are separate components but can share the same scenario/phase/perspective context"
  - "Commander access control uses exerciseRole prop ('exercise_control' or 'commander') — no auth token check needed since the caller (ExerciseDashboard) knows the user role"
  - "scenarioId kept in CommanderDecisionPanel props interface for future history API calls but prefixed _scenarioId in destructuring to satisfy noUnusedParameters"
  - "Decision history derives from coas[] prop (COA state) rather than a separate API call — avoids an extra round trip since parent already has COAs"

requirements-completed:
  - EX-16
  - EX-17

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 14 Plan 08: COA Scoring Panel and Commander Decision Workflow Summary

**FASDC decision matrix with color-coded 5-criteria scores, staff-editable AI narrative, and commander accept/reject/modify/combine/return workflow with SHA-256 blockchain-anchored recording**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T20:36:53Z
- **Completed:** 2026-02-28T20:45:30Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Created `COAScoringPanel.tsx` (677 lines): COA list with inline creation form (name/description/scheme), per-COA scoring trigger with pulse animation, comparison checkbox selection, decision matrix table with CSS-colored cells (green/yellow/orange/red gradient), expandable detail pane showing individual FASDC criterion rationales and wargame evidence, staff-editable narrative with AI Generated/Edited badges, rankings list, comparison narrative textarea with staff recommendation
- Created `CommanderDecisionPanel.tsx` (741 lines): 5 decision action buttons with type-appropriate colors, decision form adapting to each type (COA dropdown for accept/reject/modify, element checkboxes for combine, notes textarea with required validation for reject/modify/return), blockchain confirmation display showing SHA-256 hash (truncated to 16 chars) with copy-to-clipboard, pulsing "anchoring pending" indicator, decision history timeline with vertical connector line
- Both components fully typed using existing `ScenarioCOA`, `COAComparisonResult`, `ExerciseCOAScore`, `CommanderDecision` types from `frontend/src/types/exercise.ts`
- Wired `COAScoringPanel` into `ExerciseDashboard` COAs tab replacing the placeholder; `CommanderDecisionPanel` exported for integration

## Task Commits

Each task was committed atomically:

1. **Task 1: COA Scoring Panel with Decision Matrix and Editable Narrative** - `19c1215` (feat)
2. **Task 2: Commander Decision Panel -- Accept/Reject/Modify/Combine Workflow** - `448b54e` (feat)

## Files Created/Modified

- `frontend/src/components/exercise/COAScoringPanel.tsx` - COA list, FASDC matrix, editable narrative (677 lines)
- `frontend/src/components/exercise/COAScoringPanel.css` - Full styling with score gradients and pulse animation
- `frontend/src/components/exercise/CommanderDecisionPanel.tsx` - 5-type decision workflow with blockchain confirmation (741 lines)
- `frontend/src/components/exercise/CommanderDecisionPanel.css` - Decision type coloring, timeline, hash display
- `frontend/src/components/exercise/ExerciseDashboard.tsx` - COAs tab wired to COAScoringPanel

## Decisions Made

- COAScoringPanel and CommanderDecisionPanel are separate components: the scoring panel is staff-oriented (build the comparison); the decision panel is commander-oriented (record the choice). This separation keeps concerns clean and allows the COA scoring to be used without the decision workflow
- Decision history derives from the `coas[]` prop rather than a separate API endpoint — COAs already carry `commanderDecision`, `decisionHash`, and `blockchainTx` fields, avoiding a round-trip
- `scenarioId` prefixed as `_scenarioId` in CommanderDecisionPanel destructuring — TypeScript's `noUnusedParameters` is enabled project-wide, but the prop is kept in the interface for future decision history API calls
- Access control uses `exerciseRole` prop string comparison — the ExerciseDashboard knows user role and passes it down; no direct auth store access needed in this component

## Deviations from Plan

None - plan executed exactly as written.

TypeScript compilation passes cleanly for all new files. Both minimum line requirements exceeded (COAScoringPanel: 677/120 min, CommanderDecisionPanel: 741/100 min). All key_links patterns verified (exerciseService.getCOAs, exerciseService.scoreCOA, exerciseService.compareCOAs, exerciseService.updateNarrative, exerciseService.recordDecision).

## Issues Encountered

- Linter auto-added `OrderEditor`, `IPBPanel`, and `PlanningBoard` imports to `ExerciseDashboard.tsx` (ahead-of-plan components from Plans 07/09/10 that were pre-created). These pre-existing files have their own TypeScript warnings but do not affect the current plan's deliverables. No action required.

## Next Phase Readiness

- `COAScoringPanel` exports ready for ExerciseDashboard COAs tab — already wired
- `CommanderDecisionPanel` exported and ready for integration — caller provides `coas[]` and `exerciseRole` props
- Decision matrix patterns (score colors, badge system) established for reuse in Plan 14-09 (order generation) and 14-10 (planning board)

## Self-Check: PASSED

- FOUND: frontend/src/components/exercise/COAScoringPanel.tsx (677 lines)
- FOUND: frontend/src/components/exercise/COAScoringPanel.css
- FOUND: frontend/src/components/exercise/CommanderDecisionPanel.tsx (741 lines)
- FOUND: frontend/src/components/exercise/CommanderDecisionPanel.css
- FOUND: 14-08-SUMMARY.md
- FOUND commit: 19c1215 (Task 1)
- FOUND commit: 448b54e (Task 2)
- TypeScript compilation: CLEAN for COAScoringPanel and CommanderDecisionPanel (no errors)

---
*Phase: 14-friendly-adversary-ipb-complete-cycle*
*Completed: 2026-02-28*
