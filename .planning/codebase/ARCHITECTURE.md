# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Layered Monorepo with Event-Driven Micromodule Architecture

BASTION is a military C2 platform organized as a TypeScript/Node.js backend + React frontend with a Python robot/bridge layer and Rust NEAR smart contracts. The backend is a single Express server with dozens of domain modules — each a mini-service with its own store, router, and types — coordinated by an internal message bus and event bus rather than HTTP-between-services.

**Key Characteristics:**
- Domain modules in `backend/src/<domain>/` each export a router, store(s), and init function
- All domain modules mount on a single Express server at `backend/src/index.ts` (74 route mounts)
- Internal coordination via `messaging/message-bus.ts` (pg-boss-backed) and `cop/messaging/event-bus.ts` (EventEmitter)
- LangGraph (LangChain) orchestrates multi-agent AI pipelines; `orchestration/supervisor.ts` is the root coordinator
- PostgreSQL is the primary datastore; Neo4j holds the knowledge graph (RAFT model); Yjs powers CRDT collaboration
- NEAR blockchain stores attestations, DIDs, DAO governance, credential registry, and document hashes
- WebSocket layer uses `noServer: true` pattern with a single centralized upgrade handler routing 8 WS paths

## Layers

**Frontend (Presentation):**
- Purpose: React SPA with URL-driven tab routing per problem-set
- Location: `frontend/src/`
- Contains: Components organized by feature (`components/<domain>/`), React contexts (`context/`), custom hooks (`hooks/`), frontend service clients (`services/`)
- Depends on: Backend REST API and WebSocket endpoints
- Used by: Browser clients

**Backend API Layer:**
- Purpose: Express route handlers that parse HTTP, authenticate, delegate to domain services
- Location: `backend/src/api/` (REST files) and `backend/src/routes/` (legacy MDMP routes)
- Contains: ~35 `.ts` route files, each importing domain stores/services
- Depends on: Domain services, auth middleware, database pools
- Used by: Frontend, external webhooks, robot bridge

**Domain Modules:**
- Purpose: Business logic, AI pipelines, data stores per feature domain
- Location: `backend/src/<domain>/` — `agents/`, `brain/`, `cop/`, `dao/`, `design/`, `discovery/`, `doc-intelligence/`, `gates/`, `graph/`, `ingest/`, `inheritance/`, `ironclaw/`, `jpp/`, `mdmp/`, `osint/`, `planning/`, `problem-set/`, `robot/`, `strategic/`, `validation/`, `wargaming/`
- Contains: Service classes, store modules (direct SQL via `pg`), types, LangGraph graphs
- Depends on: `lib/database.ts` (pg pool), `graph/neo4j-client.ts`, messaging bus
- Used by: API layer

**Infrastructure Layer:**
- Purpose: Database connectivity, auth, encryption, blockchain sync, job queuing
- Location: `backend/src/lib/`, `backend/src/auth/`, `backend/src/security/`, `backend/src/near/`, `backend/src/crypto/`
- Contains: `database.ts` (pg Pool + pg-boss singleton), `blockchain-sync.ts`, ABAC enforcer, zero-trust middleware
- Depends on: External services (PostgreSQL, Neo4j, NEAR RPC)
- Used by: All domain modules

**Blockchain Layer:**
- Purpose: Immutable attestations, DID registry, DAO governance, NEAR-based auth
- Location: `near-contracts/src/` (Rust), `backend/src/near/`, `backend/src/dao/`
- Contains: Rust contract files — `did_registry.rs`, `dao/`, `document.rs`, `credential_registry.rs`, `attestation.rs`, `mdmp/`
- Depends on: NEAR testnet/mainnet RPC
- Used by: Backend lib layer for attestation anchoring

**Robot/Edge Layer:**
- Purpose: Physical robot control, bridge relay, vision pipeline
- Location: `robot/` (Python), `bridge/` (Python), `edge-device/` (TypeScript)
- Contains: BLE RVR driver, swarm orchestration, vision detection, bridge WebSocket relay
- Depends on: Backend WebSocket at `/ws/robot` and `/ws/bridge`
- Used by: Robot hardware (Sphero RVR), edge Pi nodes

## Data Flow

**Standard REST Request:**

