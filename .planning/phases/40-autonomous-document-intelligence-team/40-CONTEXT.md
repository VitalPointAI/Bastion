# Phase 40: Autonomous Document Intelligence Team - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace manual per-document extraction with an autonomous multi-agent team that adaptively processes documents based on type, relevance, and problem set context. Eliminate user involvement beyond supplying documents. Enable autonomous strategic environment research. Provide a scoping interview to capture problem set context boundaries that guide all subsequent agent behavior.

**11 Specialist Agents:** Document Orchestrator, Format Converter, Document Classifier, Perspective Analysts (per-perspective), Fact Extractor, Objective Extractor, Cross-Document Linker, Bias Identifier, Quality Assessor, Problem Set Researcher, Trust Agent (new — source reliability management).

</domain>

<decisions>
## Implementation Decisions

### Scoping Interview
- Conversational chat interface (not structured form/wizard) — AI asks questions one at a time, adapting follow-ups based on answers
- Include audio input capability for voice-based responses
- Triggers automatically on problem set creation
- Captures: geographic scope, temporal range, actor focus & alliances, and the core problem/challenge/opportunity plus any additional nuance the user wants to introduce
- Re-runnable anytime to update boundaries — updated scope applies to future processing only; existing analysis stays as-is unless user triggers reprocessing

### Document Triage & Agent Assembly
- LLM-driven triage — orchestrator uses an LLM call to classify each document and decide which specialists to invoke (not rules-based)
- Parallel specialist execution where possible — independent specialists run concurrently, dependent ones wait (e.g., Cross-Document Linker waits for Fact Extractor)
- Immediate processing on document upload — no batch queue; document enters pipeline as soon as it's uploaded
- Unified report + graph output — orchestrator assembles specialist findings into a structured per-document intelligence report AND pushes entities to the knowledge graph

### Autonomous Research
- Both gap-triggered AND scheduled OSINT monitoring — gap detection during extraction triggers immediate research; scheduled monitoring provides ongoing situational awareness
- Dedicated Trust Agent (new 11th specialist) — evaluates source reliability independently, maintains a source registry with trust scores, consults known trusted/untrusted source lists, flags anything below threshold for human review
- Source trust is critical — misinformation/disinformation must not enter the knowledge base; questionable sources require human approval before addition
- Per-source provenance tracking — every graph entity/relationship tagged with source document(s); revoking a source removes entities solely attributed to it; entities corroborated by other sources remain but lose that citation
- Revert capability — must be able to extract and revert any changes from a source later found to be false or misleading
- Research products re-enter the same processing pipeline, auto-tagged with source, retrieval date, and trust rating

### Strategic Environment Briefing
- On-demand narrative briefing — any user or agent can retrieve a concise, up-to-date narrative summary of the strategic environment as detailed by the knowledge graph
- Change detection — briefing highlights what is new or changed since the last time it was retrieved by that user/agent, keeping them fully aware of evolving context
- Predictive analytics — where sufficient data exists, the briefing surfaces potential outcomes that are forming, with accurate confidence scoring indicating probabilities
- Builds on existing `StrategicContextService.assembleContext()` which already aggregates graph summaries, documents, and decisions with token budgeting — the narrative layer transforms this structured data into human-readable prose with change annotations

### Processing Visibility & Ratings
- NATO source reliability (A-F) and information credibility (1-6) displayed as detailed rating panels with full breakdown showing both dimensions separately with explanatory text (e.g., "Source: B - Usually Reliable | Info: 3 - Possibly True")
- User-overridable ratings with audit trail — original agent rating preserved, override logged with reason and user identity

### Claude's Discretion
- Unified report presentation format (expandable card vs full-page — Claude decides best UX)
- Specific agent prompt engineering and tool definitions
- LLM provider selection per specialist
- Internal data schemas for specialist outputs
- Format Converter implementation details (OCR, translation approach)
- Exact progress callback and streaming architecture

</decisions>

<specifics>
## Specific Ideas

