# Phase 40: Autonomous Document Intelligence Team - Research

**Researched:** 2026-03-09
**Domain:** Multi-agent document processing, NATO intelligence standards, LangGraph orchestration
**Confidence:** HIGH

## Summary

Phase 40 builds an autonomous multi-agent document intelligence team on top of BASTION's existing LangGraph orchestration infrastructure, agent team registry, graph construction pipeline, and SSE-based ExtractionTheater UI. The codebase already has a `BastionSupervisor` with classification-aware routing, `TaskExecutor` with sequential/parallel/hierarchical/consensus patterns, `LangGraphAgentWrapper` for agent nodes, and `TeamRegistry` for team lifecycle management. The existing `GraphBuilder` already extracts RAFT entities (actors, relationships, tensions) with `onEntityCreated` and `onProgress` streaming callbacks, and the `ExtractionTheater` frontend component demonstrates the animated knowledge-entering-graph pattern. The `StrategicContextService.assembleContext()` provides the foundation for the narrative briefing layer.

The primary technical challenge is orchestrating 11 specialist agents with mixed parallel/sequential dependencies, maintaining per-source provenance for revert capability, and implementing the NATO Admiralty System (STANAG 2511) for source reliability and information credibility ratings. The scoping interview introduces a conversational AI pattern that captures problem set boundaries and persists them as a structured schema consumed by all agents.

**Primary recommendation:** Use the existing `BastionSupervisor` + `TaskExecutor` patterns to build the Document Orchestrator as a LangGraph `StateGraph` with conditional fan-out to specialist nodes, leveraging the existing parallel execution patterns and classification-aware filtering. Register the 11 specialists via `TeamRegistry`. Use `pg-boss` for async job dispatch on document upload and scheduled OSINT monitoring.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scoping Interview:**
- Conversational chat interface (not structured form/wizard) -- AI asks questions one at a time, adapting follow-ups based on answers
- Include audio input capability for voice-based responses
- Triggers automatically on problem set creation
- Captures: geographic scope, temporal range, actor focus & alliances, and the core problem/challenge/opportunity plus any additional nuance the user wants to introduce
- Re-runnable anytime to update boundaries -- updated scope applies to future processing only; existing analysis stays as-is unless user triggers reprocessing

**Document Triage & Agent Assembly:**
- LLM-driven triage -- orchestrator uses an LLM call to classify each document and decide which specialists to invoke (not rules-based)
- Parallel specialist execution where possible -- independent specialists run concurrently, dependent ones wait (e.g., Cross-Document Linker waits for Fact Extractor)
- Immediate processing on document upload -- no batch queue; document enters pipeline as soon as it's uploaded
- Unified report + graph output -- orchestrator assembles specialist findings into a structured per-document intelligence report AND pushes entities to the knowledge graph

**Autonomous Research:**
- Both gap-triggered AND scheduled OSINT monitoring -- gap detection during extraction triggers immediate research; scheduled monitoring provides ongoing situational awareness
- Dedicated Trust Agent (new 11th specialist) -- evaluates source reliability independently, maintains a source registry with trust scores, consults known trusted/untrusted source lists, flags anything below threshold for human review
- Source trust is critical -- misinformation/disinformation must not enter the knowledge base; questionable sources require human approval before addition
- Per-source provenance tracking -- every graph entity/relationship tagged with source document(s); revoking a source removes entities solely attributed to it; entities corroborated by other sources remain but lose that citation
- Revert capability -- must be able to extract and revert any changes from a source later found to be false or misleading
- Research products re-enter the same processing pipeline, auto-tagged with source, retrieval date, and trust rating

**Strategic Environment Briefing:**
- On-demand narrative briefing -- any user or agent can retrieve a concise, up-to-date narrative summary of the strategic environment as detailed by the knowledge graph
- Change detection -- briefing highlights what is new or changed since the last time it was retrieved by that user/agent, keeping them fully aware of evolving context
- Predictive analytics -- where sufficient data exists, the briefing surfaces potential outcomes that are forming, with accurate confidence scoring indicating probabilities
- Builds on existing `StrategicContextService.assembleContext()` which already aggregates graph summaries, documents, and decisions with token budgeting

