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
- [ ] Support granular tiered autonomy levels: per mission phase, per tactical activity, per resource, per AI agent
- [ ] Autonomy modes: human-in-loop (approve each action), human-on-loop (monitor with veto), fully autonomous (within constraints)
- [ ] Commander configurable trust levels per agent based on capability, track record, and consequence assessment
- [ ] Enable continuous feedback loop to refine AI understanding of intent
- [ ] Support dynamic autonomy adjustment based on mission assessment, risk, and operational context

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
- [ ] Granular authority delegation: commanders assign specific authorities to specific agents for specific task types
- [ ] Track agent trust levels, performance history, and autonomy boundaries per agent
- [ ] Smart contract enforcement of autonomy constraints: agents cannot exceed delegated authority without human approval
- [ ] Track resource capabilities and authorities brought by each member

**Autonomous Tactical Execution**
- [ ] Commander interface for target selection and asset assignment (map-based tactical display, conversational AI, traditional C2 dashboard in multi-modal interface)
- [ ] Granular autonomy controls: set different autonomy levels for each agent, each task, each resource based on trust and consequence
- [ ] Example: Trusted AI agent given full autonomy for routine reconnaissance; unproven agent requires human-in-loop for target identification
- [ ] Per-activity autonomy configuration: commander defines which actions require approval vs which can execute autonomously
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

**Data Storage & Resilience**
- [ ] Hybrid storage architecture: PostgreSQL for fast queries, NEAR blockchain for verification, IPFS for large files
- [ ] PostgreSQL (centralized, fast): Operational dashboards, intelligence fusion, sensor aggregation, full-text search, geospatial queries, time-series analysis
- [ ] PostgreSQL extensions: PostGIS (geospatial), pg_trgm (full-text search), TimescaleDB (time-series), pgvector (AI embeddings)
- [ ] NEAR blockchain (decentralized, verifiable): Critical decisions, audit trail, encrypted document registry, access control policies, provenance records
- [ ] IPFS for decentralized encrypted data storage: documents, intelligence products, mission plans, sensor data
- [ ] Client-side encryption before IPFS upload: data encrypted with per-object keys based on classification and access policy
- [ ] Content addressing for tamper-proof data integrity and verification
- [ ] Distributed storage across multiple IPFS nodes for resilience and availability
- [ ] IPFS CID (content identifier) references stored on-chain AND in PostgreSQL for fast querying
- [ ] Dual-write pattern: Critical events written to both PostgreSQL and NEAR blockchain simultaneously
- [ ] Event synchronization: Background worker listens to NEAR events, updates PostgreSQL for eventual consistency
- [ ] Offline sync strategy: Edge devices (autonomous vehicles) queue operations locally, sync when connectivity restored (DDIL environment support)
- [ ] Data retention: Operational data retained in PostgreSQL for mission/event duration, then archived to IPFS with on-chain provenance
- [ ] Conflict resolution: Blockchain is source of truth for critical decisions, PostgreSQL for operational state
- [ ] Encryption key management via Phala TEE and NEAR smart contracts
- [ ] AI context and training data stored encrypted: client-side encryption for sensitive AI context, TEE-based secure enclaves for model training data
- [ ] Ephemeral data handling: sensitive AI context can be client-side only (never persisted) or encrypted in-memory in TEE
- [ ] Smart contract enforcement of data access policies tied to IPFS content

**Identity & Access**
- [ ] Privy.io for user authentication with embedded NEAR wallets (email/social login)
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
- [ ] PostgreSQL (self-hosted) for operational data with PostGIS, TimescaleDB, pg_trgm, pgvector extensions
- [ ] React with TypeScript for frontend
- [ ] Vite for build tooling
- [ ] pnpm for package management
- [ ] Privy.io for user authentication and embedded NEAR wallets
- [ ] FastNEAR RPC for optimized NEAR network access
- [ ] IPFS (Pinata) for decentralized encrypted data storage and content addressing
- [ ] Node.js backend in Phala TEE with event synchronization worker
- [ ] Redis or PostgreSQL-based retry queue for blockchain write failures
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

