# Roadmap: BASTION (Blockchain Autonomous Strategy & Tactical Intelligence Operational Network)

## Overview

This roadmap transforms a complex vision into reality through 12 comprehensive phases. Starting from blockchain and security foundations, we build through identity management, DAO governance, and military planning modules, then integrate autonomous vehicles and sensor fusion, culminating in a complete end-to-end system demonstrating strategy-to-autonomous-execution with human control over lethal decisions. Each phase delivers a coherent, verifiable capability that builds toward the v1 demonstration scenario.

## Domain Expertise

None

## Phases

- [x] **Phase 1: Foundation & Infrastructure** - Establish NEAR blockchain integration, Phala TEE, core smart contracts, containerized architecture
- [ ] **Phase 1.1: Calimero Self-Sovereign App Integration** - Research Calimero for DAO compartmentalization, replace Privy with NEAR accounts + MPC (INSERTED)
- [x] **Phase 1.2: Passkey Authentication & NEAR Implicit Accounts** - Replace Privy with passkey/magic link/recovery + NEAR implicit accounts (INSERTED)
- [x] **Phase 1.3: NEAR Implicit Account Funding** - Activate implicit accounts with minimum NEAR transfer on registration (INSERTED, completed 2026-02-06)
- [x] **Phase 1.4: Navigation Architecture Restructure** - Restructure navigation to doctrine-aligned Decide/Design/Campaign/Monitor + Admin (INSERTED, completed 2026-02-23)
- [x] **Phase 2: Identity & Security Framework** - Implement DID system, ABAC, post-quantum cryptography, zero trust architecture
- [x] **Phase 3: DAO Governance** - Build smart contracts for decision authority, voting mechanisms, coalition membership
- [x] **Phase 4: Strategic Planning Module** - Create document ingestion, NLP parsing, objective extraction, approval workflows
- [x] **Phase 4.1: Admin UI** - Create administrative interface for system configuration (INSERTED)
- [x] **Phase 4.2: AI Agent Teams** - Per-agent model assignment, dynamic agent creation, agent DIDs (INSERTED)
- [x] **Phase 4.3: Strategic Intelligence Fusion & RAFT Analysis** - Multi-document fusion, validity dashboard, graph-based RAFT analysis (INSERTED)
- [x] **Phase 4.4: Mission Context & Force Onboarding** - Workspace setup, participant invitation, command relationships, resource inventories, sensor registration (INSERTED, completed 2026-01-25)
- [ ] **Phase 4.5: ATAK/CoT Tactical Interoperability** - CoT message protocol, TAK Server integration, real-time position sharing, data package export (INSERTED)
- [x] **Phase 5: Operational Planning Module** - Implement JP 5-0, operational design, campaign planning, ROE enforcement
- [x] **Phase 5.1: MDMP Governance Integration** - MDMP workflow engine, assumption registry, safety matrix, 6 new AI agents, governance gates (INSERTED, completed 2026-02-11)
- [x] **Phase 5.2: Escalation & Competition Modeling** - Adversary modeler, effect cascader, escalation modeler, deception detector, wargaming enhancement (INSERTED, completed 2026-02-13)
- [x] **Phase 5.3: End-to-End Scenario Validation & UX Cleanup** - Sidebar cleanup, comprehensive scenario seed, persona walkthrough, gap documentation (INSERTED, completed 2026-02-23)
- [ ] **Phase 6: Autonomous Vehicle Integration** - Set up Jetson Orin Nano, integrate Sphero RVR+, deploy edge AI models
- [ ] **Phase 7: Tactical Execution System** - Build commander interface, mission orders, target selection, vehicle control
- [ ] **Phase 8: Sensor Fusion & Intelligence** - Create multi-level intelligence architecture and data fusion
- [ ] **Phase 9: Assessment & Dashboard** - Build operational picture, MOE calculation, decision support
- [ ] **Phase 10: End-to-End Integration** - Automate complete planning cycle, implement BDA feedback loops
- [ ] **Phase 11: User Experience & Personalization** - Create cinematic briefings, personalized command centers, behavioral learning
- [ ] **Phase 12: Coalition & Multi-Tenancy** - Implement information sharing rules, classification handling, federation
- [ ] **Phase 12.1: Coalition Health Monitoring** - Coalition health agent, narrative impact agent, national caveat tracking, coalition gates (INSERTED)
- [x] **Phase 13: Research Whitepaper** - Comprehensive documentation for master's research requirement (completed 2026-01-24)
- [x] **Phase 14: Friendly & Adversary IPB Complete Cycle** - Exercise-driven scenario building with dual-perspective IPB, COA development, probability scoring, and commander decision support across concurrent operations (completed 2026-02-28)
- [x] **Phase 15: JPP Staff Organization Workspaces** - Role-based exercise workspaces (Commander, J1–J35) with templated doctrinal products, cross-staff real-time notifications, AI agent team integration, and strategic direction import from Design tab
- [ ] **Phase 16: AI Assigned Staff Workspaces** - AI-assigned staff roles with full agent team execution, human-in-the-loop review, real-time channel observability, and cross-role AI coordination
- [ ] **Phase 17: Deployment - CI/CD Pipeline & Hetzner Server** - GitHub Actions CI/CD pipeline deploying Bastion to Hetzner server, TEE-aware component separation documented for production, single-server dev deployment
- [x] **Phase 21: AI COP Layer Agent Team** - Autonomous agent team per workspace section that parses documents/plans, derives location/resource/intent, and generates MIL-STD-2525 interactive SVG overlay layers with standard military symbology for the common operating picture; layers include image specs for model-generated SVGs, update on commit, support publish control before promotion to top-level COP, provide entity-data linkages with hover/click detail, animate movement/phasing, and render both friendly and adversary perspectives (completed 2026-03-05)
- [x] **Phase 22: Training/Operational Global Mode** - Global app toggle switching between training (exercise) and operational modes with visual distinction, data isolation, governance weight adjustment, and reset/checkpoint capability (INSERTED) (completed 2026-03-06)
- [ ] **Phase 23: Problem Set Model & Workspace Rename** - Rename workspaces to problem sets throughout the application, add echelon-awareness (strategic/operational/tactical), update data model, UI, routes, and API (INSERTED)
- [ ] **Phase 24: Doctrinal Tab Restructure** - Replace COP/Decide/Design/Campaign/Train/Overview tabs with doctrinal lifecycle flow: Understand/Design/Plan/Direct/COP/Assess — reorganize existing components into doctrinally-aligned tabs (INSERTED)
- [ ] **Phase 25: Operational Design Workspace** - Build the Design tab with problem framing, center of gravity analysis, lines of effort/operation, operational approach development, and AI-assisted design recommendations (INSERTED)
- [ ] **Phase 26: Strategic Environment & Inheritance** - Strategic-level problem set as context provider with inheritance mechanism for directives, policy, and intelligence; update propagation to child problem sets (INSERTED)
- [ ] **Phase 27: Resource Registry & DID Plugin Architecture** - Elevate resources to first-class entities with DIDs (did:near:resource-{id}), plugin interface for resource types, built-in plugins (autonomous, sensor, weapon, comms, logistics), registry with capabilities/status/location, COP integration (INSERTED)
- [ ] **Phase 28: Embedded DAO Governance at Decision Gates** - Move DAO governance from dedicated tab into contextual workflow decision gates; proposals trigger at natural planning decision points (objective approval, COA selection, order release) (INSERTED)
- [ ] **Phase 29: Contextual AI Staff Integration** - Surface AI agent output contextually per tab; per-tab AI assistant aware of workflow phase; recommendation engine tied to doctrinal workflow position (INSERTED)

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

### Phase 1.2: Passkey Authentication & NEAR Implicit Accounts (INSERTED)
**Goal:** Replace Privy.io authentication with passkey/magic link/recovery patterns and NEAR implicit account identity while preserving DID framework compatibility via PRF extension
**Depends on:** Phase 1.1
**Research:** Complete (1.2-RESEARCH.md)
**Research topics:** WebAuthn passkey integration with NEAR implicit accounts, magic link token generation with NEAR account creation, account recovery with NEAR key rotation, session management migration from Privy, NEAR implicit account derivation from passkey public key, PRF extension for DID secret derivation
**Plans:** 12 plans

**Context:**
This phase eliminates Privy.io dependency by implementing:
1. **Passkey Authentication (WebAuthn)** - @simplewebauthn/server, discoverable credentials, PRF extension for DID integration
2. **Magic Link Authentication** - 32-byte tokens, 15-minute expiry, one-time use, SendGrid integration
3. **Account Recovery** - email verification + passkey re-registration flow
4. **NEAR Implicit Accounts** - derive account ID from passkey public key via SHA3-256
5. **PRF-DID Integration** - PRF output replaces NEAR-private-key-derived userSecret for existing DID system
6. **Migration Flow** - Existing Privy users migrate DIDs via decrypt-reencrypt pattern

**Critical Architecture Decision:**
PRF extension output serves as the `userSecret` input to existing HKDF-based DID derivation. No changes needed to DID encryption/blinding logic - only userSecret source changes.

