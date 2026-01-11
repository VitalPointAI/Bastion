# Frontend-Backend Security Boundary

**Created:** 2026-01-11
**Status:** Critical architectural requirement for Phase 1

## Core Principle

**Frontend is display and interaction ONLY. All sensitive operations, credentials, and cryptographic functions MUST run in the backend TEE on Phala.**

This is foundational to the project's Verifiable Zero Trust architecture and cannot be compromised.

## Security Boundary

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (Browser - Untrusted Environment)                  │
├─────────────────────────────────────────────────────────────┤
│ ✅ ALLOWED:                                                  │
│   - Display components (React UI)                           │
│   - User input collection (forms, interactions)             │
│   - Privy authentication UI (SDK handles security)          │
│   - Public IPFS gateway reads (no credentials)              │
│   - Public NEAR RPC reads (no API keys)                     │
│   - Client-side UI state management                         │
│   - Display of encrypted data (after TEE decrypts)          │
│                                                              │
│ ❌ FORBIDDEN:                                                │
│   - API keys, JWTs, secrets of ANY kind                     │
│   - IPFS uploads (requires Pinata JWT)                      │
│   - Encryption key generation                               │
│   - NEAR transaction signing (Privy handles via TEE)        │
│   - Private data decryption                                 │
│   - FastNEAR API key usage                                  │
│   - Any operation requiring authentication to external API  │
└─────────────────────────────────────────────────────────────┘
                              ▼
                    HTTPS (TLS 1.3 + PQ)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND (Phala TEE - Trusted Execution Environment)         │
├─────────────────────────────────────────────────────────────┤
│ ✅ HANDLES:                                                  │
│   - IPFS uploads with Pinata JWT (stored in TEE env)        │
│   - Encryption key generation (hardware-backed)             │
│   - Data encryption/decryption                              │
│   - NEAR RPC calls with FastNEAR API key                    │
│   - NEAR transaction construction and signing               │
│   - PostgreSQL writes (dual-write with blockchain)          │
│   - Authentication token verification                       │
│   - Access control policy enforcement (ABAC)                │
│   - Audit logging to blockchain                             │
│   - AI model inference on sensitive data (NEAR AI)          │
│                                                              │
│ 🔒 PROTECTIONS:                                              │
│   - Hardware-rooted attestation (Intel SGX/TDX, AMD SEV)    │
│   - Encrypted memory (data never in plaintext outside TEE)  │
│   - Remote attestation (clients verify TEE identity)        │
│   - Sealed secrets (credentials never leave TEE)            │
│   - No root/admin access to running TEE                     │
└─────────────────────────────────────────────────────────────┘
```

## Environment Variables: Frontend vs Backend

### Frontend (.env.local) - PUBLIC ONLY
```bash
# ✅ ALLOWED (Public Configuration)
VITE_NEAR_NETWORK=testnet
VITE_PRIVY_APP_ID=cmka26ryk00t1k00br9fufiwk  # Public app ID, not secret

# ❌ MOVE TO BACKEND (Secrets)
# VITE_PINATA_JWT=...  # REMOVE - Move to backend TEE
# VITE_FASTNEAR_API_KEY=...  # REMOVE - Move to backend TEE
# VITE_PINATA_GATEWAY=...  # Public gateway URL - can stay if public
```

### Backend (.env - TEE Sealed Secrets)
```bash
# 🔒 BACKEND SECRETS (Never exposed to frontend)
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
FASTNEAR_API_KEY=3c1b8c4dfab4e640040dd3009e1ccec93fcb84409f88ce220aa398750e20edac
DATABASE_URL=postgresql://postgres:password@localhost:5432/coalition_ops
NEAR_PRIVATE_KEY=ed25519:...  # For backend service account
ENCRYPTION_MASTER_KEY=...  # For key derivation

