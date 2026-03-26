# BASTION Briefing Deck — Slide Specifications (Annex Slides A11-A17)

**Version:** 1.1
**Date:** 2026-03-26

> Part 5 of 5 — See also: [Part 1 (1-10)](slide-specs-01-10.md) | [Part 2 (11-20)](slide-specs-11-20.md) | [Part 3 (21-25)](slide-specs-21-25.md) | [Annex A1-A10](slide-specs-annex-A01-A10.md)

---

## Slide A11: Live Demo Script — Understanding Phase

**Maps to core slides:** 7 (Knowledge as Infrastructure), 3 (opening demo context)

**Purpose:** Step-by-step guided walkthrough for demoing the Understand tab during Q&A. This IS the demo script — the presenter reads from this slide while executing the demo on the second screen.

---

### Visual

Clean two-column layout. Left column: numbered step list. Right column: screenshot placeholder annotated with what to show at each step. Title: "DEMO: Understanding the Operational Environment"

---

### Demo Script (follow on second screen)

**Step 1 — Open the Understand tab**
Navigate to the Understand tab. The tab shows the brain graph visualization. Orient the audience: "This is where everything BASTION knows about the operational environment lives."

**Step 2 — Show an empty vs. populated graph**
If starting from scratch: explain that the graph begins empty and grows with every document uploaded. If the Pacific Strategy AY26 scenario is loaded: the graph already has entities from scenario initialization. Show the entity count in the graph header.

**Step 3 — Upload a document (or point to an existing one)**
If live upload: drag a planning document (OPORD fragment, intel report) into the upload zone. Watch the ingestion spinner. When complete, note that the graph node count has increased.
If pre-loaded: navigate to the Documents section and select a previously ingested document. Show the document detail panel.

**Step 4 — Watch entities appear in the graph**
Pan and zoom the brain graph visualization. Identify key entity clusters: units (blue nodes), locations (green nodes), events (red nodes). "Every node you see was extracted automatically from a planning document. No one drew this — the AI built it."

**Step 5 — Click on an entity**
Click on a unit node (e.g., 3rd Battalion or equivalent). Show the entity detail panel: name, type, confidence score, source document link, relationship list.

**Step 6 — Traverse a relationship**
From the entity detail panel, click a relationship to navigate to a linked entity. E.g., from the unit → click LOCATED_AT → navigate to the location node. Show the location's coordinates and the documents that placed the unit there.

**Step 7 — Show the source document link**
Click the source document link on the location entity. Show the original document passage where this location was mentioned. "This is the provenance chain — every piece of knowledge is traceable back to a specific sentence in a specific document."

---

## Slide A12: Live Demo Script — Planning Phase

**Maps to core slides:** 8 (Agent Hub), 9-10 (Ironclaw), 18 (Architecture Synthesis)

**Purpose:** Step-by-step guided walkthrough for demoing the Design and Plan tabs during Q&A.

---

### Visual

Same two-column format as A11. Title: "DEMO: Designing the Operation and Building the Plan"

---

### Demo Script (follow on second screen)

**Step 1 — Open the Design tab**
Navigate to the Design tab. This is the operational design workspace. Orient the audience: "This is where the staff translates strategic direction into an operational approach."

**Step 2 — Show the Center of Gravity analysis**
Navigate to the CoG section. Show the adversary CoG analysis: BASTION's AI has identified the CoG, critical capabilities, critical requirements, and critical vulnerabilities. "Ironclaw coordinated this analysis from the intelligence and planning agents. The staff officer reviews and validates — not authors."

**Step 3 — Show the Operational Approach**
Navigate to the Operational Approach section. Show the Lines of Effort and their connections to the end state. "This is the operational logic — the visualization of how we get from current conditions to end state."

**Step 4 — Show Ironclaw surfacing a decision**
Open the Ironclaw decision drawer (if a proactive suggestion is pending). Show the decision card: what Ironclaw identified, why it matters, what options are available. "Ironclaw identified this gap in the operational design and surfaced it without being asked. This is the Chief of Staff function."

**Step 5 — Open the Plan tab**
Navigate to the Plan tab. Show the campaign plan structure: phases, tasks, sequencing.

**Step 6 — Show OPORD generation**
Navigate to the OPORD section. Show a generated OPORD section — Situation, Mission, Execution. "This OPORD section was generated from the knowledge graph and the design decisions. The staff officer reviews, edits, and approves — BASTION provides the draft."