Plans:
- [x] 1.2-01-PLAN.md — Database foundation and auth stores (passkey, session, magic link)
- [x] 1.2-02-PLAN.md — Passkey registration and NEAR implicit account derivation
- [x] 1.2-03-PLAN.md — Magic link fallback for PRF-unsupported browsers
- [x] 1.2-04-PLAN.md — PRF-to-DID integration (critical for DID compatibility)
- [x] 1.2-05-PLAN.md — Frontend components replacing Privy
- [x] 1.2-06-PLAN.md — Migration flow for existing Privy users
- [x] 1.2-07-PLAN.md — Complete Privy removal and activate passkey auth (gap closure)
- [x] 1.2-08-PLAN.md — Auth routing for login and verification pages (gap closure)
- [x] 1.2-09-PLAN.md — AWS SES email integration with templates and domain restriction
- [x] 1.2-10-PLAN.md — UAT gap closure: passkey v13, RegisterPage, auth redirect, user context (gap closure)
- [x] 1.2-11-PLAN.md — UAT gap closure: PRF base64url, redirect race condition, implicit accounts (gap closure)
- [x] 1.2-12-PLAN.md — UAT gap closure: PRF ArrayBuffer decoding, React hooks order compliance (gap closure)

### Phase 1.3: NEAR Implicit Account Funding (INSERTED)
**Goal:** Activate newly created NEAR implicit accounts by transferring minimum NEAR during registration
**Depends on:** Phase 1.2
**Research:** Not required (straightforward NEAR transfer)
**Plans:** 3 plans

**Context:**
NEAR implicit accounts (64-character hex derived from MPC public key) are valid account IDs but don't exist on-chain until they receive their first transaction. This phase implements a funding mechanism to activate accounts during registration:

1. **Funding Contract** - Dedicated NEAR smart contract with access-controlled fund() method
2. **Registration Hook** - After MPC account creation, transfer 0.1 NEAR (blocking, 3 retries)
3. **Admin UI** - Balance monitoring, activity history, low-balance warnings

Plans:
- [x] 1.3-01-PLAN.md — Funding contract (Rust) with fund(), withdraw(), balance, history (completed 2026-02-06)
- [x] 1.3-02-PLAN.md — Backend funding service, retry logic, registration hook, admin API (completed 2026-02-06)
- [x] 1.3-03-PLAN.md — Admin UI FundingPanel with balance monitoring and activity (completed 2026-02-06)

### Phase 1.4: Navigation Architecture Restructure (INSERTED)
**Goal:** Restructure frontend navigation from 6-tab layout (Home, Governance, Strategic, Validity, Missions, Admin) to doctrine-aligned 4+1 activity-based structure: Decide, Design, Campaign, Monitor + Admin
**Depends on:** Phase 1.3
**Research:** Not required (architectural restructure of existing components)
**Plans:** 2 plans

**Context:**
Current navigation reflects implementation history rather than user workflow. The restructure aligns navigation with what users DO rather than doctrinal levels-of-war, which is appropriate for a tool (vs. an org chart). Deviation from strict doctrine justified: a brigade S2 and COCOM J5 both use the same tool — their level-of-war context comes from role/login, not the tab they click.

**Component Redistribution:**
1. **Decide** — DAO governance, voting, approval workflows, authority delegation, commander guidance, MDMP governance panel
   - Sources: DAODashboard, MDMPGovernancePanel, VotingInterface, ProposalDetail
2. **Design** — Document ingestion, objectives, DIME resourcing, operational approach, COA development, problem framing (JP 5-0 steps 1-5), escalation modeling
   - Sources: StrategicDashboard, PlanningDashboard, EscalationViewer, ForceRatioPanel, BranchSequelTimeline, SustainmentPanel
3. **Campaign** — Mission planning, orders production, force allocation, command structure, MDMP workflow execution
   - Sources: MissionList, MissionDetail, MissionWizard, MissionMap, CommandTreeView, ResourceCatalog
4. **Monitor** — OSINT map, actor graph, validity scoring, alerts, event feed, real-time tracking, BDA (continuous assessment per MDMP Phase 0 + Phase 8)
   - Sources: StrategicValidityDashboard, ValidityMap, GraphExplorer, NodeDetailPanel
5. **Admin** — Unchanged system configuration
   - Sources: AdminDashboard (all panels)

Plans:
- [x] 1.4-01-PLAN.md — TabLayout sidebar shell and 4 activity tab containers (Decide, Design, Campaign, Monitor) (completed 2026-02-22)
- [x] 1.4-02-PLAN.md — App.tsx routing restructure, nav bar update, legacy redirects, CSS changes (completed 2026-02-23)

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
**Plans:** 19/12 plans complete

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
**Research:** Complete (4.3-RESEARCH.md)
**Research topics:** Graph database selection (Neo4j vs Memgraph vs ArangoDB), entity resolution and deduplication algorithms, RAFT framework modeling (Actors, Relationships, Functions, Tensions), edge weighting strategies for geopolitical networks, OSINT data integration patterns, real-time validity assessment architectures
**Plans:** 12 plans (11 complete, 1 pending)

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
   - Generates network analysis reports (eigenvector centrality, PageRank, betweenness, clusters, paths)
   - Cross-centrality comparison to surface structurally interesting actors (divergence detection)
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
- `run_graph_algorithm(algorithm, params)` - Run centrality (eigenvector, PageRank, betweenness), clustering, path finding
- `get_actor_profile(actor_id)` - Full actor view with relationships
- `export_graph_visualization(filters, format)` - Generate visualization data

**Conflict Management Tools:**
- `create_conflict_record(objectives, description, severity)` - Log conflict
- `resolve_conflict(conflict_id, resolution, approver)` - Mark conflict resolved
- `notify_reviewers(conflict_id, reviewer_ids)` - Send review notifications

### Phase 16: AI Assigned Staff Workspaces

**Goal:** AI-assigned staff roles with full agent team execution, human-in-the-loop review, real-time channel observability, and cross-role AI coordination — extending Phase 15 workspaces to support Human | AI | Disabled assignment per position with a seeded library of doctrinal AI agents for all 31 staff roles.
**Depends on:** Phase 15
**Plans:** 6/6 plans executed (checkpoint:human-verify pending on Plan 06)

Plans:
- [ ] 16-01-PLAN.md — Database schema (7 tables) + TypeScript types + 31-role agent library seed data
- [ ] 16-02-PLAN.md — Backend stores: ai-run-store, ai-channel-store, product-version-store, ai-context-store, ai-coordination-store
- [ ] 16-03-PLAN.md — LangGraph AI role graph + trigger router (debounce merge) + 9 new API routes
- [ ] 16-04-PLAN.md — ManageRoles modal (Human|AI|Disabled toggle) + AIRoleWorkspace + AgentRosterCard
- [x] 16-05-PLAN.md — ChannelFeed (SSE) + ChannelEvent renderer + ProductReviewPanel + ProductVersionHistory
- [x] 16-06-PLAN.md — StaffWorkspace three-way routing + complete wiring + human verify checkpoint

### Phase 17: Deployment - CI/CD Pipeline & Hetzner Server
**Goal:** Set up GitHub Actions CI/CD pipeline to deploy Bastion from https://github.com/VitalPointAI/Bastion.git to an economical Hetzner server, with TEE-aware component separation documented for production while co-locating everything on a single server for development
**Depends on:** Phase 16
**Plans:** 2/3 plans executed

Plans:
- [ ] 17-01-PLAN.md — Production Docker Compose, host nginx config, server bootstrap script
- [ ] 17-02-PLAN.md — GitHub Actions CI and Deploy workflows
- [ ] 17-03-PLAN.md — Server provisioning, GitHub secrets setup, end-to-end verification

### Phase 18: replace current login with @vitalpoint/near-phantom-auth

**Goal:** Replace the entire custom passkey/magic-link/TOTP authentication system with @vitalpoint/near-phantom-auth@0.4.2 — email-required registration, HttpOnly cookie sessions, password+IPFS recovery, clean break migration
**Requirements**: TBD
**Depends on:** Phase 17
**Plans:** 6/6 plans executed (complete — human e2e verification checkpoint pending)

Plans:
- [x] 18-01-PLAN.md — Install package, bootstrap backend (DB migration, auth.initialize, CORS update)
- [x] 18-02-PLAN.md — Backend route migration (replace getUserDID with requireAuth, wire NEAR funding)
- [x] 18-03-PLAN.md — Frontend auth provider swap (AnonAuthProvider, AuthWrapper, App.tsx routes)
- [x] 18-04-PLAN.md — Frontend service migration (Bearer tokens to credentials: 'include')
- [x] 18-05-PLAN.md — Cleanup and deletion (removed 12 backend + 10 frontend legacy files; 5 unused packages)
- [x] 18-06-PLAN.md — End-to-end verification (automated checks pass; human e2e browser testing checkpoint)

### Phase 19: Workspace membership and invite system

**Goal:** DAO-backed workspace membership and invite system with 3-level military hierarchy (Organization → Unit → Team), role templates, and PostgreSQL off-chain shadow tables
**Requirements**: WS-MODEL, WS-HIERARCHY, WS-ROLES, WS-MEMBERS, WS-INVITE, WS-DASHBOARD
**Depends on:** Phase 18
**Plans:** 10/10 plans executed (at human-verify checkpoint)

Plans:
- [x] 19-01-PLAN.md — Workspace type system, workspace store, and role template store (complete 2026-03-04)
- [ ] 19-02-PLAN.md — Workspace member store
- [ ] 19-03-PLAN.md — Workspace invite store
- [ ] 19-04-PLAN.md — Workspace REST API routes
- [ ] 19-05-PLAN.md — WorkspaceContext React provider
- [x] 19-06-PLAN.md — WorkspaceInviteModal, InviteAcceptPage, WorkspaceMemberManager (complete 2026-03-04)
- [ ] 19-07-PLAN.md — WorkspaceDashboard with role-adaptive panels
- [ ] 19-08-PLAN.md — MemberDirectory and compartment filtering
- [ ] 19-09-PLAN.md — OrgTree visualization
- [x] 19-10-PLAN.md — Integration: WorkspaceDashboard + OrgTree + ActivityFeed wired; all routes registered (Task 1 complete; Task 2 human-verify checkpoint)

