# Slide 8: Autonomous Document Intelligence

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 8 of 25 (Core Deck)
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
Show the 10-agent pipeline that transforms raw documents into structured intelligence in the knowledge graph. This slide bridges from "what the brain looks like" (Slide 7) to "how information gets into the brain." The pipeline diagram makes the automation tangible and the NATO reliability rating detail proves the implementation depth.

## Visual Layout
Full-width pipeline flow diagram occupying 65% of the slide area (see Diagram Spec). Above the diagram: title "From Document to Understanding — Automated" in blue (#2563EB), 24pt. Below the diagram: three capability callouts in a horizontal row:
- Callout 1: "NATO STANAG 2022" — "Source reliability (A-F) and information reliability (1-6) applied automatically by the Rating Agent"
- Callout 2: "Conflict Detection" — "When two sources disagree on the same fact, BASTION flags the conflict and surfaces it for analyst review — never silently resolves it"
- Callout 3: "10 Specialized Agents" — "Each stage has dedicated AI: classification, extraction, rating, conflict detection, graph integration — running in parallel across all uploaded documents"

## Image Prompt
No AI image — pipeline diagram (see Diagram Spec).

## Diagram Spec
Left-to-right horizontal pipeline flow diagram. White background. Blue (#2563EB) agent stage blocks connected by cyan (#06B6D4) directional arrows.

Pipeline stages (left to right):

1. **Document Upload** [gray intake block, #F1F5F9] — label: "SITREP, HUMINT, OSINT, Partner Report" — icon: document stack
2. **Classification Agent** [blue block #2563EB] — label: "Classification Agent" — sublabel: "Identifies document type, origin, classification level"
3. **Entity Extraction Agent** [blue block] — label: "Entity Extraction Agent" — sublabel: "Identifies actors, locations, equipment, events"
4. **Relationship Mapping Agent** [blue block] — label: "Relationship Mapping Agent" — sublabel: "Structures typed relationships between entities"
5. **NATO Rating Agent** [blue block] — label: "Reliability Rating Agent" — sublabel: "Applies STANAG 2022 A-F / 1-6 ratings"
6. **Conflict Detection Agent** [blue block] — label: "Conflict Detection Agent" — sublabel: "Flags contradictions between sources"
7. **Graph Integration Agent** [blue block] — label: "Graph Integration Agent" — sublabel: "Merges entities, updates relationships in Knowledge Graph"
8. **Knowledge Graph** [large cyan block #0EA5E9 with rounded corners] — label: "Knowledge Graph Updated" — icon: network nodes

Connecting arrows: cyan (#06B6D4), 2px, with arrowheads pointing right. Each arrow connects one stage to the next.

Above the pipeline, a small branch arrow from "Conflict Detection Agent" pointing upward to a yellow (#FBBF24) alert block labeled "Analyst Flag: Review Required" — showing that conflicts surface for human review.

Width: full slide width. Agent stage blocks: equal width (~90px each), 50px height, white text labels inside.

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