1. Browser sends `fetch()` to `VITE_BACKEND_API_URL/api/<domain>`
2. Express receives at `backend/src/index.ts`, routes through CORS middleware
3. `requireAuth` middleware (from `@vitalpoint/near-phantom-auth`) validates session cookie
4. Domain router (e.g., `backend/src/api/problem-sets.ts`) invokes domain store/service
5. Domain store queries PostgreSQL via `getPool()` from `backend/src/lib/database.ts`
6. Response JSON returned to browser; frontend updates React state

**Intelligence Ingestion Pipeline (Phase 50):**

1. User submits content (file upload, URL paste, text) to `UniversalInputZone.tsx`
2. Frontend calls `POST /api/ingest` → `backend/src/api/ingest.ts`
3. `backend/src/ingest/universal-classifier.ts` classifies content type via heuristics + URL unfurling into one of: `file`, `rss_feed`, `article_url`, `pdf_url`, `json_data`, `xml_data`, `raw_text`
4. `backend/src/ingest/universal-ingest-router.ts::routeToProcess()` dispatches to pipeline:
   - `doc-intelligence` → binary/text documents, HTML articles, PDFs
   - `osint-subscribe` → RSS/Atom feeds (creates subscription in `jpp/osint-feed-store.ts`)
   - `text-ingest` → pasted freeform text (also routes to doc-intelligence)
   - `manual` → ambiguous; frontend shows `SmartSuggestionChips.tsx`
5. For `doc-intelligence`: document persisted to `strategic_documents` table; LangGraph graph invoked via `doc-intelligence/orchestrator-wiring.ts`
6. `doc-intelligence/orchestrator.ts` (LangGraph StateGraph) triages via LLM, then fans out to parallel specialist agents in `doc-intelligence/specialists/`
7. On completion: `doc-intelligence/doc-cop-pipeline.ts` geocodes locations and creates COP layer; SSE events broadcast via `api/doc-intelligence.ts::broadcastSSE()`
8. Frontend receives SSE events and updates `IngestionDrawer.tsx` status indicators

**OSINT Feed Pipeline:**

1. `osint/feed-poller.ts` polls RSS feeds on configurable intervals (default 15 min)
2. New articles extracted → `osint/osint-entity-extractor.ts` extracts entities via LLM
3. `osint/osint-graph-sync.ts` writes actors/events to Neo4j
4. `osint/osint-cop-pipeline.ts` creates COP intelligence layers directly from events with location data (no LLM dependency — deterministic)
5. COP layer stored via `cop/layers/layer-store.ts`; frontend polls or receives via SSE

**COP Layer Generation:**

1. Document approved in strategic review → `strategic.ts` API emits `document:committed` on `cop/messaging/event-bus.ts`
2. `cop/messaging/trigger-handler.ts` receives event, emits `layer:generation:start`
3. `cop/agents/cop-coordinator.ts::runCOPGeneration()` invoked with objectives + graph entities + OSINT events as context
4. COP sub-agents in `cop/agents/layer-sub-agents/` run in parallel: `force-disposition.ts`, `intel-overlay.ts`, `c2-overlay.ts`, `control-measures.ts`, `objectives-overlay.ts`, `logistics-overlay.ts`
5. Each sub-agent produces a `COPLayerSpec` with symbols, annotations, and affiliation data using CCO (Common Core Ontology) classification
6. `cop/layers/layer-assembler.ts` merges specs; `cop/layers/layer-store.ts` persists to PostgreSQL
7. `cop/layers/version-store.ts` snapshots versions; `cop/layers/conflict-detector.ts` checks for symbol conflicts
8. Frontend `COPTab.tsx` → `COPMapView.tsx` renders layers on Leaflet map with `COPLayerControls.tsx`

**AI Agent Orchestration:**

1. Task submitted via `POST /api/orchestration` → `api/orchestration.ts`
2. `orchestration/supervisor.ts::BastionSupervisor` compiles LangGraph StateGraph with filter+agent nodes
3. Supervisor uses LLM routing decision to select next agent, checking classification level via `orchestration/classification-filter.ts`
4. Agents in `agents/langgraph/` execute as LangGraph nodes; each wraps via `orchestration/agent-wrapper.ts`
5. State checkpointed at each step via `orchestration/checkpointer.ts` (PostgresSaver)
6. Human checkpoint triggers pause execution (stored in `orchestration/human-checkpoints.ts`); client resumes via WS
7. Execution trace stored by `orchestration/observability.ts`; WS stream at `/ws/orchestration/:threadId`

