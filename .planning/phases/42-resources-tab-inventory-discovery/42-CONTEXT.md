# Phase 42: Resources Tab — Inventory, Discovery & Onboarding - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a dedicated "Resources" tab (7th tab) to ProblemSetTabContainer that consolidates resource inventory management, network device discovery/onboarding, group management, and capability search into a single, reachable view. Most backend infrastructure exists from Phase 27 (Resource Registry) and Phase 32 (Discovery) — this phase is primarily frontend integration, layout, and wiring existing components into a unified interface.

</domain>

<decisions>
## Implementation Decisions

### Sub-navigation pattern
- Use **TabLayout sidebar** (reuses existing component from Understand, Design, Plan tabs) for sub-view navigation: Inventory | Discovery | Network | Groups
- Search bar and statistics live in the **content area** (toolbar + stat cards row), not in the sidebar — sidebar stays clean with just nav items
- **Global cross-view search** — search bar always visible, results span inventory + groups + discovered devices; clicking a result navigates to the relevant sub-view
- Default sub-view is **always Inventory** (no "remember last" behavior)

### Component adaptation
- **Refactor ResourceCatalog** to accept `problemSetId` prop directly (replace `missionId`). Clean break — update resource-service calls accordingly. Old MissionDetail usage adapts.
- **Move discovery components** from `cop/` to `components/resources/` (or shared subdirectories): ClientDiscoveryPanel → `resources/discovery/`, NetworkTopologyView + EMSpectrumPanel → `resources/network/`. COP tab imports from new location.
- **COP tab retains read-only view** of NetworkTopologyView and EMSpectrumPanel for situational awareness. Resources tab is the primary management interface. Both import from shared location.

### Discovery pipeline UX
- **Visual pipeline** (kanban-style columns) for device state machine: Discovered → Fingerprinting → Authenticating → Gate Check → Connected/Rejected. Devices move visually through stages for at-a-glance onboarding status.

### Groups sub-view
- **Dual assignment interaction**: Both multi-select + "Assign to Group" button AND drag-and-drop. Belt and suspenders — accessible checkbox flow plus visual drag for power users.
- **Group types as visual distinction**: All groups in one list with color-coded type badges (task_force=blue, support=green, reserve=amber, custom=gray). **Filterable by type** via dropdown filter.
- **Aggregate capability summary card** at top of group detail view showing combined capabilities of member resources (firepower, transport, comms, personnel/vehicle counts).
- **Exclusive group ownership**: One resource belongs to one group/organization/individual at a time. That entity is accountable for it. Data/effects may be shared, but physical ownership is singular. Resources can be **loaned** to other groups (distinct relationship from ownership).

### Resource lifecycle & disposal
- **Action menu** (three-dot) on each resource row with context-sensitive options: View Detail, Reassign, Loan Out, Redistribute, Report Damaged, Dispose/Decommission.
- **Status transitions** supported: Active → Damaged, Active → Maintenance, Damaged → Maintenance, Maintenance → Active, Any → Disposed, Any → Loaned. Each transition logs to audit trail.
- **Disposed resources remain in inventory** as filterable "Disposed" state (grayed out). Filter defaults to hiding them; toggle "Show disposed" to see full audit trail in context.

### Distribution constraints (doctrinal)
- Three distribution types with **visible badges and enforced constraints**:
  - **ALLOC** (Allocated): Can redistribute to child problem sets, can return to parent. Cannot dispose (must return).
  - **ASSGN** (Assigned): Full authority over employment, can dispose with audit. Cannot redistribute.
  - **APPRTN** (Apportioned): Use within quantity limits, draw from shared pool. Cannot exceed apportioned quantity.
  - **LOCAL** (Created/procured locally): Full authority — can redistribute, dispose.
- **Redistribute action** available from action menu for allocated and local resources. Opens child problem set picker with distribution type selector.
- **Constraint violations**: Invalid actions are **disabled + tooltip** explaining why (e.g., "Allocated resources must be returned to parent echelon").

### Master record vs local view
- **Editable at problem-set level**: Status (active/damaged/maintenance), group assignment, local notes, operational nickname, current location, operational readiness assessment.
- **Read-only from DID master record**: Resource name/designation, category, capabilities, photos/documentation, distribution history, DID identifier.
- **Loan workflow**: "Loan Out" action opens target problem set picker + expected return date. Lending group retains resource in inventory (grayed, "LOANED → [target]") with "Recall" action. Borrowing group sees "ON LOAN from [source]" with "Return" action. Borrower cannot reassign, dispose, or redistribute loaned resources.
- **Clear visual separation** in detail panel: DID Master Record section (lock icon, distinct background) vs. Local Editable section (edit icons). Users instantly see what they can/can't change.

