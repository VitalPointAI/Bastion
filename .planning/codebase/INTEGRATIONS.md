# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**AI / LLM Providers:**
- Anthropic Claude — primary LLM for all 19+ AI agents and Ironclaw sidecar
  - SDK: `@anthropic-ai/sdk` 0.71.2, `@langchain/anthropic` 1.3.10
  - Auth: `ANTHROPIC_API_KEY` (static) or `ANTHROPIC_OAUTH_TOKEN` (OAuth 2025-04-20 beta)
  - OAuth auto-refresh: `backend/src/auth/oauth-token-refresh.ts` — refreshes 5 min before expiry, writes token to shared Docker volume `/shared/tokens/anthropic-oauth-token` for Ironclaw pickup
  - Default model: `claude-sonnet-4-6`
  - Used by: LangGraph agents (`backend/src/agents/langgraph/llm-factory.ts`), Ironclaw sidecar, strategic analysis
- OpenAI — secondary LLM provider (configurable per-agent)
  - SDK: `openai` 6.16.0, `@langchain/openai` 1.2.2
  - Auth: `OPENAI_API_KEY`
  - Also used for Azure OpenAI (`AZURE_OPENAI_*`) and NEAR AI (`https://api.near.ai/v1`) via OpenAI-compatible API
- Ollama — local LLM fallback (OpenAI-compatible, `http://localhost:11434/v1`)
  - No API key required; configured via `baseUrl` in agent config

**OSINT Intelligence:**
- RSS/Atom feeds — polled by `backend/src/osint/feed-poller.ts` on configurable intervals
  - Library: `rss-parser` 3.13.0
  - Feed configs stored in PostgreSQL (`osint_feed_poll_state` table)
  - Items auto-ingested into Neo4j knowledge graph and COP layers
- Tavily Search API — paid web search fallback
  - Auth: `TAVILY_API_KEY`
  - Used by: `backend/src/doc-intelligence/web-search.ts`

**GitHub Integration:**
- Octokit REST API (`@octokit/rest` 22.0.1) — agent-initiated PRs, CI status, deployment monitoring
  - Auth: `GITHUB_TOKEN` (env var)
  - Client: `backend/src/ironclaw/github-service.ts`
  - Used by Ironclaw agent for automated code changes and emergency revert flows
- Octokit Webhooks (`@octokit/webhooks` 14.2.0) — inbound GitHub webhook events
  - Endpoint: `backend/src/api/osint-webhook.ts`

**Email:**
- AWS SES (`@aws-sdk/client-ses` 3.980.0) — transactional email
  - Auth: AWS credentials via environment
  - Used for: notifications (configured but specific usage in auth/notification flows)

## Data Storage

**Databases:**
- PostgreSQL 16 with TimescaleDB extension (primary operational DB)
  - Container: `timescale/timescaledb:latest-pg16`
  - Connection: `DATABASE_URL` env var (connection string)
  - Client: `pg` 8.16.3 pool (max 20, `backend/src/lib/database.ts`)
  - Job queue: `pg-boss` 12.5.4 singleton (`backend/src/lib/database.ts:getSharedBoss`)
  - LangGraph checkpoints: isolated schema `langgraph_checkpoints` (via `@langchain/langgraph-checkpoint-postgres`)
  - Init scripts: `backend/database/init.sql`, `backend/database/schema.sql`
  - Migrations: `backend/src/db/migrations/` — run via `backend/src/db/migration-runner.ts` at startup
  - Tables include: `documents`, `outbox` (transactional outbox for blockchain), `anon_users`, `anon_sessions`, `osint_feed_poll_state`, `brain_annotations`, `brain_snapshots`, `strategic_documents`, plus all operational tables

- Neo4j 2025 Community Edition (knowledge/brain graph)
  - Container: `neo4j:2025-community` with APOC plugin
  - Connection: `NEO4J_URI` (bolt protocol), `NEO4J_USER`, `NEO4J_PASSWORD`
  - Client: `neo4j-driver` 6.0.1 (pool 50 connections, `backend/src/graph/neo4j-client.ts`)
  - Schemas: RAFT graph schema initialized at startup (`backend/src/graph/raft/schema-init.ts`)
  - Used for: knowledge brain graph, OSINT entity relationships, problem-set intelligence, RAFT (Reasoning and Fact Tracking) network

