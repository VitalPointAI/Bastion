# BASTION: Decision Overmatch Through AI-Augmented DAOs
## Executive Briefing Document

**Classification:** UNCLASSIFIED
**Version:** 1.0 — March 2026
**Document Type:** Standalone Executive Summary

---

## 1. Executive Summary

Coalition military operations face a coordination crisis driven by three converging pressures: information volumes that exceed human processing capacity, coalition interoperability gaps that fragment decision authority, and adversaries who operate inside friendly decision cycles. Traditional hierarchical command and control structures, designed for a world where information moved at the speed of couriers, have not kept pace with the operational tempo demanded by multi-domain competition.

BASTION (Blockchain Autonomous Strategy and Tactical Intelligence Operational Network) is a research platform that addresses this crisis through the integration of AI agent teams with Decentralized Autonomous Organizations (DAOs) running on NEAR blockchain infrastructure. The core thesis is straightforward: AI accelerates coordination; DAOs enforce governance; humans provide judgment. The novel contribution is the systems integration of these three elements in a working platform that preserves human authority over critical decisions while enabling machine-speed coordination for routine tasks.

A physical demonstration using NVIDIA Jetson Orin Nano edge computing and Sphero RVR+ robotic platforms validates the approach end-to-end — from strategic resource allocation through on-chain coalition voting to tactical autonomous execution and back. The demonstration confirms three governance invariants that hold across all system states: strike authorization always requires human approval (100% coalition threshold), planning authority levels are enforced by smart contract rather than policy, and coalition trust is cryptographically verifiable without requiring partners to trust each other's word.

---

## 2. Problem Statement

### 2.1 The Coalition Coordination Crisis

Multi-domain operations generate information at volumes no human staff can manually process. Intelligence reports, satellite imagery, network event logs, partner nation communications, and logistics data arrive continuously across strategic, operational, and tactical levels. Staff officers spend increasing proportions of their time in coordination overhead — validating data, formatting products for adjacent units, reconciling conflicting assessments — rather than in judgment.

Coalition operations compound this problem. Each partner nation maintains separate planning tools with incompatible data schemas. National caveats require manual validation at each coordination point. Coalition voting on resource allocation happens in meetings and email chains with no permanent record. After the fact, "Did they honor the commitment?" is often an unanswerable question — not because partners are dishonest, but because the coordination mechanism generates no verifiable audit trail.

The operational consequence is a decision cycle that cannot compress below the time required for human coordination overhead, regardless of how fast individual staff officers work. Adversaries who adopt machine-speed coordination tools will operate inside this cycle. The research question is whether AI-augmented DAOs provide an architectural solution.

### 2.2 The Autonomous Systems Governance Gap

Autonomous systems introduce a second problem that existing military C2 frameworks do not adequately address: how to preserve human authority over consequential decisions when AI operates at speeds that preclude human review of every action. The conventional framing — "humans in the loop" — is insufficient because it does not specify which decisions require which authority level, or how those requirements are enforced when operational urgency creates pressure to bypass them.

BASTION addresses this through a five-tier authority model enforced at the smart contract level. Smart contracts execute automatically and cannot be overridden by operator configuration or chain-of-command pressure. The authority model is not a policy document; it is executable code that runs regardless of operator intent. This is the architectural answer to autonomous systems governance: encode the authority requirements in the system itself.

---

## 3. Technical Approach

### 3.1 Architecture Overview

BASTION implements a three-tier architecture designed for DDIL (Disconnected, Degraded, Intermittent, Limited-bandwidth) environments:

**Cloud/On-Premise Tier:** The BASTION platform runs on React (frontend) and Node.js (backend) with PostgreSQL for relational data, Neo4j for the intelligence knowledge graph, and NEAR Protocol for blockchain governance. This tier hosts the planning interface, AI agent orchestration, and DAO governance.

**Bridge Tier:** A Docker containerized Python robot agent provides the translation layer between the command platform and physical assets. The bridge uses mDNS auto-discovery to detect robots on the network, assigns each a blockchain-anchored Decentralized Identifier (did:near:resource-{id}), and proxies commands from planning intent to robot-native execution instructions.

