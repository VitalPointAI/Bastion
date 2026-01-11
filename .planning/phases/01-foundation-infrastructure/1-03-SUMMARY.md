# Phase 1 Plan 3: IPFS & Encrypted Storage Summary

**Decentralized encrypted storage with IPFS for large data, encrypted CIDs on-chain for provenance and auditability**

## Accomplishments

- IPFS integration via Pinata SDK v2.5.2 (managed pinning, dedicated gateways)
- Client-side encryption using ChaCha20-Poly1305 AEAD cipher (@noble/ciphers)
- Cryptographic hashing with SHA256 (@noble/hashes)
- Document upload workflow: encrypt large file → IPFS → encrypt CID → store on-chain
- Document retrieval workflow: fetch encrypted CID from chain → decrypt → download from IPFS → decrypt content
- NEAR contract encrypted document registry with ALL data encrypted by default
- Encrypted CIDs, metadata, and classification stored on-chain
- Only AccountId and timestamps plaintext (required for access control/indexing)
- Architecture: large files off-chain (IPFS), encrypted references on-chain (NEAR) for provenance
- Content addressing verified (same content = same CID)
- Authenticated encryption detects tampering
- Event logging for PostgreSQL sync (Plan 1-03A integration ready)

## Files Created/Modified

**Created:**
- `/home/vitalpointai/projects/ssr/frontend/src/lib/ipfs.ts` - IPFS client with Pinata integration (upload/retrieve functions)
- `/home/vitalpointai/projects/ssr/frontend/src/lib/encryption.ts` - Client-side encryption utilities (ChaCha20-Poly1305, SHA256)
- `/home/vitalpointai/projects/ssr/near-contracts/src/document.rs` - Encrypted document registry module (Document struct, DocumentRegistry)

**Modified:**
- `/home/vitalpointai/projects/ssr/frontend/package.json` - Added pinata, @noble/ciphers, @noble/hashes dependencies
- `/home/vitalpointai/projects/ssr/frontend/pnpm-lock.yaml` - Updated lockfile
- `/home/vitalpointai/projects/ssr/frontend/.env.local.example` - Added Pinata JWT and gateway configuration
- `/home/vitalpointai/projects/ssr/near-contracts/src/lib.rs` - Integrated document registry (added module, state, public methods)
- `/home/vitalpointai/projects/ssr/near-contracts/Cargo.toml` - Enabled legacy feature for collections (UnorderedMap, LookupMap)

## Decisions Made

**Pinata for IPFS instead of local node**: Provides managed pinning, reliable gateways, and production-ready infrastructure without operational overhead. Free tier sufficient for development.

**ChaCha20-Poly1305 instead of AES-GCM**: Faster in software, timing-attack resistant, modern AEAD cipher with authentication. Uses audited @noble/ciphers library with no dependencies.

**ALL on-chain data encrypted by default**: CIDs, metadata, and classification all encrypted before storing on-chain. Only owner AccountId and timestamps remain plaintext (required for access control and indexing).

**Document counter for unique IDs**: Added counter to ensure unique document IDs even when multiple documents registered at same timestamp by same user. Format: `doc-{owner}-{timestamp}-{counter}`.

**Legacy collections feature**: Enabled near-sdk legacy feature to use UnorderedMap and LookupMap for efficient document storage and user indexing.

## Issues Encountered

**Pinata SDK deprecation**: Initial attempt used deprecated `pinata-web3` package. Resolved by switching to current `pinata` SDK (v2.5.2) with updated API (`pinataClient.upload.public.file()`).

**@noble imports require .js extension**: TypeScript imports failed without `.js` extension on module paths. Resolved by using `@noble/ciphers/chacha.js` and `@noble/hashes/sha2.js` format.

**randomBytes location**: Initially tried importing from `@noble/ciphers/webcrypto.js` but randomBytes is exported from `@noble/ciphers/utils.js`.

**Collections module not found**: near-sdk 5.x moved collections to legacy feature. Resolved by enabling `legacy` feature in Cargo.toml for both dependencies and dev-dependencies.

**Test failure with duplicate document IDs**: Documents registered at same timestamp by same user generated identical IDs, causing second document to overwrite first. Resolved by adding `document_counter` field to DocumentRegistry for unique ID generation.

## Technical Details

**IPFS Upload Pattern**:
```typescript
const upload = await pinataClient.upload.public.file(file);
// Returns: { cid, name, size, created_at, ... }
```

**Client-Side Encryption Pattern**:
```typescript
const key = generateEncryptionKey(); // 32 bytes
const { encryptedData, nonce } = encryptData(data, key);
// ChaCha20-Poly1305 AEAD: confidentiality + authenticity + tamper detection
```

**On-Chain Storage Pattern**:
```rust
pub struct Document {
    encrypted_cid: String,              // Encrypted IPFS CID
    encrypted_classification: String,   // Encrypted classification
    encrypted_metadata_key: String,     // Encrypted content key
    owner: AccountId,                   // Plaintext (access control)
    created_at: u64,                    // Plaintext (indexing)
    encrypted_metadata: String,         // Encrypted metadata
}
```

**Event Logging for PostgreSQL Sync**:
```rust
log!(
    "DOCUMENT_REGISTERED: {{\"document_id\": \"{}\", \"encrypted_cid\": \"{}\", \"owner\": \"{}\", \"created_at\": {}, \"encrypted_classification\": \"{}\"}}",
    document_id, encrypted_cid, owner, created_at, encrypted_classification
);
```

## Verification Checklist

- [x] IPFS uploads succeed and return valid CIDs (bafybei... or Qm... format)
- [x] Client-side encryption/decryption works correctly (ChaCha20-Poly1305)
- [x] NEAR contract stores document metadata with encrypted CIDs
- [x] NEAR contract emits events for PostgreSQL sync (Plan 1-03A integration)
- [x] Content addressing verified (same file = same CID)
- [x] Authenticated encryption detects tampering (Poly1305 authentication tag)
- [x] All 11 unit tests passing (document registry + existing contract tests)
- [x] Contract compiles to 211KB WASM binary
- [x] Frontend builds without errors (2.6MB total bundle)

## Next Step

Ready for [1-03A-PLAN.md](1-03A-PLAN.md): PostgreSQL Hybrid Storage (inserted plan for fast queries and offline sync)

OR

Ready for [1-04-PLAN.md](1-04-PLAN.md): Docker & Deployment Infrastructure (if 1-03A skipped)

## Execution Details

- **Started**: 2026-01-11T18:54:47Z (epoch: 1768157687)
- **Completed**: 2026-01-11T19:18:47Z (epoch: 1768159127)
- **Duration**: 24 minutes

## Commit Hashes

1. `74fd27f` - feat(1-03): set up IPFS infrastructure with Pinata for large data storage
2. `8ad5c2c` - feat(1-03): implement client-side encryption for IPFS uploads
3. `98ac357` - feat(1-03): add encrypted document registry to NEAR contract
