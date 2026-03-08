# Getting Started (Local Development)

This guide covers setting up BASTION for local development.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker | 20+ | With Docker Compose v2 |
| Node.js | 20+ | Use `nvm` — system Node is often too old |
| Rust toolchain | Latest stable | For smart contract compilation |

## Clone the Repository

```bash
git clone https://github.com/VitalPointAI/Bastion.git
cd Bastion
```

## Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

- **LLM provider keys** — at least one of: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY` for AI agent functionality.
- **NEAR testnet** — `NEAR_NETWORK_ID=testnet` (default) and any contract-specific configuration.
- **Database credentials** — defaults work for local Docker, but can be customized.

## Start Services

```bash
docker-compose up
```

This starts:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | Vite dev server (React) |
| Backend | 3001 | Express API server |
| PostgreSQL | 5432 | Primary relational database |
| Neo4j | 7474 / 7687 | Graph database (RAFT entities) |

## Seed Data

Once services are running, seed the example scenario:

```bash
bash scripts/seed-scenario.sh
```

This populates the database with the Pacific Strategy AY26 exercise scenario including phases, documents, and initial conditions.

For graph data (RAFT entities and relationships):

```bash
bash scripts/seed-graph-data.sh
```

## Access the Application

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Neo4j Browser**: [http://localhost:7474](http://localhost:7474)

## NEAR Testnet Configuration

BASTION connects to NEAR testnet by default. No local NEAR node is required — the backend communicates with the public testnet RPC endpoint.

To use a custom NEAR configuration, update these `.env` values:

```
NEAR_NETWORK_ID=testnet
NEAR_NODE_URL=https://rpc.testnet.near.org
NEAR_WALLET_URL=https://testnet.mynearwallet.com
```

## Notes

- **Node.js version**: If using `nvm`, activate the correct version before running any scripts: `nvm use 20`.
- **Database migrations**: Migration SQL files are committed to the repository but must be executed on the target database after deploy. For local development, the seed scripts handle initial schema setup.
- **Production deployment**: Production deployment automation (Phase 17) is not yet implemented. This guide covers local development only.
