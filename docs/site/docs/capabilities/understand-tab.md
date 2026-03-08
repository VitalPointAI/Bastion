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

### RAFT Graph Visualization

- Interactive force-directed graph of extracted entities and relationships.
- Nodes represent actors, objectives, capabilities, and constraints.
- Edges represent relationships such as supports, opposes, enables, and constrains.
- Filter by entity type, domain, or confidence score.

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

| Agent | Function |
|---|---|
| **Strategic Fusion** | Synthesizes across multiple documents to identify overarching themes and connections. |
| **Entity Resolution** | Deduplicates and merges entity references across documents (e.g., recognizing "PRC" and "China" as the same actor). |
| **OSINT Monitor** | Watches for updates and new information relevant to the current problem set. |
| **Validity Assessment** | Scores confidence levels and flags unsupported claims. |
| **Conflict Detection** | Identifies contradictions between sources or between extracted elements. |
| **RAFT Extraction** | Parses documents to build the Retrieval-Augmented Fine-Tuning knowledge graph. |
| **RAFT Reasoning** | Traverses the knowledge graph to surface non-obvious connections and inferences. |

All agents operate under human oversight. Extracted outputs require staff review
before they become authoritative inputs to downstream tabs.

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
