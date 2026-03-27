# Slide A9: COP Generation Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A9 of A17 (Annex)
**Maps to core slides:** 15 (AI Common Operating Picture)
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

Full pipeline for how BASTION generates COP symbols from planning documents using AI extraction.

## Visual

**Diagram 1: COP Generation Pipeline**

```
Input: Planning Document (OPORD, Intel Report, SITREP)
        ↓
[NLP Pre-processing]
  - Document chunking
  - Language normalization
  - Sentence boundary detection
        ↓
[Named Entity Recognition (NER)]
  - Extract: unit names, personnel, locations, equipment
  - Tag entity type and context
  - Assign initial confidence score
        ↓
[Relationship Extraction]
  - Identify COMMANDS, LOCATED_AT, PARTICIPATES_IN relationships
  - Link entities to previously known graph nodes (coreference)
  - Merge with existing knowledge graph
        ↓
[Tactical Graphic Mapping]
  - Entity type → MIL-STD-2525D symbol code
  - Affiliation from context (friendly / hostile / neutral / unknown)
  - Size indicator from unit echelon mention
  - Function indicator from unit type
        ↓
[SVG Symbol Generation]
  - Generate MIL-STD-2525D compliant SVG per entity
  - Annotate with unit designation, status, confidence score
        ↓
[Map Overlay]
  - Geocode locations to lat/lon coordinates
  - Place symbols on map
  - Link symbol to knowledge graph node (click → entity detail)
        ↓
COP: Live tactical map with selectable, linked symbols
```

**Diagram 2: COP Filters**

Two filter controls shown:
1. Perspective Toggle: [Friendly View] / [Adversary View] / [Full Picture] — controls which affiliation symbols are visible
2. Phase Slider: [Competition] → [Crisis] → [Day 4] → [Day 10] → [Day 22] → [Negotiation] — filters symbols by temporal phase tag

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
