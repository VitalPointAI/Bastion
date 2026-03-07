# Phase 28: Embedded DAO Governance at Decision Gates - Research

**Researched:** 2026-03-06
**Domain:** Frontend governance UI refactoring, decision gate state machines, contextual workflow integration
**Confidence:** HIGH

## Summary

Phase 28 moves DAO governance from the dedicated Direct tab into contextual decision gates embedded within each of the 6 doctrinal tabs (Understand, Design, Plan, Direct, COP, Assess). The Direct tab retains its governance dashboard as a hub/overview, while individual tabs gain inline proposal creation, approval banners, and decision history sidebars. The existing MDMP governance gates (Phase 5.1) unify into a generalized decision gate registry.

The codebase already has all the building blocks: `approvalMachine` (XState v5), `GovernanceGateDashboard`, `ProposalCard/List/Detail`, `VotingInterface`, `EscalationPanel`, `governanceService`, `mdmpService`, `useProblemSet` context (with `userRoleInActive`, `daoId`), and `useMode` context. The work is primarily (a) generalizing MDMP-specific components into gate-type-agnostic components, (b) creating a decision gate registry with configurable hard-block/soft-warning behavior, (c) embedding gate UI (banners, submit buttons, timeline) into each tab, and (d) extending the approval state machine for gate-specific workflows including deadline/timeout handling.

**Primary recommendation:** Build a `DecisionGateProvider` context that wraps `ProblemSetTabContainer`, fetches all gates for the active problem set, and exposes gate state/actions to child tabs. Each tab consumes gate data via hooks, rendering a shared `ApprovalBanner` component and contextual "Submit for Approval" buttons. The gate registry is a new backend table with per-gate configuration (type, tab, hard/soft, deadline, timeout behavior).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Contextual action button next to specific items being decided (e.g., next to an objective, a COA, an operational approach)
- Proposal form pre-populates with context from the item being submitted (title, description, metadata auto-filled, user reviews/edits before submitting)
- Proposal form opens as a modal overlay (consistent with MissionWizard, CreateProblemSetWizard patterns)
- Direct tab keeps its governance views as a governance hub -- shows all proposals across tabs, the big picture. Individual tabs handle contextual submission
- Pending approvals appear as a banner at the top of each tab for commanders: "2 items pending your approval"
- Banner persists until acted on -- dismissible per-session but returns until all items approved/rejected
- Quick approve/reject actions in expanded inline list, with a "Details" link opening full ProposalDetail modal for complex decisions
- Non-commander roles (planners, analysts) see status badges on items they submitted: "Pending Approval", "Approved", "Revision Requested" -- read-only, no approve/reject actions
- Configurable per gate as hard-block (can't proceed) or soft-warning (proceed with override)
- System defaults based on doctrinal best practices; Commander/XO can override to customize strictness
- All 5 doctrinal gates: Understand=Objective approval, Design=Operational approach approval, Plan=COA selection, Direct=Order release, Assess=Reframing decision
- Hard-block state shows disabled downstream controls + message: "Awaiting commander approval for [item]"
- Configurable deadlines on gates with configurable timeout behavior per gate: auto-escalate to parent, auto-approve with log, or block indefinitely
- Compact decision history log in each tab's sidebar (collapsible section)
- Shows only decisions relevant to the current tab -- Direct tab governance hub shows cross-tab full picture
- Last 5 recent decisions shown by default with "Show all" link for full history
- Each log entry clickable -- opens ProposalDetail modal with full discussion, votes, and justification
- Unify existing MDMP governance gates into the same decision gate registry (one system, not two)
- Generalize MDMP-specific components (PhaseProgressionBar, AssumptionTracker, CommanderGuidanceForm) to work with any decision gate type -- MDMP becomes one type of gate workflow
- DecisionBriefView generalizes to work for all gate types -- every gate decision gets a brief summarizing context, recommendation, and outcome
- Both manual escalation (button on rejected/stalled gates) and auto-escalation on configurable timeout
- EscalationPanel remains in Direct tab as an overview/monitoring view for active escalations across all tabs
- Escalated items surface in the parent problem set's matching tab (e.g., escalated COA approval shows in parent's Plan tab approval banner)
- Gate permissions derive from DAO membership role configuration -- role-mapped approach
- Parent commanders have hierarchical visibility into child problem set gates
- Configurable whether parent echelon has direct action authority on child gates or requires formal escalation
- Training mode gate behavior configurable per exercise: instructor-approved, auto-approved, or full-governance
- Instructor maps to a DAO membership role with commander-level gate authority
- Training mode decisions tracked in same governance timeline but tagged as "TRAINING" for after-action review

