# AI-Enabled Decentralized Augmented Orchestration for Coalition Operations

## What This Is

A complete AI-enabled decentralized platform for orchestrating coalition military operations from strategic planning through autonomous tactical execution. Built on NEAR Protocol blockchain with Phala Network TEE, the system automates the planning cycle (strategic → operational → tactical) while maintaining human control over critical decisions through DAO-based authority structures. The first iteration demonstrates end-to-end capability: ingesting strategic objectives, generating operational plans using joint planning doctrine, executing reconnaissance and strike missions with autonomous vehicles (Sphero RVR+ with Jetson Orin Nano), all while enforcing multi-level security, coalition information sharing rules, and post-quantum encrypted communications.

## Core Value

End-to-end AI-enabled automation of the complete planning cycle that leads to physical demonstration of strategy-to-autonomous-execution with verifiable human control over lethal decisions.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Strategic Planning Module**
- [ ] Ingest national security strategies and directives via document upload (NLP parsing), structured form entry, and API integration
- [ ] Extract strategic objectives, priorities, and constraints with AI assistance
- [ ] Allow human editing and fine-tuning of extracted objectives
- [ ] Require official approval by relevant authority before operationalizing
- [ ] Support all instruments of power (DIME) resource tracking with v1 focus on military

**Operational Planning Module**
- [ ] Implement JP 5-0 Joint Planning Process (JOPP) as foundation
- [ ] Support multi-national doctrine (NATO COPD, coalition partner planning processes)
- [ ] Apply operational design methodology to link strategic objectives to tactical tasks
- [ ] Generate campaign plans defining ends, ways, and means
- [ ] Model commander's intent with mission command framework
- [ ] Enforce rules of engagement (ROE) and operational constraints
- [ ] Support tiered autonomy levels per mission phase (human-in-loop, human-on-loop, fully autonomous)
- [ ] Enable continuous feedback loop to refine AI understanding of intent
- [ ] Support adjustable autonomy based on mission assessment and risk

**Operational Assessment & Dashboard**
- [ ] Real-time tactical-to-strategic rollup showing how activities map to objectives
- [ ] Automated measure of effectiveness (MOE) calculation based on completed tasks and sensor data
- [ ] Commander's decision dashboard showing attention-required items, on-track status, at-risk activities with AI recommendations
- [ ] Multi-level intelligence fusion architecture: tactical fusion at edge, operational fusion at backend, strategic intelligence on blockchain

**DAO-Based Decision Authority**
- [ ] Implement NEAR Protocol smart contracts for DAO governance
- [ ] Support configurable DAO membership per mission: multi-national coalition partners, AI agents with assigned authorities, commanders and staff officers
- [ ] Enforce security caveats and information sharing rules per member
- [ ] Weight voting authority based on role, responsibility, and contribution
- [ ] Require DAO approval for strike decisions with auditable blockchain record
- [ ] Track resource capabilities and authorities brought by each member

**Autonomous Tactical Execution**
- [ ] Commander interface for target selection and asset assignment (map-based tactical display, conversational AI, traditional C2 dashboard in multi-modal interface)
- [ ] Issue reconnaissance orders to autonomous vehicles via React/TypeScript frontend
- [ ] Sphero RVR+ chassis with Jetson Orin Nano Super for autonomous navigation
- [ ] Edge AI capabilities: object detection/tracking, autonomous navigation/path planning, sensor fusion and threat assessment
- [ ] Local AI models on Jetson for real-time perception and navigation
- [ ] NEAR AI for sensitive decision-making and private data handling (hybrid architecture)
- [ ] Camera-based target identification and reporting
- [ ] Multi-sensor battle damage assessment (BDA) post-strike
- [ ] Full targeting cycle closure: BDA feeds operational assessment, updates target list, triggers replanning if objectives not met

**Security Architecture**
- [ ] Zero trust architecture with data-centric security model
- [ ] Attribute-Based Access Control (ABAC) with full attribute richness: classification, nationality, role, mission, time, location, purpose
- [ ] Dynamic policy-driven attributes definable per-mission
- [ ] Each data object self-governs visibility based on attributes
- [ ] Multi-level security supporting UNCLASS through TS/SCI (demonstrated with unclassified data in v1)
- [ ] Coalition classification schemes: NATO, Five Eyes, bilateral markings
- [ ] Release authority enforcement
- [ ] Post-quantum cryptography throughout: appropriate PQ algorithms at each layer (blockchain, TEE, communications, storage)
- [ ] Per-user end-to-end encrypted communications with verifiable blockchain identities
- [ ] Phala Network TEE for privacy-preserving backend execution
- [ ] Node.js backend runs in Phala TEE

