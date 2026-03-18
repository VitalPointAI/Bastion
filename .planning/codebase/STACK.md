# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript 5.9 - Frontend (React), Backend (Express API), Edge device
- Rust 1.85 - NEAR smart contracts (compiled to WASM via cargo-near)

**Secondary:**
- Python 3.x - Bridge device agent (`bridge/`) using FastAPI/uvicorn
- JavaScript - Some compiled `.js` outputs co-located with `.ts` sources in `backend/src/`

## Runtime

**Environment:**
- Node.js 18+ (native fetch required) — backend and frontend build
- Rust toolchain 1.85.1 — NEAR contract compilation via cargo-near

**Package Manager:**
- pnpm 10.14.0 (backend `packageManager` field)
- npm/pnpm used for frontend and edge-device
- Lockfiles present in `frontend/`, `backend/`, `edge-device/`

## Frameworks

**Core Backend:**
- Express 5.2.1 (`backend/src/index.ts`) — HTTP API server with 40+ route modules
- ws 8.19.0 — WebSocket server (8 named WS endpoints: messages, orchestration, collab, resources, discovery, inheritance, robot, bridge)

**Core Frontend:**
- React 19.2.0 — UI framework
- React Router DOM 7.0.0 — client-side routing
- Tailwind CSS 4.2.1 (via `@tailwindcss/vite`) — utility-first styling

**AI/LLM Orchestration:**
- LangChain/LangGraph 1.1.0 (`@langchain/langgraph`) — multi-agent graph execution
- `@langchain/anthropic` 1.3.10 — Anthropic Claude integration
- `@langchain/openai` 1.2.2 — OpenAI and OpenAI-compatible endpoints
- `@langchain/langgraph-checkpoint-postgres` 1.0.0 — LangGraph state persistence to PostgreSQL
- `@anthropic-ai/sdk` 0.71.2 — Direct Anthropic SDK (used in LLM factory and raw calls)
- `openai` 6.16.0 — Direct OpenAI SDK
- `@instructor-ai/instructor` 1.7.0 — Structured LLM output with Zod schemas
- `xstate` 5.25.1 — State machine for agent workflows

**Build/Dev:**
- Vite 7.2.4 + `@vitejs/plugin-react` — frontend bundler with hot reload
- tsx 4.21.0 — TypeScript execution for dev (`tsx watch src/index.ts`)
- TypeScript compiler (tsc) — production builds for backend and edge-device

**Testing:**
- Vitest 4.0.16/4.0.17 — test runner (both frontend and backend)
- `@testing-library/react` 16.3.2 — React component testing
- jsdom 29.0.0 — DOM environment for frontend tests

## Key Dependencies

**Critical Backend:**
- `pg` 8.16.3 — PostgreSQL client (pool in `backend/src/lib/database.ts`, max 20 connections)
- `pg-boss` 12.5.4 — PostgreSQL-backed job queue (used for blockchain sync, cache refresh, validation)
- `neo4j-driver` 6.0.1 — Neo4j graph database client (pool 50 connections, `backend/src/graph/neo4j-client.ts`)
- `@vitalpoint/near-phantom-auth` 0.5.2 — NEAR + WebAuthn anonymous authentication library
- `@near-js/accounts` / `@near-js/providers` / `@near-js/signers` / `@near-js/crypto` / `@near-js/keystores` 2.5.x — NEAR Protocol client libraries for on-chain operations
- `casbin` 5.48.0 — Authorization/RBAC policy enforcement
- `yjs` 13.6.29 + `y-websocket` 3.0.0 + `y-protocols` 1.0.7 — CRDTs for real-time collaborative editing (`backend/src/collaboration/`)
- `json-rules-engine` 7.3.1 — Rule evaluation for decision gates

**Cryptography:**
- `@noble/ciphers` 2.1.1 — Symmetric encryption (AES-GCM, ChaCha20)
- `@noble/hashes` 2.0.1 — SHA-256, HKDF, HMAC
- `@noble/curves` 2.0.1 — Ed25519, X25519 elliptic curves
- `@noble/post-quantum` 0.5.4 — ML-KEM-768 post-quantum KEM (`backend/src/crypto/pq-kem.ts`)
- `@veramo/credential-w3c` 6.0.0 — W3C Verifiable Credentials issuance/verification

**File Processing:**
- `multer` 2.0.2 — Multipart file upload handling (50MB limit)
- `unpdf` 1.4.0 — PDF text extraction
- `officeparser` 6.0.4 — DOCX/PPTX/XLSX parsing
- `pdfkit` 0.17.2 + `pdf-lib` 1.17.1 — PDF generation
- `docx` 9.5.1 — DOCX document generation
- `pptxgenjs` 4.0.1 — PPTX generation

**Discovery / Hardware:**
- `@stoprocent/noble` 1.15.1 — Bluetooth Low Energy scanning
- `serialport` 12.0.0 — USB/serial port enumeration
- `@tak-ps/node-cot` 12.3.0 — TAK Cursor-on-Target (CoT) XML parsing
- `bonjour-service` 1.3.0 — mDNS/Bonjour service discovery
- `multicast-dns` 7.2.5 — mDNS scanner
- `node-ssdp` 4.0.1 — SSDP (UPnP) device discovery