### Claude's Discretion
- Specific banner styling and animation
- Gate registry data model and storage approach
- Component hierarchy for generalized gate components
- XState machine extensions for gate workflow states
- Exact sidebar layout for decision history section

### Deferred Ideas (OUT OF SCOPE)
- Swappable voting modules -- DAO engine with pluggable voting modules mirroring political institutions. Separate DAO engine phase.
- Decision context graphs -- Capture HOW the organization makes decisions. Separate capability phase.
- Pluggable decision-making frameworks -- Swap entire decision-making frameworks. Separate DAO engine phase.
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already in use across all tabs |
| XState | v5 | State machine for gate workflows | Already used for `approvalMachine` |
| React Router | v6 | URL-driven tab state | Already used in `ProblemSetTabContainer` |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vite | current | Build/dev server | Already configured |
| TypeScript | erasableSyntaxOnly | Type safety | Project uses `const` objects not enums on frontend |

### No New Dependencies Required
This phase is purely about reorganizing and generalizing existing governance UI. No new libraries needed. All building blocks exist.

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/
├── components/
│   ├── governance/
│   │   ├── DecisionGateBanner.tsx         # NEW: approval banner for tab tops
│   │   ├── DecisionGateTimeline.tsx        # NEW: compact decision history sidebar section
│   │   ├── GateProposalModal.tsx           # NEW: contextual proposal creation modal
│   │   ├── GateStatusBadge.tsx             # NEW: inline status badge for submitted items
│   │   ├── GateBlockOverlay.tsx            # NEW: hard-block disabled state overlay
│   │   ├── GovernanceGateDashboard.tsx     # GENERALIZE: remove MDMP-specific hardcoding
│   │   ├── PhaseProgressionBar.tsx         # GENERALIZE: works with any gate progression
│   │   ├── AssumptionTracker.tsx           # KEEP: MDMP-specific sub-workflow
│   │   ├── CommanderGuidanceForm.tsx       # KEEP: MDMP-specific sub-workflow
│   │   ├── DecisionBriefView.tsx           # GENERALIZE: works for all gate types
│   │   ├── MDMPGovernancePanel.tsx         # REFACTOR: becomes one gate workflow type
│   │   └── index.ts
│   ├── dao/
│   │   ├── DAODashboard.tsx               # KEEP: Direct tab hub, add cross-tab gate overview
│   │   ├── ProposalCard.tsx               # REUSE in banners
│   │   ├── ProposalDetail.tsx             # REUSE in modals
│   │   ├── ProposalList.tsx               # REUSE in hub
│   │   └── VotingInterface.tsx            # REUSE in quick actions
│   └── tabs/
│       ├── UnderstandTab.tsx              # ADD: gate banner, submit buttons, timeline sidebar
│       ├── DesignTab.tsx                  # ADD: gate banner, submit buttons, timeline sidebar
│       ├── PlanTab.tsx                    # ADD: gate banner, submit buttons, timeline sidebar
│       ├── DirectTab.tsx                  # ADD: gate banner (hub already has governance views)
│       ├── AssessTab.tsx                  # IMPLEMENT: replace placeholder + add gate UI
│       └── TabLayout.tsx                  # EXTEND: add optional decision history sidebar section
├── context/
│   └── DecisionGateContext.tsx            # NEW: gate state provider
├── hooks/
│   └── useDecisionGates.tsx              # NEW: tab-specific gate hooks
└── lib/
    ├── governance-service.ts              # EXTEND: gate-specific proposal creation
    ├── mdmp-service.ts                    # DEPRECATE: unify into gate-service
    └── gate-service.ts                    # NEW: decision gate registry CRUD


