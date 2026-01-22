# Roadmap: BASTION (Blockchain Autonomous Strategy & Tactical Intelligence Operational Network)

## Overview

This roadmap transforms a complex vision into reality through 12 comprehensive phases. Starting from blockchain and security foundations, we build through identity management, DAO governance, and military planning modules, then integrate autonomous vehicles and sensor fusion, culminating in a complete end-to-end system demonstrating strategy-to-autonomous-execution with human control over lethal decisions. Each phase delivers a coherent, verifiable capability that builds toward the v1 demonstration scenario.

## Domain Expertise

None

## Phases

- [x] **Phase 1: Foundation & Infrastructure** - Establish NEAR blockchain integration, Phala TEE, core smart contracts, containerized architecture
- [ ] **Phase 1.1: Calimero Self-Sovereign App Integration** - Research Calimero for DAO compartmentalization, replace Privy with NEAR accounts + MPC (INSERTED)
- [x] **Phase 2: Identity & Security Framework** - Implement DID system, ABAC, post-quantum cryptography, zero trust architecture
- [x] **Phase 3: DAO Governance** - Build smart contracts for decision authority, voting mechanisms, coalition membership
- [ ] **Phase 4: Strategic Planning Module** - Create document ingestion, NLP parsing, objective extraction, approval workflows
- [ ] **Phase 4.1: Admin UI** - Create administrative interface for system configuration (INSERTED)
- [x] **Phase 4.2: AI Agent Teams** - Per-agent model assignment, dynamic agent creation, agent DIDs (INSERTED)
- [ ] **Phase 4.3: Strategic Intelligence Fusion & RAFT Analysis** - Multi-document fusion, validity dashboard, graph-based RAFT analysis (INSERTED)
- [ ] **Phase 5: Operational Planning Module** - Implement JP 5-0, operational design, campaign planning, ROE enforcement
- [ ] **Phase 6: Autonomous Vehicle Integration** - Set up Jetson Orin Nano, integrate Sphero RVR+, deploy edge AI models
- [ ] **Phase 7: Tactical Execution System** - Build commander interface, mission orders, target selection, vehicle control
- [ ] **Phase 8: Sensor Fusion & Intelligence** - Create multi-level intelligence architecture and data fusion
- [ ] **Phase 9: Assessment & Dashboard** - Build operational picture, MOE calculation, decision support
- [ ] **Phase 10: End-to-End Integration** - Automate complete planning cycle, implement BDA feedback loops
- [ ] **Phase 11: User Experience & Personalization** - Create cinematic briefings, personalized command centers, behavioral learning
- [ ] **Phase 12: Coalition & Multi-Tenancy** - Implement information sharing rules, classification handling, federation

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: Establish the core blockchain, PostgreSQL hybrid storage, and containerized architecture foundation
**Depends on**: Nothing (first phase)
**Research**: Likely (multiple new integrations)
**Research topics**: NEAR Protocol smart contract development patterns, Phala Network TEE integration, PostgreSQL offline sync for DDIL, Docker orchestration for blockchain nodes, NEAR-Phala communication patterns
**Plans**: TBD

**Data Synchronization Strategy** (decided 2026-01-11):
- Hybrid storage: PostgreSQL (fast queries) + NEAR blockchain (verification) + IPFS (large files)
- Dual-write pattern with transactional outbox for reliability
- Event synchronization worker (no indexer infrastructure costs)
- Offline-first edge sync for DDIL environments (autonomous vehicles)
- Mission-based data retention with IPFS archival
- Self-hosted PostgreSQL with PostGIS, TimescaleDB, pg_trgm, pgvector, pg_partman

