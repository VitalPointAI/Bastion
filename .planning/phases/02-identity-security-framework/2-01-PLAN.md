---
phase: 02-identity-security-framework
plan: 01
type: execute
---

<objective>
Create the universal DID registry smart contract on NEAR Protocol following the did:near specification.

Purpose: Establish the foundational identity layer where every entity type (human, AI agent, vehicle, mission, data object, organization, resource) gets a decentralized identifier with on-chain verification.

Output: Working DID registry smart contract with CRUD operations, entity type indexing, and unit tests.
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

**From 2-RESEARCH.md:**
- Follow Ontology DID-spec-near specification
- DID format: `did:near:{account_id}`
- DID documents contain publicKey array, authentication, controllers
- Entity types: human, ai_agent, vehicle, mission, data_object, organization, resource
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create DID Registry module with universal entity support</name>
  <files>near-contracts/src/did_registry.rs</files>
  <action>
Create new Rust module implementing universal DID registry following did:near specification.

**Structures to implement:**

```rust
pub enum EntityType {
    Human,
    AiAgent,
    Vehicle,
    Mission,
    DataObject,
    Organization,
    Resource,
}

pub struct PublicKeyEntry {
    pub id: String,           // did:near:alice.near#key-1
    pub key_type: String,     // Ed25519VerificationKey2020
    pub controller: String,   // did:near:alice.near
    pub public_key_base58: String,
}

pub struct DIDDocument {
    pub context: Vec<String>,
    pub id: String,           // did:near:alice.near
    pub entity_type: EntityType,
    pub public_keys: Vec<PublicKeyEntry>,
    pub authentication: Vec<String>,
    pub controllers: Vec<String>,
    pub service_endpoints: Vec<ServiceEndpoint>,
    pub created_at: u64,
    pub updated_at: u64,
    pub active: bool,
}

pub struct DIDRegistry {
    documents: LookupMap<String, DIDDocument>,
    owner_to_did: LookupMap<AccountId, String>,
    entity_type_index: LookupMap<EntityType, Vec<String>>,
}
```

**Methods to implement:**
- `new()` - Initialize registry with storage prefixes
- `register_did(entity_type: EntityType) -> String` - Create DID for caller using their account ID
- `register_did_for(account_id: AccountId, entity_type: EntityType) -> String` - Create DID for another account (owner only for non-human entities)
- `get_document(did: String) -> Option<DIDDocument>` - Resolve DID to document
- `get_did_by_account(account_id: AccountId) -> Option<String>` - Reverse lookup
- `get_dids_by_type(entity_type: EntityType) -> Vec<String>` - Query by entity type
- `update_document(did: String, updates: DIDDocumentUpdate)` - Update DID document (controller only)
- `add_public_key(did: String, key: PublicKeyEntry)` - Add verification method
- `remove_public_key(did: String, key_id: String)` - Remove verification method
- `deactivate_did(did: String)` - Soft-delete (controller only, irreversible per spec)
- `is_controller(did: String, account_id: AccountId) -> bool` - Check controller status

**Key implementation details:**
- Use `env::predecessor_account_id()` for caller identification
- Use `env::signer_account_pk()` to capture initial public key
- Use `env::block_timestamp()` for created_at/updated_at
- Store public keys as base58 encoded strings
- Entity type index enables efficient queries (e.g., "all AI agents")
- Context always includes "https://www.w3.org/ns/did/v1"

**What to avoid:**
- Don't store PII in DID documents (only verification methods and service endpoints)
- Don't allow reactivation of deactivated DIDs (per did:near spec)
- Don't use UnorderedMap for entity_type_index (Vec in LookupMap is more gas-efficient for reads)
  </action>
  <verify>cargo build -p near-contracts --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>DID registry module compiles, exports all specified methods, follows did:near specification</done>
</task>

<task type="auto">
  <name>Task 2: Integrate DID registry into main contract and add unit tests</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/did_registry.rs</files>
  <action>
**Integrate into main contract:**

1. Add module declaration: `mod did_registry;`
2. Add use statement: `use did_registry::{DIDDocument, DIDRegistry, EntityType, PublicKeyEntry};`
3. Add to Contract struct: `did_registry: DIDRegistry,`
4. Initialize in `new()`: `did_registry: DIDRegistry::new(),`
5. Add to `migrate()` OldState struct and migration logic

**Add public methods to Contract impl:**
```rust
// DID Registry methods
pub fn register_did(&mut self, entity_type: EntityType) -> String
pub fn register_did_for(&mut self, account_id: AccountId, entity_type: EntityType) -> String
pub fn get_did_document(&self, did: String) -> Option<DIDDocument>
pub fn get_did_by_account(&self, account_id: AccountId) -> Option<String>
pub fn get_dids_by_entity_type(&self, entity_type: EntityType) -> Vec<String>
pub fn update_did_document(&mut self, did: String, updates: DIDDocumentUpdate)
pub fn add_did_public_key(&mut self, did: String, key: PublicKeyEntry)
pub fn remove_did_public_key(&mut self, did: String, key_id: String)
pub fn deactivate_did(&mut self, did: String)
pub fn is_did_controller(&self, did: String, account_id: AccountId) -> bool
```

**Add unit tests in did_registry.rs:**
```rust
#[cfg(test)]
mod tests {
    // Test DID registration creates valid document
    // Test entity type indexing works correctly
    // Test only controller can update document
    // Test deactivation is irreversible
    // Test public key add/remove
    // Test duplicate DID registration fails
    // Test get_did_by_account reverse lookup
}
```

**Test scenarios:**
1. Register human DID → document created with correct format
2. Register AI agent DID → entity_type_index updated
3. Non-controller update attempt → panic with "Not authorized"
4. Deactivate DID → active=false, subsequent updates fail
5. Add public key → public_keys array grows
6. Remove public key → public_keys array shrinks
7. Duplicate registration → panic with "DID already registered"
  </action>
  <verify>cd /home/vitalpointai/projects/ssr/near-contracts && cargo test did_registry -- --nocapture shows all tests passing</verify>
  <done>DID registry integrated into main contract, all unit tests pass, WASM compiles successfully</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build -p near-contracts --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test -p near-contracts` passes all tests including new did_registry tests
- [ ] DID format follows `did:near:{account_id}` pattern
- [ ] All 7 entity types supported (Human, AiAgent, Vehicle, Mission, DataObject, Organization, Resource)
- [ ] Entity type indexing enables efficient queries
</verification>

<success_criteria>
- DID registry module created with full CRUD operations
- Universal entity type support implemented
- Unit tests validate all core functionality
- Contract compiles to WASM without errors
- Integration with main contract complete
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-01-SUMMARY.md`
</output>
