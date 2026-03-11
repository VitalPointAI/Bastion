# Phase 41: Redesign Understanding Tab - Adaptive Brain Visualization - Research

**Researched:** 2026-03-11
**Domain:** React graph visualization, SSE streaming, three-column layout, animated Canvas 2D
**Confidence:** HIGH (codebase verified) / MEDIUM (library capability extensions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Brain Visualization Style**
- Neural network graph metaphor — nodes connected by synaptic links
- Dark space/COP-style background (near-black or deep navy) with glowing nodes and edges
- Shape-coded node types: circles=entities, diamonds=objectives, squares=documents, hexagons=concepts/themes
- Color indicates actor category: ally=blue, adversary=red, neutral=gray, partner=green
- Weighted line edges (thickness = relationship strength) with animated pulses
- Semantic zoom: progressive disclosure from clusters to labels to document details

**Node Composition**
- Everything as nodes: entities, objectives, documents, key concepts with distinct visual types
- All knowledge graph data leveraged — entities, objectives, doc references, DIME/MIDLIFE themes

**Clustering Modes**
- Default: by actor/container (China, US, NATO)
- Toggle modes: by DIME/MIDLIFE theme, force-directed organic
- Each mode is a different lens on the same underlying data

**Three-Column Layout**
- Left sidebar: unified ingestion feed with animated real particle flow into the brain
- Center: brain fills main area, expands when right panel hidden
- Right panel: slides in on node click, shows detail/comparison/annotation views

**Unified Document Ingestion**
- Merge document upload + doc intelligence into ONE pipeline founded on doc intelligence
- Extend to accept multiple files and folders
- Add categorization agent to the doc intelligence AI team
- Training packages fold in under training mode

**Relocated Features**
- Data Sharing/Subscriptions → problem set settings (OUT of Understanding tab)
- AI Context Preview → button → modal → saveable snapshots → source of truth for AI agents

**AI Context Snapshots**
- Summary of strategic environment at brain's current time scale
- Saveable for historical reference
- Any AI agent in BASTION can access saved snapshots

**Interactivity**
- Node click: focus + dim unrelated + open right panel
- Multi-select: shift-click or lasso, right panel shows comparison view
- Search: traditional bar with filters AND natural language queries
- Annotations: flag nodes, add notes, mark relationships questionable; user-scoped with problem-set sharing; audit trail (who/when); included in knowledge context

**Adaptation Behavior**
- Growth-based: sparse empty state → visually denser as docs ingested
- Confidence-based: node brightness/solidity = confidence level
- Intelligence gap detection: hollow/dashed nodes for missing connections + gap summary report
- Conflict handling: AI suggests resolution, human must approve
- Proactive pattern alerts: badges for trends detected across ingestion cycles

**Time Dimension**
- Timeline scrubber at bottom: brain state at any time
- Recency-based cues: vibrant=recent, faded=stale
- Future prediction zone: timeline extends past "now"; ghosted/translucent elements; confidence-based glow intensity

**Animated Data Flow**
- Particle flow from left sidebar into brain
- Particles pass through visual filter/splitter
- Reflects ACTUAL data ingested — not decorative

### Claude's Discretion
- Graph rendering library selection (D3, vis.js, Cytoscape, React Flow, etc.)
- Exact particle animation implementation for ingestion flow
- Clustering algorithm details per mode
- Gap detection heuristics
- Pattern detection algorithm
- Prediction model approach for basic future projections
- Performance optimization (virtualization, WebGL vs. SVG/Canvas)
- Exact spacing, typography, and color values

### Deferred Ideas (OUT OF SCOPE)
- Full predictive scenario modeling with scenario branching, what-if analysis, probability distributions
- Ironclaw deep integration as brain-aware conversational AI in right panel (Phase 29 territory)
</user_constraints>

---

## Summary

Phase 41 is a major visual redesign of the Understanding tab, replacing the sidebar-nav + panel architecture with a three-column, full-screen neural network brain visualization. The brain is the primary interface — a living graph that grows as documents are ingested, confidence-weighted, and time-navigable.

The codebase already has `react-force-graph-2d` (v1.29.0) in production via `GraphExplorer.tsx`, which uses `ForceGraph2D` with custom Canvas 2D node/link renderers. This is the foundational rendering primitive for the brain — it is already proven, integrated, and has the API surface needed for shape-coded nodes, custom edge rendering, and Canvas animations. The brain visualization is an evolution of `GraphExplorer`, not a replacement with a different library.

The backend already exposes the knowledge graph via `/api/graph/workspaces/:id/graph` returning nodes + edges, actors via `/api/graph/actors`, objectives via `/api/graph/validity/objectives`, centrality via `/api/graph/centrality-comparison`, and graph building from doc ingestion. The doc intelligence pipeline already uses SSE streaming (`useDocProcessing` hook + `EventSource`), which is the exact mechanism needed for the animated particle flow. The core challenge is: (1) extending the `ForceGraph2D` renderer for the brain's visual vocabulary (shapes, glow, pulsing edges, ghosted future nodes), (2) building the three-column layout shell, and (3) wiring the left ingestion sidebar to emit real-time particle events that animate into the brain.

**Primary recommendation:** Extend `GraphExplorer.tsx` patterns with enhanced Canvas 2D drawing for shape-coded nodes, animated edges, and particle effects. Build the three-column layout as a new `BrainLayout` component replacing `TabLayout` only in `UnderstandTab`. Use existing SSE infrastructure for ingestion feed. Keep all data fetched from existing `/api/graph/*` endpoints.

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-force-graph-2d` | ^1.29.0 | Force-directed graph engine with Canvas 2D renderer | Already in project, proven in `GraphExplorer`, exposes `nodeCanvasObject` and `linkCanvasObject` for full custom drawing |
| React | ^19.2.0 | UI framework | Project standard |
| TypeScript | project-standard | Type safety | Project standard |

### Supporting (already in project or standard Canvas 2D)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Canvas 2D API | browser-native | Shape-coded nodes (arc, polygon paths), glow effects (shadowBlur), animated particles | All node/link custom rendering inside `nodeCanvasObject` / `linkCanvasObject` callbacks |
| `requestAnimationFrame` | browser-native | Smooth particle animations for ingestion flow | Left sidebar particle animation loop, edge pulse animation |
| `useRef` + `ForceGraphMethods` | react-force-graph-2d | Programmatic zoom, pan, node positioning control | Timeline scrubber causing brain to rerender at historical state |
| SSE / `EventSource` | browser-native | Real-time ingestion events for particle flow | Already used in `useDocProcessing`; extend to emit brain-ingest events |

### New Additions Needed

| Library | Version | Purpose | Justification |
|---------|---------|---------|---------------|
| None required | — | — | All visualization primitives achievable with existing stack + Canvas 2D |

**Installation:** No new packages required. All necessary libraries are already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-force-graph-2d` (Canvas) | Cytoscape.js | Cytoscape has richer built-in layout algorithms but Canvas renderer is more performant for >500 nodes; project already has react-force-graph-2d wired up |
| `react-force-graph-2d` (Canvas) | `@react-three/fiber` + Three.js | WebGL for extreme performance (10k+ nodes), but adds significant bundle size and 3D complexity that is overkill for this use case |
| `react-force-graph-2d` (Canvas) | D3-force directly | D3 gives more control but requires wiring React reconciliation manually; react-force-graph-2d already handles this |
| CSS/SVG particle animation | Canvas 2D `requestAnimationFrame` | SVG particles would cause layout thrashing at high frequency; Canvas loop is performant |

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/components/brain/
├── BrainLayout.tsx              # Three-column shell (replaces TabLayout for UnderstandTab)
├── BrainLayout.css
├── BrainVisualization.tsx       # Core graph canvas (extends GraphExplorer patterns)
├── BrainVisualization.css
├── IngestionSidebar.tsx         # Left column: unified ingestion feed + particle emitter
├── IngestionSidebar.css
├── BrainDetailPanel.tsx         # Right column: slides in on node click
├── BrainDetailPanel.css
├── BrainTimeline.tsx            # Bottom: time scrubber + future zone
├── BrainTimeline.css
├── BrainSearch.tsx              # Search bar + NL query input
├── NodeAnnotationPanel.tsx      # Annotation form + list in right panel
├── AIContextSnapshotModal.tsx   # AI context preview → modal → save
├── hooks/
│   ├── useBrainData.ts          # Fetches nodes/edges from /api/graph/*; merges entity/objective/doc node types
│   ├── useBrainIngestion.ts     # Manages SSE feed for particle emission events
│   ├── useBrainTimeline.ts      # Timeline state, historical graph state queries
│   ├── useBrainAnnotations.ts   # CRUD for node annotations via new /api/brain/annotations
│   └── useBrainClustering.ts   # Clustering mode logic (by container, DIME, organic)
├── renderers/
│   ├── nodeRenderer.ts          # Canvas 2D shape-coded node drawing functions
│   ├── edgeRenderer.ts          # Edge thickness, pulse animation, conflict styling
│   └── particleRenderer.ts     # Left-to-brain particle animation
└── index.ts
```

Changes to existing files:
- `frontend/src/components/tabs/UnderstandTab.tsx` — replace `TabLayout` with `BrainLayout`, remove sidebar nav
- Backend: `backend/src/api/brain.ts` — new routes for annotations, snapshots, gap detection, pattern alerts, ingestion events feed
- Backend: `backend/src/doc-intelligence/specialists/` — add `categorization-agent.ts` specialist

### Pattern 1: Shape-Coded Canvas Node Rendering

**What:** Custom `nodeCanvasObject` draws different shapes based on node type using Canvas 2D path APIs, with confidence-based glow via `ctx.shadowBlur`.

**When to use:** All brain node rendering. The `nodeCanvasObject` callback receives `(node, ctx, globalScale)` and replaces the default circle entirely.

**Example:**
```typescript
// Extends pattern from /frontend/src/components/graph/GraphExplorer.tsx
function drawNode(
  node: BrainNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  isSelected: boolean,
  animFrame: number
) {
  const { x, y, type, confidence, actorCategory, isGap } = node;
  const baseRadius = 6;
  const r = isSelected ? baseRadius * 1.4 : baseRadius;

  // Confidence-based glow
  ctx.shadowColor = CATEGORY_COLORS[actorCategory] ?? '#4a9eff';
  ctx.shadowBlur = isGap ? 0 : (confidence ?? 0.5) * 20;

  ctx.beginPath();
  switch (type) {
    case 'entity':
      ctx.arc(x, y, r, 0, Math.PI * 2); // circle
      break;
    case 'objective':
      drawDiamond(ctx, x, y, r);         // diamond
      break;
    case 'document':
      drawSquare(ctx, x, y, r);          // square
      break;
    case 'concept':
      drawHexagon(ctx, x, y, r);         // hexagon
      break;
  }

  if (isGap) {
    ctx.setLineDash([3 / globalScale, 3 / globalScale]);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1 / globalScale;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = CATEGORY_COLORS[actorCategory] ?? '#4a9eff';
    ctx.fill();
  }

  ctx.shadowBlur = 0; // reset after each node
}
```

### Pattern 2: SSE-Driven Particle Animation

**What:** The left ingestion sidebar maintains a list of "particles in flight" — small glowing dots that animate from the sidebar → brain on each ingestion event. Uses `requestAnimationFrame` loop coordinated with the ingestion SSE stream.

**When to use:** Anytime a document is being processed or a node is added to the brain.

**Key insight:** Particle positions are stored in a React ref (not state) to avoid re-renders on each animation frame. The Canvas `requestAnimationFrame` loop reads the ref directly.

```typescript
// useBrainIngestion.ts pattern
const particlesRef = useRef<Particle[]>([]);
const animFrameRef = useRef<number>(0);

// On SSE 'node:added' event from doc intelligence:
es.addEventListener('node:added', (e: MessageEvent) => {
  const { nodeId, nodeType } = JSON.parse(e.data);
  // Emit particle from sidebar exit point toward where node will appear in brain
  particlesRef.current.push({
    id: crypto.randomUUID(),
    x: SIDEBAR_EXIT_X,
    y: SIDEBAR_EXIT_Y,
    targetNodeId: nodeId,
    color: NODE_TYPE_COLORS[nodeType],
    alpha: 1,
    born: performance.now(),
  });
});

// Animation loop (runs on separate canvas overlaid on the layout)
function animateParticles(timestamp: number) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particlesRef.current = particlesRef.current
    .map(p => moveParticleTowardTarget(p, timestamp))
    .filter(p => p.alpha > 0);
  particlesRef.current.forEach(p => drawParticle(ctx, p));
  animFrameRef.current = requestAnimationFrame(animateParticles);
}
```

### Pattern 3: Clustering Mode Toggle

**What:** Three clustering modes on the same force graph. Mode switch replaces d3 force parameters and groups nodes by different attributes. `react-force-graph-2d` exposes `d3Force` access for custom forces.

**When to use:** User clicks a mode toggle button; the graph reheats and reflows.

```typescript
// useBrainClustering.ts
type ClusterMode = 'container' | 'dime' | 'organic';

