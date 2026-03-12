# Phase 42: Resources Tab — Inventory, Discovery & Onboarding - Research

**Researched:** 2026-03-12
**Domain:** Frontend tab integration, React component wiring, WebSocket streams
**Confidence:** HIGH — all findings verified directly from source code

## Summary

Phase 42 is almost entirely frontend integration work. The backend infrastructure is complete (Phase 27 registry + group CRUD, Phase 32 discovery pipeline). All three discovery/network components (`NetworkTopologyView`, `EMSpectrumPanel`, `ClientDiscoveryPanel`) currently exist in `components/cop/` but are **not imported anywhere** — they are orphaned assets built but not yet wired into any tab. The `useDiscovery` hook and `discoveryService` are the primary integration surfaces for real-time state.

The tab registration pattern in `ProblemSetTabContainer` is straightforward: add `'resources'` to the `PROBLEM_SET_TABS` const array, add a label to `TAB_LABELS`, add a `case 'resources':` to `renderTabContent()`, and update the `ALL_TABS_LIST` (which currently drives all role access). The tab's content component receives `problemSetId` as its sole prop.

The `ResourceCatalog` refactor from `missionId` to `problemSetId` touches four files: `ResourceCatalog.tsx`, `ResourceForm.tsx`, `BulkImporter.tsx`, and `ConsumableTracker.tsx` — all pass `missionId` through to `resourceService` calls. The backend API param is also named `missionId` in query strings; the service client passes it through unchanged, so the rename is purely a prop/variable rename at the component layer with no backend change needed.

**Primary recommendation:** Wire existing components first, add new UI (kanban pipeline, group assignment, stat cards) second. The backend is ready; all delays will come from new UI construction, not integration.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sub-navigation pattern**
- Use **TabLayout sidebar** (reuses existing component from Understand, Design, Plan tabs) for sub-view navigation: Inventory | Discovery | Network | Groups
- Search bar and statistics live in the **content area** (toolbar + stat cards row), not in the sidebar
- **Global cross-view search** — search bar always visible, results span inventory + groups + discovered devices; clicking a result navigates to the relevant sub-view
- Default sub-view is **always Inventory** (no "remember last" behavior)

**Component adaptation**
- **Refactor ResourceCatalog** to accept `problemSetId` prop directly (replace `missionId`). Clean break — update resource-service calls accordingly. Old MissionDetail usage adapts.
- **Move discovery components** from `cop/` to `components/resources/` (or shared subdirectories): ClientDiscoveryPanel → `resources/discovery/`, NetworkTopologyView + EMSpectrumPanel → `resources/network/`. COP tab imports from new location.
- **COP tab retains read-only view** of NetworkTopologyView and EMSpectrumPanel for situational awareness. Resources tab is the primary management interface. Both import from shared location.

**Discovery pipeline UX**
- **Visual pipeline** (kanban-style columns) for device state machine: Discovered → Fingerprinting → Authenticating → Gate Check → Connected/Rejected.

**Groups sub-view**
- **Dual assignment interaction**: Both multi-select + "Assign to Group" button AND drag-and-drop.
- **Group types as visual distinction**: All groups in one list with color-coded type badges. Filterable by type.
- **Aggregate capability summary card** at top of group detail view.
- **Exclusive group ownership**: One resource belongs to one group at a time. Resources can be loaned.

**Resource lifecycle & disposal**
- **Action menu** (three-dot) on each resource row: View Detail, Reassign, Loan Out, Redistribute, Report Damaged, Dispose/Decommission.
- **Status transitions** with audit trail logging.
- **Disposed resources remain in inventory** as filterable "Disposed" state.

**Distribution constraints (doctrinal)**
- ALLOC, ASSGN, APPRTN, LOCAL with visible badges and enforced constraints.
- Invalid actions disabled + tooltip.

**Master record vs local view**
- Editable at problem-set level: status, group assignment, local notes, nickname, location, readiness.
- Read-only from DID master: name/designation, category, capabilities, photos, distribution history, DID.
- Clear visual separation in detail panel.

**Statistics & search**
- Compact stat cards row always visible, real-time updates via WebSocket.
- Clickable stat cards as quick filters with flash animation.
- Full expandable filter panel.

