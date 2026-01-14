---
phase: 02-identity-security-framework
plan: 02
type: execute
---

<objective>
Create the credential registry smart contract for on-chain verification with encrypted storage and blinded references.

Purpose: Enable cryptographic proof of credential validity via blockchain while preventing anyone from correlating credentials to issuers, subjects, or discovering organizational relationships through on-chain data analysis.

Output: Working credential registry smart contract with encrypted anchors, blinded lookup keys, and revocation support.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-identity-security-framework/2-RESEARCH.md
@.planning/phases/02-identity-security-framework/2-CONTEXT.md
@near-contracts/src/lib.rs
@near-contracts/src/did_registry.rs

**Tech stack available:** near-sdk 5.x, Rust 1.85.0
**Established patterns:** Encrypted storage with blinded keys from Plan 2-01
**Depends on:** Plan 2-01 (Encrypted DID Registry pattern)

**CRITICAL SECURITY CONSTRAINT:**
NEAR blockchain is PUBLIC. For credentials:
- DON'T store plaintext issuer/subject DIDs (enables relationship mapping)
- DON'T store credential type in clear (reveals organizational structure)
- DON'T create subject→credential or issuer→credential indexes (association attack)
- DO use blinded credential IDs for lookup
- DO encrypt all credential metadata
- DO use separate blinded keys for revocation checks
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create encrypted Credential Registry module</name>
  <files>near-contracts/src/credential_registry.rs</files>
  <action>
Create new Rust module implementing encrypted credential registry with privacy-preserving storage.

**Security Model:**
- Credential content is encrypted off-chain before anchoring
- On-chain stores: `blinded_credential_id -> encrypted_anchor`
- Blinded credential ID = HKDF(issuer_secret, "credential", credential_hash)
- Revocation uses separate blinded key to prevent correlation
- No issuer/subject indexes (would reveal relationships)

**Structures to implement:**

```rust
/// Encrypted credential anchor - contract sees only opaque data
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct EncryptedCredentialAnchor {
    /// Hash of the full credential (for off-chain verification)
    /// This is a cryptographic commitment, not identifying info
    pub credential_hash: Vec<u8>,

    /// Encrypted credential metadata (type, issuer, subject - all encrypted)
    pub encrypted_metadata: Vec<u8>,

    /// Nonce for decryption
    pub nonce: Vec<u8>,

    /// Issuance timestamp (public - needed for expiry logic)
    pub issuance_date: u64,

    /// Optional expiration timestamp (public - needed for validity checks)
    pub expiration_date: Option<u64>,

    /// Status: 0=Active, 1=Revoked, 2=Suspended
    /// Public because revocation checks must work without decryption
    pub status: u8,

    /// Encrypted revocation reason (only meaningful when status != 0)
    pub encrypted_revocation_reason: Option<Vec<u8>>,

    /// Owner account who can modify this anchor
    pub owner: AccountId,
}

/// Registry stores encrypted credential anchors
pub struct CredentialRegistry {
    /// Primary storage: blinded_credential_id -> encrypted anchor
    anchors: LookupMap<Vec<u8>, EncryptedCredentialAnchor>,

    /// Owner's credential index: account_id -> list of blinded_credential_ids they own
    /// Owners can find their own issued credentials
    owner_credentials: LookupMap<AccountId, Vec<Vec<u8>>>,

    /// Revocation lookup: blinded_revocation_key -> blinded_credential_id
    /// Separate key so revocation checks don't reveal credential ID
    revocation_index: LookupMap<Vec<u8>, Vec<u8>>,

    /// NO subject_credentials index - would reveal who holds what
    /// NO issuer_credentials public index - would reveal issuing patterns
    /// NO credential_type index - would reveal organizational structure
}
```

**Methods to implement:**

```rust
impl CredentialRegistry {
    pub fn new() -> Self;

    /// Anchor an encrypted credential
    /// - blinded_credential_id: HKDF(secret, "credential", hash)
    /// - blinded_revocation_key: HKDF(secret, "revocation", hash) - different key!
    pub fn anchor_credential(
        &mut self,
        blinded_credential_id: Vec<u8>,
        blinded_revocation_key: Vec<u8>,
        credential_hash: Vec<u8>,
        encrypted_metadata: Vec<u8>,
        nonce: Vec<u8>,
        expiration_date: Option<u64>,
    );

    /// Get encrypted anchor by blinded ID
    pub fn get_anchor(&self, blinded_credential_id: Vec<u8>) -> Option<EncryptedCredentialAnchor>;

    /// Check credential status by revocation key (for validators)
    /// Returns status without revealing credential ID
    pub fn check_status(&self, blinded_revocation_key: Vec<u8>) -> Option<u8>;

    /// Verify credential is active (not revoked/suspended/expired)
    pub fn is_valid(&self, blinded_revocation_key: Vec<u8>) -> bool;

    /// Revoke credential (owner only)
    pub fn revoke_credential(
        &mut self,
        blinded_credential_id: Vec<u8>,
        encrypted_reason: Vec<u8>,
    );

    /// Suspend credential (owner only, reversible)
    pub fn suspend_credential(&mut self, blinded_credential_id: Vec<u8>);

    /// Reinstate suspended credential (owner only)
    pub fn reinstate_credential(&mut self, blinded_credential_id: Vec<u8>);

    /// Get caller's issued credential IDs (blinded)
    pub fn get_my_credentials(&self) -> Vec<Vec<u8>>;
}
```

