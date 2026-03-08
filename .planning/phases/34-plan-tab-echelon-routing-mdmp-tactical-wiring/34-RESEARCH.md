# Phase 34: Plan Tab Echelon Routing & MDMP Tactical Wiring - Research

**Researched:** 2026-03-08
**Domain:** Frontend echelon-aware routing, MDMP sidebar integration, reusable planning UI patterns
**Confidence:** HIGH

## Summary

Phase 34 transforms PlanTab from a hardcoded view into an echelon-aware routing shell. The `ProblemSetContext` already carries `echelon: 'strategic' | 'operational' | 'tactical'` on both `ProblemSetDetail` and `ProblemSetMembership`. PlanTab currently shows two hardcoded sidebar items ("Missions" and "MDMP Workflow"). Phase 33 Plan 05 (not yet executed) will restructure PlanTab for JPP operational flow with 8 sidebar items. Phase 34 must wrap that restructured PlanTab in an echelon router that selects between operational (JPP), tactical (MDMP), and strategic (placeholder) workflows.

The MDMP backend is mature -- `backend/src/routes/mdmp.ts` provides full workflow CRUD, gate operations, phase transitions, and assumptions. The frontend `mdmp-service.ts` is a complete API client. The `MDMPGovernancePanel` exists but renders as a monolithic dashboard, not the sidebar-step pattern needed. The key work is: (1) an echelon routing wrapper, (2) an echelon badge header component, (3) MDMP sidebar with 8 steps mirroring the JPP sidebar pattern, (4) wiring existing governance components into MDMP steps, (5) a strategic placeholder, and (6) empty-state "Start Planning" card.

**Primary recommendation:** Build a `PlanEchelonRouter` component that reads echelon from `useProblemSet().activeProblemSet.echelon` and conditionally renders `JPPPlanView` (operational), `MDMPPlanView` (tactical), or `StrategicPlaceholderView` (strategic). Each view owns its own sidebar items and content. The echelon badge is a shared header component rendered above the sidebar in all three views.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auto-route based on ProblemSetContext echelon -- no user selector or manual switching
- Show echelon badge above the sidebar: "TACTICAL - MDMP", "OPERATIONAL - JPP", or "STRATEGIC - Strategic Guidance"
- Badge positioned above sidebar nav as a header element -- always visible, doesn't consume content space
- All three echelons get the badge treatment uniformly (retroactively adds badge to JPP/operational view)
- If no planning workflow instance exists yet, show echelon badge + centered "No [workflow] started" card with "Start Planning" button
- Existing "Missions" sidebar item stays alongside the workflow steps as a separate section below
- 8 MDMP steps: Receipt of Mission, Mission Analysis, COA Development, COA Analysis & Wargaming, COA Comparison, COA Approval, Orders Production, Transition
- Mirror JPP sidebar pattern as base (same TabLayout, SidebarItem shape, status badge, decision history slot) but allow tactical-specific adaptations where doctrinally appropriate
- Status dots: gray (not started), amber (in progress), green (complete) -- matches existing DesignStatusBadge pattern
- Free navigation -- all steps clickable regardless of status; governance gates control work progression, not sidebar navigation
- View all, edit gated -- everyone can view all MDMP steps; only authorized roles can create/edit
- Reuse existing DecisionGateBanner and GateSubmitButton components for governance gates within MDMP steps
- Three governance gates at FM 6-0 doctrinal decision points: Mission Analysis completion, COA Approval, Orders Production (OPORD approval)
- Collapsible right-side AI agent panel per MDMP step showing the relevant staff agent
- AI panel shows agent suggestions, can be dismissed/collapsed
- Strategic placeholder uses existing DoctrinalPlaceholder component with strategic-specific messaging
- Describe what Phase 36 will deliver: objective setting, force apportionment, constraint definition, directive drafting

