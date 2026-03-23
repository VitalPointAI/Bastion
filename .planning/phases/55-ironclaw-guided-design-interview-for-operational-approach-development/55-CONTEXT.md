# Phase 55: Ironclaw Guided Design Interview for Operational Approach Development - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a LangGraph-powered guided interview system where Ironclaw walks users (individually or collaboratively) through developing an operational approach in the Design tab. Ironclaw conducts a sequential, doctrinally-grounded interview covering Problem Framing → CoG Analysis → LOEs → Operational Approach, using challenge-first questioning, red-team/devil's advocate probing, and knowledge graph references. Interview outputs populate Design tab sections directly with review gates, and Ironclaw drafts the synthesis narrative.

</domain>

<decisions>
## Implementation Decisions

### Interview Trigger
- Both proactive and manual triggers
- Proactive: Ironclaw sends suggestion card when user opens Design tab with empty/incomplete sections ("I can walk you through operational design step by step. Want to start?")
- Manual: "Guide Me" button always available in each Design section for users who want help mid-workflow
- Works for both new designs (full walkthrough) and revisions (Ironclaw reviews existing, focuses on weak areas/gaps)

### Interview Flow & Structure
- Sequential section order following doctrinal workflow: Problem Framing → CoG Analysis → LOEs → Operational Approach
- Cross-referencing: Ironclaw actively references earlier answers when probing later sections ("You identified X as the CoG — how does that shape your LOEs?")
- LangGraph StateGraph with PostgreSQL checkpointing (interrupt-resume pattern, same as ScopingInterview)
- Conversation happens in the Ironclaw drawer — Design tab sections update in real-time as answers are captured

### Doctrinal Questioning Style
- Challenge-then-recommend: Ironclaw first asks probing questions to challenge assumptions before offering recommendations
- Red team / devil's advocate: After user provides their answer, Ironclaw plays devil's advocate ("A red team might argue [counter-argument]. How would you address that?") — only after user defends or adjusts does Ironclaw validate and move on
- Critical thinking prompts always accompany recommendations or suggestions
- Adaptive depth per section: Ironclaw evaluates completeness using doctrinal coverage criteria (e.g., CoG: has CG, ≥2 CCs, CRs for each CC, CVs identified) and keeps probing until criteria are met or user says "move on"
- Proactive suggestions when confidence level is high (uses existing agent confidence bounds pattern)

### Knowledge Graph Integration
- Ironclaw references brain/knowledge graph data when available (strategic documents, actor profiles, environmental factors) to ground questions
- Not required — graceful degradation if no KG data exists
- Gap detection: When Ironclaw detects missing knowledge graph data relevant to the design, it launches a research agent in the background to fill the gap
- Background research: Interview continues while research runs; Ironclaw incorporates findings into subsequent questions when they arrive; results also ingested into knowledge graph

### Output & Artifact Generation
- Direct population of Design tab fields in real-time as interview progresses
- Review gate after each section: Ironclaw shows summary ("Here's what I captured for [section]. Review and confirm, or let's revise.") — fields are editable, user can tweak after confirmation
- CoG tree built through conversation node-by-node (CG → CC → CR → CV), with proactive suggestions/guidance when asked or when confidence is high
- After all sections complete, Ironclaw drafts the operational approach narrative (synthesis tying problem framing, CoG, and LOEs together) for user review/edit

### Prerequisites & Entry Conditions
- ScopingInterview (problem set context) is a required prerequisite
- If scoping is incomplete, Ironclaw can incorporate its completion into the first part of the discussion or direct the user to complete problem scoping first
- Existing designs: Interview reviews what's there, identifies weak areas, and focuses questioning on gaps (revision mode)

### Multi-User Collaborative Interview
- Multiple users can participate in the same interview simultaneously
- Uses Yjs collaborative infrastructure for real-time shared state
- Role-directed questioning: Ironclaw knows each participant's JPP staff role and directs questions to the most relevant role when applicable (J2 for intel, J3 for ops concepts, J5 for planning)
- Any participant can still chime in on any question — role direction is guidance, not strict gating

### Ironclaw Skills & Visualization Tools
- Build new Ironclaw skills (registered in skill-handler-registry) that support the design interview outputs:

#### Overlay Producer
- Generates SVG overlays depicting the operational approach on the area of operations map
- Concise visual representation: phases, axes of advance, LOEs mapped to geography, decisive points, boundaries
- Overlays render on the existing Leaflet/COP map infrastructure (COPMapView, COASketchMap patterns)
- Ironclaw can produce these during or after the interview as the approach takes shape

#### Resource Allocator
- Provides realistic understanding of apportioned forces available for each phase of the operation
- Queries the Resource Registry (Phase 27) for available/apportioned assets
- Maps forces to operational phases — shows what's realistically available per phase vs what's needed
- Surfaces shortfalls and allocation conflicts proactively during the interview

#### Campaign Plan Visualizer
- Generates a comprehensive visual "placemat" depicting the entire operational plan
- Includes: CoGs, LOEs, objectives, problem framing, phases, transitions, decision points — all in one concise visual
- Output formats: SVG overlays for in-app rendering, detailed markdown image specs that an image AI can use to generate polished visual elements
- Think of the classic one-page campaign overview briefing chart — that's the target output

