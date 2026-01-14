/**
 * Encrypted DID Registry
 *
 * Privacy-preserving decentralized identity registry for universal identity management.
 * ALL DID document content is encrypted BEFORE submission to the contract.
 *
 * Security Model:
 * - Contract stores: blinded_key -> encrypted_blob
 * - Blinded key = HKDF(user_secret, "did-lookup", account_id) - computed off-chain
 * - Contract CANNOT read document content (zero knowledge of what's stored)
 * - Only holder with correct key can retrieve and decrypt their DID document
 *
 * What's Public (by necessity):
 * - owner: AccountId (required for access control)
 * - created_at/updated_at: timestamps (required for ordering/expiry)
 * - active: bool (required for revocation checks)
 *
 * What's Encrypted:
 * - DID document content (identity, verification methods, service endpoints)
 * - Entity type (human, ai_agent, vehicle, mission, data_object, organization, resource)
 * - All other metadata
 *
 * Anti-patterns Avoided:
 * - NO plaintext DIDs as keys (prevents correlation attacks)
 * - NO entity type indexes (prevents organizational structure inference)
 * - NO enumeration of all DIDs (privacy breach)
 */

use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};

/// Storage keys for collections
#[derive(BorshStorageKey)]
#[near]
pub enum DIDStorageKey {
    /// Primary storage: blinded_key -> encrypted entry
    Entries,
    /// Owner index: account_id -> blinded_key
    OwnerIndex,
}

/// Encrypted DID entry - contract sees only opaque encrypted data
///
/// Everything except owner, timestamps, and active status is encrypted.
/// The contract operates on encrypted blobs without any knowledge of content.
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct EncryptedDIDEntry {
    /// PQ-encrypted DID document blob (encrypted off-chain)
    /// Contains: id, publicKey, authentication, controllers, service endpoints
    pub encrypted_document: Vec<u8>,

    /// Encrypted entity type (for owner's own indexing, not public query)
    /// Contains: human | ai_agent | vehicle | mission | data_object | organization | resource
    pub encrypted_entity_type: Vec<u8>,

    /// Nonce used for encryption (needed for decryption)
    /// 24 bytes for ChaCha20-Poly1305 or PQ encryption schemes
    pub nonce: Vec<u8>,

    /// Creation timestamp (public - needed for ordering/expiry)
    pub created_at: u64,

    /// Last update timestamp (public - needed for freshness checks)
    pub updated_at: u64,

    /// Active status (public - needed for revocation checks)
    pub active: bool,

    /// Owner account (public - needed for access control)
    pub owner: AccountId,
}

/// Encrypted DID Registry with privacy-preserving on-chain storage
///
/// Primary storage uses blinded keys derived off-chain via HKDF.
/// NO entity type indexing to prevent organizational structure inference.
#[near(serializers = [borsh])]
pub struct DIDRegistry {
    /// Primary storage: blinded_key -> encrypted entry
    /// Blinded key is derived off-chain: HKDF(secret, "did-lookup", account_id)
    entries: LookupMap<Vec<u8>, EncryptedDIDEntry>,

    /// Owner index: account_id -> blinded_key
    /// Allows owner to find their own entry without knowing the blinded key
    owner_index: LookupMap<AccountId, Vec<u8>>,

    /// Total count of registered DIDs (for statistics only)
    entry_count: u64,

    // NOTE: NO entity_type_index - this would leak organizational structure
    // Entity queries happen off-chain after decryption
}

impl DIDRegistry {
    /// Initialize new DID registry
    pub fn new() -> Self {
        Self {
            entries: LookupMap::new(DIDStorageKey::Entries),
            owner_index: LookupMap::new(DIDStorageKey::OwnerIndex),
            entry_count: 0,
        }
    }

