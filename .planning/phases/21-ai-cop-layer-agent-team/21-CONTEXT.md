# Phase 21: AI COP Layer Agent Team - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Autonomous agent team per workspace section that monitors work, parses documents/plans, derives location/resource/intent, and generates MIL-STD-2525 interactive SVG overlay layers with standard military symbology for the common operating picture. Layers begin with detailed image specs for model-generated SVGs, update on commit, support staff-controlled publish before promotion to top-level COP, provide entity-data linkages with hover/click detail, animate movement/phasing/connections, and render both friendly and adversary perspectives.

</domain>

<decisions>
## Implementation Decisions

### Ontology & Linkages
- Adopt Common Core Ontology (CCO) as overlay on existing RAFT graph in Neo4j — not a replacement, but a standardization layer
- Strict CCO compliance: every entity must map to a CCO class before committing to graph
- All four CCO modules in scope: Core+Geospatial, Agent Ontology, Event Ontology, Artifact+Information Entity
- CCO schema maintained as external OWL/RDF file — agents load at startup for validation, data stays in Neo4j
- Hybrid entity discovery: graph traversal for known relationships + embedding similarity (text-embedding-3-large) for discovering new linkages
- Auto-commit linkages above confidence threshold (e.g., 0.85); lower confidence queued for human review
- Entity-data linkages visible via summary tooltip on hover (name + affiliation + key linked entities); click opens detail view

### Agent Team Design
- Hybrid coordinator architecture: separate COP coordinator agent orchestrates requests to existing JPP staff agents for domain-specific layers
- Warfighting function leads (J2, J3, J4, C2) as agent leads for their domain, with COP layer-type sub-agents (Force Disposition, Objectives, Control Measures, etc.) that prepare specific parts for assembly by the lead
- Single responsibility principle: each agent does one thing deterministically
- Triple trigger model: on document commit (primary), manual trigger (staff-initiated), periodic polling (for autonomous AI teams/sensors)
- Message queue coordination with observability — agent activity visible in existing workspace activity feed
- Pool-with-affinity scoping: shared agent pool with section affinity, agents develop context for assigned section over time
- Low-power watch state during inactivity (not full dormancy) — agents stay active in reduced polling mode
- Agent definitions stored as database + config seed: defaults from config file, seeded into DB on init, customizable per workspace
- Conflict resolution: source authority ranking with human review flag — most authoritative symbol highlighted, staff sees conflict and makes final decision

### Layer Generation & SVG
- Hybrid generation: declarative JSON spec (entity type, position, SIDC, relationships) for standard symbols via milsymbol; LLM-generated SVG fragments for custom annotations, movement arrows, boundary sketches
- Phase slider + animated playback for temporal changes — manual scrub control plus play button for automatic animation with smooth transitions
- Friendly/adversary perspectives via toggle view (Friendly/Adversary/Combined switch) combined with overlay opacity sliders for fine-grained control
- SVG security: strict validation against allowlisted elements/attributes PLUS sandboxed rendering (iframe/shadow DOM) — belt and suspenders for military-grade security

### Publish & Promotion
- 4-state layer lifecycle: Draft -> Review -> Published -> COP
- Staff review includes feedback loop: inline spatial annotations on specific entities/areas + free-text comments for general guidance; agents receive both and regenerate affected portions
- Any authorized staff member (with publish permission in that section) can promote layers to top-level COP
- Stacked layers with conflict detection: sections' promoted layers stack independently on COP (like IPBLayerControls pattern), with automatic flagging of overlapping/contradictory entities across sections for staff resolution
- Full version history: every publish/promote creates a snapshot; staff can browse COP at any point in time for post-operation analysis
- Recall with audit: authorized staff can pull a layer back from COP to review state; requires a reason, creates audit trail entry

### Claude's Discretion
- Specific confidence threshold value for auto-commit linkages (suggested 0.85)
- Message queue technology choice (in-process vs external broker)
- Exact animation timing and easing curves for playback
- SVG allowlist specifics (which elements/attributes permitted)
- Low-power polling interval for dormant agents
- Version snapshot storage format and retention policy

</decisions>

<specifics>
## Specific Ideas

- CCO provides interoperability — entities standardized across workspace sections enable meaningful cross-section conflict detection and linkage discovery
- "Warfighting function leads coordinate COP layer-type sub-agents" — mirrors military staff process where section chiefs assemble products from subordinate staff work
- Agent observability in workspace activity feed — staff sees what agents are doing without switching to a separate monitoring tool
- Source authority ranking for conflicts reflects military information hierarchy — SIGINT vs HUMINT vs OSINT have different reliability ratings
- Recall with audit trail supports military accountability requirements

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MilSymbolMarker` (frontend/src/components/mission/map/MilSymbolMarker.tsx): milsymbol SIDC -> SVG rendering with Leaflet integration; createMilSymbolIcon utility
- `COASketchMap` (frontend/src/components/planning/COASketchMap.tsx): SVG overlay on Leaflet with phase filtering, movement paths, control measures, affiliation toggles, legend panel — direct foundation for COP layer rendering
- `IPBLayerControls` (frontend/src/components/exercise/IPBLayerControls.tsx): GIS-style layer toggle panel with visibility, grouping by type, color swatches — pattern for COP layer controls
- `AgentAssignmentModal` (frontend/src/components/strategic/AgentAssignmentModal.tsx): agent/team assignment UI with mode toggle, selection, assignment types
- `agent-library.ts` (backend/src/exercise/agent-library.ts): 31 JPP staff agent definitions with roles, tools, personality, system prompts — pattern for COP agent definitions
- Neo4j RAFT graph (backend/src/graph/): entity resolution pipeline, workspace-scoped graph store
- `ObserverPanel` (frontend/src/components/workspace/ObserverPanel.tsx): read-only workspace panel — pattern for activity feed integration

### Established Patterns
- milsymbol library for MIL-STD-2525D symbology (SIDC codes -> SVG)
- React-Leaflet for map rendering with SVG overlays
- Agent definitions as typed objects seeded into database (StaffAgentDef interface)
- Workspace-scoped data isolation (graph_workspaces table with classification)
- CSS-in-component styling with Tailwind utilities

### Integration Points
- Workspace sections (WorkspaceTabContainer, WorkspaceDashboard) — where COP layers attach
- Strategic API (backend/src/api/strategic.ts) — agent/team/assignment endpoints to extend
- Graph workspace store (backend/src/graph/workspace/store.ts) — CCO overlay integrates here
- Exercise types (frontend/src/types/exercise.ts) — extend with COP layer types

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-ai-cop-layer-agent-team*
*Context gathered: 2026-03-05*
