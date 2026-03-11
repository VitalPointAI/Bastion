# Phase 41: Redesign Understanding Tab - Adaptive Brain Visualization - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the Understanding tab from a sidebar-driven view list into a neural network brain visualization centerpiece. The brain visualizes the strategic environment as a living, adaptive graph fed by a unified ingestion pipeline. Current siloed views (Strategic Documents, Doc Intelligence, Training Packages) are replaced by the brain as the primary interface, with ingestion on the left and contextual detail panels on the right.

</domain>

<decisions>
## Implementation Decisions

### Brain Visualization Style
- Neural network graph metaphor — nodes connected by synaptic links showing relationships
- Dark space/COP-style background (near-black or deep navy) with glowing nodes and edges
- Shape-coded node types: circles for entities, diamonds for objectives, squares for documents, hexagons for concepts/themes
- Color indicates actor category: ally=blue, adversary=red, neutral=gray, partner=green
- Weighted line edges (thickness = relationship strength) with animated pulses showing activity/recency
- Semantic zoom: zoomed out shows clusters and major nodes only, zoom in reveals labels, secondary nodes, then document details (progressive disclosure like maps)

### Node Composition
- Everything as nodes: entities, objectives, documents, and key concepts all appear with distinct visual types
- All knowledge graph data leveraged — entities, objectives, doc references, DIME/MIDLIFE themes

### Clustering Modes
- Default clustering: by actor/container (China, US, NATO, etc.) — matches existing container model
- Toggle to switch views: by actor/container, by DIME/MIDLIFE theme, force-directed organic
- Each mode provides a different lens on the same data

### Three-Column Layout
- **Left sidebar (always visible, compact):** Unified ingestion feed showing all data sources (document upload, OSINT, subscriptions) as one pipeline with source type as a filter tag. Constant animated flow of information — particles pass through a visual filter/splitter before flowing into the brain. Animation reflects ACTUAL data being ingested, not simulated.
- **Center (brain):** Neural network graph fills the main content area. Expands when right panel is hidden.
- **Right panel (hidden until needed):** Appears when user clicks a node or interacts with Ironclaw. Slides in from right. Shows detail views, comparisons, annotation tools.

### Unified Document Ingestion
- Merge document upload and doc intelligence pipeline into ONE document ingestion feature founded on the doc intelligence pipeline
- Extend to accept multiple files and folders
- Add a categorization agent to the document intelligence AI team
- Training packages fold into the unified ingestion when in training mode

### Relocated Features
- Data Sharing/Subscriptions → moves to problem set settings area
- AI Context Preview → becomes a button that opens a modal with full strategic environment summary based on the brain's current time scale

### AI Context Snapshots
- AI Context Preview modal provides summary of entire strategic environment at the brain's current time scale
- Snapshots can be saved for historical reference
- Any AI agent in BASTION can access saved snapshots as source of truth for situational awareness/analysis

### Interactivity
- **Node click:** Focus + context — dims unrelated nodes, highlights selected node's neighborhood (connected nodes + edges), AND opens right detail panel
- **Multi-select:** Shift-click or lasso to select multiple nodes. Right panel shows comparison view with shared connections, differences, bulk annotation
- **Search:** Both traditional search bar with filters (node type, actor category, DIME theme) AND Ironclaw natural language queries ("Show me everything related to China's naval capabilities")
- **Annotations:** Users can flag nodes as important, add notes, mark relationships as questionable. Annotations are user-scoped with ability to share (make visible) to anyone in the problem set. Audit trail required — who, when. Annotations included in knowledge context used throughout the problem set.

### Adaptation Behavior
- **Growth-based:** Brain starts sparse and grows as documents are ingested. New nodes/connections appear with animation. Visual density reflects how much the system "understands." Empty brain = fresh problem set.
- **Confidence-based:** Node brightness/solidity reflects confidence. Well-sourced areas glow brighter, uncertain/single-source areas are dim. Shows where understanding is strong vs. weak.
- **Intelligence gap detection:** Visual gap indicators (hollow/dashed nodes where expected connections are missing) AND gap summary report accessible from the brain UI. Shows "what we don't know."
- **Conflict handling:** Conflicting intelligence flagged visually. AI provides recommended resolution with reasoning, but human must approve. Balances automation with human judgment.
- **Proactive pattern alerts:** AI detects trends and patterns across ingestion cycles and proactively surfaces them as notifications/badges (e.g., "China military activity increased 40% in last 3 ingestion cycles").

