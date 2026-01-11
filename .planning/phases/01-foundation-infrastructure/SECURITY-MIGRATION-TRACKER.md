# Phase 1 Security Migration Tracker

**Created:** 2026-01-11
**Purpose:** Track migration of sensitive operations from frontend to backend TEE

## Critical Security Issue

Currently, sensitive credentials and operations are exposed in the frontend, violating the project's Verifiable Zero Trust architecture. This tracker ensures all sensitive functionality moves to the backend TEE on Phala.

## Migration Status

### ✅ Plan 1-03 (IPFS & Encrypted Storage) - MIGRATED (via Plan 1-04)

**Status:** SECURE (as of 2026-01-11)
- `frontend/src/lib/ipfs.ts` - Now proxies to backend API only
- `frontend/.env.local` - All secrets removed (VITE_PINATA_JWT, VITE_FASTNEAR_API_KEY)
- `frontend/src/lib/encryption.ts` - Now proxies to backend API only
- `backend/src/lib/ipfs.ts` - Backend IPFS client with sealed Pinata JWT
- `backend/src/lib/encryption.ts` - Backend encryption with Node.js crypto
- `backend/src/api/documents.ts` - Upload endpoint: encrypt → IPFS
- `backend/src/api/encryption.ts` - Encryption/decryption endpoints

**Completed Changes:**
- [x] `frontend/.env.local` - Removed `VITE_PINATA_JWT`, `VITE_FASTNEAR_API_KEY`
- [x] `frontend/src/lib/ipfs.ts` - Removed upload function, proxies to backend
- [x] `frontend/src/lib/encryption.ts` - Proxies to backend API
- [x] Created `backend/src/lib/ipfs.ts` - Backend IPFS client with sealed Pinata JWT
- [x] Created `backend/src/lib/encryption.ts` - Server-side encryption
- [x] Created `backend/src/api/documents.ts` - Upload endpoint
- [x] Created `backend/src/api/encryption.ts` - Encryption endpoints
- [x] Security tests passing (tests/security/frontend-no-secrets.test.ts)

**Notes:**
- Completed via Plan 1-04 (Backend Security Migration)
- Backend handles: file → encrypt → upload to IPFS
- Frontend only calls backend API, receives encrypted results
- Ready for Phase 1-05 (Phala TEE integration)

---

### ✅ Plan 1-03A (PostgreSQL Hybrid Storage) - CORRECT ARCHITECTURE

**Current State:** SECURE (not yet implemented)
- Designs backend API correctly: `backend/src/api/documents.ts`
- Dual-write in backend: `backend/src/lib/database.ts`
- No frontend secrets

**Notes:**
- This plan already follows secure architecture
- When implementing, ensure IPFS upload also moved to backend
- Backend API endpoints handle all sensitive operations

**Priority:** HIGH - Implement as designed

---

### ✅ Plan 1-04 (Backend Security Migration) - COMPLETED

**Status:** COMPLETE (as of 2026-01-11)
**Completed via commits:** e748163, f1f0dac, 5c23297

**Implementation:**
1. Node.js/Express backend with TypeScript operational on port 3001
2. Sealed secrets management (backend/.env, never committed)
3. All encryption operations moved to backend (crypto.randomBytes)
4. All IPFS uploads moved to backend (Pinata JWT secured)
5. Frontend cleaned of all secrets (only public config remains)
6. Security test suite implemented and passing

**Files Created:**
- [x] `backend/package.json` - Backend dependencies
- [x] `backend/tsconfig.json` - TypeScript configuration
- [x] `backend/src/index.ts` - Express server
- [x] `backend/src/lib/encryption.ts` - Server-side encryption
- [x] `backend/src/lib/ipfs.ts` - Server-side IPFS client
- [x] `backend/src/api/encryption.ts` - Encryption REST API
- [x] `backend/src/api/documents.ts` - Document upload API
- [x] `backend/.env` - Sealed secrets (not committed)
- [x] `backend/.env.example` - Public template
- [x] `frontend/.env.local` - Updated (secrets removed)
- [x] `tests/security/frontend-no-secrets.test.ts` - Security tests
- [x] `.gitignore` - Updated (backend/.env excluded)
- [x] `docker-compose.yml` - PostgreSQL and backend services

**Next:** Plan 1-05 will migrate this backend to Phala TEE for hardware attestation

---

## Environment Variables Audit

### Frontend (.env.local) - Current State ❌
```bash
# ❌ INSECURE - MUST REMOVE
VITE_PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # REMOVE
VITE_FASTNEAR_API_KEY=3c1b8c4dfab4e640040dd3009e1ccec93fcb84409f88ce220aa398750e20edac  # REMOVE

# ✅ ALLOWED (Public Configuration)
VITE_PRIVY_APP_ID=cmka26ryk00t1k00br9fufiwk  # Public app ID, safe to expose
VITE_NEAR_NETWORK=testnet  # Public config
VITE_NEAR_RPC=https://rpc.testnet.fastnear.com  # Can be public (optional)
VITE_PINATA_GATEWAY=https://coffee-kind-eagle-207.mypinata.cloud  # Public gateway, read-only
```

### Frontend (.env.local) - Target State ✅
```bash
# ✅ PUBLIC CONFIGURATION ONLY
VITE_PRIVY_APP_ID=cmka26ryk00t1k00br9fufiwk
VITE_NEAR_NETWORK=testnet
VITE_BACKEND_API_URL=https://localhost:3001  # Backend TEE endpoint
# Optional: Public RPC for read-only queries (or proxy through backend)
# VITE_NEAR_RPC=https://rpc.testnet.fastnear.com
```

