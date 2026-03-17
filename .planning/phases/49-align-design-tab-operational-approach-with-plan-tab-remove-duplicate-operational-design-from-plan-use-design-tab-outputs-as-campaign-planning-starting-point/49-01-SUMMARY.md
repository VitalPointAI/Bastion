---
phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
plan: "01"
subsystem: plan-tab-strategic-guidance
tags: [strategic-guidance, operational-approach, cog-analysis, refactor, design-tab-separation]
dependency_graph:
  requires: []
  provides: [strategic-alignment-step, cog-removed-from-strategic-assessment]
  affects: [StrategicGuidancePlanView, StrategicGuidanceStepConfig, DesignTab]
tech_stack:
  added: []
  patterns: [auto-save debounce, step content service pattern, role-gated section layout]
key_files:
  created:
    - frontend/src/components/plan/steps/StrategicAlignment.tsx
  modified:
    - frontend/src/components/plan/StrategicGuidanceStepConfig.ts
    - frontend/src/components/plan/StrategicGuidancePlanView.tsx
    - frontend/src/components/plan/steps/StrategicAssessment.tsx
  deleted:
    - frontend/src/components/plan/steps/OperationalApproach.tsx
decisions:
  - "Design tab is single source of truth for CoG analysis and operational approach — Plan tab Strategic Guidance no longer duplicates this content"
  - "Strategic Guidance steps are now: Assessment / Alignment / Directive (no Operational Approach)"
  - "Governance label maps in DAODashboard, DecisionGateTimeline, GateProposalModal retain 'operational_approach' entries for historical DB record display — intentional non-change"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-17T14:36:07Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 49 Plan 01: Replace Operational Approach with Strategic Alignment in SG Workflow Summary

Replaced the duplicate Operational Approach step in the Strategic Guidance workflow with a new Strategic Alignment step, and removed CoG analysis from StrategicAssessment. The Design tab is now the single source of truth for operational design content.

## What Was Built

### Task 1: Replace Operational Approach with Strategic Alignment

**StrategicGuidanceStepConfig.ts**
- Replaced `'operational_approach'` with `'strategic_alignment'` in `SG_STEPS` array
- Removed `operational_approach` config entry from `SGStepConfig`
- Added `strategic_alignment` config: label "Strategic Alignment", maps national objectives to operational ends, uses `strategic-analyst` AI agent
- Updated JSDoc to reflect new Assessment / Alignment / Directive step order

**StrategicGuidancePlanView.tsx**
- Replaced `OperationalApproach` import with `StrategicAlignment`
- Updated `stepId === 'operational_approach'` conditional to `stepId === 'strategic_alignment'`

**StrategicAlignment.tsx (new)**
- Section A: National Objectives — editable list of national/political objectives from strategic documents
- Section B: Operational Linkage Panel — mapping table of national objective -> operational end -> rationale; dropdown populated from Section A when objectives exist
- Section C: Gaps & Misalignments — warning cards for objectives without linkages
- Section D: Staff Confirmation — summary stats + "Confirm Alignment" button that marks step as confirmed with timestamp
- Auto-save to `sgService.saveStepContent(instanceId, 'strategic_alignment', ...)` with 500ms debounce
- Handles empty state gracefully with descriptive placeholder text

**OperationalApproach.tsx (deleted)**
- Duplicate of operational design content that lives in the Design tab

### Task 2: Remove CoG Section from StrategicAssessment

**StrategicAssessment.tsx**
- Removed `COGAnalysis` interface
- Removed `EMPTY_COG` constant
- Removed `centerOfGravityAnalysis` field from `StrategicAssessmentContent` type
- Removed `centerOfGravityAnalysis` from `EMPTY_CONTENT` default
- Removed `COGSection` sub-component (58 lines)
- Removed CoG render section from JSX (~20 lines)
- Added comment: `// CoG analysis moved to Design tab (Phase 49) — single source of truth`
- Renumbered sections: 1. Strategic Environment Summary, 2. Key Assumptions, 3. Strategic Factors

## Deviations from Plan

None — plan executed exactly as written.

**Note on out-of-scope references:** The following files contain `operational_approach` as a historical governance gate type label for display of existing DB records. Per the plan, backend data is harmless and these were intentionally not modified:
- `frontend/src/components/dao/DAODashboard.tsx`
- `frontend/src/components/governance/DecisionGateTimeline.tsx`
- `frontend/src/components/governance/GateProposalModal.tsx`
- `frontend/src/lib/gate-service.ts`
- `frontend/src/components/tabs/DirectTab.tsx`
- `frontend/src/components/tabs/DesignTab.tsx` (uses `operational_approach` gate type for Design tab's own submission, unrelated to Plan tab step)

## Verification Results

- `tsc --noEmit`: Zero errors
- No import references to `OperationalApproach` in `plan/` directory
- No active `operational_approach` step references (only comment in StrategicGuidanceStepConfig.ts JSDoc)
- `SG_STEPS` contains exactly: `['strategic_assessment', 'strategic_alignment', 'commander_directive']`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | bd029f23 | feat(49-01): replace OperationalApproach with StrategicAlignment in SG workflow |
| Task 2 | 278b11a1 | feat(49-01): remove CoG analysis section from StrategicAssessment |

## Self-Check: PASSED
