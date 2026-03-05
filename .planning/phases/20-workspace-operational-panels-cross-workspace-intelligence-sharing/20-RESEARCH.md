# Phase 20: Workspace Operational Panels & Cross-Workspace Intelligence Sharing - Research

**Researched:** 2026-03-04
**Domain:** React routing restructure, workspace context extension, cross-workspace data sharing, DAO tiered voting, workspace selector landing page
**Confidence:** HIGH (all findings based on direct codebase inspection)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Panel Layout on Dashboard**
- Tab bar within workspace dashboard: Overview | Decide | Design | Campaign | Monitor | Train
- Overview tab shows current role-adaptive panels (CommanderPanel/StaffPanel/ObserverPanel) + ActivityFeed, with the validity map as the centerpiece showing layered common operating picture (show/hide layers from workspaces below, adjacent, and above)
- Workspace identity shown as compact breadcrumb in app header (next to WorkspaceSwitcher), NOT as persistent header above tabs — maximize content area
- OrgTree available as collapsible slide-out sidebar from ANY tab (not just Overview) for quick workspace navigation
- Tab visibility is role-gated: tabs the user's role cannot access are hidden/disabled. Fixed tab order maintained
- Remove top-level header tabs (Decide/Design/Campaign/Monitor/Exercise) immediately — no transition period
- Top-level Organization workspace becomes the entry point (replaces top-level nav)

**Workspace Selector Landing Page**
- Login lands on a workspace selector page (not directly into a workspace)
- Layout: org hierarchy tree on the left, card detail panel on the right (selected/hovered workspace)
- Cards show workspace name, type badge (Org/Unit/Team), classification, member count, recent activity summary

**Cross-Workspace Data Referencing**
- Automatic by hierarchy: Parent workspace data automatically available to children (downward flow). Children configure what surfaces upward (configurable per level)
- Subscription model: Non-hierarchical sharing via explicit subscription. Workspace commanders subscribe to other workspaces' data feeds
- Approval for subscriptions: Configurable per workspace — commander can delegate approval authority to AI agent or handle directly. Mechanism supports pluggable decision-makers (AI agent analyzes classification, national policy caveats → approves if obvious, escalates to commander if not)
- View pattern: Layered view (like map layers) — toggle referenced workspace data on/off per source workspace. See local data, then overlay parent/subscribed workspace data
- Scope of sharing: All panel data types CAN be shared, gated by classification level. TOPSECRET workspace data only visible to workspaces with matching or higher classification
- Sync strategy: Cached with notification. Referenced data cached locally; source workspace sends notifications on data changes. Receiver refreshes at their discretion
- Notification UX: Badge on affected tab with count. Clicking badge opens dropdown with actionable items — can take action directly from the dropdown without navigating into the full tab

**Decision Flow Routing**
- Escalation triggers: Both manual escalation (commander sends decision upward) AND threshold-based auto-escalation (configurable rules per decision type, resource level, ROE changes, etc.)
- Decision processing at parent: Escalated decisions become DAO proposals in the parent workspace, BUT with tiered voting mechanisms:
  - Urgent / Commander decision: Autocratic voting mechanism — surfaces directly to commander for fast action
  - Standard: Democratic voting, possibly with approval threshold — requires multiple approvals
  - Ability to define WHO can make a decision on a specific proposal type and surface it directly to them
- Authority matrix: Doctrinal template by workspace type (Organization/Unit/Team) with commander overrides. Standard military decision authority matrix as starting point
- Result flow: Commander's decision becomes a directive/order that appears in the sub-workspace's Decide tab. Recorded on-chain (NEAR DAO) for audit trail. Notification sent to sub-workspace commander. Sub-workspace acknowledges receipt

**Panel Scope by Workspace Type**
- All 5 operational panels available at every workspace level (Organization, Unit, Team)
- Focus differs by type: Organization default focus on Design (strategic), Unit on Campaign (operational), Team on Train (tactical execution)
- Role-gating: Configurable per workspace. Commander defines which roles see which panels. Default template by workspace type, overridable
- Exercises: Multi-workspace exercises — Organization creates an exercise that spans Unit and Team workspaces as participants. Each workspace sees their role within the shared exercise
- Content guidance: Template-guided by workspace type (e.g., Org Design suggests 'Strategic Directive', Team Design suggests 'SOP'), but NOT enforced. Users can add any content type they need

### Claude's Discretion
- Technical implementation of the layered view toggle (UI component pattern)
- Tab bar component design and responsive behavior
- Cache invalidation strategy for cross-workspace data
- Badge/notification component implementation details
- Exact doctrinal templates for decision authority matrix defaults
- Loading states, error handling, empty states within panels

### Deferred Ideas (OUT OF SCOPE)
- AI Info-Sharing Agent: Autonomous agent that analyzes classification, national policy caveats, and approves/escalates cross-workspace subscription requests — future phase (Phase 20 builds the pluggable approval mechanism, agent comes later)
- Advanced escalation analytics: Dashboard showing escalation patterns, decision latency, bottlenecks across the org hierarchy — future enhancement
</user_constraints>

