# Slide A4: Ironclaw Chief of Staff Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A4 of A17 (Annex)
**Maps to core slides:** 9-10 (Ironclaw: Your Chief of Staff), 18 (Architecture Synthesis)
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

Full technical depth on Ironclaw's architecture — the persistent memory system, proactive polling, Chief of Staff coordination capability, and adaptive relationship development.

## Visual

**Diagram 1: Ironclaw Operating Cycle**

Circular diagram showing the continuous 60-second operational cycle:

```
[Poll: Every 60 seconds]
        ↓
[Analyze Context]
  - Current tab
  - Recent decisions
  - Active planning phase
  - Pending decisions surfaced
        ↓
[Query Memory Graph]
  - Commander preferences
  - Past decisions and their outcomes
  - Standing instructions
  - Patterns in behavior
        ↓
[Surface Decisions]
  - Proactive alerts to decision drawer
  - Contextual suggestions
  - Status summaries
        ↓
[User Response]
  - Approve / Reject / Modify
  - Freeform guidance
        ↓
[Memory Update]
  - Write decision to knowledge graph
  - Update preference model
  - Tag outcome for future pattern matching
        ↓
[Adapt]
  - Adjust suggestion threshold
  - Weight future suggestions by past outcomes
        ↓
[Back to Poll]
```

**Diagram 2: Persistent Memory Graph Structure**

Subgraph showing Ironclaw's memory nodes within the knowledge graph:

Node types:
- Decision (what was decided, timestamp, context)
- Preference (expressed user preference, confidence weight)
- Pattern (recurring behavior detected, frequency count)
- Standing Instruction (persistent guidance, overrides defaults)
- Outcome (follow-up observation on a past decision)

Edge types:
- INFORMED_BY (Decision → Decision — sequential reasoning chain)
- REFLECTS (Pattern → multiple Decisions)
- OVERRIDES (Standing Instruction → default behavior)
- RESULTED_IN (Decision → Outcome)

Annotation: "Auth-scoped — each commander's memory graph is isolated. Ironclaw's personality adapts per user."

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