**Processing Visibility & Ratings:**
- NATO source reliability (A-F) and information credibility (1-6) displayed as detailed rating panels with full breakdown showing both dimensions separately with explanatory text
- User-overridable ratings with audit trail -- original agent rating preserved, override logged with reason and user identity

### Claude's Discretion
- Unified report presentation format (expandable card vs full-page -- Claude decides best UX)
- Specific agent prompt engineering and tool definitions
- LLM provider selection per specialist
- Internal data schemas for specialist outputs
- Format Converter implementation details (OCR, translation approach)
- Exact progress callback and streaming architecture

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCTEAM-01 | Problem set scoping interview captures boundaries (geographic, temporal, actor focus, classification ceiling, echelon) | Conversational chat pattern with interview-to-schema conversion; persist as `problem_set_context` consumed by all agents |
| DOCTEAM-02 | Document Orchestrator triages and dispatches to specialist pool | LangGraph StateGraph with LLM-driven conditional routing via `BastionSupervisor` pattern; fan-out/fan-in parallel execution |
| DOCTEAM-03 | Format Converter handles OCR, translation, encoding | Tesseract.js for OCR, existing `DocumentParser` for PDF/Office; language detection via LLM |
| DOCTEAM-04 | Document Classifier identifies type, classification, relevance | LLM-driven classification replacing keyword-based `MidlifeCategorizer`; taxonomy-based type assignment |
| DOCTEAM-05 | Fact Extractor builds structured fact registry | Extends existing `GraphBuilder` RAFT extraction with named entities, dates, locations, claims with source attribution |
| DOCTEAM-06 | Objective Extractor conditionally invoked | Existing `ExtractionService` refactored as specialist; invoked only when document type warrants it |
| DOCTEAM-07 | Perspective Analysts per-perspective analysis | Per-container-category instantiation (Friendly/Adversary/Neutral/Partner); perspective-specific prompts |
| DOCTEAM-08 | Cross-Document Linker detects corroboration/contradiction | Existing entity resolution service + new inter-document edge creation in knowledge graph |
| DOCTEAM-09 | Bias Identifier detects framing, propaganda, IO markers | New specialist agent with bias taxonomy; source framing analysis prompts |
| DOCTEAM-10 | Quality Assessor applies NATO source reliability ratings | Admiralty System (STANAG 2511) A-F/1-6 ratings; Trust Agent for source registry management |
| DOCTEAM-11 | Autonomous researcher fills knowledge gaps | `pg-boss` scheduled jobs + gap-triggered research; OSINT feed integration; research briefs re-enter pipeline |
| DOCTEAM-12 | Strategic environment briefing with change detection | Narrative layer on `StrategicContextService.assembleContext()`; per-user/agent last-retrieved timestamps; predictive analytics overlay |

</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @langchain/langgraph | ^1.1.0 | Agent orchestration graphs | Already used for supervisor pattern, checkpointing, human-in-the-loop |
| @langchain/langgraph-checkpoint-postgres | ^1.0.0 | Persistent state checkpointing | Already in use for fault recovery |
| @langchain/anthropic | ^1.3.10 | Claude LLM provider | Primary LLM provider for specialist agents |
| @langchain/openai | ^1.2.2 | OpenAI LLM provider | Alternative provider for specialists |
| @langchain/core | ^1.1.15 | LangChain base types | Messages, tools, chat models |
| pg-boss | ^12.5.4 | PostgreSQL job queue | Async processing, scheduled OSINT, singleton dedup |
| unpdf | ^1.4.0 | PDF text extraction | Already in use by DocumentParser |
| zod | (installed) | Schema validation | All specialist input/output contracts |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tesseract.js | ^6.0.0 | OCR for scanned PDFs | Format Converter agent -- scanned document text extraction |

