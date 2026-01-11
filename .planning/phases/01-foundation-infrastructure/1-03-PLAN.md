---
phase: 01-foundation-infrastructure
plan: 03
type: execute
---

<objective>
Implement IPFS decentralized storage with client-side encryption for documents, intelligence products, and mission data, with on-chain provenance tracking.

Purpose: Establish resilient, tamper-proof storage infrastructure with content addressing and cryptographic verification, replacing centralized storage dependencies.
Output: Working IPFS integration with client-side encryption, CID storage on NEAR blockchain, and document upload/retrieval workflows.
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

**Tech stack available:**
- NEAR smart contracts with state versioning and testing
- React frontend with Privy authentication and embedded NEAR wallets
- FastNEAR RPC connection

**Established patterns:**
- State versioning with enums
- Early validation with require!
- Complete blockchain abstraction in UI

**From RESEARCH.md:**
- Use IPFS for decentralized content-addressed storage
- ipfs-http-client for JavaScript integration
- @web3-storage/w3up-client for managed IPFS + Filecoin storage
- @noble/ciphers for client-side encryption (ChaCha20-Poly1305)
- @noble/hashes for cryptographic hashing
- Pattern: Encrypt client-side BEFORE upload, store CID + encrypted key on-chain
- Don't hand-roll: encryption algorithms (use audited @noble libraries), file storage (use IPFS, not S3), access control (on-chain policies + encrypted keys)

**From CONTEXT.md:**
- IPFS for resilient, content-addressed storage
- Client-side encryption first - encrypt before upload
- Per-object keys based on classification and access policy
- IPFS CIDs stored on-chain for provenance
- Decentralized encrypted storage is equally critical foundational element
</context>

<tasks>

<task type="auto">
  <name>Task 1: Set up IPFS infrastructure with Web3.Storage</name>
  <files>frontend/src/lib/ipfs.ts, frontend/package.json</files>
  <action>
    Configure IPFS storage infrastructure using Web3.Storage for managed IPFS + Filecoin backend:

    1. Install IPFS dependencies: pnpm add @web3-storage/w3up-client ipfs-http-client

    2. Register at web3.storage:
       - Create account at web3.storage
       - Generate API token from dashboard
       - Note: Free tier provides sufficient storage for development

    3. Add to frontend/.env.local:
       - VITE_WEB3STORAGE_TOKEN=[api_token]

    4. Create src/lib/ipfs.ts with:
       - initialize() function creating w3up client
       - uploadFile(file: File) function:
         * Accepts File object
         * Uploads to IPFS via Web3.Storage
         * Returns CID (content identifier)
       - retrieveFile(cid: string) function:
         * Fetches file from IPFS by CID
         * Returns file data as Uint8Array
       - Error handling for network failures

    5. Add type definitions:
       - IPFSUploadResult interface
       - IPFSClient type

    Use Web3.Storage instead of running local IPFS node (managed infrastructure, free tier, automatic Filecoin persistence).
    Use content-addressed CIDs for tamper-proof integrity (any modification changes CID).

    Don't hand-roll: IPFS pinning services (Web3.Storage handles it), IPFS gateway infrastructure (managed), content addressing algorithms (built into IPFS).
  </action>
  <verify>
    - pnpm build succeeds without import errors
    - Upload test file via uploadFile() returns valid CID (format: bafybei...)
    - Retrieve file via retrieveFile(cid) returns original file data
    - Same file uploaded twice produces same CID (content addressing works)
    - Different file produces different CID
  </verify>
  <done>IPFS client initialized with Web3.Storage backend, file upload returns CIDs, file retrieval works, content addressing verified (same content = same CID)</done>
</task>

<task type="auto">
  <name>Task 2: Implement client-side encryption for IPFS uploads</name>
  <files>frontend/src/lib/encryption.ts, frontend/package.json</files>
  <action>
    Create client-side encryption layer using audited cryptography libraries:

    1. Install encryption dependencies: pnpm add @noble/ciphers @noble/hashes

    2. Create src/lib/encryption.ts with:
       - generateEncryptionKey() function:
         * Generates random 32-byte key using crypto.getRandomValues()
         * Returns Uint8Array key

       - encryptData(data: Uint8Array, key: Uint8Array) function:
         * Generates random 24-byte nonce
         * Encrypts with ChaCha20-Poly1305 AEAD cipher (from @noble/ciphers)
         * Returns { encryptedData: Uint8Array, nonce: Uint8Array }

       - decryptData(encryptedData: Uint8Array, key: Uint8Array, nonce: Uint8Array) function:
         * Decrypts using ChaCha20-Poly1305 with provided key and nonce
         * Returns original Uint8Array
         * Throws error if authentication tag invalid (tampered data)

       - hashData(data: Uint8Array) function:
         * Creates SHA256 hash using @noble/hashes
         * Returns hash as hex string

    3. Integration pattern:
       - Client generates encryption key
       - Client encrypts data before IPFS upload
       - Client uploads encrypted data to IPFS (gets CID)
       - Client stores CID + encrypted key on NEAR blockchain
       - Retrieval: fetch from IPFS by CID, decrypt with key

    Use ChaCha20-Poly1305 instead of AES-GCM (faster in software, timing-attack resistant, audited).
    Use @noble/ciphers instead of tweetnacl or custom crypto (modern, audited, no dependencies).
    Use authenticated encryption (AEAD) to detect tampering.

    Don't hand-roll: encryption algorithms (use @noble/ciphers audited implementation), random number generation (use crypto.getRandomValues()), key derivation (generate random keys for simplicity in v1).
  </action>
  <verify>
    - Encrypt test data with random key
    - Decrypt with same key produces original data
    - Decrypt with wrong key throws error or produces invalid data
    - Modified ciphertext fails decryption (authentication)
    - Same plaintext with different keys produces different ciphertext
  </verify>
  <done>Client-side encryption functional with ChaCha20-Poly1305, encryption/decryption works correctly, authenticated encryption detects tampering, random key generation secure</done>