### Claude's Discretion
- Exact badge styling and colors
- AI agent panel layout details and dismissal behavior
- Warning products section design for tactical adaptations
- Specific role-to-step mapping beyond S2/S3 examples
- Loading states and transition animations
- Error handling for workflow initialization failures

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | existing | Component rendering, hooks | Already in project |
| TypeScript | existing | Type safety | Already in project |
| Tailwind CSS | existing | Styling (matches DesignStatusBadge, DoctrinalPlaceholder patterns) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TabLayout | existing component | Sidebar + content layout | All three echelon views use it |
| DesignStatusBadge | existing component | Step status dots (gray/amber/green) | MDMP sidebar step status |
| DecisionGateBanner | existing component | Governance gate UI | MDMP governance gates |
| GateSubmitButton | existing component | Gate submission | MDMP governance gates |
| DecisionGateTimeline | existing component | Decision history sidebar slot | All echelon views |
| DoctrinalPlaceholder | existing component | Placeholder with workflow position | Strategic placeholder |
| mdmp-service.ts | existing service | Full MDMP API client | MDMP workflow CRUD, gates |
| jpp-service.ts | existing service | JPP API client | JPP instance fetching |
| useProblemSet() | existing hook | Echelon from context | Routing signal |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TabLayout header slot for badge | Separate layout wrapper | TabLayout needs extending to support a header slot above nav; separate wrapper is simpler |
| React Router for echelon routing | Simple conditional rendering | Router is overkill; echelon is context-derived, not URL-derived |

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
  components/
    plan/
      PlanEchelonRouter.tsx     # Reads echelon, renders correct view
      EchelonBadge.tsx          # "TACTICAL - MDMP" header badge
      MDMPPlanView.tsx          # Tactical: 8-step MDMP sidebar + content
      MDMPStepLayout.tsx        # Shared MDMP step wrapper (mirrors JPPStepLayout)
      MDMPStepConfig.ts         # MDMP step definitions, role mappings, agent IDs
      PlanEmptyState.tsx        # "No [workflow] started" + "Start Planning" button
    tabs/
      PlanTab.tsx               # Refactored to delegate to PlanEchelonRouter
      TabLayout.tsx             # May need header slot for echelon badge
```

### Pattern 1: Echelon Router (Conditional Rendering)
**What:** PlanTab reads echelon from context and renders the correct planning view.
**When to use:** Always -- this is the entry point for Plan tab.
**Example:**
```typescript
// PlanEchelonRouter.tsx
import { useProblemSet } from '../../context/ProblemSetContext';

export function PlanEchelonRouter({ problemSetId, daoId }: PlanEchelonRouterProps) {
  const { activeProblemSet } = useProblemSet();
  const echelon = activeProblemSet?.echelon ?? 'operational';

  return (
    <>
      <EchelonBadge echelon={echelon} />
      {echelon === 'operational' && <JPPPlanView problemSetId={problemSetId} daoId={daoId} />}
      {echelon === 'tactical' && <MDMPPlanView problemSetId={problemSetId} daoId={daoId} />}
      {echelon === 'strategic' && <StrategicPlanPlaceholder />}
    </>
  );
}
```

### Pattern 2: MDMP Step Configuration (Mirrors JPPStepConfig)
**What:** Static configuration mapping each MDMP step to its label, roles, agent, and governance gates.
**When to use:** MDMP sidebar items, role gating, AI panel assignment.
**Example:**
```typescript
// MDMPStepConfig.ts -- mirrors backend/src/jpp/types.ts JPPStepConfig pattern
export const MDMP_STEPS = [
  'receipt_of_mission',
  'mission_analysis',
  'coa_development',
  'coa_analysis_wargaming',
  'coa_comparison',
  'coa_approval',
  'orders_production',
  'transition',
] as const;

export type MDMPStepId = (typeof MDMP_STEPS)[number];

export interface MDMPStepConfigEntry {
  label: string;
  description: string;
  primaryRoles: string[];      // S2, S3, etc.
  supportingRoles: string[];
  aiAgentId: string;
  governanceGate?: {
    gateType: string;          // Maps to DecisionGateBanner gate_type
    description: string;
  };
}