### Phase 20: Workspace Operational Panels & Cross-Workspace Intelligence Sharing

**Goal:** Move 5 operational panels (Decide, Design, Campaign, Monitor, Train) into per-workspace tab bars, add workspace selector landing page, enable cross-workspace data sharing with classification-gated subscriptions, and implement decision escalation routing with tiered DAO voting.
**Requirements**: [WOP-01, WOP-02, WOP-03, WOP-04, WOP-05, WOP-06, WOP-07, WOP-08, WOP-09, WOP-10]
- WOP-01: Workspace Tab Container — horizontal tab bar (Overview|Decide|Design|Campaign|Monitor|Train) with role-gated visibility
- WOP-02: Workspace Selector Landing Page — post-login landing with org hierarchy tree + workspace cards
- WOP-03: Panel Context Injection — all 5 panel tabs accept workspaceId and scope data to active workspace
- WOP-04: Panel Visibility Configuration — per-workspace role→tab access stored in PostgreSQL, commander-configurable
- WOP-05: Cross-Workspace Subscription System — subscription model for non-hierarchical data sharing with approval workflow
- WOP-06: Cross-Workspace Notifications & Layer Toggle — tab badges with count, dropdown with actionable items, layer toggle for data overlays
- WOP-07: Decision Escalation Routing — manual + threshold-based escalation to parent workspace, tiered voting (autocratic/democratic)
- WOP-08: Routing Restructure — remove top-level panel routes, workspace-first navigation paradigm
- WOP-09: OrgTree Collapsible Sidebar — slide-out sidebar accessible from any tab
- WOP-10: Workspace Breadcrumb — compact header identity showing active workspace
**Depends on:** Phase 19
**Plans:** 9/9 plans complete

Plans:
- [ ] 20-01-PLAN.md — Routing restructure + WorkspaceSelector landing page + WorkspaceBreadcrumb (Wave 1)
- [x] 20-02-PLAN.md — WorkspaceTabContainer + OrgTreeSidebar (Wave 1)
- [ ] 20-03-PLAN.md — Backend stores: panel config, subscriptions, escalation rules (Wave 1)
- [ ] 20-04-PLAN.md — Panel context injection: all 5 tabs accept workspaceId + App.tsx wiring (Wave 2)
- [ ] 20-05-PLAN.md — Backend API: panel-config, subscription, escalation endpoints (Wave 2)
- [x] 20-06-PLAN.md — WorkspaceContext extension: tab notifications + cross-workspace state (Wave 2)
- [ ] 20-07-PLAN.md — CrossWorkspaceLayerToggle + TabNotificationDropdown + badge integration (Wave 3)
- [ ] 20-08-PLAN.md — EscalationPanel + SubscriptionManager + DecideTab integration (Wave 3)
- [ ] 20-09-PLAN.md — Integration: backend panel config wiring, Overview refinement, human verification (Wave 4)

### Phase 21: AI COP Layer Agent Team

**Goal:** Autonomous agent team assigned per workspace section that monitors work, parses documents/plans, derives location/resource/intent, and generates MIL-STD-2525 interactive SVG overlay layers with standard military symbology for the common operating picture. Layers begin with detailed image specs for model-generated SVGs, update on commit, support staff-controlled publish before promotion to top-level COP, provide entity-data linkages with hover/click detail, animate movement/phasing/connections, and render both friendly and adversary perspectives.
**Depends on:** Phase 20
**Research:** Complete (21-RESEARCH.md)
**Plans:** 13 plans (13 complete)

Plans:
- [x] 21-01-PLAN.md — COP types + CCO schema loader/validator + SVG sanitizer (Wave 1)
- [x] 21-02-PLAN.md — Event bus + agent definitions + trigger handler + agent pool (Wave 1)
- [x] 21-03-PLAN.md — Layer store + lifecycle state machine + version snapshots + conflict detector (Wave 2)
- [x] 21-04-PLAN.md — SIDC builder + SVG spec builder + LLM fragment generator (Wave 2)
- [x] 21-05-PLAN.md — Entity linker + confidence threshold + linkage store (Wave 2)
- [x] 21-06-PLAN.md — COP coordinator LangGraph StateGraph + 6 layer sub-agents (Wave 3)
- [x] 21-07-PLAN.md — COP REST API endpoints + module initialization (Wave 3)
- [x] 21-08-PLAN.md — COP API client + map view + layer controls + perspective toggle (Wave 4)
- [x] 21-09-PLAN.md — Entity tooltips/detail + review panel + lifecycle UI + conflict banner (Wave 4)
- [ ] 21-10-PLAN.md — Phase slider + playback + version browser + agent activity feed + human verify (Wave 4)
- [x] 21-11-PLAN.md — Gap closure: wire version snapshots + fetch data for sub-agents (Wave 5)
- [x] 21-12-PLAN.md — Gap closure: merge Overview/Monitor/COP into unified COP tab (Wave 5)
- [x] 21-13-PLAN.md — Gap closure: auto-trigger COP generation + workspace status badge (Wave 6)

### Phase 22: Training/Operational Global Mode (INSERTED)
**Goal:** Global app-level toggle that switches the entire BASTION instance between training (exercise) and operational modes — same UI, same workflow, same AI agents, different data context and consequence level
**Depends on:** Phase 21
**Research:** Unlikely
**Plans:** 6/6 plans complete

**Context:**
"Train as you fight" — the training environment must be identical to the operational environment so users build muscle memory on the same system they'll use for real planning. A global toggle (not per-workspace) prevents the dangerous scenario of mixing training and operational actions.

**Key Capabilities:**
1. **Global Mode Toggle** — App-wide TRAINING/OPERATIONAL switch in header, requires confirmation to change, persisted per user session
2. **Visual Distinction** — Training mode: persistent amber "EXERCISE - EXERCISE - EXERCISE" banner (mimicking military exercise message headers), banner only — no theme changes or accent color modifications. Operational mode: clean UI with no indicator — absence of exercise banner IS the indicator. All documents/exports in training mode auto-stamped with "EXERCISE" watermark
3. **Data Isolation** — Training mode loads from exercise scenarios with simulated forces; operational mode uses real workspace data. Separate data contexts, no cross-contamination
4. **Governance Weight** — Identical DAO governance process in both modes — no fast-tracking in training. Practice the full governance flow ("train as you fight")
5. **Reset/Checkpoint** — Training mode supports reset to phase checkpoints and replay. Operational mode has no reset capability
6. **After-Action Review** — Training mode captures all decisions, AI recommendations, and outcomes for AAR analysis

Plans:
- [ ] 22-01-PLAN.md — Backend mode infrastructure (DB schema, API, middleware)
- [ ] 22-02-PLAN.md — Frontend ModeContext, toggle UI, banner, modal
- [ ] 22-03-PLAN.md — Workspace mode filtering and Train tab removal
- [ ] 22-04-PLAN.md — AAR event store and checkpoint/reset store
- [ ] 22-05-PLAN.md — End-to-end integration verification
- [ ] 22-06-PLAN.md — EXERCISE watermark, per-mode workspace memory, scenario-to-workspace wiring

### Phase 23: Problem Set Model & Workspace Rename (INSERTED)
**Goal:** Rename "workspace" to "problem set" throughout the application to align with JP 5-0 doctrinal terminology, and enhance the model with echelon-awareness for strategic/operational/tactical classification
**Depends on:** Phase 22
**Research:** Unlikely
**Plans:** 2/10 plans executed

**Context:**
In JP 5-0, operational design addresses a "problem set" — the complex of conditions, circumstances, and influences that define the operational environment and the challenge to be addressed. Renaming workspaces to problem sets aligns the tool with doctrinal language and reinforces that each workspace represents a distinct operational problem at a specific echelon with its own design-plan-execute-assess cycle.

**Key Capabilities:**
1. **Terminology Update** — Rename workspace → problem set in all UI labels, routes, API endpoints, database columns, TypeScript types, and documentation
2. **Echelon Classification** — Each problem set tagged as strategic, operational, or tactical level, affecting available tools, planning depth, and staff composition
3. **Problem Set Selector** — Updated landing page: "Select Problem Set" with echelon indicators and operational status
4. **Hierarchy Awareness** — Strategic problem sets contain/inform operational ones, which contain/inform tactical ones — data flows down, decisions escalate up
5. **Route Updates** — `/workspace/{id}` → `/problem-set/{id}` with redirects for backward compatibility

Plans:
- [ ] 23-01-PLAN.md — Problem-set types module with echelon model (Wave 1)
- [ ] 23-02-PLAN.md — Database migration and store SQL updates (Wave 1)
- [ ] 23-03-PLAN.md — Backend store file renames to problem-set directory (Wave 2)
- [ ] 23-04-PLAN.md — Graph workspace module rename to graph problem-set (Wave 2)
- [ ] 23-05-PLAN.md — Backend API routes and cross-cutting module updates (Wave 3)
- [ ] 23-06-PLAN.md — Frontend service layer and context provider rename (Wave 3)
- [ ] 23-07-PLAN.md — Frontend component file renames to problem-set directory (Wave 4)
- [ ] 23-08-PLAN.md — Frontend routing, cross-cutting imports, and cleanup (Wave 4)
- [ ] 23-09-PLAN.md — Echelon UI: OrgTree symbols, detail card, create wizard (Wave 5)
- [ ] 23-10-PLAN.md — Build verification and human-verify checkpoint (Wave 5)