</task>

<task type="auto">
  <name>Task 3: Add document registry to NEAR contract with encrypted key storage</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/document.rs, near-contracts/tests/integration.rs</files>
  <action>
    Extend NEAR smart contract to store IPFS document metadata with access control:

    1. Create src/document.rs module:
       - Document struct with fields:
         * cid: String (IPFS content identifier)
         * classification: String (UNCLASS, SECRET, etc.)
         * encrypted_key: String (base64-encoded encryption key)
         * owner: AccountId
         * created_at: u64 (block timestamp)
         * metadata: HashMap<String, String>

       - DocumentRegistry struct:
         * documents: UnorderedMap<String, Document> (CID → Document)
         * user_documents: LookupMap<AccountId, Vec<String>> (User → CID list)

    2. Add to Contract in lib.rs:
       - register_document method:
         * Validates caller is authenticated
         * Requires non-empty CID and classification
         * Stores Document in registry
         * Updates user_documents index
         * Emits event log
         * Returns success

       - get_document method (view):
         * Accepts CID
         * Returns Document if exists
         * Returns None if not found

       - list_user_documents method (view):
         * Accepts AccountId
         * Returns Vec<Document> for that user
         * Pagination support (offset, limit)

    3. Add to integration tests:
       - Test register_document with valid CID
       - Test get_document retrieval
       - Test access control (only owner can register)
       - Test list_user_documents pagination

    Use UnorderedMap for documents (efficient key-value storage).
    Use LookupMap for user index (efficient lookups, not iterable).
    Validate inputs with require! at method start (fail fast).

    Don't hand-roll: access control will be enhanced in Phase 2 with ABAC (basic owner-only for now), pagination logic (use offset/limit pattern), event logging (use env::log_str with structured format).
  </action>
  <verify>
    - cargo near build succeeds
    - cargo test passes all document registry tests
    - Can register document with CID and retrieve it
    - list_user_documents returns correct documents
    - Invalid CID registration fails with clear error
  </verify>
  <done>Document registry integrated into NEAR contract, CID storage functional, owner-based access control working, pagination implemented, integration tests passing</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] IPFS uploads succeed and return valid CIDs
- [ ] Client-side encryption/decryption works correctly
- [ ] NEAR contract stores document metadata with CIDs
- [ ] End-to-end flow: encrypt → upload IPFS → store CID on-chain → retrieve CID → download IPFS → decrypt
- [ ] Content addressing verified (same file = same CID)
- [ ] Authenticated encryption detects tampering
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from build or tests
- IPFS storage fully operational with Web3.Storage backend
- Client-side encryption using audited libraries
- NEAR contract document registry functional
- Complete upload/retrieval workflow validated
- Ready for Phala TEE integration in subsequent plans
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-03-SUMMARY.md`:

# Phase 1 Plan 3: IPFS Decentralized Storage Summary

**Decentralized encrypted storage with IPFS provides tamper-proof, resilient data layer with on-chain provenance**

## Accomplishments

- IPFS integration via Web3.Storage (managed IPFS + Filecoin)
- Client-side encryption using ChaCha20-Poly1305 AEAD cipher
- Document upload workflow: encrypt → IPFS → store CID on-chain
- Document retrieval workflow: fetch CID → download from IPFS → decrypt
- NEAR contract document registry with metadata and access control
- Content addressing verified (same content = same CID)
- Authenticated encryption detects tampering

## Files Created/Modified

- `frontend/src/lib/ipfs.ts` - IPFS client with upload/retrieval
- `frontend/src/lib/encryption.ts` - Client-side encryption utilities
- `near-contracts/src/document.rs` - Document registry module
- `near-contracts/src/lib.rs` - Contract methods for document management
- `near-contracts/tests/integration.rs` - Document registry tests
- `frontend/.env.local` - Web3.Storage API token configuration

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Ready for [1-04-PLAN.md](1-04-PLAN.md): Phala TEE Environment
</output>