**Agentic AI Architecture Principles**
This system implements production-grade agentic AI workflows following industry best practices (arXiv:2512.08769):
- **Multi-Agent Orchestration**: Specialized agents collaborate with defined roles (planning, reconnaissance, strike coordination, assessment) rather than monolithic AI
- **Model Context Protocol (MCP)**: Standardized communication between agents and external systems while maintaining clean separation between workflow logic and MCP servers
- **Tool-First Design**: Direct function invocation over MCP where determinism is critical; MCP reserved for external system integration
- **Single-Responsibility Agents**: Each agent handles one clearly defined task to improve reliability, testability, and maintainability
- **Externalized Prompt Management**: Agent prompts stored as external artifacts enabling non-technical stakeholders to refine behavior without code changes
- **Multi-Model Consortium**: Heterogeneous LLMs (OpenAI, Anthropic, Gemini, etc.) generate independent outputs synthesized by reasoning agents to reduce bias and hallucination
- **Reasoning-Based Consolidation**: Dedicated reasoning agents cross-validate and synthesize outputs from multiple models ensuring factual consistency and Responsible AI alignment
- **Pure Function Invocation**: Infrastructure operations (database writes, API calls, timestamps) executed deterministically outside LLM reasoning to reduce token consumption and improve reliability
- **Containerized Deployment**: All agents and services containerized for portability, scalability, and security isolation with Kubernetes orchestration
- **KISS Principle**: Flat, readable, function-driven designs avoiding unnecessary abstraction to maintain clarity and enable AI-assisted development tools
- **Context Graph Architecture**: AI context managed as structured graph of relationships between entities, enabling accumulated intelligence over time rather than ephemeral conversations
- **Avoid Tool/MCP Overload**: Single-tool-per-agent design prevents ambiguity and tool-selection failures; avoid attaching multiple tools to one agent
- **Avoid Agent Overload**: Agents focused on single conceptual responsibilities avoid mixing generation, validation, transformation, and side effects in one component
- **Deterministic Orchestration**: Workflow logic remains transparent and lightweight; delegation clear, reasoning tasks explicit

## Constraints

- **Blockchain Platform**: NEAR Protocol — Required for decentralized smart contracts, DAO governance, verifiable identity foundation
- **Privacy Infrastructure**: Phala Network TEE — Required for confidential computing on sensitive military data in untrusted cloud environments
- **AI Privacy**: NEAR AI integration — Required for end-to-end encrypted AI inference ensuring user-owned data and privacy-preserving machine learning
- **Edge Hardware**: Jetson Orin Nano Super + Sphero RVR+ — v1 demonstration limited to these platforms; proves concept before scaling to military-grade systems
- **Programming Languages**: Rust for NEAR smart contracts, TypeScript for frontend, JavaScript/Node.js for backend — Driven by ecosystem and security requirements
- **Joint Doctrine Foundation**: JP 5-0 Joint Planning — Required baseline for US military planning; extensibility for NATO and coalition doctrine required for coalition operations
- **Classification Handling**: Multi-level security architecture required from v1 — Even unclassified demo must implement proper classification labeling, ABAC, and caveat enforcement patterns to prove production viability
- **Post-Quantum Cryptography**: Required for all encryption — Future-proof security against quantum computing threats; critical for long-term classified data protection
- **Verifiable Zero Trust**: Architecture must implement true zero trust from foundation — Trust terminates at cryptographic proof, not institutions; continuous hardware-backed verification at all layers required for defense AI systems
- **Coalition-Ready Architecture**: Multi-tenancy, federation, information sharing controls required from v1 — Cannot bolt on coalition support later; must be foundational design principle
- **Human Control for Lethal Decisions**: DAO-based approval required for strike authorization — Ensures accountability, auditability, and appropriate human judgment for use of force
- **Containerization**: All components containerized for portability, scalability, security isolation — Required for modern deployment, edge computing, and classified environment compatibility

## Verifiable Zero Trust for AI Systems

**Core Principle:** In AI systems, zero trust cannot end at access control or network isolation—it must extend to the intelligence itself. Trust must terminate at cryptographic proof, not institutional assurance.

**The AI Trust Challenge**

Traditional zero trust focused on "who can access" the system. For AI systems generating decisions and influencing operations, the critical question becomes "how does the system behave" and "can that behavior be independently verified?"