## Summary

Phase 20 is a large architectural restructuring combining three tracks: (1) routing and UI restructure — moving 5 top-level tabs into per-workspace tab bars and adding a workspace selector landing page, (2) workspace context and backend extension — new database tables for panel config, cross-workspace subscriptions, and notification routing, and (3) DAO governance extension — tiered voting mechanisms and cross-workspace escalation routing.

The good news: all five operational panel components already exist and are production-quality. The restructuring is primarily about context — giving each panel access to the active workspace ID and wiring them into a new tab container. None of the panel content needs to be rewritten. The hard parts are: (a) the cross-workspace subscription and notification system (net-new backend tables and polling), (b) tiered DAO voting (requires NEAR contract understanding or off-chain approximation), and (c) the layered data view toggle (needs careful state management for multiple workspace data sources).

The two existing "workspace" systems need attention: the `graph_workspaces` table (for RAFT graph data) and the `workspaces` table (the Phase 19 workspace system). They are separate schemas with different IDs. Panel data must be linked to `workspaces` (Phase 19), not `graph_workspaces` (RAFT). The graph data is already associated to workspaces via `workspaceId` on Actor/Relationship nodes.

**Primary recommendation:** Break into 5 sub-tracks executed in dependency order: (1) routing + landing page + tab container, (2) panel context injection + workspace-scoped data, (3) panel visibility config + role gating, (4) cross-workspace subscription + notification system, (5) escalation routing + tiered DAO voting.

## Standard Stack

### Core (already in use — verify, do not change)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 18.x | UI components | Project foundation |
| React Router v6 | 6.x | Client-side routing | Already used throughout |
| Tailwind CSS | 3.x | Utility styling | Used across all components |
| WorkspaceContext | (local) | Workspace state provider | Already has memberships, notificationCounts, activeWorkspaceId |
| react-d3-tree | 3.x | OrgTree visualization | Already used in OrgTree.tsx |
| Express + TypeScript | 4.x | Backend API | Project foundation |
| PostgreSQL | 15.x | Off-chain storage | Project foundation |
| Zod | 3.x | Backend schema validation | Already used in API routes |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| NEAR Protocol SDK | (existing) | On-chain DAO transactions | Tiered voting, escalation records |
| localStorage | (browser) | Cache layer for cross-workspace data | Cross-workspace cached data per spec |
| NotificationBadge | (local) | Badge with pulse animation | Already exists — reuse for tab badges |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| localStorage cache | React Query/SWR | localStorage avoids new dep; per spec "cached locally", no global cache invalidation needed for v1 |
| Custom tab bar | Radix Tabs | Custom gives full styling control matching existing UI; Radix would add dep for small gain |
| Polling for cross-workspace notifications | WebSocket | Polling already established pattern (WorkspaceContext polls every 5s); WebSocket over-engineering for v1 |

**Installation:** No new packages required — all capabilities exist in current stack.

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── components/
│   ├── workspace/
│   │   ├── WorkspaceDashboard.tsx      # REFACTOR: becomes Overview tab content
│   │   ├── WorkspaceTabContainer.tsx   # NEW: top-level tab bar (Overview|Decide|Design|Campaign|Monitor|Train)
│   │   ├── WorkspaceSelector.tsx       # NEW: landing page (tree left + card right)
│   │   ├── OrgTreeSidebar.tsx          # NEW: collapsible slide-out wrapping OrgTree
│   │   ├── WorkspaceBreadcrumb.tsx     # NEW: compact header identity (replaces header tab nav)
│   │   ├── CrossWorkspaceLayerToggle.tsx # NEW: map-layer style toggle for data sources
│   │   └── TabNotificationDropdown.tsx  # NEW: badge dropdown with actionable items
│   └── tabs/
│       ├── DecideTab.tsx               # REFACTOR: accept workspaceId prop
│       ├── DesignTab.tsx               # REFACTOR: accept workspaceId prop
│       ├── CampaignTab.tsx             # REFACTOR: accept workspaceId prop
│       ├── MonitorTab.tsx              # REFACTOR: accept workspaceId prop
│       └── TrainTab.tsx                # NEW: wraps ExerciseDashboard for workspace context
├── context/
│   └── WorkspaceContext.tsx            # EXTEND: add tabNotifications, subscriptions, crossWorkspaceData
backend/src/
├── workspace/
│   ├── workspace-panel-config-store.ts # NEW: panel visibility and role gating per workspace
│   ├── workspace-subscription-store.ts # NEW: cross-workspace subscription records
│   └── workspace-escalation-store.ts  # NEW: escalation rules and routing config
├── api/
│   └── workspaces.ts                   # EXTEND: add subscription, escalation, panel-config routes
```

### Pattern 1: WorkspaceTabContainer (new component)

**What:** Replaces WorkspaceDashboard as the outer shell. Renders a horizontal tab bar (Overview | Decide | Design | Campaign | Monitor | Train) with role-based tab visibility and notification badges on each tab. Contains the OrgTreeSidebar slide-out overlay.

**When to use:** Whenever rendering `/workspace/:workspaceId` — this becomes the new root.

**Example:**
```typescript
// WorkspaceTabContainer.tsx
const WORKSPACE_TABS = ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'] as const;
type WorkspaceTab = typeof WORKSPACE_TABS[number];