backend/src/
├── gates/
│   ├── gate-types.ts                     # NEW: gate registry types
│   ├── gate-store.ts                     # NEW: PostgreSQL gate registry
│   ├── gate-service.ts                   # NEW: gate lifecycle, timeout, escalation
│   └── gate-routes.ts                    # NEW: REST API for gates
└── strategic/workflows/
    ├── approval-machine.ts               # EXTEND: gate-specific events (TIMEOUT, AUTO_ESCALATE)
    └── types.ts                          # EXTEND: gate context fields
```

### Pattern 1: DecisionGateProvider Context
**What:** A React context that wraps `ProblemSetTabContainer` and fetches all decision gates for the active problem set. Child tabs consume gate data via `useDecisionGates(tabId)` hook.
**When to use:** All tab components need gate awareness.
**Example:**
```typescript
// DecisionGateContext.tsx
interface DecisionGateContextType {
  gates: DecisionGate[];
  gatesByTab: Record<string, DecisionGate[]>;
  pendingApprovals: DecisionGate[];
  loading: boolean;
  submitForApproval: (gateType: string, itemId: string, context: GateProposalContext) => Promise<void>;
  approveGate: (gateId: string) => Promise<void>;
  rejectGate: (gateId: string, reason: string) => Promise<void>;
  refreshGates: () => Promise<void>;
}

// Hook for tab-specific gates
function useDecisionGates(tabId: string) {
  const ctx = useContext(DecisionGateContext);
  const tabGates = ctx.gatesByTab[tabId] ?? [];
  const pendingCount = tabGates.filter(g => g.status === 'pendingReview').length;
  return { gates: tabGates, pendingCount, ...ctx };
}
```

### Pattern 2: ApprovalBanner Component
**What:** A persistent banner at the top of each tab showing pending approvals for commanders, with quick approve/reject actions.
**When to use:** Every tab renders this when there are pending gates for that tab.
**Example:**
```typescript
// DecisionGateBanner.tsx
interface DecisionGateBannerProps {
  tabId: string;
  userRole: string;
}

// Commander sees: "2 items pending your approval" with expand/collapse list
// Non-commander sees: status badges on items they submitted
```

### Pattern 3: Contextual Submit Button
**What:** "Submit for Approval" button placed next to specific items (objectives, COAs, approaches). Pre-populates proposal form with item context.
**When to use:** Next to decidable items in each tab.
**Example:**
```typescript
// Inline within tab content, e.g., next to an objective card
<GateSubmitButton
  gateType="objective_approval"
  itemId={objective.id}
  itemTitle={objective.title}
  itemDescription={objective.description}
  tabId="understand"
/>
// Opens GateProposalModal pre-populated with objective data
```

### Pattern 4: Gate Registry Data Model
**What:** PostgreSQL table storing gate definitions and their current state per problem set.
**When to use:** Backend storage for gate configuration and state.
**Example:**
```sql
CREATE TABLE decision_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL REFERENCES problem_sets(id),
  gate_type TEXT NOT NULL,  -- 'objective_approval', 'operational_approach', 'coa_selection', 'order_release', 'reframing'
  tab TEXT NOT NULL,         -- 'understand', 'design', 'plan', 'direct', 'assess'
  target_item_id TEXT,       -- ID of the item being gated (objective, COA, etc.)
  target_item_type TEXT,     -- 'objective', 'operational_approach', 'coa', 'order', 'reframing'
  target_item_title TEXT,    -- Display title for the gated item
  enforcement TEXT NOT NULL DEFAULT 'hard_block',  -- 'hard_block' or 'soft_warning'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'submitted', 'approved', 'rejected', 'escalated'
  proposal_id INTEGER,       -- Link to DAO proposal once submitted
  deadline_at TIMESTAMPTZ,
  timeout_behavior TEXT DEFAULT 'block',  -- 'auto_escalate', 'auto_approve', 'block'
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_context JSONB,    -- Pre-populated context from the gated item
  mode TEXT DEFAULT 'operational',  -- 'training' or 'operational'
  training_config JSONB,     -- Training-specific overrides (instructor-approved, auto-approved, full-governance)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decision_gates_problem_set ON decision_gates(problem_set_id);
