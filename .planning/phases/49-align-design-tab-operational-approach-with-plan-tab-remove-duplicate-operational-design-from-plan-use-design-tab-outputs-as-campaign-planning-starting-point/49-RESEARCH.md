# Phase 49: Align Design Tab with Plan Tab - Research

**Researched:** 2026-03-17
**Domain:** Frontend tab integration, design-to-plan data sync, fork-and-merge revision governance, strategic workflow restructuring
**Confidence:** HIGH — all findings drawn from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove Strategic Guidance Step 2 (Operational Approach) entirely — the Design tab IS the operational approach workspace
- Strategic Guidance becomes a 3-step workflow: **Assessment → Alignment → Directive**
  - Assessment: Auto-syncs from Understand tab's knowledge graph
  - Alignment: AI agents assist staff in mapping national/political objectives to operational-level ends
  - Directive: Commander's intent and planning guidance flows down as higher HQ guidance
- Strategic Assessment's simplified CoG section is removed — Design tab owns full CoG analysis
- Replace the manual "Push to Plan Tab" button with automatic real-time sync
- Replace the push button with a passive status indicator showing which Design sections are complete and syncing
- Design-sourced fields in Plan tab are read-only — to change them, user clicks "Propose Revision"
- Targeted placement of Design outputs in JPP steps:
  - Step 2 (Mission Analysis): Problem statement + CoG analysis
  - Step 3 (COA Development): Lines of Effort
  - Step 7 (Plan/Order Development): Phases/transitions
- No changes to the 8 JPP steps themselves — only addition of read-only Design context panels
- Build a **generic revision layer** that can wrap any Design artifact
- Proposed revisions require **DAO governance gate** approval before merging back to Design tab
- Visual diff display when reviewing proposed revisions
- Design tab is the canonical LOE source — Plan tab references via auto-sync
- Strategic Guidance's LOE content removed along with Step 2
- Force concepts mapped to correct doctrinal locations:
  - **Assignment** (standing forces) → Resource Registry (Phase 27)
  - **Apportionment** (notional planning assumptions) → JPP Step 3 (COA Development)
  - **Allocation** (real forces for execution) → JPP Step 7 (Plan/Order Development)

### Claude's Discretion
- Exact auto-sync implementation mechanism (WebSocket, polling, shared state)
- Generic revision layer data schema design
- Visual diff rendering approach for different artifact types (structured trees vs text narratives)
- AI agent selection and prompt design for the Strategic Alignment step
- Status indicator design and placement in Design tab
- Understand-to-Strategic-Assessment sync mechanism details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 49 is a substantial refactoring phase that resolves a duplication problem: the Plan tab's StrategicGuidancePlanView currently has an `OperationalApproach` step (Step 2 of 3) that duplicates work properly belonging in the Design tab. The work is in four areas: (1) delete the duplicate `OperationalApproach` step and replace it with a new `StrategicAlignment` step, (2) convert the manual push-to-plan button into an automatic sync with read-only display panels in three specific JPP steps, (3) build a generic fork-and-merge revision proposal system backed by existing DAO governance gates, and (4) clean up the StrategicAssessment component by removing its simplified CoG section.

The codebase is well-structured for this work. The Design tab (`DesignTab.tsx`) already owns all operational design artifacts with proper section components and auto-save. The handoff mechanism exists (`designService.getHandoff`, `designService.pushHandoff`) and just needs refactoring from push to pull/sync. The DAO governance gate system is mature and reusable for revision approval. The `StrategicGuidanceStepConfig.ts` defines a simple string array `SG_STEPS` that can be modified directly.

**Primary recommendation:** Implement auto-sync as simple fetch-on-render (not WebSocket) using `designService.getDesign()` directly from JPP step components — the same pattern `COADevelopment.tsx` already uses. Build the revision proposal system as a new `DesignRevisionProposal` table + `design-revision-service.ts` on the frontend, backed by the existing gate approval flow.

---

## Standard Stack

