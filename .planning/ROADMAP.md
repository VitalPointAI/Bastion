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
- [x] **Phase 24: Doctrinal Tab Restructure** - Replace COP/Decide/Design/Campaign/Train/Overview tabs with doctrinal lifecycle flow: Understand/Design/Plan/Direct/COP/Assess — reorganize existing components into doctrinally-aligned tabs (INSERTED)
- [x] **Phase 25: Operational Design Workspace** - Build the Design tab with problem framing, center of gravity analysis, lines of effort/operation, operational approach development, and AI-assisted design recommendations (INSERTED, completed 2026-03-06)
- [x] **Phase 25.1: Training Package Upload & From-Scenario Integration** - Wire ScenarioPackageUpload wizard into Understand tab; add "Create from Scenario" option to CreateProblemSetWizard; integrate multi-file drag-drop upload with tag inference (team/phase/doc type) and async LLM extraction; surface upload status and extracted documents in Understand tab (INSERTED, completed 2026-03-06)
- [ ] **Phase 25.2: Strategic Document Containers & Actor Categorization** - Organize strategic documents into nation/group containers (e.g., United States, China, NATO) with actor categories (ally, adversary, neutral, partner); persistent container-based organization for building strategic environments over time; feeds into Phase 26 strategic environment inheritance (INSERTED)
- [ ] **Phase 25.3: AI Strategic Context & Knowledge Graph Integration** - Wire subscribed strategic environment data and container-scoped knowledge graphs into AI agent context; subscription cache materializer populates problem_set_data_cache; container-scoped RAFT graph construction with auto-trigger on document changes; graph summary injection into assembleContextNode for exercise AI agents; context size management with truncation and prioritization (INSERTED)
- [ ] **Phase 26: Strategic Environment & Inheritance** - Strategic-level problem set as context provider with inheritance mechanism for directives, policy, and intelligence; update propagation to child problem sets (INSERTED)
- [x] **Phase 27: Resource Registry & DID Plugin Architecture** - Elevate resources to first-class entities with DIDs (did:near:resource-{id}), plugin interface for resource types, built-in plugins (autonomous, sensor, weapon, comms, logistics), registry with capabilities/status/location, COP integration (INSERTED) (completed 2026-03-07)
- [ ] **Phase 28: Embedded DAO Governance at Decision Gates** - Move DAO governance from dedicated tab into contextual workflow decision gates; proposals trigger at natural planning decision points (objective approval, COA selection, order release) (INSERTED)
- [ ] **Phase 29: Contextual AI Staff Integration** - Surface AI agent output contextually per tab; per-tab AI assistant aware of workflow phase; recommendation engine tied to doctrinal workflow position (INSERTED)
- [x] **Phase 30: Ironclaw Agent Integration** - Integrate Ironclaw agent (NEAR AI) as chief-of-staff capability for system changes, code modifications via PR/CI-CD, and problem set configuration on behalf of authorized users (INSERTED) (completed 2026-03-07)
- [ ] **Phase 31: AI Agent Validation & Compliance Testing** - Validation and testing framework to quantitatively assess AI agent integration across determinism, reliability, and doctrinal compliance dimensions (INSERTED)
- [x] **Phase 32: Network Device Discovery & Secure Automatic Resource Onboarding** - Automatic device discovery on local networks (Bluetooth, WiFi, USB, TAK/RF), fingerprinting, and seamless onboarding as first-class resources with DID identity and capability mapping (INSERTED)
- [x] **Phase 33: Joint Planning Process (JPP) Campaign Plan Framework** - Full 7-step JPP workflow as collaborative planning framework within Plan tab, producing COAs and annex-based campaign plans with Ends-Ways-Means linkage to strategic objectives (INSERTED)
- [x] **Phase 34: Plan Tab Echelon Routing & MDMP Tactical Wiring** - Plan tab reads echelon from ProblemSetContext and renders appropriate workflow (JPP for operational, MDMP for tactical, placeholder for strategic); wire existing MDMP module into Plan tab with sidebar navigation, role-gated sections, governance gates, AI agent panels
- [x] **Phase 35: Mission Creation from OPORD & Problem Set Alignment** - Extend Phase 33 Plan 10 document distribution to trigger tactical child problem set creation from OPORD Step 7; auto-populate with inherited context; initialize MDMP at Receipt of Mission; merge existing mission module into problem set framework (completed 2026-03-08)
- [x] **Phase 36: Strategic Guidance Workflow** - Build strategic level Plan tab workflow for objective setting, force apportionment, constraint definition, directive drafting; strategic directive output becomes initiating directive for child campaign JPP Step 1 (completed 2026-03-08)
- [x] **Phase 37: Training Assessment Loop** - AAR capture at tactical training events, METL proficiency tracking (T/P/U per task), upward aggregation from training events through exercises to training strategy readiness updates (completed 2026-03-08)
- [x] **Phase 38: Inheritance Deepening** - Full context propagation with change notification, override tracking with parent visibility, OPORD update propagation to child missions, upward reporting of tactical COP/execution status to parent campaign (completed 2026-03-08)
- [x] **Phase 39: Operational Demonstration Data Package** - Comprehensive reusable demo data package populating BASTION end-to-end with Pacific Strategy AY26 content from strategy through tactical missions, all doctrinal tabs, AI agent outputs, RAFT graph, and OSINT pipeline (INSERTED)
- [x] **Phase 40: Autonomous Document Intelligence Team** - Multi-agent document processing team that autonomously ingests, classifies, extracts, cross-links, and validates documents with minimal user involvement; problem set scoping interview captures context boundaries and standing intelligence requirements; specialist agents (orchestrator, converter, classifier, perspective analysts, fact/objective extractors, linker, bias identifier, quality assessor) process each document adaptively; autonomous problem set researcher uses web search and OSINT to fill knowledge gaps and build strategic understanding; ExtractionTheater visualization shows full pipeline live (INSERTED) (completed 2026-03-09)
- [ ] **Phase 41: Redesign Understanding Tab — Adaptive Brain Visualization** - Replace Understanding tab's sidebar-driven view list with neural network brain visualization centerpiece fed by unified ingestion pipeline; living adaptive graph visualizing knowledge relationships (INSERTED)
- [x] **Phase 42: Resources Tab — Inventory, Discovery & Onboarding** - Add a dedicated Resources tab to the problem set tab bar; consolidate orphaned discovery components (ClientDiscoveryPanel, DiscoveryLayer, NetworkTopologyView, EMSpectrumPanel) and existing ResourceCatalog into a unified inventory and onboarding view; sub-views for equipment/personnel/consumable inventory, network device discovery and onboarding pipeline, resource group management, capability search, and registry statistics; wires existing Phase 27 (Resource Registry) and Phase 32 (Discovery) backend services into a reachable UI (INSERTED) (completed 2026-03-12)
- [x] **Phase 43: Robot Agent & Local Discovery Bridge** - Lightweight Python robot agent for outbound self-registration/command/telemetry via WebSocket; Docker-based local network bridge for mDNS/SSDP WiFi scanning and device relay to Bastion cloud; bridge acts as command proxy; mDNS auto-discovery between robot and bridge; dual-path connectivity for resilience (INSERTED) (completed 2026-03-12)
- [x] **Phase 44: Robot Vision Capabilities & Mission Intent Translation** - Vision capabilities (CSI camera, detectNet, ORB feature matching) for Sphero RVR+/Jetson Orin Nano; mission intent translation (LLM + template fallback); mission behavior profiles; pre-flight DID constraint validation; four vision-enabled mission types (recon_area, visual_search, overwatch, resupply_route); sweep path planning (completed 2026-03-13)
- [ ] **Phase 45: Knowledge Graph Subspaces** - Container-scoped subgraphs, focus-and-expand pattern, hierarchical drill-down, and virtual lenses for managing growing knowledge graphs at scale
- [x] **Phase 46: Sphero RVR+ Swarm Leader & Doctrinal Movement Control** - Vision-equipped RVR+ as swarm leader coordinating heterogeneous resources (RVR+, drones, UGVs, sensors) in 6 doctrinal formations and 4 movement techniques; UDP broadcast peer mesh; DAO-driven dynamic membership; leader vision sharing; swarm telemetry to COP with all member positions visible (completed 2026-03-14)
- [ ] **Phase 47: JSON-LD Semantic Brain + COP Fix** - Refactor knowledge graph to JSON-LD with formal ontology alignment (BFO, CCO, DODAF/DNDAF), provenance tracking, temporal reasoning, entity resolution, confidence scoring; fix COP layer generation end-to-end (INSERTED)
- [ ] **Phase 48: Robot Swarm Behaviour End-to-End Demo** - Complete BASTION strategy-to-autonomous-execution pipeline demo with Taiwan defense scenario, 3-robot coalition swarm, AI objective extraction, DAO-authorized missions, swarm recon, COP detections, lethal escalation gates, brain graph timeline playback (INSERTED)
- [x] **Phase 49: Align Design Tab with Plan Tab** - Remove duplicate operational design from Plan tab, establish Design tab as single source of truth for operational design artifacts, wire Design outputs as automatic starting point for campaign planning, restructure Strategic Guidance to remove Operational Approach step and add Alignment step, build generic fork-and-merge revision system for Plan-to-Design change proposals through DAO governance (INSERTED) (completed 2026-03-17)
- [ ] **Phase 50: Universal Intelligence Input & Auto-Classification** - Replace fragmented ingestion sidebar (separate document upload, OSINT modal, filter tags) with a single universal input area that accepts any content type (files, URLs, pasted text, structured data) and automatically discerns source type, classifies content, routes to appropriate specialist agents, and extracts intelligence — all orchestrated by the lead agent with robust error handling, retry logic, and user-facing status; eliminates manual source-type selection and reduces ingestion to a single drag/drop/paste/type interaction (INSERTED)
- [x] **Phase 56: Visual Operational Approach Editor — Map-Based Military Symbology** - Interactive Leaflet map with MIL-STD-2525D military symbology overlay for operational approach development; dual editing: Ironclaw chat-driven (natural language → tool calls → map updates) and direct manipulation (drag-and-drop symbols, draw control measures, click-to-edit properties); milsymbol.js rendering; MGRS coordinate support; Ironclaw registered skills (add/move/remove/update symbols, add control measures and overlay graphics); Yjs collaborative sync; overlay persisted as part of OperationalDesign data model (INSERTED) (completed 2026-03-25)
- [x] **Phase 57: Ironclaw Persistent Memory & Adaptive Relationship** - Long-term memory system that makes Ironclaw a true AI staff officer: per-user preference memory (working style, critique tolerance, strengths/weaknesses, communication style), interaction outcome tracking (suggestions accepted/rejected, edit patterns post-critique, valued vs dismissed input), problem set context memory (decisions, rationale, assumptions across sessions), and adaptive behavior engine that adjusts proactivity, critique frequency, draft-offering, and communication style based on accumulated interaction patterns; stored in ironclaw-postgres; memory retrieval integrated into all Ironclaw prompts for personalized, evolving relationship with each user (INSERTED) (completed 2026-03-25)
- [ ] **Phase 62: Knowledge Graph Entity Deduplication & Auto-Resolution** - Eliminate duplicate nodes by integrating entity resolution into ingestion pipeline; name canonicalization before node creation; auto-run resolution after buildFromDocument() and OSINT sync; batch-merge existing duplicates; canonical alias registry for common name variants; dedup metrics (INSERTED)

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

