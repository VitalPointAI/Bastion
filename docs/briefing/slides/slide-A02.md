# Slide A2: Knowledge Graph Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A2 of A17 (Annex)
**Maps to core slides:** 7 (Knowledge as Infrastructure)
**Date:** 2026-03-26

## Style Reference

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary Blue | `#2563EB` | blue-600 | Headings, primary UI elements, architecture blocks |
| Sky Blue | `#0EA5E9` | sky-500 | Secondary accents, data flow lines |
| Cyan | `#06B6D4` | cyan-500 | Blockchain/crypto elements, DID references |
| White | `#FFFFFF` | white | All backgrounds |
| Light Gray | `#F8FAFC` | slate-50 | Slide background variant |
| Dark Text | `#0F172A` | slate-900 | Body text |
| Muted Text | `#64748B` | slate-500 | Captions, sub-labels |

**Rule:** Never use dark backgrounds. Never use tactical/military dark aesthetic. BASTION on the second screen provides the tactical visual; the deck is the clean analytical layer.

## Purpose

Full technical depth on how BASTION's knowledge graph is structured, what it stores, and how it grows over time.

## Visual

**Diagram 1: Entity-Relationship Schema**

Detailed entity-relationship diagram showing actual node types and edge types in BASTION's knowledge graph.

Node types (circles, color-coded by category):
- Person (blue): commander, staff officer, analyst, liaison
- Organization (dark blue): unit, headquarters, coalition partner, NGO
- Location (green): geographic point, area, objective, LZ, named area of interest
- Equipment/Resource (orange): platform, system, sensor, robot, logistics item
- Event (red): incident, operation, engagement, intelligence report, decision
- Document (gray): OPORD, FRAGO, intelligence report, assessment
- Concept (purple): COG, LOE, objective, end state, center of gravity

Edge types (labeled arrows):
- COMMANDS (Person → Organization)
- LOCATED_AT (Person/Organization/Equipment → Location)
- PARTICIPATES_IN (Person/Organization → Event)
- PRODUCES (Person/Organization/Event → Document)
- REFERENCES (Document → any node)
- SUPPORTS / THREATENS (Organization → Organization)
- OWNED_BY (Equipment → Organization)
- EXTRACTED_FROM (any node → Document — provenance link)

**Diagram 2: Growth Over Time**

Timeline showing how graph density increases: T0 (upload OPORD: ~40 nodes), T1 (add intel reports: +80 nodes), T2 (add ORBAT: +60 nodes), T3 (operations begin, events ingested: ongoing growth). Annotation: "Every document uploaded adds nodes and edges. The graph is never 'complete' — it reflects current knowledge."

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
