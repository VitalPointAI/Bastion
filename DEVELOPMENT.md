# BASTION Development Guide

**Blockchain Autonomous Strategy & Tactical Intelligence Operational Network**

This guide covers setting up your development environment and working with the BASTION codebase.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BASTION Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  Frontend   │    │   Backend   │    │  PostgreSQL │                 │
│  │  (React)    │───▶│  (Express)  │───▶│ TimescaleDB │                 │
│  │  Port 5173  │    │  Port 3001  │    │  Port 5432  │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│        │                  │                                             │
│        │                  │                                             │
│        ▼                  ▼                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Privy     │    │    IPFS     │    │    NEAR     │                 │
│  │   (Auth)    │    │  (Pinata)   │    │ (Blockchain)│                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│                                              │                          │
│                                              ▼                          │
│                                        ┌─────────────┐                 │
│                                        │  Phala TEE  │                 │
│                                        │(Confidential)│                 │
│                                        └─────────────┘                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 19, Vite, TypeScript | User interface, Privy authentication |
| **Backend** | Node.js, Express, TypeScript | API server, encryption, blockchain sync |
| **Database** | PostgreSQL 16, TimescaleDB | Fast queries, time-series data |
| **NEAR Contracts** | Rust, near-sdk | Document registry, privacy routing |
| **IPFS** | Pinata | Encrypted document storage |
| **Auth** | Privy.io | Web2-style login, embedded wallets |

### Data Flow

1. **Authentication**: User logs in via Privy (email/social) → Embedded NEAR wallet created
2. **Document Storage**: Document → Client-side encryption → IPFS (Pinata) → CID stored on NEAR
3. **Privacy Routing**: Data classified → Public: on-chain / Secret: Phala TEE
4. **Sync**: PostgreSQL (fast queries) ← Background sync ← NEAR (verification)

## Prerequisites

Install the following tools:

- **Docker** (v24+) and **Docker Compose** (v2+)
- **Node.js** (v20+) and **pnpm** (v9+)
- **Rust** (1.75+) with `wasm32-unknown-unknown` target
- **cargo-near** for NEAR contract builds

### Quick Install (macOS/Linux)

```bash
# Docker
# macOS: Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Linux: See https://docs.docker.com/engine/install/

# Node.js and pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
pnpm env use --global 20

# Rust and NEAR tools
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install cargo-near near-cli-rs
```

## Getting Started

### 1. Clone and Configure

```bash
git clone <repository-url>
cd ssr

# Copy environment templates
cp .env.example frontend/.env.local
cp backend/.env.example backend/.env
```

### 2. Fill in API Keys

Edit `frontend/.env.local`:
```env
VITE_PRIVY_APP_ID=your_privy_app_id_here   # From https://dashboard.privy.io
VITE_PINATA_JWT=your_pinata_jwt_here       # From https://app.pinata.cloud
```

Edit `backend/.env`:
```env
PINATA_JWT=your_pinata_jwt_here
ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)
```

### 3. Start Development Environment

**Option A: Docker Compose (Recommended)**
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Services available at:
# - Frontend: http://localhost:5173
# - Backend:  http://localhost:3001
# - Database: localhost:5432
```

**Option B: Local Development**
```bash
# Terminal 1: Start database
docker compose up postgres -d

# Terminal 2: Start backend
cd backend
pnpm install
pnpm dev

# Terminal 3: Start frontend
cd frontend
pnpm install
pnpm dev
```

### 4. Deploy NEAR Contracts (Optional)

```bash
cd near-contracts

# Build contracts
cargo near build

# Deploy to testnet (requires NEAR account)
near contract deploy bastion-test.testnet \
  use-file ./target/near/near_contracts.wasm \
  with-init-call new json-args '{"owner":"bastion-test.testnet"}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet
```

### 5. Verify Setup

```bash
# Check all services are healthy
docker compose ps

# Test backend health
curl http://localhost:3001/health

# Test frontend (should see React app)
open http://localhost:5173
```

## Development Workflow

### Frontend Development

The frontend uses Vite with hot module replacement (HMR). Changes to source files automatically refresh in the browser.

```bash
cd frontend

# Start dev server
pnpm dev

# Build for production
pnpm build

# Run linter
pnpm lint