### Phase 24: Doctrinal Tab Restructure (INSERTED)
**Goal:** Replace the current tab structure (COP/Decide/Design/Campaign/Train/Overview) with a doctrinal lifecycle flow (Understand/Design/Plan/Direct/COP/Assess) that guides users through the military planning process
**Depends on:** Phase 23
**Research:** Unlikely
**Plans:** TBD

**Context:**
The current tabs are organized by feature category, not by how commanders and staff actually work through a problem. The doctrinal lifecycle — Understand → Design → Plan → Direct → COP → Assess — mirrors JP 5-0 and MDMP, guiding users through the natural progression from understanding the environment to assessing results. This is primarily a reorganization of existing components into doctrinally-aligned containers.

**Key Capabilities:**
1. **Understand Tab** — Strategic environment, intelligence assessments, threat analysis, operational variables (PMESII-PT), scenario documents, RAFT analysis, IPB assessments. Consolidates content from current Design (strategic docs) and exercise scenario/IPB views
2. **Design Tab** — Operational design workspace for problem framing, operational approach development, center of gravity analysis, lines of effort/operation. Currently the thinnest area — Phase 25 builds this out
3. **Plan Tab** — Structured JPP/MDMP planning: mission analysis, COA development, wargaming, COA comparison, COA approval. Consolidates current planning dashboard, COA tools, red team, MDMP workflow, exercise planning board
4. **Direct Tab** — Orders production (WARNORD/OPORD/FRAGO), task organization, synchronization matrices, resource allocation. Consolidates current mission/order components and resource management
5. **COP Tab** — Common Operating Picture with AI-generated overlay layers, force tracking, map visualization. Already strong from Phase 21
6. **Assess Tab** — MOE/MOP tracking, running estimates, reframing triggers, branch/sequel planning, validity dashboard. Fills a gap in the current structure
7. **Train Tab Elimination** — Training functionality absorbed by global training mode toggle (Phase 22), not a separate tab
8. **Role-Based Visibility** — Updated role→tab access matrix for the new tab structure
9. **Decide Tab Elimination** — DAO governance moved to contextual decision gates within each tab (Phase 28)

Plans:
- [ ] TBD (run /gsd:plan-phase 24 to create plans)