# Public configuration (can duplicate from frontend for convenience)
NEAR_NETWORK=testnet
NEAR_RPC=https://rpc.testnet.fastnear.com
PINATA_GATEWAY=https://coffee-kind-eagle-207.mypinata.cloud
```

## Data Flow Patterns

### ❌ CURRENT (INSECURE) - IPFS Upload
```typescript
// frontend/src/lib/ipfs.ts - INSECURE PATTERN
const jwt = import.meta.env.VITE_PINATA_JWT;  // ❌ Exposed in browser
const pinataClient = new PinataSDK({ pinataJwt: jwt });  // ❌ Client-side
await pinataClient.upload.public.file(file);  // ❌ Frontend uploads directly
```

**Problems:**
- Pinata JWT exposed in browser JavaScript (visible in DevTools)
- Anyone can extract JWT and upload unlimited data to your Pinata account
- No access control - frontend can upload anything
- No audit trail - uploads not verified or logged

### ✅ CORRECT (SECURE) - IPFS Upload via Backend TEE
```typescript
// frontend/src/lib/api.ts - Secure pattern
async function uploadDocument(file: File, metadata: DocumentMetadata) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify(metadata));

  // Send to backend API (JWT in secure HTTP-only cookie or Authorization header)
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',  // Send auth cookie
  });

  return response.json();  // Returns: { document_id, encrypted_cid }
}
```

```typescript
// backend/src/api/documents.ts - Runs in Phala TEE
router.post('/upload', authenticateUser, async (req, res) => {
  const file = req.file;  // From multipart form data
  const metadata = JSON.parse(req.body.metadata);

  // 1. Verify user authorization (ABAC policy check)
  if (!canUploadDocument(req.user, metadata.classification)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Generate encryption key in TEE
  const encryptionKey = generateEncryptionKey();  // Hardware-backed RNG

  // 3. Encrypt file in TEE
  const { encryptedData, nonce } = encryptData(file.buffer, encryptionKey);

  // 4. Upload encrypted data to IPFS (Pinata JWT stored in TEE env)
  const ipfsClient = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT  // 🔒 Never leaves TEE
  });
  const { cid } = await ipfsClient.upload.file(new Blob([encryptedData]));

  // 5. Encrypt CID for on-chain storage
  const encryptedCID = encryptCID(cid, metadata.classification);

  // 6. Dual-write to PostgreSQL + blockchain
  const documentId = await dualWriteDocument({
    encrypted_cid: encryptedCID,
    encrypted_classification: encrypt(metadata.classification),
    encrypted_metadata: encrypt(metadata),
    owner_account_id: req.user.nearAccount,
    encryption_nonce: nonce,
  });

  // 7. Audit log to blockchain
  await logAuditEvent({
    event_type: 'document_uploaded',
    actor: req.user.nearAccount,
    document_id: documentId,
    classification: metadata.classification,
    timestamp: Date.now(),
  });

  res.json({ document_id: documentId, encrypted_cid: encryptedCID });
});
```

**Benefits:**
- Pinata JWT never exposed to browser
- Access control enforced in TEE (ABAC policies)
- Encryption keys generated in hardware-backed TEE
- All operations audited to blockchain
- Client only receives encrypted CID (needs key to decrypt)

### ✅ CORRECT (SECURE) - NEAR Transaction Signing
```typescript
// frontend/src/lib/near.ts - User initiates action
async function approveStrike(targetId: string) {
  // Frontend only sends intent
  const response = await fetch('/api/strikes/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ target_id: targetId }),
  });

  return response.json();
}
```

```typescript
// backend/src/api/strikes.ts - TEE constructs and signs transaction
router.post('/approve', authenticateUser, async (req, res) => {
  const { target_id } = req.body;

  // 1. Verify user has authority (DAO membership, ABAC policy)
  if (!hasStrikeAuthority(req.user, target_id)) {
    return res.status(403).json({ error: 'Insufficient authority' });
  }

  // 2. Get NEAR account (managed by TEE or Privy)
  const account = await getNearAccount(req.user);

  // 3. Construct transaction in TEE
  const tx = await account.functionCall({
    contractId: 'bastion.testnet',
    methodName: 'approve_strike',
    args: {
      target_id,
      approver: req.user.nearAccount,
      timestamp: Date.now(),
    },
    gas: '30000000000000',
  });

  // 4. Transaction signed in TEE with user's key (Privy manages keys)
  // Privy SDK handles signing in secure enclave

  // 5. Broadcast to NEAR blockchain
  const result = await tx;

  // 6. Audit log
  await logAuditEvent({
    event_type: 'strike_approved',
    actor: req.user.nearAccount,
    target_id,
    tx_hash: result.transaction.hash,
  });

  res.json({ tx_hash: result.transaction.hash, status: 'approved' });
});
```

**Benefits:**
- Private keys never touch browser (managed by Privy in secure enclave)
- Transaction construction happens server-side with access control
- All approvals audited to blockchain
- Frontend only displays results

## Migration Plan for Phase 1

### Immediate Actions (Plan 1-03 Revision):

1. **Remove frontend IPFS upload** - Delete `frontend/src/lib/ipfs.ts` client-side upload logic
2. **Move credentials to backend** - Remove all `VITE_*` secret env vars from frontend
3. **Create backend API** - Implement TEE-based upload endpoint (Plan 1-03A already designs this)
4. **Update frontend** - Replace direct IPFS calls with backend API calls

### Plan 1-04 (Phala TEE Deployment):

Must establish:
1. **Phala TEE environment setup** - Docker, Phala runtime, remote attestation
2. **Sealed secrets management** - TEE-encrypted environment variables
3. **Backend service deployment** - Node.js in TEE with all sensitive operations
4. **Attestation verification** - Frontend verifies backend TEE identity before trusting

### Plan 1-03A Integration:

Good news: Plan 1-03A already designs secure backend API architecture
- `backend/src/api/documents.ts` - Document upload/retrieval API ✅
- `backend/src/lib/database.ts` - Dual-write pattern ✅
- `backend/src/lib/blockchain-sync.ts` - Background workers ✅

**Needs addition:**
- IPFS upload moved to backend (currently in `frontend/src/lib/ipfs.ts`)
- Encryption moved to backend (currently in `frontend/src/lib/encryption.ts`)

## Security Checklist for Every Feature

Before implementing ANY feature, verify:

- [ ] **No secrets in frontend** - All API keys, JWTs, private keys in backend TEE only
- [ ] **No crypto in browser** - Encryption/decryption happens in TEE (except client display)
- [ ] **Access control enforced** - ABAC policies checked in backend, not frontend
- [ ] **Audit trail** - All sensitive operations logged to blockchain
- [ ] **Attestation verified** - Frontend verifies backend TEE identity
- [ ] **Least privilege** - Frontend only has permissions for display, not operations

## Exception: Privy Embedded Wallets

Privy SDK runs in frontend BUT:
- Privy uses secure enclaves (iOS Secure Enclave, Android Keystore, WebAuthn)
- Private keys never in JavaScript memory
- Signing happens in hardware-backed secure context
- Backend still validates all signed transactions

This is acceptable because:
1. Privy is industry-standard wallet abstraction (production-grade security)
2. Hardware-backed key storage (not software)
3. Backend enforces business logic (Privy only handles signing)

## Testing Security Boundary

### Manual Testing:
1. Open browser DevTools
2. Inspect environment variables: `import.meta.env`
3. **Verify:** No secrets visible (only public config)
4. Inspect network requests to backend
5. **Verify:** No secrets in request headers/body (only auth tokens)

### Automated Testing:
```typescript
// tests/security/no-secrets-in-frontend.test.ts
test('frontend env vars contain no secrets', () => {
  const frontendEnv = import.meta.env;

  // Should NOT exist in frontend
  expect(frontendEnv.VITE_PINATA_JWT).toBeUndefined();
  expect(frontendEnv.VITE_FASTNEAR_API_KEY).toBeUndefined();
  expect(frontendEnv.PINATA_JWT).toBeUndefined();
  expect(frontendEnv.DATABASE_URL).toBeUndefined();

  // CAN exist (public config)
  expect(frontendEnv.VITE_NEAR_NETWORK).toBeDefined();
  expect(frontendEnv.VITE_PRIVY_APP_ID).toBeDefined();
});
```

## Consequences of Violating This Boundary

**If secrets are exposed in frontend:**
- ❌ Attackers can extract and abuse API keys
- ❌ Unlimited IPFS uploads to your account (cost + abuse)
- ❌ Unauthorized database access
- ❌ Cannot achieve security accreditation (ATO)
- ❌ Violates Verifiable Zero Trust architecture
- ❌ Defense customers will reject the system

**This is not negotiable for a defense AI platform.**

## References

- [PROJECT.md - Verifiable Zero Trust](PROJECT.md:221-422)
- [Plan 1-03A - PostgreSQL Hybrid Storage](1-03A-PLAN.md) - Designs backend API correctly
- [Plan 1-CONTEXT - Phala TEE Integration](1-CONTEXT.md:56-95)
- NEAR Privy Integration: https://docs.privy.io/guide/react/wallets/embedded/overview
- Phala Network TEE: https://docs.phala.network/
- OWASP Secure Coding: https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/

---

**Bottom Line:** Frontend = Display. Backend TEE = Everything Else.