# Run security tests
pnpm test:security
```

**Key directories:**
- `src/lib/` - Core libraries (encryption, IPFS, TEE client)
- `src/components/` - React components
- `src/pages/` - Page components

### Backend Development

The backend uses `tsx` for TypeScript execution with watch mode.

```bash
cd backend

# Start with watch mode
pnpm dev

# Build TypeScript
pnpm build

# Start production server
pnpm start
```

**Key directories:**
- `src/api/` - Express route handlers
- `src/lib/` - Business logic (encryption, blockchain sync, MPC)
- `database/` - SQL schema files

### NEAR Contract Development

Contracts are written in Rust using `near-sdk`.

```bash
cd near-contracts

# Build contract
cargo near build

# Run unit tests
cargo test

# Run integration tests (requires sandbox)
cargo test --test integration

# Format code
cargo fmt

# Check for issues
cargo clippy
```

**Key files:**
- `src/lib.rs` - Contract entry point
- `src/document.rs` - Document registry
- `src/privacy.rs` - Privacy routing
- `src/attestation.rs` - TEE attestation verification
- `tests/integration.rs` - Sandbox tests

## Docker Commands

```bash
# Start all services
docker compose up -d

# Start specific service
docker compose up postgres -d

# View logs
docker compose logs -f
docker compose logs backend -f

# Rebuild after code changes
docker compose up --build -d

# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v

# Check service health
docker compose ps

# Execute command in container
docker compose exec backend sh
docker compose exec postgres psql -U postgres -d coalition_ops
```

## Testing

### Frontend Tests

```bash
cd frontend
pnpm test:security  # Security-focused tests
```

### Backend Tests

```bash
cd backend
pnpm test  # (Currently placeholder)
```

### NEAR Contract Tests

```bash
cd near-contracts

# Unit tests (fast, no sandbox needed)
cargo test

# Integration tests (requires sandbox, can be slow)
cargo test --test integration -- --nocapture
```

## Troubleshooting

### Service Won't Start

1. Check if ports are in use:
   ```bash
   lsof -i :5173  # Frontend
   lsof -i :3001  # Backend
   lsof -i :5432  # PostgreSQL
   ```

2. View service logs:
   ```bash
   docker compose logs <service-name>
   ```

3. Rebuild containers:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

### Database Issues

1. Reset database:
   ```bash
   docker compose down -v  # Removes volumes!
   docker compose up -d
   ```

2. Connect to database:
   ```bash
   docker compose exec postgres psql -U postgres -d coalition_ops
   ```

### Frontend Can't Connect to Backend

1. Verify backend is running:
   ```bash
   curl http://localhost:3001/health
   ```

2. Check CORS in backend (should allow localhost:5173)

3. Check environment variable `VITE_BACKEND_URL`

### NEAR Contract Build Fails

1. Update Rust toolchain:
   ```bash
   rustup update
   rustup target add wasm32-unknown-unknown
   ```

2. Update cargo-near:
   ```bash
   cargo install cargo-near --force
   ```

3. Check Cargo.toml for correct dependencies

### Pinata/IPFS 403 Error

1. Regenerate JWT at https://app.pinata.cloud/developers/api-keys
2. Ensure JWT has upload permissions
3. Update `PINATA_JWT` in environment files

## Environment Variables Reference

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_PRIVY_APP_ID` | Privy application ID | Yes |
| `VITE_NEAR_NETWORK` | NEAR network (testnet/mainnet) | Yes |
| `VITE_NEAR_RPC` | NEAR RPC endpoint | Yes |
| `VITE_PINATA_JWT` | Pinata API JWT | Yes |
| `VITE_PINATA_GATEWAY` | Pinata gateway URL | No |
| `VITE_BACKEND_URL` | Backend API URL | Yes |

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `NODE_ENV` | Environment mode | No (default: development) |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PINATA_JWT` | Pinata API JWT | Yes |
| `PINATA_GATEWAY` | Pinata gateway URL | No |
| `NEAR_NETWORK` | NEAR network | Yes |
| `NEAR_RPC` | NEAR RPC endpoint | Yes |
| `ENCRYPTION_MASTER_KEY` | 32-byte hex encryption key | Yes |

## External Resources

- [NEAR Documentation](https://docs.near.org/)
- [Phala Network Docs](https://docs.phala.com/)
- [Privy Documentation](https://docs.privy.io/)
- [Pinata IPFS Docs](https://docs.pinata.cloud/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Express.js](https://expressjs.com/)
