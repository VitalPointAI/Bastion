---
phase: 01-foundation-infrastructure
plan: 07
type: execute
---

<objective>
Containerize Phala components and establish Docker-based development workflow for reproducible, isolated infrastructure.

Purpose: Enable consistent development environments across team members and prepare for future production deployment patterns.
Output: Docker containers for Phala backend, docker-compose orchestration for development, documented development workflow.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
./summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation-infrastructure/1-RESEARCH.md
@.planning/phases/01-foundation-infrastructure/1-CONTEXT.md
@.planning/phases/01-foundation-infrastructure/1-01-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-02-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-03-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-04-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-05-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-06-SUMMARY.md

**Tech stack available:**
- Complete NEAR smart contract infrastructure
- React frontend with Privy, Chain Signatures, Intents
- IPFS encrypted storage
- Phala TEE with NEAR integration
- Complete blockchain abstraction

**Established patterns:**
- State versioning and testing with workspaces-rs
- Client-side encryption and content addressing
- Transparent privacy routing
- Intent-based transactions
- Zero blockchain UX

**From RESEARCH.md:**
- DevPHAse provides docker-compose configuration for local TEE
- Phala backend runs in Docker containers in production
- Service-oriented architecture: frontend, backend, NEAR nodes, Phala nodes
- Don't hand-roll: container orchestration platforms (use docker-compose for dev, defer K8s to production), TEE container configuration (use DevPHAse/Phala Cloud patterns)

**From CONTEXT.md:**
- "Components may be containerized" in Phase 1
- Comprehensive orchestration comes later
- Focus on Phala components (required for TEE)
- Use docker-compose for development workflow
- Out of scope: production deployment patterns, K8s orchestration, full stack containerization
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Dockerfile for Phala backend</name>
  <files>phala-backend/Dockerfile, phala-backend/.dockerignore</files>
  <action>
    Containerize Phala backend components for consistent development and deployment:

    1. Create phala-backend/Dockerfile:
       - Base image: rust:1.75 (or latest stable) for Rust compilation
       - Install cargo-contract and dependencies
       - Install Node.js for DevPHAse (multi-stage build)
       - Copy contract source files
       - Build Phat Contracts: cargo contract build --release
       - Final stage: node:20-slim for runtime
       - Copy built artifacts and DevPHAse configuration
       - Expose ports: 8000 (Phala node), 9944 (WS endpoint)
       - CMD: Start DevPHAse stack

    2. Multi-stage build optimization:
       - Stage 1 (builder): Compile contracts in Rust image
       - Stage 2 (runtime): Lightweight Node.js image with artifacts
       - Reduces final image size significantly

    3. Create phala-backend/.dockerignore:
       - node_modules/
       - target/
       - .devphase/
       - .git/
       - *.log

    Use multi-stage builds to minimize final image size (builder stage large, runtime small).
    Pin specific versions for reproducibility (rust:1.75, node:20-slim).
    Layer caching optimization: copy package.json first, install deps, then copy source.

    Don't hand-roll: Rust toolchain installation (use official rust image), Node.js setup (use official node image), DevPHAse initialization (use existing scripts).
  </action>
  <verify>
    - docker build -t phala-backend:dev phala-backend/ succeeds
    - Image size reasonable (<2GB final stage)
    - Can inspect image layers: docker history phala-backend:dev
    - No sensitive files in image (check .dockerignore working)
  </verify>
  <done>Dockerfile created with multi-stage build, Phala backend containerized, .dockerignore configured, image builds successfully</done>
</task>

<task type="auto">
  <name>Task 2: Create docker-compose for development environment</name>
  <files>docker-compose.yml, .env.example, README.md</files>
  <action>
    Set up docker-compose orchestration for complete development stack:

    1. Create docker-compose.yml with services:
       - phala-backend:
         * build: ./phala-backend
         * ports: "8000:8000", "9944:9944"
         * environment: PHALA_NODE_MODE=dev
         * volumes: ./phala-backend:/app (for hot reload if supported)
         * healthcheck: curl localhost:8000/health
         * networks: ssr-network

       - frontend:
         * build: ./frontend
         * ports: "5173:5173"
         * environment: VITE_PHALA_ENDPOINT=http://phala-backend:8000
         * environment: VITE_NEAR_RPC=https://rpc.testnet.near.org
         * volumes: ./frontend:/app, /app/node_modules
         * depends_on: phala-backend (healthcheck)
         * networks: ssr-network

    2. Define custom network:
       - networks:
           ssr-network:
             driver: bridge

    3. Create .env.example with:
       - VITE_PRIVY_APP_ID=your_privy_app_id
       - VITE_WEB3STORAGE_TOKEN=your_web3storage_token
       - VITE_NEAR_NETWORK=testnet
       - VITE_PHALA_ENDPOINT=http://localhost:8000
       - Instructions to copy to .env.local

    4. Update README.md with:
       - Prerequisites: Docker, Docker Compose
       - Quick start:
         * Copy .env.example to .env.local, fill values
         * docker-compose up -d
         * Visit http://localhost:5173
       - Development workflow:
         * Logs: docker-compose logs -f
         * Rebuild: docker-compose up --build
         * Stop: docker-compose down
         * Clean: docker-compose down -v (removes volumes)
       - Troubleshooting section

    Use healthchecks to ensure services start in correct order (phala-backend before frontend).
    Named volumes for persistence where needed.
    Bridge network for inter-service communication.

    Don't hand-roll: service discovery (use docker-compose service names), load balancing (not needed for dev), complex orchestration (defer to production).

    Note: NEAR smart contracts deployed separately via near-cli-rs (not containerized in Phase 1). Focus on Phala components per context guidance.
  </action>
  <verify>
    - docker-compose config validates (no syntax errors)
    - docker-compose up -d starts all services
    - docker-compose ps shows services healthy
    - Frontend accessible at http://localhost:5173
    - Phala backend accessible at http://localhost:8000
    - Services can communicate (frontend → phala-backend)
    - docker-compose down stops cleanly
  </verify>
  <done>docker-compose.yml created, services orchestrated correctly, healthchecks working, development workflow documented in README.md, environment variables templated</done>