- PostgreSQL 16 with pgvector extension (Ironclaw AI agent memory)
  - Container: `pgvector/pgvector:pg16` — ISOLATED on `ironclaw-network` (no backend direct access)
  - Connection: internal Docker network only (`ironclaw-postgres:5432`)
  - Used exclusively by: Ironclaw sidecar agent for vector embeddings and memory

- SQLite via `better-sqlite3` 11.7.0 (edge device offline storage)
  - Location: `edge-device/` — offline-first sync for DDIL environments
  - Syncs to backend via `backend/src/api/edge-sync.ts`

**File Storage:**
- Pinata IPFS — encrypted document pinning
  - SDK: `pinata` 2.5.2 (frontend), direct axios (backend `backend/src/lib/ipfs.ts`)
  - Auth: `PINATA_JWT` (upload), `PINATA_GATEWAY` (retrieval)
  - API: `https://uploads.pinata.cloud/v3/files` (Pinata V3)
  - Used for: encrypted document CIDs in the transactional outbox → NEAR chain anchoring

**Caching:**
- In-process LangGraph checkpointer pool (PostgreSQL-backed)
- LLM instance cache (10-minute TTL, `backend/src/agents/langgraph/llm-factory.ts`)
- No Redis or external cache service

## Authentication & Identity

**Primary Auth:**
- `@vitalpoint/near-phantom-auth` 0.5.2 (backend) / 0.4.2 (frontend) — anonymous NEAR + WebAuthn passkey authentication
  - Implementation: `createAnonAuth()` in `backend/src/index.ts`
  - Passkey (WebAuthn/FIDO2) registration and authentication
  - NEAR account creation on registration (implicit accounts, Ed25519)
  - Session storage: PostgreSQL (`anon_users`, `anon_sessions` tables)
  - Single-session enforcement: all prior sessions invalidated on new login
  - Recovery: Pinata IPFS (`ipfs.pinningService: 'pinata'`, `PINATA_API_KEY`, `PINATA_API_SECRET`)
  - Relying party: `Bastion` — `localhost` in dev, `APP_URL` hostname in production

**NEAR Account Funding:**
- Auto-funds new implicit accounts with 0.1 NEAR on registration
  - Service: `backend/src/auth/funding-service.ts`
  - Funder: `NEAR_FUNDER_ACCOUNT_ID` / `NEAR_FUNDER_PRIVATE_KEY`
  - RPC: `NEAR_RPC_URL` (default: `https://rpc.testnet.fastnear.com`)

**Decentralized Identity (DID):**
- `did:near:` method — DIDs anchored to NEAR blockchain
  - Service: `backend/src/identity/did-service.ts`
  - Contract: `DID_CONTRACT_ID` (default: `did.bastion.testnet`)
  - Blinded keys: `backend/src/identity/blinded-keys.ts`

**W3C Verifiable Credentials:**
- `@veramo/credential-w3c` 6.0.0 — VC issuance (Security Clearance, Role Assignment, Coalition Membership, Entity Attributes)
  - Service: `backend/src/credentials/credential-service.ts`
  - Contract: `CREDENTIAL_CONTRACT_ID` (default: `credentials.bastion.testnet`)

**Authorization:**
- Casbin 5.48.0 — RBAC/ABAC policy enforcement
- `requireAuth` middleware from `backend/src/auth/auth-instance.ts` — applied to sensitive routes

## Blockchain (NEAR Protocol)

**Network:**
- NEAR Protocol (testnet in dev / mainnet in prod)
  - RPC: `NEAR_RPC_URL` (default: `https://rpc.testnet.fastnear.com`)
  - Client libraries: `@near-js/accounts`, `@near-js/providers`, `@near-js/crypto`, `@near-js/signers`, `@near-js/keystores`

**Smart Contracts (Rust/WASM, `near-contracts/`):**
- `did.bastion.testnet` — DID registry contract (`near-contracts/src/did_registry.rs`)
- `credentials.bastion.testnet` — Credential registry (`near-contracts/src/credential_registry.rs`)
- `funding.bastion.testnet` — Account funding contract (`near-contracts/src/funding.rs`)
- DAO contract — coalition governance proposals and voting (`near-contracts/src/dao/`)
- MDMP contract — Military Decision-Making Process on-chain (`near-contracts/src/mdmp/`)
- Privacy contract — encrypted data handling (`near-contracts/src/privacy.rs`)
- Chain signatures / intents (`near-contracts/src/chain_signatures.rs`, `near-contracts/src/intents.rs`)