**Step 7 — Show Ironclaw contextual assistance in the Plan tab**
If Ironclaw has a suggestion relevant to the current planning state, show it in context. "Every tab has Ironclaw present. It is always tracking the full operational picture, not just what is on screen."

---

## Slide A13: Live Demo Script — Governance and Execution

**Maps to core slides:** 11-14 (governance, DIDs, autonomy)

**Purpose:** Step-by-step guided walkthrough for the Decide tab and robot execution demo during Q&A.

---

### Visual

Same two-column format as A11-A12. Title: "DEMO: Governance, Authority, and Autonomous Execution"

---

### Demo Script (follow on second screen)

**Step 1 — Open the Decide tab**
Navigate to the Decide tab. This is the governance dashboard. "This is where decisions with operational or legal consequence are formalized."

**Step 2 — Show the decision dashboard**
Show the list of pending and completed governance proposals. Point out a completed proposal — show the vote tally, the timestamp, and the on-chain transaction link.

**Step 3 — Click the on-chain transaction link**
Open the NEAR testnet explorer link. Show the transaction record: who voted, when, the proposal details, the outcome. "This record cannot be altered. It is on the blockchain. If anyone asks 'who authorized this?' — this is the answer."

**Step 4 — Show the authority tier visualization**
Show the 5-tier authority structure visualization. Point out which tier the current operation falls under and what quorum is required. "The system enforces this automatically. A Tier 3 tactical commander cannot approve a Tier 1 theater action — the smart contract rejects the attempt."

**Step 5 — Navigate to Resources tab, show a resource with caveats**
Navigate to the Resources tab. Select a resource (robot or intelligence product). Show its DID and caveats. Point out the releasability array. "This resource is releasable to Five Eyes nations. The smart contract checks this before any agent or staff officer can access it."

**Step 6 — (If robot is physically present) Show robot execution**
Switch to the robot control view. Show the robot's current status, formation, and position. Issue a simple movement command. Narrate the authority check: "Before this command reaches the robot, it passes through the Docker bridge, which confirms the DAO authorization token is valid. Without that token, the bridge will not forward the command."

**Step 7 — (If robot is not present) Show the bridge log**
Open the Docker bridge container log. Show the authorization check event: command received, token validated, command forwarded. "The bridge is the enforcement point. It is always running, always checking."

---

## Slide A14: Companion Whitepaper Overview

**Maps to core slides:** 24-25 (closing, Q&A backup)

**Purpose:** Point the audience to the leave-behind document for full technical depth and academic citations.

---

### Visual

Clean single-column layout. Title: "BASTION: Companion Whitepaper"

Displayed as a formatted table of contents:

```
BASTION: Blockchain Autonomous Strategy & Tactical Intelligence Operational Network
A Research Prototype in AI-Enabled Coalition Command and Control

Chapter 1: Introduction and Research Question
  1.1 Problem Statement: The Coalition C2 Challenge
  1.2 Research Question and Contributions
  1.3 Design Science Research Methodology
  1.4 Scope and Limitations

Chapter 2: Background and Literature Review
  2.1 Current State of Military C2 Systems
  2.2 Blockchain in Defense Applications
  2.3 AI Agent Orchestration Frameworks
  2.4 Decentralized Identity and Verifiable Credentials
  2.5 Autonomous Systems and Human Control Frameworks

Chapter 3: System Architecture
  3.1 Architectural Overview
  3.2 Knowledge Graph and Situational Awareness
  3.3 Agent Hub: Taxonomy, Orchestration, and Workflows
  3.4 DAO Governance: Proposal Lifecycle and Quorum Mechanics
  3.5 DID Registry and Coalition Caveats
  3.6 Smart Contract Policy Enforcement
  3.7 Physical Autonomy: Bridge and Edge Architecture
  3.8 Training-Operational Parity

Chapter 4: Technology Selection and Tradeoffs
  4.1 Blockchain Platform Selection (NEAR)
  4.2 AI Orchestration (LangGraph)
  4.3 Storage Architecture (Hybrid)
  4.4 Identity Standard (DIDs)

Chapter 5: Evaluation and Findings
  5.1 Prototype Demonstration: Pacific Strategy AY26
  5.2 Governance Integrity Findings
  5.3 Planning Compression Findings
  5.4 Limitations and Future Work

Chapter 6: Doctrinal Implications and Future Research
  6.1 Impact on Staff Roles and Doctrine
  6.2 JADC2 Integration Pathway
  6.3 NATO Interoperability Assessment
  6.4 Research Agenda

References (Chicago 18th Edition)
Appendix A: Smart Contract Code (DID Registry)
Appendix B: Agent Taxonomy (Full List)
Appendix C: Knowledge Graph Schema (JSON-LD)
```

