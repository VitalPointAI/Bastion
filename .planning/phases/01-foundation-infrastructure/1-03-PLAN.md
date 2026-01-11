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
  <name>Task 1: Set up IPFS infrastructure with Pinata for large data storage</name>
  <files>frontend/src/lib/ipfs.ts, frontend/package.json</files>
  <action>
    Configure IPFS storage infrastructure using Pinata for managing large data that's cost-prohibitive to store on-chain:

    1. Install IPFS dependencies: pnpm add pinata-web3 axios

    2. Register at pinata.cloud:
       - Create account at pinata.cloud
       - Generate API JWT from API Keys section
       - Note: Free tier provides sufficient storage for development
       - Dedicated gateways available for production

    3. Add to frontend/.env.local:
       - VITE_PINATA_JWT=[api_jwt]
       - VITE_PINATA_GATEWAY=[gateway_url] (optional, uses public gateway if not set)

    4. Create src/lib/ipfs.ts with:
       - initialize() function creating Pinata client with JWT
       - uploadFile(file: File) function:
         * Accepts File object (large documents, intelligence products, sensor data)
         * Uploads to IPFS via Pinata
         * Returns CID (content identifier)
         * Pins file automatically for persistence
       - retrieveFile(cid: string) function:
         * Fetches file from IPFS by CID via Pinata gateway
         * Returns file data as Uint8Array
       - Error handling for network failures

    5. Add type definitions:
       - IPFSUploadResult interface
       - IPFSClient type

    IPFS is for large data where on-chain storage costs are prohibitive (documents, mission plans, intelligence products, sensor feeds, training data).
    Smaller metadata, CIDs, and audit trails stay on-chain (encrypted) for provenance.
    Use Pinata instead of running local IPFS node (managed pinning, reliable gateways, production-ready infrastructure).
    Use content-addressed CIDs for tamper-proof integrity (any modification changes CID).

    Don't hand-roll: IPFS pinning services (Pinata handles automatic pinning), IPFS gateway infrastructure (use Pinata dedicated gateways), content addressing algorithms (built into IPFS).
  </action>
  <verify>
    - pnpm build succeeds without import errors
    - Upload test file via uploadFile() returns valid CID (format: bafybei... or Qm...)
    - Retrieve file via retrieveFile(cid) returns original file data
    - Same file uploaded twice produces same CID (content addressing works)
    - Different file produces different CID
    - File remains pinned (check Pinata dashboard)
  </verify>
  <done>IPFS client initialized with Pinata backend, large file upload returns CIDs with automatic pinning, file retrieval works via gateway, content addressing verified (same content = same CID)</done>
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
  <name>Task 3: Add encrypted document registry to NEAR contract</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/document.rs, near-contracts/tests/integration.rs</files>
  <action>
    Extend NEAR smart contract to store encrypted IPFS CIDs and metadata with access control:

    1. Create src/document.rs module:
       - Document struct with fields (ALL encrypted by default):
         * encrypted_cid: String (encrypted IPFS CID - actual content is off-chain in IPFS)
         * encrypted_classification: String (encrypted classification level)
         * encrypted_metadata_key: String (encrypted key for decrypting the content encryption key)
         * owner: AccountId (plaintext - needed for access control)
         * created_at: u64 (block timestamp - plaintext for sorting/filtering)
         * encrypted_metadata: String (encrypted JSON blob with additional metadata)

       - DocumentRegistry struct:
         * documents: UnorderedMap<String, Document> (document_id → Document)
         * user_documents: LookupMap<AccountId, Vec<String>> (User → document_id list)

    2. Add to Contract in lib.rs:
       - register_document method:
         * Validates caller is authenticated
         * Accepts ALL encrypted fields (encrypted_cid, encrypted_classification, etc.)
         * Stores Document in registry with encrypted data
         * Updates user_documents index
         * Emits event log with document_id only (not decrypted data)
         * Returns document_id

       - get_document method (view):
         * Accepts document_id
         * Returns Document with encrypted fields if exists
         * Caller must decrypt client-side
         * Returns None if not found

       - list_user_documents method (view):
         * Accepts AccountId
         * Returns Vec<Document> for that user (all fields still encrypted)
         * Pagination support (offset, limit)

    3. Add to integration tests:
       - Test register_document with encrypted fields
       - Test get_document retrieval returns encrypted data
       - Test access control (only owner can register)
       - Test list_user_documents pagination

    **Critical: ALL on-chain data encrypted by default.**
    - CIDs encrypted before storing on-chain (references to off-chain IPFS content)
    - Metadata encrypted before storing on-chain
    - Classification levels encrypted
    - Only owner AccountId and timestamps remain plaintext (required for access control and indexing)

    **Architecture:**
    - Large files → encrypted client-side → IPFS (off-chain, cost-effective)
    - IPFS CID → encrypted client-side → NEAR blockchain (on-chain for provenance/audit)
    - Metadata → encrypted client-side → NEAR blockchain (on-chain for searchability with privacy)

    Use UnorderedMap for documents (efficient key-value storage).
    Use LookupMap for user index (efficient lookups, not iterable).
    Validate inputs with require! at method start (fail fast).

    Don't hand-roll: access control will be enhanced in Phase 2 with ABAC (basic owner-only for now), pagination logic (use offset/limit pattern), event logging (use env::log_str with structured format), encryption (done client-side in Task 2).
  </action>
  <verify>
    - cargo near build succeeds
    - cargo test passes all document registry tests
    - Can register document with encrypted CID and retrieve it
    - Retrieved data still encrypted (client must decrypt)
    - list_user_documents returns encrypted documents
    - Invalid inputs fail with clear error
  </verify>
  <done>Encrypted document registry integrated into NEAR contract, encrypted CID storage functional (references to off-chain IPFS), owner-based access control working, all on-chain data encrypted by default, pagination implemented, integration tests passing</done>
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
- IPFS storage fully operational with Pinata backend for large data
- Client-side encryption using audited libraries
- NEAR contract encrypted document registry functional
- All on-chain data encrypted by default (CIDs, metadata, classification)
- Complete encrypted upload/retrieval workflow validated
- Architecture: large files off-chain (IPFS), encrypted CIDs on-chain (NEAR) for provenance
- Ready for Phala TEE integration in subsequent plans
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-03-SUMMARY.md`:

# Phase 1 Plan 3: IPFS Decentralized Storage Summary

**Decentralized encrypted storage with IPFS for large data, encrypted CIDs on-chain for provenance and auditability**

## Accomplishments

- IPFS integration via Pinata (managed pinning, dedicated gateways)
- Client-side encryption using ChaCha20-Poly1305 AEAD cipher
- Document upload workflow: encrypt large file → IPFS → encrypt CID → store on-chain
- Document retrieval workflow: fetch encrypted CID from chain → decrypt → download from IPFS → decrypt content
- NEAR contract encrypted document registry with all data encrypted by default
- Encrypted CIDs, metadata, and classification stored on-chain
- Only AccountId and timestamps plaintext (required for access control/indexing)
- Architecture: large files off-chain (IPFS), encrypted references on-chain (NEAR)
- Content addressing verified (same content = same CID)
- Authenticated encryption detects tampering

## Files Created/Modified

- `frontend/src/lib/ipfs.ts` - IPFS client with Pinata integration
- `frontend/src/lib/encryption.ts` - Client-side encryption utilities
- `near-contracts/src/document.rs` - Encrypted document registry module
- `near-contracts/src/lib.rs` - Contract methods for encrypted document management
- `near-contracts/tests/integration.rs` - Encrypted document registry tests
- `frontend/.env.local` - Pinata JWT and gateway configuration

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Ready for [1-04-PLAN.md](1-04-PLAN.md): Phala TEE Environment
</output>