Plans:
- [x] Plan 1-01: NEAR Smart Contract Foundation (completed 2026-01-11)
- [x] Plan 1-02: Frontend Foundation & Authentication (completed 2026-01-11)
- [x] Plan 1-03: IPFS & Encrypted Storage (completed 2026-01-11)
- [x] Plan 1-04: Backend Security Migration (completed 2026-01-11)
- [x] Plan 1-03A: PostgreSQL Hybrid Storage (completed 2026-01-11, inserted after IPFS plan)
- [x] Plan 1-05: Phala TEE Integration (completed 2026-01-11)
- [x] Plan 1-06: Chain Signatures & Intents (completed 2026-01-12)
- [x] Plan 1-07: Containerization & Dev Environment (completed 2026-01-13)

### Phase 1.1: Calimero Self-Sovereign App Integration (INSERTED)
**Goal:** Research and integrate Calimero self-sovereign applications for DAO compartmentalization, replace Privy with NEAR accounts + MPC for improved security ownership
**Depends on:** Phase 1
**Research:** Required (1.1-RESEARCH.md)
**Research topics:** Calimero Network architecture, self-sovereign application patterns, DAO compartmentalization into contained member networks, NEAR implicit accounts with Web2 linking, NEAR MPC for usability, Privy replacement strategy, foundation component impact analysis
**Plans:** 0 plans

**Context:**
This urgent insertion addresses a fundamental architecture concern: moving from the centralized/managed Privy authentication service to a self-sovereign solution using NEAR accounts (implicit accounts linked to Web2 methods) and NEAR MPC for improved usability. Calimero's self-sovereign app model can compartmentalize DAOs into contained networks of approved members, significantly improving security posture.

**Key Questions to Research:**
- How do Calimero self-sovereign applications work?
- How can DAO compartmentalization improve platform security?
- What is the migration path from Privy to NEAR accounts + MPC?
- Which Phase 1 and Phase 2 components would be affected/replaced?

Plans:
- [ ] TBD (run /gsd:research-phase 1.1 to investigate)

### Phase 2: Identity & Security Framework
**Goal**: Implement decentralized identity and comprehensive security architecture
**Depends on**: Phase 1
**Research**: Complete (2-RESEARCH.md)
**Research topics**: NEAR DIDs and verifiable credentials, ABAC implementation patterns, post-quantum cryptography algorithms (CRYSTALS-Kyber, CRYSTALS-Dilithium), zero trust architecture for blockchain applications, military PKI integration patterns
**Plans**: 8

Plans:
- [x] Plan 2-01: Encrypted DID Registry (completed 2026-01-14)
- [x] Plan 2-02: Encrypted Credential Registry (completed 2026-01-15)
- [x] Plan 2-03: Backend DID Resolution (completed 2026-01-15)
- [x] Plan 2-04: ABAC Core Implementation (completed 2026-01-15)
- [x] Plan 2-05: PQC Utilities (completed 2026-01-15)
- [x] Plan 2-06: W3C Verifiable Credentials (completed 2026-01-15)
- [x] Plan 2-07: Zero Trust Middleware (completed 2026-01-16)
- [x] Plan 2-08: Frontend Identity Integration (completed 2026-01-16)

### Phase 3: DAO Governance
**Goal**: Build decentralized decision authority with multi-stakeholder voting
**Depends on**: Phase 2
**Research**: Complete (3-RESEARCH.md)
**Research topics**: NEAR DAO smart contract patterns, weighted voting mechanisms, multi-signature authorization, coalition governance models, security caveat enforcement in DAOs
**Plans**: 8

Plans:
- [x] Plan 3-01: DAO Core Module (completed 2026-01-17)
- [x] Plan 3-02: Role & Permission System (completed 2026-01-17)
- [x] Plan 3-03: Voting Engine (completed 2026-01-17)
- [x] Plan 3-04: DAO Linkages & Integration (completed 2026-01-17)
- [x] Plan 3-05: Backend DAO API (completed 2026-01-17)
- [x] Plan 3-06: Agent Infrastructure (completed 2026-01-17)
- [x] Plan 3-07: Frontend DAO Components (completed 2026-01-17)
- [x] Plan 3-08: Governance Copilot Integration (completed 2026-01-17)