### No New Dependencies Needed For
| Capability | Existing Solution |
|------------|-------------------|
| Office document parsing | `officeparser` (already installed) |
| LLM multi-provider | `llm-factory.ts` factory pattern |
| Entity resolution | `resolution-service.ts` in graph/resolution/ |
| Graph construction | `graph-builder.ts` with streaming callbacks |
| SSE streaming | Express SSE pattern already in strategic.ts API |
| Async job queue | `pg-boss` already in use |
| Graph visualization | `react-force-graph-2d` in GraphExplorer |

## Architecture Patterns

### Document Intelligence Team -- Agent Dependency Graph

```
Document Upload
      |
      v
[Document Orchestrator] -- LLM triage
      |
      +---> [Format Converter] (if scanned/non-English)
      |           |
      |           v
      +---> [Document Classifier] (type, relevance, container)
      |           |
      |           v (parallel fan-out)
      +---> [Fact Extractor]  ----+
      +---> [Objective Extractor] | (conditional)
      +---> [Perspective Analysts] x4 (per container category)
      +---> [Bias Identifier]
      |           |
      |           v (fan-in, wait for Fact Extractor)
      +---> [Cross-Document Linker]
      +---> [Quality Assessor / Trust Agent]
      |           |
      |           v
      [Orchestrator assembles unified report]
      |
      v
[Graph entities + Intelligence Report]
```

### Recommended Project Structure

```
backend/src/
  doc-intelligence/
    orchestrator.ts          # Document Orchestrator StateGraph
    specialist-base.ts       # Base class for specialist agents
    schemas.ts               # Zod schemas for all specialist I/O
    types.ts                 # TypeScript types
    team-setup.ts            # Team registration via TeamRegistry
    specialists/
      format-converter.ts    # OCR, translation, encoding
      document-classifier.ts # Type, relevance, classification
      fact-extractor.ts      # Named entities, claims, dates
      objective-extractor.ts # Strategic objectives (wraps existing)
      perspective-analyst.ts # Per-perspective analysis
      cross-doc-linker.ts    # Inter-document references
      bias-identifier.ts     # Source bias, framing, IO markers
      quality-assessor.ts    # NATO ratings, consistency checks
      trust-agent.ts         # Source registry, trust scoring
      researcher.ts          # OSINT, web search, gap detection
    interview/
      interview-service.ts   # Scoping interview conversation
      interview-schema.ts    # ProblemSetContext Zod schema
      interview-prompts.ts   # Adaptive question prompts
    briefing/
      briefing-service.ts    # Narrative briefing generation
      change-tracker.ts      # Per-user/agent change detection
      predictive-service.ts  # Predictive analytics overlay
    provenance/
      provenance-store.ts    # Per-source entity tracking
      revert-service.ts      # Source revocation and cleanup
    source-registry/
      source-store.ts        # Trust scores, known sources
      nato-ratings.ts        # A-F / 1-6 rating types and logic
frontend/src/
  components/doc-intelligence/
    ScopingInterview.tsx      # Conversational chat UI
    MissionControl.tsx        # Agent activity dashboard
    IntelligenceReport.tsx    # Unified report display
    NATORatingPanel.tsx       # A-F / 1-6 rating display
    ProcessingFeed.tsx        # Real-time specialist status
```

### Pattern 1: Specialist Agent as LangGraph Node

**What:** Each specialist is a `LangGraphAgentWrapper` node in the orchestrator's `StateGraph`.
**When to use:** Every specialist agent in the document intelligence team.

```typescript
// Each specialist extends or follows the existing LangGraphAgentWrapper pattern
import { LangGraphAgentWrapper } from '../../orchestration/agent-wrapper.js';

const factExtractor = new LangGraphAgentWrapper({
  agentId: 'doc-fact-extractor',
  name: 'Fact Extractor',
  description: 'Extracts named entities, dates, locations, claims with source attribution',
  clearance: 'SECRET',
  tools: [createActorTool, createRelationshipTool, searchEntitiesTool],
  systemPrompt: FACT_EXTRACTOR_PROMPT,
});

// Register in orchestrator StateGraph
graph.addNode('fact-extractor', factExtractor.createNode());
```

### Pattern 2: Parallel Fan-Out with Dependency Gating

**What:** The orchestrator fans out independent specialists in parallel and gates dependent ones.
**When to use:** After Document Classifier completes, fan out to independent specialists; gate Cross-Document Linker on Fact Extractor completion.

