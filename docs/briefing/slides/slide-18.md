# Slide 18: Full Architecture Synthesis

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 18 of 25 (Core Deck)
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
Bookend with Slide 6. The audience first encountered a simplified eight-component architecture overview when they had no context for what each piece did. They have now spent twelve slides learning what each component does and why it matters. This slide presents the complete, detailed architecture — the reward for having followed the argument. It is also the moment to highlight Phase 57: Ironclaw's persistent memory graph, the feature that makes the AI Chief of Staff adaptive rather than merely responsive.

## Visual Layout
Title "Full Architecture Synthesis" at top. Subtitle in smaller text: "Every component you have encountered — operating together." Main content: the comprehensive architecture diagram (see Diagram Spec). Bottom right annotation: "Phase 57 — Ironclaw Persistent Memory: the learning element." No body text on slide — the diagram carries the content. Speaker delivers script from memory.

## Image Prompt
No AI image — see Diagram Spec.

## Diagram Spec
Comprehensive architecture diagram, landscape orientation. All major components represented as labeled rectangles. Data flow arrows connecting components. Color coding as specified.

**Core components (blue, #2563EB):**
- "Knowledge Graph" — top-left quadrant. Sub-label: "Entity-relationship storage / OSINT + documents / NATO confidence ratings"
- "Agent Hub" — top-center. Sub-label: "16 deployed AI agents / 8 LangGraph analysis agents / 7 COP layer agents / 1 Ironclaw Chief of Staff"
- "Planning Workflow" — top-right. Sub-label: "6 tabs: Understand / Design / Plan / Direct / COP / Assess / JP 5-0 aligned"

**Blockchain components (cyan, #06B6D4):**
- "Smart Contracts" — middle-left. Sub-label: "check_employment_authorized() / Policy enforcement / Immutable audit"
- "DAO Tiers" — middle-center. Sub-label: "5 authority levels / Coalition-compatible / Human decision gates"
- "DID Registry" — middle-right. Sub-label: "did:near:resource-{uuid} / ResourceCaveats on-chain / Coalition caveats"

**Execution components (sky blue, #0EA5E9):**
- "Robot Bridge" — bottom-left. Sub-label: "Docker / Python agent / NEAR wallet / DDIL-resilient"
- "Edge Robots" — bottom-far-left. Sub-label: "Jetson vision / Sphero RVR+ / 6 doctrinal formations"
- "COP Engine" — bottom-right. Sub-label: "MIL-STD-2525D / Perspective toggle / Phase slider"

**Special component (highlighted with amber, #F59E0B border):**
- "Ironclaw — AI Chief of Staff" — overlaid as a spanning banner across the top of the Agent Hub and Planning Workflow components. Sub-label: "Persistent Memory Graph (Phase 57) — adaptive relationship accumulation across interactions." The amber border distinguishes Ironclaw from the standard blue components. An annotation arrow from the "Persistent Memory Graph" label points to the Knowledge Graph, showing the memory graph as a specialized subgraph of the knowledge layer.

**Data flow arrows (light gray, thin lines):**
- Knowledge Graph ↔ Agent Hub (bidirectional)
- Agent Hub ↔ Planning Workflow (bidirectional)
- Agent Hub → Smart Contracts (unidirectional: agent initiates policy checks)
- Smart Contracts ↔ DAO Tiers (bidirectional: contract enforces, DAO governs)
- DAO Tiers ↔ DID Registry (bidirectional: identity informs authorization)
- Agent Hub → Robot Bridge (unidirectional: orders flow down)
- Robot Bridge ↔ Edge Robots (bidirectional: command and telemetry)
- Knowledge Graph → COP Engine (unidirectional: data drives display)
- DID Registry → Smart Contracts (unidirectional: identity feeds enforcement)

**Background:** White (#FFFFFF). Grid lines in very light gray (#F1F5F9) for visual alignment reference.

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
