---
phase: 49-align-design-tab-operational-approach-with-plan-tab-remove-duplicate-operational-design-from-plan-use-design-tab-outputs-as-campaign-planning-starting-point
verified: 2026-03-17T16:00:00Z
status: human_needed
score: 11/12 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to a problem set Plan tab at strategic echelon. Open Strategic Guidance. Verify exactly 3 steps: Assessment, Alignment, Directive — Operational Approach must not appear."
    expected: "Sidebar shows Assessment / Alignment / Directive. No Operational Approach step."
    why_human: "SG_STEPS config and conditional renders are correct in code but the runtime sidebar rendering requires browser verification."
  - test: "Open Strategic Assessment step. Scroll through all sections."
    expected: "No CoG analysis section is present. Sections are: Strategic Environment Summary, Key Assumptions, Strategic Factors only."
    why_human: "CoG removal verified in source but rendered section labels need runtime confirmation."
  - test: "Open Strategic Alignment step. Verify all 4 sections render."
    expected: "Section A: National Objectives list. Section B: Operational Linkage mapping table. Section C: Gaps & Misalignments warning cards. Section D: Staff Confirmation with Confirm Alignment button."
    why_human: "Component is 584 lines and substantive, but UX quality of AI-assisted objective mapping cannot be verified programmatically."
  - test: "Navigate to JPP Step 2 (Mission Analysis). Verify two blue-tinted DesignContextPanels at the top of the step."
    expected: "Panel 1: 'Problem Statement (from Design)' with lock icon. Panel 2: 'Center of Gravity Analysis (from Design)' with lock icon. Both show appropriate empty-state or data depending on whether Design tab has been completed."
    why_human: "Wiring to designService.getDesign() is confirmed in code; runtime fetch and rendering require browser."
  - test: "Navigate to JPP Step 3 (COA Development). Verify DesignContextPanel for LOEs."
    expected: "Blue-tinted 'Lines of Effort (from Design)' panel at top of step, before editable COA sections."
    why_human: "Runtime rendering requires browser."
  - test: "Navigate to JPP Step 7 (Plan/Order Development). Verify DesignContextPanel for phases."
    expected: "Blue-tinted 'Operational Phases and Transitions (from Design)' panel before Five-Paragraph Order sections."
    why_human: "Runtime rendering requires browser."
  - test: "On any DesignContextPanel where Design section status is 'complete', click 'Propose Revision'."
    expected: "Modal opens showing RevisionDiffView (side-by-side diff), artifact-specific editable form, required rationale textarea, and Submit for Review button. Submitting creates a revision record and a DAO governance gate."
    why_human: "Full modal interaction and DAO gate creation require browser + running API."
  - test: "Navigate to Design tab overview. Check for Plan Tab Sync Status section."
    expected: "DesignSyncIndicator showing 4 rows with arrows: Problem Framing -> Plan Step 2, CoG Analysis -> Plan Step 2, Lines of Effort -> Plan Step 3, Operational Approach -> Plan Step 7. No 'Push to Plan Tab' button visible."
    why_human: "Visual component layout and absence of push button require browser verification."
  - test: "In governance dashboard, check for design_revision gate type after submitting a revision proposal."
    expected: "Gate appears labeled 'Design Revision Proposal'. When gate is approved, 'Merge to Design' button appears. Clicking it merges proposed data back to Design tab."
    why_human: "End-to-end governance approval and merge flow requires full system interaction."
---

# Phase 49: Align Design Tab with Plan Tab Verification Report

**Phase Goal:** Remove duplicate operational design from Plan tab, establish Design tab as single source of truth for operational design artifacts (CoG, LOEs, problem framing, operational approach), wire Design outputs as automatic starting point for campaign planning in Plan tab, restructure Strategic Guidance to remove Operational Approach step and add Alignment step, build generic fork-and-merge revision system for Plan-to-Design change proposals through DAO governance.

