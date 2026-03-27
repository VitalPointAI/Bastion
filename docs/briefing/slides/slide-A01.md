# Slide A1: Visual Glossary

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A1 of A17 (Annex)
**Maps to core slides:** All — reference slide for the full deck
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

Quick reference for all technical terms used in the deck. Use this when an audience member asks "wait, what does that mean?" — or hand it to the thesis advisor before the defense.

## Visual

Multi-column glossary layout (3 columns), organized by category with color-coded headers. Each term: bold term name + plain language definition + one-sentence relevance to BASTION. Compact typography to maximize coverage on one slide.

**Category 1 — Blockchain & Web3** (blue header)

| Term | Definition | Relevance to BASTION |
|------|-----------|----------------------|
| Blockchain | Distributed ledger — a shared record no single party can alter | Tamper-evident audit trail for every governance decision |
| DAO | Decentralized Autonomous Organization — governance encoded in software | BASTION's 5-tier command authority structure, programmatically enforced |
| Smart Contract | Self-executing program on a blockchain — rules run automatically when conditions are met | Policy enforcement: checks if an action is authorized before it happens |
| DID | Decentralized Identifier — globally unique, owner-controlled identity | Every resource, person, agent, and robot in BASTION has a DID |
| NEAR Protocol | Proof-of-stake blockchain with human-readable accounts and sub-second finality | BASTION's on-chain substrate — chosen for speed, cost, and developer ergonomics |
| TEE | Trusted Execution Environment — hardware-isolated computing environment | Attestation layer for verifying data provenance at the hardware level |
| Gas | Transaction cost on a blockchain | NEAR gas costs are fractions of a cent; not a practical constraint at prototype scale |

**Category 2 — Military Doctrine** (olive/dark header)

| Term | Definition | Relevance to BASTION |
|------|-----------|----------------------|
| C2 | Command and Control — the exercise of authority and direction by a commander | BASTION's entire purpose: AI-enabled C2 with verifiable authority chains |
| COP | Common Operating Picture — shared situational awareness across all echelons | BASTION generates COP from planning documents using AI extraction |
| MDMP | Military Decision Making Process — the Army's 7-step planning methodology | BASTION structures its planning tabs around MDMP phases |
| JPP | Joint Planning Process — the Joint Staff methodology for operational planning | BASTION's 16 deployed agents support the JPP planning structure |
| JP 5-0 | Joint Publication 5-0 — the doctrinal manual for joint operation planning | The authority reference for BASTION's operational design and planning concepts |
| COG | Center of Gravity — the source of power that provides moral or physical strength | BASTION's AI analyzes COGs and critical vulnerabilities in its Design tab |
| LOE | Line of Effort — a logical line connecting actions focused on an end state | BASTION's campaign plan organizes operations by lines of effort |
| OPORD | Operation Order — a directive issued by a commander to subordinate units | BASTION generates OPORD sections from its knowledge graph and planning inputs |
| FRAGO | Fragmentary Order — an abbreviated OPORD issued as a change to an existing order | BASTION can generate FRAGOs automatically when conditions in the COP change |
| DDIL | Degraded, Disconnected, Intermittent, Low-bandwidth — challenging comm environments | BASTION's bridge-edge architecture is designed to operate in DDIL conditions |

**Category 3 — AI & Data** (cyan header)

| Term | Definition | Relevance to BASTION |
|------|-----------|----------------------|
| LangGraph | Python framework for building stateful AI agent workflows as directed graphs | BASTION's orchestration layer for multi-step AI planning workflows |
| Knowledge Graph | Network of entities and their relationships — machine-readable situational awareness | BASTION's "brain" — stores everything known about the operational environment |
| JSON-LD | Linked Data in JSON format — a standard for interoperable machine-readable data | BASTION's knowledge graph schema format, enabling future interoperability |
| NER | Named Entity Recognition — AI technique to extract entities from text | Used to extract forces, locations, and events from planning documents |
| Confidence Scoring | Numerical measure of information reliability (0.0-1.0) | BASTION tracks confidence for every intelligence assertion in the knowledge graph |
| MIL-STD-2525D | Military standard for tactical symbols — the language of the COP map | BASTION generates these symbols programmatically from extracted entities |
| Subspace Isolation | Partitioning a shared data store by workspace to prevent data leakage | Each BASTION problem set has an isolated knowledge graph subspace |

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
