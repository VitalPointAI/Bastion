# BASTION Backend API

Secure Node.js/Express backend for the BASTION platform, handling encryption, IPFS storage, blockchain synchronization, and MPC account management.

**Role in the System:** The backend is the secure bridge between the user-facing frontend and all sensitive infrastructure—blockchain, storage, and TEE. All encryption keys, NEAR transactions, and IPFS operations are handled server-side to maintain Zero Trust security. The frontend never touches secrets directly.

## Features

- **Encryption API**: ChaCha20-Poly1305 encryption for documents
- **Document API**: IPFS upload/retrieval via Pinata
- **Edge Sync API**: Offline-first sync for edge devices
- **Accounts API**: MPC key management with Chain Signatures
- **Blockchain Sync**: Background worker for NEAR → PostgreSQL sync
- **Health Check**: `/health` endpoint for monitoring

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+ (with TimescaleDB)
- Docker (for database)

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Start database (Docker)
docker compose up postgres -d

# Start development server
pnpm dev
```

## Scripts

```bash
pnpm dev      # Start with hot reload (tsx watch)
pnpm build    # Compile TypeScript
pnpm start    # Run production build
pnpm test     # Run tests
```

## API Endpoints

### Health Check

```
GET /health
Response: { "status": "healthy", "timestamp": "..." }
```

### Encryption

```
POST /api/encryption/encrypt
Body: { "data": "base64-encoded-data", "key": "hex-key" }
Response: { "encrypted": "base64", "nonce": "base64" }

POST /api/encryption/decrypt
Body: { "encrypted": "base64", "nonce": "base64", "key": "hex-key" }
Response: { "data": "base64-decoded-data" }
```

### Documents

```
POST /api/documents/upload
Body: FormData with 'file' field
Response: { "cid": "bafybeig...", "size": 12345 }

GET /api/documents/:cid
Response: File content

POST /api/documents/store
Body: { "cid": "...", "classification": "Public", "metadata": {} }
Response: { "success": true }
```

### Accounts

```
POST /api/accounts/register
Body: { "privyUserId": "...", "nearAccountId": "..." }
Response: { "success": true, "mpcRootKey": "..." }

GET /api/accounts/:privyUserId
Response: { "nearAccountId": "...", "mpcKeyStatus": "...", ... }

POST /api/accounts/generate-mpc-key
Body: { "nearAccountId": "...", "derivationPath": "..." }
Response: { "publicKey": "...", "derivationPath": "..." }
```

### Edge Sync

```
POST /api/edge/sync
Body: { "deviceId": "...", "documents": [...], "lastSync": "..." }
Response: { "updates": [...], "conflicts": [...] }
```

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # Express app entry point
│   ├── api/
│   │   ├── accounts.ts   # Account management routes
│   │   ├── documents.ts  # Document/IPFS routes
│   │   ├── edge-sync.ts  # Edge device sync routes
│   │   └── encryption.ts # Encryption routes
│   └── lib/
│       ├── blockchain-sync.ts  # NEAR → PG background worker
│       ├── database.ts         # PostgreSQL connection
│       ├── edge-sync.ts        # Edge sync logic
│       ├── encryption.ts       # ChaCha20-Poly1305 wrapper
│       ├── ipfs.ts             # Pinata client
│       └── mpc-accounts.ts     # Chain Signatures MPC
├── database/
│   ├── init.sql          # Database initialization
│   └── schema.sql        # Table schemas
├── Dockerfile            # Multi-stage build
├── .dockerignore         # Build context exclusions
├── .env.example          # Environment template
├── package.json
└── tsconfig.json
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `NODE_ENV` | Environment | No (default: development) |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PINATA_JWT` | Pinata API JWT | Yes |
| `PINATA_GATEWAY` | Pinata gateway URL | No |
| `NEAR_NETWORK` | NEAR network (testnet/mainnet) | Yes |
| `NEAR_RPC` | NEAR RPC endpoint | Yes |
| `FASTNEAR_API_KEY` | FastNEAR API key | No |
| `ENCRYPTION_MASTER_KEY` | 32-byte hex key | Yes |

## Docker

```bash
# Build image
docker build -t bastion-backend:dev .

# Run standalone
docker run -p 3001:3001 --env-file .env bastion-backend:dev

# Or use docker-compose (recommended)
docker compose up backend -d
```

The Dockerfile uses multi-stage builds:
- **builder**: Compiles TypeScript
- **runtime**: Slim Node.js image with production deps only

## Database Schema

Key tables:
- `documents`: Document metadata and CIDs
- `accounts`: User accounts with MPC key status
- `sync_outbox`: Transactional outbox for blockchain sync
- `edge_sync_state`: Edge device sync tracking

See `database/schema.sql` for full schema.

## Security

- All sensitive operations require authentication
- Encryption keys never logged
- Non-root user in Docker container
- CORS configured for frontend origin
- Environment variables for secrets (never hardcoded)

## Troubleshooting

### Database connection fails
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Verify DATABASE_URL
echo $DATABASE_URL
```

### Pinata 403 errors
- Regenerate JWT at https://app.pinata.cloud/developers/api-keys
- Ensure upload permissions enabled

### Sync worker fails
- Check NEAR_RPC is accessible
- Verify contract account ID in config