**Key implementation details:**
- Status codes: 0=Active, 1=Revoked, 2=Suspended (simple u8 for gas efficiency)
- Two different blinded keys per credential (credential_id vs revocation_key)
- Revocation check uses revocation_key to avoid revealing credential_id
- Expiration checked against `env::block_timestamp_ms()`
- Only owner (issuer) can modify credential status
- Reinstating a Revoked credential panics (irreversible)

**What to avoid:**
- DON'T create subject_credentials index (reveals who holds what credentials)
- DON'T create credential_type index (reveals organizational structure)
- DON'T store plaintext issuer/subject DIDs anywhere
- DON'T allow enumeration of all credentials
- DON'T use same key for lookup and revocation check
  </action>
  <verify>cargo build -p near-contracts --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>Encrypted credential registry module compiles with privacy-preserving storage</done>
</task>

<task type="auto">
  <name>Task 2: Integrate encrypted credential registry into main contract with unit tests</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/credential_registry.rs</files>
  <action>
**Integrate into main contract:**

1. Add module declaration: `mod credential_registry;`
2. Add use statement: `use credential_registry::{EncryptedCredentialAnchor, CredentialRegistry};`
3. Add to Contract struct: `credential_registry: CredentialRegistry,`
4. Initialize in `new()`: `credential_registry: CredentialRegistry::new(),`
5. Add to `migrate()` OldState struct and migration logic

**Add public methods to Contract impl:**
```rust
// Encrypted Credential Registry methods
pub fn anchor_credential(
    &mut self,
    blinded_credential_id: Vec<u8>,
    blinded_revocation_key: Vec<u8>,
    credential_hash: Vec<u8>,
    encrypted_metadata: Vec<u8>,
    nonce: Vec<u8>,
    expiration_date: Option<u64>,
)

pub fn get_credential_anchor(&self, blinded_credential_id: Vec<u8>) -> Option<EncryptedCredentialAnchor>

pub fn check_credential_status(&self, blinded_revocation_key: Vec<u8>) -> Option<u8>

pub fn is_credential_valid(&self, blinded_revocation_key: Vec<u8>) -> bool

pub fn revoke_credential(&mut self, blinded_credential_id: Vec<u8>, encrypted_reason: Vec<u8>)

pub fn suspend_credential(&mut self, blinded_credential_id: Vec<u8>)

pub fn reinstate_credential(&mut self, blinded_credential_id: Vec<u8>)

pub fn get_my_issued_credentials(&self) -> Vec<Vec<u8>>
```

**Add unit tests in credential_registry.rs:**
```rust
#[cfg(test)]
mod tests {
    // Test anchor_credential stores encrypted entry
    // Test get_anchor retrieves correct encrypted blob
    // Test check_status works with revocation key
    // Test is_valid returns false for expired credentials
    // Test revoke_credential changes status to 1
    // Test only owner can revoke
    // Test suspend/reinstate cycle works
    // Test reinstate on revoked credential fails
    // Test get_my_credentials returns owner's credential IDs
    // Test different blinded keys work correctly
}
```

**Test scenarios (using mock encrypted data):**
1. Anchor credential → entry stored with both blinded keys
2. Get by blinded_credential_id → returns encrypted anchor
3. Check status by blinded_revocation_key → returns status code
4. Non-owner revoke attempt → panic with "Not authorized"
5. Revoke credential → status=1, reinstate fails
6. Suspend credential → status=2
7. Reinstate suspended → status=0
8. Expired credential → is_valid returns false
9. Owner credential list → returns blinded IDs

**Security verification in tests:**
- Verify revocation_key doesn't reveal credential_id
- Verify no plaintext issuer/subject in storage
- Verify owner_credentials only contains blinded IDs
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/near-contracts && cargo test credential_registry -- --nocapture shows all tests passing</verify>
  <done>Encrypted credential registry integrated, all unit tests pass, privacy preserved</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build -p near-contracts --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test -p near-contracts` passes all credential_registry tests
- [ ] NO plaintext issuer/subject DIDs stored on-chain
- [ ] NO subject_credentials or credential_type indexes exist
- [ ] Revocation checks use separate blinded key
- [ ] All credential metadata stored encrypted
</verification>

<success_criteria>
- Encrypted credential anchoring with blinded lookup
- Dual-key system (credential_id vs revocation_key)
- Revocation/suspension without revealing credential identity
- No indexes that reveal relationships
- All unit tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-02-SUMMARY.md`
</output>