- **Knowledge graph is the centerpiece** — when navigating to the Understand tab, the knowledge graph is the focused, centered element on screen. Document upload, analysis panels, reports, legends, and controls surround it peripherally. The graph is the star, everything else supports it.
- **Animated knowledge flow** — when documents are processed, users see animated movement of knowledge entering the graph, entities finding their place, and the graph growing and morphing in real time. Builds on existing ExtractionTheater animated flow particles and live graph building patterns.
- **Graph growth replay** — capture periodic snapshots of the knowledge graph state and enable time-lapse replay of how the graph grew and evolved. Lets users see the history of their strategic environment taking shape.
- **Mission control dashboard aesthetic** for the live agent activity feed — dark theme, real-time status cards per agent with animated states (analyzing, extracting, linking), entity counts ticking up, specialist icons. Think NASA mission control or Bloomberg terminal energy. "Need some wow factor in this app."
- **Human-in-the-loop controls during processing** — mission control style: user can pause/stop individual specialists, flag items for re-analysis, add guidance notes mid-processing. Leverages existing LangGraph human-in-the-loop checkpoints.
- **Both force graph and structured table views** for knowledge graph, toggle-able by the user
- **Understand tab** is the primary home for the document intelligence team interface — document upload, processing feed, reports, and knowledge graph all in one place
- "It is very bad to introduce misinformation or disinformation" — trust management is a first-class concern, not an afterthought

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **DocumentParser** (`backend/src/strategic/ingestion/document-parser.ts`): PDF/Office parsing with chunking — direct reuse for format conversion stage
- **DocumentStore** (`backend/src/strategic/ingestion/document-store.ts`): PostgreSQL storage with metadata, classification, IPFS CID — extend for provenance tracking
- **ExtractionService** (`backend/src/strategic/extraction/extractor.ts`): Multi-provider LLM extraction with DIME/MIDLIFE frameworks — becomes Objective Extractor specialist
- **GraphBuilder** (`backend/src/graph/construction/graph-builder.ts`): RAFT entity extraction with onProgress callbacks and streaming — core of Fact Extractor and Cross-Document Linker
- **TeamRegistry** (`backend/src/agents/team-registry.ts`): Singleton team management with roles, workflows, escalation — manages the specialist agent team
- **MidlifeCategorizer** (`backend/src/strategic/tools/midlife-categorizer.ts`): Keyword-based categorization with confidence scoring — input to Document Classifier
- **LangGraph orchestration** (`backend/src/orchestration/`): Supervisor pattern, task executor (sequential/parallel/hierarchical), PostgreSQL checkpointing, ABAC filtering, human-in-the-loop — orchestrator foundation
- **ExtractionTheater** (`frontend/src/components/strategic/ExtractionTheater.tsx`): Full-screen modal with document extraction progress feed + animated flow particles + live knowledge graph visualization. Already demonstrates the animated knowledge-entering-graph pattern — evolve this into the Understand tab centerpiece.
- **GraphExplorer** (`frontend/src/components/graph/GraphExplorer.tsx`): `react-force-graph-2d` force graph with node/edge filtering, type-based coloring, search, hover details. Core graph visualization component — extend with snapshot/replay capability and peripheral layout.
- **AI Staff feed** (`frontend/src/lib/ai-staff-service.ts`, `frontend/src/hooks/useAIStaffFeed.ts`): Feed items, annotations, chat — pattern for mission control activity feed
- **Container system** (`backend/src/strategic/containers/`): Friendly/Adversary/Neutral/Partner categories — maps to Perspective Analyst instantiation

### Established Patterns
- **Multi-provider LLM**: Factory pattern supporting Anthropic, OpenAI, NEAR AI, Ollama, etc. — all specialists can use any provider
- **Zod validation**: Used throughout for schemas — specialist input/output contracts
- **pg-boss**: Async job queue with singleton key deduplication — handles processing queue and scheduled research
- **Entity resolution**: Existing duplicate detection and merging in `backend/src/graph/resolution/` — essential for cross-document linking

### Integration Points
- **Understand tab** (Phase 24): Document intelligence UI lives here
- **Strategic context service** (`backend/src/exercise/strategic-context-service.ts`): Already assembles token-budgeted context bundles (graph summaries, documents, decisions) — narrative briefing layer builds on top of `assembleContext()`. Needs: change tracking (last-retrieved timestamps per user/agent), narrative generation (LLM transforms structured context into prose), and predictive analytics overlay
- **Knowledge graph** (`backend/src/graph/`): All specialists contribute extracted entities/relationships
- **Container assignments**: Document Classifier suggests container placement
- **AI Staff routing** (`frontend/src/hooks/useAgentRouting.ts`): Specialist agents route through existing tab-aware system

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-autonomous-document-intelligence-team*
*Context gathered: 2026-03-09*
