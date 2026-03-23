# Knowledge Graph

> Adaptive Brain Visualization and Semantic Intelligence Fusion — Phase 41

## Purpose

The Knowledge Graph capability provides BASTION's semantic intelligence
substrate — a living graph of entities, relationships, and confidence scores
extracted from planning documents and intelligence feeds. Visualized through the
**Brain Canvas** on the Understand tab, it transforms raw text into a
force-directed neural graph where analysts can explore connections, assess
confidence, and discover intelligence gaps.

The brain is not a static database — it evolves as new documents are ingested,
entities are resolved across sources, and confidence scores shift with new
evidence.

---

## Components

### Adaptive Brain Visualization

The Brain Canvas renders the knowledge graph as a force-directed neural layout:

- **Node types** distinguished by shape:
  - Circles: Actors (persons, organizations, military units)
  - Diamonds: Objectives and goals
  - Squares: Documents and sources
  - Hexagons: Concepts and capabilities
- **Node colors** by actor category:
  - Blue: Friendly forces
  - Red: Adversary forces
  - Gray: Neutral entities
  - Green: Partner forces
  - Gold: Objectives
- **Node size** proportional to connectivity degree (importance).
- **Confidence glow**: Bright glow on high-confidence entities, dim on low-confidence,
  dashed outline for intelligence gaps (unverified entities).
- **Edge thickness** proportional to relationship confidence weight.

### BrainToolbar

Controls along the canvas:
- **Clustering mode toggle**: Container (group by category), Force (physics-based),
  Timeline (temporal arrangement).
- **Search bar**: Full-text entity search with instant highlight.
- **Timeline scrubber**: Slide through time to see the graph at different points —
  useful for tracking how the intelligence picture evolved across exercise phases.
- **Zoom and pan** controls.

### JSON-LD Semantic Triples

Entities are stored as **JSON-LD** linked data:

- Valid JSON (parseable by any application) and valid RDF (compatible with
  semantic reasoning tools).
- Triples follow subject-predicate-object pattern:
  `{PLA Southern Theater Command} → {commands} → {Eastern Theater Naval Forces}`
- Typed using military planning vocabulary: units, capabilities, objectives,
  lines of effort, tasks, constraints.
- Compatible with W3C standards for cross-system intelligence sharing.

### Entity Resolution

When multiple documents reference the same real-world entity using different
names, abbreviations, or transliterations:

- **String similarity** matching identifies potential duplicates.
- **Context embedding** similarity compares surrounding text.
- **Graph structural evidence** (shared neighbors) supports merge decisions.
- Analysts review merge proposals and confirm or reject.
- Merged entities retain all source provenance for audit.

### Confidence Scoring with NATO Admiralty Code

Every entity carries a confidence assessment based on the **NATO Admiralty Code**:

- **Source Reliability** (A through F): How reliable is the source?
  - A: Completely Reliable, B: Usually Reliable, ..., F: Cannot Be Judged
- **Information Quality** (1 through 6): How accurate is the information?
  - 1: Confirmed, 2: Probably True, ..., 6: Cannot Be Judged
- Combined rating (e.g., "B-2: Usually Reliable / Probably True") displayed on
  each entity's detail card.
- Conflicting claims from different sources produce competing entity attributes
  with differential confidence — analysts see the full evidentiary picture.

### Brain Timeline

- Temporal reasoning: entities and relationships are timestamped.
- The timeline scrubber lets analysts see the graph state at any point.
- Useful for tracking how adversary posture evolved across exercise phases.
- Supports "what changed since last assessment" queries.

### Subspace Concept

For large graphs with hundreds of entities:

- **Subspaces** are analyst-defined focus views that filter the graph to a
  subset of entity types, categories, or geographic regions.
- Subspaces reduce cognitive load without losing the full graph.
- Multiple subspaces can be saved and recalled.

---

## Document Intelligence Pipeline

The brain is fed by an autonomous **10-specialist agent team** that processes
uploaded documents:

1. **Scoping Interview**: AI determines document type and extraction strategy.
2. **ExtractionTheater**: Live pipeline visualization showing agent activity
   with SSE particle animation flowing from sidebar into brain canvas.
3. **Entity extraction**: Named entities, relationships, and attributes pulled
   from text.
4. **OSINT gap filling**: Agents query external sources to fill identified
   intelligence gaps.
5. **Graph merge**: New entities integrated with existing graph, entity
   resolution applied.

---

## Role Access

| Role | Access |
|---|---|
| **Commander** | Views brain for strategic assessment. Receives intelligence summaries. |
| **J2 Intelligence** | Primary user. Manages entity resolution, confidence updates, and gap analysis. |
| **J3 Operations** | Views brain for operational planning context. Links entities to plans. |
| **Analyst** | Processes documents through pipeline. Reviews entity extractions. |

---

## Data Flow

```
Document Upload (Understand Tab)
        |
        v
  Scoping Interview (AI determines strategy)
        |
        v
  ExtractionTheater (10-agent pipeline)
        |
        v
  Entity Extraction + JSON-LD Serialization
        |
        v
  Entity Resolution + Confidence Scoring
        |
        v
  +-----------------------------+
  | Brain Canvas (Neural Graph) |
  | Force-directed layout       |
  | Confidence glow + shapes    |
  | Timeline scrubber           |
  +-----------------------------+
        |
        v
  Plan Tab (entity references)
  COP Tab (entity-symbol linkage)
  Assess Tab (intelligence readiness)
```

---

## Doctrinal Reference

- **JP 2-0**, Joint Intelligence — All-source analysis and fusion
- **ATP 2-33.4**, Intelligence Analysis — Structured analytic techniques
- **BASTION Phase 41**: Knowledge Graph and Brain Visualization
- See also: [Understand Tab](understand-tab.md) — Brain is the centerpiece of this tab

---

*Part of the [BASTION Capability Tabs](/) documentation.*