### Statistics & search
- **Compact stat cards row** at top of content area (below search bar). Always visible, real-time updates.
- **Clickable stat cards** act as quick filters (e.g., clicking "Equipment: 87" filters to equipment). Click again to clear.
- **Full filter panel** (expandable): category, status, capability, geographic proximity, DID status, autonomous flag, group membership.
- **Subtle flash animation** on stat cards when values change via WebSocket (consistent with COP status badge pulse pattern).

### Network topology interaction
- **Click node → detail panel**: Clicking a device node opens the same slide-over detail panel used in Inventory. Consistent interaction pattern across all sub-views.
- **Color-coding**: Graph supports coloring nodes by group or by status via dropdown selector.
- **Cross-view highlighting**: Selecting a device in Discovery sub-view highlights/pulses its node when switching to Network sub-view. Shared selection state via React context.

### Resource detail panel
- **Slide-over panel** (right side) for resource detail. Opens from Inventory rows, Network graph nodes, Discovery pipeline cards, and search results. Shows DID master record + local fields + distribution history + audit trail.

### Claude's Discretion
- Disposal confirmation flow (reason + confirm modal vs. approval workflow) — determine based on existing decision gate patterns
- EM Spectrum + Topology layout (stacked vs. tabbed toggle) — determine based on screen real estate
- Exact stat card metrics and ordering
- Loading skeleton and error state designs
- Drag-and-drop library choice for group assignment
- Kanban column styling for discovery pipeline

</decisions>

<specifics>
## Specific Ideas

- Resource ownership model is doctrinal: "every resource belongs to one group or organization or individual at any given time and they are responsible for it. Data/effects from that resource can be shared, but that relationship is distinct from physical ownership and accountability."
- Master resource list exists at system level across all problem sets. Higher echelons allocate/assign/apportion to child problem sets. Each level can also add local resources which roll up to master list statistics.
- Every resource has one master DID record with: info, picture, capabilities, assignment/allocation/apportionment history, fully auditable trail.
- Consumables and end-of-life resources have a disposal mechanism (auditable removal from inventory/use).
- Top-level view should enable detailed, drillable view of every resource and type across the entire system.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabLayout` (`components/tabs/TabLayout.tsx`): Sidebar + content layout with collapsible nav, status badges, header/decision-history slots. Direct reuse for Resources sub-navigation.
- `ResourceCatalog` (`components/mission/resources/ResourceCatalog.tsx`): Tabbed equipment/personnel/consumables view with @tanstack/react-table, category filtering, bulk import. Needs `missionId` → `problemSetId` refactor.
- `ResourceForm`, `BulkImporter`, `ConsumableTracker`, `AvailabilityBadge`: Supporting components in `mission/resources/`.
- `ClientDiscoveryPanel` (`components/cop/ClientDiscoveryPanel.tsx`): BLE/Serial scanning via `useClientDiscovery` hook. Ready for reuse.
- `NetworkTopologyView` (`components/cop/NetworkTopologyView.tsx`): Force-directed device graph.
- `EMSpectrumPanel` (`components/cop/EMSpectrumPanel.tsx`): EM spectrum awareness display.
- `resource-service.ts` and `resource-registry-service.ts`: Backend service clients for resources and registry.

### Established Patterns
- URL-driven tab state in ProblemSetTabContainer (tabs resolve from URL params)
- Tab bar uses `PROBLEM_SET_TABS` const array + `TAB_LABELS` record + `renderTabContent()` switch
- Role-based tab visibility via `DEFAULT_TAB_ACCESS` and backend panel config
- NotificationBadge component for tab-level notifications
- AIStaffProvider wraps tab content for contextual AI integration
- DecisionGateProvider wraps tab content for governance integration

### Integration Points
- `ProblemSetTabContainer`: Add 'resources' to `PROBLEM_SET_TABS`, `TAB_LABELS`, `renderTabContent()`, role access maps
- COP tab: Update imports for moved discovery/network components
- WebSocket streams: Existing resource telemetry and discovery state change streams need to be wired to stat cards and pipeline updates
- `MissionDetail`: May need update after ResourceCatalog prop refactor

</code_context>

<deferred>
## Deferred Ideas

- Master resource list dashboard (system-wide top-level drillable view) — could be a standalone admin page or future phase
- DAO governance approval workflow for disposal/redistribution — Phase 28 territory
- Resource capability matching/recommendation AI — Phase 29 (Contextual AI Staff)
- Geographic/map-based resource view — could integrate with COP map layer

</deferred>

---

*Phase: 42-resources-tab-inventory-discovery*
*Context gathered: 2026-03-12*