```typescript
// LangGraph fan-out: multiple edges from single node = parallel execution
graph.addEdge('classifier', 'fact-extractor');      // parallel
graph.addEdge('classifier', 'perspective-analyst');  // parallel
graph.addEdge('classifier', 'bias-identifier');      // parallel
graph.addEdge('classifier', 'objective-extractor');  // parallel (conditional)

// Fan-in: Cross-Document Linker waits for Fact Extractor
graph.addEdge('fact-extractor', 'cross-doc-linker');

// All specialists fan-in to report assembly
graph.addEdge('fact-extractor', 'report-assembly');
graph.addEdge('perspective-analyst', 'report-assembly');
// ... etc
```

### Pattern 3: Scoping Interview as Conversational State Machine

**What:** A LangGraph graph that manages interview state, generates adaptive questions, and persists results.
**When to use:** Problem set creation and re-scoping.

```typescript
// Interview state tracks questions asked, answers received, and derived context
const InterviewStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesReducer }),
  questionsAsked: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] }),
  derivedContext: Annotation<Partial<ProblemSetContext>>({
    reducer: (a, b) => ({ ...a, ...b })
  }),
  isComplete: Annotation<boolean>(),
});
```

### Pattern 4: Per-Source Provenance Tracking

**What:** Every entity/relationship in the knowledge graph is tagged with source document IDs. Revoking a source removes entities solely attributed to it.
**When to use:** All graph writes from specialist agents.

```typescript
// Extend existing GraphBuildOptions which already has sourceDocumentId
interface ProvenanceTrackedEntity {
  entityId: string;
  sourceDocumentIds: string[];  // Multiple sources can corroborate
  createdAt: Date;
  natoRating?: { reliability: string; credibility: number };
}

// Revocation: remove entities where sourceDocumentIds contains ONLY the revoked source
async function revokeSource(sourceDocumentId: string): Promise<RevertResult> {
  // 1. Find entities solely attributed to this source
  // 2. Remove those entities from graph
  // 3. For entities with multiple sources, remove this source's citation
  // 4. Return summary of changes
}
```

### Pattern 5: SSE Streaming for Mission Control

**What:** Extend existing SSE pattern from ExtractionTheater to stream specialist agent status updates.
**When to use:** Document processing real-time visibility.

```typescript
// Follows existing pattern from backend/src/api/strategic.ts
res.setHeader('Content-Type', 'text/event-stream');

// Events per specialist
sendEvent('specialist:start', { agentId, documentId, timestamp });
sendEvent('specialist:progress', { agentId, stage, detail, entitiesFound });
sendEvent('specialist:complete', { agentId, result, duration });
sendEvent('report:assembled', { reportId, entityCount, ratingsSummary });
```

### Anti-Patterns to Avoid
- **One-size-fits-all processing:** Do NOT send every document through every specialist. The orchestrator MUST triage and select relevant specialists per document type. A news article does not need the Objective Extractor.
- **Synchronous blocking pipeline:** Do NOT run specialists sequentially when they can run in parallel. The dependency graph should maximize parallelism.
- **Untracked graph writes:** NEVER write entities to the knowledge graph without provenance tags. Every entity must be traceable to its source document(s).
- **Trust-free ingestion:** NEVER auto-ingest OSINT or research products without Trust Agent evaluation. Questionable sources must be flagged for human review before entities enter the graph.
- **Polling for status:** Use SSE streaming, not client polling, for processing status updates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent orchestration | Custom event loop | LangGraph StateGraph with BastionSupervisor | Checkpointing, time-travel debugging, human-in-the-loop already built |
| Parallel execution | Promise.all with manual state | LangGraph fan-out/fan-in via multiple edges | Superstep semantics, atomic failure handling |
| Job scheduling | Custom cron/setInterval | pg-boss with singleton keys | Deduplication, retry, persistence, already in use |
| PDF text extraction | Custom parser | unpdf (existing) + Tesseract.js for OCR | Handles edge cases, page detection, encoding |
| Entity resolution | String matching | Existing resolution-service.ts | Blocking, fuzzy matching, merge logic already built |
| LLM provider abstraction | Direct API calls | llm-factory.ts | Multi-provider support, config-driven, caching |
| Graph construction | Direct Neo4j writes | GraphBuilder with onEntityCreated | Streaming callbacks, provenance, entity resolution |
| Classification filtering | Manual clearance checks | classification-filter.ts | ABAC filtering, clearance levels already implemented |