### Core (already in use — no new dependencies needed)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| React 18 (existing) | Component UI | Already the app framework |
| TypeScript (existing) | Type safety | Entire codebase is TypeScript |
| Express + PostgreSQL (existing) | Backend API + persistence | Existing pattern for all features |
| `gate-service.ts` / `DecisionGateContext` | DAO governance approval flow | Phase 28 — mature, used across the app |
| `designService` (existing) | Design CRUD + handoff | `design-service.ts` — just needs new sync endpoint |

### No New Dependencies
This phase is pure refactoring and integration of existing systems. All required patterns (TabLayout sidebar, governance gates, DAO approval, AI agent panels) already exist in the codebase.

---

## Architecture Patterns

### Recommended Project Structure for New Files
```
frontend/src/components/plan/steps/
  StrategicAlignment.tsx          # NEW: replaces OperationalApproach.tsx
frontend/src/components/plan/
  DesignContextPanel.tsx          # NEW: read-only design data panel for JPP steps
  RevisionProposalButton.tsx      # NEW: "Propose Revision" button + modal
frontend/src/lib/
  design-revision-service.ts      # NEW: API client for revision proposals

backend/src/api/
  design-revisions.ts             # NEW: Express routes for revision CRUD
backend/src/design/
  revision-store.ts               # NEW: PostgreSQL CRUD for design_revisions table
```

### Pattern 1: SG_STEPS Array Modification (StrategicGuidanceStepConfig.ts)
**What:** The `SG_STEPS` constant drives the entire StrategicGuidancePlanView sidebar and step rendering. Replacing `'operational_approach'` with `'strategic_alignment'` in this array automatically updates the sidebar and step numbering.

**Current state:**
```typescript
// frontend/src/components/plan/StrategicGuidanceStepConfig.ts
export const SG_STEPS = [
  'strategic_assessment',
  'operational_approach',   // DELETE THIS
  'commander_directive',
] as const;
```

**Target state:**
```typescript
export const SG_STEPS = [
  'strategic_assessment',
  'strategic_alignment',    // NEW
  'commander_directive',
] as const;
```

**Cascade:** `SGStepConfig` object needs a new `strategic_alignment` entry. `StrategicGuidancePlanView.tsx` renders `{stepId === 'operational_approach' && ...}` — update to `{stepId === 'strategic_alignment' && <StrategicAlignment ... />}`.

### Pattern 2: COADevelopment Auto-Sync Pattern (already exists)
**What:** `COADevelopment.tsx` already fetches design data directly via `designService.getDesign()`. This is the right pattern for Plan tab reading Design data — no WebSocket needed.

```typescript
// frontend/src/components/plan/COADevelopment.tsx (existing pattern)
import { designService, type LineOfEffort } from '../../lib/design-service.ts';

// In useEffect:
const designData = await designService.getDesign(problemSetId);
const loes = designData.linesOfEffort;
```

**Apply same pattern to:** `MissionAnalysis.tsx` (fetch problemStatement + cogAnalysis), `PlanOrderDevelopment.tsx` (fetch operationalApproach phases/transitions).

### Pattern 3: DesignContextPanel — Read-Only Display with Propose Revision
**What:** A reusable panel component placed inside JPP step layouts to show Design-sourced data as read-only with a "Propose Revision" CTA.

```typescript
interface DesignContextPanelProps {
  title: string;                          // e.g., "Problem Statement (from Design)"
  artifact: 'problem-statement' | 'cog-analysis' | 'lines-of-effort' | 'phases';
  data: unknown;                          // The Design tab data to display
  problemSetId: string;
  onRevisionProposed?: () => void;
}
```

Visual treatment: distinct background color (e.g., `rgba(30, 58, 138, 0.15)` blue tint) with a lock icon and "Sourced from Design Tab" label, plus the "Propose Revision" button in the top-right corner.

### Pattern 4: Generic Revision Layer Schema
**What:** Backend table and frontend service for proposing revisions to Design artifacts.