function applyClusterMode(fg: ForceGraphMethods, nodes: BrainNode[], mode: ClusterMode) {
  if (mode === 'container') {
    // Group nodes by actorContainer using custom forceX/forceY pulling to container centroids
    fg.d3Force('x', d3ForceX((n: BrainNode) => containerCentroid(n.containerId).x).strength(0.3));
    fg.d3Force('y', d3ForceY((n: BrainNode) => containerCentroid(n.containerId).y).strength(0.3));
  } else if (mode === 'dime') {
    fg.d3Force('x', d3ForceX((n: BrainNode) => dimeCentroid(n.dimeCategory).x).strength(0.3));
    fg.d3Force('y', d3ForceY((n: BrainNode) => dimeCentroid(n.dimeCategory).y).strength(0.3));
  } else {
    fg.d3Force('x', null);
    fg.d3Force('y', null);
  }
  fg.d3ReheatSimulation();
}
```

Note: `d3-force` is a peer dependency of `react-force-graph-2d` and can be imported directly: `import { forceX, forceY } from 'd3-force'`.

### Pattern 4: Semantic Zoom with Progressive Disclosure

**What:** Labels and secondary nodes only appear above certain zoom levels. The `globalScale` parameter in `nodeCanvasObject` represents current zoom level. Below threshold: show only major nodes (high centrality / high confidence). Above threshold: show labels, smaller nodes. Further zoom: show document detail overlay.

**When to use:** All node rendering — always check `globalScale`.

```typescript
const ZOOM_LABEL_THRESHOLD = 1.5;
const ZOOM_SECONDARY_THRESHOLD = 0.8;