### Time Dimension
- **Timeline scrubber** at the bottom — scrub through time to see brain state at any point. Brain morphs to show what was known then vs. now. Useful for briefings and after-action review.
- **Recency-based visual cues** in current view — recent intelligence is vibrant, stale information fades
- **Future prediction zone:** Timeline extends past "now" into a future zone with basic AI predictions
  - Predicts likely new connections AND activity trend projections
  - Future elements shown as ghosted/translucent with dashed outlines
  - Glow intensity reflects prediction confidence — high-confidence predictions are brighter ghosts, uncertain ones barely visible
  - Predictions based on detected patterns in ingestion history

### Animated Data Flow
- Constant animated particle flow from left ingestion sidebar into the brain
- Particles pass through a visual filter/splitter before entering the graph
- Reflects ACTUAL data being ingested — not simulated/decorative animation
- New nodes appear with animation as they are placed in the graph

### Claude's Discretion
- Graph rendering library selection (D3, vis.js, Cytoscape, React Flow, etc.)
- Exact particle animation implementation for ingestion flow
- Clustering algorithm details per mode
- Gap detection heuristics
- Pattern detection algorithm
- Prediction model approach for basic future projections
- Performance optimization (virtualization, WebGL vs. SVG/Canvas)
- Exact spacing, typography, and color values

</decisions>

<specifics>
## Specific Ideas

- The left sidebar shows a constant animated flow of real data being ingested — particles pass through a visual filter before flowing into the brain. This is not decorative; it represents actual processing.
- "I want it like a living brain that grows as you feed it intelligence" — the empty state for a fresh problem set should be a sparse, nearly empty neural network that visually grows denser as documents are processed.
- Data sharing moves to problem set settings — not part of the Understanding tab anymore.
- AI Context Preview becomes a button → modal → saveable snapshots → source of truth for all BASTION AI agents.
- Timeline should eventually support future predictions (basic version in this phase, more sophisticated prediction engine in future phase).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabLayout` component: Current sidebar + content layout — will be replaced but pattern is understood
- `DocIntelligencePanel` + pipeline (MissionControl, ProcessingFeed, ScopingInterview, NATORatingPanel, IntelligenceReport): Foundation for unified ingestion
- `StrategicDashboard` + container system (ContainerManager, ContainerBrowser, ContainerCard, ActorCategoryBadge): Actor/container data model for default clustering
- `StrategicContextPreview`: Basis for the snapshot modal feature
- `InheritedContextSection`: Cross-problem-set context display — may integrate with brain
- Knowledge graph infrastructure from Phase 25.3: Graph data, centrality analysis, temporal boosting
- Entity resolution tools: search_entities, merge_entities, entity registry
- Decision gate components: Can integrate into brain workflow

### Established Patterns
- Sidebar navigation via TabLayout — will be replaced with three-column layout
- Mode-aware rendering (training vs. operational) via `useMode()` context
- SSE streaming for real-time processing updates (used in doc intelligence)
- Problem set scoping via `problemSetId` prop pattern
- Container/actor categorization model (ally, adversary, neutral, partner)

### Integration Points
- `ProblemSetTabContainer` renders `UnderstandTab` — will render redesigned brain view
- Doc intelligence pipeline (backend) provides ingestion events via SSE
- Knowledge graph API (Phase 25.3) provides node/edge data for the brain
- Entity resolution API provides canonical entities
- Strategic container API provides actor groupings
- AI context service provides environment summaries for snapshot feature
- Gate service for decision gates within the tab

</code_context>

<deferred>
## Deferred Ideas

- **Full predictive scenario modeling** — sophisticated prediction engine with scenario branching, "what-if" analysis, and probability distributions. Current phase includes basic trend-based predictions only. Should be its own phase.
- **Ironclaw deep integration** — AI assistant chat panel as part of the right panel. Brain-aware conversational AI that can manipulate the visualization, answer questions about the graph, and generate briefings. Phase 29 (Contextual AI Staff) may cover this.

</deferred>

---

*Phase: 41-redesign-understanding-tab-adaptive-brain-visualization*
*Context gathered: 2026-03-11*
