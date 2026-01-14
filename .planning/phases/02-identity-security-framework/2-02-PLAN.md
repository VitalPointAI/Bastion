---
phase: 02-identity-security-framework
plan: 02
type: execute
---

<objective>
Create the credential registry smart contract for on-chain verification of W3C Verifiable Credentials.

Purpose: Enable cryptographic proof of credential authenticity via blockchain, supporting credential anchoring, revocation, and status checking without storing sensitive credential content on-chain.

Output: Working credential registry smart contract with anchoring, revocation list, and status verification.
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
**Established patterns:** LookupMap collections, borsh serialization, state versioning
**Depends on:** Plan 2-01 (DID Registry) for issuer/subject DID validation

**From 2-RESEARCH.md:**
- Credential hash stored on-chain (not full credential content)
- W3C BitstringStatusListCredential pattern for revocation
- SHA256 hashing for credential fingerprints
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Credential Registry module with anchoring and revocation</name>
  <files>near-contracts/src/credential_registry.rs</files>
  <action>
Create new Rust module implementing credential registry for on-chain VC verification.

**Structures to implement:**

```rust
pub enum CredentialType {
    SecurityClearance,
    EntityAttribute,
    RoleAssignment,
    MissionAuthorization,
    CoalitionMembership,
    DerivativeData,        // For data splitting/redaction provenance
    Custom(String),
}

pub enum CredentialStatus {
    Active,
    Revoked,
    Suspended,
    Expired,
}

pub struct CredentialAnchor {
    pub credential_hash: String,      // SHA256 of full VC JSON
    pub credential_type: CredentialType,
    pub issuer_did: String,           // did:near:issuer.near
    pub subject_did: String,          // did:near:subject.near
    pub issuance_date: u64,
    pub expiration_date: Option<u64>,
    pub status: CredentialStatus,
    pub revocation_reason: Option<String>,
    pub metadata_hash: Option<String>, // Optional hash of non-sensitive metadata
}

pub struct CredentialRegistry {
    // Primary storage: hash -> anchor
    anchors: LookupMap<String, CredentialAnchor>,
    // Index: subject DID -> list of credential hashes
    subject_credentials: LookupMap<String, Vec<String>>,
    // Index: issuer DID -> list of credential hashes
    issuer_credentials: LookupMap<String, Vec<String>>,
    // Revocation list for efficient batch checking
    revocation_list: UnorderedSet<String>,
}
```

**Methods to implement:**
- `new()` - Initialize registry with storage prefixes
- `anchor_credential(credential_hash, credential_type, subject_did, expiration_date, metadata_hash)` - Anchor new credential (caller is issuer)
- `get_credential_anchor(credential_hash) -> Option<CredentialAnchor>` - Retrieve anchor by hash
- `verify_credential(credential_hash) -> CredentialStatus` - Check if credential is valid
- `revoke_credential(credential_hash, reason)` - Revoke credential (issuer only)
- `suspend_credential(credential_hash)` - Temporarily suspend (issuer only)
- `reinstate_credential(credential_hash)` - Reinstate suspended credential (issuer only)
- `get_subject_credentials(subject_did) -> Vec<CredentialAnchor>` - All credentials for subject
- `get_issuer_credentials(issuer_did) -> Vec<CredentialAnchor>` - All credentials by issuer
- `is_revoked(credential_hash) -> bool` - Quick revocation check
- `batch_verify(credential_hashes: Vec<String>) -> Vec<(String, CredentialStatus)>` - Batch status check

**Key implementation details:**
- Use `env::predecessor_account_id()` to derive issuer DID
- Credential hash is SHA256 of canonical JSON (computed off-chain, verified on-chain)
- Revocation is permanent, suspension is reversible
- Check expiration_date against `env::block_timestamp()` in verify_credential
- Only issuer can revoke/suspend their own credentials
- DerivativeData type supports the data splitting use case for later phases

**What to avoid:**
- Don't store actual credential content (only hashes for privacy)
- Don't allow non-issuers to modify credential status
- Don't allow reinstating revoked credentials (only suspended)
- Don't use String for credential_hash storage key (use fixed-size if possible, but String is acceptable for SHA256 hex)
  </action>
  <verify>cargo build -p near-contracts --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>Credential registry module compiles with anchoring, revocation, and batch verification support</done>
</task>

<task type="auto">
  <name>Task 2: Integrate credential registry into main contract with unit tests</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/credential_registry.rs</files>
  <action>
**Integrate into main contract:**

1. Add module declaration: `mod credential_registry;`
2. Add use statement: `use credential_registry::{CredentialAnchor, CredentialRegistry, CredentialType, CredentialStatus};`
3. Add to Contract struct: `credential_registry: CredentialRegistry,`
4. Initialize in `new()`: `credential_registry: CredentialRegistry::new(),`
5. Add to `migrate()` OldState struct and migration logic

**Add public methods to Contract impl:**
```rust
// Credential Registry methods
pub fn anchor_credential(
    &mut self,
    credential_hash: String,
    credential_type: CredentialType,
    subject_did: String,
    expiration_date: Option<u64>,
    metadata_hash: Option<String>
) -> bool

pub fn get_credential_anchor(&self, credential_hash: String) -> Option<CredentialAnchor>
pub fn verify_credential(&self, credential_hash: String) -> CredentialStatus
pub fn revoke_credential(&mut self, credential_hash: String, reason: String)
pub fn suspend_credential(&mut self, credential_hash: String)
pub fn reinstate_credential(&mut self, credential_hash: String)
pub fn get_subject_credentials(&self, subject_did: String) -> Vec<CredentialAnchor>
pub fn get_issuer_credentials(&self, issuer_did: String) -> Vec<CredentialAnchor>
pub fn is_credential_revoked(&self, credential_hash: String) -> bool
pub fn batch_verify_credentials(&self, credential_hashes: Vec<String>) -> Vec<(String, CredentialStatus)>
```

**Add unit tests in credential_registry.rs:**
```rust
#[cfg(test)]
mod tests {
    // Test anchor_credential creates valid anchor
    // Test verify_credential returns Active for valid credential
    // Test verify_credential returns Expired for expired credential
    // Test revoke_credential changes status and adds to revocation list
    // Test only issuer can revoke
    // Test suspend/reinstate cycle works
    // Test reinstate on revoked credential fails
    // Test subject_credentials index returns correct list
    // Test issuer_credentials index returns correct list
    // Test batch_verify returns correct statuses
}
```

**Test scenarios:**
1. Anchor credential → anchor stored, indexes updated
2. Verify active credential → returns Active
3. Verify expired credential → returns Expired (check block_timestamp)
4. Revoke credential → status=Revoked, in revocation_list
5. Non-issuer revoke attempt → panic "Not authorized"
6. Suspend credential → status=Suspended
7. Reinstate suspended → status=Active
8. Reinstate revoked → panic "Cannot reinstate revoked credential"
9. Get subject credentials → returns all credentials for DID
10. Batch verify → returns status for each hash
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/near-contracts && cargo test credential_registry -- --nocapture shows all tests passing</verify>
  <done>Credential registry integrated, all unit tests pass, on-chain verification ready</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build -p near-contracts --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test -p near-contracts` passes all tests including credential_registry tests
- [ ] Credential types include DerivativeData for future data splitting
- [ ] Revocation list enables efficient batch checking
- [ ] Only issuers can modify their credential status
</verification>

<success_criteria>
- Credential registry module created with anchoring and revocation
- On-chain verification of credential status working
- Batch verification for efficient multi-credential checks
- DerivativeData credential type ready for later phases
- All unit tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-02-SUMMARY.md`
</output>