// In nodeCanvasObject:
const showLabel = globalScale > ZOOM_LABEL_THRESHOLD;
const showNode = globalScale > ZOOM_SECONDARY_THRESHOLD || node.centrality > 0.5;
if (!showNode) return; // skip secondary nodes when zoomed out
```

### Pattern 5: Three-Column Layout Shell

**What:** CSS Grid three-column layout. Left sidebar is fixed width (compact). Center expands. Right panel uses CSS transitions for slide-in behavior.

```css
.brain-layout {
  display: grid;
  grid-template-columns: 280px 1fr auto;
  grid-template-rows: 1fr auto; /* main + timeline scrubber */
  height: 100%;
  background: #020810; /* near-black deep navy */
  overflow: hidden;
}

.brain-right-panel {
  width: 0;
  overflow: hidden;
  transition: width 0.25s ease;
}
.brain-right-panel.open {
  width: 380px;
}
```

### Pattern 6: Timeline Scrubber

**What:** Bottom bar with a range input. Scrubbing fetches historical graph state from a new backend endpoint that returns nodes/edges as they existed at a given timestamp (using `createdAt` on actors/relationships).

**When to use:** Temporal brain state navigation.

```typescript
// useBrainTimeline.ts
async function fetchGraphAtTime(problemSetId: string, timestamp: Date) {
  const res = await fetch(
    `/api/brain/graph-snapshot?problemSetId=${problemSetId}&at=${timestamp.toISOString()}`
  );
  return res.json(); // { nodes, edges } filtered by createdAt <= timestamp
}
```

### Anti-Patterns to Avoid

- **Setting particle positions in React state:** Will re-render on every animation frame (60fps × particle count = thousands of re-renders). Use refs + Canvas imperative drawing.
- **Fetching all graph data on every clustering mode switch:** Cache the full graph data; only change force parameters.
- **Resetting `ctx.shadowBlur` inside a tight loop:** Always reset to 0 after each node with glow to prevent glow bleeding onto adjacent canvas elements.
- **Using `nodeCanvasObjectMode` returning `'replace'` when you want to add a label below:** Use `'after'` if you want to draw additional content after the default render, or `'replace'` for full custom control (which is what the brain needs).
- **Encoding temporal graph state in the frontend only:** Historical state must come from the backend with proper `createdAt` filtering — client-side filtering of a cached full graph will be inconsistent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force-directed layout physics | Custom spring simulation | `react-force-graph-2d` d3-force engine | Correct Barnes-Hut approximation, stable, tunable via `d3AlphaDecay` / `d3VelocityDecay` |
| Canvas mouse hit-testing for shaped nodes | Custom polygon hit-test geometry | `react-force-graph-2d` built-in `nodeRelSize` + `onNodeClick` | Library handles hit detection, including custom shapes if `nodePointerAreaPaint` callback is set |
| Zoom/pan implementation | Custom mouse event handling | `react-force-graph-2d` built-in `enableZoomInteraction` / `enablePanInteraction` | Handles pinch-zoom, scroll-wheel, inertia correctly |
| Graph layout clustering algorithms | Custom force-directed grouping | d3-force `forceX` / `forceY` with group centroids | d3-force is already a dependency; group forces are standard pattern |

**Key insight:** Custom Canvas 2D drawing within `react-force-graph-2d` callbacks is the right boundary — use the library for layout physics, hit testing, and zoom/pan; use raw Canvas 2D for visual appearance (shapes, glow, labels, animations).

---

## Existing Code: What to Reuse vs Replace

### Reuse Unchanged
| Component | Location | Role in Phase 41 |
|-----------|----------|-----------------|
| `DocIntelligencePanel` pipeline (MissionControl, ProcessingFeed, ScopingInterview, NATORatingPanel, IntelligenceReport) | `frontend/src/components/doc-intelligence/` | Foundation for unified ingestion left sidebar — wire into `IngestionSidebar.tsx` |
| `useDocProcessing` SSE hook | `frontend/src/hooks/useDocProcessing.ts` | Reuse SSE event parsing; extend to emit particle events to brain |
| `NodeDetailPanel` | `frontend/src/components/graph/NodeDetailPanel.tsx` | Embed as content in `BrainDetailPanel.tsx` right panel |
| `StrategicContextPreview` | `frontend/src/components/strategic/StrategicContextPreview.tsx` | Becomes the content of `AIContextSnapshotModal.tsx` |
| `useMode()` | `frontend/src/context/ModeContext.tsx` | Training mode integration for training package ingestion |
| `ActorCategoryBadge`, `ContainerManager`, container model | `frontend/src/components/strategic/` | Actor category colors + container grouping for default cluster mode |
| `DecisionGateBanner`, `GateSubmitButton`, `DecisionGateTimeline` | `frontend/src/components/governance/` | Keep in brain tab header area |
| `InheritedContextSection` | `frontend/src/components/inheritance/` | Keep above brain layout |
| `/api/graph/workspaces/:id/graph` endpoint | `backend/src/api/graph.ts` | Primary data source for brain nodes/edges |
| `/api/graph/actors`, `/api/graph/tensions` | `backend/src/api/graph.ts` | Supplemental node data |
| `/api/graph/centrality-comparison` | `backend/src/api/graph.ts` | Node importance for semantic zoom prioritization |

### Replace/Retire
| Component | Location | What Replaces It |
|-----------|----------|-----------------|
| `UnderstandTab` sidebar nav (TabLayout) | `frontend/src/components/tabs/UnderstandTab.tsx` | `BrainLayout` three-column shell |
| `SubscriptionManager` view in Understanding tab | `frontend/src/components/problem-set/SubscriptionManager.tsx` | Moves to problem set settings (out of this tab entirely) |
| `TrainingPackagesView` as separate nav item | `frontend/src/components/tabs/TrainingPackagesView.tsx` | Folded into unified ingestion sidebar under training mode |

### Extend
| Component | Extension Needed |
|-----------|----------------|
| `GraphExplorer.tsx` | Patterns extracted into `BrainVisualization.tsx` with shape-coded nodes, confidence glow, gap nodes, animated edges, future-zone ghosting, lasso select, semantic zoom |
| `useDocProcessing.ts` | Add `onNodeAdded` callback or new event type to emit particle events when graph entities are created |
| Backend doc intelligence orchestrator | Add categorization agent specialist |

---

## Common Pitfalls

### Pitfall 1: Canvas Glow Bleeding Between Nodes
**What goes wrong:** `ctx.shadowBlur` on a glowing node affects the next node drawn in the same `nodeCanvasObject` call sequence because Canvas state is shared.
**Why it happens:** Canvas 2D drawing state is global — `shadowBlur` is not automatically reset between `nodeCanvasObject` calls.
**How to avoid:** Always set `ctx.shadowBlur = 0` and `ctx.shadowColor = 'transparent'` at the end of every node draw call.
**Warning signs:** All nodes appear to have a faint glow regardless of confidence value.

### Pitfall 2: Particle Animation Causes React Re-renders
**What goes wrong:** Storing particle positions in React state causes 60fps re-renders of the entire brain component tree.
**Why it happens:** `useState` triggers React's reconciliation loop.
**How to avoid:** Store particle array in `useRef`. Draw particles on a separate `<canvas>` overlay using `requestAnimationFrame`. Never call `setState` in the animation loop.
**Warning signs:** React DevTools shows BrainVisualization re-rendering 60 times/second even without user interaction.

### Pitfall 3: `react-force-graph-2d` `width` Prop Causes Layout Jitter
**What goes wrong:** Passing `width={undefined}` to `ForceGraph2D` makes it unresponsive to container size changes; passing a pixel value causes mismatch when the right panel slides in.
**Why it happens:** The library measures width from a prop, not the DOM. See existing `GraphExplorer.tsx` — it passes `width={undefined}`.
**How to avoid:** Use `ResizeObserver` to detect container width changes and pass the value explicitly; or use the `ref` approach and call `fg.width()` setter. When right panel opens/closes, update the width after the CSS transition completes.
**Warning signs:** Graph canvas extends behind or falls short of the right panel boundary.

### Pitfall 4: Historical Graph State Complexity
**What goes wrong:** Attempting to reconstruct historical graph state from a cached full dataset by filtering on `createdAt` in the frontend results in missing relationship data (relationships reference actors that may not yet exist at that timestamp).
**Why it happens:** Graph data has referential integrity — an edge is only valid if both its source and target actors existed at that time.
**How to avoid:** Implement a backend endpoint `GET /api/brain/graph-snapshot?at=ISO_TIMESTAMP` that runs a single SQL/Cypher query filtering both nodes and edges by `createdAt <= at`.
**Warning signs:** Timeline scrubber shows orphaned edges pointing to non-existent nodes.

### Pitfall 5: Lasso Selection Without a Separate Interaction Canvas
**What goes wrong:** Trying to implement lasso selection inside `ForceGraph2D`'s canvas conflicts with the library's built-in pan gesture.
**Why it happens:** `ForceGraph2D` captures mouse events on its canvas for pan/zoom. A lasso overlay listening to the same events will conflict.
**How to avoid:** Add a transparent `<div>` overlay above the graph canvas for lasso interaction, positioned absolutely. Disable pan during lasso mode (`enablePanInteraction={!isLassoing}`), then re-enable when done.
**Warning signs:** Lasso gesture causes the graph to pan instead of drawing the selection box.

### Pitfall 6: `workspaceId` vs `problemSetId` Semantic Mismatch
**What goes wrong:** The backend graph API uses `workspaceId` to scope actors/relationships (holdover from old naming), while the frontend consistently uses `problemSetId`.
**Why it happens:** Phase 23 renamed "workspace" → "problem set" in the UI but the graph API was not fully updated.
**How to avoid:** When calling `/api/graph/actors?workspaceId=X`, pass the `problemSetId` value — they refer to the same entity. Document this in the data hooks.
**Warning signs:** Graph appears empty even though actors exist in the database.

### Pitfall 7: Confidence-Based Glow Requiring Real Data
**What goes wrong:** Confidence values only exist on `strategic_objectives` (via `extraction_confidence`) and validity scores, not on all actor nodes.
**Why it happens:** The graph was built before confidence-based rendering was needed.
**How to avoid:** In `useBrainData.ts`, compute a proxy confidence for actor nodes based on: number of source documents (more = higher), relationship count, and validity score if available. Document this clearly as a derived metric.
**Warning signs:** All actor nodes glow at the same brightness regardless of data quality.

---

## Code Examples

### Existing GraphExplorer ForceGraph2D Configuration (reference baseline)
```typescript
// Source: /frontend/src/components/graph/GraphExplorer.tsx
<ForceGraph2D
  ref={fgRef}
  graphData={graphData}
  nodeCanvasObject={nodeCanvasObject}
  linkCanvasObject={linkCanvasObject}
  onNodeClick={handleNodeClick}
  onNodeHover={node => setHoveredNode(node as GraphNode | null)}
  onEngineStop={handleEngineStop}
  nodeId="id"
  linkSource="source"
  linkTarget="target"
  width={undefined}
  height={height}
  backgroundColor="transparent"
  enableZoomInteraction={true}
  enablePanInteraction={true}
  enableNodeDrag={false}
  warmupTicks={200}
  cooldownTicks={50}
  d3AlphaDecay={0.05}
  d3VelocityDecay={0.4}