**Edge Tier:** NVIDIA Jetson Orin Nano (67 TOPS AI performance) runs object detection and visual odometry locally, without requiring connectivity to the cloud tier. The Sphero RVR+ robotic platform executes missions within policy-defined boundaries. The edge tier is DDIL-resilient: mission parameters download before execution; reporting uploads when connectivity returns.

### 3.2 DAO Governance and the Five-Tier Authority Model

NEAR blockchain provides the trust infrastructure. Smart contracts enforce a five-tier authority model:

- **Tier 1 (Strategic DAO):** Coalition-weighted voting on resource allocation and strategic commitments
- **Tier 2 (Operational DAO):** Commander approval for campaign plans and operational decisions
- **Tier 3 (Tactical DAO):** Staff recommendation with human review for mission execution
- **Tier 4 (AI-Assisted):** Automatic processing with mandatory human review gate before output
- **Tier 5 (Autonomous):** Policy-bounded execution without real-time human approval

Three decision categories are permanently locked to human-only authority regardless of operational urgency: strike authorization (100% coalition threshold), strategic resource commitment, and national caveat exceptions.

### 3.3 AI Agent Teams

BASTION fields 131+ AI agents organized in two categories:

**31 Specialized Agents** handle governance, planning coordination, intelligence fusion, escalation modeling, operational design support, autonomous document intelligence, COP layer generation, and resource management. The Ironclaw agent functions as a Chief of Staff — monitoring all agent activity and proactively surfacing decisions requiring commander attention through 60-second polling.

**102 JPP Staff Role Agents** represent the full Joint Planning Process staff organization from Commander through J1–J9 and component commanders. Each agent is bounded by its role's authority level and coordinates with adjacent roles through a shared message bus. Agent reasoning traces are visible to human supervisors at all times.

LangGraph provides workflow orchestration. All agent outputs require human review at configurable gates before taking effect in the planning system.

### 3.4 Doctrine-First Interface Design

The user interface implements six tabs aligned to JP 5-0 joint planning process phases: Understand, Design, Plan, Decide, COP, and Assess. A planner trained on JP 5-0 finds the system immediately familiar — the software structure mirrors doctrinal structure. This is not cosmetic; the workflow within each tab reflects the doctrinal steps for that phase, including governance gates at doctrinal transition points.

---

## 4. Key Capabilities

| Capability | Description | Phase Implemented | Status |
|------------|-------------|-------------------|--------|
| Doctrinal Tab Architecture | Six JP 5-0-aligned tabs (Understand/Design/Plan/Decide/COP/Assess) | 24 | Complete |
| Autonomous Document Intelligence | 10-agent pipeline: classification, entity extraction, NATO reliability ratings, conflict detection, graph population | 40 | Complete |
| AI COP Layer Generation | MIL-STD-2525D overlays from planning documents; friendly/adversary perspective toggle; phase slider | 21 | Complete |
| JPP 7-Step Campaign Plan | Ends-ways-means linkage, strategic guidance workflow, echelon routing (strategic/operational/tactical) | 33-36 | Complete |
| MDMP at Tactical Level | Mission from OPORD, dual-perspective IPB, COA scoring, AI-generated WARNORD/OPORD/FRAGO | 14 | Complete |
| Robot Bridge | Docker + Python agent, mDNS discovery, command proxy, DID assignment | 43 | Complete |
| Robot Vision | Jetson CSI camera, YOLOv8 detection, ORB feature matching, mission intent translation (ENGAGE/RECON/GUARD/PATROL) | 44 | Complete |
| Swarm Leadership | 6 doctrinal formations, BLE leader-spoke control, dead reckoning, DAO-governed membership | 46 | Complete |
| Resource Registry | did:near:resource-{id} for 5 asset types; COP integration; DAO-governed allocation | 27 | Complete |
| Training/Operational Mode | Global toggle, EXERCISE banner, identical governance, data isolation | 22 | Complete |
| JPP Staff Workspaces | Per-role AI agents for 31+ staff positions; cross-staff notifications; hybrid editor | 15 | Complete |
| Decide Tab | Decision dashboard, RACI matrix, Ironclaw proactive surfacing, DAO governance gates | 53 | Complete |