### Phase 25: Operational Design Workspace (INSERTED)
**Goal:** Build the Design tab as a full operational design workspace with problem framing, center of gravity analysis, lines of effort/operation definition, operational approach development, and AI-assisted design recommendations
**Depends on:** Phase 24
**Research:** Required
**Research topics:** JP 5-0 Chapter III operational design methodology, center of gravity analysis frameworks (Strange's model, CG-CC-CR-CV), lines of effort vs lines of operation, operational approach visualization, decisive points, operational reach, culmination, AI-assisted problem framing patterns
**Plans:** TBD

**Context:**
Operational design is where the creative, iterative work happens before structured planning begins. Currently the Design tab is just document upload. This phase transforms it into the workspace where commanders and planners frame the problem, identify centers of gravity, define their operational approach, and establish lines of effort — all with AI assistance that can suggest frameworks, challenge assumptions, and identify gaps in the design.

**Key Capabilities:**
1. **Problem Framing Canvas** — Interactive workspace for defining the problem: current state, desired end state, conditions, obstacles, opportunities. AI-assisted identification of key tensions and contradictions
2. **Center of Gravity Analysis** — Strange's CG-CC-CR-CV framework with AI assistance for identifying critical capabilities, requirements, and vulnerabilities for both friendly and adversary forces
3. **Lines of Effort/Operation** — Visual definition and management of LOEs/LOOs with linkage to objectives, decisive points, and phasing
4. **Operational Approach Builder** — Synthesize CoG analysis and LOEs into a coherent operational approach with phasing, transitions, and decision points
5. **Design-to-Plan Handoff** — Operational approach outputs feed directly into the Plan tab's mission analysis and COA development
6. **AI Design Assistant** — Contextual AI that suggests alternative framings, challenges assumptions, identifies gaps, and recommends operational approaches based on historical patterns and doctrinal principles
7. **Collaborative Design** — Real-time collaborative editing (Yjs) for design artifacts so multiple staff members can contribute simultaneously

Plans:
- [ ] TBD (run /gsd:plan-phase 25 to create plans)

### Phase 26: Strategic Environment & Inheritance (INSERTED)
**Goal:** Enable strategic-level problem sets to serve as context providers, with inheritance mechanisms that propagate directives, policy, intelligence, and strategic guidance to subordinate operational and tactical problem sets
**Depends on:** Phase 24, Phase 23
**Research:** Unlikely
**Plans:** TBD

**Context:**
The "overarching world view" — national/theater directives, policy, guidance, intelligence — must be accessible and inheritable by all subordinate problem sets. A strategic-level problem set publishes context that operational-level problem sets subscribe to and inherit, ensuring planning at every echelon is grounded in current strategic direction. This builds on existing cross-workspace subscription and escalation mechanisms.

**Key Capabilities:**
1. **Strategic Context Problem Set** — Special problem set type that serves as the authoritative source for strategic direction, policy, and intelligence at theater/national level
2. **Inheritance Mechanism** — Child problem sets automatically receive and display inherited strategic context in their Understand tab
3. **Update Propagation** — Changes to strategic direction (new intelligence, updated policy, revised guidance) propagate to all subscribing problem sets with notifications
4. **Context Override** — Subordinate problem sets can annotate inherited context with local interpretation without modifying the source
5. **Multi-Level Cascade** — Strategic → operational → tactical inheritance chain, with each level adding specificity
6. **Context Dashboard** — Visual display of what strategic context is inherited, when it was last updated, and what has changed

Plans:
- [ ] TBD (run /gsd:plan-phase 26 to create plans)

### Phase 27: Resource Registry & DID Plugin Architecture (INSERTED)
**Goal:** Elevate resources from data records to first-class entities with DIDs, a plugin registration system for resource types, and full integration with the COP, DAO governance, and AI agent ecosystem
**Depends on:** Phase 24
**Research:** Required
**Research topics:** Resource identity patterns in military C2 systems, DID-based asset tracking, plugin architecture patterns (Strategy/Factory), IoT device identity management, MIL-STD-2525D resource symbology, telemetry data ingestion patterns, edge device registration protocols
**Plans:** TBD

**Context:**
Currently resources (vehicles, sensors, weapons, personnel, consumables) are simple data rows with prefixed UUIDs. Agents have full DID support, registries, capabilities, and team membership. Resources deserve the same treatment — especially autonomous vehicles, sensors, and comms equipment that actively participate in operations. A plugin architecture allows new resource types to be added without core changes.

**Key Capabilities:**
1. **Resource DID System** — `did:near:resource-{id}` with blinded keys and public keys (same HKDF pattern as agents), blockchain-anchored identity
2. **Resource Registry** — Singleton registry modeled on AgentRegistry: registerResource(manifest), lookup by DID, capability queries, area queries
3. **Resource Type Plugin Interface** — Extensible plugin system: each resource type defines its schema, state machine, capabilities, data feed handler, and COP renderer
4. **Built-in Plugins** — AutonomousVehiclePlugin, SensorPlatformPlugin, WeaponSystemPlugin, CommsPlugin, LogisticsPlugin
5. **COP Integration** — Resources with location data render as MIL-STD-2525D symbols on the COP alongside AI-generated layers
6. **Telemetry Ingestion** — Resources that produce data (sensors, autonomous vehicles) can push telemetry feeds that AI agents consume
7. **DAO-Governed Allocation** — Resource assignment and employment governed through DAO proposals at decision gates
8. **Status Tracking** — Real-time readiness status (FMC/PMC/NMC) with location tracking, capability degradation, and maintenance scheduling

Plans:
- [ ] TBD (run /gsd:plan-phase 27 to create plans)

### Phase 28: Embedded DAO Governance at Decision Gates (INSERTED)
**Goal:** Move DAO governance from a dedicated Decide tab into contextual decision gates embedded within each tab of the doctrinal workflow, making governance a natural part of the planning process rather than a separate activity
**Depends on:** Phase 24, Phase 3
**Research:** Unlikely
**Plans:** TBD

**Context:**
Currently governance lives in the Decide tab with a separate governance dashboard, proposal list, and MDMP workflow view. This creates a disconnect — planners must leave their workflow to submit proposals, and commanders must navigate to a separate area to approve them. Moving governance into contextual decision gates means proposals appear naturally at decision points: approving an objective (Understand tab), selecting an operational approach (Design tab), choosing a COA (Plan tab), releasing an order (Direct tab), and reframing based on assessment (Assess tab).

**Key Capabilities:**
1. **Inline Proposal Creation** — "Submit for Approval" buttons at natural decision points within each tab, pre-populated with context from the current workflow step
2. **Contextual Approval Workflow** — Pending approvals appear as banners/modals within the tab where the decision is relevant, not in a separate governance area
3. **Decision Gate Registry** — Configurable gates at key workflow transitions: objective approval, operational approach approval, COA selection, order release, reframing decision
4. **Governance Timeline** — Compact governance history visible within each tab showing decision trail
5. **Commander Quick Actions** — Commander role sees pending approvals surfaced in context with one-click approve/reject/modify
6. **MDMP Gate Integration** — Existing MDMP governance gates (Phase 5.1) rendered within the Plan tab's workflow rather than a separate MDMP view
7. **Escalation In-Context** — Escalation to parent problem set triggered from within the workflow, not from a separate escalation panel

Plans:
- [ ] TBD (run /gsd:plan-phase 28 to create plans)

### Phase 29: Contextual AI Staff Integration (INSERTED)
**Goal:** Surface AI agent output contextually within each tab of the doctrinal workflow, providing per-tab AI assistants that are aware of the current workflow phase and deliver relevant recommendations, analysis, and automation
**Depends on:** Phase 24, Phase 25, Phase 4.2
**Research:** Required
**Research topics:** Contextual AI assistant UX patterns, workflow-aware agent orchestration, recommendation engine design for multi-phase processes, conversational AI in planning tools, agent output rendering patterns (inline, sidebar, overlay)
**Plans:** TBD

**Context:**
BASTION has 19 AI agent roles organized in teams, but their output is largely behind-the-scenes or in dedicated agent views. This phase makes AI agents visible collaborators within each tab — the right agent surfaces the right insight at the right time in the workflow.

**Key Capabilities:**
1. **Per-Tab AI Assistant Panel** — Collapsible AI panel in each tab showing contextual agent output: Understand (intelligence fusion, threat assessment), Design (problem framing, CoG analysis), Plan (COA generation, wargaming results), Direct (order validation, ROE compliance), COP (layer generation status, entity resolution), Assess (trend analysis, reframing recommendations)
2. **Workflow-Aware Agent Routing** — Agent orchestration considers which tab/phase the user is in and prioritizes relevant agents accordingly
3. **Inline Recommendations** — AI suggestions appear inline within the content area (not just in a sidebar), with accept/reject/modify actions
4. **Agent Attribution** — All AI-generated content clearly attributed to the specific agent that produced it, with confidence scores
5. **Human-AI Handoff** — Smooth transitions between AI-drafted content and human editing, with change tracking
6. **Agent Activity Feed** — Per-tab activity log showing what agents are working on, what they've produced, and what needs human review
7. **Conversational AI Interface** — Optional chat-style interaction with the AI staff for asking questions, requesting analysis, or tasking specific agents

Plans:
- [ ] TBD (run /gsd:plan-phase 29 to create plans)

### Phase 4.4: Mission Context & Force Onboarding (INSERTED)
**Goal:** Enable mission setup with participant invitation, command relationship configuration, resource inventory management, and sensor registration with map overlays
**Depends on:** Phase 4.3
**Research:** Complete (4.4-RESEARCH.md)
**Research topics:** Military command structure modeling (OPORD Annex A - Task Organization), force structure data models, logistics resource tracking standards (LOGFAS/LOGCAP), sensor categorization taxonomies (MIL-STD-2525D symbology), OTH Gold/JREAP message formats for data exchange, C2 interoperability standards
**Plans:** 9 plans

**Context:**
This phase addresses the critical capability to onboard participants and resources when establishing a mission context or workspace. Before operational planning (Phase 5) can begin, the force structure must be defined with:
- Participant invitation and identity verification
- Command relationship hierarchy (OPCON, TACON, ADCON, support relationships)
- Resource inventories (weapons systems, personnel types/numbers, ammunition, vehicles)
- Sensor registration with categorization (airborne, ground-based, maritime, space, autonomous)
- Map overlay capabilities for resource/sensor visualization

**Key Capabilities:**
1. **Participant Onboarding**
   - Invite members via DID
   - Verify clearances and credentials
   - Assign command relationships (superior/subordinate/lateral)
   - Configure role-based permissions

2. **Resource Inventory Management**
   - Weapons systems catalog with specifications
   - Personnel rosters by unit/type/specialty
   - Ammunition and consumables tracking
   - Vehicle fleet management
   - Equipment availability status

3. **Sensor Registration & Integration**
   - Categorization: airborne, ground, maritime, space, autonomous
   - Capability profiles (range, resolution, coverage area)
   - Data feed integration (STANAG, proprietary)
   - Availability scheduling

4. **Map Overlays & Visualization**
   - Toggle layers for resources by category
   - Sensor coverage visualization
   - Unit symbology (MIL-STD-2525D)
   - Real-time position updates where available

Plans:
- [x] Plan 4.4-01: Database Foundation & Dependencies (completed 2026-01-24)
- [x] Plan 4.4-02: Mission Workspace Backend API (completed 2026-01-24)
- [x] Plan 4.4-03: Mission Workspace Frontend & Wizard (completed 2026-01-24)
- [x] Plan 4.4-04: Command Relationship Backend API (completed 2026-01-24)
- [x] Plan 4.4-05: Command Relationship Frontend (completed 2026-01-24)
- [x] Plan 4.4-06: Resource Catalog Backend API (completed 2026-01-24)
- [x] Plan 4.4-07: Resource Catalog Frontend (completed 2026-01-24)
- [x] Plan 4.4-08: Map Overlays & MIL-STD-2525D (completed 2026-01-24)
- [x] Plan 4.4-09: End-to-End Integration & Verification (completed 2026-01-25)

### Phase 4.5: ATAK/CoT Tactical Interoperability (INSERTED)
**Goal:** Enable real-time data exchange with ATAK devices and TAK Server infrastructure for tactical situational awareness
**Depends on:** Phase 4.4
**Research:** Required (4.5-RESEARCH.md)
**Research topics:** Cursor on Target (CoT) XML schema and message types, TAK Server architecture and API, ATAK plugin development, multicast vs unicast CoT distribution, TLS/certificate management for TAK, data package format (.zip with manifest.xml), MIL-STD-2525D symbol integration, WebTAK browser-based client
**Plans:** 0 plans

**Context:**
ATAK (Android Team Awareness Kit) is the de facto standard for tactical situational awareness in military and first responder operations. Integration enables BASTION to:
- Receive real-time position updates from field personnel
- Push mission data, objectives, and overlays to ATAK devices
- Share sensor feeds and intelligence products
- Maintain common operational picture across web and mobile platforms

**Key Capabilities:**

1. **CoT Message Protocol**
   - XML encoder/decoder for Cursor on Target messages
   - Support for position reports (a-f-G-U-C types)
   - Support for events, alerts, and custom message types
   - Multicast (SA) and unicast (chat/mission) distribution

2. **TAK Server Integration**
   - Connect to TAK Server instances (FreeTAKServer or commercial)
   - Certificate-based TLS authentication
   - Channel/group management
   - Federation support for multi-organization operations

3. **Real-Time Position Sharing**
   - Ingest PLI (Position Location Information) from ATAK users
   - Publish BASTION entities (sensors, vehicles, objectives) to ATAK
   - Track history and movement patterns
   - Geo-fencing and boundary alerts

4. **Data Package Export**
   - Generate ATAK-compatible data packages (.zip)
   - Include KML overlays, markers, routes
   - Mission briefing documents
   - Offline map tiles for DDIL environments

5. **WebTAK Compatibility**
   - Browser-based TAK client integration
   - Alternative for users without ATAK devices
   - Shared authentication with BASTION identity

Plans:
- [ ] TBD (run /gsd:plan-phase 4.5 to create plans)

### Phase 5: Operational Planning Module
**Goal**: Implement JP 5-0 Joint Planning Process with COA development, red team analysis, ROE enforcement, and OPLAN/OPORD generation
**Depends on**: Phase 4.4
**Research**: Complete (05-RESEARCH.md)
**Research topics**: JP 5-0 Joint Planning Process structure, XState workflow management, Yjs real-time collaboration, LangGraph multi-agent orchestration, json-rules-engine for ROE, milsymbol for MIL-STD-2525D graphics, OPLAN/OPORD document generation
**Plans:** 16 plans

**Context:**
This phase implements the complete JP 5-0 Joint Planning Process with:
- 7-step workflow with flexible navigation (Planning Initiation -> Mission Analysis -> COA Development -> COA Analysis -> COA Comparison -> COA Approval -> Plan Development)
- Minimum 3 COAs required per doctrine
- Two mandatory human checkpoints (COA Approval, Plan Approval)
- Real-time collaborative editing via Yjs CRDTs
- ROE enforcement with commander-only override and blockchain audit
- AI agents: COA Generator, Red Team Simulator, COA Comparator
- Document generation: OPLAN/OPORD (DOCX, PDF), briefing slides (PPTX), sync matrices

**Key Capabilities:**

1. **JP 5-0 Workflow Engine**
   - XState v5 state machine with guards for prerequisites
   - Human checkpoints pause until commander approval
   - Flexible step navigation (can revisit completed steps)
   - PostgreSQL persistence for workflow state

2. **COA Development & Analysis**
   - AI-generated COAs with doctrinal compliance
   - Red team simulation identifying vulnerabilities
   - Objective comparison scoring (feasibility, acceptability, suitability)
   - Real-time collaborative editing

3. **ROE Enforcement**
   - json-rules-engine for declarative rule evaluation
   - Commander override workflow with justification
   - Blockchain audit trail for accountability

4. **Document Generation**
   - 5-paragraph OPORD format
   - Classification banners and handling instructions
   - Briefing slides for commander/staff/rehearsal
   - Sync matrix, DST, CCIR products
   - MIL-STD-2525D operational graphics

Plans:
- [x] Plan 05-01: Operational Planning Data Models — Plan/COA/ROE types, stores, database schema
- [x] Plan 05-02: Yjs Collaboration Infrastructure — WebSocket sync, PostgreSQL persistence, awareness
- [x] Plan 05-03: XState JP 5-0 Workflow — State machine with guards, human checkpoints, persistence
- [x] Plan 05-04: ROE Enforcement Engine — json-rules-engine, override workflow, blockchain audit
- [x] Plan 05-05: COA Generator Agent — LangGraph agent with mission context tools
- [x] Plan 05-06: Red Team Simulator Agent — Adversary analysis agent with vulnerability tools
- [x] Plan 05-07: COA Comparator Agent — Objective scoring agent with comparison tools
- [x] Plan 05-08: OPLAN/OPORD Generator — DOCX/PDF generation with 5-paragraph format
- [x] Plan 05-09: Briefing & Planning Products — PPTX slides, sync matrix, DST, CCIR
- [x] Plan 05-10: Operational Graphics & API — MIL-STD-2525D symbols, planning REST API
- [x] Plan 05-11: Planning Dashboard UI — Step navigator, plan list, dashboard components
- [x] Plan 05-12: COA Editor with Collaboration — Yjs hooks, COA components, AI action buttons
- [x] Plan 05-13: Approval Workflows & ROE Panel — Commander approvals, ROE violations, document export
- [x] Plan 05-14: CreatePlanModal Gap Closure — Modal form for plan name and type selection (gap closure)
- [x] Plan 05-15: Vite Docker Proxy Fix — Environment-aware proxy configuration for Docker networking (gap closure, completed 2026-01-31)
- [x] Plan 05-16: Step Content Area Fix — Step-specific component rendering in PlanningDashboard (gap closure, completed 2026-02-01)

### Phase 5.1: MDMP Governance Integration (INSERTED)
**Goal:** Integrate the Military Decision Making Process governance framework into Bastion's DAO layer with phase progression enforcement, assumption lifecycle tracking, safety matrix validation, and 6 new AI agents
**Depends on:** Phase 3, Phase 4.2, Phase 4.3, Phase 5
**Research:** Complete (5.1-RESEARCH.md, .planning/mdmp-governance/)
**Research topics:** MDMP phases and activities for Theater Army ASCC-level planning, five-tier authority model (AI Autonomous through Human Only), safety matrix enforcement at smart contract level, assumption lifecycle management, governance gate mechanisms, human-in/on/out-of-loop control postures
**Plans:** 17 plans (all complete, including 2 gap closure)

**Context:**
This phase emerged from a comprehensive analysis of an MDMP checklist for Theater Army planning, evaluated against Bastion's existing architecture. The analysis produced a complete data model (65 MDMP activities, 22 activity categories, 5 authority levels, 9 governance invariants) with smart contract specifications and a 12-agent expansion plan.

**Key Capabilities:**

1. **MDMP Smart Contract Module** (`near-contracts/src/mdmp/`)
   - `AutonomyLevel::FullyDelegated` variant (additive, backward-compatible)
   - 5 new `ProposalKind` variants: PhaseTransition, AssumptionAcceptance, ProductApproval, RedTeamGate, CommanderGuidance
   - `MDMPPhase` and `ActivityCategory` enums with safety enforcement methods
   - `AssumptionRegistry` contract with full lifecycle (Pending -> Accepted -> Invalidated)
   - `MDMPWorkflow` contract with phase gate enforcement
   - Safety matrix validation preventing authority level violations

2. **6 New AI Agents (Priority 1 + 3)**
   - Assumption Auditor: Surface/track planning assumptions with sensitivity analysis
   - Orders Validator: Format/consistency validation, degraded execution simulation
   - Uncertainty Quantifier: Calibrated confidence intervals, false precision detection
   - Data Bias Detector: Statistical bias, coverage gaps, staleness tracking
   - Problem Framing: Alternative problem perspectives from multiple viewpoints
   - ROE Compliance: Parse ROE, map authorities to tasks, validate compliance

3. **Governance Gate System**
   - 6 gate types: PhaseTransition, ProductApproval, AuthorityCheckpoint, RedTeamGate, CoalitionGate, AssumptionGate
   - 18 gates across 9 MDMP phases
   - Red team challenge completeness enforcement

4. **RAFT Pipeline MDMP Templates**
   - Task/constraint extraction, CCIR generation, mission statement, OPORD templates
   - IPB analysis, wargame output extraction

**Safety Matrix Enforcement:**
- AI Autonomous: DATA_AGGREGATION, VALIDATION_CONSISTENCY, MONITORING, META_COGNITIVE only
- Human Only (immutable): AUTHORITY_DECISION, ETHICAL_LEGAL, RISK_JUDGMENT
- Enforced at smart contract level (transaction rejected if violated)

Plans:
- [x] Plan 5.1-01: MDMP Smart Contract Types (wave 1) — FullyDelegated, new ProposalKind variants, MDMPPhase, ActivityCategory, TypeScript mirrors
- [x] Plan 5.1-02: Assumption Registry Contract (wave 2) — AssumptionRecord lifecycle, sensitivity, INVARIANT 3 & 6
- [x] Plan 5.1-03: MDMP Workflow Engine (wave 2) — Phase progression, gate enforcement, safety matrix, INVARIANTS 2, 4, 8, 9
- [x] Plan 5.1-04: DAO Contract Extensions (wave 2) — Extended voting policies, execution flow for FullyDelegated
- [x] Plan 5.1-05: Assumption Auditor Agent (wave 3) — Surface assumptions, track validity, sensitivity analysis
- [x] Plan 5.1-06: Orders Validator Agent (wave 2) — Format/consistency validation, degraded execution simulation
- [x] Plan 5.1-07: Uncertainty Quantifier Agent (wave 2) — Calibrated confidence intervals, false precision detection
- [x] Plan 5.1-08: Data Bias Detector Agent (wave 2) — Statistical bias, coverage gaps, staleness tracking
- [x] Plan 5.1-09: Problem Framing Agent (wave 2) — Alternative problem perspectives from multiple viewpoints
- [x] Plan 5.1-10: ROE Compliance Agent (wave 2) — Parse ROE, map authorities, validate compliance
- [x] Plan 5.1-11: Governance Gate UI (wave 3) — Phase progression dashboard, gate status, assumption tracking, commander guidance form
- [x] Plan 5.1-12: MDMP Activity Registry Backend (wave 3) — 65-activity registry, workflow service, REST API
- [x] Plan 5.1-13: RAFT Pipeline MDMP Templates (wave 2) — Task extraction, CCIR, OPORD, IPB, wargame extraction
- [x] Plan 5.1-14: End-to-End MDMP Workflow Integration (wave 4) — Integration orchestrator, safety enforcement, E2E tests for all 9 invariants
- [x] Plan 5.1-15: Decision Brief Generator (wave 4) — MDMP Phase 6 decision brief product with COA comparison matrix
- [x] Plan 5.1-16: Activity Registry Completion (gap closure) — Add 55 missing Phase 1-8 activity definitions to registry
- [x] Plan 5.1-17: Frontend-Backend API Wiring (gap closure) — MDMP service module, container panel, DAODashboard integration

### Phase 5.2: Escalation & Competition Modeling (INSERTED)
**Goal:** Build adversary modeling, escalation dynamics simulation, and effect cascading capabilities with 4 new AI agents and wargaming framework enhancement
**Depends on:** Phase 4.3, Phase 5, Phase 5.1
**Research:** Complete (5.2-RESEARCH.md, .planning/mdmp-governance/)
**Research topics:** Adversary COA development methodology (ATP 2-01.3), escalation ladder theory and simulation, second/third-order effects across DIME domains, deception detection patterns, wargaming action-reaction-counteraction frameworks
**Plans:** 10 plans

**Context:**
This phase addresses the adversary modeling and effects analysis capabilities identified during MDMP governance analysis. The existing Red Team Simulator agent is expanded to a full wargaming framework, supported by 4 new specialized agents for adversary modeling, escalation dynamics, effects cascading, and deception detection. Additional capabilities cover force ratio analysis, COA sketch generation, branch/sequel planning, and sustainment modeling.

**Key Capabilities:**

1. **Adversary Modeler Agent** — Synthesize adversary capability models, generate MLCOA/MDCOA
2. **Effect Cascader Agent** — Map second/third-order effects of each COA across all domains
3. **Escalation Modeler Agent** — Model escalation dynamics using multiple theoretical frameworks
4. **Deception Detector Agent** — Identify inconsistencies between adversary stated intent and behavior
5. **Escalation & Effect Visualization** — Escalation ladder UI, effect chain diagrams
6. **Wargaming Framework Enhancement** — Expand red team simulator to full action-reaction-counteraction
7. **Force Ratio Analysis** — Quantitative force comparison with correlation of forces methodology
8. **COA Sketch Generation** — Visual COA representation with operational graphics overlay
9. **Branch & Sequel Planning** — Contingency planning with decision point triggers
10. **Sustainment Modeling** — Logistics feasibility analysis and sustainment comparison per COA

Plans:
- [x] Plan 5.2-01: Adversary Modeler Agent — Adversary capability synthesis, adversary COA generation (completed 2026-02-12)
- [x] Plan 5.2-02: Effect Cascader Agent — Second/third-order effects mapping across domains (completed 2026-02-12)
- [x] Plan 5.2-03: Escalation Modeler Agent — Escalation ladder simulations, dynamics modeling (completed 2026-02-12)
- [x] Plan 5.2-04: Deception Detector Agent — Intent vs. behavior inconsistency detection (completed 2026-02-12)
- [x] Plan 5.2-05: Escalation & Effect Visualization — Escalation ladder UI, effect chain diagrams (completed 2026-02-13)
- [x] Plan 5.2-06: Wargaming Framework Enhancement — Expand red team simulator to full wargaming (completed 2026-02-13)
- [x] Plan 5.2-07: Force Ratio Analysis — Correlation of forces methodology, quantitative force comparison (MDMP-2-06) (completed 2026-02-13)
- [x] Plan 5.2-08: COA Sketch Generation — Visual COA representation with operational graphics overlay (MDMP-3-03) (completed 2026-02-13)
- [x] Plan 5.2-09: Branch & Sequel Planning — Contingency COAs with decision point triggers (MDMP-3-06) (completed 2026-02-13)
- [x] Plan 5.2-10: Sustainment Modeling — Logistics feasibility analysis and comparison per COA (MDMP-3-07, 5-03) (completed 2026-02-12)

### Phase 5.3: End-to-End Scenario Validation & UX Cleanup (INSERTED)
**Goal:** Validate the complete strategic-to-tactical workflow by cleaning up dead-end navigation, seeding comprehensive scenario data, and walking through persona-based workflows
**Depends on:** Phase 5.2, Phase 1.4
**Research:** Not required
**Plans:** 4 plans

**Context:**
After 123 plans across Phases 1-5.2, the sidebar navigation contained redundant placeholder items (8 items showing "requires mission context" redirect messages) and there was no comprehensive seed data to walk through the complete workflow. This phase removes navigation dead ends, creates a full Operation Pacific Shield scenario seed script, validates workflows from 3 persona perspectives, and documents the functionality matrix.

**Key Changes:**
1. **Sidebar Cleanup** — Removed 5 Design and 3 Campaign placeholder items; consolidated 6 Decide items to 3 meaningful views
2. **Scenario Seed** — `scripts/seed-scenario.sh` seeds mission, plan, 3 COAs, 8 units, 7 command relationships, 20 resources, MDMP workflow
3. **Mock Data Alignment** — Governance mock data updated to Indo-Pacific Coalition Command scenario (USA/GBR/CAN)
4. **Issue Fixes** — DAODashboard userDID wiring, MDMP panel prop fixes, sensor tab clarification

Plans:
- [x] Plan 5.3-01: Sidebar UX Cleanup — Remove placeholder items, consolidate Decide tab (completed 2026-02-23)
- [x] Plan 5.3-02: Comprehensive Scenario Seed Script — seed-scenario.sh, governance mock data alignment (completed 2026-02-23)
- [x] Plan 5.3-03: Persona Walkthrough & Issue Fixes — Known issue fixes, MDMP/governance wiring (completed 2026-02-23)
- [x] Plan 5.3-04: Gap Documentation & Demo Script Update — Functionality matrix, demo script update, roadmap (completed 2026-02-23)

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
**Depends on**: Phase 5, Phase 5.1, Phase 6
**Research**: Likely (multi-modal interface design)
**Research topics**: React-based tactical map libraries, conversational AI integration patterns, WebSocket for real-time vehicle telemetry, vehicle command and control protocols, mission order data structures

**MDMP Integration Note:** MDMP Phase 7 (Orders Production) produces governance-validated orders via the Orders Validator agent (5.1-06). This phase consumes those validated orders for tactical execution, ensuring the full governance audit trail flows through to the field.
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 8: Sensor Fusion & Intelligence
**Goal**: Create multi-level intelligence fusion architecture
**Depends on**: Phase 6
**Research**: Likely (sensor fusion architecture)
**Research topics**: Multi-level intelligence fusion patterns, tactical fusion algorithms for edge devices, operational fusion in backend, blockchain-based intelligence sharing, sensor data ontologies, MASINT/GEOINT connector pipelines, MDMP-structured IPB sensor integration

**MDMP Integration Note:** MDMP activity MDMP-0-01 (intelligence data aggregation) requires MASINT/GEOINT connector pipelines that feed into the existing Strategic Fusion agent. Sensor categorization should align with MDMP activity categories for governance-aware intelligence collection management.
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 9: Assessment & Dashboard
**Goal**: Build real-time operational assessment and commander's decision support
**Depends on**: Phase 5.1, Phase 7, Phase 8
**Research**: Likely (MDMP assessment framework integration)
**Research topics**: COP schema normalization (MDMP-0-03), deviation detection algorithms (MDMP-8-02), assessment-to-monitoring feedback loops (MDMP-8-03), MOE/MOP tracking against MDMP governance gates

**MDMP Integration Note:** MDMP Phase 8 (Assessment) has significant overlap with this phase. The assessment tracking module, deviation detection (plan vs. actual), and assessment-to-monitoring feedback loops are all MDMP governance-aware. COP schema normalization (MDMP-0-03) is a core requirement for the common operational picture.
**Plans**: TBD

Plans:
- [ ] TBD during phase planning

### Phase 10: End-to-End Integration
**Goal**: Automate complete planning cycle with feedback loops
**Depends on**: Phase 5.1, Phase 5.2, Phase 9
**Research**: Unlikely (integration of existing components)

**MDMP Integration Note:** The "complete planning cycle" must include the full MDMP workflow (Phases 0-VIII) with all governance gates, assumption lifecycle management, escalation modeling, and coalition health monitoring. This phase validates that the JP 5-0 workflow (Phase 5) and MDMP governance layer (Phase 5.1) operate as an integrated system from strategic guidance through assessment.
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

### Phase 12.1: Coalition Health Monitoring (INSERTED)
**Goal:** Real-time coalition partner health monitoring, national caveat tracking, and coalition gate enforcement with 2 new AI agents and smart contract extensions
**Depends on:** Phase 3, Phase 5.1, Phase 12
**Research:** Complete (12.1-RESEARCH.md, .planning/mdmp-governance/)
**Research topics:** JP 3-16 Multinational Operations, coalition partner force posture monitoring, national caveat management, multi-party approval gates, coalition cohesion metrics, narrative/info op impact modeling
**Plans:** 6 plans

**Context:**
This phase addresses coalition-specific capabilities identified during MDMP governance analysis. Two new AI agents provide continuous assessment of coalition partner health and narrative impact, while smart contract extensions to the existing linkages contract enable national caveat tracking and coalition gate enforcement.

**Key Capabilities:**

1. **Coalition Health Agent** — Monitor coalition cohesion, track partner posture changes, alert on defection risk
2. **Narrative Impact Agent** — Model information operation impact across audience segments
3. **National Caveat Tracking** — Extend linkages contract for per-member caveat management and conflict detection
4. **Coalition Gate Mechanism** — Multi-party approval gates requiring coalition partner consensus
5. **Coalition Health Dashboard** — Partner status visualization, caveat conflicts, health metrics

**Red Team Challenges Supported:**
- RT-2-08: Coalition partner defection under stress
- RT-5-03: Underweighted partner constraints

Plans:
- [ ] Plan 12.1-01: Coalition Health Agent — Monitor cohesion, track partner posture changes
- [ ] Plan 12.1-02: Narrative Impact Agent — Info op impact modeling across audiences
- [ ] Plan 12.1-03: National Caveat Tracking — Extend linkages contract for caveat management
- [ ] Plan 12.1-04: Coalition Gate Mechanism — Multi-party approval gates in DAO linkages
- [ ] Plan 12.1-05: Coalition Health Dashboard — Partner status, caveat conflicts, health metrics

### Phase 13: Research Whitepaper
**Goal**: Comprehensive academic whitepaper answering the research question on AI-augmented DAOs for military C2
**Depends on**: All phases (documents completed and in-progress work)
**Research**: Complete (13-RESEARCH.md)
**Plans**: 9 plans

**Research Question:**
> How can interconnected, AI-augmented Decentralized Autonomous Organizations (DAOs) provide a secure, transparent, and resilient governance framework that enables effective C2, accelerates decision-making, optimizes resource management, and supports autonomous, policy-compliant coordination across diverse national and organizational boundaries?

**Whitepaper Requirements:**
1. **Full Project Description** - Vision, objectives, and scope of BASTION
2. **Technology Integration Analysis** - Each integrated technology (NEAR, Phala, Neo4j, LangGraph, etc.) with explanation of purpose and rationale
3. **End-to-End Flow** - Complete strategic-to-execution flow demonstrating system capabilities
4. **SITREP** - Completed phases, current status, remaining work
5. **Physical Demo Components** - Jetson Orin Nano, Sphero RVR+, intended demonstration actions
6. **Design & Architecture Choices** - Key decisions with justification
7. **Risk Analysis** - Security risks, capability gaps, process concerns
8. **Academic Context** - Research contribution and novelty

**Target Audience:** Academic advisor overseeing master's research project

Plans:
- [x] Plan 13-01: Document Foundation & Introduction (completed 2026-01-24)
- [x] Plan 13-02: Background - DAOs & Web3 (completed 2026-01-24)
- [x] Plan 13-03: Background - Military Coordination & AI (completed 2026-01-24)
- [x] Plan 13-04: Methodology & Architecture Diagrams (completed 2026-01-24)
- [x] Plan 13-05: Results & Demo Description (completed 2026-01-24)
- [x] Plan 13-06: Discussion, Conclusion & Appendices (completed 2026-01-24)
- [x] Plan 13-07: Abstract & Final Assembly (completed 2026-01-24)
- [x] Plan 13-08: GitBooks Publishing (completed 2026-01-24)
- [x] Plan 13-09: PDF & DOCX Export (completed 2026-01-24)

### Phase 14: Friendly & Adversary IPB Complete Cycle
**Goal**: Build exercise scenario from provided documents with dual-perspective IPB, COA development with probability scoring, concurrent operation support, and commander decision-forcing workflows
**Depends on**: Phase 5.3 (Scenario Validation), Phase 5.2 (Escalation & Competition Modeling), Phase 5.1 (MDMP Governance)
**Research:** Complete (14-RESEARCH.md)
**Plans**: 11 plans

**Context:**
This phase builds the exercise scenario management capability on top of BASTION's existing strategic planning, document ingestion, operational planning, and wargaming infrastructure. The phase extends and generalizes existing systems with dual-perspective (Blue/Red) information isolation, scenario package ingestion, IPB assembly, COA scoring with wargame evidence, WARNORD/OPORD/FRAGO generation, and planning board task tracking. The exercise documents in scenario/ (Pacific Strategy AY26 -- Indo-Pacific / Taiwan contingency) serve as the reference implementation.

**Key Capabilities:**
1. **Scenario Package Upload & Extraction** -- Multi-file upload with auto-inferred team/phase/type tags; AI extraction with team-isolated prompts
2. **Dual-Perspective IPB** -- Blue/Red toggle with layered military overlays (forces, key terrain, avenues, NAIs) on extended ValidityMap
3. **COA Scoring & Commander Decisions** -- 5 doctrinal criteria + wargame evidence; decision matrix with editable AI narrative; blockchain-anchored commander decisions
4. **WARNORD/OPORD/FRAGO Orders** -- AI-generated and manual authoring; per-team information isolation; order publication creates planning tasks
5. **Planning Board & Phase Gates** -- Kanban task tracking; exercise controller gate management; explicit phase transitions

Plans:
- [x] Plan 14-01: Exercise Data Model & Stores -- Types, Zod schemas, 7 PostgreSQL stores, information barrier, DB migration (wave 1)
- [x] Plan 14-02: Scenario Package Parser & Extraction Service -- Directory heuristics, exercise-specific LLM extraction (wave 2)
- [x] Plan 14-03: IPB Assembly & COA Scoring Services -- Dual-perspective IPB from documents, doctrinal + wargame combined scoring (wave 2)
- [x] Plan 14-04: Order Generator & Planning Board Service -- WARNORD/OPORD/FRAGO generation, task lifecycle, notifications (wave 2)
- [x] Plan 14-05: Exercise REST API -- 25+ endpoints with information barrier enforcement (wave 3)
- [x] Plan 14-06: Frontend Service & Dashboard Shell -- API client, exercise dashboard, scenario package upload UI (wave 4)
- [x] Plan 14-07: IPB Panel & ValidityMap Extension -- Dual-perspective IPB view, military overlay layers, milsymbol markers, SITREP delta preview (wave 5)
- [x] Plan 14-08: COA Scoring & Commander Decision UI -- Decision matrix, editable narrative, accept/reject/modify/combine workflow (wave 5)
- [x] Plan 14-09: Order Editor & Planning Board UI -- WARNORD/OPORD/FRAGO authoring, Kanban task board (wave 5)
- [x] Plan 14-10: Timeline, Gates & Dashboard Integration -- Phase timeline, gate control, full dashboard wiring (wave 6)
- [ ] Plan 14-11: SITREP Delta Preview Backend (gap closure) -- Add previewIPBFromSITREP method and Express route for EX-15 (wave 7)

### Phase 15: JPP Staff Organization Workspaces
**Goal**: Reorganize the exercise workspace to mirror the Joint Planning Process staff organization, providing role-based workspaces (Commander, J1, J2, J3, J35, etc.) with templated doctrinal products, cross-staff real-time notifications, AI agent team integration, and optional strategic direction import
**Depends on**: Phase 14 (Friendly & Adversary IPB Complete Cycle)
**Research:** Required
**Plans**: 5 plans
**Requirements:** JPP-01 (Per-Role Workspaces), JPP-02 (Templated Doctrinal Products), JPP-03 (Cross-Staff Notifications), JPP-04 (AI Agent Integration), JPP-05 (Strategic Direction Import), JPP-06 (Coherent Merged Products)

**Context:**
This phase restructures the exercise area to model a doctrinal Joint staff organization. Each staff role (Commander, J1 through J35+) gets a dedicated workspace with templated products aligned to their doctrinal responsibilities. Cross-workspace real-time notification ensures that when one staff member creates knowledge or insight, all other staff members are alerted and can integrate it into their planning. AI agent teams can be attached to each role's work products to automate routine tasks.

**Key Capabilities:**
1. **Per-Role Workspaces** — Dedicated work areas for Commander, J1 (Personnel), J2 (Intelligence/IPB), J3 (Operations), J35 (Plans), J4 (Logistics), J5 (Strategic Plans), J6 (Communications) with doctrinally-tailored templates
2. **Templated Doctrinal Products** — Each role has pre-configured work products they are expected to produce (e.g., J2: IPB products, threat assessments; J3: synchronization matrices, COA sketches; Commander: decisions, guidance, COA selection)
3. **Cross-Staff Real-Time Notifications** — When one workspace produces knowledge/insight, all other staff members receive alerts with an integrate button to incorporate into their planning
4. **AI Agent Team Integration** — Option to build/attach agent teams to each aspect of each role's work, automating routine doctrinal tasks
5. **Strategic Direction Import** — Exercise scenarios can optionally include real strategic direction from the Design tab and/or real strategic campaign plans from Bastion's other modules
6. **Coherent Merged Products** — Real-time merging of staff products into unified planning outputs

**Implementation Scope:**
- First implement in the Exercise area of Bastion for testing with existing Pacific Strategy scenario
- Later extend to remodel the rest of the application

Plans:
- [x] 15-01-PLAN.md — Database migration (staff_products, staff_notifications, enabled_roles), backend stores, notification service, strategic import service, and REST routes (wave 1)
- [x] 15-02-PLAN.md — Exercise shell restructure: StaffWorkspace sidebar with category-grouped roles, RoleDashboard, ExerciseDashboard modification with role selection in Create Scenario (wave 2)
- [x] 15-03-PLAN.md — Doctrinal product templates with hybrid editor (structured fields + narrative), pre-population from Phase 14 IPB/COA/order data (wave 3)
- [x] 15-04-PLAN.md — Cross-staff notification panel with bell icon, WebSocket real-time delivery, role filtering, and per-role sidebar badges (wave 3, parallel with 03)
- [x] 15-05-PLAN.md — Product diff integration view, strategic direction import UI, AI agent suggestion panel with per-block accept/reject (wave 4)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 8/8 | Complete | 2026-01-13 |
| 1.1 Calimero Self-Sovereign App | 0/TBD | Not started | - |
| 1.2 Passkey + NEAR Implicit Auth | 12/12 | Complete | 2026-02-01 |
| 1.3 NEAR Implicit Account Funding | 3/3 | Complete | 2026-02-06 |
| 1.4 Navigation Architecture Restructure | 2/2 | Complete | 2026-02-23 |
| 2. Identity & Security Framework | 8/8 | Complete | 2026-01-16 |
| 3. DAO Governance | 8/8 | Complete | 2026-01-17 |
| 4. Strategic Planning Module | 19/12 | Complete   | 2026-02-22 |
| 4.1 Admin UI | 2/2 | Complete | 2026-01-19 |
| 4.2 AI Agent Teams | 6/6 | Complete | 2026-01-20 |
| 4.3 Strategic Intelligence Fusion & RAFT | 14/14 | Complete | 2026-02-22 |
| 4.4 Mission Context & Force Onboarding | 9/9 | Complete | 2026-01-25 |
| 4.5 ATAK/CoT Tactical Interoperability | 0/TBD | Not started | - |
| 5. Operational Planning Module | 16/16 | Complete | 2026-02-01 |
| 5.1 MDMP Governance Integration | 17/17 | Complete | 2026-02-11 |
| 5.2 Escalation & Competition Modeling | 10/10 | Complete | 2026-02-13 |
| 5.3 Scenario Validation & UX Cleanup | 4/4 | Complete | 2026-02-23 |
| 6. Autonomous Vehicle Integration | 0/TBD | Not started | - |
| 7. Tactical Execution System | 0/TBD | Not started | - |
| 8. Sensor Fusion & Intelligence | 0/TBD | Not started | - |
| 9. Assessment & Dashboard | 0/TBD | Not started | - |
| 10. End-to-End Integration | 0/TBD | Not started | - |
| 11. User Experience & Personalization | 0/TBD | Not started | - |
| 12. Coalition & Multi-Tenancy | 0/TBD | Not started | - |
| 12.1 Coalition Health Monitoring | 0/5 | Not started | - |
| 13. Research Whitepaper | 9/9 | Complete | 2026-01-24 |
| 14. Friendly & Adversary IPB Complete Cycle | 11/11 | Complete    | 2026-03-01 |
| 15. JPP Staff Organization Workspaces | 5/5 | Complete    | 2026-03-02 |
| 16. AI Assigned Staff Workspaces | 2/6 | In progress | - |
| 17. Deployment - CI/CD & Hetzner | 0/3 | Not started | - |
| 18. Near-Phantom-Auth | 6/6 | Complete | - |
| 19. Workspace Membership & Invites | 4/10 | In progress | - |
| 20. Workspace Operational Panels | 3/9 | In progress | - |
| 21. AI COP Layer Agent Team | 13/13 | Complete | 2026-03-05 |
| 22. Training/Operational Global Mode | 6/6 | Complete   | 2026-03-06 |
| 23. Problem Set Model & Rename | 2/10 | In Progress|  |
| 24. Doctrinal Tab Restructure | 0/TBD | Not started | - |
| 25. Operational Design Workspace | 0/TBD | Not started | - |
| 26. Strategic Environment & Inheritance | 0/TBD | Not started | - |
| 27. Resource Registry & DID Plugin | 0/TBD | Not started | - |
| 28. Embedded DAO Governance | 0/TBD | Not started | - |
| 29. Contextual AI Staff Integration | 0/TBD | Not started | - |
