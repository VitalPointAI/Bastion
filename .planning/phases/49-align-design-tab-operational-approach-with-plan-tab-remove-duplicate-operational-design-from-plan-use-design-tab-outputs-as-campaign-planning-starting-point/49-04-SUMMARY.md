---
phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
plan: 04
subsystem: frontend
tags: [react, typescript, design-revisions, fork-and-merge, dao-governance, modal]

# Dependency graph
requires:
  - phase: 49
    plan: 03
    provides: revision API endpoints (POST/GET/PATCH on /api/design/:problemSetId/revisions)
  - phase: 49
    plan: 02
    provides: DesignContextPanel with Propose Revision placeholder button

provides:
  - design-revision-service.ts — typed API client with create/list/get/merge/updateStatus
  - RevisionDiffView.tsx — artifact-specific before/after visual comparison (no diff library)
  - RevisionProposalModal.tsx — full proposal workflow with editors, diff preview, DAO gate creation
  - DesignContextPanel.tsx updated — Propose Revision button opens modal when section is complete

affects:
  - 49-05 (governance dashboard — revision proposals visible as design_revision gate type)
  - Any Plan Tab JPP steps using DesignContextPanel (now have working revision proposal flow)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RevisionDiffView uses field-by-field JSON.stringify comparison (no diff library)"
    - "RevisionProposalModal initializes proposedData via structuredClone(originalData) to avoid mutating original"
    - "useDecisionGates('plan') provides createGate — revision modal calls it after designRevisionService.create()"
    - "ARTIFACT_TYPE_MAP in DesignContextPanel maps DesignArtifact -> RevisionArtifactType (problem-statement -> problem-framing, etc.)"
    - "Button gated on sectionStatus === 'complete' — can't propose revisions to incomplete sections"

key-files:
  created:
    - frontend/src/lib/design-revision-service.ts
    - frontend/src/components/plan/RevisionDiffView.tsx
    - frontend/src/components/plan/RevisionProposalModal.tsx
  modified:
    - frontend/src/components/plan/DesignContextPanel.tsx

key-decisions:
  - "No diff library — used simple field-by-field JSON.stringify comparison per RESEARCH.md anti-patterns"
  - "CoG editor limited to CoG root label only — full tree editing stays in Design Tab (appropriate scope boundary)"
  - "structuredClone for initial proposedData — prevents mutation of originalData prop during editing"
  - "RevisionDiffView used in both read-only diff display AND as live preview while editing (single source of truth)"

patterns-established:
  - "Fork-and-merge frontend pattern: edit proposed data locally -> submit -> revision record + DAO gate created atomically"

requirements-completed: [DAP-06]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 49 Plan 04: Frontend Revision Proposal Workflow Summary

**Frontend fork-and-merge revision workflow: typed API client, visual diff viewer, artifact-specific proposal modal with DAO governance gate creation, and wired Propose Revision button in DesignContextPanel**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T14:48:02Z
- **Completed:** 2026-03-17T14:52:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `design-revision-service.ts`: typed API client mirroring Plan 03 backend — create, list, get, merge, updateStatus with proper error handling matching design-service.ts pattern
- `RevisionDiffView.tsx`: artifact-specific before/after comparison across all 4 artifact types — problem-framing uses side-by-side text fields, cog-analysis uses two-column CoG tree comparison, lines-of-effort uses added/removed/modified list indicators, operational-approach uses phase list with New/Modified/Removed tags
- `RevisionProposalModal.tsx`: full proposal modal — artifact-specific editors, live diff preview (RevisionDiffView updates in real-time), required rationale textarea, submit creates revision via designRevisionService then creates DAO governance gate via useDecisionGates('plan').createGate with gate_type: 'design_revision'
- `DesignContextPanel.tsx`: replaced disabled placeholder button with working Propose Revision button (enabled only when sectionStatus === 'complete'), wired to RevisionProposalModal with correct artifact type mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Create design-revision-service and RevisionDiffView** - `bd460b5d` (feat)
2. **Task 2: Create RevisionProposalModal and wire into DesignContextPanel** - `4dda2172` (feat)

**Plan metadata:** (in final commit)

## Files Created/Modified

- `frontend/src/lib/design-revision-service.ts` — API client: create, list, get, merge, updateStatus
- `frontend/src/components/plan/RevisionDiffView.tsx` — visual diff for 4 artifact types
- `frontend/src/components/plan/RevisionProposalModal.tsx` — proposal modal + DAO gate creation
- `frontend/src/components/plan/DesignContextPanel.tsx` — wired Propose Revision button

## Decisions Made

- No diff library used — field-by-field JSON.stringify comparison is sufficient for small structured JSON artifacts (per RESEARCH.md)
- CoG editor in the modal is deliberately limited to editing the CoG root label only; full tree editing (adding CCs, CRs, CVs) appropriately stays in the Design Tab
- Used `structuredClone()` to initialize `proposedData` state from `originalData` prop — prevents accidental mutation of parent data during editing
- RevisionDiffView serves dual purpose: static diff display AND live preview that updates as the user edits `proposedData` in the modal

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — frontend-only changes. Backend API endpoints were built in Plan 03.

## Next Phase Readiness

- Revision proposals create `design_revision` gate type — visible in governance dashboard
- Ready for Plan 49-05: governance dashboard integration showing pending revision proposals
- DesignContextPanel now fully functional for revision proposal flow

---
*Phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point*
*Completed: 2026-03-17*