---

## 5. Demonstration Results

### 5.1 What Was Demonstrated

The physical demonstration follows the Pacific Strategy AY26 scenario — an Indo-Pacific contingency exercise with coalition partners (USA, GBR, CAN) — through three acts:

**Act 1: Strategic Level (IN-THE-LOOP):** Uploaded intelligence documents were processed by the autonomous document intelligence pipeline, populating the knowledge graph with actors and relationships in seconds. The Design tab's operational design workspace performed center of gravity analysis using Strange's CG-CC-CR-CV framework. Strategic directives drafted through the Plan tab propagated to operational level through the inheritance system. Coalition voting on resource allocation recorded on NEAR blockchain with cryptographic verification.

**Act 2: Operational Level (ON-THE-LOOP):** AI agent team generated a JPP 7-step campaign plan with COA development and wargaming recommendations. Commander monitored agent activity with override available at all times. OPORD generation triggered automatic creation of tactical-level problem set with inherited planning context.

**Act 3: Tactical Level (OUT-OF-THE-LOOP):** Robot bridge connected Sphero RVR+ as a governed resource (did:near:resource). Jetson Orin Nano ran detectNet locally for object detection without cloud connectivity. Target identification (94% confidence) triggered a strike authorization proposal — which could not proceed without 100% coalition vote on-chain. Coalition voted; robot executed the authorized action. Mission results propagated back up through the inheritance system.

### 5.2 Governance Invariants Confirmed

Throughout all demonstration phases, three governance invariants held:

1. **Strike authorization required 100% coalition threshold** — no path through the system enabled autonomous engagement
2. **MDMP phase progression required commander approval at doctrinal gates** — the system could not be advanced through planning steps without appropriate authority
3. **Coalition votes were cryptographically verifiable** — any coalition partner could independently verify vote results on NEAR blockchain

### 5.3 Performance Metrics

| Metric | Result |
|--------|--------|
| Document intelligence pipeline (upload → graph) | Seconds (not minutes) |
| Coalition vote recording | ~1-2 seconds on-chain |
| Agent plan generation (strategic → operational) | Minutes (not hours) |
| DDIL resilience | Edge tier continued without cloud connectivity |
| Swarm formation transition | UDP-coordinated without central command |

---

## 5.4 Known Limitations and Open Questions

We believe in addressing these questions proactively rather than waiting for them to be raised.

**LLM Reliability.** BASTION's AI agents use large language models for intelligence extraction, planning analysis, and staff role functions. LLMs are non-deterministic — the same document may produce slightly different extraction results across runs — and they carry an inherent hallucination risk: the generation of plausible but factually incorrect analysis. Human review gates at every consequential decision point are the primary mitigation, but they reduce the risk rather than eliminating it. Every AI output in BASTION should be understood as an intelligence estimate requiring analyst validation, not as ground truth.

**Blockchain-Tempo Tension.** On-chain coalition governance provides cryptographic accountability but introduces latency that does not exist in conventional C2 systems. Two-second transaction finality is acceptable for strategic deliberate decisions; it is architectural overhead for time-critical tactical decisions. The five-tier graduated authority model addresses this by routing most tactical actions through conventional authorization rather than blockchain consensus — only decisions explicitly requiring coalition verification touch the chain synchronously. The tension between governance accountability and decision speed is fundamental to the design and is managed, not eliminated.

**DDIL Resilience.** BASTION's architecture is designed for DDIL environments: edge nodes cache mission parameters, the UDP swarm mesh coordinates independently of cloud, and stale data is marked with time-since-update indicators. However, there is an important distinction between "designed for DDIL" and "validated under sustained DDIL." Extended disconnection scenarios — hours of cloud unavailability, followed by reconnection reconciliation between diverged edge and cloud states — have not been empirically stress-tested in this prototype. The DDIL resilience is a design intent with partial validation, not a demonstrated capability under worst-case conditions.