export const MDMPStepConfig: Record<MDMPStepId, MDMPStepConfigEntry> = {
  receipt_of_mission: {
    label: 'Receipt of Mission',
    description: 'Commander and staff receive the mission or order from higher headquarters.',
    primaryRoles: ['commander', 's3_operations'],
    supportingRoles: ['xo', 's1_personnel'],
    aiAgentId: 'staff-coordinator',
  },
  mission_analysis: {
    label: 'Mission Analysis',
    description: 'Staff analyzes higher HQ order, develops IPB, identifies tasks and constraints.',
    primaryRoles: ['s2_intelligence', 's3_operations'],
    supportingRoles: ['s1_personnel', 's4_logistics', 's6_comms'],
    aiAgentId: 'mission-analyst',
    governanceGate: {
      gateType: 'mission_analysis_approval',
      description: 'Restated mission approval by commander',
    },
  },
  coa_development: {
    label: 'COA Development',
    description: 'Staff develops multiple COAs based on mission analysis products.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['s2_intelligence', 's4_logistics', 'fires'],
    aiAgentId: 'coa-developer',
  },
  coa_analysis_wargaming: {
    label: 'COA Analysis & Wargaming',
    description: 'War-game each COA to identify strengths, weaknesses, and decision points.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['s2_intelligence', 'fires', 'red_team'],
    aiAgentId: 'red-team-analyst',
  },
  coa_comparison: {
    label: 'COA Comparison',
    description: 'Compare COAs using evaluation criteria; staff recommends best COA.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['s2_intelligence'],
    aiAgentId: 'coa-comparator',
  },
  coa_approval: {
    label: 'COA Approval',
    description: 'Commander selects a COA based on staff recommendation and decision brief.',
    primaryRoles: ['commander'],
    supportingRoles: ['xo', 's3_operations'],
    aiAgentId: 'decision-support',
    governanceGate: {
      gateType: 'coa_approval',
      description: 'Commander selects COA',
    },
  },
  orders_production: {
    label: 'Orders Production',
    description: 'Staff converts approved COA into OPORD with all paragraphs and annexes.',
    primaryRoles: ['s3_operations', 'xo'],
    supportingRoles: ['s1_personnel', 's4_logistics', 's6_comms'],
    aiAgentId: 'plan-developer',
    governanceGate: {
      gateType: 'opord_approval',
      description: 'OPORD approval by commander',
    },
  },
  transition: {
    label: 'Transition',
    description: 'Brief subordinates on the order, conduct rehearsals, transition to execution.',
    primaryRoles: ['commander', 's3_operations'],
    supportingRoles: ['xo', 's4_logistics'],
    aiAgentId: 'staff-coordinator',
  },
};
```

### Pattern 3: Empty State with Start Planning
**What:** When no workflow instance exists, show a clean empty state card.
**When to use:** MDMP tactical view when no MDMP workflow, JPP operational view when no JPP instance.
**Example:**
```typescript
// PlanEmptyState.tsx
interface PlanEmptyStateProps {
  workflowName: string;  // "MDMP", "JPP", "Strategic Guidance"
  onStartPlanning: () => void;
  loading?: boolean;
}

export function PlanEmptyState({ workflowName, onStartPlanning, loading }: PlanEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center max-w-md">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">
          No {workflowName} Started
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Begin the {workflowName} planning workflow for this problem set.
        </p>
        <button
          onClick={onStartPlanning}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Starting...' : 'Start Planning'}
        </button>
      </div>
    </div>
  );
}
```

### Pattern 4: TabLayout Header Slot Extension
**What:** Extend TabLayout to accept an optional `header` slot rendered above the sidebar nav.
**When to use:** Echelon badge needs to appear above the sidebar items but inside the sidebar container.
**Example:**
```typescript
// TabLayout.tsx extension
export interface TabLayoutProps {
  items: SidebarItem[];
  selectedItem: string;
  onSelectItem: (id: string) => void;
  children: React.ReactNode;
  decisionHistory?: ReactNode;
  header?: ReactNode;  // NEW: Slot above sidebar nav for echelon badge
}