CREATE INDEX idx_decision_gates_tab ON decision_gates(problem_set_id, tab);
CREATE INDEX idx_decision_gates_status ON decision_gates(problem_set_id, status);
```

### Pattern 5: Extending TabLayout for Decision History
**What:** Add an optional collapsible "Decision History" section to the TabLayout sidebar.
**When to use:** All tabs with governance gates.
**Example:**
```typescript
// TabLayout.tsx extended
interface TabLayoutProps {
  items: SidebarItem[];
  selectedItem: string;
  onSelectItem: (id: string) => void;
  children: React.ReactNode;
  decisionHistory?: DecisionHistoryEntry[];  // NEW optional prop
  onDecisionClick?: (entry: DecisionHistoryEntry) => void;  // Opens ProposalDetail modal
}
```

### Anti-Patterns to Avoid
- **Duplicating governance state across tabs:** Use a single `DecisionGateProvider` context, not per-tab state fetching. Each tab reads from the shared context filtered by tabId.
- **Building separate gate systems for MDMP vs doctrinal:** Unify into one gate registry. MDMP gates are just a gate_type within the same system.
- **Hardcoding gate types in components:** Use the gate registry's `gate_type` field, not switch statements. Components should be gate-type-agnostic.
- **Polling for gate updates from every tab:** Fetch once in the provider, tabs consume via context. Refresh on user actions (submit, approve, reject).
- **Blocking UI rendering on gate fetch:** Gates are loaded asynchronously; tabs render normally, banners appear when data arrives.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Approval workflow states | Custom state tracking | Extend existing `approvalMachine` (XState v5) | Already has draft/pendingReview/approved/rejected/escalated/withdrawn states |
| Proposal UI | New proposal card/detail components | Reuse existing `ProposalCard`, `ProposalDetail`, `VotingInterface` | Full lifecycle UI already built and styled |
| Escalation logic | New escalation system | Extend existing `EscalationPanel` + `problemSetService.escalate()` | Urgency, kind selection, rules already implemented |
| Role checking | Custom permission logic | Use `useProblemSet().userRoleInActive` | Already available in context, already used across tabs |
| Mode awareness | Custom mode detection | Use `useMode().mode` from `ModeContext` | Training/operational toggle already exists with confirmation flow |
| Modal pattern | Custom modal framework | Follow `MissionWizard`/`CreateProblemSetWizard` overlay pattern | Consistent UX, already styled |

**Key insight:** This phase is 80% generalization and UI redistribution, 20% new functionality. The governance primitives (proposals, voting, escalation, state machines) all exist. The new work is the gate registry, the contextual embedding, and unifying MDMP gates.

## Common Pitfalls

### Pitfall 1: Breaking Direct Tab While Redistributing
**What goes wrong:** Moving governance UI out of Direct tab breaks the hub view.
**Why it happens:** Direct tab currently renders `DAODashboard` which is the only place proposals are visible.
**How to avoid:** Direct tab KEEPS all its current views. Other tabs ADD gate-specific UI. Direct tab gains a new "All Gates" overview section showing cross-tab gate status.
**Warning signs:** Direct tab tests fail, governance dashboard stops loading.

### Pitfall 2: N+1 Gate Fetching
**What goes wrong:** Each tab independently fetches its gates, causing 6 API calls on tab container load.
**Why it happens:** Decentralized state management per tab.
**How to avoid:** Single `DecisionGateProvider` at `ProblemSetTabContainer` level fetches all gates once, distributes via context. Individual tabs filter by `tabId`.
**Warning signs:** Multiple `/api/gates` calls in network tab on page load.

### Pitfall 3: MDMP Gate Migration Data Loss
**What goes wrong:** Existing MDMP workflows break when migrating to unified gate registry.
**Why it happens:** MDMP gates use a different data model (nested in workflow phaseGates object) than the new decision_gates table.
**How to avoid:** Migration strategy: (1) new gates table works independently, (2) MDMP service reads from both old and new, (3) migration script copies existing MDMP gates to new table, (4) old MDMP gate endpoints deprecated but kept.
**Warning signs:** Existing MDMP workflows stop showing gate status.

### Pitfall 4: Hard-Block Preventing All Tab Interaction
**What goes wrong:** Hard-block gates disable the entire tab instead of just downstream controls.
**Why it happens:** Overly aggressive blocking UI.
**How to avoid:** Hard-block only disables controls AFTER the gated decision point. Users can still view content, just can't proceed past the gate. Use targeted `GateBlockOverlay` on specific action buttons, not the whole tab.
**Warning signs:** Users can't view any content in a tab that has a pending hard-block gate.

### Pitfall 5: AssessTab Placeholder Collision
**What goes wrong:** AssessTab is currently a `DoctrinalPlaceholder` (delivered by "Phase 28+"). Phase 28 needs to implement at least basic Assess tab content alongside the reframing decision gate.
**Why it happens:** The placeholder was set during Phase 24 expecting a future phase to implement it.
**How to avoid:** Plan includes implementing basic Assess tab structure (MOE/MOP placeholder sections) plus the reframing decision gate. Full assessment implementation can be a separate effort.
**Warning signs:** Reframing gate has nowhere to live because Assess tab is still a placeholder.

### Pitfall 6: Training Mode Gate Auto-Approval Side Effects
**What goes wrong:** Auto-approved training gates create proposals in the DAO that look like real operational decisions.
**Why it happens:** Training mode flag not propagated to proposal creation.
**How to avoid:** All training-mode proposals must carry `mode: 'training'` metadata. The governance timeline tags them as "TRAINING". The DAO dashboard in Direct tab can filter by mode.
**Warning signs:** Training exercise decisions appear alongside operational decisions without distinction.

## Code Examples

### Existing ApprovalMachine Extension Point
```typescript
// Current states in approval-machine.ts:
// draft -> pendingReview -> approved/rejected/escalated/withdrawn
// pendingRevision -> pendingReview (resubmit)