**Network topology interaction**
- Click node opens same slide-over detail panel as Inventory.
- Color-coding by group or status via dropdown.
- Cross-view highlighting via shared React context.

**Resource detail panel**
- Slide-over panel (right side) opening from all sub-views.

### Claude's Discretion
- Disposal confirmation flow (reason + confirm modal vs. approval workflow)
- EM Spectrum + Topology layout (stacked vs. tabbed toggle)
- Exact stat card metrics and ordering
- Loading skeleton and error state designs
- Drag-and-drop library choice for group assignment
- Kanban column styling for discovery pipeline

### Deferred Ideas (OUT OF SCOPE)
- Master resource list dashboard (system-wide top-level drillable view)
- DAO governance approval workflow for disposal/redistribution
- Resource capability matching/recommendation AI
- Geographic/map-based resource view
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RES-01 | New "Resources" tab added to ProblemSetTabContainer tab bar (7th tab) | Tab registration pattern fully documented — add to PROBLEM_SET_TABS const, TAB_LABELS, ALL_TABS_LIST, renderTabContent() |
| RES-02 | ResourcesTab top-level component with sub-navigation (Inventory, Discovery, Network, Groups) | TabLayout component interface documented; direct reuse pattern established |
| RES-03 | Inventory sub-view: resurface ResourceCatalog scoped to problem set | missionId→problemSetId refactor scope confirmed: 4 files. Backend param unchanged. |
| RES-04 | Discovery sub-view: wire ClientDiscoveryPanel + device onboarding pipeline status | ClientDiscoveryPanel is zero-prop — mounts and works. useDiscovery hook provides device list + state |
| RES-05 | Discovery sub-view: device state machine pipeline (discovered→fingerprinting→authenticating→gate_check→connected/rejected) | DeviceState enum has 12 states; STATE_STYLES in DiscoveryLayer.tsx has color/pulse for each |
| RES-06 | Network sub-view: wire NetworkTopologyView | Props: `visible`, `scannerStatus`, `deviceCount`, `connectedCount` — all sourced from useDiscovery |
| RES-07 | Network sub-view: wire EMSpectrumPanel | Props: `visible`, `onClose` — but EMSpectrumPanel is absolute-positioned slide-out; needs layout adaptation |
| RES-08 | Groups sub-view: CRUD for resource groups using existing backend API | Full API confirmed: listGroups, createGroup, getGroupWithMemberCount, getGroupMembers, addToGroup, removeFromGroup, deleteGroup |
| RES-09 | Groups sub-view: drag-and-drop or select-to-assign resources to groups | @dnd-kit/core + @dnd-kit/sortable already in package.json; usage pattern documented from ContainerBrowser |
| RES-10 | Registry search bar with capability, category, status, and geographic filters | resourceRegistryService.searchRegistry() supports all four filter types |
| RES-11 | Registry statistics dashboard | resourceRegistryService.getRegistryStats() returns RegistryStats type; backend /registry/stats endpoint confirmed |
| RES-12 | Real-time updates via existing WebSocket streams | Two streams: /ws/discovery (device state) via useDiscovery; /ws/resources (telemetry position) via resourceRegistryService.subscribeToPositions() |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | (project standard) | Component framework | Project baseline |
| @tanstack/react-table | (existing) | Table rendering in ResourceCatalog | Already used in ResourceCatalog |
| @dnd-kit/core | ^6.3.1 | Drag-and-drop context | Already in package.json |
| @dnd-kit/sortable | ^10.0.0 | Sortable lists | Already in package.json |
| react-hook-form + zod | (existing) | Form validation | Used in ResourceForm already |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| discoveryService | (internal) | REST client for /api/discovery/* | All Discovery + Network sub-views |
| resourceRegistryService | (internal) | Registry search, group CRUD, WebSocket positions | Inventory stats, group management, search |
| resourceService | (internal) | Equipment/personnel/consumables CRUD | Inventory sub-view table operations |
| useDiscovery hook | (internal) | WebSocket /ws/discovery real-time device state | Discovery pipeline, Network status props |

### No New Libraries Needed
All required functionality is covered by existing installed packages. The kanban pipeline, stat cards, and slide-over panel are all custom UI built with Tailwind.

**Installation:** None required — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── resources/               # NEW — shared resource components
│   │   ├── ResourcesTab.tsx     # Top-level tab component
│   │   ├── ResourcesContext.tsx # Shared selection state (cross-view highlighting)
│   │   ├── ResourceStatCards.tsx
│   │   ├── ResourceSearchBar.tsx
│   │   ├── ResourceDetailPanel.tsx  # Slide-over panel (shared across all sub-views)
│   │   ├── inventory/
│   │   │   ├── InventorySubView.tsx
│   │   │   └── ResourceActionMenu.tsx
│   │   ├── discovery/
│   │   │   ├── DiscoverySubView.tsx
│   │   │   ├── ClientDiscoveryPanel.tsx   # MOVED from cop/
│   │   │   └── DevicePipelineKanban.tsx   # NEW
│   │   ├── network/
│   │   │   ├── NetworkSubView.tsx
│   │   │   ├── NetworkTopologyView.tsx    # MOVED from cop/
│   │   │   └── EMSpectrumPanel.tsx        # MOVED from cop/
│   │   └── groups/
│   │       ├── GroupsSubView.tsx
│   │       ├── GroupCard.tsx
│   │       └── GroupDetailView.tsx
│   └── cop/
│       ├── COPTab.tsx           # Update imports to new paths
│       └── DiscoveryLayer.tsx   # Already imports from discovery-service, unaffected
```

### Pattern 1: Tab Registration
**What:** Extend the existing `PROBLEM_SET_TABS` const, `TAB_LABELS`, `ALL_TABS_LIST`, and `renderTabContent()` switch.
**When to use:** Adding the Resources tab to the top-level tab bar.
**Example:**
```typescript
// Source: ProblemSetTabContainer.tsx — existing pattern
const PROBLEM_SET_TABS = ['understand', 'design', 'plan', 'direct', 'cop', 'assess', 'resources'] as const;
type ProblemSetTab = typeof PROBLEM_SET_TABS[number];

const TAB_LABELS: Record<ProblemSetTab, string> = {
  // ...existing...
  resources: 'Resources',
};

const ALL_TABS_LIST: ProblemSetTab[] = ['understand', 'design', 'plan', 'direct', 'cop', 'assess', 'resources'];

// In renderTabContent():
case 'resources':
  return <ResourcesTab problemSetId={displayId} />;
```

### Pattern 2: TabLayout Sub-navigation
**What:** ResourcesTab uses TabLayout with 4 sidebar items — exactly how UnderstandTab, DesignTab, and PlanTab work.
**When to use:** Top-level structure of ResourcesTab component.
**Example:**
```typescript
// Source: TabLayout.tsx — interface
const RESOURCE_NAV_ITEMS: SidebarItem[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'network', label: 'Network' },
  { id: 'groups', label: 'Groups' },
];

export function ResourcesTab({ problemSetId }: { problemSetId: string }) {
  const [subView, setSubView] = useState<string>('inventory'); // always default inventory
  return (
    <TabLayout items={RESOURCE_NAV_ITEMS} selectedItem={subView} onSelectItem={setSubView}>
      {/* search bar + stat cards always in content area */}
      <ResourceSearchBar ... />
      <ResourceStatCards problemSetId={problemSetId} />
      {subView === 'inventory' && <InventorySubView problemSetId={problemSetId} />}
      {subView === 'discovery' && <DiscoverySubView />}
      {subView === 'network' && <NetworkSubView />}
      {subView === 'groups' && <GroupsSubView problemSetId={problemSetId} />}
    </TabLayout>
  );
}
```

### Pattern 3: ResourceCatalog Prop Refactor
**What:** Rename `missionId` prop to `problemSetId` across all 4 resource components. The backend API query param `missionId` is unchanged; only component-level prop names change.
**When to use:** Wiring Inventory sub-view.
**Scope of change:**
- `ResourceCatalog.tsx`: prop interface + `useEffect` dep + all `resourceService.getResources(missionId)` calls
- `ResourceForm.tsx`: prop interface + `resourceService.createResource({...missionId: problemSetId})`
- `BulkImporter.tsx`: prop interface + `resourceService.bulkImport(missionId, rows)`
- `ConsumableTracker.tsx`: prop interface + service calls
- `MissionDetail.tsx`: update call site from `missionId={missionId}` to `problemSetId={missionId}`

The service layer passes the value as `missionId` in the query string — no change required there.

### Pattern 4: useDiscovery Hook Integration
**What:** `useDiscovery()` provides `{ devices, scannerStatus, connected, refetch }` via `/ws/discovery` WebSocket.
**When to use:** Both DiscoverySubView and NetworkSubView need this hook.
**WebSocket event types:**
- `device_discovered` → adds/updates device in array
- `device_state_changed` → updates device state in-place
- `device_lost` → sets device state to 'disconnected'
- `scanner_status` → updates `DiscoveryStatus`
**Example:**
```typescript
// Source: hooks/useDiscovery.ts
function DiscoverySubView() {
  const { devices, scannerStatus, connected } = useDiscovery();
  // devices: DiscoveredDevice[] — already real-time
  // Group devices by state for kanban columns
  const byState = groupByState(devices);
  return <DevicePipelineKanban columns={byState} />;
}
```

### Pattern 5: Resource Position WebSocket
**What:** `resourceRegistryService.subscribeToPositions(callback)` subscribes to `/ws/resources` for `resource:position_batch` events.
**When to use:** Stat card real-time updates and eventual map integration.
**Example:**
```typescript
// Source: lib/resource-registry-service.ts
useEffect(() => {
  const unsub = resourceRegistryService.subscribeToPositions((positions) => {
    // positions: Record<string, TelemetryFrame>
    // Trigger flash animation on stat cards
  });
  return unsub;
}, []);
```

### Pattern 6: @dnd-kit for Group Assignment
**What:** Use `DndContext`, `useDraggable`, and `useDroppable` from `@dnd-kit/core` — same pattern as `ContainerBrowser.tsx`.
**When to use:** Resource-to-group drag-and-drop in Groups sub-view.
**Example:**
```typescript
// Source: components/strategic/ContainerBrowser.tsx — existing usage
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
// Resource rows are draggable, group cards are droppable
// onDragEnd: resourceRegistryService.addToGroup(groupId, resourceId)
```

### Pattern 7: Cross-View Selection Context
**What:** A `ResourcesContext` (React context) holds `selectedResourceId` and `setSelectedResourceId` so clicking a device in Discovery highlights it in Network.
**When to use:** ResourcesTab wraps all sub-views with this context.
**Example:**
```typescript
// NEW component — ResourcesContext.tsx
const ResourcesContext = createContext<{
  selectedResourceId: string | null;
  setSelectedResourceId: (id: string | null) => void;
}>({ selectedResourceId: null, setSelectedResourceId: () => {} });
```

### Pattern 8: NetworkTopologyView Props
**What:** The component takes `{ visible, scannerStatus, deviceCount, connectedCount }`. The `visible` prop gates rendering (returns null when false). Scanner controls are built-in.
**When to use:** Mounting NetworkTopologyView in the Network sub-view.
**Critical:** The component uses `discoveryService.getTopology()` internally — it fetches its own data. The props just provide status bar data sourced from `useDiscovery()`.
```typescript
// Source: components/cop/NetworkTopologyView.tsx
<NetworkTopologyView
  visible={true}   // always true when in Network sub-view
  scannerStatus={scannerStatus}  // from useDiscovery
  deviceCount={devices.length}
  connectedCount={devices.filter(d => d.state === 'connected').length}