**Key insight:** The codebase has extensive infrastructure for exactly this kind of multi-agent orchestrated pipeline. The primary work is wiring up specialist-specific prompts, schemas, and the orchestrator's triage logic -- not building orchestration infrastructure.

## Common Pitfalls

### Pitfall 1: LangGraph State Conflicts in Parallel Nodes
**What goes wrong:** Multiple parallel specialist nodes try to write to the same state key, causing "Can receive only one value per step" errors.
**Why it happens:** LangGraph supersteps require explicit state reducers for keys updated by parallel nodes.
**How to avoid:** Define custom reducers (e.g., array append) for all state keys that parallel nodes update. Each specialist should write to its own namespaced key, then the report assembly node merges them.
**Warning signs:** Runtime errors about state key conflicts during parallel execution.

### Pitfall 2: Unbounded Context Windows
**What goes wrong:** Full document text plus specialist outputs exceeds LLM context limits, causing truncation or errors.
**Why it happens:** Large documents (50+ pages) generate enormous text. Each specialist adds more output.
**How to avoid:** Use the existing chunking from DocumentParser (DEFAULT_CHUNK_SIZE = 8000). Process chunks through specialists, then merge results. Use the token budgeting pattern from StrategicContextService.
**Warning signs:** LLM API errors about token limits, truncated analysis.

