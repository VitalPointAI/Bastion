---
phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
plan: 05
subsystem: frontend
tags: [react, typescript, governance, decision-gates, design-revision, fork-and-merge]

# Dependency graph
requires:
  - phase: 49
    plan: 04
    provides: RevisionProposalModal + design-revision-service creating design_revision gate_type
  - phase: 49
    plan: 03
    provides: revision API endpoints (POST/GET/PATCH on /api/design/:problemSetId/revisions)

provides:
  - design_revision gate type label in GATE_TYPE_LABELS across all governance components
  - Merge to Design button in DecisionGateBanner for approved design_revision gates
  - pushHandoff deprecated in design-service.ts and backend/src/api/design.ts

affects:
  - Governance dashboard now shows design_revision gates with proper human-readable labels
  - DecisionGateBanner now surfaces merge action for approved revision proposals

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Merge to Design button: gated on gate.gate_type === 'design_revision' && gate.status === 'approved' in DecisionGateBanner"
    - "Merge state tracked locally in Set<string> (mergedGates) to prevent double-merge without refresh"
    - "GATE_TYPE_LABELS updated uniformly across 5 governance components: DecisionBriefView, GovernanceGateDashboard, DecisionGateTimeline, GateProposalModal, PhaseProgressionBar (SHORT)"

key-files:
  created: []
  modified:
    - frontend/src/components/governance/DecisionGateBanner.tsx
    - frontend/src/components/governance/DecisionBriefView.tsx
    - frontend/src/components/governance/GovernanceGateDashboard.tsx
    - frontend/src/components/governance/DecisionGateTimeline.tsx
    - frontend/src/components/governance/GateProposalModal.tsx
    - frontend/src/components/governance/PhaseProgressionBar.tsx
    - frontend/src/lib/design-service.ts
    - backend/src/api/design.ts

key-decisions:
  - "Merge to Design button shown in banner (not auto-triggered on approval) — maintains explicit human action for merge step"
  - "Merge state tracked in local Set — no context refresh needed; button disappears after merge and 'Merged' label appears"
  - "pushHandoff deprecated with @deprecated JSDoc only — method and route kept for backward compatibility"
  - "design_revision added to GATE_TYPE_LABELS across all 5 governance components for consistent display"

patterns-established:
  - "Gate type label consistency: when adding new gate_type, update all 5 GATE_TYPE_LABELS/SHORT maps in governance components"

requirements-completed: [DAP-03, DAP-05]

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 49 Plan 05: Governance Approval Callback and Design Revision Gate Labels Summary

**design_revision gate type labeled across all 5 governance components, Merge to Design button wired to designRevisionService.merge() in DecisionGateBanner, push-handoff deprecated — complete bidirectional fork-and-merge loop ready for human verification**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T14:55:19Z
- **Completed:** 2026-03-17T15:04:00Z
- **Tasks:** 1 of 2 complete (Task 2 is human verification checkpoint)
- **Files modified:** 8

## Accomplishments

- Added `design_revision: 'Design Revision Proposal'` to GATE_TYPE_LABELS in DecisionBriefView, GovernanceGateDashboard, DecisionGateTimeline, GateProposalModal; `design_revision: 'DSN-REV'` to GATE_TYPE_SHORT in PhaseProgressionBar
- Added "Merge to Design" button in DecisionGateBanner: appears only on approved design_revision gates, calls `designRevisionService.merge(gate.problem_set_id, gate.target_item_id)`, tracks merged state locally to show "Merged" label post-merge
- Added `@deprecated` JSDoc to `pushHandoff()` in design-service.ts: "Phase 49 — Plan tab fetches directly via getDesign(). Kept for backward compatibility"
- Added `@deprecated` JSDoc comment to POST /:problemSetId/push-handoff route in backend/src/api/design.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire governance approval to revision merge and add gate type labels** - `d62eb365` (feat)

**Plan metadata:** (in final commit)

## Files Created/Modified

- `frontend/src/components/governance/DecisionGateBanner.tsx` — imports designRevisionService, adds Merge to Design button + merge state + merge handler
- `frontend/src/components/governance/DecisionBriefView.tsx` — GATE_TYPE_LABELS += design_revision
- `frontend/src/components/governance/GovernanceGateDashboard.tsx` — GATE_TYPE_LABELS += design_revision
- `frontend/src/components/governance/DecisionGateTimeline.tsx` — GATE_TYPE_LABELS += design_revision
- `frontend/src/components/governance/GateProposalModal.tsx` — GATE_TYPE_LABELS += design_revision
- `frontend/src/components/governance/PhaseProgressionBar.tsx` — GATE_TYPE_SHORT += design_revision: DSN-REV
- `frontend/src/lib/design-service.ts` — pushHandoff deprecated with @deprecated JSDoc
- `backend/src/api/design.ts` — push-handoff route deprecated with @deprecated JSDoc

## Decisions Made

- Merge to Design button shown in banner as explicit manual action rather than auto-triggering on approval — this keeps the merge step a deliberate human action consistent with the overall fork-and-merge philosophy
- Local Set<string> mergedGates tracks which gates have been merged to avoid double-merge; cleared on page reload which is acceptable since merged revisions have status 'merged' in DB
- pushHandoff kept (not deleted) for backward compatibility — any existing code paths using it continue to work

## Deviations from Plan

None - plan executed exactly as written. The plan noted that GATE_TYPE_LABELS needed updating in DecisionBriefView and PhaseProgressionBar; during implementation also found it in DecisionGateTimeline and GateProposalModal (Rule 2: missing critical consistency) and updated those too.

## Issues Encountered

None. TypeScript compiled clean.

## User Setup Required

None — changes are frontend-only except for backend deprecation comment. No environment changes or migrations needed.

## Next Phase Readiness

- Task 2 (human verification checkpoint) requires browser walkthrough of all 9 items listed in the plan
- Full bidirectional Design/Plan integration should be verifiable: auto-fetch, revision proposal, governance gate, merge back
- After human approval, the phase is complete

---
*Phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point*
*Completed: 2026-03-17 (Task 2 verification pending)*