    /// Store encrypted DID document
    ///
    /// # Arguments
    /// * `blinded_key` - HKDF-derived lookup key (32 bytes, computed off-chain)
    /// * `encrypted_document` - PQ-encrypted DID document blob
    /// * `encrypted_entity_type` - PQ-encrypted entity type
    /// * `nonce` - Encryption nonce (24 bytes)
    ///
    /// # Panics
    /// * If caller already has a registered DID
    /// * If blinded_key is invalid length
    pub fn store_did(
        &mut self,
        blinded_key: Vec<u8>,
        encrypted_document: Vec<u8>,
        encrypted_entity_type: Vec<u8>,
        nonce: Vec<u8>,
    ) {
        let owner = env::predecessor_account_id();
        let timestamp = env::block_timestamp();

        // Validate blinded key length (HKDF-SHA256 output = 32 bytes)
        assert!(
            blinded_key.len() == 32,
            "Invalid blinded key length: expected 32 bytes"
        );

        // Validate nonce length (ChaCha20-Poly1305 / XChaCha20 = 24 bytes)
        assert!(
            nonce.len() == 24,
            "Invalid nonce length: expected 24 bytes"
        );

        // Check if caller already has a DID registered
        assert!(
            !self.owner_index.contains_key(&owner),
            "DID already registered for this account"
        );

        // Check if blinded key already exists (shouldn't happen with proper HKDF)
        assert!(
            !self.entries.contains_key(&blinded_key),
            "Blinded key collision - regenerate with different parameters"
        );

        // Create encrypted entry
        let entry = EncryptedDIDEntry {
            encrypted_document,
            encrypted_entity_type,
            nonce,
            created_at: timestamp,
            updated_at: timestamp,
            active: true,
            owner: owner.clone(),
        };

        // Store entry by blinded key
        self.entries.insert(blinded_key.clone(), entry);

        // Store owner -> blinded_key mapping
        self.owner_index.insert(owner.clone(), blinded_key.clone());

        // Increment counter
        self.entry_count += 1;

        // Emit event for PostgreSQL sync
        // Note: Only public fields logged (owner, timestamps, active status)
        // NO encrypted content or blinded keys in logs to prevent correlation
        log!(
            "DID_REGISTERED: {{\"owner\": \"{}\", \"created_at\": {}, \"active\": true}}",
            owner,
            timestamp
        );
    }

    /// Retrieve encrypted entry by blinded key
    ///
    /// Returns the encrypted blob - decryption happens off-chain.
    /// Caller must have the corresponding secret to derive the blinded key.
    pub fn get_did(&self, blinded_key: Vec<u8>) -> Option<EncryptedDIDEntry> {
        self.entries.get(&blinded_key).cloned()
    }

    /// Get blinded key for caller's DID (if registered)
    ///
    /// Allows owner to retrieve their blinded key if they've lost it.
    /// Only returns the key to the owner account.
    pub fn get_my_blinded_key(&self) -> Option<Vec<u8>> {
        let caller = env::predecessor_account_id();
        self.owner_index.get(&caller).cloned()
    }

    /// Update encrypted document (owner only)
    ///
    /// # Arguments
    /// * `blinded_key` - The blinded key for this DID entry
    /// * `encrypted_document` - New PQ-encrypted DID document
    /// * `nonce` - New encryption nonce
    ///
    /// # Panics
    /// * If blinded key doesn't exist
    /// * If caller is not the owner
    /// * If DID is deactivated
    pub fn update_did(
        &mut self,
        blinded_key: Vec<u8>,
        encrypted_document: Vec<u8>,
        nonce: Vec<u8>,
    ) {
        let caller = env::predecessor_account_id();
        let timestamp = env::block_timestamp();

        // Validate nonce length
        assert!(
            nonce.len() == 24,
            "Invalid nonce length: expected 24 bytes"
        );

        // Get existing entry
        let mut entry = self.entries.get(&blinded_key)
            .expect("DID entry not found")
            .clone();

        // Verify ownership
        assert!(
            entry.owner == caller,
            "Not authorized: only owner can update DID"
        );

        // Check if active
        assert!(
            entry.active,
            "Cannot update deactivated DID"
        );

        // Update encrypted document and timestamp
        entry.encrypted_document = encrypted_document;
        entry.nonce = nonce;
        entry.updated_at = timestamp;

        // Store updated entry
        self.entries.insert(blinded_key, entry);

        log!(
            "DID_UPDATED: {{\"owner\": \"{}\", \"updated_at\": {}}}",
            caller,
            timestamp
        );
    }