**Verified:** 2026-03-17T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Strategic Guidance shows 3 steps: Assessment, Alignment, Directive — no Operational Approach | VERIFIED | SG_STEPS = ['strategic_assessment', 'strategic_alignment', 'commander_directive'] in StrategicGuidanceStepConfig.ts; conditional render updated in StrategicGuidancePlanView.tsx |
| 2 | StrategicAlignment step renders AI-assisted objective mapping UI | VERIFIED | StrategicAlignment.tsx exists at 584 lines with 4 substantive sections: National Objectives, Operational Linkage Panel, Gaps & Misalignments, Staff Confirmation; exports `StrategicAlignment` function |
| 3 | StrategicAssessment no longer shows CoG analysis section | VERIFIED | centerOfGravityAnalysis removed from type, EMPTY_CONTENT, and render output; comment added at removal point |
| 4 | OperationalApproach.tsx deleted with no broken imports | VERIFIED | File absent from plan/steps/; TypeScript compiles clean; remaining OperationalApproach references in DesignContextPanel/RevisionProposalModal/RevisionDiffView are type imports from design-service.ts (the data shape), not the deleted component |
| 5 | JPP Step 2 (Mission Analysis) displays problem statement and CoG from Design as read-only | VERIFIED | designService.getDesign() + getStatus() fetched in parallel useEffect; two DesignContextPanel instances rendered; wiring confirmed via grep |
| 6 | JPP Step 3 (COA Development) displays Lines of Effort from Design as read-only | VERIFIED | designService.getDesign() already existed, extended with getStatus(); DesignContextPanel for LOEs added at top |
| 7 | JPP Step 7 (Plan/Order Development) displays phases/transitions from Design as read-only | VERIFIED | designService.getDesign() + getStatus() fetched on mount; DesignContextPanel for operational approach phases at top |
| 8 | Design overview shows sync status indicator | VERIFIED | DesignSyncIndicator imported and rendered in DesignOverview.tsx with status prop wired |
| 9 | design_revisions table schema defined with migration | VERIFIED | 033-design-revisions.sql exists with CREATE TABLE, full lifecycle columns (gate_id, reviewed_by, reviewed_at, merged_at), two indexes |
| 10 | Revision CRUD backend complete with merge operation | VERIFIED | revision-store.ts exports revisionStore with create, findByProblemSet, findById, updateStatus, merge; merge maps artifact_type to operational_designs column |
| 11 | Revision proposal frontend workflow complete | VERIFIED | design-revision-service.ts, RevisionDiffView.tsx, RevisionProposalModal.tsx all exist and are substantive; DesignContextPanel wired to RevisionProposalModal; modal creates DAO gate via useDecisionGates('plan').createGate |
| 12 | Governance dashboard shows design_revision gates with merge capability | VERIFIED (code) / NEEDS HUMAN (runtime) | design_revision added to GATE_TYPE_LABELS in all 5 governance components; DecisionGateBanner has Merge to Design button gated on approved status; designRevisionService.merge() called on click |