```sql
-- backend migration
CREATE TABLE IF NOT EXISTS design_revisions (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,  -- 'problem-framing' | 'cog-analysis' | 'lines-of-effort' | 'operational-approach'
  proposed_by TEXT NOT NULL,    -- accountId of proposing user
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_data JSONB NOT NULL, -- snapshot of Design data at time of proposal
  proposed_data JSONB NOT NULL, -- the proposed changes
  rationale TEXT,               -- why this change is being proposed
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected' | 'merged'
  gate_id TEXT REFERENCES decision_gates(id),  -- linked DAO governance gate
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  merged_at TIMESTAMPTZ
);
```

### Pattern 5: Revision Proposal — Reuse GateSubmitButton Pattern
**What:** The `GateSubmitButton` + `GateProposalModal` pattern already handles submit-for-approval workflows. The revision proposal flow reuses this: user clicks "Propose Revision" → opens modal with diff view + rationale field → creates a `design_revision` record + a `decision_gate` record → DAO governance handles approval → on approval, backend merges `proposed_data` back into `operational_designs` table.

**Key insight:** The revision doesn't need a new governance system — it creates a standard decision gate of type `'design_revision'` and uses the existing gate approval lifecycle.

### Pattern 6: StrategicAlignment Step Content
**What:** The new `StrategicAlignment.tsx` component handles AI-assisted mapping of national/political objectives to operational-level ends.

Structure:
1. **National Objectives (read-only, sourced from Strategic Assessment / Understand tab)** — display the strategic documents and extracted objectives already in the knowledge graph
2. **Operational Linkage Panel** — AI agent proposes national-to-operational objective linkages, staff reviews and confirms/edits
3. **Gaps & Misalignments** — AI flags where operational planning doesn't address national objectives
4. **Staff Confirmation** — finalize the alignment mapping before it flows to Commander's Directive

The AI agent for this step should use `strategic-analyst` agent (same as StrategicAssessment) or a new `alignment-analyst` agent role — Claude's discretion.

### Anti-Patterns to Avoid
- **Do not add a new real-time WebSocket connection** — fetch-on-render (same as COADevelopment) is sufficient and consistent with the existing codebase pattern
- **Do not duplicate Design data in the Plan tab** — Plan tab components must always fetch from `designService.getDesign()` and display read-only; never copy/paste the data into JPP step storage
- **Do not modify the 8 JPP step sidebar items or their step IDs** — per locked decisions, only inject DesignContextPanels into existing step content
- **Do not build a custom diff engine** — use a simple field-by-field comparison for structured data (arrays/objects) and string comparison for narratives; deep diffing libraries are overkill here

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Governance approval for revision proposals | Custom approval workflow | Existing `createGate` + `submitForApproval` from `DecisionGateContext` | Phase 28 DAO governance already handles the full approval lifecycle |
| Status indicator for Design sync | Custom polling/WebSocket | `designService.getStatus()` called on render (same as existing) | Existing status types match exactly: `not-started / in-progress / complete` per section |
| Step sidebar for new Alignment step | New sidebar component | Existing `TabLayout` + `SidebarItem` pattern — just update `SGStepConfig` entry | TabLayout already handles everything |
| Revision diff display | Full diff library (react-diff-viewer, etc.) | Simple inline comparison using existing styling patterns | Artifacts are small JSON objects; a simple before/after display is sufficient and consistent |
| Force apportionment removal | Refactor ForceApportionmentPanel | Simply delete it from `OperationalApproach.tsx` since the entire file is deleted | The file is being removed entirely; no refactor needed |

---

## Common Pitfalls