/>
```

### Backend Graph Data Endpoint (actors as nodes + edges)
```typescript
// Source: /backend/src/api/graph.ts line 446-479
// GET /api/graph/workspaces/:id/graph
// Returns: { nodes: [{id, label, type, workspaceId}], edges: [{source, target, type, strength}] }
```

### SSE Pattern for Ingestion Events
```typescript
// Source: /frontend/src/hooks/useDocProcessing.ts line 156-158
const url = `${API_BASE}/api/doc-intelligence/process/${encodeURIComponent(problemSetId)}/stream/${encodeURIComponent(pid)}`;
const es = new EventSource(url);
// Events: specialist:start, specialist:complete, node:added (NEW — to be added by Phase 41)
```

### Actor Store Scoping Pattern
```typescript
// Source: /backend/src/graph/raft/actor-store.ts
// actors are scoped by workspaceId (= problemSetId)
// GET /api/graph/actors?workspaceId={problemSetId}
// The "workspaceId" query param == problemSetId — same entity, legacy naming
```

---

## Backend Changes Required

### New Endpoints Needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/brain/graph-snapshot` | GET | Historical graph state at timestamp — nodes/edges filtered by `createdAt <= at` |
| `/api/brain/annotations` | GET/POST/PUT/DELETE | Node annotations (flag, note, questionable); user-scoped, problem-set-shareable, audit-trailed |
| `/api/brain/snapshots` | GET/POST | AI context snapshots (save + list) |
| `/api/brain/gaps` | GET | Intelligence gap report — nodes where expected connections are missing based on heuristics |
| `/api/brain/pattern-alerts` | GET | Proactive AI pattern detections across ingestion cycles |

