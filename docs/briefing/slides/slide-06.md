# Slide 6: Simplified Architecture Overview

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 6 of 25 (Core Deck)
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
Give the audience a map before diving into capabilities. This is the "you are here" moment — a deliberately simplified diagram showing BASTION's major components and how they connect. Not detailed. Not complete. Just enough to orient the audience so the capability sections that follow feel like they fit into a coherent system rather than appearing as isolated features.

## Visual Layout
White slide. Title "What We Built — Architecture Overview" in blue (#2563EB), 28pt. Central diagram occupying 80% of the slide area, with component blocks connected by directional arrows showing data flow. Below the diagram: one line of text "Each block will be unpacked in the following slides." Navigation note at bottom right showing the five capability sections: Understanding → Planning → Governing → Executing → Trusting.

## Image Prompt
No AI image — diagram (see Diagram Spec below).

## Diagram Spec
Simplified block architecture diagram — white background, blue (#2563EB) blocks, cyan (#06B6D4) data flow arrows, gray (#94A3B8) secondary elements.

Layout (top to bottom, left to right):

**Top row (input/intelligence layer):**
- Block: "Knowledge Graph" (Neo4j + JSON-LD) [blue, left position]
- Block: "Agent Hub" (16 Deployed AI Agents) [blue, center position]
- Block: "Pacific Strategy AY26 Scenario" [gray, right position — context only]

**Middle row (platform layer):**
- Block: "Doctrinal Workflow" (Understand / Design / Plan / Decide / COP / Assess) [blue, full width, centered]

**Lower middle row (governance/identity layer):**
- Block: "Smart Contracts + DAOs" (NEAR Blockchain) [cyan, left position]
- Block: "DID Registry" (did:near:resource-{id}) [cyan, center position]
- Block: "Robot Bridge" (Python Agent + mDNS) [blue, right position]

**Bottom row (output layer):**
- Block: "Physical Execution" (Sphero RVR+ + Jetson) [blue, left position]
- Block: "Immutable Audit Trail" (NEAR Ledger) [cyan, center position]
- Block: "Coalition Reporting" [blue, right position]

Arrows:
- Knowledge Graph → Agent Hub (bidirectional)
- Agent Hub → Doctrinal Workflow (down)
- Doctrinal Workflow → Smart Contracts + DAOs (down-left)
- Doctrinal Workflow → DID Registry (down-center)
- Doctrinal Workflow → Robot Bridge (down-right)
- Smart Contracts + DAOs → Immutable Audit Trail (down)
- Robot Bridge → Physical Execution (down)
- Physical Execution → Coalition Reporting (right)

All arrows: thin, directional, in cyan (#06B6D4) with arrowheads.

Font in blocks: 10pt white text for block names, 8pt white text for descriptions in parentheses.

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
