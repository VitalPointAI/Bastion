# Phase 28: Embedded DAO Governance at Decision Gates - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Move DAO governance from a dedicated Direct tab into contextual decision gates embedded within each tab of the doctrinal workflow (Understand, Design, Plan, Direct, COP, Assess). Governance becomes a natural part of the planning process rather than a separate activity. The Direct tab remains as a governance hub/overview. Existing MDMP governance gates unify into the same decision gate registry.

</domain>

<decisions>
## Implementation Decisions

### Inline Proposal UX
- Contextual action button next to specific items being decided (e.g., next to an objective, a COA, an operational approach)
- Proposal form pre-populates with context from the item being submitted (title, description, metadata auto-filled, user reviews/edits before submitting)
- Proposal form opens as a modal overlay (consistent with MissionWizard, CreateProblemSetWizard patterns)
- Direct tab keeps its governance views as a governance hub — shows all proposals across tabs, the big picture. Individual tabs handle contextual submission

### Approval Surfacing
- Pending approvals appear as a banner at the top of each tab for commanders: "2 items pending your approval"
- Banner persists until acted on — dismissible per-session but returns until all items approved/rejected
- Quick approve/reject actions in expanded inline list, with a "Details" link opening full ProposalDetail modal for complex decisions
- Non-commander roles (planners, analysts) see status badges on items they submitted: "Pending Approval", "Approved", "Revision Requested" — read-only, no approve/reject actions

### Decision Gate Registry
- Configurable per gate as hard-block (can't proceed) or soft-warning (proceed with override)
- System defaults based on doctrinal best practices; Commander/XO can override to customize strictness
- All 5 doctrinal gates implemented:
  - **Understand tab**: Objective approval
  - **Design tab**: Operational approach approval
  - **Plan tab**: COA selection
  - **Direct tab**: Order release
  - **Assess tab**: Reframing decision
- Hard-block state shows disabled downstream controls + message: "Awaiting commander approval for [item]"
- Configurable deadlines on gates with configurable timeout behavior per gate: auto-escalate to parent, auto-approve with log, or block indefinitely

### Governance Timeline
- Compact decision history log in each tab's sidebar (collapsible section)
- Shows only decisions relevant to the current tab — Direct tab governance hub shows cross-tab full picture
- Last 5 recent decisions shown by default with "Show all" link for full history
- Each log entry clickable — opens ProposalDetail modal with full discussion, votes, and justification

### MDMP Gate Migration
- Unify existing MDMP governance gates into the same decision gate registry (one system, not two)
- Generalize MDMP-specific components (PhaseProgressionBar, AssumptionTracker, CommanderGuidanceForm) to work with any decision gate type — MDMP becomes one type of gate workflow
- DecisionBriefView generalizes to work for all gate types — every gate decision gets a brief summarizing context, recommendation, and outcome

### Escalation In-Context
- Both manual escalation (button on rejected/stalled gates) and auto-escalation on configurable timeout
- EscalationPanel remains in Direct tab as an overview/monitoring view for active escalations across all tabs
- Escalated items surface in the parent problem set's matching tab (e.g., escalated COA approval shows in parent's Plan tab approval banner)

### Role-Based Gate Visibility
- Gate permissions derive from DAO membership role configuration — role-mapped approach
- Parent commanders have hierarchical visibility into child problem set gates
- Configurable whether parent echelon has direct action authority on child gates or requires formal escalation

### Training vs Operational Mode
- Training mode gate behavior configurable per exercise: instructor-approved (instructor replaces commander), auto-approved (for speed), or full-governance (train as you fight)
- Instructor maps to a DAO membership role with commander-level gate authority (consistent with role-mapped approach)
- Training mode decisions tracked in same governance timeline but tagged as "TRAINING" for after-action review

### Claude's Discretion
- Specific banner styling and animation
- Gate registry data model and storage approach
- Component hierarchy for generalized gate components
- XState machine extensions for gate workflow states
- Exact sidebar layout for decision history section

</decisions>

<specifics>
## Specific Ideas

- DAO should be fully configurable in terms of voting rules/quorum and voting modules that mirror political institutions (democracy, authoritarian, hierarchical, representative democracy, plutocracy, etc.) — **deferred as separate DAO engine phase**
- Decision context graphs that capture HOW the organization makes decisions (not just what they decide), which could inform agents acting in place of humans — **deferred as separate capability phase**
- Pluggable decision-making frameworks swappable like voting modules — **deferred as separate DAO engine phase**
- "Train as you fight" philosophy — training mode should be able to replicate full governance when desired

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DAODashboard` (frontend/src/components/dao/DAODashboard.tsx): Main governance dashboard — becomes the Direct tab governance hub
- `ProposalCard`, `ProposalList`, `ProposalDetail`, `VotingInterface` (frontend/src/components/dao/): Full proposal lifecycle UI — reusable in contextual modals
- `MDMPGovernancePanel` (frontend/src/components/governance/MDMPGovernancePanel.tsx): Container with tab-based governance UI — generalize for all gate types
- `GovernanceGateDashboard`, `PhaseProgressionBar`, `AssumptionTracker`, `DecisionBriefView`, `CommanderGuidanceForm` (frontend/src/components/governance/): MDMP-specific components to generalize
- `EscalationPanel` (frontend/src/components/problem-set/EscalationPanel.tsx): Escalation logic with urgency/kind selection — reuse for in-context escalation
- `CommanderPanel` (frontend/src/components/problem-set/CommanderPanel.tsx): Commander-specific actions and hierarchy view
- `approvalMachine` (backend/src/strategic/workflows/approval-machine.ts): XState v5 state machine with draft/pendingReview/approved/rejected/escalated/withdrawn states — extend for gate workflows

### Established Patterns
- `TabLayout` with sidebar items: All tabs use this pattern — decision history section integrates into sidebar
- Modal pattern: MissionWizard, CreateProblemSetWizard — proposal form follows same modal pattern
- `useProblemSet` context: Provides activeProblemSet, userRoleInActive, memberships — used for role-based gate visibility
- `useMode` context (ModeContext): Training/operational mode toggle — used for training gate behavior
- `governanceService` (frontend/src/lib/governance-service.ts): Service layer for DAO operations
- `mdmpService` (frontend/src/lib/mdmp-service.ts): MDMP workflow service — to be unified with gate registry

### Integration Points
- Each tab component (UnderstandTab, DesignTab, PlanTab, DirectTab, AssessTab) needs embedded gate UI
- ProblemSetTabContainer passes daoId to tabs — gates use this for DAO configuration
- Inheritance service (backend/src/inheritance/) — used for hierarchical gate visibility and cross-problem-set escalation
- AssessTab is currently a placeholder — needs full implementation alongside gate embedding

</code_context>

<deferred>
## Deferred Ideas

- **Swappable voting modules** — DAO engine with pluggable voting modules mirroring political institutions (democracy, authoritarian, hierarchical, representative democracy, plutocracy, etc.). Full flexibility to configure any voting pattern. Separate DAO engine phase.
- **Decision context graphs** — Capture HOW the organization makes decisions (not just outcomes). Build graphs of decision-making patterns that could one day inform agents acting in place of humans. Separate capability phase.
- **Pluggable decision-making frameworks** — Swap entire decision-making frameworks into a DAO the same way voting modules are swappable. Separate DAO engine phase.

</deferred>

---

*Phase: 28-embedded-dao-governance-at-decision-gates-inserted*
*Context gathered: 2026-03-06*