### Backend (.env) - Target State ✅
```bash
# 🔒 BACKEND SECRETS (TEE-sealed, never exposed)
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FASTNEAR_API_KEY=3c1b8c4dfab4e640040dd3009e1ccec93fcb84409f88ce220aa398750e20edac
DATABASE_URL=postgresql://postgres:password@localhost:5432/coalition_ops
NEAR_PRIVATE_KEY=ed25519:...  # Backend service account
ENCRYPTION_MASTER_KEY=...  # For key derivation in TEE

# Public configuration (duplicated for convenience)
NEAR_NETWORK=testnet
NEAR_RPC=https://rpc.testnet.fastnear.com
PINATA_GATEWAY=https://coffee-kind-eagle-207.mypinata.cloud
```

---

## Code Migration Checklist

### IPFS Operations
- [x] Remove `frontend/src/lib/ipfs.ts::uploadFile()` function
- [x] Keep `frontend/src/lib/ipfs.ts::retrieveFile()` (read-only, public gateway)
- [x] Create `backend/src/lib/ipfs.ts` with Pinata JWT from env
- [x] Create `backend/src/api/documents.ts` - POST /api/documents/upload endpoint
- [x] Frontend calls `/api/documents/upload` instead of direct Pinata API

### Encryption Operations
- [x] Move `frontend/src/lib/encryption.ts` → `backend/src/lib/encryption.ts`
- [x] Backend generates keys with Node.js crypto.randomBytes (TEE upgrade in Phase 1-05)
- [x] Backend encrypts/decrypts all data via API endpoints
- [x] Frontend only displays encrypted data or decrypted results from backend

### NEAR Operations
- [ ] Verify Privy handles all wallet operations (signing in secure enclave)
- [ ] Backend validates all signed transactions before blockchain submission
- [ ] Backend enforces access control (ABAC) before allowing transaction
- [x] FastNEAR API key only in backend for RPC calls

---

## Testing Requirements

### Security Tests (Must Pass Before Phase 1 Complete)

```typescript
// tests/security/frontend-no-secrets.test.ts
test('frontend has no secrets in environment', () => {
  const env = import.meta.env;

  // Secrets that MUST NOT exist
  expect(env.VITE_PINATA_JWT).toBeUndefined();
  expect(env.VITE_FASTNEAR_API_KEY).toBeUndefined();
  expect(env.PINATA_JWT).toBeUndefined();
  expect(env.DATABASE_URL).toBeUndefined();
  expect(env.NEAR_PRIVATE_KEY).toBeUndefined();

  // Public config that CAN exist
  expect(env.VITE_PRIVY_APP_ID).toBeDefined();
  expect(env.VITE_NEAR_NETWORK).toBeDefined();
});
```

```typescript
// tests/security/backend-attestation.test.ts
test('backend provides valid TEE attestation', async () => {
  const response = await fetch('http://localhost:3001/api/attestation');
  const attestation = await response.json();

  // Verify attestation contains required fields
  expect(attestation.quote).toBeDefined();
  expect(attestation.code_hash).toBeDefined();
  expect(attestation.timestamp).toBeDefined();

  // Verify attestation signature (integration with Phala attestation verification)
  const isValid = await verifyAttestation(attestation);
  expect(isValid).toBe(true);
});
```

```bash
# Manual security audit
# Run in browser console after loading frontend:
console.log(import.meta.env);
# Should show ONLY public vars (VITE_PRIVY_APP_ID, VITE_NEAR_NETWORK)
# Should NOT show any JWTs, API keys, database URLs, private keys
```

---

## Implementation Order

1. **Phase 1-04: Phala TEE Setup** (CRITICAL - Foundation)
   - Set up Phala TEE environment
   - Configure sealed secrets
   - Establish remote attestation

2. **Revise Plan 1-03: Move IPFS/Encryption to Backend**
   - Move encryption key generation to TEE
   - Move IPFS upload to backend API
   - Update frontend to call backend API

3. **Implement Plan 1-03A: PostgreSQL + Backend API**
   - Already designed correctly
   - Integrate with TEE-based IPFS upload
   - Dual-write pattern as designed

4. **Security Validation**
   - Run automated security tests
   - Manual audit of frontend env vars
   - Verify TEE attestation
   - Code review for any remaining secrets

---

## Success Criteria

Phase 1-04 Backend Security Migration:

- [x] No secrets in `frontend/.env.local` (only public config)
- [x] No secrets in `frontend/src/**/*.ts` code
- [x] All IPFS uploads go through backend API (not direct Pinata calls)
- [x] All encryption happens in backend (Node.js crypto.randomBytes)
- [x] All security tests pass (tests/security/frontend-no-secrets.test.ts)
- [x] Manual audit confirms no secrets exposed (git history clean)
- [ ] Backend provides valid TEE attestation (Phase 1-05)
- [ ] Frontend verifies backend TEE identity before trusting (Phase 1-05)

**Phase 1-04 Complete. Phase 1-05 will add TEE hardware attestation.**

---

## References

- [Security Boundary Architecture](../../architecture/frontend-backend-security-boundary.md)
- [PROJECT.md - Verifiable Zero Trust](../../PROJECT.md)
- [Plan 1-03 - IPFS Storage](1-03-PLAN.md) - Needs revision
- [Plan 1-03A - PostgreSQL Hybrid](1-03A-PLAN.md) - Correct architecture
- [Plan 1-CONTEXT - TEE Integration](1-CONTEXT.md)