AI introduces unique trust challenges:
- Systems interpret intent and apply learned behavior
- Outputs change based on models, weights, data, and configuration
- Minor changes can materially alter behavior without obvious signals
- Institutional assurances alone cannot guarantee consistent behavior
- Compliance certifications verify process, not execution

**Conditional vs. Verifiable Zero Trust**

**Conditional Zero Trust** (institutional trust model):
- Trust rests on organization integrity, policy enforcement, legal frameworks
- Reduces risk through access controls, audits, compliance
- Assumes stable conditions and well-intentioned institutions
- Fails under pressure: policy overrides, exceptional access, geopolitical shifts
- Examples: Terms of service, compliance certs, "we don't have access" statements

**Verifiable Zero Trust** (cryptographic proof model):
- Trust rests on cryptographic verification, hardware-backed proofs, publicly verifiable code
- Changes in behavior are automatically detectable
- Execution can be proven, trust can be revoked automatically
- Resilient under pressure: math-based, not policy-based
- Trust terminates at measurable system artifacts, not organizational assurances

**Five-Layer Verification Architecture**

For this system, zero trust means answering four questions with cryptographic proof:
1. Where did this run?
2. What code ran?
3. Which model, weights, data were used?
4. Under what constraints did it execute?

**Layer 1: Execution Environment (Foundation)**
*If execution itself is not verifiable, nothing above it can be trusted.*

Verifiable through:
- Hardware-rooted attestation (TEE/secure enclave)
- Firmware and microcode version proofs
- Enclave measurement (cryptographic hash)
- Isolation guarantees excluding OS, hypervisor, operators

Implementation: Phala Network TEE with remote attestation
- Hardware identity verified via Intel SGX/TDX or AMD SEV attestation
- Single enclave measurements prevent privileged introspection
- Cryptographic proof that code runs in genuine hardware isolation
- Continuous attestation—not one-time verification

**Layer 2: Code & Agent Logic (What the System Can Do)**
*Agent logic governs tool use and decision boundaries; unverified changes materially alter behavior.*

Verifiable through:
- Publicly verifiable code hashes
- Immutable build artifacts
- Attested runtime loading
- Blockchain-stored hash registry (immutable audit trail)

Implementation: NEAR smart contracts + Shade agent code verification
- Agent orchestration logic hash stored on-chain
- Tool-calling rules and constraints cryptographically signed
- Guardrails and decision policies in verifiable contracts
- Prompt templates externalized with version control
- DAO governance approves code hash changes

**Layer 3: Models & Weights (How Intelligence Is Expressed)**
*Two models with the same name can behave completely differently; weights must be verifiable.*

Verifiable through:
- Hashes of model binaries/weight files
- Attested model loading inside enclaves
- Signed provenance records
- Reproducible build pipelines

Implementation: TEE-based model loading with attestation
- Model architecture and exact weight files hashed
- Quantization or fine-tuning state verified
- Version lineage tracked on blockchain
- Phala TEE loads verified model into secure memory
- Attestation proves specific model/weights used in execution

**Layer 4: User Data & Interfaces (What Shapes Behavior)**
*Ability to influence inference and training data without changing code or models is highest risk.*

Verifiable through:
- Signed inputs and attested preprocessing
- Provenance metadata for tool-supplied context
- Dataset verification (hashes, Merkle roots)
- Cryptographic commitments to training data

Implementation: Cryptographically signed inputs + dataset provenance
- Prompt integrity verified via signatures
- Input origin and transformation steps attested
- Tool-supplied context (sensor data, intelligence) cryptographically signed
- Training/fine-tuning data: dataset identity, inclusion/exclusion rules, update logs
- Public provenance manifests on blockchain for audit

**Layer 5: Runtime Behavior & Outputs (Did It Actually Do What It Claims?)**
*Verifying individual components insufficient if composed system cannot be verified at runtime.*

Verifiable through:
- Continuous attestation during execution
- Execution receipts and signed inference proofs
- Tamper-evident logs
- Deterministic or bounded-nondeterministic guarantees

Implementation: Execution proofs with blockchain audit trail
- Approved code ran (attestation proves code hash)
- Approved model was used (attestation proves model/weights hash)
- Constraints were enforced (smart contract verification)
- Final outputs arose under those conditions (execution receipt)
- All proofs recorded on-chain for independent verification