Annotation at bottom: "Available as printed PDF — ask the presenter. Full Chicago 18th edition footnote citations throughout."

---

## Slide A15: Technology Comparison Matrix

**Maps to core slide:** 19 (Tradeoffs and Decisions)

**Purpose:** Full detailed comparison tables for audience members who want to challenge specific technology choices.

---

### Visual

Four comparison tables, each covering a technology domain.

**Table 1: Blockchain Platform**

| Criterion | NEAR Protocol ✓ | Ethereum | Solana | Hyperledger Fabric |
|-----------|-----------------|----------|--------|--------------------|
| Transaction throughput | ~1,000 TPS | ~15 TPS | ~65,000 TPS | ~1,000-3,500 TPS |
| Transaction cost | ~$0.001 | $1-$50 | ~$0.00025 | Free (permissioned) |
| Account model | Human-readable, named accounts | Hex addresses | Hex addresses | Permissioned identity |
| Consensus | Nightshade PoS, sharded | PoS (post-Merge) | PoH + PoS | PBFT variants |
| Smart contract language | Rust / AssemblyScript | Solidity | Rust / C | Go / JavaScript |
| Network type | Public permissionless | Public permissionless | Public permissionless | Private permissioned |
| Coalition suitability | High (public verifiability) | High (same) | High (same) | Low (trust between partners) |
| Developer ecosystem | Growing, strong Rust tooling | Largest, most mature | Large, high performance | Enterprise-focused |
| **Why not chosen** | **CHOSEN** | High gas costs at scale | Stability concerns, centralization | Private = no external verifiability |

**Table 2: AI Orchestration**

| Criterion | LangGraph ✓ | LangChain | AutoGen (Microsoft) | CrewAI |
|-----------|-------------|-----------|---------------------|--------|
| Workflow model | Directed graph (stateful) | Chain/agent abstraction | Conversation-based agents | Role-based crew agents |
| State management | Explicit, persistent graph state | Limited, stateless by default | Shared conversation context | Shared crew state |
| Human-in-the-loop | First-class: explicit gate nodes | Plugin, not native | Plugin-level | Not native |
| Parallelism | Native: parallel graph branches | Possible but complex | Sequential default | Sequential default |
| Debugging | Visual graph inspection | Complex chain tracing | Conversation log | Basic |
| HITL gates for doctrine | Yes — designed for it | Workaround required | Workaround required | Not supported |
| **Why not chosen** | **CHOSEN** | No native HITL, less suited | Conversation model wrong for staff process | Simpler but less control |

**Table 3: Storage Architecture**

| Criterion | Hybrid (PostgreSQL + NEAR) ✓ | Pure On-Chain | Pure Off-Chain (DB only) |
|-----------|------------------------------|---------------|--------------------------|
| Operational data speed | Fast (PostgreSQL) | Slow (blockchain latency) | Fast |
| Governance integrity | Blockchain-enforced | Blockchain-enforced | Trust the operator |
| Storage cost | Low (off-chain data) | High (on-chain per KB) | Low |
| Coalition verifiability | Yes (governance on-chain) | Yes (all on-chain) | No (trust the operator) |
| Data privacy | Off-chain data private | All data public | Data private |
| Scalability | High | Limited | High |
| **Why not chosen** | **CHOSEN** | Cost and privacy prohibitive | No external verifiability |

**Table 4: Identity Standard**

| Criterion | W3C DIDs ✓ | OAuth 2.0 / OIDC | SAML 2.0 | CAC/PKI |
|-----------|------------|------------------|----------|---------|
| Self-sovereign | Yes — owner controls | No — IdP controls | No — IdP controls | Partial — CA controls |
| Coalition interoperability | Yes — any DID resolver | Requires federation | Requires federation | PKI bridge required |
| On-chain integration | Native | Not designed for | Not designed for | Not designed for |
| Caveat storage | Native (DID Document) | Not applicable | Not applicable | Certificate extensions |
| Human-readable IDs | Yes (NEAR account-based) | Yes (email-based) | Yes (email-based) | No (hex cert fingerprints) |
| Revocation | On-chain, immediate | Token expiry + revocation list | Short-lived assertions | CRL/OCSP |
| **Why not chosen** | **CHOSEN** | No on-chain integration | No on-chain integration | PKI bridges fragile in coalition |

