# Phase 25: Operational Design Workspace - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Design tab as a full operational design workspace with problem framing, center of gravity analysis, lines of effort/operation definition, operational approach development, and AI-assisted design recommendations. Currently a DoctrinalPlaceholder — this phase replaces it with functional content.

</domain>

<decisions>
## Implementation Decisions

### Workspace Layout & Navigation
- Sequential sidebar following doctrinal workflow: Overview > Problem Framing > CoG Analysis > Lines of Effort/Operation > Operational Approach
- Reuse existing TabLayout sidebar pattern from UnderstandTab
- Status badges on each sidebar item: not started, in-progress, complete
- Overview landing page as default view — dashboard showing all sections with status, key outputs, and quick-jump links
- Explicit "Push to Plan Tab" handoff action in Operational Approach section that packages outputs (CoG, LOEs, objectives, phasing) for the Plan tab

### Problem Framing UX
- Structured form + AI panel layout: left side has structured fields, right side shows AI-generated alternative framings
- JP 5-0 standard field set: Current State, Desired End State, Problem Statement (auto-generated from gap), Key Tensions/Contradictions, Obstacles, Opportunities, Assumptions, Constraints/Restraints
- AI alternative framings are interactive cards with Adopt (replace framing), Merge (pull specific elements), or Dismiss actions
- Auto-populate from scenario/strategic documents when available, with mandatory user review before acceptance

### CoG Analysis & LOE Visualization
- Structured tree diagram for CoG analysis using SVG/D3 (matches existing codebase patterns like EffectChainDiagram, OrgTree)
- Strange's CG-CC-CR-CV model: CoG at root > Critical Capabilities > Critical Requirements > Critical Vulnerabilities
- Side-by-side friendly and adversary CoG trees for simultaneous analysis and comparison
- Interactive nodes — click to edit, drag to reorder
- Horizontal timeline with lanes for LOE/LOO visualization: each LOE is a horizontal lane, decisive points plotted along timeline, phases as columns
- Explicit links between LOE/decisive points and CoG elements (especially CVs) — visual indicators show which vulnerabilities each LOE addresses

### AI Assistant Integration
- Collapsible split-pane AI panel on the right side, section-aware (shows different AI output per active section)
- Explicit trigger model — user clicks "Analyze" to run AI, no auto-run
- Phase 25 AI capabilities (core analysis only):
  - Alternative problem framings (leverages existing problem-framing agent)
  - CoG suggestion and validation
  - LOE gap analysis (identifies unaddressed vulnerabilities, missing linkages)
- Confidence scores displayed as visual indicators (High/Medium/Low badges) on all AI suggestions, using existing agent confidence bounds pattern
- Phase 29 deferred: conversational interface, cross-tab awareness, agent attribution, activity feed

### Claude's Discretion
- Exact SVG/D3 implementation details for tree diagrams and timeline visualization
- Overview dashboard card layout and metrics displayed
- Form field validation and auto-save behavior
- Loading states and error handling patterns
- Exact spacing, typography, and color theming within the dark UI
- Collaborative editing (Yjs) integration depth — infrastructure exists, extent of usage is implementation decision

</decisions>

<specifics>
## Specific Ideas

- CoG tree diagram should be interactive — click nodes to edit, visually trace CG > CC > CR > CV hierarchy
- LOE timeline should look like a standard military operational approach diagram with lanes, decisive points, and phase boundaries
- AI panel should feel like a staff officer offering alternatives, not an autocomplete — user is always in control
- Design-to-Plan handoff should be a deliberate action (button), not passive data sharing
- Auto-populate problem framing from strategic documents already ingested in the Understand tab

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabLayout` + `SidebarItem` (frontend/src/components/tabs/TabLayout.tsx): Collapsible sidebar navigation pattern — direct reuse for Design tab sub-sections
- `DoctrinalPlaceholder` (frontend/src/components/tabs/DoctrinalPlaceholder.tsx): Replace this with actual DesignTab content
- `problem-framing.ts` agent (backend/src/agents/problem-framing.ts): Multi-perspective framing with PerspectiveType, AlternativeFraming, FramingComparison — wire into AI panel
- `useYjsDocument` hook (frontend/src/lib/yjs-hooks.ts): Yjs collaborative editing with WebSocket provider, awareness — available for collaborative design artifacts
- `COAEditor` (frontend/src/components/planning/COAEditor.tsx): Existing Yjs-integrated editor — reference for collaborative editing patterns
- `EffectChainDiagram` (frontend/src/components/escalation/EffectChainDiagram.tsx): D3/SVG diagram pattern — reference for CoG tree implementation
- `OrgTree` (frontend/src/components/problem-set/OrgTree.tsx): Another tree visualization — reference for node-based diagrams
- `COASketchMap` (frontend/src/components/planning/COASketchMap.tsx): Canvas/map visualization — reference for spatial layouts

### Established Patterns
- Dark UI theme with Tailwind CSS (bg-gray-800, border-gray-700, text-gray-200/400)
- `problemSetId` prop threading through all tab components
- Agent confidence bounds pattern (0-1 with lower/upper) in problem-framing.ts
- D3/SVG for custom visualizations (no ReactFlow installed)
- Yjs + y-websocket for real-time collaboration

### Integration Points
- `DesignTab` component (frontend/src/components/tabs/DesignTab.tsx): Entry point — currently renders DoctrinalPlaceholder
- `ProblemSetTabContainer` (frontend/src/components/problem-set/ProblemSetTabContainer.tsx): Parent that renders DesignTab
- Strategic documents in Understand tab feed into problem framing auto-populate
- Operational approach outputs feed into Plan tab (Design-to-Plan handoff)
- Backend panel config store (Phase 24-03) for persisting Design tab state

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-operational-design-workspace-inserted*
*Context gathered: 2026-03-06*