**Practical Framework: The Four Questions**

Every AI operation in this system must answer with cryptographic proof:

**1. Where did this run?**
- TEE attestation proves hardware identity and isolation
- Phala remote attestation with Intel/AMD hardware signatures
- Continuous verification, not one-time check

**2. What code ran?**
- Code hash stored on NEAR blockchain
- Runtime loads code, TEE generates attestation including code measurement
- DAO governance for code hash updates
- Immutable audit trail

**3. Which model, weights, data were used?**
- Model/weights hash verified before TEE loading
- Dataset provenance on blockchain
- Training data commitments cryptographically verifiable
- Fine-tuning and quantization state tracked

**4. Under what constraints did it execute?**
- Smart contract defines allowed operations
- TEE enforces constraints in hardware isolation
- Execution receipts prove constraint adherence
- Violations detectable via attestation verification

**Trust Termination Points**

In this architecture, trust terminates at:
- **Hardware:** Intel/AMD TEE attestation (not cloud provider)
- **Mathematics:** Cryptographic proofs, hashes, signatures (not policies)
- **Blockchain:** Immutable on-chain records (not audit reports)
- **DAO:** Transparent governance with verifiable votes (not administrators)

Trust does NOT depend on:
- Cloud provider promises
- Terms of service
- Compliance frameworks alone
- Internal access controls
- Administrator behavior
- Legal jurisdictions
- Institutional integrity

**Implications for Coalition Operations**

**Strategic advantage:**
- Coalition partners can verify behavior without trusting institutions
- Geopolitical shifts don't compromise verification
- Policy changes don't affect cryptographic proofs
- Audit trail survives organizational changes

**Operational resilience:**
- No single point of institutional failure
- Trust can be withdrawn automatically upon verification failure
- Behavior changes are detectable in real-time
- Independent verification by any coalition member

**Governance flexibility:**
- DAO enables transparent, verifiable decision-making
- Code/model upgrades require consensus
- Execution proofs enable accountability without central authority
- Works across legal jurisdictions

**Decision-Making Transparency:**
- AI-generated tactical decisions include execution proofs
- Commanders verify: code, model, data, constraints
- Strike authorizations backed by cryptographic audit trail
- Intelligence products have verifiable provenance

**Implementation Status**

Core technologies ready for verifiable zero trust:
- ✅ Phala Network TEE with remote attestation (production)
- ✅ NEAR smart contracts for code hash verification (production)
- ✅ Chain Signatures for decentralized key management (production)
- ✅ Shade agents with TEE attestation (Feb 2025)
- ✅ IPFS with content addressing for immutable artifacts (production)

**This is not conditional zero trust. This is zero trust where intelligence itself is verifiably constrained, audited, and governed without relying on institutional trust.**

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
| Production-grade agentic AI architecture | Adopt proven patterns from arxiv:2512.08769: multi-agent orchestration, single-responsibility agents, model consortium with reasoning consolidation, externalized prompts, MCP separation, containerization, KISS principle; ensures reliable, maintainable, observable AI workflows suitable for military operations | — Pending |
| Verifiable zero trust for AI | Implement five-layer verification (execution, code, models, data, runtime) with cryptographic proofs; trust terminates at hardware attestation and blockchain immutability, not institutional assurance; critical for coalition operations under geopolitical uncertainty | — Pending |
| Context graph architecture | AI context managed as structured graph of entity relationships enabling accumulated intelligence rather than ephemeral conversations; deployment intelligence grows over time; critical for operational continuity and institutional memory | — Pending |
| Hybrid storage architecture: PostgreSQL + NEAR + IPFS | PostgreSQL for fast complex queries (operational dashboards, intelligence fusion), NEAR blockchain for verification and audit trail (critical decisions, provenance), IPFS for large files (documents, sensor data); avoids indexer costs while maintaining performance and verifiability; dual-write pattern with eventual consistency; offline sync for DDIL environments | — Decided 2026-01-11 |

---
*Last updated: 2026-01-11 after incorporating hybrid storage architecture (PostgreSQL + NEAR + IPFS), context graph architecture (arXiv:2512.08769), and verifiable zero trust principles*