### Phase 4: Strategic Planning Module
**Goal**: Create strategic objective ingestion and extraction system
**Depends on**: Phase 3
**Research**: Complete (4-RESEARCH.md)
**Research topics**: Document parsing libraries for TypeScript, NLP models for military strategy extraction, NEAR AI integration for sensitive document processing, DIME framework data modeling
**Plans**: 12

Plans:
- [x] Plan 4-01: Document Ingestion Pipeline (completed 2026-01-17)
- [x] Plan 4-02: Strategic Planning Data Model (completed 2026-01-17)
- [x] Plan 4-03: LLM Objective Extraction (completed 2026-01-18)
- [x] Plan 4-04: Approval Workflow Engine (completed 2026-01-19)
- [x] Plan 4-05: Risk Assessment Framework (completed 2026-01-19)
- [x] Plan 4-06: Strategic Planning API (completed 2026-01-19)
- [x] Plan 4-07: Admin Configuration System (completed 2026-01-19)
- [x] Plan 4-08: Strategic Planning AI Agents (completed 2026-01-19)
- [x] Plan 4-09: End-to-End Strategic Flow (completed 2026-01-20)
- [x] Plan 4-10: Objective Detail View & MIDLIFE Categorization (completed 2026-01-20)
- [x] Plan 4-11: Strategic Analysis MCP Tools & Review Agent (completed 2026-01-21)
- [x] Plan 4-12: LangGraph Agent Framework Integration (completed 2026-01-21)

### Phase 4.1: Admin UI (INSERTED)
**Goal:** Create administrative interface for system configuration and management
**Depends on:** Phase 4
**Plans:** 2 plans

Plans:
- [x] Plan 4.1-01: Admin UI Foundation (completed 2026-01-19)
- [x] Plan 4.1-02: Configuration Panels (completed 2026-01-19)

### Phase 4.2: AI Agent Teams (INSERTED)
**Goal:** Enable per-agent AI provider/model assignment, dynamic agent creation, agent identity (DID), Eliza-style personalities, MCP tools, team composition, secure inter-agent communication, and LangGraph-based multi-agent orchestration
**Depends on:** Phase 4.1
**Research:** Complete (4.2-RESEARCH.md)
**Plans:** 6 plans

**Key Features:**
- Assign different LLM providers/models to individual agents
- Create new AI agents via form or JSON file upload
- Automatic DID generation for agents, tools, and teams
- Agent-specific configuration (temperature, max tokens, etc.)
- Eliza-compatible character definitions (bio, lore, knowledge, style)
- MCP Tool Registry for creating and assigning tools to agents
- Agent Team Composer for multi-agent collaborative workflows
- ABAC-aware message bus for secure inter-agent communication
- LangGraph orchestration with supervisor pattern and checkpointing
- CrewAI-style execution patterns (sequential, parallel, hierarchical)
- Classification-aware state filtering between agents
- Comprehensive observability with execution traces

Plans:
- [x] Plan 4.2-01: Backend Schema for Per-Agent Model Config (completed 2026-01-20)
- [x] Plan 4.2-02: Agent DID and API Endpoints (completed 2026-01-20)
- [x] Plan 4.2-03: Frontend Per-Agent Config UI (completed 2026-01-20)
- [x] Plan 4.2-04: Agent Builder, MCP Tools & Team Composition (completed 2026-01-20)
- [x] Plan 4.2-05: Secure Message Bus with ABAC Enforcement (completed 2026-01-20)
- [x] Plan 4.2-06: LangGraph Orchestration Layer (completed 2026-01-20)

