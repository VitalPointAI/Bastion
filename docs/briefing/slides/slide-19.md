# Slide 19: Tradeoffs — What We Chose and Sacrificed

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 19 of 25 (Core Deck)
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
Honest accounting. Academic rigor demands acknowledging that every design decision is an argument — something chosen over something else, with understood costs. This slide prevents the presentation from reading as uncritical advocacy. It establishes intellectual credibility with the academic audience and practical credibility with the technical audience.

## Visual Layout
Title "Tradeoffs — What We Chose and Sacrificed" at top. Subtitle: "Every system is an argument. Here is what we argued for — and what we gave up." Main content: the six-row tradeoff table (see below). Table columns are: Decision / Chose / Over / Why. Clean table formatting — alternating light gray (#F8FAFC) and white row backgrounds, column headers in blue (#2563EB) text.

## Image Prompt
No AI image — the table is the primary visual.

## Diagram Spec
No diagram — see the tradeoff table in the Visual Layout section.

**Tradeoff Table:**

| Decision | Chose | Over | Why |
|----------|-------|------|-----|
| Blockchain platform | NEAR Protocol | Ethereum / Solana / Hyperledger | Sharding scalability, human-readable account IDs, low gas fees, WebAssembly contract execution |
| Governance model | DAOs | Traditional RBAC | Verifiable on-chain decisions, independent audit, coalition-compatible without shared directory |
| Storage architecture | Hybrid (PostgreSQL + blockchain) | Pure on-chain | Operational data needs relational queries and speed; governance and identity need immutability |
| AI orchestration | LangGraph | LangChain / AutoGen / raw API | Graph-based workflow control enables conditional branching and explicit state machines |
| Edge architecture | Docker bridge agent | Direct hardware integration | Procurement and policy constraints make hardware-specific nodes impractical; Docker provides hardware agnosticism |
| Identity standard | DIDs (W3C standard) | OAuth / SAML / PKI | Decentralized — no central authority required; coalition-compatible without shared identity provider |

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
