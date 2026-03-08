# Phase 34: Plan Tab Echelon Routing & MDMP Tactical Wiring - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Plan tab reads `echelon` from ProblemSetContext and renders the appropriate planning workflow — operational (Phase 33 JPP), tactical (existing MDMP module wired into Plan tab), or strategic (placeholder). MDMP steps get same treatment as JPP: sidebar navigation, role-gated sections, governance gates, AI agent panels. Does NOT include building actual strategic workflow (Phase 36) or mission creation from OPORD (Phase 35).

</domain>

<decisions>
## Implementation Decisions

### Echelon Routing Behavior
- Auto-route based on ProblemSetContext echelon — no user selector or manual switching
- Show echelon badge above the sidebar: "TACTICAL - MDMP", "OPERATIONAL - JPP", or "STRATEGIC - Strategic Guidance"
- Badge positioned above sidebar nav as a header element — always visible, doesn't consume content space
- All three echelons get the badge treatment uniformly (retroactively adds badge to JPP/operational view)
- If no planning workflow instance exists yet, show echelon badge + centered "No [workflow] started" card with "Start Planning" button
- Existing "Missions" sidebar item stays alongside the workflow steps as a separate section below

### MDMP Sidebar Structure
- 8 steps: Receipt of Mission, Mission Analysis, COA Development, COA Analysis & Wargaming, COA Comparison, COA Approval, Orders Production, Transition
- Mirror JPP sidebar pattern as base (same TabLayout, SidebarItem shape, status badge, decision history slot) but allow tactical-specific adaptations where doctrinally appropriate (e.g., warning products, time-constrained planning indicators)
- Status dots next to each step: gray (not started), amber (in progress), green (complete) — matches existing DesignStatusBadge pattern
- Free navigation — all steps clickable regardless of status; governance gates control work progression, not sidebar navigation

### Role Gating & AI Panels
- View all, edit gated — everyone can view all MDMP steps and products; only authorized roles can create/edit (e.g., S2 edits IPB in Mission Analysis, S3 edits COAs)
- Reuse existing DecisionGateBanner and GateSubmitButton components for governance gates within MDMP steps
- Three governance gates at FM 6-0 doctrinal decision points:
  1. Mission Analysis completion (restated mission approval)
  2. COA Approval (commander selects COA)
  3. Orders Production (OPORD approval)
- Collapsible right-side AI agent panel per MDMP step showing the relevant staff agent (e.g., S2 agent in Mission Analysis)
- AI panel shows agent suggestions, can be dismissed/collapsed

### Strategic Placeholder
- Use existing DoctrinalPlaceholder component with strategic-specific messaging
- Describe what Phase 36 will deliver: objective setting, force apportionment, constraint definition, directive drafting
- Show echelon badge above placeholder for consistency with operational/tactical views

### Claude's Discretion
- Exact badge styling and colors
- AI agent panel layout details and dismissal behavior
- Warning products section design for tactical adaptations
- Specific role-to-step mapping beyond S2/S3 examples
- Loading states and transition animations
- Error handling for workflow initialization failures

</decisions>

<specifics>
## Specific Ideas

- MDMP steps should feel like the JPP steps — same interaction pattern, just different doctrinal content
- The "Start Planning" empty state should be action-oriented, not just informational
- Tactical adaptations to the sidebar should be additive to the JPP pattern, not divergent from it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabLayout` + `SidebarItem`: Sidebar navigation with status badges and decision history slot — direct reuse for MDMP
- `DesignStatusBadge`: Step status indicators (not-started/in-progress/complete) — reuse for MDMP step dots
- `DecisionGateBanner` + `GateSubmitButton` + `DecisionGateTimeline`: Governance gate UI — reuse for MDMP gates
- `MDMPGovernancePanel`: Existing MDMP governance container with phases, gates, assumptions, commander guidance
- `DoctrinalPlaceholder`: Ready-made placeholder component with workflow position indicator
- `mdmp-service.ts`: Full MDMP API client (workflow CRUD, gates, assumptions, phase progression)
- `PhaseProgressionBar`, `AssumptionTracker`, `CommanderGuidanceForm`: Governance sub-components

### Established Patterns
- `ProblemSetContext` carries `echelon: 'strategic' | 'operational' | 'tactical'` — routing signal already available
- JPP types in `backend/src/jpp/types.ts` define `JPPStepId`, `JPPInstance`, `JPPEchelon` — parallel MDMP types needed
- `PlanTab.tsx` currently hardcodes "Missions" + "MDMP Workflow" sidebar items — needs refactoring to echelon-aware routing
- Gate system uses `gate_type` field with `DecisionGateContext` provider — MDMP gates map to same system

### Integration Points
- `PlanTab.tsx` is the entry point — refactor to read echelon and route
- `ProblemSetTabContainer.tsx` passes `problemSetId` and `daoId` to PlanTab — may need echelon prop or context read
- `DAODashboard` currently renders MDMP workflow view — extract and wire into Plan tab directly
- Backend MDMP API at `/api/mdmp` already exists for workflow management

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-plan-tab-echelon-routing-mdmp-tactical-wiring*
*Context gathered: 2026-03-08*
