# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
ssr/                              # Project root
├── backend/                      # Node.js/TypeScript API server
│   └── src/
│       ├── index.ts              # Server entry point — all routers + WS
│       ├── api/                  # Express route handlers (35 files)
│       ├── routes/               # Legacy MDMP routes
│       ├── agents/               # AI agent registry + LangGraph agent definitions
│       ├── ai-staff/             # AI staff panel store/router
│       ├── assessment/           # MOE/MOP assessment logic
│       ├── auth/                 # Auth middleware, NEAR funding, MPC
│       ├── brain/                # Brain graph annotations/snapshots store
│       ├── collaboration/        # Yjs CRDT sync server
│       ├── command/              # Commander/HHQ panel logic
│       ├── cop/                  # COP layer system (agents, layers, CCO, messaging)
│       ├── credentials/          # Verifiable credentials
│       ├── crypto/               # Encryption utilities
│       ├── dao/                  # DAO service + NEAR proposal types
│       ├── db/                   # Migration runner + SQL migration files
│       ├── design/               # Operational Design workspace
│       ├── discovery/            # Network resource discovery + onboarding pipeline
│       ├── doc-intelligence/     # Document processing LangGraph pipeline
│       ├── exercise/             # Exercise mode + training scenarios
│       ├── gates/                # Decision gate store/service/routes
│       ├── graph/                # Neo4j client + RAFT stores + OSINT events + subspaces
│       ├── identity/             # DID identity management
│       ├── ingest/               # Universal intelligence input classifier + router
│       ├── inheritance/          # Problem-set hierarchy + FRAGO inheritance
│       ├── ironclaw/             # AI staff assistant (Phase 30+)
│       ├── jpp/                  # JPP workflow stores (EWM, OSINT feeds)
│       ├── lib/                  # Database pool, pg-boss, blockchain sync, geocoding
│       ├── mdmp/                 # MDMP workflow service + activity registry + safety
│       ├── messaging/            # Message bus (pg-boss backed) + ABAC filter
│       ├── middleware/           # Exercise watermark, mode context
│       ├── mission-creation/     # Mission creation from OPORD
│       ├── near/                 # NEAR tx signer + user secrets
│       ├── operational-planning/ # Operational planning stores
│       ├── orchestration/        # LangGraph supervisor + classification filter + checkpointer
│       ├── osint/                # OSINT feed poller + entity extractor + COP pipeline + graph sync
│       ├── planning/             # Planning document routes
│       ├── problem-set/          # Problem-set store, member store, invite, compartment
│       ├── raft/                 # (Legacy — see graph/raft/)
│       ├── resources/            # Resource registry + WebSocket
│       ├── robot/                # Robot mission service + vision pipeline + swarm + bridge
│       ├── security/             # ABAC enforcer + zero-trust middleware + policies
│       ├── sensors/              # Sensor fusion
│       ├── services/             # Shared service utilities
│       ├── strategic/            # Strategic document containers + objectives + guidance
│       ├── templates/            # Document templates
│       ├── validation/           # Agent validation scheduler + scoring + activation gate
│       └── wargaming/            # Wargaming logic
├── frontend/                     # React/Vite SPA
│   └── src/
│       ├── main.tsx              # React entry point
│       ├── App.tsx               # Router layout + auth shell + contexts
│       ├── App.css               # Global app styles
│       ├── index.css             # Base CSS reset
│       ├── components/           # Feature-organized React components
│       │   ├── admin/            # Admin dashboard panels
│       │   ├── ai-staff/         # AI staff panel (Ironclaw UI)
│       │   ├── assess/           # Assessment tab (MOE/MOP/AAR)
│       │   ├── brain/            # Brain visualization (knowledge graph)
│       │   ├── common/           # Shared/reusable UI components
│       │   ├── cop/              # COP map + layers + controls
│       │   ├── dao/              # DAO governance dashboard + proposals
│       │   ├── design/           # Operational design tab
│       │   ├── direct/           # Direct (command) tab
│       │   ├── doc-intelligence/ # Document intelligence panel
│       │   ├── escalation/       # Escalation modeling panel
│       │   ├── exercise/         # Exercise/training mode panels
│       │   ├── governance/       # Decision gates + MDMP governance
│       │   ├── graph/            # Graph explorer (Neo4j viz)
│       │   ├── inheritance/      # Problem-set inheritance + FRAGO
│       │   ├── ironclaw/         # Ironclaw AI assistant drawer
│       │   ├── mission/          # Mission creation panels
│       │   ├── plan/             # Plan tab (JPP, MDMP, COA)
│       │   ├── planning/         # Planning panels (shared)
│       │   ├── problem-set/      # Problem-set selector, switcher, members, settings
│       │   ├── resources/        # Resources tab (discovery, inventory, network)
│       │   ├── strategic/        # Strategic document containers + objectives
│       │   ├── tabs/             # Tab layout + Understand/Design/Plan/Direct/COP/Assess tabs
│       │   └── validity/         # Validation panels
│       ├── context/              # React contexts (ProblemSet, Mode, Ironclaw, etc.)
│       ├── hooks/                # Custom React hooks (useAuth, useCOP, useAgentRouting, etc.)
│       ├── lib/                  # Frontend utilities (encryption, IPFS, MPC recovery)
│       ├── services/             # Typed API client functions for each backend domain
│       ├── types/                # TypeScript type definitions (admin, cop, dao, etc.)
│       ├── assets/               # Static assets
│       └── test-setup.ts         # Vitest test setup
├── near-contracts/               # Rust NEAR smart contracts
│   └── src/
│       ├── lib.rs                # Contract root
│       ├── dao/                  # DAO governance contract
│       ├── mdmp/                 # MDMP on-chain workflow
│       ├── did_registry.rs       # DID registry
│       ├── document.rs           # Document attestation
│       ├── credential_registry.rs
│       ├── attestation.rs
│       ├── chain_signatures.rs
│       ├── funding.rs
│       ├── intents.rs
│       └── privacy.rs
├── bridge/                       # Python bridge agent (edge-to-backend relay)
│   ├── bridge_main.py            # Entry point
│   ├── bridge_relay.py           # WebSocket relay logic
│   ├── bridge_ws.py              # WS client
│   ├── command_queue.py          # Robot command queue
│   ├── scanner.py                # Network scanner
│   ├── mdns_advertise.py         # mDNS advertisement
│   ├── Dockerfile
│   └── requirements.txt
├── robot/                        # Python robot agent (Sphero RVR)
│   ├── ble_rvr_driver.py         # BLE driver for Sphero RVR
│   ├── mission_executor.py       # Mission execution logic
│   ├── mission_client.py         # Backend API client
│   ├── common/                   # Shared utilities
│   ├── intent/                   # Mission intent translation
│   ├── swarm/                    # Swarm coordination
│   ├── sweep/                    # Area sweep logic
│   ├── vision/                   # Object detection (YOLO)
│   │   └── training/             # Training images/labels (CHN-99G, T-90 tanks)
│   └── tests/
├── edge-device/                  # TypeScript edge device module
│   └── src/                      # Edge-side TypeScript code
├── near-openclaw/                # NEAR keypair files
├── ironclaw/                     # (Empty/placeholder for Ironclaw external agent)
├── contracts/                    # Additional contract artifacts
├── nginx/                        # nginx reverse proxy config
├── scenario/                     # Pacific Strategy AY26 exercise scenario files
│   ├── blue team/                # Blue team documents (6 phases)
│   ├── red team/                 # Red team documents (6 phases)
│   └── scenario phases/          # Shared scenario phase materials
├── scripts/                      # Seed and utility scripts
│   ├── seed-scenario.sh
│   ├── seed-graph-data.sh
│   └── demo-data/                # Demo data per domain (agents, cop, jpp, osint, etc.)
├── searxng/                      # SearXNG configuration (OSINT web search)
├── outputs/                      # Generated outputs directory
├── docs/                         # Documentation
├── docker-compose.yml            # Development compose
├── docker-compose.prod.yml       # Production compose
└── .planning/                    # GSD planning files
    ├── ROADMAP.md
    ├── STATE.md
    ├── codebase/                 # This analysis
    ├── phases/                   # Phase plans (01-50+)
    ├── architecture/             # Architecture diagrams/notes
    └── todos/                    # Pending/done tasks
