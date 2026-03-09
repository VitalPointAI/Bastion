# Phase 40: Autonomous Document Intelligence Team — Design Document

## Vision

When a user uploads a document to a problem set, they should be able to walk away. The system figures out what it is, how relevant it is, what facts/objectives/actors it contains, how it relates to everything else, whether the source is reliable, what perspective it represents, and where it fits in the knowledge graph — all autonomously.

Beyond reactive document processing, the system proactively researches the problem set using available tools (web search, OSINT feeds, open-source intelligence) to fill knowledge gaps and build the most complete strategic picture possible.

The only user involvement is: (1) a one-time scoping interview when setting up the problem set, and (2) supplying documents they think might be relevant.

## Architecture

### Layer 1: Problem Set Scoping Interview

Before the document team can operate effectively, it needs context about what the problem set is about. This is a conversational interface (chat-like) that captures:

- **Geographic scope** — What regions/countries are involved?
- **Temporal bounds** — What time period is relevant? (historical context, planning horizon)
- **Key actors of interest** — Who are the primary actors to track?
- **Classification ceiling** — What's the highest classification level for this problem set?
- **Echelon level** — Strategic / Operational / Tactical
- **Domain focus** — DIME/MIDLIFE emphasis areas
- **Standing intelligence requirements** — What does the user need to know/monitor?
- **Known information gaps** — What does the user wish they knew?

This produces a structured `ProblemSetContext` schema stored in PostgreSQL, consumed by every agent as grounding context. The interview is re-enterable — users can refine scope over time.

### Layer 2: Document Intelligence Team

```
Document Upload
      │
      ▼
┌─────────────────┐
│   ORCHESTRATOR   │ ← Reads ProblemSetContext
│  (Triage Agent)  │
└────────┬────────┘
         │ Determines document type, relevance, specialist needs
         │
    ┌────┴────┬──────────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼          ▼
┌────────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌──────┐
│Converter│ │Class-│ │  Fact  │ │Perspect│ │Bias  │
│(if nec.)│ │ifier │ │Extract.│ │Analysts│ │Ident.│
└────┬───┘ └──┬───┘ └───┬────┘ └───┬────┘ └──┬───┘
     │        │         │          │          │
     └────────┴─────────┴──────────┴──────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Quality Assess  │ ← NATO A-F / 1-6 rating
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Cross-Doc Linker │ ← Compares against existing graph
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  ORCHESTRATOR    │ ← Aggregates all findings
              │  (Final Report)  │
              └────────┬────────┘
                       │
                       ▼
              Knowledge Graph + Document Summary + Container Placement
```

### Layer 3: Autonomous Researcher

A background process (not per-document) that:

1. Analyzes the problem set's knowledge graph for gaps
2. Reviews standing intelligence requirements
3. Uses web search / OSINT tools to find relevant information
4. Generates research briefs that enter the document pipeline as system-generated documents
5. Runs on a configurable cadence (or triggered by specific events like new document upload revealing gaps)

## Agent Specifications

### Document Orchestrator
- **Role**: Coordinator
- **LangGraph pattern**: Hub-and-spoke with conditional specialist routing
- **Input**: Raw document + ProblemSetContext
- **Triage logic**: Document type → specialist selection matrix
  - Intelligence estimate → [Converter, Classifier, FactExtractor, PerspectiveAnalysts(adversary+friendly), BiasIdentifier, QualityAssessor, Linker]
  - Policy document → [Converter, Classifier, FactExtractor, ObjectiveExtractor, BiasIdentifier, QualityAssessor, Linker]
  - News article → [Classifier, FactExtractor, BiasIdentifier, QualityAssessor, Linker]
  - Academic paper → [Classifier, FactExtractor, ObjectiveExtractor(conditional), QualityAssessor, Linker]
  - CONOP/OPLAN → [Converter, Classifier, FactExtractor, ObjectiveExtractor, PerspectiveAnalysts(friendly), Linker]
  - Unknown → [Converter, Classifier, FactExtractor, BiasIdentifier, QualityAssessor, Linker]
- **Parallelism**: Independent specialists run in parallel; Linker and QualityAssessor run after extractors complete
- **Output**: Unified DocumentIntelligenceReport

### Format Converter
- **When invoked**: Document has OCR needs (scanned PDF), non-English content, unusual encoding, embedded tables/charts
- **Tools**: Tesseract OCR, language detection, table extraction
- **Output**: Clean text + extracted tables/charts + language metadata

