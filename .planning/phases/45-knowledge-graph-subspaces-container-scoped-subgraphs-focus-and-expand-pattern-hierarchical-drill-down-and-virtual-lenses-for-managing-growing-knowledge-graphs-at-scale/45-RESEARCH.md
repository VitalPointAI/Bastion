# Phase 45: Knowledge Graph Subspaces — Research

**Researched:** 2026-03-13
**Domain:** React/Three.js 3D graph visualization, Neo4j Cypher traversals, PostgreSQL persistence, React state architecture
**Confidence:** HIGH (all findings verified against existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Subspace Definition & Entry**
- Dual subspace model: containers are automatic subspaces + users can create custom subspaces
- Custom subspace creation: both lasso-select-and-save (manual) AND query-based smart subspaces (dynamic membership). Both appear in sidebar tree with a badge indicating type (manual vs smart)
- Entry methods: double-click a cluster to dive in AND sidebar tree navigation for browsable overview. Either path enters the same focused view
- Cross-subspace boundaries: ghost links — connections to external nodes shown as faded links leading to dimmed external node stubs at the boundary. Shows context without clutter

**Focus-and-Expand Pattern**
- Concentric ring expansion: click 'expand' to load 1-hop neighbors, click again for 2-hop, etc. Rings radiate outward from focus node — progressive disclosure
- On-demand backend loading: each expansion ring triggers a backend query for that node's N-hop neighbors. Essential for scaling to large graphs (500+ nodes)
- Breadcrumb trail navigation: bar at top shows path (e.g., 'Full Graph > China subspace > PLA Navy > Admiral Zhang'). Click any crumb to jump back to that level
- Depth limit: unlimited expansion with warning past 3 hops ("This may load many nodes"). Let power users go deeper

**Hierarchical Drill-Down**
- 4 levels deep:
  - Level 1: Full brain — all subspaces as clusters
  - Level 2: Inside a subspace — nodes + internal structure
  - Level 3: Node detail — focus + expand neighbors
  - Level 4: Document layer — source documents, evidence trail, extraction history
- Animated zoom-in transitions: camera smoothly zooms into selected cluster/node, other elements fade out, new level content fades in. "Diving deeper" feel. Consistent with existing camera zoom-to-node behavior
- Document layer (Level 4): hybrid view — mini-constellation in center showing document relationships visually + right panel showing full document details when a doc node is selected
- Breadcrumbs with counts + icons: e.g., 'Full Brain (247) > China (43) > PLA Navy (12) > Documents (5)'. Node count gives scale awareness, icons indicate level type

**Virtual Lenses**
- Lenses supersede cluster modes: clustering mode becomes one property of a lens (along with filters, visibility, zoom). Current 3 modes (container, DIME, organic) become built-in lenses. No separate 'cluster toggle' vs 'lens selector' — unified concept
- Role presets + custom lenses:
  - J2 Intel: adversary entities, intel gaps, OSINT links, confidence overlay
  - J3 Ops: friendly forces, missions, resource connections
  - J5 Plans: objectives hierarchy, DIME themes, strategic linkages
  - Overview: everything visible, container clustering (replaces current default)
- Lens composition: saved filter + layout + clustering mode + zoom level + node visibility configuration
- Scope: private user lenses + publish-to-share capability. Other users can clone shared lenses to customize. Consistent with Phase 41 annotation sharing model

### Claude's Discretion
- Lens UI placement (toolbar dropdown, sidebar section, or floating panel)
- Smart subspace query syntax/UI design
- Exact animation timing and easing for drill-down transitions
- Backend query optimization for N-hop neighbor loading (Cypher query design)
- Ghost link rendering style (opacity, dash pattern, stub node appearance)
- Sidebar tree component design and collapsibility
- Lens data model and persistence schema
- Performance thresholds for expansion warnings

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 45 extends the brain visualization (Phase 41) with four major capabilities: subspace navigation (container-scoped and custom), focus-and-expand N-hop progressive loading, 4-level hierarchical drill-down with animated transitions, and a unified lens system that replaces the existing cluster mode toggle.

The existing codebase provides strong foundations. All Neo4j entities already carry `containerIds` array (actor-store.ts), `workspaceId` multi-tenant isolation, and `containerId` on brain nodes (types.ts). The `useBrainClustering` hook already groups by `containerId` and `dimeCategory`. The camera `cameraPosition()` call with easing is already in use at `BrainVisualization.tsx:476-489`. The annotation sharing model (PostgreSQL `brain_annotations` table with `is_shared`, `created_by`, `problem_set_id`) provides the exact pattern for lens persistence.

The primary new work is: (1) a `useBrainDrillDown` hook managing hierarchical state, (2) a `useBrainLens` hook replacing `useBrainClustering`, (3) new backend endpoints for N-hop neighbors and subspace queries, (4) PostgreSQL tables for subspace and lens persistence, and (5) UI components for breadcrumb trail, subspace sidebar tree, and lens selector.

**Primary recommendation:** Build incrementally — subspace model first (leverages existing `containerIds`), then lens system (replaces cluster toggle), then drill-down navigation, then focus-and-expand. Each wave is independently useful.

---

## Standard Stack

### Core (all already in use — verified against package.json and imports)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-force-graph-3d | existing | 3D force-directed graph rendering | Already wired, provides `cameraPosition()`, `d3Force()` |
| three | existing | 3D geometry/material/camera | All node rendering in BrainVisualization uses THREE.* |
| d3-force-3d (inline) | existing | Custom force factories | useBrainClustering already uses inline force implementations |
| neo4j-driver | existing | Graph DB queries | executeReadQuery/executeWriteQuery in neo4j-client.ts |
| postgresql (pg) | existing | Lens/subspace persistence | Annotations use same pattern (brain_annotations table) |

### No New Dependencies Required
All Phase 45 capabilities can be built using the existing stack. No new npm packages needed.

---

## Architecture Patterns

### State Architecture: Drill-Down Stack in BrainController

The `BrainController` is the master state container (per CONTEXT.md). Phase 45 adds drill-down level state, breadcrumb stack, active lens state, and active subspace state.

```typescript
// Drill-down level type
type DrillLevel = 'full' | 'subspace' | 'node' | 'document';

interface BreadcrumbEntry {
  level: DrillLevel;
  id: string;           // subspaceId, nodeId, or documentId
  label: string;
  count: number;        // node count at this level
  icon: string;         // emoji icon for breadcrumb
}

// State additions in BrainController
const [drillStack, setDrillStack] = useState<BreadcrumbEntry[]>([]);
const [activeSubspaceId, setActiveSubspaceId] = useState<string | null>(null);
const [activeLensId, setActiveLensId] = useState<string>('overview');
const [expandedHops, setExpandedHops] = useState<number>(0);
const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
```

### Pattern 1: useBrainDrillDown Hook

**What:** Manages the 4-level drill-down stack, produces filtered graph data for each level.
**When to use:** Replaces direct node selection for drill-down navigation.

```typescript
// hooks/useBrainDrillDown.ts
interface DrillDownState {
  level: DrillLevel;
  filteredData: BrainGraphData;  // nodes visible at this level
  breadcrumbs: BreadcrumbEntry[];
  drillIntoSubspace: (subspaceId: string) => void;
  drillIntoNode: (nodeId: string) => void;
  drillIntoDocuments: (nodeId: string) => void;
  drillUp: (targetLevel: number) => void;  // jump to breadcrumb index
}
```

At Level 2 (subspace), filter nodes by `node.containerId === activeSubspaceId` OR `customSubspace.nodeIds.includes(node.id)`. Include ghost stub nodes for edges that cross the subspace boundary.

At Level 3 (node detail + expand), show the focus node plus its loaded N-hop neighbors.

At Level 4 (document layer), show document nodes connected to the focus node via `sourceDocumentIds`.

### Pattern 2: useBrainLens Hook (replaces useBrainClustering)

**What:** Manages the active lens — a named configuration of filter + clustering mode + node visibility + zoom.
**When to use:** Lens selector replaces the cluster mode toggle entirely.

```typescript
interface BrainLens {
  id: string;
  name: string;
  isBuiltIn: boolean;   // true for J2/J3/J5/Overview presets
  clusterMode: ClusterMode;
  nodeTypeFilters: BrainNodeType[];       // which types to show
  actorCategoryFilters: ActorCategory[];  // which categories to show
  dimeCategoryFilters: string[];          // which DIME themes to show
  showGapNodes: boolean;
  showConfidenceOverlay: boolean;
  createdBy: string;
  isShared: boolean;
  problemSetId: string;
}

// Built-in lens configurations:
const J2_LENS: Partial<BrainLens> = {
  id: 'builtin:j2',
  name: 'J2 Intel',
  clusterMode: 'container',
  actorCategoryFilters: ['adversary', 'neutral'],
  showGapNodes: true,
  showConfidenceOverlay: true,
};

const J3_LENS: Partial<BrainLens> = {
  id: 'builtin:j3',
  name: 'J3 Ops',
  clusterMode: 'container',
  actorCategoryFilters: ['ally', 'partner'],
  nodeTypeFilters: ['entity'],
};

const J5_LENS: Partial<BrainLens> = {
  id: 'builtin:j5',
  name: 'J5 Plans',
  clusterMode: 'dime',
  nodeTypeFilters: ['objective', 'concept'],
};

const OVERVIEW_LENS: Partial<BrainLens> = {
  id: 'builtin:overview',
  name: 'Overview',
  clusterMode: 'container',
  // all types, all categories visible
};
```

The `ClusterMode` type in `types.ts` remains unchanged — lens just wraps it as one of its properties.

### Pattern 3: N-Hop Backend Endpoint

**What:** New API endpoint that returns all nodes and edges within N hops of a focal node.
**When to use:** Each expand click triggers this endpoint.

```typescript
// GET /api/graph/workspaces/:id/nhop?nodeId=:nodeId&hops=:n
// Returns: { nodes: RawGraphNode[], edges: RawGraphEdge[] }

// Cypher query (Neo4j):
const nhopQuery = `
  MATCH path = (start:Actor {id: $nodeId})-[*1..$hops]-(neighbor)
  WHERE start.workspaceId = $workspaceId
  WITH COLLECT(DISTINCT neighbor) AS neighbors,
       COLLECT(DISTINCT relationships(path)) AS rels
  UNWIND neighbors AS n
  UNWIND rels AS relList
  UNWIND relList AS r
  RETURN DISTINCT n, r
  LIMIT $limit
`;
// IMPORTANT: Always include LIMIT to prevent runaway traversals
// Recommended: limit = 200 for 1-2 hops, 100 for 3+ hops
// Warning threshold: if result count > 150, show "Loading many nodes" warning
```

### Pattern 4: Subspace Persistence Schema

**What:** PostgreSQL tables for custom subspace definitions (manual + smart).
**When to use:** All custom subspace operations read/write these tables.

```sql
-- Manual subspaces (lasso-selected or named node sets)
CREATE TABLE brain_subspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subspace_type TEXT NOT NULL CHECK (subspace_type IN ('manual', 'smart')),
  node_ids TEXT[] DEFAULT '{}',          -- for manual subspaces
  query_definition JSONB,                -- for smart subspaces
  created_by TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON brain_subspaces(problem_set_id);
CREATE INDEX ON brain_subspaces(created_by);
```

Smart subspace `query_definition` shape:
```json
{
  "nodeTypes": ["entity"],
  "actorCategories": ["adversary"],
  "containerId": "china-container-id",
  "dimeCategories": ["MILITARY"],
  "namePattern": "PLA*"
}
```

### Pattern 5: Lens Persistence Schema

**What:** PostgreSQL table for lens configurations (mirrors annotation sharing model).
**When to use:** All lens save/load/share operations.

```sql
-- Virtual lenses
CREATE TABLE brain_lenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_built_in BOOLEAN DEFAULT false,
  cluster_mode TEXT NOT NULL DEFAULT 'container',
  node_type_filters TEXT[] DEFAULT '{}',
  actor_category_filters TEXT[] DEFAULT '{}',
  dime_category_filters TEXT[] DEFAULT '{}',
  show_gap_nodes BOOLEAN DEFAULT true,
  show_confidence_overlay BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  cloned_from UUID REFERENCES brain_lenses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON brain_lenses(problem_set_id);
CREATE INDEX ON brain_lenses(created_by);
```

### Pattern 6: Ghost Link Rendering in Three.js

**What:** Nodes at subspace boundary rendered as dimmed stubs; their edges as dashed/faded lines.
**When to use:** Level 2 (subspace view) — show cross-boundary connections without full context.

```typescript
// In BrainVisualization or processedData computation:
interface GhostStubNode extends BrainNode {
  isGhostStub: true;         // new flag
  ghostSourceSubspace: string;
}

interface GhostEdge extends BrainEdge {
  isGhostLink: true;
}

// Ghost stub node rendering: use opacity 0.2, wireframe only
// Ghost link rendering: linkColor returns 'rgba(100, 160, 255, 0.15)'
//                       linkWidth returns 0.3 (thin dashed)
// THREE.js line dashes: use LineDashedMaterial for ghost links
// Simplest approach: just use very low opacity (0.1) + small node scale (0.4)
// rather than full dashed line implementation (which requires line geometry changes)
```

### Pattern 7: Animated Camera Drill-Down

**What:** Reuse existing `fgRef.current.cameraPosition()` with easing for drill-down transitions.
**When to use:** Every level transition.

Existing camera zoom pattern (BrainVisualization.tsx:476-489):
```typescript
fg.cameraPosition(
  { x: node.x + distance, y: node.y + distance, z: node.z + distance },
  { x: node.x, y: node.y, z: node.z },
  1000,  // ms easing duration
);
```

For drill-in: zoom toward cluster centroid (same as above, distance 60 instead of 120).
For drill-out: reset camera to default position `{ x: 0, y: 0, z: 500 }` with 800ms easing.
Fade effect: use CSS `opacity` transition on the BrainVisualization wrapper div, not Three.js.

### Recommended Project Structure Additions

```
frontend/src/components/brain/
├── hooks/
│   ├── useBrainDrillDown.ts    (NEW — drill-down stack and level state)
│   ├── useBrainLens.ts         (NEW — replaces useBrainClustering)
│   ├── useBrainSubspaces.ts    (NEW — CRUD for custom subspaces)
│   ├── useBrainNHop.ts         (NEW — on-demand N-hop neighbor loading)
│   └── [existing hooks]
├── BrainBreadcrumb.tsx         (NEW — breadcrumb trail bar)
├── BrainBreadcrumb.css         (NEW)
├── SubspaceSidebar.tsx         (NEW — subspace tree navigation)
├── SubspaceSidebar.css         (NEW)
├── LensSelector.tsx            (NEW — lens dropdown/panel)
├── LensSelector.css            (NEW)
└── [existing components]

backend/src/
├── graph/
│   └── subspace/
│       ├── subspace-store.ts   (NEW — CRUD for brain_subspaces)
│       └── lens-store.ts       (NEW — CRUD for brain_lenses)
├── api/
│   └── brain-subspaces.ts      (NEW — REST endpoints)
└── db/migrations/
    └── 032-brain-subspaces-lenses.sql  (NEW)
```

### Anti-Patterns to Avoid

- **Loading all nodes before subspace filter:** Always filter at the data layer (useBrainDrillDown) BEFORE passing to BrainVisualization. Never render all nodes then hide them in Three.js — this wastes GPU.
- **Unlimited N-hop queries:** Always include `LIMIT` in Cypher. 4-hop traversal on a 500-node graph can return thousands of paths. Cap at 200 nodes returned.
- **Re-creating Three.js geometry on every lens change:** Lens changes should only update node opacity/color, not recreate meshes. Reuse the existing material cache.
- **Replacing useBrainClustering abruptly:** The lens system wraps `clusterMode` — don't remove the existing `ClusterMode` type or `d3Force()` calls. The lens hook calls `useBrainClustering` internally or replicates its force application.
- **Separate "cluster toggle" AND "lens selector":** The CONTEXT.md is explicit — they are unified. Remove the existing cluster toggle buttons from BrainToolbar and replace with the lens selector only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N-hop graph traversal | Custom BFS in JS | Neo4j variable-length path `[*1..$hops]` | Neo4j traverses in graph storage, orders of magnitude faster |
| Force-directed layout for subspaces | Custom physics | `fgRef.current.d3Force()` (existing pattern) | Already implemented and tested in useBrainClustering |
| Animated camera transitions | CSS transforms or manual lerp | `fgRef.current.cameraPosition(x,y,z, lookAt, durationMs)` | Already in use, handles 3D orbit control correctly |
| Lens config validation | Custom Zod schema from scratch | Mirror annotation schema pattern — simple JSONB column | Smart subspace queries are already validated by type structure |
| Subspace membership for containers | Custom query | Filter `node.containerId === subspaceId` (already on BrainNode) | `containerId` is already populated on all Actor nodes |

**Key insight:** The existing codebase already handles 80% of the hard problems. Neo4j has the graph traversal, Three.js/react-force-graph-3d has the camera and force layout, PostgreSQL already stores annotations with sharing. Phase 45 is primarily about assembling new UI patterns from these existing pieces.

---

## Common Pitfalls

### Pitfall 1: Ghost Stub Nodes Disrupting Force Layout
**What goes wrong:** Adding ghost stub nodes to the force graph causes them to be included in force calculations, distorting the layout of real nodes.
**Why it happens:** `react-force-graph-3d` applies forces to ALL nodes in `data.nodes`.
**How to avoid:** Set `fx`/`fy`/`fz` (fixed position) on ghost stub nodes to pin them at the subspace boundary. Use `fg.d3Force('link')` to make ghost edges weaker (strength 0.01 vs 0.3 for real edges).
**Warning signs:** Subspace view appears "pulled" toward external nodes.

### Pitfall 2: N-Hop Query Response Race Conditions
**What goes wrong:** User clicks expand rapidly — multiple in-flight requests, last one may not be "largest hop". UI shows intermediate hop count after a slower earlier request resolves.
**Why it happens:** `expandedHops` state updates before fetch resolves.
**How to avoid:** Tag each fetch with the requested hop count. Only apply response if `responseHops >= currentHops`. Use `AbortController` to cancel superseded requests (same pattern as useBrainTimeline).
**Warning signs:** Graph flickers between node counts after rapid expand clicks.

### Pitfall 3: Smart Subspace Stale Membership
**What goes wrong:** A smart subspace shows nodes matching its query at creation time, but new nodes ingested later don't appear in the subspace automatically.
**Why it happens:** Smart subspace membership is computed once and cached, not re-evaluated on each render.
**How to avoid:** Smart subspace membership is computed at render time by running the `query_definition` filter against the current `data.nodes` array — NOT stored as a node list in the database. The `node_ids` column is only used for manual subspaces. Re-evaluate smart membership every time `data` updates.
**Warning signs:** New actors appear in the full graph but not in the smart subspace after ingestion.

### Pitfall 4: Breadcrumb State After Data Refresh
**What goes wrong:** User is at Level 3 (node detail), data refreshes via SSE, the focal node no longer exists (deleted/merged). Breadcrumb shows stale path.
**Why it happens:** `drillStack` holds node IDs that may become invalid after data changes.
**How to avoid:** After each `data` update in `useBrainData`, validate `drillStack` entries against current `data.nodes`. Pop any entries whose IDs are no longer present.
**Warning signs:** Empty node detail panel while breadcrumb shows a specific node.

### Pitfall 5: Lens Application Triggering Full Simulation Reheat
**What goes wrong:** Switching lenses calls `fg.d3ReheatSimulation()` unnecessarily for filter-only changes (e.g., J2 → J3 just changes visibility, same cluster mode).
**Why it happens:** `useBrainClustering` always reheats on mode change.
**How to avoid:** In the new `useBrainLens`, only call `d3ReheatSimulation()` when `clusterMode` actually changes between lenses. Pure filter changes (node visibility, color overlay) update `processedData` but don't touch forces.
**Warning signs:** Graph "explodes" and re-stabilizes on every lens switch.

### Pitfall 6: `containerId` vs `containerIds` Mismatch
**What goes wrong:** `BrainNode` type has `containerId?: string` (singular), but the Neo4j `Actor` model has `containerIds: string[]` (plural — an actor can belong to multiple containers).
**Why it happens:** The BrainNode type was defined for clustering simplicity (one cluster per node), but the underlying data model supports multi-container membership.
**How to avoid:** When building subspace filters, check `actor.containerIds.includes(subspaceId)` at the data-fetching layer (backend). BrainNode's `containerId` is the PRIMARY container for display clustering. For subspace membership, use the full `containerIds` array from the raw actor data.
**Warning signs:** Actors appearing in only one subspace when they belong to multiple containers.

---

## Code Examples

Verified patterns from the existing codebase:

### Camera zoom-to-node (existing, reuse for drill-in)
```typescript
// Source: BrainVisualization.tsx:476-489
const fg = fgRef.current;
if (fg && node.x != null && node.y != null) {
  const distance = 120;
  fg.cameraPosition(
    { x: node.x + distance, y: node.y + distance, z: (node.z ?? 0) + distance },
    { x: node.x, y: node.y, z: node.z ?? 0 },
    1000,
  );
}
// For drill-in to subspace centroid: use distance = 60, duration = 800
// For drill-out to full view: cameraPosition({ x: 0, y: 0, z: 500 }, { x: 0, y: 0, z: 0 }, 800)
```

### d3Force application (existing, reuse in lens hook)
```typescript
// Source: useBrainClustering.ts:201-206
fg.d3Force('x', xForce as any);
fg.d3Force('y', yForce as any);
fg.d3ReheatSimulation();
// To remove forces (organic mode):
fg.d3Force('x', null);
fg.d3Force('y', null);
fg.d3ReheatSimulation();
```

### Annotation persistence pattern (replicate for lenses)
```sql
-- Source: backend/src/db/migrations/031-brain-annotations-snapshots.sql
-- brain_annotations has: id, node_id, problem_set_id, created_by, is_shared
-- Replicate this exact pattern for brain_lenses and brain_subspaces
```

### N-hop Cypher query (new, for backend endpoint)
```cypher
// GET /api/graph/workspaces/:id/nhop?nodeId=:nodeId&hops=:n
MATCH path = (start:Actor {id: $nodeId, workspaceId: $workspaceId})-[r*1..$hops]-(neighbor)
WITH COLLECT(DISTINCT neighbor) AS neighborNodes,
     COLLECT(DISTINCT r) AS allRels
UNWIND neighborNodes AS n
RETURN n
LIMIT $nodeLimit
// Separate query for edges:
MATCH (a:Actor {workspaceId: $workspaceId})-[r]-(b:Actor {workspaceId: $workspaceId})
WHERE a.id IN $nodeIds AND b.id IN $nodeIds
RETURN r
```

### Container subspace filter (frontend, for Level 2)
```typescript
// Source: useBrainClustering.ts — containerCentroids uses containerId
// For subspace filtering in useBrainDrillDown:
const subspaceNodes = data.nodes.filter(n =>
  n.containerId === activeSubspaceId
  // OR custom subspace: customSubspace.nodeIds.includes(n.id)
);
// Ghost stubs for boundary nodes (nodes connected to subspace nodes but not in subspace):
const subspaceNodeIds = new Set(subspaceNodes.map(n => n.id));
const ghostStubs: BrainNode[] = [];
for (const edge of data.edges) {
  const srcIn = subspaceNodeIds.has(edge.source);
  const tgtIn = subspaceNodeIds.has(edge.target);
  if (srcIn !== tgtIn) {
    const externalId = srcIn ? edge.target : edge.source;
    if (!ghostStubs.find(g => g.id === externalId)) {
      const externalNode = data.nodes.find(n => n.id === externalId);
      if (externalNode) ghostStubs.push({ ...externalNode, isGhostStub: true } as BrainNode & { isGhostStub: true });
    }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cluster mode toggle (3 buttons) | Unified lens selector | Phase 45 | Lens selector replaces BrainToolbar's cluster buttons entirely |
| All nodes always loaded | Progressive N-hop on demand | Phase 45 | Scales to 500+ node graphs without performance cliff |
| Flat graph navigation | 4-level hierarchical drill-down | Phase 45 | Users always know where they are; structured exploration |
| No subspace concept | Container-automatic + custom subspaces | Phase 45 | Graph feels navigable regardless of size |

**Deprecated/outdated after Phase 45:**
- `ClusterMode` type: Not removed, but now accessed via `lens.clusterMode` rather than standalone state
- BrainToolbar cluster toggle buttons: Replaced by LensSelector component
- `useBrainClustering` direct usage in BrainController: Internalized into `useBrainLens`

---

## Open Questions

1. **`containerId` population on non-Actor node types**
   - What we know: `Actor` nodes in Neo4j have `containerIds[]`. `BrainNode.containerId` is set for entity nodes.
   - What's unclear: Objective and Document nodes — do they have `containerId` set? In `useBrainData.ts`, objectives and documents are fetched from separate endpoints that don't include `containerId`.
   - Recommendation: At Level 1 (full brain), container subspace formation should be actor-driven. Objectives/documents can be clustered by their associated actors' containers. Consider adding `containerId` enrichment in the data fetch layer when building subspace node lists.

2. **Double-click event on cluster vs. node in react-force-graph-3d**
   - What we know: `react-force-graph-3d` exposes `onNodeClick` and `onNodeDoubleClick` props.
   - What's unclear: At Level 1, clusters are not "nodes" — they're groups of nodes arranged by force. Double-click on a region requires detecting which cluster the click landed in, not a specific node.
   - Recommendation: Implement double-click on the centroid/representative node of each cluster (the highest-centrality node in the container). This avoids the "click on empty space" problem. Alternatively, use a 2D overlay for cluster hit areas.

3. **SSE notification for smart subspace membership changes**
   - What we know: CONTEXT.md mentions SSE could notify when smart subspace membership changes. SSE streaming exists for ingestion events.
   - What's unclear: Whether the existing SSE infrastructure supports per-subspace events.
   - Recommendation: Defer SSE notifications for Phase 45. Smart subspaces re-evaluate on each data refresh (which already happens via `useBrainIngestion` SSE). Explicit SSE for subspace events is a Phase 46+ enhancement.

---

## Validation Architecture

Config does not set `workflow.nyquist_validation = false`, so validation architecture is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — frontend TypeScript project with no test runner configured |
| Config file | None — Wave 0 must add |
| Quick run command | `npm run typecheck` (TypeScript compile check as proxy) |
| Full suite command | `npm run typecheck && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUB-01 | Container subspaces auto-populate from containerId | manual-only | Visual verification in browser | N/A |
| SUB-02 | Custom lasso subspace saves and reloads | manual-only | Visual verification in browser | N/A |
| SUB-03 | Smart subspace re-evaluates on data update | unit | `npm run typecheck` | Wave 0 type check |
| LENS-01 | Built-in lenses (J2/J3/J5/Overview) apply correct filters | manual-only | Visual verification | N/A |
| LENS-02 | Custom lens saves/loads from PostgreSQL | integration | Requires DB | N/A |
| NHOP-01 | N-hop endpoint returns nodes within hop count | integration | API test against backend | Wave 0 |
| DRILL-01 | 4-level drill-down breadcrumb state correct | unit | `npm run typecheck` (type safety) | Wave 0 |

**Note:** This phase is primarily UI/visual — most correctness verification is manual. TypeScript compile checks catch state shape errors. The critical testable piece is the N-hop backend endpoint.

### Sampling Rate
- **Per task commit:** `npm run typecheck` (in frontend/ directory)
- **Per wave merge:** `npm run typecheck && npm run build`
- **Phase gate:** Full build green + manual smoke test of 4 drill levels before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test runner configured — TypeScript compile is the primary automated check
- [ ] N-hop endpoint: needs integration test stub once endpoint exists

---

## Sources

### Primary (HIGH confidence)
- Codebase: `frontend/src/components/brain/BrainController.tsx` — master state shape
- Codebase: `frontend/src/components/brain/hooks/useBrainClustering.ts` — force application pattern
- Codebase: `frontend/src/components/brain/hooks/useBrainData.ts` — data fetch and node shape
- Codebase: `frontend/src/components/brain/BrainVisualization.tsx` — camera API, Three.js rendering
- Codebase: `frontend/src/components/brain/types.ts` — BrainNode, BrainEdge, ClusterMode types
- Codebase: `backend/src/graph/raft/actor-store.ts` — containerIds[] on Actor, Neo4j Cypher pattern
- Codebase: `backend/src/graph/raft/types.ts` — Actor data model
- Codebase: `backend/src/graph/neo4j-client.ts` — executeReadQuery/executeWriteQuery pattern
- Codebase: `backend/src/api/graph.ts` — existing graph endpoints, workspace-scoped queries
- Codebase: `backend/src/db/migrations/031-brain-annotations-snapshots.sql` — annotation persistence pattern (replicate for lenses/subspaces)
- Codebase: `frontend/src/components/brain/hooks/useBrainAnnotations.ts` — sharing model to replicate
- Phase 45 CONTEXT.md — all locked decisions

### Secondary (MEDIUM confidence)
- Neo4j variable-length path syntax `[*1..$hops]` — standard Cypher, well-documented
- react-force-graph-3d `onNodeDoubleClick` prop — confirmed in library type definitions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire stack is already in use, verified by imports
- Architecture: HIGH — patterns derived directly from existing code
- Pitfalls: HIGH — derived from actual code structure (containerId singular vs plural observed in codebase)
- N-hop Cypher: MEDIUM — standard Cypher syntax but specific query not yet tested against dataset

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable stack, 30-day window)