**Blockchain Sync:**

1. `lib/blockchain-sync.ts` worker polls NEAR events at startup
2. Relevant events (DAO votes, document commits, attestations) synced to PostgreSQL
3. When user action requires on-chain write: `near/tx-signer.ts` signs via MPC or user's NEAR account
4. `dao/dao-service.ts` constructs proposals; `gates/gate-service.ts` triggers DAO vote on gate approval

**State Management (Frontend):**

1. `context/ProblemSetContext.tsx` — active problem-set ID, tabs state, membership
2. `context/ModeContext.tsx` — Training/Operational global mode toggle
3. `context/IronclawContext.tsx` — AI staff assistant state (replaced AIStaffContext)
4. `context/DecisionGateContext.tsx` — gate status for blocking transitions
5. Per-feature hooks in `hooks/` (e.g., `useCOPGateNotifications.ts`, `useAgentRouting.ts`)

## Key Abstractions

**Problem Set:**
- Purpose: Top-level organizational unit (JP 5-0 "problem set", renamed from "workspace")
- Examples: `backend/src/problem-set/problem-set-store.ts`, `backend/src/api/problem-sets.ts`
- Pattern: UUID-keyed, hierarchical (parent/child problem sets), membership-controlled via `problem-set-member-store.ts`

**Brain Graph (Knowledge Graph):**
- Purpose: Visual representation of RAFT (Role-Actor-Function-Tension) entities and their relationships in Neo4j
- Examples: `backend/src/graph/raft/`, `backend/src/brain/brain-store.ts`, `frontend/src/components/brain/BrainVisualization.tsx`
- Pattern: Actors, relationships, tensions stored as Neo4j nodes/edges; `brain-store.ts` queries via `executeReadQuery()`; `brain/agents/` run intelligence agents against graph; subspaces (`graph/subspace/`) partition graphs by problem set; lenses (`graph/subspace/lens-store.ts`) provide filtered views

**COP Layer:**
- Purpose: Structured geospatial intelligence overlay for the map view, typed by CCO ontology
- Examples: `backend/src/cop/layers/layer-types.ts`, `backend/src/cop/layers/layer-store.ts`
- Pattern: `COPLayerSpec` contains `COPSymbolSpec[]` and `COPAnnotationSpec[]`; each symbol has MGRS coordinates, SIDC code, affiliation, and confidence tier from `graph/provenance-types.ts`

**Decision Gate:**
- Purpose: Workflow control points requiring DAO approval before phase progression
- Examples: `backend/src/gates/gate-store.ts`, `backend/src/gates/gate-service.ts`, `frontend/src/components/governance/DecisionGateBanner.tsx`
- Pattern: Gates linked to problem-set phase; `gate-service.ts` triggers DAO proposals when gate is reached; `DecisionGateContext.tsx` blocks tab navigation until gate resolved

**LangGraph Agent:**
- Purpose: AI agent executing within a LangGraph StateGraph with classification-aware routing
- Examples: `backend/src/agents/langgraph/agent-seeder.ts`, `backend/src/orchestration/agent-wrapper.ts`
- Pattern: Each agent wrapped via `LangGraphAgentWrapper`; seeded into `staff_agent_defs` table; supervisor routes to `filter_<agentId>` node first (classification check), then to `<agentId>` node

**Ironclaw:**
- Purpose: Primary AI staff assistant interface (Phase 30+), replacing standalone AIStaffPanel
- Examples: `backend/src/ironclaw/ironclaw-service.ts`, `frontend/src/components/ironclaw/IronclawDrawer.tsx`
- Pattern: Actions pipeline in `ironclaw/action-pipeline.ts`; tool bridge in `ironclaw/tool-bridge.ts`; stores actions with audit trail; GitHub service for code deployments

**RAFT Model:**
- Purpose: Role-Actor-Function-Tension knowledge graph nodes in Neo4j
- Examples: `backend/src/graph/raft/actor-store.ts`, `backend/src/graph/raft/tension-store.ts`, `backend/src/graph/raft/relationship-store.ts`
- Pattern: Actors, their roles, functions they perform, and tensions between them; each node has provenance (confidence tier, source, timestamp)

