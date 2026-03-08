# Phase 36: Strategic Guidance Workflow - Research

**Researched:** 2026-03-08
**Domain:** Strategic-level planning workflow (lighter than JPP), directive drafting, force apportionment
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3-step doctrinal flow: **Strategic Assessment** (situation review, center of gravity analysis, key assumptions, strategic environment from Phase 25.2 containers) -> **Operational Approach** (lines of effort/operation, objectives hierarchy, force apportionment, constraints/restraints) -> **Commander's Planning Guidance/Directive** (commander's intent, planning guidance, directive draft & export)
- Reuse PlanTab's TabLayout + sidebar pattern with 3 sidebar items and status badges
- **Free navigation** -- all 3 steps accessible from the start, no sequential gating. Status badges track progress (not_started/in_progress/ready) but don't block access
- **Replaces Plan tab at strategic echelon** -- when problem set echelon is 'strategic', Plan tab shows the 3-step strategic guidance workflow instead of the 7-step JPP
- Per-step AI agent assist with default advisors plus flexible agent assignment
- **Hybrid directive format** based on Commander's Planning Guidance: structured doctrinal sections + free-form guidance
- **Auto-populate child campaign JPP Step 1** when directive is finalized
- **Notification with acknowledgement** for child campaign problem sets
- **Versioned updates** with diff highlighting using existing inheritance changelog pattern
- **Exportable via Phase 33 engine** with STRATEGIC_DIRECTIVE template
- **EWM framework + LOE-based allocation** for force apportionment with priority tiers (Main Effort, Supporting Effort, Reserve, Economy of Force)
- **Forces sourced from Phase 27 resource registry** with add-on-the-fly capability
- **Doctrinal taxonomy** for constraints: Constraints (must do), Restraints (must not do), Assumptions, Limitations
- Each entry includes type, source authority, and applicability (time/phase-bounded or standing)
- **Auto-inherit to child campaigns** via Phase 26 inheritance system
- **Assumption validity triggers** with conditions that would invalidate assumptions
- **AI-assisted validation** for conflict detection and assumption validation

### Claude's Discretion
- Exact component layout and spacing within each step view
- Loading states and skeleton designs
- Error handling and validation UX
- Specific AI agent prompt engineering for strategic advisors
- Database schema design for strategic guidance data model
- How to handle edge cases in version diffing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