### Phase 4.3: Strategic Intelligence Fusion & RAFT Analysis (INSERTED)
**Goal:** Fuse multiple strategic documents into unified situational understanding with validity tracking and graph-based RAFT analysis
**Depends on:** Phase 4.2
**Research:** Required (4.3-RESEARCH.md)
**Research topics:** Graph database selection (Neo4j vs Memgraph vs ArangoDB), entity resolution and deduplication algorithms, RAFT framework modeling (Actors, Relationships, Functions, Tensions), edge weighting strategies for geopolitical networks, OSINT data integration patterns, real-time validity assessment architectures
**Plans:** 0 plans

**Context:**
This phase addresses the critical need to synthesize multiple strategic-level documents (NSS, NDS, NMS, GCPs, etc.) into a comprehensive, deduplicated understanding of the strategic environment. Each document undergoes objective extraction, but their results must be intelligently fused to eliminate redundancy while preserving all key details.

**Architecture Note (per agentic-ai-guide.pdf):**
Following best practices for production-grade agentic workflows:
- **Agents**: Single-responsibility, single-tool design for tasks requiring LLM reasoning
- **MCP Tools**: Deterministic pure functions for data operations (CRUD, queries, transformations)
- Agents are registered via the Agent Management Framework (Phase 4.2) with DIDs
- Tools are added to the MCP server for agents to invoke

---

**AI Agents (require LLM reasoning - registered in Agent Framework):**

1. **Strategic Fusion Agent** (single responsibility: consolidation reasoning)
   - Analyzes extracted objectives from multiple documents
   - Identifies semantic duplicates and reconciles conflicts
   - Produces unified strategic picture with provenance tracking
   - *Tool access*: `query_objectives`, `save_fused_objective`, `get_document_metadata`

2. **Entity Resolution Agent** (single responsibility: actor/entity matching)
   - Identifies same actors/entities referenced differently across documents
   - Resolves aliases, abbreviations, and variant names
   - Maintains canonical entity registry
   - *Tool access*: `search_entities`, `create_entity_alias`, `merge_entities`

3. **Conflict Detection Agent** (single responsibility: contradiction analysis)
   - Identifies contradictory guidance between documents
   - Assesses severity and recommends resolution approaches
   - Flags items requiring human review
   - *Tool access*: `query_objectives_by_theme`, `create_conflict_record`, `notify_reviewers`

4. **OSINT Monitor Agent** (single responsibility: event relevance assessment)
   - Evaluates incoming OSINT data for strategic relevance
   - Determines which objectives are affected by new information
   - Generates relevance scores and summaries
   - *Tool access*: `fetch_osint_feeds`, `query_active_objectives`, `create_osint_event`

5. **Validity Assessment Agent** (single responsibility: objective validity scoring)
   - Assesses whether objectives remain valid based on evidence
   - Tracks progress indicators and trend analysis
   - Generates validity reports with confidence levels
   - *Tool access*: `get_objective_evidence`, `update_validity_score`, `create_validity_alert`

6. **RAFT Extraction Agent** (single responsibility: graph element extraction)
   - Extracts actors, relationships, functions, and tensions from documents/events
   - Classifies relationship types and suggests edge weights
   - Identifies implicit relationships from context
   - *Tool access*: `create_actor`, `create_relationship`, `create_tension`, `suggest_edge_weight`

7. **RAFT Reasoning Agent** (single responsibility: graph-based analysis)
   - Analyzes RAFT graph for strategic insights
   - Identifies key actors, critical relationships, emerging tensions
   - Generates network analysis reports (centrality, clusters, paths)
   - *Tool access*: `query_graph`, `run_graph_algorithm`, `get_actor_profile`

---

**MCP Tools (deterministic operations - added to MCP server):**

**Document & Objective Tools:**
- `query_objectives(filters, pagination)` - Query fused objectives with filters
- `save_fused_objective(objective_data)` - Persist fused objective to database
- `get_document_metadata(document_id)` - Retrieve source document information
- `query_objectives_by_theme(theme, classification)` - Filter by DIME/MIDLIFE themes
- `link_objectives(parent_id, child_id, relationship_type)` - Create objective hierarchy

