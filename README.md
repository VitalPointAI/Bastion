# BASTION

**Blockchain Autonomous Strategy & Tactical Intelligence Operational Network**

A secure platform combining NEAR blockchain, Phala TEE (Trusted Execution Environment), and decentralized storage for privacy-preserving operations.

## Key Features

- **Zero Blockchain UX**: Web2-style authentication, no crypto knowledge required
- **Privacy Routing**: Automatic classification-based data routing (Public → on-chain, Secret → TEE)
- **Decentralized Storage**: Encrypted IPFS storage with on-chain verification
- **Chain Signatures**: Multi-chain asset control via NEAR MPC
- **Offline-First**: Edge device sync for disconnected operations

## Quick Start

```bash
# Clone repository
git clone <repository-url>
cd ssr

# Configure environment
cp .env.example frontend/.env.local
cp backend/.env.example backend/.env
# Edit files with your API keys (Privy, Pinata)

# Start development environment
docker compose up -d

# Services available at:
# - Frontend: http://localhost:5173
# - Backend:  http://localhost:3001
# - Database: localhost:5432
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │
│   (React)    │     │  (Express)   │     │ TimescaleDB  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │             ┌──────────────┐     ┌──────────────┐
       │             │    IPFS      │     │    NEAR      │
       │             │  (Pinata)    │     │ (Blockchain) │
       │             └──────────────┘     └──────────────┘
       │                                        │
       ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│   Privy      │                         │  Phala TEE   │
│   (Auth)     │                         │(Confidential)│
└──────────────┘                         └──────────────┘
```

## Project Structure

```
ssr/
├── frontend/           # React + Vite frontend
├── backend/            # Node.js + Express API
├── near-contracts/     # Rust smart contracts
├── edge-device/        # Edge device sync client
├── docker-compose.yml  # Development orchestration
├── DEVELOPMENT.md      # Development guide
└── .planning/          # Project planning docs
```

## Documentation

- [Development Guide](DEVELOPMENT.md) - Full setup and workflow
- [Frontend README](frontend/README.md) - React app details
- [Backend README](backend/README.md) - API documentation
- [NEAR Contracts README](near-contracts/README.md) - Smart contract docs

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 19, Vite, TypeScript | User interface |
| Auth | Privy.io | Web2 login, embedded wallets |
| Backend | Node.js, Express | API, encryption, sync |
| Database | PostgreSQL, TimescaleDB | Fast queries, time-series |
| Blockchain | NEAR Protocol | Verification, smart contracts |
| TEE | Phala Network | Confidential computing |
| Storage | IPFS (Pinata) | Decentralized documents |

## Development

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Rebuild after changes
docker compose up --build -d
```

## License

Proprietary - All rights reserved.