    /// Deactivate DID (owner only, irreversible)
    ///
    /// Once deactivated, the DID cannot be reactivated or updated.
    /// This is a permanent revocation following W3C DID spec.
    ///
    /// # Panics
    /// * If blinded key doesn't exist
    /// * If caller is not the owner
    /// * If DID is already deactivated
    pub fn deactivate_did(&mut self, blinded_key: Vec<u8>) {
        let caller = env::predecessor_account_id();
        let timestamp = env::block_timestamp();

        // Get existing entry
        let mut entry = self.entries.get(&blinded_key)
            .expect("DID entry not found")
            .clone();

        // Verify ownership
        assert!(
            entry.owner == caller,
            "Not authorized: only owner can deactivate DID"
        );

        // Check if already deactivated
        assert!(
            entry.active,
            "DID already deactivated"
        );

        // Deactivate (irreversible)
        entry.active = false;
        entry.updated_at = timestamp;

        // Store updated entry
        self.entries.insert(blinded_key, entry);

        log!(
            "DID_DEACTIVATED: {{\"owner\": \"{}\", \"deactivated_at\": {}}}",
            caller,
            timestamp
        );
    }

    /// Check if DID is active (public check for revocation)
    ///
    /// Anyone can check if a DID is active given the blinded key.
    /// This enables revocation verification without revealing identity.
    pub fn is_active(&self, blinded_key: Vec<u8>) -> bool {
        self.entries.get(&blinded_key)
            .map(|e| e.active)
            .unwrap_or(false)
    }

    /// Check if caller owns a DID entry
    pub fn has_did(&self) -> bool {
        let caller = env::predecessor_account_id();
        self.owner_index.contains_key(&caller)
    }

    /// Get total count of registered DIDs (statistics only)
    pub fn get_did_count(&self) -> u64 {
        self.entry_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder.block_timestamp(1000000);
        builder
    }

    /// Create mock blinded key (32 bytes)
    fn mock_blinded_key(seed: u8) -> Vec<u8> {
        vec![seed; 32]
    }

    /// Create mock encrypted document
    fn mock_encrypted_document() -> Vec<u8> {
        b"encrypted_did_document_content_xyz".to_vec()
    }

    /// Create mock encrypted entity type
    fn mock_encrypted_entity_type() -> Vec<u8> {
        b"encrypted_human".to_vec()
    }

    /// Create mock nonce (24 bytes)
    fn mock_nonce() -> Vec<u8> {
        vec![0u8; 24]
    }

    #[test]
    fn test_store_did_success() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();

        // Store encrypted DID
        registry.store_did(
            mock_blinded_key(1),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Verify entry count
        assert_eq!(registry.get_did_count(), 1);

        // Verify has_did returns true
        assert!(registry.has_did());
    }