### Pitfall 1: Cascade from SGStepId type change
**What goes wrong:** `SGStepId` is a TypeScript `const` union derived from `SG_STEPS`. Changing the array breaks all type references to `'operational_approach'` in `StrategicGuidancePlanView.tsx`, `StrategicGuidanceStepConfig.ts`, and potentially the backend `strategic-guidance` service where step content is stored with key `'operational_approach'`.
**How to avoid:** Search for all uses of `'operational_approach'` as a step identifier (not the Design tab's section, which uses a different identifier) before deleting. Backend step content table stores content keyed to step ID — existing `operational_approach` content records become orphaned but are harmless.
**Warning signs:** TypeScript compilation errors referencing `SGStepId`.

### Pitfall 2: StrategicAssessment CoG section removal vs. Design tab CoG
**What goes wrong:** `StrategicAssessment.tsx` currently has a `centerOfGravityAnalysis` section in its data model and auto-save schema. Removing just the render section without updating the schema and save calls leaves dead data being saved to the backend.
**How to avoid:** When removing CoG from StrategicAssessment, also remove it from the `StrategicAssessmentContent` type and the `EMPTY_CONTENT` constant. The backend `sg_step_content` JSON store is schema-free so orphaned fields are harmless but should be cleaned.
**Warning signs:** TypeScript warnings about unreferenced type fields.

### Pitfall 3: Read-only Design panels breaking if Design data is null/empty
**What goes wrong:** JPP steps (Mission Analysis, COA Development, Plan/Order Development) will render DesignContextPanels on page load, fetching from `designService.getDesign()`. If no design has been started, the data is empty defaults. The panel must handle empty gracefully rather than showing blank or erroring.
**How to avoid:** DesignContextPanel should show a "Design tab not yet started" placeholder state when sections are `not-started` status, not an empty render.
**Warning signs:** Blank panels with no indication of why they're empty.

### Pitfall 4: Revision proposals referencing stale original_data
**What goes wrong:** When a user clicks "Propose Revision" from the Plan tab, the system must snapshot the current Design data as `original_data`. If the Design tab is updated between proposal submission and review/approval, the diff shown during review is misleading.
**How to avoid:** Always snapshot `original_data` at the moment of proposal creation (not at review time). The diff at review time is proposal vs. current Design state, not proposal vs. original snapshot.
**Warning signs:** Diffs showing changes that weren't part of the proposal.

### Pitfall 5: DesignStatusBadge vs. new sync indicator confusion
**What goes wrong:** The existing `DesignStatusBadge` shows section completion status (not-started/in-progress/complete). The new sync indicator for "which sections are syncing to Plan tab" is a different concept. Reusing the same badge style could confuse users about what the status means.
**How to avoid:** Create a new `DesignSyncIndicator` component with distinct visual language (e.g., arrows or "→ Plan" label rather than dots). Place it in DesignOverview alongside existing status badges but with clear labeling.
**Warning signs:** Users confused about whether badges mean "section complete" vs. "synced to plan."

---

## Code Examples

### Existing: How COADevelopment fetches Design data (verified pattern)
```typescript
// Source: frontend/src/components/plan/COADevelopment.tsx
import { designService, type LineOfEffort } from '../../lib/design-service.ts';

// In useEffect inside COADevelopment:
const designData = await designService.getDesign(problemSetId);
const loes = designData.linesOfEffort;
setDesignLOEs(loes);
```
This is the exact pattern to replicate for MissionAnalysis and PlanOrderDevelopment.

### Existing: StrategicGuidanceStepConfig — what to modify
```typescript
// Source: frontend/src/components/plan/StrategicGuidanceStepConfig.ts
export const SG_STEPS = [
  'strategic_assessment',
  'operational_approach',    // REMOVE — replace with 'strategic_alignment'
  'commander_directive',
] as const;

// Add new entry to SGStepConfig:
strategic_alignment: {
  label: 'Strategic Alignment',
  description: 'Map national and political objectives to operational-level ends with AI assistance.',
  primaryRoles: ['commander', 'j5_plans', 'strategic_analyst'],
  supportingRoles: ['j2_intelligence', 'chief_of_staff'],
  aiAgentId: 'strategic-analyst',  // or new 'alignment-analyst' — Claude's discretion
  governanceGate: undefined,        // no gate; alignment feeds into Directive step
},
```

### Existing: GateSubmitButton pattern — reuse for revision proposals
```typescript
// Source: frontend/src/components/governance/GateSubmitButton.tsx
// The createGate + submitForApproval flow handles everything needed.
// For revision proposals, use gate_type: 'design_revision' with metadata containing
// the artifact_type and revision_id.
const { createGate, submitForApproval } = useDecisionGates(tabId);
await createGate({
  problem_set_id: problemSetId,
  gate_type: 'design_revision',
  tab: 'plan',
  target_item_id: revisionId,
  target_item_type: artifactType,
  target_item_title: `Revision: ${artifactLabel}`,
  mode: 'operational',
});
```

### Existing: design-store.ts — existing handoff columns to extend
```typescript
// Source: backend/src/design/design-store.ts
// Table already has:
//   handoff_payload JSONB
//   handoff_pushed_at TIMESTAMPTZ
// For auto-sync, the getHandoffPayload() method is called by Plan tab directly
// (no push step needed). The handoff columns can remain for backward compat
// but the push-handoff endpoint becomes deprecated/no-op.
```

### New: DesignContextPanel skeleton
```typescript
// frontend/src/components/plan/DesignContextPanel.tsx
interface DesignContextPanelProps {
  title: string;
  artifact: 'problem-statement' | 'cog-analysis' | 'lines-of-effort' | 'phases';
  data: unknown;
  sectionStatus: 'not-started' | 'in-progress' | 'complete';
  problemSetId: string;
}

export function DesignContextPanel({ title, data, sectionStatus, problemSetId }: DesignContextPanelProps) {
  // Render read-only display with:
  // - Blue-tinted header: "From Design Tab | [status badge]"
  // - Content: artifact-specific display (text for problem statement, list for LOEs)
  // - Footer: "Propose Revision" button if sectionStatus === 'complete'
  // - Empty state: "Design tab — [section] not yet complete" if not-started
}
```

### New: Backend design revision endpoint sketch
```typescript
// backend/src/api/design-revisions.ts
// POST /api/design/:problemSetId/revisions
// Body: { artifact_type, proposed_data, rationale, original_data }
// Creates design_revision record + decision_gate record
// Returns: { revision_id, gate_id }

// PATCH /api/design/:problemSetId/revisions/:id/merge
// Called by governance approval hook when gate is approved
// Merges proposed_data into operational_designs table for the artifact
// Updates revision status to 'merged'
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual "Push to Plan Tab" button | Auto-sync via direct fetch from Plan tab | Eliminates user friction; Plan tab always current |
| OperationalApproach duplicated in Strategic Guidance | Design tab owns all operational approach content | Single source of truth; no divergence |
| StrategicAssessment has simplified CoG | StrategicAssessment focuses on strategic environment + assumptions + factors | CoG analysis lives only in Design tab |
| Force apportionment in Strategic Guidance Step 2 | Apportionment in JPP Step 3 (COA Dev); Allocation in JPP Step 7 | Doctrinal accuracy |

**Deprecated/outdated:**
- `OperationalApproach.tsx` (Plan tab): entire file to be deleted
- `designService.pushHandoff()`: becomes deprecated; Plan tab fetches directly
- `POST /api/design/:problemSetId/push-handoff`: deprecated endpoint (can be left as no-op for backward compat)

---

## Open Questions

1. **Understand tab sync mechanism for StrategicAlignment**
   - What we know: The Understand tab has a knowledge graph with strategic documents and objectives; `getStrategicContext()` in `backend/src/api/design.ts` already fetches this for design analysis
   - What's unclear: The exact API surface of the Understand tab knowledge graph that StrategicAlignment should call to pull national/political objectives
   - Recommendation: Use the same `getStrategicContext()` helper pattern — fetch strategic documents and objectives for the problem set via the existing document store

2. **Revision merge conflict handling**
   - What we know: A revision proposal snapshots the Design artifact at proposal time
   - What's unclear: If the Design tab is updated between proposal and approval, how should the merge resolve conflicts (proposed_data wins vs. merge conflict error)?
   - Recommendation: Keep it simple — approved revision overwrites the artifact entirely (proposed_data wins). Document this clearly in the UI. Complex merge conflict resolution is out of scope.

3. **StrategicAssessment CoG data migration**
   - What we know: Existing SGInstance records have CoG data stored in step content under `'strategic_assessment'` key
   - What's unclear: Should old CoG data be migrated to Design tab, or just abandoned?
   - Recommendation: Abandon — StrategicAssessment CoG was a simplified version; the Design tab CoG is the authoritative full analysis. No migration needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Not detected (no pytest.ini, jest.config, or vitest.config found) |
| Config file | None — Wave 0 gap |
| Quick run command | `cd /home/vitalpointai/projects/ssr && npx tsc --noEmit` (TypeScript type check) |
| Full suite command | TypeScript check + manual UI verification |

### Phase Requirements — Test Map
| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| SG_STEPS no longer contains 'operational_approach' | Unit/compile | `npx tsc --noEmit` | Type error if SGStepId still references removed key |
| DesignContextPanel renders with empty design data | Manual smoke | Browser inspection | Verify graceful empty state |
| DesignContextPanel renders read-only (no edit) | Manual smoke | Browser inspection | Verify inputs are disabled/absent |
| Propose Revision creates gate + revision record | Manual integration | Browser + DB inspection | Check decision_gates and design_revisions tables |
| StrategicAlignment step visible in Strategic Guidance | Manual smoke | Browser navigation | Navigate to strategic-echelon Plan tab |
| COADevelopment LOEs sourced from Design (not SG Step 2) | Manual smoke | Browser inspection | Verify LOEs displayed in Step 3 come from Design tab |
| OperationalApproach.tsx deleted with no broken imports | Compile | `npx tsc --noEmit` | Import scan passes |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` — catches type regressions immediately
- **Per wave merge:** TypeScript check + full browser smoke test of Design→Plan flow
- **Phase gate:** Full manual verification of: Design changes sync to Plan, revision proposal created, DAO gate approval triggers merge

### Wave 0 Gaps
- [ ] No automated test framework configured — rely on TypeScript compilation + manual verification throughout

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `frontend/src/components/plan/StrategicGuidanceStepConfig.ts` — step config structure, SGStepId type
- `frontend/src/components/plan/StrategicGuidancePlanView.tsx` — current 3-step strategic workflow
- `frontend/src/components/plan/steps/OperationalApproach.tsx` — file to be deleted, confirmed content
- `frontend/src/components/plan/steps/StrategicAssessment.tsx` — CoG section to remove, confirmed structure
- `frontend/src/components/plan/steps/CommanderDirective.tsx` — survives unchanged, confirmed
- `frontend/src/components/tabs/DesignTab.tsx` — Design tab structure, sidebar, handoff pattern
- `frontend/src/lib/design-service.ts` — existing service API including pushHandoff/getHandoff
- `frontend/src/components/plan/COADevelopment.tsx` — confirmed auto-sync pattern already in use
- `frontend/src/components/plan/PlanEchelonRouter.tsx` — echelon routing, JPPPlanView structure
- `frontend/src/components/governance/GateSubmitButton.tsx` — DAO gate reuse pattern
- `backend/src/api/design.ts` — full backend API including push-handoff and handoff endpoints
- `backend/src/design/design-store.ts` — PostgreSQL schema with handoff_payload, handoff_pushed_at columns
- `frontend/src/components/design/DesignStatusBadge.tsx` — existing status badge pattern

### Secondary (HIGH confidence)
- `frontend/src/components/plan/MissionAnalysis.tsx` — target file for DesignContextPanel injection (Step 2)
- `frontend/src/components/plan/PlanOrderDevelopment.tsx` — target file for DesignContextPanel injection (Step 7)
- `frontend/src/components/governance/GateProposalModal.tsx` — gate proposal modal reuse
- `frontend/src/lib/strategic-guidance-service.ts` — SG service API patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries and patterns confirmed from codebase
- Architecture: HIGH — all modification points identified, exact file locations confirmed
- Pitfalls: HIGH — derived from actual code structure (type cascade, schema, empty state behavior)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable codebase, no fast-moving dependencies)