---

## Slide A16: Pacific Strategy AY26 Scenario Overview

**Maps to core slides:** 3 (opening demo context), 15 (COP demo context)

**Purpose:** Provide context on the exercise scenario used throughout the briefing and demo.

---

### Visual

**Timeline Diagram: Pacific Strategy AY26 — Six Phases**

Horizontal timeline with phase blocks, color-coded by operational phase:

```
[Gray]         [Yellow]        [Red]         [Dark Red]    [Darker Red]    [Blue]
COMPETITION  → CRISIS        → CONFLICT     → CONFLICT    → CONFLICT     → NEGOTIATION
Phase 1        Phase 2         Day 4          Day 10         Day 22          Phase 6
Background     Escalation      Kinetic        Mid-battle     Late battle     Endgame
tensions       detected        operations     intensity      assessment
               begin           begin                         operations

Indo-Pacific regional context — Taiwan Strait contingency
6 NEAR-peer nations involved — coalition C2 challenge
US, UK, Australia, Canada, New Zealand (Five Eyes) + Japan
```

Below timeline: scenario scope annotations:
- "~200 OPORD/FRAGO documents uploaded"
- "400+ knowledge graph nodes generated"
- "6 governance proposals demonstrated"
- "3 robot formation exercises conducted"
- "Complete planning cycle from Competition → Negotiation"

---

## Slide A17: Research Methodology and Approach

**Maps to core slides:** 2 (Research Question), 23-24 (Research Contributions, The Answer)

**Purpose:** Academic deep-dive for thesis advisor questions about research design, methodology, and rigor.

---

### Visual

**Diagram: Design Science Research Methodology Cycle**

Circular/iterative diagram with six phases:

```
1. PROBLEM IDENTIFICATION
   Coalition C2 lacks verifiability, auditability, and AI integration
   at the required scale and speed for near-peer conflict
         ↓
2. OBJECTIVE DEFINITION
   Build a system that demonstrates: DAO-governed authority,
   AI-enabled planning, verifiable human control over lethal decisions
         ↓
3. DESIGN AND DEVELOPMENT
   59 development phases, iterative prototype construction
   Each phase: plan → execute → verify → document
   Technologies selected against specific requirements
         ↓
4. DEMONSTRATION
   Pacific Strategy AY26 exercise scenario
   Live prototype running the full planning-to-execution cycle
   Briefing deck + companion whitepaper as academic artifacts
         ↓
5. EVALUATION
   Does the prototype demonstrate feasibility?
   What limitations were encountered?
   What does the artifact reveal about the research question?
         ↓
6. COMMUNICATION
   This briefing (executive and academic audience)
   Companion whitepaper (academic record)
   Codebase (artifact verifiability)
         ↓
   [Back to Problem Identification — research agenda for future work]
```

**Table: Research Artifact Characteristics**

| Dimension | BASTION Status |
|-----------|----------------|
| Artifact type | Prototype — proof of concept, not production |
| Development method | Iterative, phase-based (59 phases) |
| Technology integration | Novel combination of existing technologies |
| Evaluation method | Scenario-based demonstration + architectural analysis |
| Generalizability | Architectural patterns generalizable; specific implementation is prototype-scale |
| Known limitations | Documented in whitepaper Chapter 5.4 |
| Reproducibility | Open codebase — methodology and implementation are inspectable |

---

# DOCUMENT END

**Total slides:** 25 core + 17 annex = 42 slides
**Core deck speaking time estimate:** ~35-45 minutes (at ~150 words/minute with pauses)
**Color palette:** Primary blue #2563EB, Sky blue #0EA5E9, White backgrounds, Cyan accents
**Visual style:** Clean modern tech aesthetic, NOT dark tactical

**Companion documents:**
- Whitepaper: docs/whitepaper/ (compiled to docx/pdf)
- Briefing document: docs/briefing/briefing-document.md
- Speaking scripts and demo cues: docs/briefing/speaking-script.md
- Demo script: docs/briefing/demo-script-30min.md

---

> Navigation: [Part 1 (1-10)](slide-specs-01-10.md) | [Part 2 (11-20)](slide-specs-11-20.md) | [Part 3 (21-25)](slide-specs-21-25.md) | [Annex A1-A10](slide-specs-annex-A01-A10.md) | **Annex A11-A17**