**Entity Resolution Tools:**
- `search_entities(query, entity_type)` - Search canonical entity registry
- `create_entity_alias(canonical_id, alias, source)` - Register entity alias
- `merge_entities(source_ids, target_id)` - Merge duplicate entities
- `get_entity_references(entity_id)` - Find all document references to entity

**OSINT Integration Tools:**
- `fetch_osint_feeds(sources, date_range)` - Pull from configured OSINT sources
- `create_osint_event(event_data)` - Store processed OSINT event
- `link_event_to_objective(event_id, objective_id, relevance_score)` - Connect evidence
- `get_objective_evidence(objective_id)` - Retrieve all linked evidence

**Validity Tracking Tools:**
- `update_validity_score(objective_id, score, reasoning)` - Update objective validity
- `create_validity_alert(objective_id, alert_type, details)` - Generate alerts
- `get_validity_history(objective_id)` - Retrieve validity score timeline
- `calculate_trend(objective_id, window)` - Compute validity trend

**RAFT Graph Tools:**
- `create_actor(name, type, attributes)` - Add actor node to graph
- `create_relationship(actor1_id, actor2_id, type, weight)` - Add relationship edge
- `create_tension(actors, description, intensity)` - Record tension
- `create_function(actor_id, function_type, domain)` - Assign function to actor
- `update_edge_weight(edge_id, weight, evidence)` - Modify relationship strength
- `query_graph(cypher_query)` - Execute graph query
- `run_graph_algorithm(algorithm, params)` - Run centrality, clustering, etc.
- `get_actor_profile(actor_id)` - Full actor view with relationships
- `export_graph_visualization(filters, format)` - Generate visualization data

**Conflict Management Tools:**
- `create_conflict_record(objectives, description, severity)` - Log conflict
- `resolve_conflict(conflict_id, resolution, approver)` - Mark conflict resolved
- `notify_reviewers(conflict_id, reviewer_ids)` - Send review notifications

---

**Key Capabilities:**

1. **Multi-Document Strategic Fusion**
   - Process multiple strategic documents through existing extraction pipeline
   - Entity resolution to identify same objectives/actors across documents
   - Semantic deduplication preserving unique perspectives and details
   - Hierarchical consolidation (e.g., NDS objectives under NSS goals)
   - Conflict detection when documents have contradictory guidance
   - Comprehensive strategic picture without information loss

2. **Strategic Validity Dashboard**
   - Real-time assessment of objective progress against world events
   - OSINT data integration (news, social media, satellite, signals)
   - Automated validity scoring based on observable indicators
   - Alert system for objectives becoming outdated or invalidated
   - Trend analysis showing objective trajectory over time
   - Evidence linking between objectives and supporting/contradicting events

3. **RAFT Graph Database & Visualization**
   - **R**elationships: Connections between actors (alliances, conflicts, dependencies)
   - **A**ctors: Nations, organizations, individuals, non-state actors
   - **F**unctions: Roles actors play (economic, military, diplomatic, informational)
   - **T**ensions: Points of friction, competition, or conflict
   - Weighted edges reflecting relationship strength/importance
   - Temporal tracking of relationship evolution
   - Interactive graph visualization with filtering and exploration
   - Integration with strategic objectives for impact analysis

Plans:
- [x] Plan 4.3-01: Neo4j Infrastructure (completed 2026-01-22)
- [x] Plan 4.3-02: RAFT Graph Schema (completed 2026-01-22)
- [x] Plan 4.3-03: Entity Resolution Pipeline (completed 2026-01-22)
- [x] Plan 4.3-04: Graph Construction Pipeline (completed 2026-01-22)
- [ ] Plan 4.3-05: OSINT Integration Tools
- [ ] Plan 4.3-06: Validity Dashboard
- [ ] Plan 4.3-07: RAFT Extraction Agent
- [ ] Plan 4.3-08: RAFT Reasoning Agent
- [ ] Plan 4.3-09: Conflict Detection Agent
- [ ] Plan 4.3-10: Graph Visualization UI
- [ ] Plan 4.3-11: End-to-End Fusion Flow