```

## Directory Purposes

**`backend/src/api/`:**
- Purpose: Express route handlers — one file per domain. HTTP only; no business logic.
- Contains: `problem-sets.ts`, `cop.ts` (absent — COP router in `cop/api/cop-routes.ts`), `strategic.ts`, `design.ts`, `brain.ts`, `ingest.ts`, `jpp.ts`, `assessment-routes.ts`, `robot-routes.ts`, `doc-intelligence.ts` (also holds `broadcastSSE()`), `osint-webhook.ts`, etc.
- Key files: `backend/src/api/ingest.ts`, `backend/src/api/doc-intelligence.ts`, `backend/src/api/orchestration.ts`

**`backend/src/cop/`:**
- Purpose: Common Operational Picture — layer generation, storage, event wiring, CCO classification
- Contains: `index.ts` (init + barrel), `api/cop-routes.ts`, `api/cop-handlers.ts`, `agents/cop-coordinator.ts`, `agents/agent-definitions.ts`, `agents/layer-sub-agents/` (6 overlay agents), `layers/layer-store.ts`, `layers/version-store.ts`, `layers/conflict-detector.ts`, `layers/layer-assembler.ts`, `layers/layer-types.ts`, `cco/` (CCO ontology schema + validator), `messaging/event-bus.ts`, `messaging/trigger-handler.ts`, `messaging/activity-bridge.ts`, `linkage/linkage-store.ts`, `linkage/entity-linker.ts`

**`backend/src/graph/`:**
- Purpose: Neo4j knowledge graph — RAFT model, OSINT events, subspaces, confidence scoring
- Contains: `neo4j-client.ts`, `index.ts` (barrel), `raft/` (actor, relationship, tension, decision stores + schema), `osint/` (event-store, types, validity-service), `subspace/` (subspace-store, lens-store), `agents/` (all graph/JPP/OSINT/RAFT LangGraph agent implementations + tools), `provenance-types.ts`, `confidence-calculator.ts`, `contradiction-detector.ts`, `construction/`, `resolution/`

**`backend/src/orchestration/`:**
- Purpose: LangGraph multi-agent supervisor framework with classification enforcement
- Contains: `supervisor.ts` (BastionSupervisor), `agent-wrapper.ts`, `classification-filter.ts`, `state.ts` (BastionStateAnnotation), `checkpointer.ts` (PostgresSaver), `human-checkpoints.ts`, `observability.ts`, `execution-patterns.ts`

**`backend/src/ingest/`:**
- Purpose: Universal intelligence input — classify any content type and route to correct pipeline
- Contains: `universal-classifier.ts`, `universal-ingest-router.ts`, `url-unfurler.ts`, `types.ts`

**`backend/src/doc-intelligence/`:**
- Purpose: LangGraph document processing pipeline with specialist agents
- Contains: `orchestrator.ts` (StateGraph triage → specialists), `orchestrator-wiring.ts`, `specialist-base.ts`, `specialists/` (fact-extractor, objective-extractor, bias-identifier, cross-doc-linker, etc.), `interview/` (scoping interview store), `briefing/`, `provenance/`, `source-registry/` (NATO rating system), `schemas.ts`, `types.ts`, `doc-cop-pipeline.ts`, `web-search.ts`, `team-setup.ts`

**`backend/src/strategic/`:**
- Purpose: Strategic documents (containers, categories, ingestion, objectives, guidance, reviews)
- Contains: `containers/`, `extraction/`, `guidance/routes.ts`, `ingestion/document-parser.ts`, `intent/`, `objectives/`, `reviews/`, `assessment/`, `config/`, `schemas/`, `tools/`, `workflows/`

**`backend/src/problem-set/`:**
- Purpose: Problem-set data access — core organizational unit for all content
- Contains: `problem-set-store.ts`, `problem-set-member-store.ts`, `problem-set-invite-store.ts`, `problem-set-compartment-store.ts`, `problem-set-role-store.ts`, `problem-set-panel-config-store.ts`, `problem-set-activity-store.ts`, `problem-set-escalation-store.ts`, `problem-set-subscription-store.ts`, `types.ts`

**`backend/src/agents/`:**
- Purpose: AI governance agents — lifecycle management, DID creation, delegation, audit trail
- Contains: `registry.ts` (AgentRegistry class), `types.ts`, `executor.ts`, `team-registry.ts`, `agent-did.ts`, `agent-messaging.ts`, `message-handlers.ts`, `tool-registry.ts`, `tool-did.ts`, `definition-schema.ts`, `character-schema.ts`, `character-builder.ts`, `langgraph/` (LangGraph-specific agent seeder, LLM factory, prompt generator, state, tools, graphs)
- Key files: `backend/src/agents/langgraph/agent-seeder.ts`, `backend/src/agents/langgraph/llm-factory.ts`, `backend/src/agents/langgraph/graphs/strategy-reviewer-graph.ts`

**`backend/src/db/migrations/`:**
- Purpose: Sequential PostgreSQL schema migrations
- Contains: 11 SQL files (`023-workspace-to-problem-set.sql` through `033-design-revisions.sql`); earlier migrations stored elsewhere
- Pattern: Files named `0NN-description.sql`; run by `db/migration-runner.ts` on startup

**`backend/src/lib/`:**
- Purpose: Infrastructure singletons
- Contains: `database.ts` (pg Pool + pg-boss), `blockchain-sync.ts`, `geocoding-service.ts`, `encryption.ts`, `ipfs.ts`, `edge-sync.ts`

**`frontend/src/components/tabs/`:**
- Purpose: The 6 doctrinal tab components (Phase 24 structure)
- Contains: `UnderstandTab.tsx`, `DesignTab.tsx`, `PlanTab.tsx`, `DirectTab.tsx`, `AssessTab.tsx`, and `TabLayout.tsx`; `COPTab.tsx` is in `components/cop/`

**`frontend/src/context/`:**
- Purpose: React Context providers for cross-component state
- Contains: `ProblemSetContext.tsx` (active problem-set), `ModeContext.tsx` (training/operational toggle), `IronclawContext.tsx` (AI assistant state), `AIStaffContext.tsx` (legacy, kept for backward compat), `DecisionGateContext.tsx`, `UserContext.tsx`

**`frontend/src/services/`:**
- Purpose: Typed fetch wrappers for each backend API domain
- Contains: ~30 service files matching backend domains: `strategic-service.ts`, `cop-service.ts`, `design-service.ts`, `jpp-service.ts`, `ironclaw-service.ts`, `inheritance-service.ts`, etc.

**`scenario/`:**
- Purpose: Pacific Strategy AY26 exercise scenario documents
- Contains: Blue team materials (6 phases), Red team materials (6 phases), shared scenario phase materials with ORBAT, planning templates, and situation updates

**`scripts/demo-data/`:**
- Purpose: Demo seed data organized by domain
- Contains: `agents/`, `assessment/`, `command/`, `design/`, `documents/`, `governance/`, `graph/`, `inheritance/`, `jpp/`, `osint/`, `problem-sets/`

## Key File Locations

**Entry Points:**
- `backend/src/index.ts`: Backend server — all 74 route mounts, 8 WS servers, startup sequence
- `frontend/src/main.tsx`: Frontend React entry — BrowserRouter + App
- `frontend/src/App.tsx`: Route layout, auth wrapper, context providers
- `bridge/bridge_main.py`: Python bridge agent entry

**Configuration:**
- `docker-compose.yml`: Development services (backend, frontend, postgres, neo4j, searxng)
- `docker-compose.prod.yml`: Production services
- `nginx/`: Reverse proxy configuration
- `backend/src/lib/database.ts`: PostgreSQL pool config (max 20 connections)
- `backend/src/graph/neo4j-client.ts`: Neo4j driver initialization

**Core Business Logic:**
- `backend/src/ingest/universal-classifier.ts`: Content classification entry point
- `backend/src/ingest/universal-ingest-router.ts`: Pipeline routing dispatch
- `backend/src/cop/index.ts`: COP module init + event wiring
- `backend/src/cop/agents/cop-coordinator.ts`: COP layer generation
- `backend/src/orchestration/supervisor.ts`: BastionSupervisor — LangGraph multi-agent coordinator
- `backend/src/graph/raft/actor-store.ts`: RAFT actor management in Neo4j
- `backend/src/doc-intelligence/orchestrator.ts`: Document processing LangGraph graph
- `backend/src/mdmp/workflow-service.ts`: MDMP workflow state machine
- `backend/src/gates/gate-service.ts`: Decision gate + DAO proposal wiring

**Testing:**
- `backend/src/cop/layers/layer-store.test.ts`
- `backend/src/cop/layers/version-store.test.ts`
- `backend/src/cop/agents/sub-agents.test.ts`
- `backend/src/cop/linkage/entity-linker.test.ts`
- `backend/src/cop/messaging/event-bus.test.ts`
- `backend/src/graph/raft/actor-store.test.ts`
- `backend/src/ingest/universal-classifier.test.ts`
- `backend/src/ingest/url-unfurler.test.ts`
- `backend/src/doc-intelligence/doc-cop-pipeline.test.ts`
- `frontend/src/components/brain/IngestionDrawer.test.tsx`
- `frontend/src/components/brain/UniversalInputZone.test.tsx`
- `robot/tests/`

## Naming Conventions

**Files:**
- Backend domain files: `kebab-case.ts` (e.g., `layer-store.ts`, `cop-coordinator.ts`)
- Frontend components: `PascalCase.tsx` (e.g., `COPMapView.tsx`, `BrainVisualization.tsx`)
- Frontend services: `kebab-case-service.ts` (e.g., `cop-service.ts`, `design-service.ts`)
- Test files: `kebab-case.test.ts` or `PascalCase.test.tsx` co-located with implementation

**Directories:**
- Backend: `kebab-case/` matching the feature domain
- Frontend components: `kebab-case/` matching the feature tab/domain
- Migrations: `0NN-description.sql` (zero-padded sequence)

**Code:**
- TypeScript types/interfaces: `PascalCase` (e.g., `COPLayerSpec`, `BastionState`)
- Store class instances: singleton via `export const fooStore = new FooStore()`
- Route files: export `default router` or named `export const fooRouter`
- Init functions: `export async function initFoo()` — called once at startup

## Where to Add New Code

**New Feature Tab:**
- Primary component: `frontend/src/components/tabs/<FeatureName>Tab.tsx`
- Register in tab layout: `frontend/src/components/problem-set/ProblemSetTabContainer.tsx`
- Backend route: `backend/src/api/<feature>.ts` + mount in `backend/src/index.ts`
- Domain module: `backend/src/<feature>/` with `<feature>-store.ts`, `<feature>-types.ts`, `<feature>-router.ts`

**New Backend Domain Module:**
- Create `backend/src/<domain>/` directory
- Implement `<domain>-store.ts` (PostgreSQL queries via `getPool()`)
- Implement `<domain>-types.ts`
- Implement `<domain>-router.ts` or `<domain>-routes.ts`
- Add init call in `backend/src/index.ts` startup sequence if needed
- Mount router: `app.use('/api/<domain>', <domain>Router)` in `backend/src/index.ts`

**New Frontend Service:**
- Add `frontend/src/services/<domain>-service.ts`
- Use `fetch()` with `BACKEND_URL` prefix and credentials: 'include' for auth cookies

**New LangGraph Agent:**
- Implement agent class in `backend/src/agents/langgraph/` or relevant domain
- Wrap via `orchestration/agent-wrapper.ts::LangGraphAgentWrapper`
- Seed definition into `staff_agent_defs` table via `agents/langgraph/agent-seeder.ts`
- Register in supervisor or doc-intelligence specialist list

**New COP Layer Sub-agent:**
- Add file in `backend/src/cop/agents/layer-sub-agents/`
- Export function matching `sub-agent-types.ts::LayerSubAgent` interface
- Register in `cop/agents/cop-coordinator.ts`

**New Database Table:**
- Create `backend/src/db/migrations/0NN-description.sql`
- Migration runs automatically on next startup
- Add `ensureTable()` method in domain store for tables created ad-hoc
- Note: Migrations run on production DB only, not locally

**Utilities:**
- Shared backend helpers: `backend/src/lib/`
- Shared frontend helpers: `frontend/src/lib/`

## Special Directories

**`.planning/`:**
- Purpose: GSD workflow — roadmap, phase plans, state tracking, codebase analysis
- Generated: No — hand-authored + Claude-authored
- Committed: Yes

**`backend/.pnpm-store/`:**
- Purpose: pnpm content-addressable store
- Generated: Yes
- Committed: No (should be in .gitignore)

**`near-contracts/target/`:**
- Purpose: Rust build output (WASM)
- Generated: Yes
- Committed: Partially (release WASM may be committed for deployment)

**`outputs/`:**
- Purpose: Generated output artifacts
- Generated: Yes
- Committed: Selectively

**`scenario/`:**
- Purpose: Pacific Strategy AY26 training scenario documents — PDFs, Word docs, OBRs
- Generated: No — provided exercise materials
- Committed: Yes

**`searxng/`:**
- Purpose: SearXNG configuration for OSINT web search backend
- Generated: No — config files
- Committed: Yes

---

*Structure analysis: 2026-03-18*