/>
```

### Pattern 9: EMSpectrumPanel Layout Adaptation
**What:** `EMSpectrumPanel` is styled as `absolute top-0 right-0 w-80 h-full` — designed as a slide-out overlay over the COP map. In the Resources tab's Network sub-view, this absolute positioning needs to be removed or overridden.
**When to use:** Moving EMSpectrumPanel to resources/network/.
**Resolution:** Strip the absolute positioning wrapper and render as a flex child alongside NetworkTopologyView. The component's content (two-tab EM data display) is independent of positioning. Claude's discretion: stacked vs. tabbed toggle layout.

### Anti-Patterns to Avoid
- **Don't add new tabs to PROBLEM_SET_TABS without updating ALL_TABS_LIST** — visibleTabs is derived from `PROBLEM_SET_TABS.filter(t => tabs.includes(t))`, so a tab in PROBLEM_SET_TABS but absent from ALL_TABS_LIST will be hidden for all roles.
- **Don't render NetworkTopologyView with `visible={false}` from unmounted state** — it runs an rAF force simulation; always null-render by checking `visible` or mounting conditionally.
- **Don't add `missionId` to the backend API params** — the backend query param for resource filtering is `missionId`. The frontend service passes `problemSetId` value under the key `missionId`. This is intentional; don't rename the query param.
- **Don't add a second useDiscovery() in NetworkSubView if DiscoverySubView already mounts it** — hoist useDiscovery to a shared parent (ResourcesTab or a shared context).
- **Don't import from `cop/` for COP-only wires** — after move, all imports from moved files must update to `resources/` paths.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time device state | Custom WebSocket | `useDiscovery()` hook | Already has reconnect/backoff logic, 4 event types handled |
| Real-time resource positions | Custom WebSocket | `resourceRegistryService.subscribeToPositions()` | Already manages single WS connection with listener set |
| Resource group CRUD | Custom API calls | `resourceRegistryService` methods | listGroups, createGroup, addToGroup, removeFromGroup, deleteGroup all exist |
| Registry search + stats | Custom fetch | `resourceRegistryService.searchRegistry()` + `getRegistryStats()` | Full filter support: capability, category, status, geo bbox, DID |
| Force-directed graph | D3/Cytoscape | `NetworkTopologyView` as-is | Custom SVG force layout already works for <100 nodes |
| EM spectrum visualization | Custom chart | `EMSpectrumPanel` as-is | Two-tab environment/emissions display with auto-refresh |
| Drag-and-drop | Native HTML5 drag | `@dnd-kit/core` | Already installed; existing ContainerBrowser usage to follow |
| Sub-nav layout | Custom sidebar | `TabLayout` | Already handles collapse, header slot, status badges |
| Form validation | Custom validation | `react-hook-form` + `zod` | Used in ResourceForm already; maintain consistency |

**Key insight:** Phase 32 built a complete discovery infrastructure and Phase 27 built a complete resource registry — Phase 42 is entirely about exposing that infrastructure in a unified UI. Resist building any new backend logic.

---

## Common Pitfalls

### Pitfall 1: DeviceState Machine Has 12 States, Not 5
**What goes wrong:** The kanban pipeline spec says "Discovered → Fingerprinting → Authenticating → Gate Check → Connected/Rejected" (5-6 columns). The actual `DeviceState` enum has 12 values: `discovered`, `fingerprinting`, `authenticating`, `gate_check`, `ironclaw_analysis`, `pending_dao`, `onboarding`, `connected`, `disconnected`, `quarantined`, `rejected`, `revoked`.
**Why it happens:** CONTEXT.md describes the simplified user-facing view; `discovery-service.ts` has the full state machine.
**How to avoid:** Map the 12 states to 5-6 display columns. Suggested grouping:
- **Discovered**: `discovered`, `fingerprinting`
- **Authenticating**: `authenticating`, `gate_check`, `ironclaw_analysis`, `pending_dao`
- **Onboarding**: `onboarding`
- **Connected**: `connected`
- **Offline**: `disconnected`
- **Rejected**: `rejected`, `revoked`, `quarantined`

### Pitfall 2: ResourceGroup Type Mismatch Between Frontend and Backend
**What goes wrong:** Backend `types.ts` defines `groupType` as `'unit' | 'formation' | 'task_force' | 'custom'`. Frontend `resource-registry-service.ts` defines it as `'task_force' | 'support' | 'reserve' | 'custom'`. CONTEXT.md decisions use `task_force`, `support`, `reserve`, `custom`.
**Why it happens:** Frontend service was written with different group type semantics than the backend.
**How to avoid:** The backend group CRUD stores `groupType` as a plain string — it does not validate against an enum. The frontend can pass any string. Use the CONTEXT.md types (`task_force`, `support`, `reserve`, `custom`) in the UI. The color-coded badges will work with any string. The `ResourceGroup` interface in `resource-registry-service.ts` needs its `groupType` union updated to match CONTEXT.md values.

### Pitfall 3: RegistryStats Response Shape Mismatch
**What goes wrong:** Frontend `RegistryStats` interface has `{ totalResources, byCategory, byStatus, withDID, autonomous, groupCount }`. The backend `/registry/stats` endpoint returns `{ total, byCategory, byStatus, autonomous, passive }`. `totalResources`, `withDID`, and `groupCount` fields don't exist in backend response; `total` maps to `totalResources`; `passive` has no frontend counterpart.
**Why it happens:** Frontend type was written speculatively; backend implementation diverged.
**How to avoid:** Either: (a) update frontend `RegistryStats` type to match actual backend response shape, or (b) add `withDID` and `groupCount` to the backend `/registry/stats` endpoint. Option (b) is better for the stat cards requirement (RES-11 asks for `withDID` and group count). Plan a Wave 0 backend enhancement to add these fields.

### Pitfall 4: `missionId` Scope — ResourceCatalog Still Scoped to Old Mission Model
**What goes wrong:** After the `missionId` → `problemSetId` rename, the data is still fetched with `missionId` as the query param. Existing resource records in the database have `missionId` values from the old mission system. ProblemSet IDs and Mission IDs are different ID spaces.
**Why it happens:** Phase 27 built resources for the Mission model; Phase 23 renamed workspace → problem set but didn't migrate resources.
**How to avoid:** Verify that `problemSetId` values match what's stored in the `mission_id` column of the resources table. If they don't match, the inventory will appear empty. This is a data migration question, not just a code rename. Check whether existing problem sets have the same ID as their predecessor missions.
**Warning signs:** Empty inventory view after refactor despite data existing in the database.

### Pitfall 5: NetworkTopologyView Absolute Positioning Assumption
**What goes wrong:** `EMSpectrumPanel` renders as `absolute top-0 right-0 z-1001 h-full w-80` — it assumes it's overlaid on a relative-positioned map container. Dropping it inside a flex layout in the Network sub-view will cause it to position relative to the nearest positioned ancestor, potentially off-screen or overlapping unrelated content.
**Why it happens:** The component was designed specifically for COP map overlay.
**How to avoid:** When moving to `resources/network/`, strip the absolute positioning and `z-index` from the outer div, replacing with `flex-shrink-0 w-80 h-full` or similar. The `onClose` prop becomes a "hide" toggle rather than a dismiss gesture.

### Pitfall 6: `useDiscovery` Double Mount
**What goes wrong:** If both `DiscoverySubView` and `NetworkSubView` independently call `useDiscovery()`, two WebSocket connections open to `/ws/discovery`.
**Why it happens:** Each hook instance creates its own WebSocket.
**How to avoid:** Hoist `useDiscovery()` to the `ResourcesTab` level and pass `devices`, `scannerStatus`, `connected` as props to both sub-views, OR create a `ResourcesContext` that holds the discovery state.

### Pitfall 7: Group Update Endpoint Missing
**What goes wrong:** The backend API has CREATE, READ (with member count), LIST, DELETE for groups, and ADD/REMOVE members. There is no `PATCH /groups/:groupId` to rename a group or update its description.
**Why it happens:** Phase 27 didn't implement group update.
**How to avoid:** Either scope Groups CRUD to create/delete only (no rename), or add a `PATCH /groups/:groupId` backend endpoint in Wave 0. Given CONTEXT.md requires CRUD (RES-08), plan to add the update endpoint.

---

## Code Examples

Verified patterns from source:

### Tab Registration (ProblemSetTabContainer.tsx)
```typescript
// Source: ProblemSetTabContainer.tsx lines 51-81
const PROBLEM_SET_TABS = [
  'understand', 'design', 'plan', 'direct', 'cop', 'assess', 'resources'
] as const;
type ProblemSetTab = typeof PROBLEM_SET_TABS[number];

