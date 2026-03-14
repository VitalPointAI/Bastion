# Phase 45: Knowledge Graph Subspaces - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Manage growing knowledge graphs at scale through container-scoped subgraphs, focus-and-expand interaction patterns, hierarchical drill-down navigation, and virtual lenses. Extends the Phase 41 brain visualization with subspace navigation, progressive data loading, multi-level drill-down, and saveable lens configurations that supersede the existing 3 clustering modes.

</domain>

<decisions>
## Implementation Decisions

### Subspace Definition & Entry
- **Dual subspace model:** containers are automatic subspaces + users can create custom subspaces
- **Custom subspace creation:** both lasso-select-and-save (manual) AND query-based smart subspaces (dynamic membership). Both appear in sidebar tree with a badge indicating type (manual vs smart)
- **Entry methods:** double-click a cluster to dive in AND sidebar tree navigation for browsable overview. Either path enters the same focused view
- **Cross-subspace boundaries:** ghost links — connections to external nodes shown as faded links leading to dimmed external node stubs at the boundary. Shows context without clutter

### Focus-and-Expand Pattern
- **Concentric ring expansion:** click 'expand' to load 1-hop neighbors, click again for 2-hop, etc. Rings radiate outward from focus node — progressive disclosure
- **On-demand backend loading:** each expansion ring triggers a backend query for that node's N-hop neighbors. Essential for scaling to large graphs (500+ nodes)
- **Breadcrumb trail navigation:** bar at top shows path (e.g., 'Full Graph > China subspace > PLA Navy > Admiral Zhang'). Click any crumb to jump back to that level
- **Depth limit:** unlimited expansion with warning past 3 hops ("This may load many nodes"). Let power users go deeper

### Hierarchical Drill-Down
- **4 levels deep:**
  - Level 1: Full brain — all subspaces as clusters
  - Level 2: Inside a subspace — nodes + internal structure
  - Level 3: Node detail — focus + expand neighbors
  - Level 4: Document layer — source documents, evidence trail, extraction history
- **Animated zoom-in transitions:** camera smoothly zooms into selected cluster/node, other elements fade out, new level content fades in. "Diving deeper" feel. Consistent with existing camera zoom-to-node behavior
- **Document layer (Level 4):** hybrid view — mini-constellation in center showing document relationships visually + right panel showing full document details when a doc node is selected
- **Breadcrumbs with counts + icons:** e.g., '🧠 Full Graph (247) > 📦 China (43) > 🔵 PLA Navy (12) > 📄 Documents (5)'. Node count gives scale awareness, icons indicate level type

### Virtual Lenses
- **Lenses supersede cluster modes:** clustering mode becomes one property of a lens (along with filters, visibility, zoom). Current 3 modes (container, DIME, organic) become built-in lenses. No separate 'cluster toggle' vs 'lens selector' — unified concept
- **Role presets + custom lenses:**
  - J2 Intel: adversary entities, intel gaps, OSINT links, confidence overlay
  - J3 Ops: friendly forces, missions, resource connections
  - J5 Plans: objectives hierarchy, DIME themes, strategic linkages
  - Overview: everything visible, container clustering (replaces current default)
- **Lens composition:** saved filter + layout + clustering mode + zoom level + node visibility configuration
- **Scope:** private user lenses + publish-to-share capability. Other users can clone shared lenses to customize. Consistent with Phase 41 annotation sharing model

### Claude's Discretion
- Lens UI placement (toolbar dropdown, sidebar section, or floating panel)
- Smart subspace query syntax/UI design
- Exact animation timing and easing for drill-down transitions
- Backend query optimization for N-hop neighbor loading (Cypher query design)
- Ghost link rendering style (opacity, dash pattern, stub node appearance)
- Sidebar tree component design and collapsibility
- Lens data model and persistence schema
- Performance thresholds for expansion warnings

</decisions>

<specifics>
## Specific Ideas

- Subspaces should feel like "rooms in the brain" — entering one is like walking into a focused area of expertise
- The breadcrumb trail is the primary orientation mechanism — users should always know where they are in the hierarchy
- Ghost links at subspace boundaries convey that the graph is connected even when you're focused on a subset
- Lenses should feel like putting on different glasses to see the same brain from different perspectives — J2 sees threats, J3 sees operations, J5 sees strategy
- Smart subspaces auto-update membership as new nodes matching the query are ingested — "living filters"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BrainVisualization.tsx`: 3D force-graph with shape/color coding, semantic zoom, neighborhood dimming — extend with drill-down and subspace isolation
- `useBrainClustering.ts`: forceX/forceY cluster factories for container/DIME/organic modes — refactor into lens system
- `useBrainData.ts`: Loads 4 API endpoints in parallel, computes eigenvalue centrality — extend with on-demand N-hop loading
- `BrainController.tsx`: Master state container — add drill-down level state, breadcrumb stack, active lens state
- `BrainDetailPanel.tsx`: Node detail view — extend for Level 4 document constellation
- `BrainToolbar.tsx`: Cluster mode toggle — replace with lens selector
- Camera zoom-to-node (BrainVisualization.tsx:476-489): Reuse for drill-down transitions

### Established Patterns
- `containerId` tagging on all Neo4j entities (Phase 25.2/25.3): Foundation for container-as-subspace scoping
- `workspaceId` multi-tenant isolation on all graph queries
- d3-force custom force factories (useBrainClustering.ts:58-104): Pattern for pluggable layout forces
- Annotation sharing model (user-scoped, shareable to problem set): Reuse for lens sharing
- SSE streaming for real-time updates: Could notify when smart subspace membership changes

### Integration Points
- Graph API endpoints (`/api/graph/workspaces/:id/graph`, `/api/graph/actors`): Need new N-hop neighbor endpoint
- Neo4j queries: Need container-scoped subgraph queries and hop-limited traversals
- `BrainController.tsx` state management: Add drill-down stack, active lens, subspace navigation
- `useBrainClustering.ts`: Refactor into lens engine that manages filters + clustering + visibility
- Sidebar (ingestion feed): Add subspace tree navigation alongside or below ingestion feed

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-knowledge-graph-subspaces-container-scoped-subgraphs-focus-and-expand-pattern-hierarchical-drill-down-and-virtual-lenses-for-managing-growing-knowledge-graphs-at-scale*
*Context gathered: 2026-03-13*
