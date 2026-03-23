# Understand Tab

> Strategic Environment Analysis — JP 5-0, Step 1

## Purpose

The Understand tab is the entry point for every problem set in BASTION. It ingests
raw documents, extracts structured intelligence, and builds the shared understanding
that drives all downstream planning. This corresponds to **JP 5-0 Step 1: Planning
Initiation / Understanding the Operational Environment**.

Staff use this tab to upload source material, review AI-extracted entities and
relationships, validate strategic objectives, and monitor the evolving intelligence
picture through the RAFT knowledge graph.

---

## Components

### Document Upload

- Accepts **PDF** and **DOCX** files.
- On upload, AI agents automatically extract entities, relationships, and key
  themes.
- Documents are stored with full provenance metadata (uploader, timestamp,
  classification).

### Scenario Package Upload

- Upload a bundled scenario package (multiple documents representing a single
  exercise or contingency).
- AI **tag inference** automatically categorizes documents by domain (political,
  military, economic, etc.) and phase.
- Packages seed the knowledge graph in bulk, accelerating initial understanding.

### Autonomous Document Intelligence Team

The Understand tab runs a **10-specialist AI agent team** that processes uploaded
documents in parallel (Reference: Phase 40):

| Agent | Specialty |
|---|---|
| **Strategic Synthesis** | Cross-document theme extraction and overarching narrative |
| **Entity Resolution** | Deduplication and merging of entity references across sources |
| **OSINT Monitor** | Continuous monitoring for new relevant information |
| **Validity Assessment** | Confidence scoring and unsupported-claim flagging |
| **Conflict Detection** | Contradiction identification between sources |
| **RAFT Extraction** | Knowledge graph construction from documents |
| **RAFT Reasoning** | Graph traversal for non-obvious inference |
| **PMESII Analyst** | PMESII-PT dimension population and gap analysis |
| **Source Reliability** | NATO source reliability rating application |
| **Objective Extractor** | Stated and implied objective identification with traceability |

Agents operate in parallel on uploaded documents; their outputs are aggregated
before staff review, dramatically reducing initial intelligence fusion time.

### ExtractionTheater Live Pipeline Visualization

- Real-time view of the document intelligence pipeline as it runs.
- Shows which agents are active, what document sections they are processing, and
  what entities have been extracted so far.
- Allows staff to intervene early if extraction is going in the wrong direction.
- Completion state displays a structured summary of all extracted elements before
  any enter the knowledge graph.

### Brain Visualization (Knowledge Graph Canvas)

- Adaptive force-directed neural canvas rendering the full knowledge graph for the
  current problem set (Reference: Phase 41).
- Nodes are color-coded by type: actors (blue), locations (green), events (orange),
  objectives (yellow), documents (grey).
- Edges show relationship type and directional strength.
- **Brain Timeline** allows temporal filtering — view the graph at any point in its
  extraction history.
- **Subspace** concept manages graph scale: large problem sets can be divided into
  focused subgraphs for specific staff sections.
- JSON-LD semantic triples underpin the graph, enabling ontology alignment and
  interoperability with external intelligence systems.

### Scoping Interview

- Structured AI-facilitated interview before document upload to scope the problem set.
- Captures: mission type, geographic focus, doctrinal framework, classification level.
- Interview outputs pre-configure extraction filters and agent team parameters.
- Reduces false extractions and focuses the document intelligence pipeline on
  relevant entities and relationships.

### RAFT Graph Visualization

- Interactive force-directed graph of extracted entities and relationships.
- Nodes represent actors, objectives, capabilities, and constraints.
- Edges represent relationships such as supports, opposes, enables, and constrains.
- Filter by entity type, domain, or confidence score.

### NATO Source Reliability Ratings

- Each intelligence input is rated on the **NATO Admiralty Code**:
  - **Source Reliability**: A (Completely Reliable) through F (Reliability Cannot Be Judged)
  - **Information Accuracy**: 1 (Confirmed) through 6 (Truth Cannot Be Judged)
- Ratings are applied by the Source Reliability agent and can be overridden by J2.
- Confidence scores in the knowledge graph incorporate both the source reliability
  and information accuracy ratings.
- Ratings are visible on all extracted entities to support staff judgment.

### PMESII-PT Analysis

- Structured breakdown across all eight PMESII-PT dimensions: Political, Military,
  Economic, Social, Information, Infrastructure, Physical Environment, and Time.
- AI agents populate initial assessments; staff refine and validate.
- Feeds directly into the Design tab's problem framing canvas.

### Strategic Objective Extraction

- AI identifies stated and implied objectives from uploaded documents.
- Objectives are linked to source passages for traceability.
- Staff approve, reject, or modify extracted objectives before they flow downstream.

### Validity Dashboard

- Displays confidence scores and source coverage for each extracted element.
- Flags gaps in intelligence coverage and contradictions between sources.
- Tracks staleness — how recently each assessment was updated.

---

## AI Agents

The Understand tab deploys a **10-specialist autonomous document intelligence team**
(see Components section above). All agents operate under human oversight through the
ExtractionTheater pipeline visualization. Extracted outputs require staff review
before they become authoritative inputs to downstream tabs.

Key agent functions:

| Agent | Function |
|---|---|
| **Strategic Synthesis** | Synthesizes across multiple documents to identify overarching themes and connections. |
| **Entity Resolution** | Deduplicates and merges entity references across documents (e.g., recognizing "PRC" and "China" as the same actor). |
| **OSINT Monitor** | Watches for updates and new information relevant to the current problem set. |
| **Validity Assessment** | Scores confidence levels and flags unsupported claims. |
| **Conflict Detection** | Identifies contradictions between sources or between extracted elements. |
| **RAFT Extraction** | Parses documents to build the Retrieval-Augmented Fine-Tuning knowledge graph. |
| **RAFT Reasoning** | Traverses the knowledge graph to surface non-obvious connections and inferences. |
| **Source Reliability** | Applies NATO Admiralty Code ratings to all intelligence inputs. |

---

## Role Access

- **All staff roles** have read access to the Understand tab.
- **J2 Intelligence** has primary responsibility for validating extracted
  intelligence and maintaining the knowledge graph.
- **Commander** and **J5 Plans** review strategic objectives before handoff to
  Design.

---

## Data Flow

```
Documents / Scenario Packages
        |
        v
  AI Extraction & Analysis
        |
        v
  +--------------------------+
  | Extracted Objectives     |
  | RAFT Knowledge Graph     |
  | PMESII-PT Assessments    |
  | Intelligence Estimates   |
  +--------------------------+
        |
        v
  Design Tab (Problem Framing, CoG Analysis)
```

### Inputs

- Raw documents (PDF, DOCX)
- Scenario packages
- External intelligence feeds (via OSINT monitor)

### Outputs

- Validated strategic objectives
- RAFT knowledge graph
- PMESII-PT structured assessments
- Intelligence gaps and confidence scores

These outputs feed the **Design tab** as the foundation for operational design.

---

## Doctrinal Reference

- **JP 5-0**, Chapter II: Planning Functions — Understanding the Operational
  Environment
- **JP 2-0**, Joint Intelligence
- **ADP 5-0**, The Operations Process — Understanding

---

*Part of the [BASTION Capability Tabs](/) documentation.*