### Phase 5: Operational Planning Module
**Goal**: Implement joint planning doctrine and operational design
**Depends on**: Phase 4
**Research**: Likely (military doctrine implementation)
**Research topics**: JP 5-0 Joint Planning Process structure, operational design methodology, NATO COPD framework, rules of engagement modeling, mission command frameworks, tiered autonomy architectures
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 6: Autonomous Vehicle Integration
**Goal**: Set up edge AI platform and autonomous vehicle control
**Depends on**: Phase 1
**Research**: Likely (edge AI and robotics)
**Research topics**: Jetson Orin Nano development environment, NVIDIA edge AI models, Sphero RVR+ SDK and control protocols, object detection models for edge deployment, autonomous navigation algorithms, ROS vs custom control architecture
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 7: Tactical Execution System
**Goal**: Build commander interface and mission execution workflows
**Depends on**: Phase 5, Phase 6
**Research**: Likely (multi-modal interface design)
**Research topics**: React-based tactical map libraries, conversational AI integration patterns, WebSocket for real-time vehicle telemetry, vehicle command and control protocols, mission order data structures
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 8: Sensor Fusion & Intelligence
**Goal**: Create multi-level intelligence fusion architecture
**Depends on**: Phase 6
**Research**: Likely (sensor fusion architecture)
**Research topics**: Multi-level intelligence fusion patterns, tactical fusion algorithms for edge devices, operational fusion in backend, blockchain-based intelligence sharing, sensor data ontologies
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 9: Assessment & Dashboard
**Goal**: Build real-time operational assessment and commander's decision support
**Depends on**: Phase 7, Phase 8
**Research**: Unlikely (builds on established patterns from earlier phases)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 10: End-to-End Integration
**Goal**: Automate complete planning cycle with feedback loops
**Depends on**: Phase 9
**Research**: Unlikely (integration of existing components)
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 11: User Experience & Personalization
**Goal**: Create immersive, personalized command experience
**Depends on**: Phase 9
**Research**: Likely (advanced UX patterns)
**Research topics**: Cinematic web experiences with React, 3D visualization libraries (Three.js, Babylon.js), user behavioral learning algorithms, adaptive interface patterns, military unit branding systems
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 12: Coalition & Multi-Tenancy
**Goal**: Implement coalition information sharing and multi-national support
**Depends on**: Phase 2, Phase 3
**Research**: Likely (coalition security patterns)
**Research topics**: NATO classification schemes, Five Eyes information sharing rules, bilateral marking systems, release authority enforcement patterns, multi-tenant security isolation, coalition identity federation
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 8/8 | Complete | 2026-01-13 |
| 2. Identity & Security Framework | 8/8 | Complete | 2026-01-16 |
| 3. DAO Governance | 8/8 | Complete | 2026-01-17 |
| 4. Strategic Planning Module | 12/12 | Complete | 2026-01-21 |
| 4.3 Strategic Intelligence Fusion & RAFT | 3/11 | In progress | - |
| 5. Operational Planning Module | 0/TBD | Not started | - |
| 6. Autonomous Vehicle Integration | 0/TBD | Not started | - |
| 7. Tactical Execution System | 0/TBD | Not started | - |
| 8. Sensor Fusion & Intelligence | 0/TBD | Not started | - |
| 9. Assessment & Dashboard | 0/TBD | Not started | - |
| 10. End-to-End Integration | 0/TBD | Not started | - |
| 11. User Experience & Personalization | 0/TBD | Not started | - |
| 12. Coalition & Multi-Tenancy | 0/TBD | Not started | - |