**Key Management:**
- User-derived signing keys: HKDF from DID secret → Ed25519 implicit accounts (`backend/src/near/tx-signer.ts`)
- MPC Chain Signatures: `backend/src/lib/mpc-accounts.ts` — threshold MPC via NEAR network
- Post-quantum hybrid keys: ML-KEM-768 + X25519 (`backend/src/crypto/pq-kem.ts`)

**Blockchain Sync:**
- Transactional outbox pattern: PostgreSQL `outbox` table → worker writes to NEAR chain (`backend/src/lib/blockchain-sync.ts`)
- Event polling: NEP-297 standard events from NEAR RPC (`backend/src/lib/near-events.ts`)
- Audit anchoring: Merkle-root batch anchoring of action audit trail (`backend/src/ironclaw/audit-anchor-service.ts`)

## AI Agent Architecture

**LangGraph Agents (19+ roles, `backend/src/agents/`):**
- Adversary modeler, assumption auditor, COG analysis, deception planner/detector, escalation modeler, effect cascader, exploitation analyst, LOE gap analysis, narrative synthesis, problem framing, ROE compliance, uncertainty quantifier, orders validator, character builder, data bias detector
- All use `createLLMForAgent()` from `backend/src/agents/langgraph/llm-factory.ts`
- Configurable per-agent: provider (anthropic/openai/azure-openai/near-ai/local), model, temperature, maxTokens
- LangGraph state persisted in PostgreSQL (`langgraph_checkpoints` schema)

**Ironclaw Agent Sidecar:**
- Rust-based NEAR AI agent (`ironclaw/Dockerfile`, image: `ghcr.io/vitalpointai/bastion/ironclaw:latest`)
- Runs on isolated `ironclaw-network` — can only reach backend
- Communication: HTTP webhook channel on port 8080, POST `/webhook` with shared secret
- Client: `backend/src/ironclaw/ironclaw-client.ts`
- LLM: Anthropic Claude (OAuth or API key, env `LLM_BACKEND=anthropic`)
- Memory: pgvector (its own isolated Postgres)
- Thread continuity: `thread_id` keyed by problem set or global user scope
- Tools: GitHub integration, brain graph queries, blockchain anchoring

**31 JPP Staff Roles (`backend/src/jpp/`):**
- Joint Planning Process staff role definitions
- OSINT feed management (`backend/src/jpp/osint-feed-store.ts`)

**AI Workspace:**
- Initialized via `initAIWorkspace()` in `backend/src/api/exercise.ts`
- Uses PgBoss + PostgresSaver for background AI processing jobs

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Datadog, etc.)

**Logs:**
- `console.log`/`console.error` to stdout — captured by Docker logging driver
- Structured log messages with `[Module]` prefixes throughout backend
- LangGraph execution traces: `backend/src/orchestration/observability.ts` (custom tracer to PostgreSQL)
- OSINT feed error tracking: per-feed `last_error` column in `osint_feed_poll_state`

## CI/CD & Deployment

**Hosting:**
- Docker Compose on bare-metal/VM host
- nginx (host-level) terminates TLS at port 443, proxies to Docker frontend container port 8080

**CI Pipeline:**
- GitHub Actions (implied by `@octokit/webhooks` and `GITHUB_TOKEN` usage)
- Built images pushed to GHCR: `ghcr.io/vitalpointai/bastion/{backend,frontend,ironclaw}:latest`

## Hardware / Physical Device Integrations

**TAK / Cursor-on-Target:**
- `@tak-ps/node-cot` 12.3.0 — parses CoT XML from TAK clients
  - TCP port 8087 (TAK Server streaming)
  - UDP port 6969 (multicast SA broadcast)
  - Scanner: `backend/src/discovery/scanners/tak-scanner.ts`

**Bluetooth Low Energy:**
- `@stoprocent/noble` 1.15.1 — BLE peripheral discovery
  - Scanner: `backend/src/discovery/scanners/ble-scanner.ts`
  - Graceful degradation when hardware unavailable

**USB/Serial:**
- `serialport` 12.0.0 — USB/serial port enumeration
  - Scanner: `backend/src/discovery/scanners/usb-scanner.ts`