### Extended Endpoints

| Endpoint | Change | Reason |
|----------|--------|--------|
| `/api/graph/workspaces/:id/graph` | Add `objectives`, `documents`, `concepts` node types to response | Currently returns only actors — brain needs all node types |
| `/api/doc-intelligence/process/:id/stream/:pid` (SSE) | Add `node:added` event | Brain particle animation requires knowing when nodes enter the graph |

### New Specialist Agent

The doc intelligence team needs a `categorization-agent` specialist that:
- Assigns DIME/MIDLIFE theme categories to extracted objectives
- Tags documents with container/actor associations for default cluster mode
- Must emit SSE events for progress tracking

Location: `backend/src/doc-intelligence/specialists/categorization-agent.ts`

---

## Data Model: Brain Node Types

The brain unifies four data sources into a single graph node representation:

```typescript
type BrainNodeType = 'entity' | 'objective' | 'document' | 'concept';

interface BrainNode {
  id: string;
  label: string;
  type: BrainNodeType;
  // Actor category (for entities): ally, adversary, neutral, partner
  actorCategory?: 'ally' | 'adversary' | 'neutral' | 'partner';
  // Clustering attributes
  containerId?: string;          // for container clustering mode
  dimeCategory?: string;         // for DIME/MIDLIFE clustering mode
  // Visualization state
  confidence: number;            // 0-1, drives glow intensity
  isGap?: boolean;               // hollow/dashed rendering
  isFuturePrediction?: boolean;  // ghosted/translucent rendering
  predictionConfidence?: number; // 0-1, future zone glow intensity
  // Temporal
  createdAt: string;
  // Source
  sourceDocumentIds?: string[];
  validityScore?: number;
}
```

