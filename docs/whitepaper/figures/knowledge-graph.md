# Figure: Knowledge Graph and Brain Visualization Architecture

## Diagram Type

Split-view diagram showing data pipeline (left) and visualization output (right) for BASTION's adaptive brain/knowledge graph system.

## Layout

**Orientation:** Landscape / split view (50/50)
**Target Dimensions:** 1200×800 pixels
**Export:** 300 DPI PNG for print

## Left Side: Data Pipeline (Top to Bottom Flow)

### Stage 1: Document Ingestion
- **Shape:** Rectangle with document icon
- **Label:** "Document Ingestion"
- **Detail:** "10-Specialist Agent Team"
- **Subcomponents shown:**
  - "Scoping Interview" — determines extraction strategy
  - "ExtractionTheater" — live pipeline visualization with SSE particle animation
- **Color:** Light blue (#bee3f8)

### Stage 2: Entity Extraction
- **Shape:** Rectangle
- **Label:** "Entity Extraction"
- **Detail:** "Named entities, relationships, attributes"
- **Types shown as small icons:**
  - Person (circle), Organization (hexagon), Location (diamond), Event (star), Objective (triangle)
- **Color:** Blue (#3182ce)

### Stage 3: JSON-LD Serialization
- **Shape:** Rectangle with code icon
- **Label:** "JSON-LD Triples"
- **Detail:** "W3C Linked Data format"
- **Example triple shown:** `{PLA} → {threatens} → {Taiwan}`
- **Color:** Purple (#9f7aea)

### Stage 4: Graph Storage
- **Shape:** Cylinder (database)
- **Label:** "PostgreSQL + Graph Index"
- **Detail:** "RAFT semantic graph"
- **Color:** Teal (#38b2ac)

### Stage 5: Confidence Scoring
- **Shape:** Rectangle with gauge icon
- **Label:** "NATO Admiralty Code Scoring"
- **Detail:** "Source Reliability (A-F) × Information Quality (1-6)"
- **Example:** "B-2: Usually Reliable / Probably True"
- **Color:** Gold (#d69e2e)

### Stage 6: Brain Canvas (arrow leads to right side)
- Arrow labeled "Render" pointing right

## Right Side: Brain Visualization (Neural Canvas Mockup)

### Canvas Area
- **Background:** Dark (#1a202c) representing the brain canvas
- **Layout:** Force-directed graph with visible clustering

### Node Types (with example data from Pacific Strategy AY26)

| Shape | Type | Color | Example |
|-------|------|-------|---------|
| Circle | Actor/Entity | Red (#e53e3e) for adversary | "PLA Southern Theater Command" |
| Circle | Actor/Entity | Blue (#3182ce) for friendly | "USS Ronald Reagan CSG" |
| Circle | Actor/Entity | Gray (#a0aec0) for neutral | "Republic of China" |
| Diamond | Objective | Gold (#d69e2e) | "Sea Control — Taiwan Strait" |
| Square | Document | Purple (#9f7aea) | "INDOPACOM Campaign Plan" |
| Hexagon | Concept | Teal (#38b2ac) | "Anti-Access/Area Denial" |

### Visual Properties

- **Node size:** Proportional to connectivity degree (more connections = larger)
- **Node glow:** Bright glow on high-confidence entities, dim glow on low-confidence
- **Dashed outline:** Intelligence gaps (unverified entities)
- **Edge thickness:** Proportional to relationship confidence weight
- **Edge opacity:** Fades with lower confidence
- **Clusters:** Related entities visually grouped (container mode)

### Canvas Controls (Bottom Bar)

- **BrainToolbar** rendered below canvas:
  - Clustering mode toggle: "Container" | "Force" | "Timeline"
  - Search bar
  - Timeline scrubber: slider from "Competition" to "Negotiation" (exercise phases)
  - Zoom controls

### Detail Panel (Right Edge)

- **Selected entity card:** "PLA Southern Theater Command"
  - Type: Adversary
  - Confidence: 0.78
  - NATO Rating: B-2 (Usually Reliable / Probably True)
  - Sources: 3 documents
  - Relations: 8 connections
  - First seen: Competition phase

## Connection Lines Between Sides

- Arrow from "Confidence Scoring" (left) to canvas nodes (right), labeled "Render to Canvas"
- Arrow from canvas selection (right) back to "Graph Storage" (left), labeled "Query Detail"

## Color Legend

| Color | Meaning |
|-------|---------|
| Red (#e53e3e) | Adversary entities |
| Blue (#3182ce) | Friendly entities |
| Gray (#a0aec0) | Neutral entities |
| Gold (#d69e2e) | Objectives |
| Purple (#9f7aea) | Documents / JSON-LD |
| Teal (#38b2ac) | Concepts / storage |
| Green (#38a169) | Partner entities |

## Key Labels (Use Actual Component Names)

- "BrainCanvas" not "graph visualization"
- "BrainToolbar" not "controls"
- "ExtractionTheater" not "processing display"
- "RAFT graph" not "knowledge graph storage"
- "JSON-LD triples" not "RDF"
- "NATO Admiralty Code" not "confidence system"
- Node types match `brain_entity_type` enum in codebase

## Cross-References

- Knowledge graph architecture: See Section 3.15 in `03-methodology.md`
- Background: See Section 2.5 in `02-background-knowledge-graphs.md`
- Entity resolution: See Section 2.5.4 in `02-background-knowledge-graphs.md`
- Document intelligence: See Section 3.17 in `03-methodology.md`

---

*Figure specification for AI image generation. Use with Mermaid, Figma, or diagram tool.*
*Document version: 1.0 — 2026-03-23*