### Pitfall 3: Circular Research Pipeline
**What goes wrong:** Research products trigger further research which triggers further research -- infinite loop.
**Why it happens:** Autonomous researcher fills gaps, but research products re-enter the pipeline, which may detect new gaps.
**How to avoid:** Implement research depth limits (max 2 recursive research cycles per gap), cooldown periods between research cycles, and gap deduplication (don't research the same gap twice).
**Warning signs:** pg-boss queue growing unboundedly, CPU/API cost spikes.

### Pitfall 4: Trust Agent as Bottleneck
**What goes wrong:** Trust Agent becomes a serial bottleneck if every entity must be individually assessed.
**Why it happens:** Per-entity trust evaluation is expensive; documents can extract hundreds of entities.
**How to avoid:** Trust Agent evaluates at the SOURCE level (the whole document/source), not per-entity. Once a source is rated, all entities from that source inherit the rating. Only flag entire sources for human review, not individual entities.
**Warning signs:** Processing time dominated by trust evaluation, user frustration with per-entity approvals.

### Pitfall 5: Provenance Revocation Cascade
**What goes wrong:** Revoking a source triggers massive graph mutations, breaking dependent relationships.
**Why it happens:** Entities have cascading relationships; removing an actor may orphan relationships and tensions.
**How to avoid:** Implement soft-delete with provenance tracking. Mark entities as "revoked" rather than hard-deleting. Provide a preview of revocation impact before executing. Handle cascading updates in a transaction.
**Warning signs:** Graph inconsistencies after revocation, orphaned edges.

### Pitfall 6: Scoping Interview State Loss
**What goes wrong:** User refreshes mid-interview and loses all context.
**Why it happens:** Interview state only in component state, not persisted.
**How to avoid:** Use LangGraph checkpointing (PostgreSQL) for interview state. Resume from last checkpoint on reconnect. The existing `getCheckpointer()` function already provides this.
**Warning signs:** Users restarting interviews from scratch after navigation.

## Code Examples

### NATO Admiralty Rating Schema (Zod)

```typescript
// Source: NATO STANAG 2511 (AJP-2.1 Edition B)
import { z } from 'zod';

export const SourceReliabilitySchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F']).describe(
  'NATO Source Reliability: A=Completely Reliable, B=Usually Reliable, ' +
  'C=Fairly Reliable, D=Not Usually Reliable, E=Unreliable, F=Cannot Be Judged'
);

export const InformationCredibilitySchema = z.number().int().min(1).max(6).describe(
  'NATO Information Credibility: 1=Confirmed, 2=Probably True, ' +
  '3=Possibly True, 4=Doubtfully True, 5=Improbable, 6=Cannot Be Judged'
);

export const NATORatingSchema = z.object({
  sourceReliability: SourceReliabilitySchema,
  informationCredibility: InformationCredibilitySchema,
  assessedBy: z.string(), // Agent or user ID
  assessedAt: z.string().datetime(),
  reasoning: z.string(),
  overriddenBy: z.string().optional(),
  overrideReason: z.string().optional(),
  overrideAt: z.string().datetime().optional(),
  originalRating: z.object({
    sourceReliability: SourceReliabilitySchema,
    informationCredibility: InformationCredibilitySchema,
  }).optional(), // Preserved when overridden
});

export type NATORating = z.infer<typeof NATORatingSchema>;

// Display helper
export const RELIABILITY_LABELS: Record<string, string> = {
  A: 'Completely Reliable',
  B: 'Usually Reliable',
  C: 'Fairly Reliable',
  D: 'Not Usually Reliable',
  E: 'Unreliable',
  F: 'Reliability Cannot Be Judged',
};

export const CREDIBILITY_LABELS: Record<number, string> = {
  1: 'Confirmed by Other Sources',
  2: 'Probably True',
  3: 'Possibly True',
  4: 'Doubtfully True',
  5: 'Improbable',
  6: 'Truth Cannot Be Judged',
};
```

### Problem Set Context Schema

```typescript
// Scoping interview output -- consumed by all specialist agents
export const ProblemSetContextSchema = z.object({
  problemSetId: z.string(),
  geographicScope: z.object({
    regions: z.array(z.string()),
    countries: z.array(z.string()),
    specificAreas: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
  }),
  temporalRange: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    historicalDepth: z.string().optional(), // e.g., "5 years"
    futureHorizon: z.string().optional(),
  }),
  actorFocus: z.object({
    primaryActors: z.array(z.string()),
    alliances: z.array(z.object({
      name: z.string(),
      members: z.array(z.string()),
    })).optional(),
    excludedActors: z.array(z.string()).optional(),
  }),
  coreProblem: z.string(),
  additionalNuance: z.string().optional(),
  classificationCeiling: z.enum(['UNCLASSIFIED', 'SECRET', 'TOPSECRET']),
  echelon: z.enum(['strategic', 'operational', 'tactical']),
  standingRequirements: z.array(z.string()).optional(), // Standing intelligence requirements
  updatedAt: z.string().datetime(),
  version: z.number().int(),
});

export type ProblemSetContext = z.infer<typeof ProblemSetContextSchema>;
```

### Document Orchestrator Triage Prompt

```typescript
const TRIAGE_SYSTEM_PROMPT = `You are a Document Intelligence Orchestrator triaging an incoming document.

Given the document metadata and first 2000 characters, determine:
1. Document type (from taxonomy)
2. Relevance to the problem set scope (0-1)
3. Which specialist agents to invoke

Document Type Taxonomy:
- INTEL_ESTIMATE: Intelligence estimates, threat assessments
- CONOP: Concept of operations, operational plans
- POLICY_PAPER: Policy documents, white papers, strategy documents
- NEWS_ARTICLE: News reports, media coverage
- ACADEMIC_RESEARCH: Research papers, academic publications
- MILITARY_ORDER: Orders, directives, fragmentary orders
- DIPLOMATIC_CABLE: Diplomatic communications
- OSINT_REPORT: Open source intelligence reports
- OTHER: Documents not fitting above categories

Specialist Selection Rules:
- Format Converter: ALWAYS if document appears scanned or non-English
- Document Classifier: ALWAYS
- Fact Extractor: ALWAYS
- Objective Extractor: ONLY for INTEL_ESTIMATE, CONOP, POLICY_PAPER, MILITARY_ORDER
- Perspective Analysts: ALWAYS (instantiated per relevant perspective)
- Bias Identifier: ALWAYS for NEWS_ARTICLE, ACADEMIC_RESEARCH, OSINT_REPORT; OPTIONAL for others
- Cross-Document Linker: ALWAYS (runs after Fact Extractor)
- Quality Assessor: ALWAYS
- Trust Agent: ALWAYS for OSINT_REPORT, NEWS_ARTICLE; when source is unknown

Return JSON with your triage decision.`;
```

### Source Provenance Database Schema

```sql
-- Extends existing strategic_documents table
ALTER TABLE strategic_documents
  ADD COLUMN IF NOT EXISTS nato_reliability TEXT CHECK (nato_reliability IN ('A','B','C','D','E','F')),
  ADD COLUMN IF NOT EXISTS nato_credibility INTEGER CHECK (nato_credibility BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS trust_status TEXT DEFAULT 'pending'
    CHECK (trust_status IN ('trusted', 'pending', 'flagged', 'revoked')),
  ADD COLUMN IF NOT EXISTS trust_assessed_by TEXT,
  ADD COLUMN IF NOT EXISTS trust_assessed_at TIMESTAMPTZ;

-- Entity provenance tracking
CREATE TABLE IF NOT EXISTS entity_provenance (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,           -- RAFT actor/relationship/tension ID
  entity_type TEXT NOT NULL,         -- 'actor', 'relationship', 'tension'
  source_document_id TEXT NOT NULL,  -- Foreign key to strategic_documents
  extracted_by TEXT NOT NULL,        -- Agent ID that extracted it
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  UNIQUE(entity_id, source_document_id)
);

CREATE INDEX IF NOT EXISTS idx_provenance_entity ON entity_provenance(entity_id);
CREATE INDEX IF NOT EXISTS idx_provenance_source ON entity_provenance(source_document_id);
CREATE INDEX IF NOT EXISTS idx_provenance_revoked ON entity_provenance(is_revoked);

-- Source trust registry
CREATE TABLE IF NOT EXISTS source_registry (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,       -- 'news_outlet', 'government', 'academic', 'social_media', etc.
  default_reliability TEXT CHECK (default_reliability IN ('A','B','C','D','E','F')),
  trust_notes TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Briefing change tracking
CREATE TABLE IF NOT EXISTS briefing_access_log (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  accessed_by TEXT NOT NULL,        -- User DID or agent ID
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graph_snapshot_hash TEXT NOT NULL  -- Hash of graph state at access time
);

CREATE INDEX IF NOT EXISTS idx_briefing_access ON briefing_access_log(problem_set_id, accessed_by);

-- Problem set scoping context
CREATE TABLE IF NOT EXISTS problem_set_context (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL UNIQUE,
  context_data JSONB NOT NULL,      -- ProblemSetContext schema
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single extraction pipeline | Multi-agent specialist team | Phase 40 | Adaptive processing per document type |
| Ad-hoc confidence scores | NATO Admiralty System (STANAG 2511) | Phase 40 | Standardized, internationally recognized ratings |
| Manual document analysis | LLM-driven triage + autonomous processing | Phase 40 | Zero user involvement beyond upload |
| Keyword-based categorization (MidlifeCategorizer) | LLM-driven document classification | Phase 40 | Higher accuracy, contextual understanding |
| Sequential extraction | Parallel fan-out/fan-in specialists | Phase 40 | Faster processing, specialist expertise |

**Existing patterns that remain current:**
- LangGraph StateGraph with conditional edges -- standard for multi-agent orchestration
- SSE streaming for real-time progress -- established pattern in the codebase
- pg-boss for async jobs -- production-proven for scheduling and deduplication
- Zod for schema validation -- used throughout for type safety
- react-force-graph-2d for graph visualization -- established in GraphExplorer

## Open Questions

1. **Graph Snapshot Storage for Replay**
   - What we know: CONTEXT.md specifies "graph growth replay" with periodic snapshots and time-lapse capability
   - What's unclear: Storage strategy for snapshots -- full graph state vs incremental diffs? How frequently to snapshot?
   - Recommendation: Store incremental entity creation events (already emitted via `onEntityCreated`) in a timestamped event log table. Replay by replaying the event stream. This avoids expensive full snapshots and leverages existing callbacks.

2. **Audio Input for Scoping Interview**
   - What we know: User wants voice-based responses in the interview
   - What's unclear: Which speech-to-text service to use. Browser Web Speech API vs server-side transcription.
   - Recommendation: Use the browser's built-in Web Speech API (`SpeechRecognition`) for real-time transcription client-side. Falls back to text input. No additional server-side dependency needed. If higher accuracy is required, consider Whisper API as an enhancement.

3. **Predictive Analytics Confidence Scoring**
   - What we know: Briefing should surface "potential outcomes that are forming, with accurate confidence scoring indicating probabilities"
   - What's unclear: What constitutes "sufficient data" for predictions? How to calibrate confidence?
   - Recommendation: Use LLM analysis of graph trends (actor relationships strengthening/weakening, tension escalation patterns) with explicit uncertainty quantification. Present as "emerging patterns" with caveated confidence levels, not hard predictions.

4. **OSINT Feed Sources**
   - What we know: Researcher agent needs web search and OSINT monitoring
   - What's unclear: Specific OSINT feed APIs to integrate (NewsAPI, GDELT, RSS aggregators?)
   - Recommendation: Start with general web search (existing pattern) and user-configurable RSS feeds. GDELT is freely available for geopolitical event data. Specific feed integration can be added incrementally.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/src/orchestration/supervisor.ts` -- BastionSupervisor with LLM routing, classification filtering, checkpointing
- Existing codebase: `backend/src/orchestration/execution-patterns.ts` -- Sequential, Parallel, Hierarchical, Consensus execution patterns
- Existing codebase: `backend/src/agents/team-registry.ts` -- Team lifecycle management with DID assignment
- Existing codebase: `backend/src/graph/construction/graph-builder.ts` -- RAFT extraction with onEntityCreated/onProgress streaming
- Existing codebase: `backend/src/strategic/extraction/extractor.ts` -- Multi-provider LLM extraction with DIME/MIDLIFE
- Existing codebase: `backend/src/exercise/strategic-context-service.ts` -- Token-budgeted context assembly
- Existing codebase: `frontend/src/components/strategic/ExtractionTheater.tsx` -- Animated extraction UI with SSE
- Existing codebase: `backend/src/graph/agents/osint-monitor-agent.ts` -- OSINT agent with A-F/1-6 knowledge
- [NATO STANAG 2511 / AJP-2.1](https://www.researchgate.net/figure/NATO-AJP-21-Source-Reliability-and-Information-Credibility-Scales_tbl1_328858953) -- Source reliability and information credibility scales
- [Admiralty Code - Wikipedia](https://en.wikipedia.org/wiki/Admiralty_code) -- NATO 6x6 system documentation

### Secondary (MEDIUM confidence)
- [LangGraph Multi-Agent Orchestration](https://docs.langchain.com/oss/python/langchain/multi-agent) -- Multi-agent patterns and supervisor architecture
- [LangGraph Branching/Fan-out](https://www.baihezi.com/mirrors/langgraph/how-tos/branching/index.html) -- Parallel execution with supersteps
- [LangGraph Deferred Nodes](https://changelog.langchain.com/announcements/deferred-nodes-in-langgraph) -- Fan-in waiting for all branches
- [Tesseract.js](https://tesseract.projectnaptha.com/) -- OCR library for Node.js

### Tertiary (LOW confidence)
- Predictive analytics patterns -- based on general LLM trend analysis approaches, not verified with specific library

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries already installed and in use in codebase
- Architecture: HIGH -- builds directly on existing BastionSupervisor, TaskExecutor, and LangGraph patterns
- Pitfalls: HIGH -- derived from codebase analysis and LangGraph documentation
- NATO ratings: HIGH -- well-documented international standard (STANAG 2511)
- Provenance/revert: MEDIUM -- pattern is clear but implementation complexity of cascading revocation needs careful design
- Predictive analytics: LOW -- novel capability without established pattern in codebase

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, existing infrastructure)