// In render:
{showSidebar && (
  <aside className={`tab-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
    {/* ... toggle button ... */}
    {sidebarOpen && (
      <>
        {header}  {/* Echelon badge renders here */}
        <nav className="sidebar-nav">
          {/* ... items ... */}
        </nav>
        {/* ... decision history ... */}
      </>
    )}
  </aside>
)}
```

### Anti-Patterns to Avoid
- **Hardcoding echelon in PlanTab:** Read from context, never from props or constants.
- **Building separate TabLayout variants per echelon:** Use the same TabLayout with different items arrays.
- **Coupling MDMP step components to MDMPGovernancePanel:** The existing MDMPGovernancePanel is a monolithic dashboard. Extract what's needed (gate logic, workflow creation), don't embed the whole panel.
- **Blocking sidebar navigation on incomplete gates:** CONTEXT.md explicitly says free navigation. Gates control work progression (edit permissions), not navigation.
- **Creating MDMP-specific status badge:** Reuse `DesignStatusBadge` -- it already has the exact gray/amber/green pattern needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step status badges | Custom badge component | `DesignStatusBadge` (existing) | Already implements gray/amber/green pattern |
| Governance gate UI | Custom gate banners | `DecisionGateBanner` + `GateSubmitButton` (existing) | Mature components with DAO integration |
| Decision history | Custom timeline | `DecisionGateTimeline` (existing) | Already wired to `DecisionGateContext` |
| Sidebar navigation | Custom nav component | `TabLayout` (existing) | Proven pattern used by Design, Plan, Direct tabs |
| MDMP workflow CRUD | Custom API calls | `mdmp-service.ts` (existing) | Full typed API client for workflows, gates, assumptions |
| Strategic placeholder | Custom empty view | `DoctrinalPlaceholder` (existing) | Ready-made with workflow position indicator |
| Role-based edit gating | Custom auth checks | `RoleGatedSection` (Phase 33-05) | Will exist after Phase 33 completes |

**Key insight:** Nearly all UI primitives needed for this phase already exist. The work is orchestration and wiring, not component creation. The MDMP system has mature backend support; the gap is frontend sidebar integration matching the JPP pattern.

## Common Pitfalls

### Pitfall 1: Phase 33 Dependency Timing
**What goes wrong:** Phase 34 depends on Phase 33 restructuring PlanTab with JPP sidebar (Plan 33-05). If Phase 34 plans assume Phase 33 is complete but it isn't, the code references don't exist.
**Why it happens:** Plans 33-04 through 33-10 are not yet executed.
**How to avoid:** Phase 34's first plan should handle both cases: (a) if Phase 33 PlanTab restructure is complete, wrap it in echelon router; (b) if not, build the echelon router around the current PlanTab structure. The echelon router is architecturally independent of which specific items are in the JPP view.
**Warning signs:** Import errors referencing `JPPStepLayout`, `RoleGatedSection`, or `OSINTAlertBanner` that don't exist yet.

### Pitfall 2: MDMP Phase ID Mismatch
**What goes wrong:** The backend MDMP system uses `phase_0_continuous` through `phase_8_assessment` (9 phases) while CONTEXT.md specifies 8 sidebar steps with different names. The IDs don't align 1:1.
**Why it happens:** MDMP backend phases include Phase 0 (Continuous) which is not a sidebar step, and Phase 8 (Assessment) maps to "Transition" in CONTEXT.md's 8-step structure. The naming convention is different (phases vs steps).
**How to avoid:** Create a clear mapping in `MDMPStepConfig.ts` between frontend step IDs and backend MDMP phase IDs. The 8 CONTEXT.md steps map to backend phases 1-8 (skip phase 0). Use frontend-specific step IDs for sidebar routing.
**Warning signs:** Backend API calls using wrong phase identifiers, status mismatches.

### Pitfall 3: Echelon Badge Layout Conflict with TabLayout
**What goes wrong:** The echelon badge needs to appear above sidebar nav. TabLayout doesn't have a header slot. Placing it outside TabLayout creates layout issues.
**Why it happens:** TabLayout was designed with a fixed structure: toggle + nav + decision history.
**How to avoid:** Extend TabLayout with an optional `header` prop slot, or render the badge as the first item in a wrapper component that includes both badge and TabLayout. The header slot approach is cleaner and reusable.
**Warning signs:** Badge rendering outside the sidebar container, badge disappearing when sidebar collapses.

### Pitfall 4: MDMPGovernancePanel Reuse Mismatch
**What goes wrong:** Trying to embed the existing `MDMPGovernancePanel` directly into the new MDMP sidebar step view. MDMPGovernancePanel is a monolithic dashboard with its own tab nav (Phase Overview, Assumptions, Commander Guidance, Decision Brief).
**Why it happens:** It's tempting to reuse the whole component since it already works.
**How to avoid:** Extract the useful parts: workflow creation logic from MDMPGovernancePanel, gate display from GovernanceGateDashboard, assumption tracking from AssumptionTracker. Wire these into individual MDMP step pages via the `MDMPStepLayout` wrapper, don't embed the dashboard wholesale.
**Warning signs:** Nested tab navigation (outer sidebar + inner MDMPGovernancePanel tabs), confusing UX.

### Pitfall 5: Missing "Missions" Section Alongside MDMP Steps
**What goes wrong:** CONTEXT.md says "Existing Missions sidebar item stays alongside the workflow steps as a separate section below." This is easy to forget when building the MDMP sidebar.
**Why it happens:** Focus on the 8 MDMP steps overshadows the Missions retention requirement.
**How to avoid:** Include "Missions" as a 9th sidebar item (separated visually) in the MDMP sidebar items array, or as a separate section below the MDMP steps. The existing `MissionList`/`MissionDetail`/`MissionWizard` components continue to render when this item is selected.
**Warning signs:** Loss of mission management functionality in tactical problem sets.

## Code Examples

### Echelon Badge Component
```typescript
// EchelonBadge.tsx
const ECHELON_CONFIG = {
  tactical: { label: 'TACTICAL', workflow: 'MDMP', color: 'bg-amber-600' },
  operational: { label: 'OPERATIONAL', workflow: 'JPP', color: 'bg-blue-600' },
  strategic: { label: 'STRATEGIC', workflow: 'Strategic Guidance', color: 'bg-purple-600' },
} as const;

interface EchelonBadgeProps {
  echelon: 'strategic' | 'operational' | 'tactical';
}

export function EchelonBadge({ echelon }: EchelonBadgeProps) {
  const config = ECHELON_CONFIG[echelon];
  return (
    <div className={`${config.color} px-3 py-1.5 rounded-md mb-2`}>
      <span className="text-xs font-bold text-white tracking-wider">
        {config.label}
      </span>
      <span className="text-xs text-white/70 ml-1.5">
        - {config.workflow}
      </span>
    </div>
  );
}
```

### MDMP Sidebar Items Builder
```typescript
// Source: Mirrors DesignTab.buildSidebarItems pattern
import type { SidebarItem } from '../tabs/TabLayout';
import { MDMP_STEPS, MDMPStepConfig, type MDMPStepId } from './MDMPStepConfig';

type MDMPStepStatus = Record<MDMPStepId, 'not-started' | 'in-progress' | 'complete'>;

export function buildMDMPSidebarItems(stepStatuses?: Partial<MDMPStepStatus>): SidebarItem[] {
  const stepItems: SidebarItem[] = MDMP_STEPS.map((stepId, index) => ({
    id: stepId,
    label: `${index + 1}. ${MDMPStepConfig[stepId].label}`,
    status: stepStatuses?.[stepId] ?? 'not-started',
  }));

  // Missions section stays as separate item below MDMP steps
  const missionsItem: SidebarItem = {
    id: 'missions',
    label: 'Missions',
  };

  return [...stepItems, missionsItem];
}
```

### Status Mapping (Backend MDMP Phase -> Frontend SidebarItem Status)
```typescript
// Map backend MDMP workflow currentPhase to step statuses
import { type MDMPStepId, MDMP_STEPS } from './MDMPStepConfig';

const BACKEND_PHASE_MAP: Record<string, MDMPStepId> = {
  'phase_1_receipt_of_mission': 'receipt_of_mission',
  'phase_2_mission_analysis': 'mission_analysis',
  'phase_3_coa_development': 'coa_development',
  'phase_4_coa_analysis': 'coa_analysis_wargaming',
  'phase_5_coa_comparison': 'coa_comparison',
  'phase_6_coa_approval': 'coa_approval',
  'phase_7_orders_production': 'orders_production',
  'phase_8_assessment': 'transition',
};

type SidebarStatus = 'not-started' | 'in-progress' | 'complete';

export function deriveStepStatuses(currentPhase: string): Record<MDMPStepId, SidebarStatus> {
  const currentStepId = BACKEND_PHASE_MAP[currentPhase];
  const currentIndex = currentStepId ? MDMP_STEPS.indexOf(currentStepId) : -1;

  const statuses = {} as Record<MDMPStepId, SidebarStatus>;
  for (let i = 0; i < MDMP_STEPS.length; i++) {
    if (i < currentIndex) statuses[MDMP_STEPS[i]] = 'complete';
    else if (i === currentIndex) statuses[MDMP_STEPS[i]] = 'in-progress';
    else statuses[MDMP_STEPS[i]] = 'not-started';
  }
  return statuses;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PlanTab hardcodes 2 sidebar items | Phase 33 restructures to 8 JPP items | Phase 33 (in progress) | Phase 34 wraps this in echelon router |
| MDMP as monolithic DAODashboard view | MDMP integrated into Plan tab sidebar | Phase 34 (this phase) | Consistent UX across echelons |
| No echelon awareness in Plan tab | Auto-routing based on ProblemSetContext | Phase 34 (this phase) | Echelon-appropriate workflows |

**Key context:** Phase 33 Plans 01-03 are complete (JPP domain types, OSINT pipeline, AI agent manifests). Plans 04-10 (API layer, PlanTab restructure, step components) are NOT yet executed. Phase 34 must be planned to work regardless of whether Phase 33's PlanTab restructure is complete at execution time.

## Open Questions

1. **JPPStepLayout vs MDMPStepLayout duplication**
   - What we know: Phase 33-05 plans to create `JPPStepLayout` as a shared step layout wrapper. MDMP needs the same pattern.
   - What's unclear: Should there be a shared `PlanStepLayout` base component used by both, or separate but parallel implementations?
   - Recommendation: Create `MDMPStepLayout` mirroring `JPPStepLayout`. If Phase 33-05 has executed, extract shared logic into a base. If not, build independently and refactor later. The CONTEXT.md says "mirror as base but allow tactical-specific adaptations" which favors separate implementations.

2. **RoleGatedSection availability**
   - What we know: Phase 33-05 plans to create `RoleGatedSection`. MDMP steps need the same role gating.
   - What's unclear: Whether to depend on Phase 33-05's component or build a separate one.
   - Recommendation: If `RoleGatedSection` exists at execution time, reuse it. If not, build it as part of Phase 34 (it's a simple wrapper component). The component is generic enough to be built once and used by both.

3. **MDMP step content components scope**
   - What we know: CONTEXT.md says MDMP steps get "same treatment as JPP" with sidebar navigation, role-gating, governance gates, and AI panels.
   - What's unclear: How much step-specific content needs to be built in Phase 34 vs left as placeholders.
   - Recommendation: Phase 34 should build the routing shell, sidebar, step layout wrapper, and governance gate wiring. Individual step content (e.g., Mission Analysis IPB products, COA Development forms) can be placeholder divs initially, same as Phase 33-05 does for JPP steps.

## Sources

### Primary (HIGH confidence)
- `frontend/src/components/tabs/PlanTab.tsx` - Current PlanTab structure (2 hardcoded items)
- `frontend/src/context/ProblemSetContext.tsx` - Echelon available via `activeProblemSet.echelon`
- `frontend/src/lib/problem-set-service.ts` - `ProblemSetDetail.echelon: 'strategic' | 'operational' | 'tactical'`
- `frontend/src/components/tabs/TabLayout.tsx` - `SidebarItem` interface, `TabLayoutProps`
- `frontend/src/components/design/DesignStatusBadge.tsx` - Status badge pattern (gray/amber/green)
- `frontend/src/components/tabs/DoctrinalPlaceholder.tsx` - Placeholder component for strategic view
- `frontend/src/lib/mdmp-service.ts` - Full MDMP API client
- `frontend/src/components/governance/MDMPGovernancePanel.tsx` - Existing MDMP governance dashboard
- `backend/src/jpp/types.ts` - JPPStepConfig pattern to mirror for MDMP
- `backend/src/mdmp/types.ts` - MDMPPhase enum (9 phases, phase_0 through phase_8)

### Secondary (MEDIUM confidence)
- `.planning/phases/33-*/33-05-PLAN.md` - Phase 33 PlanTab restructure plan (not yet executed)
- `.planning/phases/34-*/34-CONTEXT.md` - User decisions and locked constraints

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components exist in the codebase and have been verified
- Architecture: HIGH - Pattern directly mirrors existing DesignTab and Phase 33-05 JPP plan
- Pitfalls: HIGH - Based on direct code analysis of existing components and their interfaces

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (30 days -- stable internal codebase patterns)