**Research Prototype Maturity.** BASTION was built by a single developer with AI assistance over approximately ten weeks. All testing has been single-user. The architecture is designed for team development (clear service boundaries, API contracts, plugin architecture), but it has not been validated under concurrent multi-user planning loads, adversarial penetration testing, or security audit. The contribution is the architecture and integration demonstration; production deployment readiness requires security audit, load testing, and multi-user validation that a research prototype cannot provide.

**Scale Validation.** Physical demonstration used three robotic platforms and a single simulated coalition instance. Extrapolation to operational swarm sizes (tens to hundreds of platforms), multi-coalition concurrent instances, and agent coordination at scale remains an empirical open question. The architecture is designed to support these scales; the demonstration validates feasibility, not scalability bounds.

---

## 6. Path Forward / Future Work

### 6.1 Near-Term Development (Next 6 Phases)

**Multi-operator exercise:** The current demonstration uses a single operator. Coalition coordination at scale requires multi-user exercise with actual coalition partner accounts managing different national authority levels simultaneously.

**Live intelligence integration:** Pacific Strategy AY26 uses seeded scenario data. An OSINT pipeline that ingests open-source intelligence feeds would validate the document intelligence pipeline against real-world data variability.

**Field environment testing:** The current demonstration uses a tabletop area of operations. Testing the robot bridge in an outdoor field environment with actual range, terrain, and communication variability is the next physical validation step.

**Adversarial resilience:** The BLE leader-spoke communication has not been tested under simulated jamming conditions. BLE robustness under adversarial electronic warfare is an open validation requirement.

### 6.2 Medium-Term Research Requirements

**Classification handling:** Operational deployment requires classification boundary handling at UNCLASSIFIED/FOUO/SECRET levels. This requires coordination with appropriate classification authority and potentially separate network infrastructure per classification level.

**Existing C2 system integration:** Operational commanders will not replace GCCS-J, ATAK, or CPOF with BASTION. Integration via APIs with existing systems is required for operational relevance. ATAK plugin architecture offers the most tractable near-term path.

**Partner nation exercise:** Validating the coalition governance model requires actual partner nation participation — not simulated coalition accounts operated by a single institution.

### 6.3 Long-Term Research Questions

- At what agent count does coordination overhead exceed coordination benefit? The current 131+ agent model has not been tested at scale.
- How do LLM reliability characteristics change under adversarial prompt injection? The autonomous document intelligence pipeline processes external inputs that could be adversarially crafted.
- Can DAO governance scale to real-time tactical tempo operations? Current governance latency (~1-2 seconds on-chain) is acceptable for deliberate decisions but has not been tested for time-critical tactical scenarios.

---

## 7. Contact and References

### Point of Contact

**Author:** [Name], [Institution]
**Research area:** AI-augmented governance for military command and control
**Contact:** [Email/institutional contact]

### Whitepaper Reference

"Decision Overmatch: Accelerating Military Advantage with AI-Augmented Decentralized Autonomous Organizations" — Full research whitepaper available upon request. Covers literature review, methodology, results, and discussion in academic format (Chicago 18th edition footnotes).

**Version:** v0.2 (March 2026). v0.1 written January 2026 at Phase 13. v0.2 adds coverage of Phases 14-53 capabilities including robot integration, swarm leadership, knowledge graph brain, autonomous document intelligence, and the Decide tab.

### Repository

BASTION platform source code: Available upon request for research purposes.

### Scenario Data

Pacific Strategy AY26 exercise data package: Available for partner institution exercises. Includes complete scenario seed scripts, six-phase scenario structure, and supporting intelligence documents.

---

*BASTION — Blockchain Autonomous Strategy and Tactical Intelligence Operational Network*
*Phase 54 Documentation — March 2026*
*UNCLASSIFIED*