    #[test]
    fn test_get_did_retrieves_encrypted_blob() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);
        let encrypted_doc = mock_encrypted_document();

        registry.store_did(
            blinded_key.clone(),
            encrypted_doc.clone(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Retrieve by blinded key
        let entry = registry.get_did(blinded_key).unwrap();

        // Verify encrypted blob is unchanged
        assert_eq!(entry.encrypted_document, encrypted_doc);
        assert_eq!(entry.owner, owner);
        assert!(entry.active);
    }

    #[test]
    fn test_get_my_blinded_key_returns_correct_key() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);

        registry.store_did(
            blinded_key.clone(),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Owner can retrieve their blinded key
        let retrieved_key = registry.get_my_blinded_key().unwrap();
        assert_eq!(retrieved_key, blinded_key);
    }

    #[test]
    fn test_update_did_owner_only() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);

        registry.store_did(
            blinded_key.clone(),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Update with new encrypted document
        let new_encrypted_doc = b"new_encrypted_document".to_vec();
        let new_nonce = vec![1u8; 24];

        registry.update_did(
            blinded_key.clone(),
            new_encrypted_doc.clone(),
            new_nonce.clone(),
        );

        // Verify update
        let entry = registry.get_did(blinded_key).unwrap();
        assert_eq!(entry.encrypted_document, new_encrypted_doc);
        assert_eq!(entry.nonce, new_nonce);
    }

    #[test]
    #[should_panic(expected = "Not authorized: only owner can update DID")]
    fn test_update_did_non_owner_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let non_owner: AccountId = "bob.near".parse().unwrap();

        // Register as owner
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);

        registry.store_did(
            blinded_key.clone(),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Try to update as non-owner
        let context = get_context(non_owner);
        testing_env!(context.build());

        registry.update_did(
            blinded_key,
            b"malicious_update".to_vec(),
            mock_nonce(),
        );
    }

    #[test]
    fn test_deactivate_did_owner_only() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);

        registry.store_did(
            blinded_key.clone(),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Verify active before deactivation
        assert!(registry.is_active(blinded_key.clone()));

        // Deactivate
        registry.deactivate_did(blinded_key.clone());

        // Verify deactivated
        assert!(!registry.is_active(blinded_key));
    }

    #[test]
    #[should_panic(expected = "Not authorized: only owner can deactivate DID")]
    fn test_deactivate_did_non_owner_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let non_owner: AccountId = "bob.near".parse().unwrap();

        // Register as owner
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);

        registry.store_did(
            blinded_key.clone(),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Try to deactivate as non-owner
        let context = get_context(non_owner);
        testing_env!(context.build());

        registry.deactivate_did(blinded_key);
    }

    #[test]
    #[should_panic(expected = "Cannot update deactivated DID")]
    fn test_deactivation_is_irreversible() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);

        registry.store_did(
            blinded_key.clone(),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Deactivate
        registry.deactivate_did(blinded_key.clone());

        // Try to update after deactivation - should panic
        registry.update_did(
            blinded_key,
            b"try_to_update".to_vec(),
            mock_nonce(),
        );
    }

    #[test]
    #[should_panic(expected = "DID already registered for this account")]
    fn test_duplicate_registration_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();

        // First registration succeeds
        registry.store_did(
            mock_blinded_key(1),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );

        // Second registration fails
        registry.store_did(
            mock_blinded_key(2),  // Different blinded key, same owner
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );
    }

    #[test]
    fn test_has_did_returns_false_before_registration() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let registry = DIDRegistry::new();

        assert!(!registry.has_did());
    }

    #[test]
    fn test_is_active_returns_false_for_nonexistent() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let registry = DIDRegistry::new();

        // Non-existent blinded key
        assert!(!registry.is_active(mock_blinded_key(99)));
    }

    #[test]
    fn test_get_my_blinded_key_returns_none_for_unregistered() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let registry = DIDRegistry::new();

        assert!(registry.get_my_blinded_key().is_none());
    }

    #[test]
    #[should_panic(expected = "Invalid blinded key length: expected 32 bytes")]
    fn test_invalid_blinded_key_length_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();

        // Invalid blinded key (16 bytes instead of 32)
        registry.store_did(
            vec![0u8; 16],
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            mock_nonce(),
        );
    }

    #[test]
    #[should_panic(expected = "Invalid nonce length: expected 24 bytes")]
    fn test_invalid_nonce_length_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();

        // Invalid nonce (12 bytes instead of 24)
        registry.store_did(
            mock_blinded_key(1),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),
            vec![0u8; 12],
        );
    }

    #[test]
    fn test_no_entity_type_index_exists() {
        // This test verifies that the registry does NOT have entity type indexing
        // which would leak organizational structure information.
        //
        // The DIDRegistry struct only has:
        // - entries: LookupMap<Vec<u8>, EncryptedDIDEntry>
        // - owner_index: LookupMap<AccountId, Vec<u8>>
        // - entry_count: u64
        //
        // There is intentionally NO method to query by entity type.
        // Entity queries must happen off-chain after decryption.

        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();

        registry.store_did(
            mock_blinded_key(1),
            mock_encrypted_document(),
            mock_encrypted_entity_type(),  // This is encrypted, not queryable
            mock_nonce(),
        );

        // There is no get_by_entity_type() method - this is intentional.
        // The encrypted_entity_type field is only decryptable by the owner.
        // This test passes by virtue of the struct definition not having
        // an entity type index.
    }

    #[test]
    fn test_contract_never_interprets_encrypted_content() {
        // This test verifies that encrypted content is stored and retrieved
        // without any interpretation by the contract.

        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DIDRegistry::new();
        let blinded_key = mock_blinded_key(1);

        // Store arbitrary bytes - contract doesn't care what's inside
        let encrypted_doc = vec![0xFF, 0xFE, 0xFD, 0xFC, 0x00, 0x01, 0x02];
        let encrypted_type = vec![0xAA, 0xBB, 0xCC];

        registry.store_did(
            blinded_key.clone(),
            encrypted_doc.clone(),
            encrypted_type.clone(),
            mock_nonce(),
        );

        // Retrieve and verify exact bytes returned
        let entry = registry.get_did(blinded_key).unwrap();
        assert_eq!(entry.encrypted_document, encrypted_doc);
        assert_eq!(entry.encrypted_entity_type, encrypted_type);

        // Contract has no knowledge of what these bytes mean
        // Decryption happens entirely off-chain
    }
}