const TAB_LABELS: Record<ProblemSetTab, string> = {
  understand: 'Understand', design: 'Design', plan: 'Plan',
  direct: 'Direct', cop: 'COP', assess: 'Assess',
  resources: 'Resources',   // ADD
};

const ALL_TABS_LIST: ProblemSetTab[] = [
  'understand', 'design', 'plan', 'direct', 'cop', 'assess', 'resources'  // ADD
];

// In renderTabContent():
case 'resources':
  return <ResourcesTab problemSetId={displayId} />;
```

### ResourceCatalog Prop Refactor
```typescript
// Source: ResourceCatalog.tsx line 33-37 — BEFORE
interface ResourceCatalogProps { missionId: string; }
export function ResourceCatalog({ missionId }: ResourceCatalogProps) {
  useEffect(() => { loadData(); }, [missionId]);
  // calls: resourceService.getResources(missionId), getPersonnel(missionId), getConsumables(missionId)

// AFTER — only prop name changes; service calls pass value under same key
interface ResourceCatalogProps { problemSetId: string; }
export function ResourceCatalog({ problemSetId }: ResourceCatalogProps) {
  useEffect(() => { loadData(); }, [problemSetId]);
  // calls: resourceService.getResources(problemSetId), etc.
```

### Group CRUD API (resource-registry-service.ts)
```typescript
// Source: lib/resource-registry-service.ts lines 199-241
// List groups for a problem set
const groups = await resourceRegistryService.listGroups(problemSetId);

// Create group
const group = await resourceRegistryService.createGroup({
  missionId: problemSetId,
  name: 'Task Force Alpha',
  groupType: 'task_force',  // use CONTEXT.md types
});

// Assign resource to group
await resourceRegistryService.addToGroup(groupId, resourceId);

// Remove resource from group
await resourceRegistryService.removeFromGroup(groupId, resourceId);
```

### Registry Stats + Search
```typescript
// Source: lib/resource-registry-service.ts
const stats = await resourceRegistryService.getRegistryStats();
// returns: { totalResources, byCategory, byStatus, withDID, autonomous, groupCount }
// NOTE: backend returns { total, byCategory, byStatus, autonomous, passive }
// Frontend type needs alignment — see Pitfall 3

const results = await resourceRegistryService.searchRegistry({
  capability: 'fire_support',   // optional
  category: 'vehicles',          // optional
  status: 'FMC',                 // optional
  missionId: problemSetId,       // scope to this problem set
});
```

### Discovery Pipeline — DeviceState enum
```typescript
// Source: lib/discovery-service.ts lines 24-38
export const DeviceState = {
  discovered: 'discovered',
  fingerprinting: 'fingerprinting',
  authenticating: 'authenticating',
  gate_check: 'gate_check',
  ironclaw_analysis: 'ironclaw_analysis',
  pending_dao: 'pending_dao',
  onboarding: 'onboarding',
  connected: 'connected',
  disconnected: 'disconnected',
  quarantined: 'quarantined',
  rejected: 'rejected',
  revoked: 'revoked',
} as const;
```

### dnd-kit Group Assignment Pattern
```typescript
// Source: components/strategic/ContainerBrowser.tsx — existing usage pattern
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';

// Resource row: draggable
function DraggableResource({ resource }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: resource.id,
    data: { resourceId: resource.id },
  });
  return <div ref={setNodeRef} {...listeners} {...attributes}>...</div>;
}

