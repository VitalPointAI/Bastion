# System Architecture

BASTION uses a layered architecture designed for security, verifiability, and AI-driven planning support.

---

## Storage: Three-Tier Model

| Tier | Technology | Purpose |
|---|---|---|
| Fast queries | PostgreSQL | Relational data, full-text search, operational state |
| Verification | NEAR Protocol (testnet) | On-chain audit trail, DAO governance, smart contracts |
| Large files | IPFS | Document storage, intelligence products, media |

PostgreSQL serves as the primary datastore for all operational data. NEAR blockchain records governance decisions, resource provenance, and planning approvals as an immutable audit trail. IPFS handles large binary objects that exceed practical on-chain storage limits.

---

## Authentication

BASTION uses **WebAuthn passkeys with the PRF extension** for passwordless authentication. The PRF (Pseudo-Random Function) extension derives a deterministic secret from each passkey, which is used to generate a **NEAR implicit account** for the user. This eliminates seed phrases while binding each user's blockchain identity to their hardware authenticator.

Key flow:

1. User registers a WebAuthn passkey (platform or roaming authenticator)
2. PRF extension derives a stable secret from the credential
3. Secret generates a NEAR Ed25519 keypair and implicit account
4. Session keys provide short-lived access without repeated biometric prompts

---

## AI Orchestration

| Component | Role |
|---|---|
| LangGraph | Agent workflow graphs, state management, checkpointing |
| LangChain | Tool integration, prompt management, retrieval chains |
| Per-agent model config | Each of the 131 agents can target a different LLM provider/model |

Agents are organized into specialized teams (J1 through J9 staff sections) with a registry that maps each agent to its role, tools, and model configuration. LangGraph manages multi-step workflows such as COA development, wargaming, and assessment cycles.

---

## Graph Database

**Neo4j 2025 Community Edition** stores RAFT (Relationships, Actors, Functions, Tensions) analysis graphs. Document ingestion pipelines extract entities and relationships, building a knowledge graph that AI agents query during planning.

---

## Frontend

| Technology | Version |
|---|---|
| React | 19 |
| Vite | Build tooling |
| TypeScript | 5.9 |

The frontend implements the six doctrinal tabs, a global chat interface for AI agent interaction, and real-time COP visualization.

---

## Backend

| Technology | Details |
|---|---|
| Runtime | Node.js with Express |
| Language | TypeScript |
| Message bus | pg-boss (PostgreSQL-backed job queue with ABAC filtering) |

pg-boss handles asynchronous task distribution with attribute-based access control (ABAC) filtering, ensuring agents and users only receive messages matching their clearance and role.

---

## Container Deployment

Docker Compose orchestrates all services with healthcheck-based dependency ordering:

```
PostgreSQL -> Backend API -> Frontend
     |
     +-> Neo4j
     +-> pg-boss workers
```

Services only start after their dependencies report healthy, preventing race conditions during cold starts.

---

## Trusted Execution Environment

**Phala Network** provides TEE (Trusted Execution Environment) capabilities for processing classified or sensitive data. Computations run inside Intel SGX enclaves, ensuring that neither the host operator nor external parties can access plaintext data during processing.

---

## Smart Contracts

12 Rust smart contract modules deployed on NEAR Protocol testnet handle:

- DAO proposal creation and voting
- Multi-tier authority delegation
- Resource registry and DID management
- Coalition membership and permissions
- Planning product approval workflows