**Score:** 11/12 truths fully verified programmatically (truth 12 is verified in code, runtime flow needs human)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend/src/components/plan/StrategicGuidanceStepConfig.ts` | VERIFIED | Contains 'strategic_alignment' in SG_STEPS; strategic_alignment config entry with label, roles, AI agent |
| `frontend/src/components/plan/steps/StrategicAlignment.tsx` | VERIFIED | 584 lines; exports `StrategicAlignment` function; 4 sections implemented |
| `frontend/src/components/plan/steps/StrategicAssessment.tsx` | VERIFIED | centerOfGravityAnalysis absent; Phase 49 comment present |
| `frontend/src/components/plan/steps/OperationalApproach.tsx` | VERIFIED DELETED | File does not exist; no broken TypeScript imports |
| `frontend/src/components/plan/DesignContextPanel.tsx` | VERIFIED | 302 lines; exports DesignContextPanel; renders all 4 artifact types; RevisionProposalModal wired |
| `frontend/src/components/plan/DesignContextPanel.css` | VERIFIED | Present in filesystem |
| `frontend/src/components/design/DesignSyncIndicator.tsx` | VERIFIED | 208 lines; exported and wired into DesignOverview |
| `frontend/src/lib/design-revision-service.ts` | VERIFIED | 116 lines; exports designRevisionService with create/list/get/merge/updateStatus |
| `frontend/src/components/plan/RevisionProposalModal.tsx` | VERIFIED | 501 lines; exports RevisionProposalModal; creates revision + DAO gate on submit |
| `frontend/src/components/plan/RevisionDiffView.tsx` | VERIFIED | 353 lines; exports RevisionDiffView; artifact-specific before/after diff |
| `backend/src/db/migrations/033-design-revisions.sql` | VERIFIED | CREATE TABLE design_revisions with full schema; 2 indexes |
| `backend/src/design/revision-store.ts` | VERIFIED | 236 lines; exports revisionStore; merge operation maps artifact_type to operational_designs columns |
| `backend/src/api/design-revisions.ts` | VERIFIED | 179 lines; exports router; 5 endpoints with try/catch; Router({ mergeParams: true }) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| StrategicGuidancePlanView.tsx | StrategicAlignment.tsx | stepId === 'strategic_alignment' conditional | WIRED | Line 191 renders StrategicAlignment when stepId matches |
| StrategicGuidanceStepConfig.ts | StrategicGuidancePlanView.tsx | SG_STEPS drives sidebar | WIRED | SG_STEPS imported and used to build step list |
| MissionAnalysis.tsx | designService.getDesign() | useEffect fetch on mount | WIRED | Lines 204-205 fetch design + status in parallel |
| COADevelopment.tsx | designService.getDesign() | useEffect fetch on mount | WIRED | Lines 164-165 fetch design + status |
| PlanOrderDevelopment.tsx | designService.getDesign() | useEffect fetch on mount | WIRED | Lines 307-308 fetch design + status |
| DesignOverview.tsx | DesignSyncIndicator.tsx | import + render with status prop | WIRED | Line 10 import; line 243 render |
| backend/src/api/design.ts | design-revisions.ts | router.use mount at /:problemSetId/revisions | WIRED | Line 17 import; line 22 mount before catch-all routes |
| design-revisions.ts | revision-store.ts | import revisionStore | WIRED | Line 13 import; used in all 5 route handlers |
| DesignContextPanel.tsx | RevisionProposalModal.tsx | Propose Revision button opens modal | WIRED | Line 21 import; line 288 render |
| RevisionProposalModal.tsx | designRevisionService.create | API call on submit | WIRED | Line 20 import; line 336 create call |
| RevisionProposalModal.tsx | useDecisionGates('plan').createGate | DAO gate creation after revision | WIRED | Line 311 hook; lines 344-351 createGate with gate_type: 'design_revision' |
| DecisionGateBanner.tsx | designRevisionService.merge | Merge to Design button on approved gates | WIRED | gate_type === 'design_revision' && status === 'approved' conditional; merge called on click |

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|-------------|--------|---------|
| DAP-01 | 49-01 | SATISFIED | StrategicGuidanceStepConfig.ts restructured; Operational Approach removed |
| DAP-02 | 49-01 | SATISFIED | StrategicAlignment.tsx created with objective mapping UI |
| DAP-03 | 49-02, 49-05 | SATISFIED | DesignContextPanel renders Design artifacts read-only in JPP steps; designService.getDesign() called on render |
| DAP-04 | 49-02 | SATISFIED | DesignSyncIndicator shows sync status; push-handoff UI removed |
| DAP-05 | 49-03, 49-05 | SATISFIED | design_revisions table, revision-store CRUD, Express API all built; governance labels added |
| DAP-06 | 49-04 | SATISFIED | RevisionProposalModal with diff view, artifact editors, DAO gate creation |
| DAP-07 | 49-02 | SATISFIED | PlanOrderDevelopment.tsx fetches Design operational approach phases |
| DAP-08 | 49-01 | SATISFIED | StrategicAssessment.tsx CoG section removed |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| RevisionProposalModal.tsx | 383 | `return null` | INFO | Standard React pattern for closed modal — not a stub |
| Various .tsx | multiple | `placeholder="..."` | INFO | HTML textarea/input placeholder attributes — proper UX text, not stub placeholders |

No blockers or warnings found. The `return null` in RevisionProposalModal is standard React conditional rendering for closed modals. The `placeholder` strings are HTML form attributes.

### Human Verification Required

The automated code verification passes on all 12 observable truths. The following 9 items require browser walkthrough to confirm runtime behavior. These are specified in the Plan 05 human checkpoint task:

#### 1. Strategic Guidance Step Sidebar

**Test:** Navigate to a problem set's Plan tab at strategic echelon. Open Strategic Guidance sidebar.
**Expected:** Exactly 3 steps: Assessment, Alignment, Directive. "Operational Approach" must not appear.
**Why human:** Runtime sidebar rendering cannot be verified by grep.

#### 2. Strategic Assessment — No CoG Section

**Test:** Open Strategic Assessment step. Scroll through all rendered sections.
**Expected:** No CoG analysis section present. Only: Strategic Environment Summary, Key Assumptions, Strategic Factors.
**Why human:** Rendered section visibility requires browser.

#### 3. Strategic Alignment — 4 Sections Present

**Test:** Open Strategic Alignment step.
**Expected:** Section A (National Objectives list with AI agent panel), Section B (Operational Linkage mapping table), Section C (Gaps & Misalignments warning cards), Section D (Staff Confirmation + Confirm Alignment button).
**Why human:** AI agent panel integration and UX quality of objective mapping require visual confirmation.

#### 4. JPP Step 2 — DesignContextPanels at Top

**Test:** Navigate to Mission Analysis (JPP Step 2).
**Expected:** Two blue-tinted panels at top with lock icons: "Problem Statement (from Design)" and "Center of Gravity Analysis (from Design)". Graceful empty state if Design tab not completed.
**Why human:** Fetch-on-render and visual treatment require browser.

#### 5. JPP Step 3 — LOE DesignContextPanel at Top

**Test:** Navigate to COA Development (JPP Step 3).
**Expected:** Blue-tinted "Lines of Effort (from Design)" panel before editable COA sections.
**Why human:** Runtime rendering requires browser.

#### 6. JPP Step 7 — Phases DesignContextPanel at Top

**Test:** Navigate to Plan/Order Development (JPP Step 7).
**Expected:** Blue-tinted "Operational Phases and Transitions (from Design)" panel before Five-Paragraph Order sections.
**Why human:** Runtime rendering requires browser.

#### 7. Propose Revision Modal Flow

**Test:** On any DesignContextPanel where Design section status is 'complete', click "Propose Revision."
**Expected:** Modal opens with side-by-side diff view (current left, proposed right), artifact-specific editable form, required rationale textarea, "Submit for Review" button. Submitting creates both a revision record and a DAO governance gate.
**Why human:** Modal interaction, real-time diff preview updates, and API call chain require browser + running backend.

#### 8. Design Tab Overview — Sync Indicator, No Push Button

**Test:** Navigate to Design tab overview.
**Expected:** "Plan Tab Sync Status" section with 4 arrow-flow rows showing which Design sections sync to which JPP steps. No "Push to Plan Tab" / "Design-to-Plan Handoff" button visible.
**Why human:** Visual layout and button absence require browser.

#### 9. Governance Dashboard — design_revision Gate Merge Flow

**Test:** After submitting a revision proposal, navigate to governance dashboard.
**Expected:** Gate appears labeled "Design Revision Proposal." When approved, "Merge to Design" button appears. Clicking merges proposed data back to Design tab (confirmed via Design tab showing updated artifact).
**Why human:** End-to-end approval + merge requires full system (DB, API, frontend) running together.

### Gaps Summary

No gaps found. All automated checks pass. The phase goal is architecturally achieved:

- **Design tab as single source of truth:** OperationalApproach.tsx deleted from Plan tab; CoG removed from StrategicAssessment; Design artifacts fetched directly in 3 JPP steps via designService.getDesign()
- **Strategic Guidance restructured:** SG_STEPS = [strategic_assessment, strategic_alignment, commander_directive]; StrategicAlignment.tsx built with 4-section objective mapping UI
- **Fork-and-merge revision system:** Complete backend (migration, store, 5 API endpoints) + frontend (service client, diff viewer, proposal modal, DAO gate creation) + governance integration (labels in 5 components, Merge to Design button in DecisionGateBanner)
- **TypeScript compiles clean:** Zero errors across both frontend and backend

All 13 planned files are present and substantive. All 12 key wiring links confirmed in code. 9 items require human browser walkthrough to confirm runtime behavior.

---

_Verified: 2026-03-17T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
