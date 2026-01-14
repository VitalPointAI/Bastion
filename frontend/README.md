# BASTION Frontend

React 19 frontend for the BASTION platform with Privy authentication, NEAR blockchain integration, and zero-blockchain UX.

**Role in the System:** The frontend is the command interface for operators and commanders, providing Web2-style authentication through Privy while abstracting all blockchain complexity. It connects to the backend API for sensitive operations and never exposes crypto terminology, wallet management, or gas fees to users.

## Features

- **Privy Authentication**: Web2-style login (email, social) with embedded NEAR wallets
- **Zero Blockchain UX**: No crypto terminology, seed phrases, or gas fees visible to users
- **IPFS Integration**: Client-side encryption and decentralized document storage
- **TEE Client**: Secure context management for classified data
- **Chain Signatures**: Multi-chain control via NEAR MPC

## Tech Stack

- React 19 with TypeScript 5.9
- Vite 7 (build tool and dev server)
- Privy.io (authentication)
- @noble/ciphers (encryption)
- Axios (HTTP client)

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Start development server
pnpm dev
```

Open http://localhost:5173 in your browser.

## Scripts

```bash
pnpm dev          # Start Vite dev server with HMR
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
pnpm test:security  # Run security tests
```

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Entry point with Privy provider
│   ├── lib/
│   │   ├── aiContext.ts  # AI context security manager
│   │   ├── encryption.ts # Client-side encryption
│   │   ├── ipfs.ts       # IPFS/Pinata client
│   │   └── teeClient.ts  # TEE communication client
│   └── components/       # React components
├── public/               # Static assets
├── tests/
│   └── security/         # Security test suite
├── Dockerfile            # Multi-stage build
├── nginx.conf            # Production nginx config
├── .env.local.example    # Environment template
├── vite.config.ts        # Vite configuration
└── tsconfig.json         # TypeScript config
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_PRIVY_APP_ID` | Privy application ID | Yes |
| `VITE_NEAR_NETWORK` | NEAR network (testnet/mainnet) | Yes |
| `VITE_NEAR_RPC` | NEAR RPC endpoint | Yes |
| `VITE_PINATA_JWT` | Pinata API JWT | Yes |
| `VITE_PINATA_GATEWAY` | Pinata gateway URL | No |
| `VITE_BACKEND_URL` | Backend API URL | Yes |

## Key Libraries

### `src/lib/encryption.ts`
Client-side encryption using ChaCha20-Poly1305 (AEAD cipher).

```typescript
import { encrypt, decrypt, generateKey } from './lib/encryption';

const key = generateKey();
const encrypted = await encrypt(data, key);
const decrypted = await decrypt(encrypted, key);
```

### `src/lib/aiContext.ts`
Classification-based context management for AI interactions.

```typescript
import { AIContextManager, Classification } from './lib/aiContext';

const manager = new AIContextManager();
await manager.addContext(sessionId, context, Classification.SECRET);
// SECRET/TS: ephemeral memory only
// CONFIDENTIAL: encrypted storage
// UNCLASS: normal storage
```

### `src/lib/teeClient.ts`
Communication with Phala TEE via NEAR contract.

```typescript
import { TEEClient } from './lib/teeClient';

const client = new TEEClient();
await client.sendToTEEMemory(sessionId, context, classification);
```

## Docker

```bash
# Build development image
docker build --target development -t bastion-frontend:dev .

# Build production image (nginx)
docker build --target production -t bastion-frontend:prod \
  --build-arg VITE_PRIVY_APP_ID=xxx \
  --build-arg VITE_PINATA_JWT=xxx .

# Or use docker-compose
docker compose up frontend -d
```

## Development Notes

### Hot Module Replacement
Vite provides instant HMR. Edit files in `src/` and changes appear immediately.

### TypeScript Configuration
- `erasableSyntaxOnly: true` - Use const objects instead of enums
- Strict mode enabled for type safety

### ESLint
ESLint configured with React and TypeScript rules. Run `pnpm lint` before committing.

## Troubleshooting

### Privy login fails
- Verify `VITE_PRIVY_APP_ID` is correct
- Check Privy dashboard for allowed domains

### IPFS upload fails
- Regenerate `VITE_PINATA_JWT`
- Ensure JWT has upload permissions

### Backend connection fails
- Verify `VITE_BACKEND_URL` points to running backend
- Check CORS configuration in backend

## Links

- [Privy Documentation](https://docs.privy.io/)
- [Vite Guide](https://vitejs.dev/guide/)
- [React 19 Documentation](https://react.dev/)
- [@noble/ciphers](https://github.com/paulmillr/noble-ciphers)