**mDNS/Bonjour:**
- `bonjour-service` 1.3.0 + `multicast-dns` 7.2.5
  - Scanner: `backend/src/discovery/scanners/mdns-scanner.ts`
  - Bridge agent: `bridge/mdns_advertise.py`

**SSDP/UPnP:**
- `node-ssdp` 4.0.1 — UPnP device discovery

**Robot / Swarm (Sphero RVR):**
- BLE-based robot control via `bridge/ble_rvr_driver.py`
  - Bridge: Python FastAPI agent (`bridge/`) relays commands over WebSocket to backend
  - Backend: `backend/src/robot/` — mission orchestration, swarm bridge, vision COP pipeline
  - WebSocket endpoint: `/ws/robot` (backend) and `/ws/bridge` (bridge device)

**EM Spectrum:**
- `backend/src/discovery/em-spectrum/` — electromagnetic spectrum sensing integration

## Real-Time Collaboration

**CRDT Sync (Yjs):**
- `yjs` 13.6.29 + `y-websocket` 3.0.0 — real-time collaborative document editing
  - Server: `backend/src/collaboration/sync-server.ts`
  - WebSocket endpoint: `/ws/collab`

**WebSocket Channels (backend):**
- `/ws/messages` — inter-agent and user messaging
- `/ws/orchestration/:id` — agent execution streaming
- `/ws/collab` — Yjs CRDT collaborative editing
- `/ws/resources` — resource registry live updates
- `/ws/discovery` — device discovery event streaming
- `/ws/inheritance` — problem-set strategic inheritance updates
- `/ws/robot` — robot command/status
- `/ws/bridge` — Python bridge device relay

## Self-Hosted Services

**SearXNG:**
- Self-hosted meta-search engine (`searxng/settings.yml`)
- Internal only: `http://searxng:8888` on `bastion-network`
- Env: `SEARXNG_URL`
- Used by: `backend/src/doc-intelligence/web-search.ts` (priority 1 over Tavily)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/osint` — OSINT webhook for external push intelligence
  - Handler: `backend/src/api/osint-webhook.ts`
- GitHub webhooks — `@octokit/webhooks` 14.2.0 for CI/deployment event handling

**Outgoing:**
- NEAR RPC — contract calls via `https://rpc.testnet.fastnear.com` (or configurable `NEAR_RPC_URL`)
- Anthropic API — `https://api.anthropic.com` (LangGraph agents + Ironclaw)
- Pinata uploads — `https://uploads.pinata.cloud/v3/files`
- Pinata gateway — `PINATA_GATEWAY` env (configurable CDN endpoint)
- GitHub API — via Octokit for agent-driven PRs and CI status
- Tavily Search — `TAVILY_API_KEY` (fallback web search)
- AWS SES — transactional email

## Environment Configuration

**Required env vars (backend):**
- `DATABASE_URL` — PostgreSQL connection string
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` — Neo4j connection
- `SESSION_SECRET` — session signing secret
- `NEAR_NETWORK` — `testnet` | `mainnet`
- `NEAR_RPC_URL` — NEAR RPC endpoint
- `DID_CONTRACT_ID` — NEAR DID registry contract
- `CREDENTIAL_CONTRACT_ID` — NEAR credential registry contract
- `NEAR_FUNDER_ACCOUNT_ID`, `NEAR_FUNDER_PRIVATE_KEY` — account funding
- `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH_TOKEN` — LLM access
- `PINATA_JWT`, `PINATA_GATEWAY` — IPFS storage
- `PINATA_API_KEY`, `PINATA_API_SECRET` — auth recovery IPFS
- `IRONCLAW_URL`, `IRONCLAW_SHARED_SECRET` — AI agent sidecar
- `SEARXNG_URL` — self-hosted search (`http://searxng:8888` in Docker)
- `GITHUB_TOKEN` — GitHub API access
- `APP_URL` — production origin for CORS and WebAuthn RP

**Optional env vars:**
- `OPENAI_API_KEY` — OpenAI fallback
- `TAVILY_API_KEY` — web search fallback
- `TOKEN_SYNC_PATH` — path to OAuth token file for Ironclaw (default: `/shared/tokens/anthropic-oauth-token`)

**Secrets location:**
- `backend/.env` (gitignored) in development
- `.env.prod` (gitignored) in production, loaded by `docker-compose.prod.yml`

---

*Integration audit: 2026-03-18*