#### Risk Visualizer
- Visualizes operational risks with mitigation measures and residual risk levels
- Maps risks to phases/LOEs/decision points — shows where risk concentrates in the operational approach
- Displays mitigation strategies alongside each risk with residual risk after mitigation applied
- Visual format: risk matrix, risk-over-time timeline, or risk-by-phase heatmap — concise enough for a briefing slide

### Claude's Discretion
- Exact LangGraph graph topology and state schema design
- Doctrinal coverage criteria thresholds per section (how many CCs, CRs, etc. constitute "sufficient")
- Research agent selection and query formulation for KG gap-filling
- Confidence threshold for proactive suggestions
- Yjs document schema for collaborative interview state
- Lock/notification behavior when multiple users are editing simultaneously
- Exact timing of Design tab field population (per-answer vs per-section-completion)
- Interview progress indicator design
- SVG overlay rendering approach (D3-generated vs template-based vs LLM-generated SVG)
- Campaign placemat layout and information density
- Markdown image spec format for image AI generation
- Resource allocator query strategy and shortfall threshold definitions

</decisions>

<specifics>
## Specific Ideas

- Challenge-then-recommend plus red-team is the core questioning philosophy — Ironclaw should feel like a demanding but helpful chief of staff, not a form-filling assistant
- CoG tree built conversationally mirrors how a real staff would develop it in a planning session — node by node with debate at each level
- Background research on KG gaps is a self-healing knowledge pattern — the interview itself improves the problem set's intelligence baseline
- Role-directed questions in collaborative mode mirror real Joint Planning Group dynamics where the J2 briefs intel, J3 briefs ops concepts, etc.
- Proactive suggestions with high confidence should use the existing confidence bounds pattern (0-1 with lower/upper) already in the agent system
- The visualization skills (overlay producer, campaign placemat, risk visualizer) transform abstract design artifacts into briefing-ready visuals — the kind of one-pagers a commander expects to see
- Resource allocator closes the gap between aspirational planning and realistic force availability — surfacing shortfalls during design rather than discovering them during planning
- Markdown image specs for image AI generation enables polished visual outputs beyond what SVG alone can produce (e.g., styled briefing graphics, annotated maps)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `interview-service.ts` (backend/src/doc-intelligence/interview/): LangGraph StateGraph with interrupt-resume, PostgreSQL checkpointing — proven pattern for adaptive conversational interviews; direct model for this new design interview graph
- `interview-store.ts` + `interview-prompts.ts`: Storage and prompt infrastructure for the scoping interview — patterns to extend for design interview
- `ScopingInterview.tsx` (frontend/src/components/doc-intelligence/): Chat UI with progress indicators, resume, audio input — reference for interview UX patterns
- `IronclawDrawer.tsx` + `useIronclaw.ts`: Slide-out drawer with chat, suggestion cards, task panels, WebSocket streaming — primary conversation surface
- `useIronclawContext`: Already imported in all 4 Design sections (OperationalApproachSection, ProblemFramingSection, LOETimelineSection, CoGAnalysisSection) with `sendMessage` and `toggleDrawer`
- `design-service.ts`: Frontend service with OperationalApproach, OperationalDesign types — data models for populating Design tab fields
- `design-store.ts` (backend/src/design/): Backend persistence for design artifacts
- `useYjsDocument` hook (frontend/src/lib/yjs-hooks.ts): Yjs collaborative editing with WebSocket provider — for multi-user interview sessions
- Agent confidence bounds pattern (problem-framing.ts): 0-1 confidence with lower/upper — for proactive suggestion thresholds

### Established Patterns
- LangGraph interrupt-resume with PostgreSQL checkpointing (interview-service.ts)
- IronclawDrawer suggestion cards with accept/dismiss (IronclawSuggestion.tsx)
- D3/SVG for CoG tree visualization (CoGAnalysisSection.tsx)
- Dark UI with Tailwind CSS (bg-gray-800, border-gray-700)
- Problem set scoping → design → planning data flow
- WebSocket real-time updates via ironclaw-router.ts

### Integration Points
- Ironclaw drawer → Design tab sections: Real-time field population via existing useIronclawContext hooks
- Knowledge graph query MCP tools → interview questioning: Ground questions in scenario data
- Research agent dispatch → KG ingestion: Background gap-filling during interview
- ScopingInterview completion check → interview prerequisite gate
- Yjs WebSocket provider → collaborative interview state sync
- Design tab → Plan tab auto-sync (Phase 49): Interview-populated Design data flows to JPP steps automatically
- Skill handler registry → new design skills: overlay-producer, resource-allocator, campaign-visualizer, risk-visualizer registered as Ironclaw skills
- COPMapView / COASketchMap → overlay producer: SVG overlays render on existing Leaflet map infrastructure
- Resource Registry (Phase 27) → resource allocator: Query apportioned forces per phase
- Existing D3/SVG patterns (EffectChainDiagram, CoG trees, LOE timelines) → campaign placemat and risk visualizer rendering

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 55-ironclaw-guided-design-interview-for-operational-approach-development*
*Context gathered: 2026-03-23*