Data sources per node type:
- `entity` → from `/api/graph/actors` (Neo4j)
- `objective` → from `/api/graph/validity/objectives` (PostgreSQL `strategic_objectives`)
- `document` → from `/api/doc-intelligence/documents/:problemSetId` (PostgreSQL `strategic_documents`)
- `concept` → from DIME/MIDLIFE theme extraction (PostgreSQL `strategic_objectives.midlife_category`)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Understanding tab: sidebar nav + separate content panels | Brain visualization as primary interface; three-column layout | Complete visual paradigm shift |
| Graph shows only actors (entities) | All knowledge types as nodes: entities, objectives, documents, themes | Richer graph, more connections |
| Static document list + doc intelligence separate views | Unified ingestion pipeline with live particle animation | Real-time feedback loop visible |
| AI Context Preview as separate nav item | Button → modal → saveable snapshots available to all AI agents | Cross-agent source of truth |
| Data Sharing in Understanding tab | Moved to problem set settings | Cleaner separation of concerns |

---

## Open Questions

1. **`workspaceId` vs `problemSetId` in graph API**
   - What we know: Actor store uses `workspaceId`; Understanding tab uses `problemSetId`. They are the same value.
   - What's unclear: Whether the graph problem-set store (`/backend/src/graph/problem-set/store.ts`) uses a separate ID from the main problem set table, or if they share the same ID.
   - Recommendation: Verify in `graph-problem-set` store schema before building `useBrainData.ts` to confirm the join key.

