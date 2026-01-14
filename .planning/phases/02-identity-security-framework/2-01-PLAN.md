---
phase: 02-identity-security-framework
plan: 01
type: execute
---

<objective>
Create the universal DID registry smart contract on NEAR Protocol with encrypted on-chain storage.

Purpose: Establish the foundational identity layer where every entity type gets a decentralized identifier, while ensuring NO plaintext metadata is exposed on the public blockchain that could enable traffic analysis, association attacks, or organizational structure inference.

Output: Working DID registry smart contract with encrypted document storage, blinded indexes, and unit tests.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-identity-security-framework/2-RESEARCH.md
@.planning/phases/02-identity-security-framework/2-CONTEXT.md
@.planning/phases/01-foundation-infrastructure/1-01-SUMMARY.md
@near-contracts/src/lib.rs
@near-contracts/Cargo.toml

**Tech stack available:** near-sdk 5.x, Rust 1.85.0, cargo-near, WASM target
**Established patterns:** State versioning, LookupMap/UnorderedMap collections, borsh serialization
**Key constraint:** WASM bulk memory disabled via .cargo/config.toml

**CRITICAL SECURITY CONSTRAINT:**
NEAR blockchain is PUBLIC. Anyone can read all on-chain state. We MUST:
- Encrypt ALL DID document content before storing on-chain
- Use blinded/hashed identifiers for indexes (no plaintext DIDs as keys)
- Prevent association attacks (can't correlate entities to organizations/missions)
- Use post-quantum encryption for long-term security
- Store only encrypted blobs + lookup keys derived via KDF

**Architecture:**
- On-chain: Encrypted blobs indexed by blinded keys
- Off-chain: Decryption happens client-side or in TEE (Phala)
- Key management: Derived from user's NEAR keys via HKDF
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create encrypted DID Registry module with blinded storage</name>
  <files>near-contracts/src/did_registry.rs</files>
  <action>
Create new Rust module implementing encrypted DID registry with privacy-preserving on-chain storage.

**Security Model:**
- All DID document content is encrypted BEFORE submission to contract
- Contract stores: `blinded_key -> encrypted_blob`
- Blinded key = HKDF(user_secret, "did-lookup", account_id) - computed off-chain
- Contract CANNOT read document content (zero knowledge of what's stored)
- Only holder with correct key can retrieve and decrypt their DID document

**Structures to implement:**

```rust
/// Encrypted DID entry - contract sees only opaque encrypted data
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct EncryptedDIDEntry {
    /// PQ-encrypted DID document blob (encrypted off-chain)
    pub encrypted_document: Vec<u8>,
    /// Encrypted entity type (for owner's own indexing, not public query)
    pub encrypted_entity_type: Vec<u8>,
    /// Nonce used for encryption (needed for decryption)
    pub nonce: Vec<u8>,
    /// Timestamp (this is intentionally public for ordering/expiry)
    pub created_at: u64,
    pub updated_at: u64,
    /// Active status (public - needed for revocation checks)
    pub active: bool,
    /// Owner account (public - needed for access control)
    pub owner: AccountId,
}

/// Registry stores encrypted entries by blinded keys
pub struct DIDRegistry {
    /// Primary storage: blinded_key -> encrypted entry
    /// Blinded key is derived off-chain: HKDF(secret, "did", account_id)
    entries: LookupMap<Vec<u8>, EncryptedDIDEntry>,

    /// Owner index: account_id -> blinded_key
    /// Allows owner to find their own entry
    owner_index: LookupMap<AccountId, Vec<u8>>,

    /// NO entity_type_index - this would leak organizational structure
    /// Entity queries happen off-chain after decryption
}
```

**Methods to implement:**

```rust
impl DIDRegistry {
    pub fn new() -> Self;

    /// Store encrypted DID document
    /// - blinded_key: HKDF-derived lookup key (computed off-chain)
    /// - encrypted_document: PQ-encrypted DID document
    /// - encrypted_entity_type: PQ-encrypted entity type
    /// - nonce: Encryption nonce
    pub fn store_did(
        &mut self,
        blinded_key: Vec<u8>,
        encrypted_document: Vec<u8>,
        encrypted_entity_type: Vec<u8>,
        nonce: Vec<u8>,
    );

    /// Retrieve encrypted entry by blinded key
    /// Returns encrypted blob - decryption happens off-chain
    pub fn get_did(&self, blinded_key: Vec<u8>) -> Option<EncryptedDIDEntry>;

    /// Get blinded key for caller's DID (if registered)
    pub fn get_my_blinded_key(&self) -> Option<Vec<u8>>;

    /// Update encrypted document (owner only)
    pub fn update_did(
        &mut self,
        blinded_key: Vec<u8>,
        encrypted_document: Vec<u8>,
        nonce: Vec<u8>,
    );

    /// Deactivate DID (owner only, irreversible)
    pub fn deactivate_did(&mut self, blinded_key: Vec<u8>);

    /// Check if DID is active (public check for revocation)
    pub fn is_active(&self, blinded_key: Vec<u8>) -> bool;

    /// Check if caller owns a DID entry
    pub fn has_did(&self) -> bool;
}
```

**Key implementation details:**
- Use `env::predecessor_account_id()` for owner verification
- Blinded key is 32 bytes (output of HKDF-SHA256)
- Contract NEVER sees plaintext DID, entity type, or document content
- Only `created_at`, `updated_at`, `active`, and `owner` are public
- `owner` must be public for access control (can't encrypt it)
- Entity type queries NOT supported on-chain (would leak structure)

**What to avoid:**
- DON'T store plaintext DIDs as keys (enables correlation)
- DON'T create entity type indexes (leaks organizational structure)
- DON'T store any unencrypted metadata that reveals associations
- DON'T allow enumeration of all DIDs (privacy breach)
- DON'T log decrypted content in contract (it never sees it anyway)
  </action>
  <verify>cargo build -p near-contracts --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>Encrypted DID registry module compiles with privacy-preserving storage model</done>
</task>

<task type="auto">
  <name>Task 2: Integrate encrypted DID registry into main contract with unit tests</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/did_registry.rs</files>
  <action>
**Integrate into main contract:**

1. Add module declaration: `mod did_registry;`
2. Add use statement: `use did_registry::{EncryptedDIDEntry, DIDRegistry};`
3. Add to Contract struct: `did_registry: DIDRegistry,`
4. Initialize in `new()`: `did_registry: DIDRegistry::new(),`
5. Add to `migrate()` OldState struct and migration logic

**Add public methods to Contract impl:**
```rust
// Encrypted DID Registry methods
pub fn store_did(
    &mut self,
    blinded_key: Vec<u8>,
    encrypted_document: Vec<u8>,
    encrypted_entity_type: Vec<u8>,
    nonce: Vec<u8>,
)

pub fn get_did(&self, blinded_key: Vec<u8>) -> Option<EncryptedDIDEntry>

pub fn get_my_blinded_key(&self) -> Option<Vec<u8>>

pub fn update_did(
    &mut self,
    blinded_key: Vec<u8>,
    encrypted_document: Vec<u8>,
    nonce: Vec<u8>,
)

pub fn deactivate_did(&mut self, blinded_key: Vec<u8>)

pub fn is_did_active(&self, blinded_key: Vec<u8>) -> bool

pub fn has_did(&self) -> bool
```

**Add unit tests in did_registry.rs:**
```rust
#[cfg(test)]
mod tests {
    // Test store_did stores encrypted entry correctly
    // Test get_did retrieves correct encrypted blob
    // Test only owner can update their DID
    // Test only owner can deactivate their DID
    // Test deactivation is irreversible
    // Test duplicate registration fails
    // Test get_my_blinded_key returns correct key for owner
    // Test has_did returns true after registration
    // Test is_active returns false after deactivation
    // Test non-owner cannot update/deactivate
}
```

**Test scenarios (using mock encrypted data):**
1. Store encrypted DID → entry stored with blinded key
2. Get by blinded key → returns encrypted blob unchanged
3. Non-owner update attempt → panic with "Not authorized"
4. Deactivate DID → active=false, subsequent updates fail
5. Owner lookup → returns their blinded key
6. Duplicate store → panic with "DID already registered"
7. Active check → returns correct status

**Security verification in tests:**
- Verify contract never interprets encrypted content
- Verify owner_index maps to correct blinded key
- Verify no plaintext identity information in storage
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/near-contracts && cargo test did_registry -- --nocapture shows all tests passing</verify>
  <done>Encrypted DID registry integrated, all unit tests pass, WASM compiles successfully</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build -p near-contracts --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test -p near-contracts` passes all tests including did_registry tests
- [ ] NO plaintext DIDs stored on-chain (only blinded keys)
- [ ] NO entity type index exists (prevents organizational inference)
- [ ] Only owner, timestamps, and active status are public
- [ ] All document content stored encrypted
</verification>

<success_criteria>
- Encrypted DID registry with privacy-preserving storage
- Blinded key lookup prevents DID correlation
- No entity type indexes (protects organizational structure)
- Owner-only access control for updates/deactivation
- Unit tests validate security properties
- Contract compiles to WASM without errors
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-01-SUMMARY.md`
</output>
