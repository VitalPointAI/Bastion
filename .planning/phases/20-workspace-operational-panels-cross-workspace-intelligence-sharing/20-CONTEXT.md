# Phase 20: Workspace Operational Panels & Cross-Workspace Intelligence Sharing - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the 5 operational panels (Decide, Design, Campaign, Monitor, Train) from top-level header tabs into each workspace's dashboard as a tab bar. Enable cross-workspace data referencing with classification-gated sharing, configurable data flow, and DAO-based decision routing with escalation. Remove top-level Decide/Design/Campaign/Monitor/Exercise header navigation once workspace-level tabs are active.

</domain>

<decisions>
## Implementation Decisions

### Panel Layout on Dashboard
- Tab bar within workspace dashboard: Overview | Decide | Design | Campaign | Monitor | Train
- Overview tab shows current role-adaptive panels (CommanderPanel/StaffPanel/ObserverPanel) + ActivityFeed, with the validity map as the centerpiece showing layered common operating picture (show/hide layers from workspaces below, adjacent, and above)
- Workspace identity shown as compact breadcrumb in app header (next to WorkspaceSwitcher), NOT as persistent header above tabs — maximize content area
- OrgTree available as collapsible slide-out sidebar from ANY tab (not just Overview) for quick workspace navigation
- Tab visibility is role-gated: tabs the user's role cannot access are hidden/disabled. Fixed tab order maintained
- Remove top-level header tabs (Decide/Design/Campaign/Monitor/Exercise) immediately — no transition period
- Top-level Organization workspace becomes the entry point (replaces top-level nav)

### Workspace Selector Landing Page
- Login lands on a workspace selector page (not directly into a workspace)
- Layout: org hierarchy tree on the left, card detail panel on the right (selected/hovered workspace)
- Cards show workspace name, type badge (Org/Unit/Team), classification, member count, recent activity summary

### Cross-Workspace Data Referencing
- **Automatic by hierarchy:** Parent workspace data automatically available to children (downward flow). Children configure what surfaces upward (configurable per level)
- **Subscription model:** Non-hierarchical sharing via explicit subscription. Workspace commanders subscribe to other workspaces' data feeds
- **Approval for subscriptions:** Configurable per workspace — commander can delegate approval authority to AI agent or handle directly. Mechanism supports pluggable decision-makers (AI agent analyzes classification, national policy caveats → approves if obvious, escalates to commander if not)
- **View pattern:** Layered view (like map layers) — toggle referenced workspace data on/off per source workspace. See local data, then overlay parent/subscribed workspace data
- **Scope of sharing:** All panel data types CAN be shared, gated by classification level. TOPSECRET workspace data only visible to workspaces with matching or higher classification
- **Sync strategy:** Cached with notification. Referenced data cached locally; source workspace sends notifications on data changes. Receiver refreshes at their discretion
- **Notification UX:** Badge on affected tab with count. Clicking badge opens dropdown with actionable items — can take action directly from the dropdown without navigating into the full tab

### Decision Flow Routing
- **Escalation triggers:** Both manual escalation (commander sends decision upward) AND threshold-based auto-escalation (configurable rules per decision type, resource level, ROE changes, etc.)
- **Decision processing at parent:** Escalated decisions become DAO proposals in the parent workspace, BUT with tiered voting mechanisms:
  - **Urgent / Commander decision:** Autocratic voting mechanism — surfaces directly to commander for fast action
  - **Standard:** Democratic voting, possibly with approval threshold — requires multiple approvals
  - Ability to define WHO can make a decision on a specific proposal type and surface it directly to them
- **Authority matrix:** Doctrinal template by workspace type (Organization/Unit/Team) with commander overrides. Standard military decision authority matrix as starting point
- **Result flow:** Commander's decision becomes a **directive/order** that appears in the sub-workspace's Decide tab. Recorded on-chain (NEAR DAO) for audit trail. Notification sent to sub-workspace commander. Sub-workspace acknowledges receipt