### Phase 32: Network device discovery and secure automatic resource onboarding

**Goal:** Bastion automatically discovers devices on local networks (Bluetooth, WiFi, USB, TAK/RF), fingerprints them, and seamlessly onboards them as first-class resources with DID identity, capability mapping, and bidirectional command channels. Includes DAO-governed acceptance gates, EM spectrum awareness, and Ironclaw-driven adapter generation for unknown devices.
**Requirements:** [DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07, DISC-08, DISC-09, DISC-10, DISC-11, DISC-12, DISC-13, DISC-14, DISC-15, DISC-16, DISC-17, DISC-18, DISC-19, DISC-20, DISC-21, DISC-22]
**Depends on:** Phase 31
**Plans:** 9/9 plans complete

Plans:
- [x] 32-01-PLAN.md -- Foundation types, DB schema, discovery store, lifecycle state machine
- [ ] 32-02-PLAN.md -- CommandAdapter plugin facet, hot-load support, Ironclaw protection
- [ ] 32-03-PLAN.md -- Transport scanner modules (BLE, WiFi, USB, TAK)
- [x] 32-04-PLAN.md -- Acceptance gate, fingerprinting, challenge-response auth
- [ ] 32-05-PLAN.md -- Onboarding pipeline, discovery service orchestrator
- [ ] 32-06-PLAN.md -- WebSocket handler, REST API, behavioral baseline, barrel export
- [ ] 32-07-PLAN.md -- EM spectrum awareness, network topology with hopping
- [ ] 32-08-PLAN.md -- Server wiring and module integration
- [ ] 32-09-PLAN.md -- Frontend COP layers (discovery, EM, topology)

### Phase 33: Joint Planning Process (JPP) campaign plan framework with ends-ways-means linkage

**Goal:** Build the full 7-step JPP workflow as a collaborative planning framework within the Plan tab, producing COAs and annex-based campaign plans with Ends-Ways-Means linkage to strategic objectives. Includes entity resolution, OSINT feed integration (Argus), and designated AI agents per step.
**Requirements:** [JPP-01, JPP-02, JPP-03, JPP-04, JPP-05, JPP-06, JPP-07, JPP-08, JPP-09, JPP-10, JPP-11, JPP-12, JPP-13]
**Depends on:** Phase 32
**Plans:** 12 plans (10 complete, 2 gap closure)

Plans:
- [ ] 33-01-PLAN.md -- JPP domain types, DB schema, JPP store, E-W-M store
- [ ] 33-02-PLAN.md -- OSINT webhook endpoint, feed config store
- [ ] 33-03-PLAN.md -- 7 JPP agent manifests, JPP MCP tools, E-W-M MCP tools
- [ ] 33-04-PLAN.md -- JPP REST API, frontend service layer (jpp, ewm, osint, entity)
- [ ] 33-05-PLAN.md -- PlanTab restructure with 8 JPP sidebar items, shared layout components
- [ ] 33-06-PLAN.md -- Steps 1-3: Planning Initiation, Mission Analysis, COA Development
- [ ] 33-07-PLAN.md -- Steps 4-7: COA Analysis, Comparison, Approval, Plan/Order Development
- [ ] 33-08-PLAN.md -- E-W-M Overview: interactive tree + Sankey diagram + gap analysis
- [ ] 33-09-PLAN.md -- Entity resolution panel, final wiring, human verification
- [ ] 33-10-PLAN.md -- Document generation, export, versioning, and distribution for campaign plans

### Phase 34: Plan Tab Echelon Routing & MDMP Tactical Wiring

**Goal:** Plan tab reads `echelon` from ProblemSetContext and renders the appropriate planning workflow — operational (Phase 33 JPP), tactical (existing MDMP module wired into Plan tab), or strategic (placeholder). MDMP steps get same treatment as JPP: sidebar navigation, role-gated sections, governance gates, AI agent panels.
**Requirements**: TBD
**Depends on:** Phase 33, Phase 23 (echelon-aware problem sets)
**Plans:** 2/2 plans complete

Plans:
- [x] 34-01-PLAN.md — Echelon routing infrastructure (PlanEchelonRouter, EchelonBadge, TabLayout header slot, PlanEmptyState, strategic placeholder)
- [x] 34-02-PLAN.md — MDMP tactical plan view (MDMPStepConfig, MDMPPlanView, MDMPStepLayout, governance gates, AI panels)

### Phase 35: Mission Creation from OPORD & Problem Set Alignment

