# Slide A3: Agent Architecture Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A3 of A17 (Annex)
**Maps to core slides:** 8-9 (Agent Hub and Operational Advisors)
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

Full agent taxonomy, orchestration architecture, and multi-model design.

## Visual

**Diagram 1: Agent Taxonomy Tree**

Hierarchical tree showing all agent categories and example agents under each:

```
BASTION Agent Hub (16 deployed AI agents)
├── Ironclaw: Chief of Staff Agent (1 agent)
│   ├── 60-second proactive polling loop
│   ├── Persistent memory graph (Phase 57)
│   └── Cross-tab context synthesis
│
├── LangGraph Analysis Agents (8 agents)
│   ├── IPB Agent (Intelligence Preparation of the Battlefield)
│   ├── OSINT Agent (Open Source Intelligence)
│   ├── All-Source Fusion Agent
│   ├── Threat Assessment Agent
│   ├── Mission Analysis Agent
│   ├── COA Development Agent
│   ├── Risk Assessment Agent
│   └── Operational Design Agent
│
└── COP Layer Agents (7 agents)
    ├── NER Extraction Agent
    ├── Tactical Graphic Mapping Agent
    ├── Symbol Generation Agent
    ├── Perspective Toggle Agent
    ├── Phase Filter Agent
    ├── Conflict Detection Agent
    └── Map Overlay Agent
```

**Diagram 2: LangGraph Orchestration Flow**

Sample workflow — COA Development:
```
User Request
    ↓
Orchestrator Agent (selects workflow)
    ↓
Mission Analysis Agent → outputs: Mission Statement, CCIR
    ↓
[Parallel execution]
    ├── COA Alpha Agent → COA sketch + description
    ├── COA Bravo Agent → COA sketch + description
    └── COA Charlie Agent → COA sketch + description
    ↓
COA Comparison Agent → Weighted analysis against criteria
    ↓
Risk Assessment Agent → Risk overlay for each COA
    ↓
Recommendation to J3 Staff Officer
    ↓
Human Decision Gate (MDMP Step 5: COA Approval)
```

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