2. **Lasso multi-select performance with large graphs**
   - What we know: `react-force-graph-2d` doesn't expose a native lasso API. The implementation requires a transparent overlay div + hit-test all nodes against the lasso polygon on mouse-up.
   - What's unclear: Performance of hit-testing hundreds of nodes against a polygon — may need spatial index if graph grows large.
   - Recommendation: Start with brute-force O(n) hit test; profile with >500 nodes before optimizing to quadtree.

3. **Future prediction node sourcing**
   - What we know: The CONTEXT.md says "basic trend-based predictions." The backend has `briefing/predictive-service.ts` already.
   - What's unclear: Whether `predictive-service.ts` outputs graph node predictions or text-based briefings.
   - Recommendation: Read `predictive-service.ts` during planning to determine if it can emit future node/edge predictions or if a new prediction endpoint is needed.

4. **Annotation backend: graph DB vs PostgreSQL**
   - What we know: Annotations are user-scoped, problem-set-shareable, require audit trails.
   - What's unclear: Should annotations live in Neo4j (attached to actor nodes) or PostgreSQL (relational, easier audit trail)?
   - Recommendation: PostgreSQL. Audit trails (who/when), sharing scopes, and querying by user are all relational concerns. A `brain_annotations` table with `node_id`, `node_type`, `annotation_type`, `content`, `created_by`, `problem_set_id`, `is_shared`, `created_at`.