## Entry Points

**Backend Server:**
- Location: `backend/src/index.ts`
- Triggers: `node index.js` (production via Docker), `tsx src/index.ts` (dev)
- Responsibilities: Mounts all Express routers, creates all 8 WebSocket servers with centralized upgrade handler, runs startup sequence (migrations → auth init → blockchain sync → LangGraph seeding → COP init → OSINT polling → discovery)

**Frontend SPA:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite dev server, or built static files served via nginx
- Responsibilities: Renders React tree; `BrowserRouter` → `App` → `AnonAuthProvider` → `AuthWrapper` → `AuthenticatedShell` (ModeProvider + ProblemSetProvider + IronclawProvider)

**Primary UI Route:**
- Location: `frontend/src/App.tsx`
- Pattern: `/` → `ProblemSetSelector`; `/problem-set/:problemSetId/:tab` → `ProblemSetTabContainer`; `/admin/*` → `AdminDashboard`
- Tab values: `understand`, `design`, `plan`, `direct`, `cop`, `assess` (Phase 24 doctrinal structure)

**Python Bridge:**
- Location: `bridge/bridge_main.py`
- Triggers: `bridge/bastion-bridge.service` (systemd), or `docker-compose.yml`
- Responsibilities: mDNS advertisement, WebSocket relay to backend `/ws/bridge`, command queue for robot dispatch

**Python Robot Agent:**
- Location: `robot/` (entry via various scripts)
- Triggers: `robot/bastion-robot.service` (systemd on edge Pi)
- Responsibilities: BLE driver for Sphero RVR, mission executor, vision pipeline, swarm coordination

## Error Handling

**Strategy:** Fail-fast for infrastructure (crash on DB unavailable); graceful degradation for feature modules (non-fatal `console.warn` + continue)

**Patterns:**
- Domain stores: `try/catch` returning `null` or empty arrays; no global error boundary in store layer
- API routes: `try/catch` per handler with `res.status(500).json({ error: ... })`; error message from `error instanceof Error ? error.message : 'Unknown error'`
- LangGraph agents: Checkpointing allows resume after failure; `orchestration/observability.ts` records error spans
- COP pipeline: All post-processing steps (geocoding, layer creation) wrapped in `try/catch` with `console.warn` — non-fatal
- Ingest pipeline: `withRetry()` in `ingest/universal-ingest-router.ts` does one automatic retry on transient failures (5xx); 4xx are not retried
- Startup: Each `server.listen` init block is independently try/caught; one failing module doesn't prevent others

## Cross-Cutting Concerns

**Authentication:** `@vitalpoint/near-phantom-auth` package; anonymous passkey-based auth with NEAR account linkage. `requireAuth` middleware from `backend/src/auth/auth-instance.ts`. Single-session enforcement in `index.ts` login intercept. NEAR account auto-funded after registration via `auth/funding-service.ts`.

**Authorization:** ABAC enforcer in `backend/src/security/abac-enforcer.ts` with `backend/src/security/abac-model.conf`. Problem-set membership checked per request by domain stores. Classification levels (`UNCLASS → TOPSECRET`) enforced by `orchestration/classification-filter.ts` for agent routing.

**Logging:** `console.log/warn/error` with structured prefixes like `[COP]`, `[MDMP API]`, `[IngestRouter]`. No centralized logging framework.

**Collaboration:** Yjs CRDT in `collaboration/` with `collaboration/sync-server.ts` providing Y.js document sync over WebSocket at `/ws/collab`. Design tab uses `hooks/yjs-hooks.ts` for real-time collaborative editing.

**Job Queue:** `pg-boss` singleton (`lib/database.ts::getSharedBoss()`) handles background jobs: `strategic-cache-refresh` for inheritance. OSINT polling via timer in `osint/feed-poller.ts`. Validation scheduling in `validation/validation-scheduler.ts`.

**Migrations:** SQL files in `backend/src/db/migrations/` (named `0NN-description.sql`); run by `db/migration-runner.ts` on startup. Must run on production DB after deploy (not locally per project convention).

---

*Architecture analysis: 2026-03-18*