// Extension needed for gate-specific behavior:
// Add TIMEOUT event handling in pendingReview:
//   TIMEOUT with auto_escalate -> escalated (with auto-escalation metadata)
//   TIMEOUT with auto_approve -> approved (with auto-approval log)
//   TIMEOUT with block -> stays in pendingReview (no transition)
```

### Existing Tab Integration Pattern
```typescript
// Current DirectTab.tsx pattern - sidebar + content:
const DIRECT_ITEMS: SidebarItem[] = [
  { id: 'governance', label: 'Governance Overview' },
  { id: 'proposals', label: 'Proposals & Voting' },
  { id: 'escalation', label: 'Escalation' },
];

// Each tab follows this pattern: TabLayout + sidebar items + content switcher
// Gate UI adds:
// 1. DecisionGateBanner above TabLayout content
// 2. Decision History section in TabLayout sidebar (new optional prop)
// 3. GateSubmitButton inline with decidable items
```

### Existing useProblemSet Context Usage
```typescript
// Available from useProblemSet():
const {
  activeProblemSet,    // { daoId, parentProblemSetId, ... }
  userRoleInActive,    // 'commander' | 'xo' | 'member' | etc.
  memberships,         // all user's problem set memberships
} = useProblemSet();

// Gate visibility:
const isCommander = ['commander', 'xo'].includes(userRoleInActive ?? '');
// Commander: sees approve/reject actions
// Others: see read-only status badges
```

### GateProposalModal Pattern (follows MissionWizard)
```typescript
// Follows established modal pattern from MissionWizard, CreateProblemSetWizard:
interface GateProposalModalProps {
  gateType: string;
  tabId: string;
  prefillContext: {
    title: string;
    description: string;
    metadata: Record<string, unknown>;
  };
  daoId: string;
  onSubmit: (proposal: GateProposal) => Promise<void>;
  onClose: () => void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate MDMP gates + DAO proposals | Unified decision gate registry | Phase 28 (this phase) | One system for all gate types |
| Governance in Decide tab only | Contextual governance in all tabs | Phase 28 (this phase) | Governance becomes part of workflow |
| MDMP-specific components | Generalized gate components | Phase 28 (this phase) | MDMP is one gate workflow type among many |
| Direct tab = only governance UI | Direct tab = governance hub + all tabs have gates | Phase 28 (this phase) | Distributed but coordinated |

**Deprecated/outdated after this phase:**
- `MDMPGovernancePanel` as standalone container (becomes a view within the generalized gate system)
- Separate MDMP gate storage in workflow `phaseGates` object (migrated to `decision_gates` table)
- `mdmpService` as separate service (gate operations unified into `gate-service`)

## Open Questions

1. **AssessTab Implementation Scope**
   - What we know: Currently a `DoctrinalPlaceholder`. The reframing decision gate needs a home.
   - What's unclear: How much of the full assessment capability (MOEs, MOPs, dashboards) to build in this phase vs. deferring.
   - Recommendation: Implement minimal Assess tab structure (sidebar with Assessment Overview + Reframing sections) sufficient to host the reframing decision gate. Full MOE/MOP implementation deferred.

2. **COP Tab Gate Involvement**
   - What we know: 5 doctrinal gates defined (Understand, Design, Plan, Direct, Assess). COP has no specific gate.
   - What's unclear: Should COP tab show a read-only aggregate gate status, or is it gate-free?
   - Recommendation: COP tab shows no gates (it's a visualization/monitoring tab, not a decision tab). COP could show a read-only "Decision Status" widget if desired, but no gate actions.

3. **Existing MDMP Workflow Migration Timing**
   - What we know: MDMP workflows use a separate data model stored via `workflow-service.ts`.
   - What's unclear: Whether to migrate existing MDMP data in this phase or maintain dual-read until a later cleanup.
   - Recommendation: Dual-read approach. New gate system is authoritative for new gates. MDMP service reads from both sources. Migration script runs as part of this phase but is non-destructive.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/src/strategic/workflows/approval-machine.ts` - XState v5 approval state machine
- Codebase inspection: `frontend/src/components/governance/` - all MDMP governance components
- Codebase inspection: `frontend/src/components/dao/` - DAO dashboard, proposals, voting
- Codebase inspection: `frontend/src/components/tabs/` - all tab components (Understand, Design, Plan, Direct, COP, Assess)
- Codebase inspection: `frontend/src/lib/governance-service.ts` - DAO governance API client
- Codebase inspection: `frontend/src/lib/mdmp-service.ts` - MDMP workflow API client
- Codebase inspection: `frontend/src/components/problem-set/ProblemSetTabContainer.tsx` - tab container
- Codebase inspection: `frontend/src/components/problem-set/EscalationPanel.tsx` - escalation logic
- Codebase inspection: `frontend/src/context/ModeContext.tsx` - training/operational mode
- Codebase inspection: `backend/src/dao/types.ts` - DAO/proposal type definitions
- Codebase inspection: `backend/src/mdmp/` - MDMP backend services

### Secondary (MEDIUM confidence)
- CONTEXT.md (28-CONTEXT.md) - user decisions from discuss phase
- STATE.md - project state and historical decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all tools already in project
- Architecture: HIGH - clear patterns from existing codebase, TabLayout/sidebar/modal patterns well-established
- Pitfalls: HIGH - identified from direct code inspection of existing components and their integration points
- Gate data model: MEDIUM - recommended schema based on requirements, Claude's discretion per CONTEXT.md

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (30 days - stable domain, no external dependency churn)