### Panel Scope by Workspace Type
- All 5 operational panels available at every workspace level (Organization, Unit, Team)
- **Focus differs by type:** Organization default focus on Design (strategic), Unit on Campaign (operational), Team on Train (tactical execution)
- **Role-gating:** Configurable per workspace. Commander defines which roles see which panels. Default template by workspace type, overridable
- **Exercises:** Multi-workspace exercises — Organization creates an exercise that spans Unit and Team workspaces as participants. Each workspace sees their role within the shared exercise
- **Content guidance:** Template-guided by workspace type (e.g., Org Design suggests 'Strategic Directive', Team Design suggests 'SOP'), but NOT enforced. Users can add any content type they need

### Claude's Discretion
- Technical implementation of the layered view toggle (UI component pattern)
- Tab bar component design and responsive behavior
- Cache invalidation strategy for cross-workspace data
- Badge/notification component implementation details
- Exact doctrinal templates for decision authority matrix defaults
- Loading states, error handling, empty states within panels

</decisions>

<specifics>
## Specific Ideas

- Overview tab validity map as centerpiece: "the monitoring validity map being the centerpiece of that panel with ability to see/hide layers that are coming up from all the rest of the workspaces below, adjacent, and above to provide the consolidated current operating picture focused at that level of the hierarchy but with ability to add higher or adjacent information/layers"
- AI agent for info-sharing approval: commander can delegate subscription approval to an AI agent that checks classification, national policy caveats, and either approves or escalates to commander
- Directive/order pattern for decisions flowing back down — mirrors military chain of command order flow
- Tiered DAO voting: autocratic for urgent commander decisions, democratic with threshold for standard decisions — same DAO, different voting mechanisms per proposal type

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkspaceDashboard` (workspace/WorkspaceDashboard.tsx): Role-adaptive dashboard — will become the Overview tab container
- `CommanderPanel`, `StaffPanel`, `ObserverPanel` (workspace/): Role-specific panels — move into Overview tab
- `OrgTree` (workspace/OrgTree.tsx): D3-tree hierarchy visualization — convert to collapsible sidebar accessible from all tabs
- `ActivityFeed` (workspace/ActivityFeed.tsx): Role-filtered activity timeline with 5s polling — reuse in Overview tab
- `WorkspaceSwitcher` (workspace/WorkspaceSwitcher.tsx): Header dropdown — enhance for breadcrumb-style workspace identity
- `DAODashboard` (decide/): Governance proposals + MDMP workflow — becomes Decide tab content
- `StrategicDashboard` (design/): Strategic documents — becomes Design tab content
- `MissionList`, `MissionDetail`, `MissionWizard` (campaign/): Mission management — becomes Campaign tab content
- `StrategicValidityDashboard`, `GraphExplorer` (monitor/): Intelligence visualization — becomes Monitor tab content and Overview centerpiece
- `TabLayout` (components/tabs/): Sidebar + view pattern — reference pattern for workspace tab bar

### Established Patterns
- Role-adaptive rendering via `useMemo` mapping role to component (WorkspaceDashboard pattern)
- WorkspaceContext provides activeWorkspaceId, memberships, userRoleInActive, notificationCounts
- localStorage persistence for active workspace and last-seen timestamps
- Activity logging via workspace_activity table with JSONB metadata
- Classification field on workspaces (UNCLASSIFIED/SECRET/TOPSECRET)
- Military role templates auto-created per workspace type

### Integration Points
- App.tsx routing: Remove /decide, /design, /campaign, /monitor, /exercise routes; add workspace tab sub-routes
- WorkspaceContext: Extend with cross-workspace subscription state and notification badges per tab
- Backend workspaces API: Add cross-workspace data referencing endpoints, subscription management, escalation routing
- Workspace types: Add sharing configuration, decision authority matrix, panel visibility config
- DAO governance: Extend voting mechanisms to support autocratic/democratic per proposal type
- Exercise data model: exercises already have workspace_id FK — extend for multi-workspace participation

</code_context>

<deferred>
## Deferred Ideas

- **AI Info-Sharing Agent:** Autonomous agent that analyzes classification, national policy caveats, and approves/escalates cross-workspace subscription requests — future phase (Phase 20 builds the pluggable approval mechanism, agent comes later)
- **Advanced escalation analytics:** Dashboard showing escalation patterns, decision latency, bottlenecks across the org hierarchy — future enhancement

</deferred>

---

*Phase: 20-workspace-operational-panels-cross-workspace-intelligence-sharing*
*Context gathered: 2026-03-04*