// Role gating: use panelVisibilityConfig from backend, or fall back to defaults
const DEFAULT_TAB_ACCESS: Record<string, WorkspaceTab[]> = {
  commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
  xo: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
  s2: ['overview', 'decide', 'monitor'],
  s3: ['overview', 'decide', 'campaign'],
  member: ['overview', 'monitor'],
  observer: ['overview'],
};

export function WorkspaceTabContainer() {
  const { activeWorkspaceId, userRoleInActive } = useWorkspace();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [orgTreeOpen, setOrgTreeOpen] = useState(false);
  const visibleTabs = getVisibleTabs(userRoleInActive, panelConfig);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <nav className="flex border-b border-gray-700 bg-gray-800">
        {visibleTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm ${activeTab === tab ? 'border-b-2 border-blue-500' : ''}`}>
            {TAB_LABELS[tab]}
            {tabNotifications[tab] > 0 && <NotificationBadge count={tabNotifications[tab]} />}
          </button>
        ))}
        <button onClick={() => setOrgTreeOpen(true)} className="ml-auto">Org</button>
      </nav>
      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && <WorkspaceDashboard />}
        {activeTab === 'decide' && <DecideTab workspaceId={activeWorkspaceId} />}
        {activeTab === 'design' && <DesignTab workspaceId={activeWorkspaceId} />}
        {activeTab === 'campaign' && <CampaignTab workspaceId={activeWorkspaceId} />}
        {activeTab === 'monitor' && <MonitorTab workspaceId={activeWorkspaceId} />}
        {activeTab === 'train' && <TrainTab workspaceId={activeWorkspaceId} />}
      </div>
      {/* Collapsible OrgTree slide-out */}
      {orgTreeOpen && <OrgTreeSidebar onClose={() => setOrgTreeOpen(false)} />}
    </div>
  );
}
```

### Pattern 2: WorkspaceSelector Landing Page

**What:** Post-login landing page (new route `/`) before entering a workspace. Replaces redirect-to-`/monitor`. Shows hierarchy tree left + card detail right.

**When to use:** After successful auth, before workspace routing.

**Example:**
```typescript
// Route change in App.tsx:
// BEFORE: <Route path="/" element={<Navigate to="/monitor" replace />} />
// AFTER:  <Route path="/" element={<AuthWrapper><AuthenticatedShell><WorkspaceSelector /></AuthenticatedShell></AuthWrapper>} />

export function WorkspaceSelector() {
  const { memberships, notificationCounts } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 h-full">
      {/* Left: hierarchy tree using memberships */}
      <div className="col-span-1 border-r border-gray-700 overflow-auto p-4">
        <OrgTree rootWorkspaceId={orgRootId} onNavigate={(id) => setSelectedId(id)} />
      </div>
      {/* Right: card detail panel */}
      <div className="col-span-2 p-6">
        {selectedId && <WorkspaceDetailCard workspaceId={selectedId} onEnter={() => navigate(`/workspace/${selectedId}`)} />}
      </div>
    </div>
  );
}
```

### Pattern 3: Panel Context Injection (workspaceId prop threading)

**What:** Each tab component (DecideTab, DesignTab, CampaignTab, MonitorTab) currently renders without workspace context. They need a `workspaceId` prop to filter/scope data.

**Current state:**
- `DAODashboard` accepts optional `daoId` prop — when a workspace's `daoId` is passed, it scopes to that DAO. This already exists. The workspace's `daoId` is in `activeWorkspace.daoId` from WorkspaceContext.
- `StrategicDashboard` has no workspaceId prop — fetches all user's strategic docs globally. Needs `workspaceId` prop added.
- `MissionList`/`MissionDetail`/`MissionWizard` — missions already have `workspaceId` field in backend. The frontend `missionService.listMissions` already accepts `workspaceId` filter. Just need to pass it.
- `StrategicValidityDashboard` — currently fetches from `/api/graph/workspaces?type=all`, no workspace scoping. Needs workspace context.
- `ExerciseDashboard` — `exercise_scenarios` table already has `workspace_id` FK added in workspace-store.ts (Phase 19 migration). Frontend just needs to filter by workspaceId.

**Pattern for each refactored tab:**
```typescript
// Before:
export function CampaignTab() { ... }
// Inside: missionService.listMissions({}) — no workspace filter

// After:
interface CampaignTabProps { workspaceId: string; }
export function CampaignTab({ workspaceId }: CampaignTabProps) { ... }
// Inside: missionService.listMissions({ workspaceId }) — scoped
```

### Pattern 4: Cross-Workspace Subscription Data Model

**What:** New PostgreSQL tables for subscription relationships and notification routing.

**When to use:** Enables non-hierarchical data sharing between workspaces.

```sql
-- workspace_subscriptions: who is subscribed to what
CREATE TABLE workspace_subscriptions (
  id TEXT PRIMARY KEY,                          -- "WSUB-{uuid}"
  subscriber_workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  publisher_workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  data_types TEXT[] NOT NULL DEFAULT '{}',      -- which panel types: 'decide','design','campaign','monitor','train'
  approval_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  approval_mechanism TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto' | 'agent'
  approved_by TEXT,                             -- DID of approver or 'agent'
  approved_at TIMESTAMPTZ,
  requested_by TEXT NOT NULL,                  -- DID of requestor (commander)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subscriber_workspace_id, publisher_workspace_id)
);

-- workspace_data_cache: cached cross-workspace data with staleness tracking
CREATE TABLE workspace_data_cache (
  id TEXT PRIMARY KEY,                          -- "WDC-{uuid}"
  consumer_workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  source_workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  data_type TEXT NOT NULL,                      -- 'decide' | 'design' | 'campaign' | 'monitor' | 'train'
  payload JSONB NOT NULL,                       -- cached data payload
  source_version TEXT,                          -- hash or timestamp of source data
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,                      -- when was consumer notified of update?
  UNIQUE(consumer_workspace_id, source_workspace_id, data_type)
);

-- workspace_panel_config: per-workspace panel visibility and role gating
CREATE TABLE workspace_panel_config (
  id TEXT PRIMARY KEY,                          -- "WPC-{uuid}"
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id),
  panel_visibility JSONB NOT NULL DEFAULT '{}', -- {role: [tabs]}
  default_tab TEXT NOT NULL DEFAULT 'overview',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- workspace_escalation_rules: auto-escalation trigger config
CREATE TABLE workspace_escalation_rules (
  id TEXT PRIMARY KEY,                          -- "WER-{uuid}"
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  rule_type TEXT NOT NULL,                      -- 'resource_threshold' | 'roe_change' | 'manual'
  proposal_kind TEXT NOT NULL,                  -- ProposalKind value
  threshold_config JSONB,                       -- rule-specific threshold data
  voting_mechanism TEXT NOT NULL DEFAULT 'democratic', -- 'autocratic' | 'democratic'
  auto_route_to TEXT,                           -- specific DID for autocratic routing (commander)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Pattern 5: Tiered DAO Voting (Autocratic vs Democratic)

**What:** The existing DAO contract has `default_autonomy_level` and `autonomy_override` per proposal. The `AutonomyLevel` enum already supports human-in-loop and delegation. For phase 20, tiered voting is best implemented as: (a) a backend routing layer that creates proposals with the correct autonomy override, and (b) frontend UI that surfaces "urgent" proposals directly to commander rather than to the full voting pool.

**Important finding:** The existing DAO types do NOT have a `voting_mechanism` field distinguishing "autocratic" vs "democratic". This concept maps cleanly onto:
- Autocratic = `AutonomyLevel.NotAutonomous` with `required_voters` limited to commander DID
- Democratic = `AutonomyLevel.NotAutonomous` with full council voting

The backend escalation route should:
1. Look up escalation rules for the source workspace + proposal type
2. Determine voting_mechanism (autocratic / democratic)
3. Create the DAO proposal at parent workspace's DAO with appropriate `autonomy_override`
4. For autocratic: set `required_voters: [commander_did]` or surface via direct notification

Since the NEAR DAO contract does not have a `required_voters` concept (it uses `council` role with weight), the "autocratic" mechanism is best implemented off-chain: create the proposal normally but send a direct notification to the commander and set a short voting period (e.g., 1 hour instead of 7 days). The commander then votes via normal DAO interface.

**Example escalation flow:**
```typescript
// POST /api/workspaces/:id/escalate
async function escalateDecision(req, res) {
  const { proposalKind, description, escalationType, urgency } = req.body;
  const sourceWorkspaceId = req.params.id;

  // 1. Get parent workspace
  const ws = await workspaceStore.getWorkspace(sourceWorkspaceId);
  const parentWs = ws.parentWorkspaceId
    ? await workspaceStore.getWorkspace(ws.parentWorkspaceId) : null;
  if (!parentWs) return res.status(400).json({ error: 'No parent workspace to escalate to' });

  // 2. Get escalation rules
  const rules = await escalationRuleStore.getRulesForKind(sourceWorkspaceId, proposalKind);
  const votingMechanism = urgency === 'urgent' ? 'autocratic' : (rules?.[0]?.voting_mechanism ?? 'democratic');

  // 3. Create DAO proposal at parent workspace (using parent daoId)
  const votingPeriodNs = votingMechanism === 'autocratic'
    ? '3600000000000'        // 1 hour for urgent
    : '604800000000000';     // 7 days for democratic

  const txArgs = daoService.buildAddProposalArgs(parentWs.daoId, {
    kind: proposalKind,
    description,
    classification: Classification.Public,
    autonomy_override: AutonomyLevel.NotAutonomous,
    voting_period_ns: votingPeriodNs,
  });

  // 4. Record escalation in workspace_activity
  await workspaceActivityStore.logActivity(sourceWorkspaceId, 'decision_escalated', ...);

  // 5. Log result directive in source workspace's Decide tab
  // (polled by sub-workspace commander)

  res.json({ txArgs, parentDaoId: parentWs.daoId });
}
```

### Pattern 6: Tab Notification Badges with Dropdown

**What:** Each tab in WorkspaceTabContainer needs a badge showing count of items requiring action from referenced/subscribed workspaces. Clicking badge opens inline dropdown with actionable items.

**Implementation:** Extend WorkspaceContext `notificationCounts` to include per-tab breakdown. Currently `notificationCounts` is `Record<string, number>` keyed by workspaceId. Extend to also provide `tabNotifications: Record<WorkspaceTab, number>` and `crossWorkspaceUpdates: CrossWorkspaceUpdate[]`.

```typescript
// Extended WorkspaceContext type additions:
interface CrossWorkspaceUpdate {
  sourceWorkspaceId: string;
  sourceWorkspaceName: string;
  tab: WorkspaceTab;
  updateType: 'new_directive' | 'data_change' | 'escalation';
  summary: string;
  actionableItemId: string;
  timestamp: string;
}

interface WorkspaceContextType {
  // ... existing fields ...
  tabNotifications: Record<string, number>;           // NEW: per-tab badge counts
  crossWorkspaceUpdates: CrossWorkspaceUpdate[];      // NEW: actionable cross-workspace items
  clearTabNotifications: (tab: string) => void;       // NEW
  refreshCrossWorkspaceData: () => Promise<void>;     // NEW
}
```

### Pattern 7: App.tsx Routing Restructure

**What:** Remove top-level `/decide`, `/design`, `/campaign`, `/monitor`, `/exercise` routes. Workspace becomes the primary navigation paradigm.

**Required changes:**
```typescript
// REMOVE these routes from App.tsx:
// <Route path="/decide" .../>
// <Route path="/design" .../>
// <Route path="/campaign" .../>
// <Route path="/monitor" .../>
// <Route path="/exercise" .../>
// Legacy redirects for /governance, /strategic, /validity, /missions

// CHANGE root route:
// BEFORE: <Route path="/" element={<Navigate to="/monitor" replace />} />
// AFTER:  <Route path="/" element={<AuthWrapper><AuthenticatedShell /></AuthWrapper>} />

// CHANGE default render in AppContent:
// BEFORE: shows tab panels based on activeTab from URL path
// AFTER:  shows WorkspaceSelector when at "/" or when no workspace selected

// CHANGE workspace routes to support tab sub-routes:
// <Route path="/workspace/:workspaceId" element={<WorkspaceTabContainer />} />
// <Route path="/workspace/:workspaceId/:tab" element={<WorkspaceTabContainer />} />

// Keep:
// /admin, /workspace/invite/:token, /workspace/:id/members, /workspace/:id/directory, /workspace/:id/settings
```

### Anti-Patterns to Avoid

- **Do NOT pass workspaceId through deep component trees without context:** Use WorkspaceContext's `activeWorkspaceId` inside components rather than prop-drilling through tab → panel → sub-component chains. The existing panels already consume UserContext — similarly consuming WorkspaceContext is clean.
- **Do NOT create a separate GraphQL or WebSocket server for cross-workspace data:** The spec says "cached with notification" — polling extension to existing `/api/workspaces/:id/cross-workspace-updates` endpoint is sufficient.
- **Do NOT modify the NEAR DAO contract for tiered voting in Phase 20:** The existing off-chain routing + short voting period hack cleanly implements autocratic behavior. Contract changes are expensive, risky, and the on-chain representation still works correctly.
- **Do NOT use the `graph_workspaces` table for cross-workspace sharing:** That table is for RAFT operational environment workspaces (actors, relationships). The Phase 19 `workspaces` table is the correct source. The RAFT data is already workspace-scoped via `workspaceId` on Actor nodes.
- **Do NOT block panel rendering behind subscription approval:** Panels show local workspace data first; referenced data overlays are additive. An unapproved subscription just means no overlay data, not a broken panel.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab bar with active state | Custom CSS tab switcher from scratch | Pattern: extend existing nav-button CSS + Tailwind utility classes (same pattern as App.tsx nav) | Existing styles already handle active borders, hover states |
| Org tree for workspace selector | New tree implementation | Reuse `OrgTree` component (react-d3-tree already wired) | react-d3-tree already handles hierarchy fetch, click navigation, node highlighting |
| Notification badges on tabs | Custom badge component | Reuse existing `NotificationBadge` component | Already has pulse animation, count display, proper accessibility |
| Cross-workspace data fetch | Complex sync engine | Simple fetch-and-cache in WorkspaceContext poll cycle + localStorage | Per spec: "cached locally; receiver refreshes at their discretion" |
| Military decision authority matrix | Custom rules engine | PostgreSQL JSONB in `workspace_panel_config` per workspace type | Doctrinal defaults stored as JSON, commander override = PATCH to config |
| Classification-gated visibility | Custom ABAC engine | Reuse existing `clearanceSufficient()` utility from `workspace/types.ts` | Already implements UNCLASSIFIED/SECRET/TOPSECRET comparison |

**Key insight:** Almost every UI capability for Phase 20 already exists as a component. The work is wiring (context injection, route restructuring) + new data model (subscription tables) + new API endpoints. No major new UI components need to be built from scratch except `WorkspaceTabContainer`, `WorkspaceSelector`, and `OrgTreeSidebar`.

## Common Pitfalls

### Pitfall 1: DAODashboard Scoping to workspace daoId vs. all user's DAOs

**What goes wrong:** `DAODashboard` currently shows all DAOs for the user when no `daoId` prop is passed (line: `daoId?: string; // If not provided, show all user's DAOs`). Inside a workspace Decide tab, we want to scope it to that workspace's DAO.

**Why it happens:** The Decide tab was previously a global tab with no workspace context. Moving it into workspace context requires passing the workspace's `daoId`.

**How to avoid:** When rendering `<DecideTab workspaceId={wsId} />`, resolve `activeWorkspace.daoId` from WorkspaceContext and pass it as `daoId` to `DAODashboard`. The `activeWorkspace` is already available in context.

**Warning signs:** Decide tab shows governance from ALL workspaces, not just the active one.

### Pitfall 2: Graph/Monitor data not scoped to workspace

**What goes wrong:** `MonitorTab` currently fetches `/api/graph?workspaceId=default` — hardcoded `workspaceId=default`. Moving to workspace context requires dynamic workspaceId.

**Why it happens:** The graph API in `/api/graph.ts` uses the `graph_workspaces` table's ID format (`WKS-{uuid}`), not the `workspaces` table's format (`WS-{uuid}`). These are DIFFERENT workspace systems.

**How to avoid:** The `StrategicValidityDashboard` and `GraphExplorer` need to be passed the active workspace's graph workspace ID (or linked ID). This may require a lookup: given a `workspaces.id`, find the corresponding `graph_workspaces.id`. Options: (a) add a `graph_workspace_id` column to `workspaces` table linking the two, (b) name-match heuristic, (c) accept that for Phase 20, Monitor tab is still global (showing all graph data) until graph-workspace linking is formalized. Option (c) is the simplest and keeps scope contained — Monitor shows all graph data, not workspace-scoped.

**Warning signs:** Monitor tab shows no data or wrong data when switched between workspaces.

### Pitfall 3: Removing top-level tabs breaks existing bookmarks/links

**What goes wrong:** Routes `/decide`, `/design`, `/campaign`, `/monitor`, `/exercise` are referenced in numerous places. Removing without redirects causes 404s and broken navigation.

**Why it happens:** App.tsx currently has these as primary routes. The spec says "remove immediately — no transition period" but the backend APIs still serve data for these paths.

**How to avoid:** Add 301 redirects in App.tsx: e.g. `<Route path="/decide" element={<Navigate to="/" replace />} />`. Update all internal `navigate('/decide')` calls and Link hrefs. Search for `navigate('/decide')`, `navigate('/design')`, `navigate('/campaign')`, `navigate('/monitor')`, `navigate('/exercise')` across frontend codebase.

**Warning signs:** AdminDashboard `onBack={() => navigate('/monitor')}` — update to navigate to workspace landing `/`.

### Pitfall 4: WorkspaceSelector breaks when user has no workspaces

**What goes wrong:** New landing page shows empty state or crashes when user has zero memberships.

**Why it happens:** New users or testing accounts may have no workspaces. OrgTree requires a `rootWorkspaceId` — null would crash.

**How to avoid:** WorkspaceSelector must handle: (a) no memberships → show "Create your first workspace" call-to-action with CreateWorkspaceWizard trigger, (b) single membership → auto-navigate directly to `/workspace/:id`, (c) multiple → show selector UI. The existing `WorkspaceSwitcher` already has the `showWizard` pattern to copy.

**Warning signs:** Blank page or React error after login.

### Pitfall 5: Role gating needs fallback for unknown roles

**What goes wrong:** Panel visibility config is stored per-workspace as JSONB. When a user has a role not in the config (e.g., custom roles), all tabs are hidden.

**Why it happens:** Default templates cover standard military roles (commander, xo, s1-s9, team_lead, member, observer) but workspaces can have custom role labels.

**How to avoid:** Role gating logic must have a fallback: unknown role → show `['overview', 'monitor']` (safe minimum). Implement as: `panelConfig.visibility[role] ?? DEFAULT_VISIBILITY['member']`.

**Warning signs:** User with non-standard role sees blank workspace with no tabs.

### Pitfall 6: Cross-workspace notification polling adds backend load

**What goes wrong:** WorkspaceContext polls every 5s for notifications. Adding cross-workspace subscription update checks multiplies queries if user is subscribed to many workspaces.

**Why it happens:** The current poll hits `/api/workspaces/notifications/counts` once per poll cycle. Adding cross-workspace updates to the same poll endpoint keeps it to one query but that query must now JOIN subscription and cache tables.

**How to avoid:** Extend the existing `POST /api/workspaces/notifications/counts` endpoint to include cross-workspace update counts in the same response. Do NOT add a separate polling loop. The response shape should extend to:
```json
{
  "WS-abc": 3,           // existing: per-workspace notification count
  "__crossWorkspace": {  // new: per-tab cross-workspace update counts
    "decide": 1,
    "monitor": 2
  }
}
```

**Warning signs:** Multiple parallel polling requests visible in browser devtools network tab.

## Code Examples

Verified patterns from codebase inspection:

### Extending WorkspaceContext for tab notifications

```typescript
// frontend/src/context/WorkspaceContext.tsx additions

interface WorkspaceContextType {
  // ... existing fields ...
  tabNotifications: Record<string, number>;
  crossWorkspaceUpdates: CrossWorkspaceUpdate[];
  clearTabNotifications: (tab: string) => void;
}

// In pollNotifications():
const result = await workspaceService.getNotificationCounts(lastSeenMap, userDID);
// result now includes __crossWorkspace key
setNotificationCounts(result.perWorkspace);
setTabNotifications(result.crossWorkspace ?? {});
```

### WorkspaceSelector using existing OrgTree

```typescript
// The OrgTree already accepts:
interface OrgTreeProps {
  rootWorkspaceId: string;            // pass the Organization-level workspace id
  currentUserWorkspaceId?: string;    // highlights current user's workspace
  onNavigate?: (workspaceId: string) => void; // called on click
}

// WorkspaceSelector can find root by:
const orgRoot = memberships.find(m => m.workspaceType === 'Organization');
// If no Organization-type membership, use the primary workspace as root
const rootId = orgRoot?.workspaceId ?? primaryWorkspaceId;
```

### Panel config defaults by workspace type

```typescript
// backend/src/workspace/workspace-panel-config-store.ts

const DEFAULT_VISIBILITY_BY_TYPE: Record<WorkspaceType, Record<string, string[]>> = {
  Organization: {
    commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    xo:        ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    s2:        ['overview', 'decide', 'monitor'],
    s3:        ['overview', 'decide', 'design', 'campaign'],
    s4:        ['overview', 'campaign'],
    s5:        ['overview', 'decide', 'design', 'campaign'],
    member:    ['overview', 'monitor'],
    observer:  ['overview'],
  },
  Unit: {
    commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
    xo:        ['overview', 'decide', 'campaign', 'monitor', 'train'],
    s2:        ['overview', 'monitor'],
    s3:        ['overview', 'decide', 'campaign'],
    s4:        ['overview', 'campaign'],
    member:    ['overview', 'monitor'],
    observer:  ['overview'],
  },
  Team: {
    team_lead: ['overview', 'decide', 'campaign', 'monitor', 'train'],
    member:    ['overview', 'campaign', 'train'],
    observer:  ['overview'],
  },
};
```

### Escalation rule creation and routing

```typescript
// POST /api/workspaces/:id/escalate
// Body: { proposalKind, description, urgency: 'urgent' | 'standard', data? }
// Creates DAO proposal at parent workspace with appropriate voting period
// Returns: { txArgs, parentDaoId, mechanism: 'autocratic' | 'democratic' }

// The result directive appears in child workspace's Decide tab via:
// workspace_activity table: activityType = 'directive_received'
// metadata = { directiveId, proposalId, parentWorkspaceId, status: 'pending_ack' }
```

### OrgTreeSidebar slide-out pattern

```typescript
// Pattern: CSS overlay slide-in from right (no new dep needed)
// Similar to how ExerciseDashboard handles its tab-panel content swapping

export function OrgTreeSidebar({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-gray-800 border-l border-gray-700 z-50
                    transform transition-transform duration-200 shadow-xl">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <span className="text-sm font-semibold text-white">Organization</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
      </div>
      <div className="p-4 overflow-auto h-full">
        <OrgTree rootWorkspaceId={rootId} currentUserWorkspaceId={activeId} onNavigate={...} />
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global `/decide` etc. top-level routes | Workspace-scoped tab routes `/workspace/:id/:tab` | Phase 20 (now) | All panel interactions become workspace-contextual |
| WorkspaceSwitcher dropdown in header | WorkspaceBreadcrumb in header + WorkspaceSelector landing | Phase 20 (now) | Workspace as primary navigation paradigm |
| Single voting period for all proposals | Urgency-based voting period (1h autocratic vs 7d democratic) | Phase 20 (now) | Faster commander decision cycle for urgent escalations |
| No cross-workspace data | Subscription + cached notification model | Phase 20 (now) | Commanders can reference peer/parent workspace intelligence |

**Deprecated/outdated:**
- `/decide`, `/design`, `/campaign`, `/monitor`, `/exercise` routes: removed as top-level routes; all panel content moves into workspace tab bar
- `MAIN_TABS` constant in App.tsx: replaced by workspace tab routing
- `activeTab` derived from URL path in AppContent: replaced by WorkspaceTabContainer's internal tab state

## Open Questions

1. **Graph workspace ID linkage**
   - What we know: `graph_workspaces` (RAFT/graph system) and `workspaces` (Phase 19) are separate tables with different ID formats (`WKS-{8}` vs `WS-{uuid}`)
   - What's unclear: Should Monitor tab use the Phase 19 workspace ID to scope graph queries, and if so, how does it map to the graph system's workspace IDs?
   - Recommendation: For Phase 20, accept that Monitor tab is workspace-scoped at the RAFT actor level (actors have `workspaceId` property on Neo4j nodes already). Pass `activeWorkspaceId` to MonitorTab and add a `workspaceId` filter to the `/api/graph?workspaceId=` query. The graph API already accepts this param (line 29 in graph.ts: `const workspaces = await workspaceStore.listWorkspaces({...})`). The MonitorTab currently hardcodes `workspaceId=default` — change this to the actual workspace ID. This works as long as graph data was created with the correct workspaceId. For older "default" data, it may show empty — acceptable for Phase 20.

2. **Train tab content scope**
   - What we know: "Train" tab wraps `ExerciseDashboard`. Exercises already have `workspace_id` FK. Multi-workspace exercises are mentioned in spec.
   - What's unclear: The `ExerciseDashboard` does not currently accept a `workspaceId` prop. The `exerciseService` fetches all exercises. For multi-workspace exercises (org creates exercise, units and teams participate), should a Team workspace see only their exercise role, or all exercises in the org hierarchy?
   - Recommendation: Add `workspaceId` prop to `ExerciseDashboard`. Filter exercises by `workspace_id = activeWorkspaceId`. For Phase 20, each workspace sees their own exercises. Multi-workspace exercise participation (org-spawned exercises visible in sub-workspaces) is a logical extension that fits the cross-workspace data sharing model — subscribe to parent workspace's Train data.

3. **WorkspaceBreadcrumb in header: what shows?**
   - What we know: Workspace identity shown as compact breadcrumb in app header, next to WorkspaceSwitcher. NOT a persistent header above tabs.
   - What's unclear: When NOT in a workspace (on WorkspaceSelector landing page), what does the breadcrumb show?
   - Recommendation: Breadcrumb is conditional — only rendered when `activeWorkspaceId` is non-null and user is on a `/workspace/` route. On landing page, breadcrumb area is empty or shows just "BASTION".

4. **Layered view toggle UI for Overview tab validity map**
   - What we know: StrategicValidityDashboard becomes the centerpiece of Overview tab. Need to show/hide "layers" from parent/adjacent/subscribed workspaces.
   - What's unclear: `StrategicValidityDashboard` currently renders its own internal views (IPB Map, Actor Graph, Actor Detail) via its own tab navigation. Making it the "centerpiece" that can overlay cross-workspace data requires significant internal state extension.
   - Recommendation: Phase 20 adds a `CrossWorkspaceLayerToggle` component adjacent to the validity map (above or sidebar) that shows approved subscriptions as toggle switches. When a layer is toggled on, the validity map fetches that workspace's validity data and overlays it (different color theme per source workspace). This is additive UI — the existing map remains unchanged, the overlay data is fetched separately.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `/frontend/src/App.tsx` — current routing structure, tab definitions, navigation pattern
- Direct codebase inspection: `/frontend/src/context/WorkspaceContext.tsx` — existing state shape, polling pattern, notification counts
- Direct codebase inspection: `/frontend/src/components/workspace/WorkspaceDashboard.tsx` — role-adaptive panel rendering, grid layout
- Direct codebase inspection: `/frontend/src/components/workspace/OrgTree.tsx` — react-d3-tree usage, HierarchyNode type, onNavigate pattern
- Direct codebase inspection: `/frontend/src/components/tabs/` — all 4 existing tab components and TabLayout pattern
- Direct codebase inspection: `/backend/src/workspace/workspace-store.ts` — workspaces table schema, hierarchy queries, exercise_scenarios FK
- Direct codebase inspection: `/backend/src/workspace/types.ts` — WorkspaceType, MILITARY_ROLE_TEMPLATES, clearanceSufficient
- Direct codebase inspection: `/backend/src/dao/types.ts` — AutonomyLevel, ProposalKind, Proposal, Vote interfaces
- Direct codebase inspection: `/backend/src/api/workspaces.ts` — existing workspace REST API, notification polling endpoint
- Direct codebase inspection: `/backend/src/graph/raft/types.ts` — Actor workspaceId field, RAFT data model
- Direct codebase inspection: `/backend/src/graph/workspace/store.ts` — graph_workspaces separate table with `WKS-` prefix IDs

### Secondary (MEDIUM confidence)
- `.planning/phases/20-workspace-operational-panels-cross-workspace-intelligence-sharing/20-CONTEXT.md` — User decisions and code context section
- `.planning/PROJECT.md` — Full technology stack, requirements, constraints

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by direct codebase inspection
- Architecture: HIGH — patterns derived from existing code, not speculation
- Pitfalls: HIGH — pitfalls identified from concrete code discrepancies (hardcoded workspace IDs, missing workspaceId props, two separate workspace table systems)
- Cross-workspace data model: MEDIUM — new tables designed for this phase; no implementation exists yet to verify against
- Tiered DAO voting: MEDIUM — existing DAO contract types inform the approach but contract-level capabilities for voting period override not verified against actual NEAR contract source

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable architecture, 30-day window)