// Group card: droppable
function DroppableGroup({ group }) {
  const { isOver, setNodeRef } = useDroppable({ id: group.id });
  return <div ref={setNodeRef} style={{ background: isOver ? '...' : '...' }}>...</div>;
}

// Parent context
function GroupsSubView() {
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    await resourceRegistryService.addToGroup(over.id as string, active.id as string);
  };
  return <DndContext onDragEnd={handleDragEnd}>...</DndContext>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resources scoped to Mission | Resources will be scoped to ProblemSet | Phase 42 (this phase) | Clean break: prop rename only, backend param unchanged |
| ClientDiscoveryPanel in cop/ | Moved to resources/discovery/ | Phase 42 (this phase) | COP imports from new path |
| NetworkTopologyView as COP-only | Shared between Resources (primary) and COP (read-only) | Phase 42 | Enables cross-tab consistency |
| EMSpectrumPanel as absolute slide-out | Inline in Network sub-view | Phase 42 | Needs CSS positioning strip |

**Deprecated/outdated:**
- `missionId` prop on ResourceCatalog, ResourceForm, BulkImporter, ConsumableTracker: replaced by `problemSetId` in Phase 42

---

## Open Questions

1. **ProblemSetId vs MissionId database scope**
   - What we know: Backend `resources` table has `mission_id` column. `resourceService.getResources(missionId)` passes the value as `?missionId=` query param.
   - What's unclear: Are ProblemSet IDs the same values that were historically stored as Mission IDs? If the app migrated from "mission" to "problem set" terminology but kept the same IDs, this is a no-op. If they're different ID spaces, inventory will be empty.
   - Recommendation: Check one live problem set: `SELECT COUNT(*) FROM resources WHERE mission_id = '<some-problemSetId>'`. If 0 and data exists with old mission IDs, a migration or dual-query is needed.