### Document Classifier
- **Input**: Document text + metadata + ProblemSetContext
- **Output**:
  - `documentType`: enum of ~15 military/policy/intel types
  - `classificationLevel`: UNCLASS through TS/SCI
  - `relevanceScore`: 0-1 against problem set scope
  - `suggestedContainers`: ranked list of existing containers + proposed new ones
  - `suggestedActorCategory`: ally/adversary/neutral/partner
  - `keyTopics`: tag cloud for indexing

### Perspective Analysts
- **Instantiation**: One per relevant perspective (determined by orchestrator)
- **Perspectives**: Friendly, Adversary, Neutral, Partner (extensible)
- **Input**: Document text + perspective context + known actor information from graph
- **Output per perspective**:
  - `implications`: What does this mean for this perspective?
  - `opportunities`: What advantages does this create?
  - `threats`: What risks does this surface?
  - `unknowns`: What questions remain from this perspective?

### Fact Extractor
- **Output schema**: Array of structured facts
  ```
  {
    claim: string,
    type: 'entity' | 'date' | 'location' | 'quantity' | 'assertion' | 'capability',
    confidence: number,
    sourceReference: { page, paragraph, quote },
    entities: string[],  // named entities involved
    temporalContext: string | null,
    geospatialContext: string | null,
  }
  ```
- Facts become nodes/properties in the knowledge graph

### Cross-Document Linker
- **Operates after**: FactExtractor + existing graph loaded
- **Detection**:
  - Entity co-reference across documents
  - Temporal sequencing (event A in doc 1 precedes event B in doc 2)
  - Corroboration (same claim from independent sources → higher confidence)
  - Contradiction (conflicting claims → tension node in graph)
- **Output**: Array of `DocumentLink` objects with type, strength, evidence

### Quality Assessor (NATO Standard)
- **Source Reliability** (A-F):
  - A: Completely reliable
  - B: Usually reliable
  - C: Fairly reliable
  - D: Not usually reliable
  - E: Unreliable
  - F: Reliability cannot be judged
- **Information Credibility** (1-6):
  - 1: Confirmed by other sources
  - 2: Probably true
  - 3: Possibly true
  - 4: Doubtful
  - 5: Improbable
  - 6: Truth cannot be judged
- **Assessment factors**: Source history, internal consistency, corroboration level, recency, known biases

### Problem Set Researcher
- **Trigger conditions**:
  - New problem set created (after scoping interview)
  - Knowledge gap identified in graph analysis
  - Standing intelligence requirement not yet addressed
  - Periodic cadence (configurable, default daily)
  - User-initiated research request
- **Tools**: web_search, OSINT feed APIs, open-source databases
- **Output**: Research briefs (markdown documents) that auto-ingest through the same pipeline
- **Budget**: Configurable API call / token budget per research cycle

## ExtractionTheater Integration

The existing ExtractionTheater (Phase 52 PR) shows extraction → graph visualization. This phase extends it to show the full multi-agent pipeline:

- Left panel: Agent activity feed showing which specialists are active
- Center: Flow particles colored by agent type
- Right: Live graph building from all agent outputs
- New: Agent status cards showing which specialists are running, queued, complete

## Data Model Changes

### New Tables
- `problem_set_context` — Scoping interview output (JSON schema + structured fields)
- `document_intelligence_reports` — Orchestrator output per document
- `fact_registry` — Structured facts with source attribution
- `document_links` — Cross-document relationship edges
- `source_ratings` — NATO A-F / 1-6 per document
- `research_briefs` — Auto-generated research products
- `standing_requirements` — Persistent intelligence requirements

### Graph Additions
- `Fact` nodes connected to `Actor`, `Document` nodes
- `CORROBORATES` / `CONTRADICTS` edges between facts
- `RESEARCHED_BY` edge from research briefs to gap nodes
- Source reliability as property on document-linked edges

## Implementation Priority

1. **Plan 01** — Scoping interview (foundation — everything else depends on context)
2. **Plan 02** — Orchestrator (hub that coordinates everything)
3. **Plan 03** — Converter + Classifier (first things orchestrator needs)
4. **Plan 04** — Fact + Objective extractors (core value)
5. **Plan 05** — Perspective analysts (unique differentiator)
6. **Plan 06** — Linker + Bias identifier (cross-document intelligence)
7. **Plan 07** — Quality assessor + NATO ratings (trust layer)
8. **Plan 08** — Autonomous researcher (proactive intelligence)

Plans 3-5 can partially parallelize. Plans 6-7 depend on extractors. Plan 8 is most independent.