**Identity & Access**
- [ ] NEAR account-based decentralized identifiers (DIDs) for verifiable credentials
- [ ] Military PKI integration (DOD CAC/PIV cards) mapped to blockchain identity
- [ ] Coalition identity federation supporting multiple national identity systems mapped to NEAR DIDs
- [ ] Flexible onboarding for new AI agents, teams, organizations: DAO governance approval, plug-and-play agent registration with capabilities manifest, mission-based coalition formation

**Containerization & Deployment**
- [ ] Individual AI agent containers for isolation and scalability
- [ ] Service-oriented architecture: React frontend container, Node.js backend container, agent runtime container(s), NEAR/Phala node containers
- [ ] Mission-based agent team deployments as container pods/groups
- [ ] Support dynamic scaling and addition of new agents/services

**User Experience**
- [ ] Cinematic mission briefing on entry with visually stunning strategic context, operational plan, and user role
- [ ] Personalized command center with unit insignia, motto, relevant missions, controlled assets
- [ ] Live operational picture with real-time asset positions and intelligence feeds
- [ ] Visual theming with unit colors and branding
- [ ] Role-based interface adaptation (commander vs staff vs operator)
- [ ] Behavioral learning over time: AI learns user preferences, frequently used functions, communication style
- [ ] Interface optimization based on learned user behavior
- [ ] Immediate "WOW" factor combining cinematic entry, personalization, and live ops

**Technology Stack**
- [ ] NEAR Protocol blockchain for smart contracts (Rust)
- [ ] Phala Network TEE for privacy-preserving backend
- [ ] React with TypeScript for frontend
- [ ] Node.js backend in Phala TEE
- [ ] LangChain for AI agent orchestration where appropriate
- [ ] NEAR AI models for sensitive/decision-making AI workloads
- [ ] Local edge AI models on Jetson Orin Nano
- [ ] Docker containerization for all components

**Demo Scenario (v1)**
- [ ] Complete planning cycle demonstration: strategic objective input → operational plan generation → tactical order issuance
- [ ] Commander selects target and assigns reconnaissance mission via multi-modal interface
- [ ] Sphero RVR+ with Jetson Orin Nano executes autonomous reconnaissance
- [ ] Target identification and reporting back to command
- [ ] DAO approval process for strike decision
- [ ] Strike execution with human-in-loop control
- [ ] Multi-sensor BDA and assessment
- [ ] Operational assessment showing tactical success mapped to strategic objectives

### Out of Scope

- **Full DIME orchestration in v1** — Focus exclusively on military (Defense) instrument; Diplomatic, Information, and Economic instruments deferred to future versions (v1 tracks DIME resources but automates only military operations)
- **Production-grade security accreditation** — v1 demonstrates security architecture with proper patterns and controls but does not pursue Authority to Operate (ATO) or certification; accreditation is post-v1 concern
- **Multi-platform autonomous vehicle integration** — v1 uses only Sphero RVR+ and Jetson Orin Nano for demonstration; integration with actual military unmanned systems, manned platforms, and C2 systems deferred to production versions
- **Real classified data handling in v1** — v1 demonstrates multi-level security architecture with proper classification labeling, caveat handling, and access controls using unclassified data only; actual classified operations require accreditation path post-v1
- **Full joint and service doctrine library** — v1 implements JP 5-0 as foundation with extensibility for NATO COPD; comprehensive service-specific doctrine (Army, Navy, Air Force, Marine Corps) and all partner nation planning processes deferred to future versions
- **Advanced autonomous capabilities** — v1 demonstrates basic autonomous navigation, perception, and mission execution; advanced swarm coordination, collaborative autonomy, complex multi-agent tactics deferred to later phases
- **Enterprise-scale deployment** — v1 is functional prototype for demonstration; production hardening, high availability, disaster recovery, enterprise monitoring deferred to production roadmap

## Context

**Problem Space**
Modern coalition operations require coordinating diverse partners (multi-national forces, AI agents, human teams, organizations) across strategic, operational, and tactical levels while enforcing complex security rules, information sharing caveats, and maintaining accountability for autonomous actions. Current systems lack end-to-end automation, decentralized authority structures, and privacy-preserving AI capabilities needed for effective coalition C2.

**Defense Environment**
System targets defense/military operations with potential for national security, intelligence community, and coalition partner use. Must align with US joint planning doctrine, support NATO and Five Eyes partnership models, and handle multi-level security classifications common in defense operations.