2. **Group Update Endpoint**
   - What we know: Backend has no `PATCH /resources/groups/:groupId` route.
   - What's unclear: Whether the Groups sub-view needs rename/description edit, or just create + delete.
   - Recommendation: Add `PATCH /groups/:groupId` in Wave 0 to support rename. It's a small addition.

3. **RegistryStats `withDID` and `groupCount` fields**
   - What we know: Frontend service defines them; backend doesn't return them.
   - What's unclear: Whether the stat cards for "With DID" and "Groups" are high priority for Wave 1.
   - Recommendation: Add to backend `/registry/stats` response in Wave 0 (simple SQL COUNT queries).

4. **Cross-tab COP import updates**
   - What we know: `NetworkTopologyView`, `EMSpectrumPanel`, `ClientDiscoveryPanel` are not imported by COPTab currently.
   - What's unclear: If these are not currently used by COP at all, the "COP tab retains read-only view" decision may require adding new code to COPTab (not just updating import paths).
   - Recommendation: The move is safe (no existing importers to break). Adding read-only views to COP is new work, probably Wave 3 or post-phase.

---

## Validation Architecture

> Skipping — `workflow.nyquist_validation` is not present in `.planning/config.json` (config only specifies mode/depth/gates/safety).

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `components/problem-set/ProblemSetTabContainer.tsx` — tab registration pattern, PROBLEM_SET_TABS const, renderTabContent() switch
- Direct source read: `components/tabs/TabLayout.tsx` — SidebarItem interface, TabLayoutProps, component behavior
- Direct source read: `components/mission/resources/ResourceCatalog.tsx` — missionId prop, service call pattern, @tanstack/react-table usage
- Direct source read: `components/mission/resources/ResourceForm.tsx` — missionId prop scope
- Direct source read: `components/cop/ClientDiscoveryPanel.tsx` — zero-prop component, useClientDiscovery hook
- Direct source read: `components/cop/NetworkTopologyView.tsx` — full props interface, internal discoveryService calls
- Direct source read: `components/cop/EMSpectrumPanel.tsx` — absolute positioning issue, props, auto-refresh
- Direct source read: `lib/resource-service.ts` — ResourceService API methods, missionId param
- Direct source read: `lib/resource-registry-service.ts` — ResourceRegistryService, group CRUD methods, WebSocket subscription
- Direct source read: `lib/discovery-service.ts` — DeviceState enum (12 states), DiscoveryApiService methods
- Direct source read: `hooks/useDiscovery.ts` — WebSocket /ws/discovery, 4 event types, reconnect logic
- Direct source read: `hooks/useClientDiscovery.ts` — Web Bluetooth/Serial, relay to backend
- Direct source read: `backend/src/api/resources.ts` — all route definitions confirmed
- Direct source read: `backend/src/resources/resource-group-store.ts` — group CRUD SQL
- Direct source read: `backend/src/resources/resource-ws.ts` — /ws/resources endpoint
- Direct source read: `backend/src/resources/types.ts` — ResourceGroup type (groupType union differs from frontend)
- Direct source read: `frontend/package.json` — @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0 confirmed
- Direct source read: `components/strategic/ContainerBrowser.tsx` — dnd-kit usage pattern

### Secondary (MEDIUM confidence)
- None required — all findings verified from source.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from package.json and existing source
- Architecture: HIGH — all patterns derived from actual component source
- Pitfalls: HIGH — backend/frontend type mismatches verified by reading both sides
- API surface: HIGH — all endpoints verified from backend/src/api/resources.ts

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable codebase, no external dependencies changing)