5. **`nodePointerAreaPaint` for custom shapes**
   - What we know: `react-force-graph-2d` uses default circular hit areas even when `nodeCanvasObject` draws non-circular shapes (diamonds, hexagons).
   - What's unclear: Whether the current installed version (1.29.0) supports `nodePointerAreaPaint` for custom hit areas on shaped nodes.
   - Recommendation: Check the `react-force-graph-2d` 1.29.0 API at build time. If `nodePointerAreaPaint` is not available, use `nodeRelSize` with large enough circular hit area that covers the shape bounding box.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `/frontend/src/components/graph/GraphExplorer.tsx` — actual `react-force-graph-2d` integration pattern in use
- Codebase: `/frontend/src/hooks/useDocProcessing.ts` — SSE pattern for real-time streaming
- Codebase: `/backend/src/api/graph.ts` — all available graph API endpoints
- Codebase: `/frontend/package.json` — confirmed `react-force-graph-2d: ^1.29.0` installed
- Codebase: `/frontend/src/components/tabs/UnderstandTab.tsx` — current tab architecture to be replaced
- Codebase: `/backend/src/graph/raft/actor-store.ts` — `workspaceId` scoping confirmed

### Secondary (MEDIUM confidence)
- `react-force-graph-2d` npm package — confirmed Canvas 2D with `nodeCanvasObject`, `linkCanvasObject`, `nodePointerAreaPaint`, `d3Force()` access (training knowledge, v1.29 matches)
- Canvas 2D API — `shadowBlur` for glow effects, polygon path APIs for shape drawing (MDN standard)
- d3-force API — `forceX`, `forceY` for clustering (d3 is peer dep of react-force-graph-2d)

### Tertiary (LOW confidence)
- `react-force-graph-2d` v1.29 specific feature list for `nodePointerAreaPaint` — needs verification at build time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from actual package.json and GraphExplorer.tsx in codebase
- Architecture: HIGH — derived from existing patterns in codebase (SSE, Canvas 2D, three-column CSS Grid)
- Pitfalls: HIGH — Canvas glow bleeding, React state in animation loops, zoom width jitter all verified from general Canvas 2D + react-force-graph-2d behavior
- Data model: HIGH — verified from actual backend schemas (actor store, objective store, strategic documents)
- Open questions: MEDIUM — identified from code inspection but not fully resolved

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable libraries — react-force-graph-2d, Canvas 2D API)