**Intelligence/OSINT:**
- `rss-parser` 3.13.0 — RSS/Atom feed polling (`backend/src/osint/feed-poller.ts`)
- `axios` 1.13.2 — HTTP client (Pinata IPFS uploads, general requests)

**Blockchain/NEAR:**
- `near-sdk` 5.9 (Rust) — NEAR smart contract SDK (contracts in `near-contracts/`)
- `borsh` 1.6 (Rust) — Binary serialization for NEAR contracts

**Frontend Visualization:**
- `leaflet` 1.9.4 + `react-leaflet` 5.0.0 + `leaflet-draw` 1.0.4 + `leaflet-realtime` 2.2.0 — COP map with drawing tools and real-time updates
- `milsymbol` 3.0.3 — NATO/APP-6 military symbol rendering (frontend and backend)
- `react-force-graph-2d` / `react-force-graph-3d` 1.29.x — 2D/3D knowledge graph visualization
- `three` 0.183.2 — WebGL 3D rendering (used by force-graph-3d)
- `react-d3-tree` 3.6.6 — Tree/hierarchy visualizations
- `recharts` 3.8.0 — Charts and analytics
- `gantt-task-react` 0.3.9 — Gantt chart for campaign timeline
- `react-organizational-chart` 2.2.1 — Org chart for command structure
- `@tanstack/react-table` 8.21.3 — Headless data table
- `@dnd-kit/core` / `@dnd-kit/sortable` — Drag-and-drop interactions
- `react-complex-tree` 2.6.1 — Hierarchical tree component
- `react-hook-form` 7.71.1 + `@hookform/resolvers` 5.2.2 + `zod` 4.3.5 — Form handling with schema validation

**Validation/Schema:**
- `zod` 4.3.5 — Schema validation (frontend and backend)
- `zod-to-json-schema` 3.25.1 — Convert Zod schemas for LLM structured output
- `dompurify` 3.3.2 — HTML sanitization (frontend and backend via jsdom)

**Document Export:**
- `qrcode` 1.5.4 — QR code generation

**Utilities:**
- `uuid` 13.0.0 — UUID generation
- `dotenv` 17.2.3 — Environment variable loading
- `cors` 2.8.5 — CORS middleware
- `string-comparison` 1.3.0 — Fuzzy string matching
- `lib0` 0.2.117 — Low-level utilities (Yjs ecosystem)

**Edge Device (`edge-device/`):**
- `better-sqlite3` 11.7.0 — Offline-first local SQLite storage for DDIL environments
- `axios` 1.7.9 — HTTP sync to backend

**Bridge Agent (`bridge/`):**
- FastAPI — Python web framework
- uvicorn — ASGI server
- zeroconf — mDNS advertising
- websockets — WebSocket relay
- pydantic 2.0 — Data validation

**Frontend Auth:**
- `@vitalpoint/near-phantom-auth` 0.4.2 — NEAR account authentication
- `pinata` 2.5.2 — IPFS pinning SDK (frontend recovery flows)

## Configuration

**Environment:**
- Backend: `backend/.env` (loaded via `dotenv`)
- Frontend: `frontend/.env.local` (Vite `VITE_` prefix convention)
- Production: `.env.prod` for docker-compose.prod.yml
- Key required vars: `DATABASE_URL`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `SESSION_SECRET`, `NEAR_NETWORK`, `IRONCLAW_URL`, `IRONCLAW_SHARED_SECRET`, `SEARXNG_URL`, `PINATA_JWT`, `PINATA_GATEWAY`, `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH_TOKEN`
- NEAR contracts: `DID_CONTRACT_ID`, `CREDENTIAL_CONTRACT_ID`, `NEAR_RPC_URL`, `NEAR_FUNDER_ACCOUNT_ID`, `NEAR_FUNDER_PRIVATE_KEY`

**Build:**
- `frontend/vite.config.ts` — Vite config with API/WS proxy to backend, jsdom test env
- `backend/tsconfig.json` — TypeScript for Node.js ESM
- `near-contracts/Cargo.toml` — Rust workspace for WASM contract compilation
- `docker-compose.yml` — Development stack
- `docker-compose.prod.yml` — Production stack (GHCR images)

## Platform Requirements

**Development:**
- Docker + Docker Compose (runs postgres, neo4j, ironclaw, searxng, backend, frontend)
- Node.js 18+ (native fetch for backend)
- pnpm 10.14.0
- Rust + cargo-near (for contract compilation)
- Python 3.x + pip (bridge device)

**Production:**
- Docker host with Docker Compose
- Images from GHCR (`ghcr.io/vitalpointai/bastion/{backend,frontend,ironclaw}:latest`)
- nginx reverse proxy (host-level, `nginx/nginx.prod.conf`) terminates TLS, forwards to container port 8080
- TimescaleDB postgres container on `bastion-network` (not exposed to host)
- Neo4j 2025 Community Edition (APOC plugin required)
- Separate `ironclaw-network` Docker bridge isolating the AI agent from databases

---

*Stack analysis: 2026-03-18*
