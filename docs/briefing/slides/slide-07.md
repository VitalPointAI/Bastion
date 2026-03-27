# Slide 7: The Intelligence Brain — Knowledge Graph

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 7 of 25 (Core Deck)
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
First capability slide. Show how strategic understanding accumulates in BASTION through the knowledge graph. The "brain" metaphor does cognitive work: it makes an abstract technical system feel like something the audience already understands — the collective memory of a staff. The concrete mechanism — JSON-LD entity relationships — proves it was built, not just theorized.

## Visual Layout
Left side (55%): Diagram showing the knowledge graph visualization concept (see Diagram Spec). Right side (45%): Title "The Intelligence Brain" in blue (#2563EB), 28pt bold. Below: Three key points as short labeled blocks:
- "Every entity. Every relationship." — description of the graph structure
- "Scoped to your problem set." — description of subspace isolation
- "Intelligence that accumulates, not just searches." — the differentiating capability vs. keyword search

Below the three points: a small concrete example box with a gray (#F8FAFC) background: "Example: A SITREP mentions 'PLA 74th Army Group operating near Hualien.' BASTION creates: entity [PLA 74th Army Group] → relationship [LOCATED_NEAR] → entity [Hualien] → property [source: SITREP-20260312, reliability: B-2 per NATO STANAG 2022]."

## Image Prompt
No AI image — diagram carries the argument (see Diagram Spec).

## Diagram Spec
Force-directed knowledge graph visualization concept. White background (#FFFFFF). Node clusters connected by typed relationship lines.

Nodes (circles):
- Large central node: "BASTION Knowledge Graph" — blue (#2563EB), 30px diameter, bold label
- Medium nodes: "PLA 74th Army Group" [blue], "Hualien Province" [blue], "Pacific AOR" [blue], "JSOC Task Force" [blue], "USS Carl Vinson" [blue] — 20px diameter
- Small nodes: property nodes (dates, reliability ratings, source documents) — light gray (#94A3B8), 12px diameter

Relationship lines (connecting medium nodes):
- "LOCATED_NEAR" — cyan (#06B6D4) line between "PLA 74th Army Group" and "Hualien Province"
- "COMMANDS" — blue (#2563EB) line
- "OPPOSES" — sky blue (#0EA5E9) line
- "ASSESSED_BY" — gray (#94A3B8) dashed line to reliability rating property nodes

Subspace boundary: a soft-edged blue circle (#EFF6FF, fill opacity 0.3) enclosing a subset of nodes with label "Problem Set: Taiwan Contingency (Phase 3)" — showing that this intelligence is scoped to this specific problem set.

Layout: nodes arranged organically (force-directed style), not in a grid. Central cluster dense, peripheral nodes sparser.

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