**Goal:** Extend Phase 33 Plan 10 document distribution to trigger tactical child problem set creation. "Create Mission" action in OPORD Step 7 Para 3 (Execution) per subordinate task assignment. Auto-populate child tactical PS with inherited context (mission statement, commander's intent 2 up, task org, ROE, CCIRs, AO). Initialize child MDMP at "Receipt of Mission". Merge existing `backend/src/mission/` module into problem set framework (missions become tactical problem sets with mission-specific metadata).
**Requirements**: [MC-01, MC-02, MC-03, MC-04, MC-05, MC-06, MC-07, MC-08, MC-09, MC-10, MC-11, MC-12, MC-13, MC-14, MC-15]
**Depends on:** Phase 34, Phase 33 (Plan 10 document distribution)
**Plans:** 6/6 plans complete

Plans:
- [ ] 35-01-PLAN.md — Foundation types, DB schema (mission_assignments, ccir_requests), data stores
- [ ] 35-02-PLAN.md — MissionCreationService orchestrator and REST API routes
- [ ] 35-03-PLAN.md — Frontend API client, MissionGroupEditor, MissionConfirmModal
- [ ] 35-04-PLAN.md — PlanOrderDevelopment restructure, MissionTracker, CCIR request UI
- [ ] 35-05-PLAN.md — Legacy mission module deletion and import cleanup
- [ ] 35-06-PLAN.md — Gap closure: fix CCIR URLs, classification casing, populate role assignment data

### Phase 36: Strategic Guidance Workflow

**Goal:** Build strategic level Plan tab workflow — lighter than JPP. Covers objective setting, force apportionment, constraint definition, and directive drafting. Strategic directive output becomes the initiating directive for child campaign JPP (Step 1). Connect to Phase 25.2 strategic document containers as input.
**Requirements**: [SG-01, SG-02, SG-03, SG-04, SG-05, SG-06, SG-07, SG-08, SG-09, SG-10, SG-11, SG-12]
**Depends on:** Phase 34, Phase 25.2 (strategic document containers)
**Plans:** 4/4 plans complete

Plans:
- [ ] 36-01-PLAN.md — Backend types, DB schema, store, service, and REST API routes
- [ ] 36-02-PLAN.md — Frontend step config, plan view, step layout, service layer, echelon router wiring
- [ ] 36-03-PLAN.md — Strategic Assessment and Operational Approach step content with force apportionment and constraint manager
- [ ] 36-04-PLAN.md — Commander's Directive step, directive versioning, child auto-populate, document export template

### Phase 37: Training Assessment Loop

**Goal:** AAR capture at tactical training events. METL proficiency tracking (T/P/U per task). Upward aggregation: training events → exercise trends → training strategy readiness updates. Training Strategy Assess tab shows METL dashboard. Exercise Assess tab shows event-level trends. Assessment flows UP through the hierarchy (distinct from operational Assess which measures campaign objective progress).
**Requirements:** [TAL-01, TAL-02, TAL-03, TAL-04, TAL-05, TAL-06, TAL-07, TAL-08, TAL-09, TAL-10, TAL-11, TAL-12, TAL-13, TAL-14, TAL-15]
**Depends on:** Phase 35, Phase 22 (training/operational mode)
**Plans:** 6/6 plans complete

Plans:
- [x] 37-01-PLAN.md — Assessment types, database stores (AAR, METL, MOE, MOP)
- [x] 37-02-PLAN.md — Aggregation/decay services and REST API routes
- [x] 37-03-PLAN.md — AssessEchelonRouter, operational MOE/MOP views, container wiring
- [x] 37-04-PLAN.md — Training tactical assess: AAR form and METL task assessment
- [x] 37-05-PLAN.md — Training strategic/exercise assess: METL dashboard and event timeline
- [x] 37-06-PLAN.md — AI observation/rating suggestions and reframing auto-trigger

### Phase 38: Inheritance Deepening

**Goal:** Full context propagation with change notification (not auto-overwrite). Override tracking: child overrides flagged for parent visibility. OPORD update propagation: parent OPORD changes → notification to child missions. Upward reporting: tactical COP/execution status → parent campaign COP and Assess tabs. Extends Phase 26 inheritance to full bidirectional flow.
**Requirements**: [INH-01, INH-02, INH-03, INH-04, INH-05, INH-06, INH-07, INH-08, INH-09, INH-10, INH-11, INH-12, INH-13, INH-14, INH-15, INH-16, INH-17]
**Depends on:** Phase 37, Phase 26 (strategic environment inheritance)
**Plans:** 6/6 plans complete

Plans:
- [x] 38-01-PLAN.md — Foundation types, DB schema, store extensions for all 4 capabilities
- [ ] 38-02-PLAN.md — Change notification service, read-only enforcement, interpretation ack, override tracking API
- [ ] 38-03-PLAN.md — FRAGO service: OPORD diff detection, AI drafting, commander review lifecycle
- [ ] 38-04-PLAN.md — WebSocket status channel, status aggregation service, DDIL fallback
- [ ] 38-05-PLAN.md — Frontend change notification banner, badges, override tracking, interpretation ack UI
- [ ] 38-06-PLAN.md — Frontend FRAGO review, mission status cards, COP/Assess tab integration

### Phase 39: Operational demonstration data package

**Goal:** Comprehensive, reusable demo data package that populates BASTION end-to-end with Pacific Strategy AY26 content — strategy through tactical missions, all doctrinal tabs, AI agent outputs, RAFT graph, OSINT events, DAO governance artifacts, and documents. Modular seed scripts with master orchestrator, idempotent upsert, demo-seed tagging for cleanup. Demonstrates full platform capability for military stakeholders and academic audiences.
**Requirements**: [DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07, DEMO-08, DEMO-09, DEMO-10]
**Depends on:** Phase 38
**Plans:** 7/7 plans complete

Plans:
- [ ] 39-01-PLAN.md — Foundation: problem set hierarchy, cleanup script, orchestrator skeleton, command units
- [ ] 39-02-PLAN.md — RAFT graph actors/relationships and OSINT events across 6 exercise phases
- [ ] 39-03-PLAN.md — Document uploads from scenario PDFs and operational design tab content
- [ ] 39-04-PLAN.md — JPP instance with step products and pre-seeded AI agent analysis outputs
- [ ] 39-05-PLAN.md — DAO governance decision gates and assessment (AARs, METL tracking)
- [ ] 39-06-PLAN.md — Inheritance artifacts (FRAGOs, status reports, overrides) and orchestrator finalization

### Phase 40: Autonomous Document Intelligence Team

**Goal:** Replace manual per-document extraction with an autonomous multi-agent team that adaptively processes documents based on type, relevance, and problem set context. Eliminate user involvement beyond supplying documents. Enable autonomous strategic environment research. Provide a scoping interview to capture problem set context boundaries that guide all subsequent agent behavior.

**Depends on:** Phase 25.3 (AI strategic context), Phase 4.2 (AI agent teams), Phase 25.2 (containers/categorization)

**Research:** Required — multi-agent orchestration patterns, NATO source reliability rating (A-F / 1-6), document triage heuristics, OSINT feed integration architecture, interview-to-schema conversion patterns

**Requirements**: [DOCTEAM-01 through DOCTEAM-12]

**Key Design Decisions:**
- Documents should NOT all receive identical treatment. A classified intelligence estimate, a policy white paper, and a news article require fundamentally different processing.
- The orchestrator triages each document and assembles a bespoke agent team from the specialist pool.
- The problem set scoping interview establishes boundaries (geographic, temporal, actor focus, classification ceiling, echelon) that constrain and guide all agent behavior.
- Autonomous research fills knowledge gaps proactively — research products re-enter the same pipeline as user-supplied documents.
- NATO-standard source reliability and information credibility ratings (A-F / 1-6) replace ad-hoc confidence scores.

**Specialist Agents:**
1. **Document Orchestrator** — Triages incoming documents, determines which specialists to invoke, manages workflow, assembles findings into unified report
2. **Format Converter** — OCR for scanned PDFs, translation for non-English, encoding normalization, table/chart extraction
3. **Document Classifier** — Type identification (intel estimate, CONOP, policy paper, news article, academic research, etc.), classification level, relevance scoring against problem set scope, suggested container placement
4. **Perspective Analysts** (instantiated per-perspective) — Analyze document from friendly/adversary/neutral/partner lenses; extract implications per perspective
5. **Fact Extractor** — Named entities, dates, quantities, geographic references, claims with source attribution; builds structured fact registry
6. **Objective Extractor** — Strategic objectives extraction (existing pipeline, invoked conditionally when document type warrants it)
7. **Cross-Document Linker** — Identifies references to other documents, corroboration/contradiction detection, temporal sequencing, builds inter-document edges in knowledge graph
8. **Bias Identifier** — Source bias analysis, framing detection, missing perspectives, propaganda indicators, information warfare markers
9. **Quality Assessor** — NATO source reliability (A-F) and information credibility (1-6) rating, recency assessment, internal consistency check, fact verification against known graph entities
10. **Problem Set Researcher** — Autonomous web search, OSINT monitoring, open-source intelligence gathering; triggered by knowledge gaps; produces research briefs that re-enter the pipeline

**Plans:** 12/12 plans complete

Plans:
- [ ] 40-01-PLAN.md — Foundation types, Zod schemas, DB migration, specialist base class, NATO rating definitions
- [ ] 40-02-PLAN.md — Scoping interview: LangGraph conversational service, interview store, chat UI with audio input
- [ ] 40-03-PLAN.md — Document Orchestrator StateGraph, team registration, Format Converter + Document Classifier
- [ ] 40-04-PLAN.md — Fact Extractor + Objective Extractor specialists with graph integration and provenance
- [ ] 40-05-PLAN.md — Perspective Analysts (per-container instantiation) + Bias Identifier specialist
- [ ] 40-06-PLAN.md — Cross-Document Linker, Quality Assessor, Trust Agent, and source registry store
- [ ] 40-07-PLAN.md — Provenance tracking, source revert service, and Autonomous Researcher with pg-boss scheduling
- [ ] 40-08-PLAN.md — Strategic environment briefing: narrative generation, change tracking, predictive analytics
- [ ] 40-09-PLAN.md — Orchestrator wiring: all specialist nodes connected, document upload API with SSE streaming
- [ ] 40-10-PLAN.md — Mission Control UI: processing dashboard, SSE feed, NATO rating panel, intelligence report
- [ ] 40-11-PLAN.md — Gap closure: team registration at startup + pluggable web search (Tavily)
- [ ] 40-12-PLAN.md — Gap closure: wire doc-intelligence components into Understand tab

### Phase 41: Redesign Understanding Tab - Adaptive Brain Visualization

**Goal:** Replace the Understanding tab's sidebar-driven view list with a neural network brain visualization centerpiece — a living, adaptive graph fed by a unified ingestion pipeline. The brain visualizes the strategic environment with shape-coded nodes (entities, objectives, documents, concepts), confidence-based glow, intelligence gap indicators, clustering modes (container/DIME/organic), temporal navigation, and proactive pattern detection. Three-column layout: ingestion sidebar (left), brain canvas (center), detail panel (right).

**Depends on:** Phase 40 (doc intelligence pipeline), Phase 25.3 (knowledge graph), Phase 25.2 (containers/categorization)

**Requirements:** [BRAIN-01 through BRAIN-30]
- BRAIN-01: Three-column layout (left ingestion sidebar, center brain, right detail panel) with dark COP-style background
- BRAIN-02: Right panel slides in on node click, slides out on close
- BRAIN-03: Brain annotations CRUD (flag, note, questionable) with user-scoped ownership and problem-set sharing
- BRAIN-04: AI context snapshots saved and retrievable per problem set
- BRAIN-05: Historical graph state queryable by timestamp
- BRAIN-06: Intelligence gap detection and pattern alert backend endpoints
- BRAIN-07: Shape-coded nodes: circles=entities, diamonds=objectives, squares=documents, hexagons=concepts
- BRAIN-08: Nodes colored by actor category: ally=blue, adversary=red, neutral=gray, partner=green
- BRAIN-09: Confidence-based glow (bright=high confidence, dim=low, none=gap)
- BRAIN-10: Weighted edges with pulse animation reflecting relationship strength
- BRAIN-11: Unified ingestion feed in left sidebar showing all data sources as one pipeline
- BRAIN-12: SSE-driven particle animation from sidebar into brain on real ingestion events
- BRAIN-13: Source type filter tags on ingestion feed
- BRAIN-14: Three clustering modes: container (default), DIME/MIDLIFE, organic force-directed
- BRAIN-15: Semantic zoom: clusters at low zoom, labels at medium, details at high
- BRAIN-16: Search bar with text and filter criteria (node type, actor category, DIME theme)
- BRAIN-17: Node click opens right panel with detail view (identity, confidence, connections, sources)
- BRAIN-18: Multi-select (shift-click) shows comparison view with shared connections and differences
- BRAIN-19: Annotation system with flag/note/questionable, share toggle, audit trail
- BRAIN-20: Timeline scrubber navigates historical brain state
- BRAIN-21: Recency-based visual cues (vibrant=recent, faded=stale)
- BRAIN-22: Future prediction zone with ghosted/translucent predicted nodes
- BRAIN-23: AI Context Preview as modal with save-as-snapshot
- BRAIN-24: Saved snapshots accessible to all BASTION AI agents
- BRAIN-25: Categorization agent assigns DIME/MIDLIFE themes to objectives
- BRAIN-26: Intelligence gap indicators (hollow/dashed nodes for missing connections)
- BRAIN-27: Gap summary report accessible from brain UI
- BRAIN-28: Proactive pattern alerts as notification badges with trend details
- BRAIN-29: Data Sharing/Subscriptions relocated OUT of Understanding tab
- BRAIN-30: Training packages fold into unified ingestion in training mode

**Plans:** 11/11 plans complete

Plans:
- [ ] 41-01-PLAN.md — Foundation: BrainNode types, BrainLayout three-column shell, CSS
- [ ] 41-02-PLAN.md — Backend brain API: annotations, snapshots, graph-snapshot, gaps, pattern-alerts
- [ ] 41-03-PLAN.md — BrainVisualization: Canvas 2D renderers (shape-coded nodes, glow, edges), useBrainData
- [ ] 41-04-PLAN.md — IngestionSidebar: unified feed, SSE particle events, particle renderer
- [x] 41-05-PLAN.md — Clustering modes (container/DIME/organic), search/filter, BrainToolbar
- [ ] 41-06-PLAN.md — BrainDetailPanel: right panel, node detail, multi-select comparison, annotations UI
- [x] 41-07-PLAN.md — BrainTimeline: scrubber, historical state, recency cues, future prediction zone
- [ ] 41-08-PLAN.md — AI Context Snapshot modal, useBrainSnapshots, categorization agent
- [ ] 41-09-PLAN.md — Gap detection UI, pattern alert badge/dropdown
- [ ] 41-10-PLAN.md — Integration: BrainController wiring, UnderstandTab rewrite
- [ ] 41-11-PLAN.md — Visual verification checkpoint

### Phase 42: Resources Tab — Inventory, Discovery & Onboarding

**Goal:** Add a dedicated "Resources" tab to the problem set tab bar that consolidates resource inventory management, network device discovery/onboarding, group management, and capability search into a single, reachable view. Most backend infrastructure exists from Phase 27 (Resource Registry) and Phase 32 (Discovery) — this phase is primarily frontend integration and layout.

**Depends on:** Phase 27 (Resource Registry & DID Plugin), Phase 24 (Tab Restructure)

**Research:** Not required — all backend services exist; this is a UI consolidation phase

**Requirements:** [RES-01 through RES-12]
- RES-01: New "Resources" tab added to ProblemSetTabContainer tab bar (7th tab)
- RES-02: ResourcesTab top-level component with sub-navigation (Inventory | Discovery | Network | Groups)
- RES-03: Inventory sub-view: resurface ResourceCatalog (equipment/personnel/consumables) scoped to problem set
- RES-04: Discovery sub-view: wire ClientDiscoveryPanel (BLE/Serial scanning) + device onboarding pipeline status
- RES-05: Discovery sub-view: show device state machine progression (discovered → fingerprinting → authenticating → gate_check → connected/rejected)
- RES-06: Network sub-view: wire NetworkTopologyView (force-directed graph of connected devices)
- RES-07: Network sub-view: wire EMSpectrumPanel for EM spectrum awareness
- RES-08: Groups sub-view: CRUD for resource groups (task_force/support/reserve/custom) using existing backend API
- RES-09: Groups sub-view: drag-and-drop or select-to-assign resources to groups
- RES-10: Registry search bar with capability, category, status, and geographic filters
- RES-11: Registry statistics dashboard (total resources, by category, by status, with DID, autonomous, group count)
- RES-12: Real-time updates via existing WebSocket streams (resource telemetry, discovery state changes)

**Plans:** 6/6 plans complete

Plans:
- [x] 42-01-PLAN.md — Tab registration: add Resources to ProblemSetTabContainer, ResourcesTab shell with sub-nav routing
- [x] 42-02-PLAN.md — Inventory sub-view: adapt ResourceCatalog to problem-set scope, wire resource-service
- [ ] 42-03-PLAN.md — Discovery sub-view: wire ClientDiscoveryPanel, DiscoveryLayer, device pipeline status UI
- [ ] 42-04-PLAN.md — Network sub-view: wire NetworkTopologyView and EMSpectrumPanel into sub-view
- [ ] 42-05-PLAN.md — Groups sub-view: group CRUD UI, member assignment, aggregate capabilities display
- [ ] 42-06-PLAN.md — Registry search + statistics dashboard, real-time WebSocket integration

### Phase 43: Robot Agent & Local Discovery Bridge

**Goal:** Enable autonomous robots and local network devices to connect to cloud-hosted Bastion through two complementary mechanisms: (1) a lightweight Python robot agent that self-registers with Bastion via outbound WebSocket for command/telemetry, and (2) a Docker-based local network bridge that runs mDNS/SSDP scanning on the user's WiFi and relays discovered devices to Bastion cloud. The bridge also acts as a command proxy and low-latency relay for local devices. Robots advertise via mDNS (`_bastion._tcp.local`) for bridge auto-discovery. Dual-path connectivity (direct outbound + bridge relay) provides resilience.

**Design note:** The preferred architecture would use a Raspberry Pi edge node as a dedicated hardware controller (always-on, low-power, full network access). This was deferred due to hardware procurement/policy constraints. The Docker bridge + robot agent approach achieves equivalent functionality using existing infrastructure. The Pi edge node remains the recommended production deployment for operational environments. (See whitepaper for full analysis.)

**Requirements:** [BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05, BRIDGE-06, BRIDGE-07]
**Depends on:** Phase 32, Phase 42
**Plans:** 6/6 plans complete

Plans:
- [x] 43-01-PLAN.md — Shared Python package (robot/common/) with models, ws_protocol, mDNS utilities
- [x] 43-02-PLAN.md — Backend bridge support: bridge-ws, token store, message dedup, bridge-router
- [x] 43-03-PLAN.md — Robot agent enhancement: mDNS discovery, DID auth, bridge fallback
- [ ] 43-04-PLAN.md — Bridge core: cloud uplink, LAN scanner, robot relay, command queue
- [ ] 43-05-PLAN.md — Bridge FastAPI web UI and Docker packaging
- [ ] 43-06-PLAN.md — Integration wiring and end-to-end verification

### Phase 44: Robot vision capabilities and mission intent translation

**Goal:** Add vision capabilities (CSI camera, detectNet, ORB feature matching) to the Sphero RVR+/Jetson Orin Nano robot, implement mission intent translation (LLM + template fallback), mission behavior profiles, pre-flight DID constraint validation, four new vision-enabled mission types (recon_area, visual_search, overwatch, resupply_route), and sweep path planning
**Requirements**: [VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, EXEC-01, EXEC-02, EXEC-03, SWEEP-01, SWEEP-02, INT-01, INT-02, PRE-01, PRE-02, MODEL-01, MODEL-02]
**Depends on:** Phase 43
**Plans:** 8/8 plans complete

Plans:
- [ ] 44-01-PLAN.md — Foundation models, config, and package structure
- [ ] 44-02-PLAN.md — Vision engine (camera, detectNet, simulate mode)
- [ ] 44-03-PLAN.md — Feature matcher and sweep path planner
- [ ] 44-04-PLAN.md — Intent translation (template fallback + cloud translator)
- [ ] 44-05-PLAN.md — Mission executor extension (4 new mission types)
- [x] 44-06-PLAN.md — Pre-flight validation and mission behavior profiles
- [ ] 44-07-PLAN.md — Backend TypeScript types, profile service, vision handling
- [ ] 44-08-PLAN.md — Integration wiring and end-to-end verification

### Phase 45: Knowledge Graph Subspaces — Container-scoped subgraphs, focus-and-expand pattern, hierarchical drill-down, and virtual lenses for managing growing knowledge graphs at scale

**Goal:** Manage growing knowledge graphs at scale through container-scoped subgraphs, focus-and-expand N-hop progressive loading, 4-level hierarchical drill-down with animated transitions, and a unified virtual lens system replacing the cluster mode toggle
**Requirements**: SUB-SCHEMA, LENS-SCHEMA, TYPES-FOUNDATION, SUB-CRUD, LENS-CRUD, NHOP-ENDPOINT, LENS-HOOK, LENS-UI, LENS-BUILTIN, SUB-CONTAINER-AUTO, SUB-CUSTOM-MANUAL, SUB-CUSTOM-SMART, SUB-SIDEBAR-TREE, SUB-GHOST-LINKS, DRILL-4LEVEL, DRILL-BREADCRUMB, DRILL-ANIMATION, NHOP-HOOK, NHOP-EXPAND, NHOP-WARNING, WIRE-CONTROLLER, WIRE-TOOLBAR, WIRE-VISUALIZATION, WIRE-GHOST-RENDER
**Depends on:** Phase 44
**Plans:** 7/7 plans complete

Plans:
- [ ] 45-01-PLAN.md — Foundation: DB migration (subspaces + lenses tables) and TypeScript types
- [ ] 45-02-PLAN.md — Backend stores, REST API endpoints, and N-hop Neo4j query
- [ ] 45-03-PLAN.md — Lens hook and LensSelector UI component
- [ ] 45-04-PLAN.md — Subspace hook (container-auto + custom) and SubspaceSidebar tree
- [ ] 45-05-PLAN.md — Drill-down hook (4-level stack) and BrainBreadcrumb component
- [ ] 45-06-PLAN.md — N-hop progressive neighbor loading hook
- [ ] 45-07-PLAN.md — Integration wiring: BrainController, Toolbar, Visualization, Layout

### Phase 46: Sphero RVR+ Swarm Leader & Doctrinal Movement Control

**Goal:** Enable the vision-equipped Sphero RVR+/Jetson Orin Nano to act as a swarm leader coordinating additional RVR+ units and heterogeneous resources (drones, UGVs, sensors) in doctrinal formations and tactical movement techniques; peer-to-peer swarm mesh via UDP broadcast; 6 formation types (line, wedge, column, echelon-left/right, vee); 4 doctrinal movement techniques (traveling, traveling overwatch, bounding overwatch, successive bounds); DAO-driven dynamic membership; leader vision sharing; swarm telemetry aggregated to Bastion COP with all member positions visible
**Requirements**: [SWARM-01: Peer discovery via mDNS mesh, SWARM-02: Leader election and role assignment, SWARM-03: Formation geometry engine with 6 formation types, SWARM-04: Doctrinal movement techniques (bounding/traveling overwatch, successive bounds), SWARM-05: Leader vision sharing to followers, SWARM-06: Swarm telemetry aggregation to Bastion, SWARM-07: Mission profile integration for swarm commands, MOVE-01: Profile-driven movement from mission assignment, MOVE-02: Coordinated waypoint navigation, MOVE-03: Formation-relative positioning]
**Depends on:** Phase 44
**Plans:** 5/5 plans complete

Plans:
- [x] 46-01-PLAN.md — Swarm protocol models and formation geometry engine
- [x] 46-02-PLAN.md — Swarm coordinator (leader election, peer mesh, movement techniques)
- [x] 46-03-PLAN.md — Mission executor swarm extension and mission client wiring
- [x] 46-04-PLAN.md — Backend swarm types, coordination service, REST API, COP integration
- [x] 46-05-PLAN.md — Intent translation, test fixes, integration verification

### Phase 47: JSON-LD Semantic Brain + COP Fix

**Goal:** Refactor the knowledge graph to use JSON-LD with formal ontology alignment (BFO, CCO, DODAF/DNDAF), provenance tracking, temporal reasoning, entity resolution, and confidence scoring. Wire the upgraded graph into all downstream consumers and fix COP layer generation end-to-end.
**Requirements**:
- JSON-LD representation for all brain graph entities, relationships, and events
- Basic Formal Ontology (BFO) as upper ontology foundation
- Common Core Ontologies (CCO) alignment for DoD/DND interoperability
- DODAF/DNDAF architectural framework data model compliance
- Military ontology alignment (APP-6, JC3IEDM) for NATO symbology and entity typing
- Provenance chain on every node/edge (source, confidence, assertion method, asserter)
- Temporal reasoning (validFrom/validTo on facts, point-in-time graph queries, staleness decay)
- Entity resolution / fusion across ingestion paths (OSINT, documents, vision, manual)
- Confidence scoring with multi-source corroboration
- Contradiction detection when new data conflicts with existing graph facts
- Fix COP layer generation pipeline end-to-end (currently broken)
- Wire upgraded graph into: COP sub-agents, design tab, plan tab, assess tab, doc-intelligence, OSINT pipeline, vision detection pipeline
**Depends on:** Phase 45
**Plans:** 11/11 plans complete

Plans:
- [ ] 47-01-PLAN.md — JSON-LD context file + shared types + confidence utilities
- [ ] 47-02-PLAN.md — Test scaffolds for core behaviors (confidence, contradiction, resolution)
- [ ] 47-03-PLAN.md — RAFT store rewrites (actor, relationship, tension, decision) + schema indexes
- [ ] 47-04-PLAN.md — Big-bang migration script for existing Neo4j data
- [ ] 47-05-PLAN.md — Contradiction detection + hybrid entity resolution upgrade
- [ ] 47-06-PLAN.md — Semantic entity query module + COP coordinator fix
- [ ] 47-07-PLAN.md — Sub-agent semantic upgrades + COP confidence visual encoding
- [ ] 47-08-PLAN.md — Brain visualization timeline slider + temporal playback
- [ ] 47-09-PLAN.md — Ingestion pipeline wiring (graph-builder, doc-intel, OSINT, vision)
- [ ] 47-10-PLAN.md — Read consumer wiring (graph API, RAFT tools, COP confidence rendering)
- [ ] 47-11-PLAN.md — Design, plan, assess tab JSON-LD consumer wiring

### Phase 48: Robot swarm behaviour end-to-end demo

**Goal:** Demonstrate the complete BASTION strategy-to-autonomous-execution pipeline using a Taiwan defense scenario with 3-robot coalition swarm — strategic directive ingestion through AI objective extraction, DAO-authorized missions, swarm recon in formation, detections on COP, lethal escalation gates, and brain graph timeline playback
**Requirements:** [DEMO-SEED, TAIPEI-COORDS, WAVE0-TESTS, COP-SWARM-LAYER, SWARM-COP-BRIDGE, COALITION-CAVEATS, CAVEAT-ENFORCEMENT, BRAIN-GRAPH-EVENTS, NATIONAL-PROVENANCE, MULTI-ROBOT-CORROBORATION, DETECTION-CONFIDENCE-FUSION, FORMATION-POLYGON, STATE-COLORS, SMOOTH-INTERPOLATION, SWARM-TELEMETRY-PANEL, LEADER-ICON, CAVEAT-DASHBOARD, DETECTION-ATTRIBUTION, BOUNDING-ANIMATION, CAVEAT-BLOCK-UI, DAO-EXPEDITED-AUTH, LETHAL-ESCALATION-GATE, LETHAL-DENY-PATH, LETHAL-APPROVE-PATH, BLOCKCHAIN-AUDIT, END-TO-END-WIRING, GHOSTED-TO-SOLID, CORROBORATION-COP, TIMELINE-PLAYBACK]
**Depends on:** Phase 47
**Plans:** 8/8 plans complete

Plans:
- [ ] 48-01-PLAN.md — Wave 0 test scaffolds, Taiwan demo seed data, Taipei calibration
- [ ] 48-02-PLAN.md — Swarm COP layer types and swarm-cop-bridge service
- [ ] 48-03-PLAN.md — Coalition caveat profiles and enforcement service
- [ ] 48-04-PLAN.md — Brain graph swarm event writer and multi-robot corroboration
- [ ] 48-05-PLAN.md — Frontend SwarmCOPLayer with formation polygons and telemetry panel
- [ ] 48-06-PLAN.md — Coalition caveat dashboard, detection attribution, bounding animation
- [ ] 48-07-PLAN.md — DAO expedited authorization and lethal escalation gates
- [ ] 48-08-PLAN.md — End-to-end wiring, corroboration visual encoding, human checkpoint

### Phase 49: Align Design Tab with Plan Tab
**Goal:** Remove duplicate operational design from Plan tab, establish Design tab as single source of truth for operational design artifacts (CoG, LOEs, problem framing, operational approach), wire Design outputs as automatic starting point for campaign planning in Plan tab, restructure Strategic Guidance to remove Operational Approach step and add Alignment step, build generic fork-and-merge revision system for Plan-to-Design change proposals through DAO governance
**Depends on:** Phase 25, Phase 28, Phase 36
**Plans:** 5/5 plans complete

Plans:
- [ ] 49-01-PLAN.md — Restructure Strategic Guidance (Assessment/Alignment/Directive), delete OperationalApproach, remove CoG from StrategicAssessment
- [ ] 49-02-PLAN.md — DesignContextPanel auto-sync into JPP Steps 2, 3, 7 + DesignSyncIndicator
- [ ] 49-03-PLAN.md — Backend revision system (migration, revision-store, API endpoints)
- [ ] 49-04-PLAN.md — Frontend revision proposal (service, modal, diff view, DAO gate integration)
- [ ] 49-05-PLAN.md — Governance wiring, push-handoff deprecation, human verification checkpoint

### Phase 51: Unified Agent Architecture

**Goal:** Rearchitect the fragmented agent system into a coherent ecosystem: standardized agent template with persistent memory/skills/tools, admin dashboard for agent lifecycle management, team designer for composing agent teams, and Ironclaw as the sole AI interface replacing all scattered AI panels.
**Requirements**: Standardized agent base class, persistent agent memory, agent admin dashboard (CRUD, health, validation), team designer UI, Ironclaw consolidation as single AI entry point, removal of AIStaffContext and per-tab AI panels
**Depends on:** Phase 50
**Plans:** 8/8 plans complete

Plans:
- [x] 51-01-PLAN.md — StandardAgent types, DB migrations, AgentStore/TeamStore/MemoryStore
- [x] 51-02-PLAN.md — Dead code removal (17 backend + 6 frontend files)
- [x] 51-03-PLAN.md — Registry/executor rewrite to use DB stores, agent seeder migration
- [x] 51-04-PLAN.md — Agent admin dashboard (CRUD, health, memory, test harness)
- [x] 51-05-PLAN.md — Team designer UI (DnD, workflow, testing)
- [ ] 51-06-PLAN.md — Ironclaw upgrade, context-awareness, delegation commands
- [ ] 51-07-PLAN.md — AIStaffContext removal, Ironclaw sole interface, verification

### Phase 52: Agent Skills & MCP

**Goal:** Standalone MCP server for agent tool execution, reusable skills registry with DB storage and admin UI, Ironclaw skill/tool/team builder via action cards, and field write-back handler for applying AI suggestions to problem set fields
**Requirements**: REQ-52-01 through REQ-52-05
**Depends on:** Phase 51
**Plans:** 6/6 plans complete

Plans:
- [x] 52-01: MCP server Docker container with tool serving (Wave 1)
- [ ] 52-02: Skills registry — DB, store, admin UI panel (Wave 1)
- [ ] 52-03: Ironclaw builder handlers for action card execution (Wave 1)
- [ ] 52-04: Field write-back pipeline — suggestion parsing, accept API (Wave 1)
- [ ] 52-05: Orchestration loop backend — task types, store, orchestrator (Wave 2)
- [ ] 52-06: Orchestration loop frontend — task panel, drawer, system prompt (Wave 3)

### Phase 53: DID Governance Architecture & Bug Fixes

**Goal:** Extend DID documents with governance policy, build RACI-aware decision pipeline with on-chain recording, rename Direct tab to Decide with proactive decision surfacing, fix bugs and wire MCP tools
**Requirements**: REQ-53-01 through REQ-53-08
**Depends on:** Phase 52
**Plans:** 6/6 plans complete

Plans:
- [ ] 53-01: Bug fixes, UX improvements, MCP wiring (Wave 1)
- [ ] 53-02: RACI matrix schema + decision types + stores (Wave 2)
- [ ] 53-03: DID governance schema extension + ActionPipeline refactor (Wave 2)
- [ ] 53-04: Decision service + REST API + RACI delegation endpoints (Wave 3)
- [ ] 53-05: Decide tab UI + Ironclaw proactive decision surfacing (Wave 4)
- [ ] 53-06: DAO proposal integration + on-chain encrypted decisions (Wave 5)

### Phase 54: Update research whitepaper and docs for demo briefing

**Goal:** Update v0.1 research whitepaper to v0.2 reflecting all capabilities through Phase 53, create demo briefing materials (slide deck, 30-min demo script, briefing document), refresh docs site to current state, and produce editable DOCX output
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07
**Depends on:** Phase 53
**Plans:** 8/8 plans complete

Plans:
- [x] 54-01-PLAN.md — Whitepaper front matter + new background sections (Wave 1)
- [x] 54-02-PLAN.md — Methodology section expansion with 12 new subsections (Wave 1)
- [x] 54-03-PLAN.md — Results, discussion, and conclusion updates (Wave 1)
- [x] 54-04-PLAN.md — SITREP full update + figure specs (Wave 1)
- [x] 54-05-PLAN.md — Demo briefing deliverables (slide deck, script, briefing doc) (Wave 1)
- [x] 54-06-PLAN.md — Docs site full refresh + 5 new capability pages (Wave 1)
- [x] 54-07-PLAN.md — DOCX export + API reference + stale reference sweep (Wave 2)
### Phase 55: Ironclaw guided design interview for operational approach development

**Goal:** Build a LangGraph-powered guided interview system where Ironclaw walks users through developing an operational approach in the Design tab, covering Problem Framing, CoG Analysis, LOEs, and Operational Approach with challenge-first questioning, red-team probing, knowledge graph references, and 4 new visualization/analysis skills
**Requirements**: TBD
**Depends on:** Phase 54
**Plans:** 6/6 plans complete

Plans:
- [x] 55-01-PLAN.md — Backend design interview types, prompts, store, and LangGraph StateGraph service (Wave 1)
- [ ] 55-02-PLAN.md — 4 Ironclaw design skills (overlay-producer, resource-allocator, campaign-visualizer, risk-visualizer) and handler registration (Wave 1)
- [ ] 55-03-PLAN.md — REST API routes, MCP tool registration, action handler, Express mount (Wave 2)
- [ ] 55-04-PLAN.md — Frontend useDesignInterview hook, progress bar, and review gate components (Wave 2)
- [ ] 55-05-PLAN.md — Guide Me buttons in Design sections, proactive suggestion trigger (Wave 3)
- [ ] 55-06-PLAN.md — Multi-user collaborative interview via Yjs with role-directed questioning (Wave 3)

### Phase 56: Visual Operational Approach Editor — Map-Based Military Symbology

**Goal:** Build an interactive map-based operational approach editor in the Design tab where commanders can visually compose their operational approach using MIL-STD-2525D military symbology. Supports dual editing: Ironclaw chat-driven (natural language commands → tool calls → real-time map updates) and direct manipulation (drag-and-drop symbols, draw control measures, click-to-edit properties). Overlay state persists as part of the OperationalDesign data model and syncs collaboratively via Yjs.
**Requirements**: [MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, MAP-07]
**Depends on:** Phase 55
**Plans:** 5/5 plans complete

Plans:
- [ ] 56-01-PLAN.md — MapOverlay types, DB migration, store methods, API endpoint, frontend service (Wave 1)
- [ ] 56-02-PLAN.md — OperationalApproachMapEditor component with symbol display and direct manipulation (Wave 2)
- [ ] 56-03-PLAN.md — Ironclaw map tools registration and handler implementation (Wave 2)
- [ ] 56-04-PLAN.md — Yjs collaborative sync for real-time map overlay editing (Wave 3)
- [ ] 56-05-PLAN.md — MapSymbolPicker panel with click-to-place flow (Wave 3)

Key capabilities:
- Leaflet map centered on problem set AO with editable SVG overlay layer
- milsymbol.js (MIL-STD-2525D/APP-6D) rendering of unit symbols from SIDC codes
- MGRS coordinate support (mgrs npm package) for placement and display
- Ironclaw registered tools: add_symbol, move_symbol, remove_symbol, update_symbol, add_control_measure, add_overlay_graphic
- Direct manipulation: drag-and-drop symbol repositioning, click-to-edit properties (unit type, echelon, label), mouse/touch drawing of control measures (phase lines, boundaries, axes of advance, objectives)
- Control measures: engagement areas, named areas of interest, fire support coordination measures, forward line of troops
- Both editing modes feed same overlay state — Ironclaw stays aware of manual edits, manual users see Ironclaw edits in real-time
- Yjs collaborative sync for multi-user editing
- Overlay stored as structured JSON in OperationalDesign.operationalApproach.mapOverlay

### Phase 57: Ironclaw Persistent Memory & Adaptive Relationship

**Goal:** Build a long-term memory and adaptive behavior system that transforms Ironclaw from a stateless AI assistant into a true AI staff officer that learns, remembers, and evolves its relationship with each user across sessions. Memory is stored in ironclaw-postgres and retrieved contextually for every interaction.
**Requirements**: [MEM-01, MEM-02, MEM-03, MEM-04, MEM-05, MEM-06, MEM-07, MEM-08, MEM-09, MEM-10, MEM-11]
**Depends on:** Phase 55
**Plans:** 4/4 plans complete

Plans:
- [ ] 57-01-PLAN.md — Types, migrations, and memory stores (TDD)
- [ ] 57-02-PLAN.md — Memory retrieval service, adaptive engine, and IronclawService wiring (TDD)
- [ ] 57-03-PLAN.md — REST API endpoints and frontend Memory Panel
- [ ] 57-04-PLAN.md — Cleanup job, startup init, and outcome recording hooks

Key capabilities:

**Per-User Preference Memory (user_did scoped):**
- Working style: draft-first vs blank-page, level of detail preferred, pace
- Critique tolerance: how much red-teaming they respond well to
- Domain strengths/weaknesses: where they need more support vs where they're expert
- Communication style: formal vs informal, verbose vs terse, how they prefer recommendations framed

**Interaction Outcome Tracking:**
- Suggestions accepted vs rejected (with context)
- Edit patterns post-critique: did the user incorporate the feedback?
- Questions asked: what topics does the user seek help with most?
- Repeated corrections: what does the user consistently override?

**Problem Set Context Memory (problem_set_id scoped):**
- Decisions made and rationale provided
- Assumptions validated or invalidated across sessions
- Key discussion threads and their conclusions
- Cross-session continuity: "Last session we identified X, picking up from there..."

**Adaptive Behavior Engine:**
- Adjusts proactivity level based on user response patterns
- Modulates critique frequency: reduce if consistently ignored, increase if valued
- Offers drafts proactively for users who prefer draft-first workflows
- Personalizes communication style per user
- Learns which types of observations the user finds most valuable
- Memory retrieval integrated into all Ironclaw system prompts

**Memory Lifecycle:**
- Memories decay/age with configurable TTL
- User can review/edit/delete Ironclaw's memories about them
- Memories are scoped: user-level (portable) vs problem-set-level (contextual)
- Privacy-aware: no cross-user memory leakage

### Phase 58: On-Chain Resource DID Caveats with Contract Enforcement

**Goal:** Extend the DID registry smart contract with structured caveat fields (classification, releasability, geographic bounds, ROE tier, time windows, employment constraints) and contract-level enforcement via `check_employment_authorized()` view method. Add role-based permissions so resource owners and problem set admins can update caveats. Backend: extend Resource types, wire registration to store DIDs on-chain with caveats, add `updateResourceCaveats` and `checkEmploymentAuth` endpoints, migrate existing resources on-chain. Frontend: add Security & Caveats editor to ResourceDetailPanel — permission-gated to owner/admin. Deploy updated contract to testnet. Demo story: blockchain is the single source of truth for how resources can be employed.
**Requirements**: Smart contract caveat enforcement, role-based caveat management, on-chain resource DID registration, frontend caveat editor, testnet deployment
**Depends on:** Phase 27 (Resource Registry)
**Plans:** 3/3 plans complete

Plans:
- [ ] 58-01-PLAN.md -- Smart contract caveat extension (TDD: ResourceCaveats struct, update/check/get methods, unit tests)
- [ ] 58-02-PLAN.md -- Backend infrastructure (DB migration, types, caveat service, tx-signer helpers, API endpoints)
- [ ] 58-03-PLAN.md -- Frontend caveat editor + testnet deployment + end-to-end verification

### Phase 59: Briefing deck slide and image specs

**Goal:** Produce comprehensive slide-by-slide specifications with image generation prompts, full scripted narratives, and demo cue points for a BASTION briefing deck (25 core + 17 annex slides), plus update the companion whitepaper v0.3 with Phase 55-58 content and Chicago 18th edition footnotes, compiled to docx and pdf.
**Requirements:** [DECK-01: Opening/problem/architecture slides, DECK-02: Understanding/planning capability slides, DECK-03: Governing decisions slides, DECK-04: Execution/trust/architecture synthesis slides, DECK-05: Closing reflection slides (tradeoffs/limitations/doctrinal impact), DECK-06: Final slides (contributions/answer/Q&A), DECK-07: Annex deep-dive slides, DECK-08: Annex demo/overview slides, WP-01: Whitepaper Phase 55-58 methodology content, WP-02: Whitepaper discussion/limitations update, WP-03: SITREP/references/assembly update, WP-04: Whitepaper docx/pdf compilation]
**Depends on:** Phase 58
**Plans:** 5/5 plans complete

Plans:
- [ ] 59-01-PLAN.md -- Core slides 1-13: opening, problem, architecture, understanding/planning/governing capabilities
- [ ] 59-02-PLAN.md -- Core slides 14-25: execution, trust, architecture synthesis, closing reflection, final slides
- [ ] 59-03-PLAN.md -- Annex slides A1-A17: deep-dives, visual glossary, demo walkthroughs
- [ ] 59-04-PLAN.md -- Whitepaper update: Phase 55-58 content, Chicago footnotes, SITREP, references
- [ ] 59-05-PLAN.md -- Whitepaper compilation to docx/pdf + human review checkpoint

### Phase 60: Rearchitect Ironclaw integration - use ironclaw_bastion_blueprint_v1.3.pdf to rearchitect how Ironclaw and Bastion integrate and work together

**Goal:** Transform Ironclaw from shared-thread chatbot to per-user Chief-of-Staff agent with identity-file injection, AgentConfig data model, expanded MCP tool catalog, PostgreSQL RLS workspace isolation, Telegram channel pairing, routine scheduling, and admin-controlled self-update — following ironclaw_bastion_blueprint_v1.3.pdf phases 0-6
**Requirements:** IC-00-RLS, IC-00-DOCKER, IC-00-MCP-REG, IC-01-MCP-TOOLS, IC-01-DID-AUTH, IC-02-IDENTITY, IC-02-AGENTCONFIG-MODEL, IC-02-AGENTCONFIG-API, IC-02-SYNC, IC-03-UI-PANEL, IC-03-IDENTITY-TAB, IC-03-PERSONALITY-TAB, IC-03-PREVIEW, IC-04-SKILLS, IC-04-SKILLPACKS, IC-04-TELEGRAM, IC-04-CHANNELS, IC-05-ROUTINES, IC-05-HEARTBEAT, IC-05-KNOWLEDGE-SYNC, IC-06-ADVANCED-TAB, IC-06-WEBHOOK-UPDATE, IC-06-WASM-TOOLS
**Depends on:** Phase 59
**Plans:** 7/7 plans complete

Plans:
- [ ] 60-01-PLAN.md -- Infrastructure: RLS migration, docker-compose MCP port reconciliation, IronclawClient SET LOCAL
- [ ] 60-02-PLAN.md -- MCP server expansion: 5 tool groups (knowledge, operations, calendar, resources, personnel) + DID auth middleware
- [ ] 60-03-PLAN.md -- Identity system: AgentConfig model, identity-renderer.ts, syncUserIdentity, REST API
- [ ] 60-04-PLAN.md -- Agent Config UI: AgentConfigPanel, IdentityTab, PersonalityTab, AgentPreviewChat
- [ ] 60-05-PLAN.md -- Skills + Telegram: SkillsTab with 7 role skill packs, ChannelsTab, TelegramPairWizard
- [ ] 60-06-PLAN.md -- Routines + Heartbeat: RoutinesTab, RoutineEditor, knowledge sync, heartbeat directives
- [ ] 60-07-PLAN.md -- Self-expansion + admin: AdvancedTab, WASM tools, GitHub release webhook, human verification

### Phase 61: Responsive UI & Mobile Optimization

**Goal:** Fix all 6 layout shell components (header, tab bar, IronclawDrawer, OrgTreeSidebar, TabLayout sidebar) for responsive behavior at 375px/768px/1024px/1280px breakpoints, then apply fluid patterns to content areas and modals.
**Requirements**: RESP-01, RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, RESP-07
**Depends on:** Phase 60
**Plans:** 2 plans

Plans:
- [ ] 61-01-PLAN.md -- Layout shells: App header flex, IronclawDrawer responsive CSS, tab bar scroll, OrgTreeSidebar max-w, TabLayout off-canvas
- [ ] 61-02-PLAN.md -- Modal fluid widths, tab content clamp padding, visual verification checkpoint

### Phase 62: Knowledge Graph Entity Deduplication & Auto-Resolution (INSERTED)

**Goal:** Eliminate duplicate nodes from the knowledge graph by integrating entity resolution into the ingestion pipeline; add name canonicalization before node creation; auto-run resolution after buildFromDocument() and OSINT sync; batch-merge existing duplicates via resolution API; add canonical alias registry for common name variants (US/USA/United States, PRC/China, etc.); wire resolution into the autonomous document intelligence team (Phase 40) extraction flow; add dedup metrics to graph stats endpoint
**Requirements**: TBD
**Depends on:** Phase 40, Phase 47 (leverages existing resolution-service.ts infrastructure)
**Plans:** 0 plans

**Context:**
Investigation revealed 28,800+ nodes in the knowledge graph with significant duplication caused by:
1. OSINT sync uses exact name match only (`MERGE (a:Actor {name: $name})`) — no normalization
2. Graph builder's `findActorsByName()` uses substring matching but not fuzzy/embedding — "PRC" ≠ "China"
3. Entity resolution service exists (hybrid 3-signal scoring) but is NEVER called automatically
4. No canonical alias registry for common name variants
5. OSINT event clustering hides duplicates visually but underlying nodes persist in Neo4j

**Key files:**
- `backend/src/graph/resolution/resolution-service.ts` — existing hybrid resolution (string + embedding + type)
- `backend/src/graph/construction/graph-builder.ts:268-352` — actor creation without auto-resolution
- `backend/src/osint/osint-graph-sync.ts:334` — OSINT sync with exact-name-only MERGE
- `backend/src/graph/raft/actor-store.ts:190` — findActorsByName (substring, not fuzzy by default)
- `backend/src/api/graph.ts:421` — existing resolution/duplicates endpoint

Plans:
- [ ] TBD (run /gsd:plan-phase 62 to break down)

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
**Plans:** 9/10 plans executed

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
- [x] 23-08-PLAN.md — Frontend routing, cross-cutting imports, and cleanup (Wave 4)
- [ ] 23-09-PLAN.md — Echelon UI: OrgTree symbols, detail card, create wizard (Wave 5)
- [ ] 23-10-PLAN.md — Build verification and human-verify checkpoint (Wave 5)

### Phase 24: Doctrinal Tab Restructure (INSERTED)
**Goal:** Replace the current tab structure (COP/Decide/Design/Campaign/Train/Overview) with a doctrinal lifecycle flow (Understand/Design/Plan/Direct/COP/Assess) that guides users through the military planning process
**Depends on:** Phase 23
**Research:** Unlikely
**Plans:** 3/3 plans complete

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
- [x] 24-01-PLAN.md — Create doctrinal tab components (UnderstandTab, PlanTab, DirectTab, AssessTab, DoctrinalPlaceholder) (Wave 1) (completed 2026-03-06)
- [x] 24-02-PLAN.md — Rewire ProblemSetTabContainer, update notifications, delete old tabs (Wave 2) (completed 2026-03-06)
- [x] 24-03-PLAN.md — Backend panel config store and DB migration (Wave 1) (completed 2026-03-06)

### Phase 25: Operational Design Workspace (INSERTED)
**Goal:** Build the Design tab as a full operational design workspace with problem framing, center of gravity analysis, lines of effort/operation definition, operational approach development, and AI-assisted design recommendations
**Depends on:** Phase 24
**Research:** Required
**Research topics:** JP 5-0 Chapter III operational design methodology, center of gravity analysis frameworks (Strange's model, CG-CC-CR-CV), lines of effort vs lines of operation, operational approach visualization, decisive points, operational reach, culmination, AI-assisted problem framing patterns
**Plans:** 6/6 plans complete

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
- [x] 25-01-PLAN.md — Backend foundation, types, DesignTab shell with TabLayout sidebar and Overview dashboard
- [x] 25-02-PLAN.md — Problem Framing section with JP 5-0 fields and AI panel integration
- [x] 25-03-PLAN.md — CoG Analysis with interactive SVG tree diagrams (friendly + adversary)
- [x] 25-04-PLAN.md — Lines of Effort timeline with lanes, decisive points, and CoG linkages
- [x] 25-05-PLAN.md — Operational Approach synthesis, Design-to-Plan handoff, and end-to-end verification
- [ ] 25-06-PLAN.md — Gap closure: AI analysis agents for CoG and LOE sections

### Phase 25.1: Training Package Upload & From-Scenario Integration (INSERTED)

**Goal:** Wire existing training package upload infrastructure into the new tab structure and problem set creation flow, so users can create problem sets from scenarios and upload document packages directly from the Understand tab.
**Depends on:** Phase 24 (tab structure), Phase 23 (problem set model)
**Research:** Unlikely (components exist, this is integration work)
**Plans:** 2/2 plans complete

**Scope:**
1. Add "Create from Scenario" option to CreateProblemSetWizard — list available scenarios, call `/api/problem-sets/from-scenario`, navigate to new problem set
2. Wire ScenarioPackageUpload component into the Understand tab — multi-file drag-drop with folder upload, client-side tag inference (team/phase/document type), manual override, async LLM extraction with polling
3. Surface uploaded documents and extraction status in Understand tab document list
4. Ensure upload pipeline respects problem set mode (training vs operational) and classification

**Existing Infrastructure:**
- Frontend: `ScenarioPackageUpload.tsx`, `exercise-service.ts` (uploadPackage, getDocuments)
- Backend: `package-parser.ts` (tag inference), `document-parser.ts` (PDF/DOCX/PPTX/XLSX), `extraction-service.ts` (LLM extraction with vision fallback), `document-store.ts` (scenario_documents table)
- API: `POST /api/exercise/scenarios/:id/upload`, `POST /api/problem-sets/from-scenario`

Plans:
- [x] 25.1-01-PLAN.md -- Backend fixes + Wizard Step 0 (from-scenario endpoint, scenario picker, pre-fill)
- [x] 25.1-02-PLAN.md -- Training Packages sidebar in UnderstandTab (mode-gated, doc preview)

### Phase 25.2: Strategic Document Containers & Actor Categorization (INSERTED)

**Goal:** Organize strategic documents into persistent nation/group containers with actor categorization, enabling incremental construction of strategic environments that feed into Phase 26 inheritance.
**Depends on:** Phase 25.1 (upload pipeline), Phase 24 (Understand tab)
**Research:** Complete (25.2-RESEARCH.md)
**Plans:** 3/4 plans executed

**Scope:**
1. New data model: `strategic_containers` table — name (e.g., "United States", "China", "NATO"), actor_category (ally, adversary, neutral, partner), problem_set_id, parent_container_id (for hierarchy)
2. Assign strategic documents to containers during upload — add container_id + actor_category to upload form and document metadata
3. Container management UI in Understand tab — create/rename/delete containers, drag documents between containers, filter by actor category
4. Container-scoped document views — browse documents by nation/group, see all docs for a given actor
5. Feeds into Phase 26: strategic environment = collection of containers with their documents, inheritable by child problem sets

**Example Container Structure:**
```
Friendly
├── United States (NSS, NDS, NMS, GEF, JSCP, policy docs)
├── Japan (NSS, defense guidelines, bilateral agreements)
└── Australia (defense white paper, AUKUS docs)
Adversary
├── China (NSS, military strategy, PLA doctrine)
└── Russia (national security concept, military doctrine)
Neutral / Partner
├── NATO (strategic concept, allied doctrine)
└── ASEAN (charter, regional security docs)
```

Plans:
- [x] 25.2-01-PLAN.md -- Data model, ContainerStore, API routes, frontend types & service
- [x] 25.2-02-PLAN.md -- Container browser UI (category filter, container cards, breadcrumb nav, inline CRUD)
- [ ] 25.2-03-PLAN.md -- Upload integration with container selector & AI recommendations
- [ ] 25.2-04-PLAN.md -- Drag-and-drop assignment & container-level agent standing orders

### Phase 25.3: AI Strategic Context & Knowledge Graph Integration (INSERTED)
**Goal:** Wire subscribed strategic environment data and container-scoped knowledge graphs into AI agent context so agents have access to strategic documents and graph-derived knowledge during exercises
**Depends on:** Phase 25.2 (containers provide organizational structure for documents and graph scoping)
**Research:** Complete (25.3-RESEARCH.md)
**Plans:** 5 plans

**Scope:**
1. Subscription cache materializer — `materializeCache()` on `ProblemSetSubscriptionStore` to populate `problem_set_data_cache` from approved subscriptions
2. Container-scoped RAFT graph construction — auto-trigger extraction when documents added/updated in containers, tag graph entities with `containerId`
3. Graph summary generation — centrality analysis + key actor profiles per container sub-graph with temporal relevance boosting
4. AI context assembly integration — `StrategicContextService` injected into `assembleContextNode()` via `StoreContext`, strategic docs + graph summaries bundled into `sharedContext`
5. Strategic context preview — API endpoint + UI panel for users to inspect what AI agents know
6. Context size management — ~8000 token cap with prioritization (graph summary > extracted_data > text_content)

- [x] 25.3-01-PLAN.md -- Subscription cache materializer (materializeCache + pg-boss + API)
- [x] 25.3-02-PLAN.md -- Container-scoped graph entity tagging and queries
Plans:
- [x] 25.3-03-PLAN.md -- Graph summary service with centrality analysis and temporal boosting
- [x] 25.3-04-PLAN.md -- StrategicContextService and AI pipeline integration
- [ ] 25.3-05-PLAN.md -- Strategic context preview UI in Understand tab

### Phase 26: Strategic Environment & Inheritance (INSERTED)
**Goal:** Enable strategic-level problem sets to serve as context providers, with inheritance mechanisms that propagate directives, policy, intelligence, and strategic guidance to subordinate operational and tactical problem sets
**Depends on:** Phase 24, Phase 23
**Research:** Complete (26-RESEARCH.md)
**Plans:** 5/5 plans executed
**Requirements:** SEI-01 (Auto-Inheritance), SEI-02 (Update Propagation), SEI-03 (Context Display), SEI-04 (Commander Acknowledgment), SEI-05 (Changelog), SEI-06 (Annotations), SEI-07 (RFI Threads)

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
- [x] 26-01-PLAN.md -- Backend: inheritance types, store, service, auto-inheritance hook, API routes (completed 2026-03-06)
- [x] 26-02-PLAN.md -- Frontend: API client, InheritedItemCard, ContextDashboardWidget, AcknowledgmentBanner (completed 2026-03-06)
- [x] 26-03-PLAN.md -- InheritedContextSection, ChangelogView, UnderstandTab integration (completed 2026-03-06)
- [x] 26-04-PLAN.md -- AnnotationPanel and RFIThread components (completed 2026-03-06)
- [x] 26-05-PLAN.md -- Wire annotations/RFI into section, propagation hooks, backfill, end-to-end verification (completed 2026-03-06)

### Phase 27: Resource Registry & DID Plugin Architecture (INSERTED)
**Goal:** Elevate resources from data records to first-class entities with DIDs, a plugin registration system for resource types, and full integration with the COP, DAO governance, and AI agent ecosystem
**Depends on:** Phase 24
**Research:** Required
**Research topics:** Resource identity patterns in military C2 systems, DID-based asset tracking, plugin architecture patterns (Strategy/Factory), IoT device identity management, MIL-STD-2525D resource symbology, telemetry data ingestion patterns, edge device registration protocols
**Plans:** 5/5 plans complete

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
- [x] 27-01-PLAN.md — Foundation types, plugin interface, resource DID, DB migration
- [x] 27-02-PLAN.md — 6 built-in resource type plugins and auto-discovery loader
- [x] 27-03-PLAN.md — Resource registry with cache and resource group store
- [x] 27-04-PLAN.md — AI agent tools, telemetry service, extended REST API
- [ ] 27-05-PLAN.md — COP resource layer, detail panel, frontend registry service

### Phase 28: Embedded DAO Governance at Decision Gates (INSERTED)
**Goal:** Move DAO governance from a dedicated Decide tab into contextual decision gates embedded within each tab of the doctrinal workflow, making governance a natural part of the planning process rather than a separate activity
**Depends on:** Phase 24, Phase 3
**Research:** Unlikely
**Plans:** 8/9 plans executed

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
- [x] 28-01-PLAN.md -- Backend gate types, PostgreSQL store, gate service, REST API (Wave 1)
- [x] 28-02-PLAN.md -- Frontend gate service, DecisionGateContext, banner/badge/overlay components (Wave 1) (completed 2026-03-07)
- [x] 28-03-PLAN.md -- GateProposalModal, GateSubmitButton, DecisionGateTimeline, TabLayout extension (Wave 2) (completed 2026-03-07)
- [x] 28-04-PLAN.md -- DecisionGateProvider in ProblemSetTabContainer, embed gates in Understand/Design/Plan tabs (Wave 3) (completed 2026-03-07)
- [x] 28-05-PLAN.md -- DirectTab gate overview + order release gate, AssessTab implementation with reframing gate (Wave 4) (completed 2026-03-07)
- [x] 28-06-PLAN.md -- Generalize MDMP frontend components (GovernanceGateDashboard, DecisionBriefView, PhaseProgressionBar) (Wave 4) (completed 2026-03-07)
- [ ] 28-07-PLAN.md -- Escalation wiring, role-based permissions, hierarchical gate visibility (Wave 5)
- [ ] 28-08-PLAN.md -- Human verification of complete governance system (Wave 6)
- [ ] 28-09-PLAN.md -- MDMP dual-read unification, training mode gate tagging (Wave 4)

### Phase 29: Contextual AI Staff Integration (INSERTED)
**Goal:** Surface AI agent output contextually within each tab of the doctrinal workflow, providing per-tab AI assistants that are aware of the current workflow phase and deliver relevant recommendations, analysis, and automation
**Depends on:** Phase 24, Phase 25, Phase 4.2
**Research:** Required
**Research topics:** Contextual AI assistant UX patterns, workflow-aware agent orchestration, recommendation engine design for multi-phase processes, conversational AI in planning tools, agent output rendering patterns (inline, sidebar, overlay)
**Plans:** 4/5 plans executed

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
- [x] 29-01-PLAN.md — AI staff type system, shared context, and agent routing config
- [x] 29-02-PLAN.md — Backend AI staff module (store, REST API, WebSocket channel)
- [ ] 29-03-PLAN.md — Frontend panel components (docked sidebar, floating overlay, feed items, badges)
- [ ] 29-04-PLAN.md — Frontend hooks, service client, chat input, inline annotation state
- [ ] 29-05-PLAN.md — Integration wiring, inline annotation UI, human verification

### Phase 30: Ironclaw Agent Integration
**Goal:** Integrate an Ironclaw agent (NEAR AI) as a chief-of-staff capability that can execute system changes, code modifications (via PR/CI-CD), and problem set configuration on behalf of authorized users with tiered permissions
**Depends on:** Phase 29, Phase 27
**Research:** Required
**Plans:** 8/8 plans complete
**Research topics:** Ironclaw agent architecture and API (nearai/ironclaw), secure agent sandboxing, permission-tiered agent execution (system admin vs problem set creator/admin), CI/CD integration for agent-initiated code changes, audit trail and rollback mechanisms, blast radius containment per problem set, rate limiting and confirmation gates for destructive actions, scope escalation prevention

**Context:**
This phase gives BASTION a powerful "chief of staff" agent powered by Ironclaw (NEAR AI) that can act on behalf of authorized users. The agent has full access to all aspects of BASTION but operates under strict permission tiers:
- **System Admin only:** Code changes, PR creation, CI/CD invocation, platform-wide configuration
- **Problem Set Creators/Admins:** Settings and setup changes scoped to their problem sets (create agents/teams, assign agents to processes, add intelligence sources, register resources/identities)

Key safety concerns addressed: agent sandboxing per problem set, immutable audit trail (NEAR blockchain), versioned state for rollback, confirmation gates for high-impact actions, and scope escalation prevention.

**Key Capabilities:**
1. **Ironclaw Agent Runtime** — Host and configure the Ironclaw agent within BASTION's infrastructure
2. **Tiered Permission System** — System admin vs problem set creator/admin authorization boundaries
3. **Code Change Pipeline** — Agent-initiated PRs with mandatory review, CI/CD integration
4. **Problem Set Configuration** — Agent can create/modify agents, teams, resources, intelligence sources within scoped problem sets
5. **Safety & Containment** — Sandboxed execution, confirmation gates, rate limiting, scope escalation prevention
6. **Audit & Rollback** — Blockchain-backed immutable action log, versioned state snapshots for rollback
7. **Natural Language Interface** — Commanders/creators direct the agent conversationally to perform administrative tasks

Plans:
- [x] 30-01-PLAN.md — Foundation types, PostgreSQL store, Docker sidecar config
- [x] 30-02-PLAN.md — Backend Ironclaw client, service, and Express router
- [x] 30-03-PLAN.md — Action registry, risk classification, confirmation pipeline
- [x] 30-04-PLAN.md — MCP tool bridge, scope validation, confirmation endpoints
- [x] 30-05-PLAN.md — Frontend UI components (drawer, button, messages, action cards)
- [x] 30-06-PLAN.md — Frontend hooks, context, service client, App.tsx wiring
- [x] 30-07-PLAN.md — GitHub service for code change pipeline
- [x] 30-08-PLAN.md — Self-update service and audit trail blockchain anchoring

### Phase 31: AI Agent Validation & Compliance Testing
**Goal:** Build a validation and testing framework to quantitatively assess AI agent integration across three dimensions: determinism (reproducible outputs), reliability (content validity, accuracy, and doctrinal adherence), and authority compliance (agents operating strictly within delegated autonomy levels). Include a periodic test suite, a metrics dashboard page in Bastion showing trends over time, threshold-based alerting that surfaces deviating agents, and automatic disablement of agents operating outside parameters pending human review.
**Depends on:** Phase 29, Phase 30
**Research:** Required
**Research topics:** AI agent evaluation frameworks, determinism testing for LLM-based agents, doctrinal compliance scoring, authority boundary enforcement, agent autonomy level verification, metrics collection and time-series visualization, threshold-based anomaly detection, automated agent circuit-breaker patterns, human-in-the-loop review workflows

**Context:**
As BASTION's AI agent ecosystem grows (19 agent roles, contextual staff integration, Ironclaw chief-of-staff), operational trust requires quantitative validation. This phase establishes three pillars of agent assurance:
- **Determinism:** Given identical inputs, agents produce consistent outputs within acceptable variance
- **Reliability:** Agent responses are factually valid, accurate, and adhere to military doctrine (JP 3-0, JP 5-0, etc.)
- **Authority:** Agents operate exclusively within their delegated autonomy levels and never exceed granted permissions

The test suite runs periodically, feeding results into a dedicated Bastion page with time-series metrics. When any agent breaches defined thresholds, it is automatically disabled and flagged for human review.

**Key Capabilities:**
1. **Determinism Test Suite** — Repeatable test scenarios with variance scoring across agent roles
2. **Reliability Validation** — Content accuracy checks, doctrinal adherence scoring, structured output validation
3. **Authority Compliance Tests** — Verify agents respect autonomy boundaries, permission scopes, and escalation rules
4. **Metrics Collection Pipeline** — Periodic test execution with results stored in PostgreSQL time-series tables
5. **Validation Dashboard** — Bastion page showing per-agent metrics over time with trend visualization
6. **Threshold Alerting** — Configurable acceptability thresholds per category with warning/critical levels
7. **Agent Circuit Breaker** — Automatic disablement of agents exceeding thresholds, pending human review
8. **Human Review Workflow** — Notification and assessment interface for reviewing flagged agents

**Plans:** 6/7 plans executed

Plans:
- [x] 31-01-PLAN.md — Validation types, DB schema, and store foundation
- [x] 31-02-PLAN.md — Scoring modules (determinism, reliability, authority)
- [x] 31-03-PLAN.md — Validation runner, circuit breaker, scheduler, and REST API
- [x] 31-04-PLAN.md — Fixture loader, generator, and 10 high-priority role fixtures
- [x] 31-04b-PLAN.md — Generated fixtures for remaining 21 staff roles
- [x] 31-05-PLAN.md — Frontend validation dashboard with Recharts visualizations
- [x] 31-06-PLAN.md — AgentHealthDot integration and activation gating

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
**Plans:** 11 plans

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
**Goal**: End-to-end DAO-governed autonomous vehicle control chain: mock DAO mission intent -> Bastion gateway -> Jetson Orin Nano mission client -> Sphero RVR+ executes deterministic behavior -> status reporting back to Bastion COP with human-in-the-loop authorization for restricted actions
**Depends on**: Phase 1, Phase 27 (Resource Registry), Phase 28 (Decision Gates), Phase 32 (Discovery)
**Research**: Complete (06-RESEARCH.md)
**Plans**: 5 plans

Plans:
- [x] 06-01-PLAN.md — Backend robot types, WS endpoint, mission service, and DB store
- [x] 06-02-PLAN.md — Jetson Python mission client, executor, and RVR+ driver
- [ ] 06-03-PLAN.md — Mock DAO trigger API, policy validation, and gate integration
- [ ] 06-04-PLAN.md — COP robot layer, status card, and activity feed integration
- [ ] 06-05-PLAN.md — Demo mission trigger UI, calibration API, and end-to-end verification

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
**Plans:** 2/5 plans executed

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

### Phase 50: Universal Intelligence Input & Auto-Classification

**Goal:** Replace the fragmented ingestion sidebar (separate document upload zone, OSINT source modal with manual type/URL/interval config, disconnected filter tags) with a single universal input area that accepts any content — drag-and-drop files, pasted URLs, raw text, structured data — and automatically discerns the source type, classifies content, routes to appropriate specialist agents, and extracts intelligence into the brain graph. The lead agent orchestrator manages the full pipeline with robust error handling, retry logic, and clear user-facing status. Eliminates manual source-type selection; reduces all ingestion to one intuitive interaction point.

**Depends on:** Phase 40 (document intelligence team), Phase 41 (brain visualization redesign)

**Research:** Yes — input type detection heuristics, URL unfurling/content extraction, paste event handling across browsers, streaming classification feedback UX patterns

**Requirements:**

- UNIV-01: Single universal input zone at top of ingestion sidebar — accepts drag-and-drop files, pasted text, typed/pasted URLs, and clipboard images
- UNIV-02: Auto-detect input type from content: file uploads (by MIME/extension), URLs (by pattern match), raw text (fallback), structured data (JSON/XML detection)
- UNIV-03: URL unfurling — fetch URL content, detect if RSS feed, API endpoint, news article, PDF link, or web page; extract metadata (title, description, OG tags)
- UNIV-04: For detected RSS/Atom feeds, auto-create OSINT source subscription with sensible defaults (polling interval, relevance mode) — no manual modal required
- UNIV-05: For detected web articles/pages, extract and ingest as document through existing doc-intelligence pipeline
- UNIV-06: For pasted text blocks, classify as intelligence report snippet, strategic guidance, OSINT item, or freeform note; route to appropriate extraction pipeline
- UNIV-07: For file drops, use existing doc-intelligence pipeline (PDF, DOCX, TXT, MD, HTML, CSV, JSON, XML) with automatic format detection
- UNIV-08: Lead agent orchestrator triages all inputs — determines classification, selects specialist agents, manages parallel processing, handles failures with retry/fallback
- UNIV-09: Real-time inline status for each input item: queued → classifying → processing → extracting → complete/error, with expandable detail
- UNIV-10: Error recovery UI — failed items show actionable error message with retry button; orchestrator attempts automatic retry with backoff before surfacing to user
- UNIV-11: Batch input support — multiple files/URLs/text blocks can be submitted simultaneously; orchestrator processes in parallel with individual status per item
- UNIV-12: Input history feed below the input zone replaces current separate Documents/OSINT/Events sections — unified chronological feed of all ingested items regardless of source type
- UNIV-13: Smart suggestions — when input is ambiguous, show classification options as clickable chips (e.g., "Looks like an RSS feed — Subscribe?" / "Treat as document?") rather than requiring manual modal
- UNIV-14: Keyboard-friendly — Ctrl+V paste triggers ingestion, Enter submits typed URL/text, Escape cancels
- UNIV-15: Backend auto-classification endpoint: `POST /api/ingest/classify` — accepts raw content/URL/file, returns detected type + confidence + suggested pipeline
- UNIV-16: Backend unified ingest endpoint: `POST /api/ingest/submit` — accepts classified input, routes to doc-intelligence or OSINT pipeline, returns process ID for status tracking
- UNIV-17: Preserve existing SSE event stream for real-time processing updates; extend with classification and routing events
- UNIV-18: Deprecate but don't remove AddOSINTSourceModal and separate document upload zone — keep as advanced/manual fallback accessible via "Advanced" link
- UNIV-19: Mobile-responsive input area — works with touch drag-and-drop and mobile paste
- UNIV-20: Accessibility — ARIA labels, keyboard navigation, screen reader announcements for status changes

**Plans:** 6/7 plans executed

Plans:
- [ ] 50-01-PLAN.md — Backend content classifier + URL unfurler with tests
- [ ] 50-02-PLAN.md — Backend API endpoints (classify + submit) + pipeline router + SSE extension
- [ ] 50-03-PLAN.md — Frontend UniversalInputZone component + useUniversalIngest hook
- [ ] 50-04-PLAN.md — Wire into IngestionSidebar, smart suggestions, unified feed, deprecate old panels
- [ ] 50-05-PLAN.md — Human verification checkpoint

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
| 6. Autonomous Vehicle Integration | 2/5 | In Progress|  |
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
| 23. Problem Set Model & Rename | 9/10 | In Progress|  |
| 24. Doctrinal Tab Restructure | 3/3 | Complete    | 2026-03-06 |
| 25. Operational Design Workspace | 6/6 | Complete   | 2026-03-06 |
| 26. Strategic Environment & Inheritance | 5/5 | Complete   | 2026-03-06 |
| 27. Resource Registry & DID Plugin | 5/5 | Complete    | 2026-03-07 |
| 28. Embedded DAO Governance | 8/9 | In Progress|  |
| 29. Contextual AI Staff Integration | 4/5 | In Progress|  |
| 30. Ironclaw Agent Integration | 8/8 | Complete   | 2026-03-07 |
| 31. AI Agent Validation & Compliance Testing | 7/7 | In Progress|  |
| 40. Autonomous Document Intelligence Team | 12/12 | Complete   | 2026-03-09 |
| 42. Resources Tab — Inventory, Discovery & Onboarding | 6/6 | Complete   | 2026-03-12 |
| 50. Universal Intelligence Input & Auto-Classification | 6/7 | In Progress|  |