Phase 36 builds a strategic-level Plan tab workflow that replaces the existing `DoctrinalPlaceholder` in `PlanEchelonRouter.tsx` when echelon is 'strategic'. The workflow follows a 3-step doctrinal flow (Strategic Assessment, Operational Approach, Commander's Planning Guidance/Directive) that is lighter than JPP's 7 steps or MDMP's 8 steps, reflecting the different nature of strategic-level planning.

The implementation has strong precedent in the codebase. Phase 34 already established the echelon-routing pattern (`PlanEchelonRouter.tsx`) with working implementations for operational (JPP - 7 sidebar steps) and tactical (MDMP - 8 sidebar steps). The strategic guidance workflow follows the identical `TabLayout + sidebar + step config + step layout` pattern but with only 3 steps. The backend follows the same `types.ts` + `store.ts` + `service.ts` + `routes.ts` architecture used throughout the project.

The major complexity areas are: (1) force apportionment with LOE-based visualization extending the existing EWM framework, (2) directive versioning with diff highlighting for child campaign notification, (3) auto-population of child campaign JPP Step 1 from finalized directives, and (4) constraint/assumption inheritance via the Phase 26 system.

**Primary recommendation:** Follow the MDMPPlanView/MDMPStepConfig pattern exactly for the 3-step workflow structure, extending backend types parallel to jpp/types.ts with a new strategic-guidance domain module.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | existing | Frontend UI components | Project standard |
| PostgreSQL | existing | JSONB-based step product storage | Project standard for flexible doctrinal content |
| Express | existing | API routes | Project standard |
| PDFKit | existing | PDF export for STRATEGIC_DIRECTIVE template | Already used by Phase 33 document generator |
| docx | existing | DOCX export for STRATEGIC_DIRECTIVE template | Already used by Phase 33 document generator |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| diff | npm existing or hand-roll | Directive version diffing | For diff highlighting between directive versions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom diff | json-diff or deep-diff | Existing inheritance changelog pattern already handles change tracking; custom structured diff for doctrinal sections is simpler than generic JSON diff |

**Installation:**
No new dependencies required. All libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
  strategic/
    guidance/
      types.ts               # StrategicGuidanceStep IDs, instance type, step content types
      store.ts                # PostgreSQL CRUD for strategic_guidance_instances + step products
      service.ts              # Business logic: finalization, directive versioning, child auto-populate
      routes.ts               # Express API routes
      directive-template.ts   # STRATEGIC_DIRECTIVE template for document generator
  inheritance/
    inheritance-service.ts    # Extend: constraint/assumption propagation methods

frontend/src/
  components/plan/
    StrategicGuidancePlanView.tsx    # Top-level view (parallel to JPPPlanView, MDMPPlanView)
    StrategicGuidanceStepConfig.ts  # 3-step config (parallel to MDMPStepConfig.ts)
    StrategicGuidanceStepLayout.tsx # Step layout wrapper (parallel to MDMPStepLayout.tsx)
    steps/
      StrategicAssessment.tsx       # Step 1 content
      OperationalApproach.tsx       # Step 2 content
      CommanderDirective.tsx        # Step 3 content
    ForceApportionmentPanel.tsx     # LOE-based force allocation visualization
    ConstraintManager.tsx           # Constraint/restraint/assumption editor
    DirectiveVersionHistory.tsx     # Version list with diff highlighting
  lib/
    strategic-guidance-service.ts   # API client (parallel to jpp-service.ts, mdmp-service.ts)
```

### Pattern 1: Echelon-Based Plan Tab Routing (EXISTING)
**What:** `PlanEchelonRouter` reads echelon from `ProblemSetContext` and renders the appropriate planning workflow
**When to use:** Already wired -- just replace the `DoctrinalPlaceholder` case with `StrategicGuidancePlanView`
**Example:**
```typescript
// In PlanEchelonRouter.tsx -- replace existing strategic case
case 'strategic':
  return <StrategicGuidancePlanView problemSetId={problemSetId} daoId={daoId} />;
```

### Pattern 2: Step Config + Step Layout (EXISTING from Phase 34)
**What:** Define steps as a const array with config object, then wrap step content in a shared layout component
**When to use:** For the 3 strategic guidance steps
**Example:**
```typescript
// StrategicGuidanceStepConfig.ts
export const SG_STEPS = [
  'strategic_assessment',
  'operational_approach',
  'commander_directive',
] as const;

export type SGStepId = (typeof SG_STEPS)[number];

export interface SGStepConfigEntry {
  label: string;
  description: string;
  primaryRoles: string[];
  supportingRoles: string[];
  aiAgentId: string;
  governanceGate?: { gateType: string; description: string };
}

export const SGStepConfig: Record<SGStepId, SGStepConfigEntry> = {
  strategic_assessment: {
    label: 'Strategic Assessment',
    description: 'Review strategic environment, conduct center of gravity analysis, validate key assumptions.',
    primaryRoles: ['commander', 'strategic_analyst'],
    supportingRoles: ['j2_intelligence', 'j5_plans'],
    aiAgentId: 'strategic-analyst',
  },
  operational_approach: {
    label: 'Operational Approach',
    description: 'Define lines of effort, objectives hierarchy, force apportionment, and constraints.',
    primaryRoles: ['commander', 'j5_plans'],
    supportingRoles: ['j3_operations', 'j4_logistics'],
    aiAgentId: 'operational-planner',
  },
  commander_directive: {
    label: "Commander's Planning Guidance",
    description: "Draft commander's intent, planning guidance, and strategic directive for subordinate commands.",
    primaryRoles: ['commander'],
    supportingRoles: ['chief_of_staff', 'j5_plans'],
    aiAgentId: 'directive-reviewer',
    governanceGate: {
      gateType: 'directive_approval',
      description: 'Commander approves strategic directive for dissemination',
    },
  },
};
```

### Pattern 3: Instance Create/Load (EXISTING from JPP/MDMP)
**What:** Frontend loads instance on mount, shows empty state with "Start Planning" CTA if none exists, creates instance on click
**When to use:** For strategic guidance workflow initialization
**Example:**
```typescript
// Follows exact same pattern as MDMPPlanView.tsx
const loadGuidance = useCallback(async () => {
  const data = await sgService.getInstance(problemSetId);
  setGuidanceData(data);
}, [problemSetId]);

if (!guidanceData) {
  return <PlanEmptyState workflowName="Strategic Guidance" onStartPlanning={handleStart} />;
}
```

### Pattern 4: JSONB Flexible Content (EXISTING)
**What:** Store step products as JSONB blobs with typed interfaces, allowing each step to have different content shapes
**When to use:** For all 3 strategic guidance steps -- each has different content (assessment data, operational approach data, directive content)
**Example:**
```typescript
// Backend types
export interface StrategicAssessmentContent {
  strategicEnvironmentSummary: string;
  centerOfGravityAnalysis: {
    friendly: { cog: string; criticalCapabilities: string[]; criticalRequirements: string[]; criticalVulnerabilities: string[] };
    adversary: { cog: string; criticalCapabilities: string[]; criticalRequirements: string[]; criticalVulnerabilities: string[] };
  };
  keyAssumptions: Assumption[];
  strategicFactors: string[];
  sourceContainerIds: string[]; // Links to Phase 25.2 containers
}

export interface OperationalApproachContent {
  linesOfEffort: LineOfEffort[];
  objectivesHierarchy: ObjectiveLink[];
  forceApportionment: ForceAllocation[];
  constraints: ConstraintEntry[];
  restraints: ConstraintEntry[];
  assumptions: Assumption[];
  limitations: ConstraintEntry[];
}

export interface CommanderDirectiveContent {
  commandersIntent: CommandersIntent; // Reuse from planning/types.ts
  planningGuidance: string; // Free-form
  directiveSections: DirectiveSection[];
  additionalGuidance: string; // Free-form for commander's discretion
  status: 'draft' | 'review' | 'finalized';
  finalizedAt: Date | null;
  finalizedBy: string | null;
}
```

### Pattern 5: Directive Versioning (EXTEND Inheritance Changelog)
**What:** Each directive finalization creates a versioned snapshot. Updates create new versions with changelog entries visible to child campaigns.
**When to use:** When commander finalizes or updates the directive
**Example:**
```typescript
// Backend service
async finalizeDirective(instanceId: string, finalizedBy: string): Promise<void> {
  // 1. Snapshot current directive content as new version
  const version = await this.createDirectiveVersion(instanceId);

  // 2. Update directive status to 'finalized'
  await sgStore.updateStepContent(instanceId, 'commander_directive', { status: 'finalized' });

  // 3. Auto-populate child campaign JPP Step 1
  const childProblemSets = await this.getChildCampaignProblemSets(instanceId);
  for (const child of childProblemSets) {
    await this.populateChildJPPStep1(child.id, version);
    // 4. Create notification requiring acknowledgement
    await inheritanceService.onParentContextChanged(
      child.parentProblemSetId, 'directive_finalized', 'significant',
      version.id, `Strategic Directive v${version.number}`
    );
  }
}
```

### Anti-Patterns to Avoid
- **Coupling strategic steps to JPP step IDs:** Strategic guidance has its own step model. Do not try to map 3 strategic steps onto JPP's 7-step model. They are parallel workflows, not subsets.
- **Sequential gating on strategic steps:** The user explicitly decided on free navigation. Do not add sequential locks even if the backend tracks status.
- **Storing force apportionment as flat arrays:** Use the LOE-based hierarchical structure (LOE -> allocated forces with priority tiers). The visual layout depends on this hierarchy.
- **Skipping acknowledgement on directive propagation:** The user explicitly wants notification + acknowledgement before content is incorporated in child campaigns. Do not auto-merge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab sidebar with status badges | Custom sidebar | `TabLayout` component from `components/tabs/TabLayout.tsx` | Already handles collapse, status badges, decision history slot |
| Step layout with AI panel + governance gates | Custom step wrapper | Adapt `MDMPStepLayout` pattern | Consistent UX across all echelons |
| Inheritance chain propagation | Custom parent-child traversal | `InheritanceService.onParentContextChanged()` | Handles cache invalidation, changelog, activity logging |
| Document export (PDF/DOCX) | Custom PDF generation | `DocumentGenerator` + new `STRATEGIC_DIRECTIVE` template | PDFKit + docx already configured, just add template |
| Echelon routing | Custom condition checks | `PlanEchelonRouter.tsx` switch statement | Already has the strategic case stub |
| Step status tracking | Custom status model | `StepStatus` from `planning/types.ts` + `SidebarItem.status` badge mapping | Consistent status model across JPP/MDMP/SG |

**Key insight:** This phase is primarily a composition phase -- assembling existing patterns (TabLayout, step config, step layout, inheritance, document generator) into a new 3-step workflow. The novel work is in the step-specific content: force apportionment visualization, constraint management, directive drafting/versioning, and child campaign auto-population.

## Common Pitfalls

### Pitfall 1: Over-Coupling to Phase 27 Resource Registry
**What goes wrong:** Building force apportionment that hard-depends on Phase 27 being fully implemented. If resource registry data is sparse, the force apportionment UI becomes empty/useless.
**Why it happens:** CONTEXT.md says forces are sourced from Phase 27 registry.
**How to avoid:** Design force apportionment to work with or without registered resources. The "add missing force on the fly" capability is explicitly required. Build the force allocation model first, with registry lookup as enrichment, not hard dependency.
**Warning signs:** API calls failing when registry has no data; empty force apportionment panel.

### Pitfall 2: Circular Inheritance Notifications
**What goes wrong:** Directive update triggers child notification, child acknowledgement triggers parent activity, which could re-trigger notification loops.
**Why it happens:** The inheritance system has bidirectional activity logging.
**How to avoid:** Directive version notifications should be one-way (parent -> child only). Acknowledgements should not trigger parent-side changelog entries. Use a distinct change_type like `directive_finalized` / `directive_updated` that the inheritance system recognizes as terminal (no further propagation).
**Warning signs:** Repeated notifications, activity log growing rapidly.

### Pitfall 3: Stale Strategic Environment Data in Assessment
**What goes wrong:** Strategic Assessment step pulls from Phase 25.2 containers but shows stale data if containers have been updated since last review.
**Why it happens:** Container data is cached; cache invalidation may not trigger UI refresh.
**How to avoid:** Pull container data on step mount, not on instance creation. Show "last refreshed" timestamp. Use the existing `hasStaleCaches` flag from `InheritedContextResponse.syncStatus`.
**Warning signs:** Assessment shows old data after container updates.

### Pitfall 4: Directive Version Diff Complexity
**What goes wrong:** Trying to show granular diff highlighting on deeply nested JSONB content produces unreadable diffs.
**Why it happens:** Directive content has structured sections (intent, objectives, force apportionment) plus free-form text.
**How to avoid:** Diff at the section level, not field level. For structured sections, show "Section X changed" with old/new values side-by-side. For free-form text, use simple text diff. Do not try to diff force allocation arrays item-by-item.
**Warning signs:** Diff UI is confusing; users can't quickly see what changed.

### Pitfall 5: Missing Status Tracking for Free Navigation
**What goes wrong:** With free navigation, users jump between steps but status never progresses from 'not_started'.
**Why it happens:** No auto-detection of when content has been added to a step.
**How to avoid:** Set status to 'in_progress' when any content is saved to a step. Set to 'ready' when step-specific completeness criteria are met (e.g., all required fields populated). Track per-step independently.
**Warning signs:** All steps show 'not_started' even after user has entered content.

## Code Examples

### Strategic Guidance Instance Type (Backend)
```typescript
// backend/src/strategic/guidance/types.ts
import type { StepStatus } from '../../planning/types.js';
import type { CommandersIntent } from '../../planning/types.js';

export const SG_STEPS = [
  'strategic_assessment',
  'operational_approach',
  'commander_directive',
] as const;

export type SGStepId = (typeof SG_STEPS)[number];

export interface StrategicGuidanceInstance {
  id: string;                              // SG-{uuid}
  problemSetId: string;
  stepStatuses: Record<SGStepId, StepStatus>;
  currentDirectiveVersion: number;
  status: 'active' | 'finalized' | 'archived';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Constraint/Restraint doctrinal taxonomy
export type ConstraintType = 'constraint' | 'restraint' | 'assumption' | 'limitation';

export interface ConstraintEntry {
  id: string;
  type: ConstraintType;
  description: string;
  sourceAuthority: string;         // e.g., 'SECDEF', 'POTUS', 'GFMAP'
  applicability: 'standing' | 'phase_bounded';
  applicablePhases?: string[];     // If phase_bounded
  inheritedFrom?: string;          // Parent problem set ID if inherited
  canDelete: boolean;              // false if inherited
}

export interface Assumption {
  id: string;
  description: string;
  validityConditions: string[];    // Conditions that would invalidate
  isValid: boolean;
  invalidatedAt?: Date;
  invalidatedReason?: string;
}

// Force Apportionment
export type ForceAllocationPriority = 'main_effort' | 'supporting_effort' | 'reserve' | 'economy_of_force';

export interface ForceAllocation {
  id: string;
  forceId: string;                 // Phase 27 resource ID or temporary ID
  forceName: string;
  forceType: string;               // e.g., 'division', 'carrier_group'
  isRegistered: boolean;           // false if added on-the-fly
  lineOfEffortId: string;
  priority: ForceAllocationPriority;
  allocationPct: number;           // 0-100
  notes: string;
}

export interface LineOfEffort {
  id: string;
  name: string;
  description: string;
  linkedObjectiveIds: string[];    // From objectives hierarchy
  allocatedForces: ForceAllocation[];
}

// Directive Version
export interface DirectiveVersion {
  id: string;                      // SGDV-{uuid}
  instanceId: string;
  version: number;
  content: CommanderDirectiveContent;
  constraints: ConstraintEntry[];
  assumptions: Assumption[];
  forceApportionment: ForceAllocation[];
  createdBy: string;
  createdAt: Date;
  changelog: string;               // Summary of changes from previous version
}
```

### StrategicGuidancePlanView (Frontend)
```typescript
// frontend/src/components/plan/StrategicGuidancePlanView.tsx
// Follows MDMPPlanView.tsx pattern exactly

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.tsx';
import { DecisionGateTimeline } from '../governance/index.ts';
import { EchelonBadge } from './EchelonBadge.tsx';
import { PlanEmptyState } from './PlanEmptyState.tsx';
import { SG_STEPS, SGStepConfig, type SGStepId } from './StrategicGuidanceStepConfig.ts';
import * as sgService from '../../lib/strategic-guidance-service.ts';

function buildSGSidebarItems(
  stepStatuses: Record<SGStepId, string> | null,
): SidebarItem[] {
  return SG_STEPS.map((stepId, index) => ({
    id: stepId,
    label: `${index + 1}. ${SGStepConfig[stepId].label}`,
    status: stepStatuses?.[stepId] === 'ready' || stepStatuses?.[stepId] === 'approved'
      ? 'complete' as const
      : stepStatuses?.[stepId] === 'in_progress'
        ? 'in-progress' as const
        : 'not-started' as const,
  }));
}

export function StrategicGuidancePlanView({ problemSetId, daoId }: { problemSetId: string; daoId?: string }) {
  const [selectedStep, setSelectedStep] = useState<SGStepId>('strategic_assessment');
  const [instance, setInstance] = useState</* SGInstance */ null>(null);
  const [loading, setLoading] = useState(true);
  // ... follows MDMPPlanView loading/error/empty pattern exactly
}
```

### STRATEGIC_DIRECTIVE Document Template
```typescript
// backend/src/strategic/guidance/directive-template.ts
// Register as templateRegistry['STRATEGIC_DIRECTIVE'] in document-templates.ts

export const StrategicDirectiveTemplate: DocumentTemplate = {
  planType: 'STRATEGIC_DIRECTIVE' as any,
  name: 'Strategic Directive',
  description: "Commander's Planning Guidance with intent, objectives, force apportionment, and constraints.",
  sections: [
    { id: 'cover', title: 'Cover Page', level: 1, required: true },
    { id: 'references', title: 'References', level: 1, required: true },
    { id: 'situation-summary', title: 'Strategic Situation Summary', level: 1, required: true },
    { id: 'commander-intent', title: "Commander's Intent", level: 1, required: true },
    { id: 'objectives', title: 'Strategic Objectives', level: 1, required: true },
    { id: 'operational-approach', title: 'Operational Approach', level: 1, required: true,
      children: [
        { id: 'loe', title: 'Lines of Effort', level: 2, required: true },
        { id: 'force-apportionment', title: 'Force Apportionment', level: 2, required: true },
      ],
    },
    { id: 'constraints', title: 'Constraints and Restraints', level: 1, required: true },
    { id: 'assumptions', title: 'Key Assumptions', level: 1, required: true },
    { id: 'planning-guidance', title: 'Planning Guidance', level: 1, required: true },
    { id: 'additional-guidance', title: 'Additional Commander Guidance', level: 1, required: false },
    { id: 'authentication', title: 'Authentication', level: 1, required: true },
  ],
  renderSections(/* directive data */) { /* ... */ },
};
```

### Database Schema (Strategic Guidance)
```sql
-- Strategic guidance instances (parallel to jpp_instances)
CREATE TABLE IF NOT EXISTS strategic_guidance_instances (
  id TEXT PRIMARY KEY,                    -- SG-{uuid}
  problem_set_id TEXT NOT NULL UNIQUE,    -- One per strategic problem set
  step_statuses JSONB NOT NULL DEFAULT '{}',
  current_directive_version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',  -- active | finalized | archived
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step products (parallel to jpp_step_products)
CREATE TABLE IF NOT EXISTS strategic_guidance_step_products (
  id TEXT PRIMARY KEY,                    -- SGSP-{uuid}
  instance_id TEXT NOT NULL REFERENCES strategic_guidance_instances(id),
  step TEXT NOT NULL,                     -- strategic_assessment | operational_approach | commander_directive
  content JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(instance_id, step)
);

-- Directive versions (for versioning and child notification)
CREATE TABLE IF NOT EXISTS strategic_directive_versions (
  id TEXT PRIMARY KEY,                    -- SGDV-{uuid}
  instance_id TEXT NOT NULL REFERENCES strategic_guidance_instances(id),
  version INTEGER NOT NULL,
  content JSONB NOT NULL,                 -- Full directive snapshot
  constraints JSONB NOT NULL DEFAULT '[]',
  assumptions JSONB NOT NULL DEFAULT '[]',
  force_apportionment JSONB NOT NULL DEFAULT '[]',
  changelog TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(instance_id, version)
);

-- Force allocations (queryable, not just in JSONB)
CREATE TABLE IF NOT EXISTS strategic_force_allocations (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES strategic_guidance_instances(id),
  force_id TEXT,                          -- Phase 27 resource ID (nullable for unregistered)
  force_name TEXT NOT NULL,
  force_type TEXT NOT NULL,
  is_registered BOOLEAN NOT NULL DEFAULT false,
  line_of_effort_id TEXT NOT NULL,
  priority TEXT NOT NULL,                 -- main_effort | supporting_effort | reserve | economy_of_force
  allocation_pct INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sg_instances_problem_set ON strategic_guidance_instances(problem_set_id);
CREATE INDEX idx_sg_step_products_instance ON strategic_guidance_step_products(instance_id);
CREATE INDEX idx_sg_directive_versions_instance ON strategic_directive_versions(instance_id);
CREATE INDEX idx_sg_force_allocations_instance ON strategic_force_allocations(instance_id);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single JPP for all echelons | Echelon-routed planning (Phase 34) | Phase 34 (current) | Strategic now gets its own workflow |
| Flat constraint lists | Doctrinal taxonomy (constraint/restraint/assumption/limitation) | Phase 36 (this phase) | Matches JP 5-0 categories |
| Manual directive communication | Auto-populate child JPP Step 1 | Phase 36 (this phase) | Streamlines strategic-to-campaign planning flow |

## Open Questions

1. **How rich should force apportionment visualization be in v1?**
   - What we know: User wants LOE-based visual allocation, not just tables. Priority tiers need visual distinction (color/badge). Dashboard summary showing total commitment.
   - What's unclear: Whether a full interactive drag-and-drop allocation or a structured form-based approach is better for v1.
   - Recommendation: Start with structured cards/panels organized by LOE, with priority tier badges and a summary dashboard. Avoid complex drag-and-drop in v1 -- it adds significant complexity for marginal UX benefit. The visual hierarchy (LOE sections with force cards, color-coded by priority) achieves the doctrinal requirement without heavy interaction engineering.

2. **Phase 27 resource registry readiness**
   - What we know: Force data should come from Phase 27 resource registry. Adding unregistered forces triggers a staff action item.
   - What's unclear: What data Phase 27 currently exposes (registry might not be fully built yet).
   - Recommendation: Build force apportionment with a self-contained data model that can optionally link to registry entries. Use `isRegistered` boolean flag. When registry is available, implement a lookup/autocomplete that searches it. When unavailable, allow free-text force entry.

3. **Diff algorithm for directive versions**
   - What we know: Child campaigns need diff highlighting showing what changed between versions. Existing inheritance changelog tracks change_type and severity.
   - What's unclear: Optimal diff granularity for mixed structured + free-form content.
   - Recommendation: Section-level diff for structured content (show which sections changed), text-level diff for free-form sections. Store a human-readable changelog summary per version (entered by commander or auto-generated by AI). For v1, section-level "changed/unchanged" indicators with expand-to-compare is sufficient.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `PlanEchelonRouter.tsx` -- echelon routing pattern with strategic stub
- Codebase analysis: `MDMPPlanView.tsx` + `MDMPStepConfig.ts` + `MDMPStepLayout.tsx` -- complete pattern for echelon-specific plan view
- Codebase analysis: `jpp/types.ts` -- JPP instance model, EWM types, step config pattern
- Codebase analysis: `inheritance-service.ts` + `inheritance-types.ts` -- inheritance chain, acknowledgements, changelog
- Codebase analysis: `document-generator.ts` + `document-templates.ts` -- export engine with template registry
- Codebase analysis: `planning/types.ts` -- StepStatus, CommandersIntent, OperationalPlan types
- Codebase analysis: `strategic/objectives/store.ts` -- objective CRUD with constraints/assumptions arrays
- Codebase analysis: `strategic/containers/store.ts` -- container data for Strategic Assessment input
- Codebase analysis: `TabLayout.tsx` -- sidebar with status badges, collapsible, header/decisionHistory slots

### Secondary (MEDIUM confidence)
- JP 5-0 doctrine (training data) -- strategic-level planning guidance structure, constraint taxonomy

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in the project, no new dependencies
- Architecture: HIGH - Direct extension of existing Phase 34 echelon routing pattern with well-established backend patterns
- Pitfalls: HIGH - Based on analysis of actual codebase integration points and inheritance system behavior

**Research date:** 2026-03-08
**Valid until:** 2026-04-07 (30 days -- stable patterns, no external dependency changes)