**Technical Environment**
- Blockchain: NEAR Protocol chosen for smart contract capabilities, performance, and ecosystem
- Privacy: Phala Network TEE provides confidential computing for sensitive backend operations
- AI: NEAR AI for privacy-preserving inference on sensitive data; local models for edge perception
- Edge Compute: NVIDIA Jetson Orin Nano Super provides AI inference capability on autonomous platform
- Physical Platform: Sphero RVR+ provides accessible, demonstrable autonomous vehicle for v1 proof of concept

**User Research**
Target users include military commanders (strategic, operational, tactical levels), operations staff, intelligence analysts, coalition partners. Users value:
- Immediate situational awareness with minimal cognitive load
- Clear authority and accountability for autonomous actions
- Personalization reflecting their unit, role, and preferences
- Seamless coalition collaboration without compromising security
- Trust in AI recommendations backed by explainability

**Augmented Orchestration Model**
"Augmented" encompasses:
- AI-human decision teaming: AI provides recommendations and automation, humans retain authority at critical checkpoints
- Enhanced visualization: Real-time operational picture with AR/3D visualization of battlespace
- Multi-source data fusion: Intelligence, sensor data, open source, coalition inputs combined to create comprehensive situational awareness
- Adaptive automation: System learns user preferences and mission patterns to optimize workflow

## Constraints

- **Blockchain Platform**: NEAR Protocol — Required for decentralized smart contracts, DAO governance, verifiable identity foundation
- **Privacy Infrastructure**: Phala Network TEE — Required for confidential computing on sensitive military data in untrusted cloud environments
- **AI Privacy**: NEAR AI integration — Required for end-to-end encrypted AI inference ensuring user-owned data and privacy-preserving machine learning
- **Edge Hardware**: Jetson Orin Nano Super + Sphero RVR+ — v1 demonstration limited to these platforms; proves concept before scaling to military-grade systems
- **Programming Languages**: Rust for NEAR smart contracts, TypeScript for frontend, JavaScript/Node.js for backend — Driven by ecosystem and security requirements
- **Joint Doctrine Foundation**: JP 5-0 Joint Planning — Required baseline for US military planning; extensibility for NATO and coalition doctrine required for coalition operations
- **Classification Handling**: Multi-level security architecture required from v1 — Even unclassified demo must implement proper classification labeling, ABAC, and caveat enforcement patterns to prove production viability
- **Post-Quantum Cryptography**: Required for all encryption — Future-proof security against quantum computing threats; critical for long-term classified data protection
- **Zero Trust**: Architecture must be zero trust from foundation — No implicit trust, continuous verification, data-centric security model required for defense applications
- **Coalition-Ready Architecture**: Multi-tenancy, federation, information sharing controls required from v1 — Cannot bolt on coalition support later; must be foundational design principle
- **Human Control for Lethal Decisions**: DAO-based approval required for strike authorization — Ensures accountability, auditability, and appropriate human judgment for use of force
- **Containerization**: All components containerized for portability, scalability, security isolation — Required for modern deployment, edge computing, and classified environment compatibility

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NEAR Protocol for blockchain | Developer-friendly smart contracts, active ecosystem, DID support, performance suitable for real-time C2 operations | — Pending |
| Phala Network TEE for backend | Confidential computing needed for sensitive military data; compatible with NEAR ecosystem; enables cloud deployment of classified workloads | — Pending |
| Hybrid AI architecture (NEAR AI + local models) | NEAR AI for sensitive decision-making preserves privacy; local Jetson models for real-time edge perception avoid latency and connectivity dependence | — Pending |
| JP 5-0 as planning doctrine foundation | US joint doctrine provides comprehensive, proven framework; extensibility for NATO/coalition ensures international compatibility | — Pending |
| Sphero RVR+ + Jetson Orin Nano for v1 demo | Accessible, affordable hardware proves concept; Jetson provides production-grade AI inference; demonstrates autonomous execution without requiring military platforms | — Pending |
| DAO for strike authorization | Blockchain-based governance provides transparent, auditable, multi-stakeholder decision-making; critical for coalition operations and autonomous weapons accountability | — Pending |
| Data-centric security with ABAC | Traditional perimeter security insufficient for coalition, edge computing, autonomous agents; self-governing data objects enable fine-grained, dynamic access control | — Pending |
| Zero trust architecture from v1 | Cannot retrofit zero trust later; foundational design principle ensures security appropriate for defense environment and future accreditation | — Pending |
| Post-quantum cryptography throughout | Quantum computing threatens current encryption; classified data requires long-term protection; implementing PQ crypto from start avoids costly migration later | — Pending |
| Multi-modal commander interface | Different commanders prefer different interaction models (map, chat, dashboard); flexibility and adaptability improve adoption and effectiveness | — Pending |

---
*Last updated: 2026-01-11 after initialization*