</task>

<task type="auto">
  <name>Task 3: Document complete development workflow</name>
  <files>DEVELOPMENT.md, near-contracts/README.md, phala-backend/README.md, frontend/README.md</files>
  <action>
    Create comprehensive development documentation for team onboarding:

    1. Create DEVELOPMENT.md at project root:
       - Architecture overview:
         * Component diagram (frontend, NEAR contracts, Phala TEE, IPFS)
         * Data flow diagrams (auth, privacy routing, storage)
         * Technology stack summary

       - Development environment setup:
         * Prerequisites (Docker, Rust, Node.js, pnpm)
         * Initial setup steps:
           - Clone repository
           - Copy .env.example → .env.local
           - Fill in API keys (Privy, Web3.Storage)
           - Run docker-compose up -d
           - Deploy NEAR contracts (commands)
           - Verify all services running

       - Common development tasks:
         * Developing NEAR contracts (build, test, deploy)
         * Developing Phala contracts (build, deploy to DevPHAse)
         * Frontend development (hot reload with Vite)
         * Running tests (unit, integration)
         * Viewing logs (docker-compose logs)

       - Troubleshooting guide:
         * Service won't start (check ports, logs)
         * Contract deployment fails (gas, account issues)
         * Phala attestation errors (DevPHAse limitations)
         * Frontend can't connect to backend (network, CORS)

    2. Create near-contracts/README.md:
       - Build commands: cargo near build
       - Test commands: cargo test
       - Deployment: near contract deploy [account-id] --wasm target/wasm/contract.wasm
       - Testing with workspaces-rs
       - State migration procedure

    3. Create phala-backend/README.md:
       - DevPHAse local development
       - Contract compilation: cargo contract build
       - Deployment to local TEE
       - Attestation verification notes
       - Limitations of DevPHAse vs Phala Cloud

    4. Create frontend/README.md:
       - Vite dev server: pnpm dev
       - Build: pnpm build
       - Privy authentication setup
       - Environment variables
       - UI component structure

    Documentation should enable new developer to:
    - Clone repo
    - Follow README
    - Have working environment in <30 minutes
    - Understand architecture
    - Make first contribution

    Include diagrams where helpful (ASCII art acceptable, tools like mermaid optional).
    Link to official docs (NEAR, Phala, Privy, etc.) for deep dives.

    Don't hand-roll: architecture visualization tools (ASCII or simple markdown sufficient for v1), complex diagrams (defer to future if needed).
  </action>
  <verify>
    - All README files exist and have substantial content
    - DEVELOPMENT.md covers full setup workflow
    - Component-specific READMEs have build/test/deploy instructions
    - Documentation tested by following steps (self-verification)
    - No broken links to external resources
  </verify>
  <done>Comprehensive development documentation created, setup workflow documented, troubleshooting guide included, component-specific READMEs complete, ready for team onboarding</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] docker build succeeds for Phala backend
- [ ] docker-compose up starts all services
- [ ] All services healthy and communicating
- [ ] Development workflow documented and tested
- [ ] README files complete and accurate
- [ ] New developer can setup environment following docs
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from Docker builds
- docker-compose orchestration functional
- Complete development workflow documented
- Team can onboard using documentation alone
- Phase 1 foundation complete and operational
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-07-SUMMARY.md`:

# Phase 1 Plan 7: Containerization & Dev Environment Summary

**Dockerized development workflow with complete documentation enables team productivity and reproducible environments**

## Accomplishments

- Phala backend Dockerfile with multi-stage build
- docker-compose orchestration for development stack
- Service healthchecks and dependency management
- Complete development workflow documentation
- Component-specific README files
- Troubleshooting guides
- Environment variable templates
- Architecture and data flow documentation
- Team onboarding documentation

## Files Created/Modified

- `phala-backend/Dockerfile` - Multi-stage container build
- `phala-backend/.dockerignore` - Build context optimization
- `docker-compose.yml` - Development stack orchestration
- `.env.example` - Environment variable template
- `DEVELOPMENT.md` - Complete development workflow
- `README.md` - Quick start guide
- `near-contracts/README.md` - NEAR development docs
- `phala-backend/README.md` - Phala development docs
- `frontend/README.md` - Frontend development docs

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

**Phase 1 Complete!**

Foundation established with:
- NEAR smart contracts (Rust, state versioning, testing)
- React frontend (Vite, Privy auth, embedded wallets)
- IPFS storage (encrypted, content-addressed)
- Phala TEE (confidential computing, attestation)
- NEAR-Phala integration (privacy routing, AI context security)
- Chain Signatures (multi-chain control)
- NEAR Intents (transaction abstraction)
- Docker development environment
- Complete documentation

Ready for **Phase 2: Identity & Security Framework**
</output>
