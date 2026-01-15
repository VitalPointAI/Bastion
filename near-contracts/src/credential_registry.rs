/**
 * Encrypted Credential Registry
 *
 * Privacy-preserving credential anchor registry for on-chain verification
 * with encrypted storage and blinded references.
 *
 * Security Model:
 * - Credential content is encrypted off-chain before anchoring
 * - On-chain stores: blinded_credential_id -> encrypted_anchor
 * - Blinded credential ID = HKDF(issuer_secret, "credential", credential_hash)
 * - Revocation uses separate blinded key to prevent correlation
 * - No issuer/subject indexes (would reveal relationships)
 *
 * What's Public (by necessity):
 * - owner: AccountId (issuer - required for access control)
 * - issuance_date/expiration_date: timestamps (required for validity checks)
 * - status: u8 (required for revocation checks without decryption)
 *
 * What's Encrypted:
 * - credential_hash: cryptographic commitment to full credential
 * - credential metadata (type, issuer DID, subject DID - all encrypted)
 * - revocation_reason (if applicable)
 *
 * Anti-patterns Avoided:
 * - NO plaintext issuer/subject DIDs stored on-chain
 * - NO subject_credentials index (reveals who holds what)
 * - NO issuer_credentials public index (reveals issuing patterns)
 * - NO credential_type index (reveals organizational structure)
 * - NO enumeration of all credentials
 * - Same key NOT used for both lookup and revocation check
 */

use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};

/// Status codes for credential state
pub const STATUS_ACTIVE: u8 = 0;
pub const STATUS_REVOKED: u8 = 1;
pub const STATUS_SUSPENDED: u8 = 2;

/// Storage keys for collections
#[derive(BorshStorageKey)]
#[near]
pub enum CredentialStorageKey {
    /// Primary storage: blinded_credential_id -> encrypted anchor
    Anchors,
    /// Owner's credential index: account_id -> list of blinded_credential_ids
    OwnerCredentials,
    /// Revocation lookup: blinded_revocation_key -> blinded_credential_id
    RevocationIndex,
}

/// Encrypted credential anchor - contract sees only opaque data
///
/// Everything except owner, timestamps, and status is encrypted or hashed.
/// The contract operates on encrypted blobs without any knowledge of content.
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct EncryptedCredentialAnchor {
    /// Hash of the full credential (for off-chain verification)
    /// This is a cryptographic commitment, not identifying info
    pub credential_hash: Vec<u8>,

    /// Encrypted credential metadata (type, issuer, subject - all encrypted)
    pub encrypted_metadata: Vec<u8>,

    /// Nonce for decryption (24 bytes for ChaCha20-Poly1305 / XChaCha20)
    pub nonce: Vec<u8>,

    /// Issuance timestamp (public - needed for ordering/expiry logic)
    pub issuance_date: u64,

    /// Optional expiration timestamp (public - needed for validity checks)
    pub expiration_date: Option<u64>,

    /// Status: 0=Active, 1=Revoked, 2=Suspended
    /// Public because revocation checks must work without decryption
    pub status: u8,

    /// Encrypted revocation reason (only meaningful when status != 0)
    pub encrypted_revocation_reason: Option<Vec<u8>>,

    /// Owner account (issuer) who can modify this anchor
    pub owner: AccountId,
}

/// Encrypted Credential Registry with privacy-preserving on-chain storage
///
/// Primary storage uses blinded keys derived off-chain via HKDF.
/// Dual-key system: credential_id for lookup, revocation_key for status checks.
/// NO subject/issuer/type indexing to prevent relationship inference.
#[near(serializers = [borsh])]
pub struct CredentialRegistry {
    /// Primary storage: blinded_credential_id -> encrypted anchor
    /// Blinded key is derived off-chain: HKDF(secret, "credential", hash)
    anchors: LookupMap<Vec<u8>, EncryptedCredentialAnchor>,

    /// Owner's credential index: account_id -> list of blinded_credential_ids
    /// Owners can find their own issued credentials
    owner_credentials: LookupMap<AccountId, Vec<Vec<u8>>>,

    /// Revocation lookup: blinded_revocation_key -> blinded_credential_id
    /// Separate key so revocation checks don't reveal credential ID
    revocation_index: LookupMap<Vec<u8>, Vec<u8>>,

    /// Total count of anchored credentials (for statistics only)
    anchor_count: u64,

    // NOTE: NO subject_credentials index - would reveal who holds what credentials
    // NOTE: NO issuer_credentials public index - would reveal issuing patterns
    // NOTE: NO credential_type index - would reveal organizational structure
}

impl CredentialRegistry {
    /// Initialize new credential registry
    pub fn new() -> Self {
        Self {
            anchors: LookupMap::new(CredentialStorageKey::Anchors),
            owner_credentials: LookupMap::new(CredentialStorageKey::OwnerCredentials),
            revocation_index: LookupMap::new(CredentialStorageKey::RevocationIndex),
            anchor_count: 0,
        }
    }

    /// Anchor an encrypted credential
    ///
    /// # Arguments
    /// * `blinded_credential_id` - HKDF(secret, "credential", hash) - 32 bytes
    /// * `blinded_revocation_key` - HKDF(secret, "revocation", hash) - 32 bytes, DIFFERENT key
    /// * `credential_hash` - Hash of the full credential for off-chain verification
    /// * `encrypted_metadata` - Encrypted credential metadata (type, issuer, subject)
    /// * `nonce` - Encryption nonce (24 bytes)
    /// * `expiration_date` - Optional expiration timestamp
    ///
    /// # Panics
    /// * If blinded_credential_id is invalid length
    /// * If blinded_revocation_key is invalid length
    /// * If nonce is invalid length
    /// * If credential already exists with this blinded_credential_id
    pub fn anchor_credential(
        &mut self,
        blinded_credential_id: Vec<u8>,
        blinded_revocation_key: Vec<u8>,
        credential_hash: Vec<u8>,
        encrypted_metadata: Vec<u8>,
        nonce: Vec<u8>,
        expiration_date: Option<u64>,
    ) {
        let owner = env::predecessor_account_id();
        let timestamp = env::block_timestamp_ms();

        // Validate blinded credential ID length (HKDF-SHA256 output = 32 bytes)
        assert!(
            blinded_credential_id.len() == 32,
            "Invalid blinded_credential_id length: expected 32 bytes"
        );

        // Validate blinded revocation key length (HKDF-SHA256 output = 32 bytes)
        assert!(
            blinded_revocation_key.len() == 32,
            "Invalid blinded_revocation_key length: expected 32 bytes"
        );

        // Ensure credential_id and revocation_key are different
        assert!(
            blinded_credential_id != blinded_revocation_key,
            "Credential ID and revocation key must be different"
        );

        // Validate nonce length (ChaCha20-Poly1305 / XChaCha20 = 24 bytes)
        assert!(
            nonce.len() == 24,
            "Invalid nonce length: expected 24 bytes"
        );

        // Check if credential already exists
        assert!(
            !self.anchors.contains_key(&blinded_credential_id),
            "Credential already anchored with this blinded ID"
        );

        // Check if revocation key already used
        assert!(
            !self.revocation_index.contains_key(&blinded_revocation_key),
            "Revocation key already in use"
        );

        // Create encrypted anchor
        let anchor = EncryptedCredentialAnchor {
            credential_hash,
            encrypted_metadata,
            nonce,
            issuance_date: timestamp,
            expiration_date,
            status: STATUS_ACTIVE,
            encrypted_revocation_reason: None,
            owner: owner.clone(),
        };

        // Store anchor by blinded credential ID
        self.anchors.insert(blinded_credential_id.clone(), anchor);

        // Store revocation_key -> credential_id mapping
        self.revocation_index.insert(blinded_revocation_key, blinded_credential_id.clone());

        // Add to owner's credential list
        let mut owner_creds = self.owner_credentials.get(&owner).cloned().unwrap_or_default();
        owner_creds.push(blinded_credential_id.clone());
        self.owner_credentials.insert(owner.clone(), owner_creds);

        // Increment counter
        self.anchor_count += 1;

        // Emit event for sync
        // Note: Only public fields logged (owner, timestamps, status)
        // NO encrypted content or blinded keys in logs to prevent correlation
        log!(
            "CREDENTIAL_ANCHORED: {{\"owner\": \"{}\", \"issuance_date\": {}, \"status\": 0}}",
            owner,
            timestamp
        );
    }

    /// Get encrypted anchor by blinded credential ID
    ///
    /// Returns the encrypted blob - decryption happens off-chain.
    /// Caller must have the corresponding secret to derive the blinded key.
    pub fn get_anchor(&self, blinded_credential_id: Vec<u8>) -> Option<EncryptedCredentialAnchor> {
        self.anchors.get(&blinded_credential_id).cloned()
    }

    /// Check credential status by revocation key (for validators)
    ///
    /// Returns status without revealing credential ID.
    /// This enables revocation checks without disclosing which credential.
    pub fn check_status(&self, blinded_revocation_key: Vec<u8>) -> Option<u8> {
        // Look up credential ID from revocation key
        let credential_id = self.revocation_index.get(&blinded_revocation_key)?;

        // Get anchor and return status
        self.anchors.get(credential_id).map(|a| a.status)
    }

    /// Verify credential is active (not revoked/suspended/expired)
    ///
    /// Returns true only if:
    /// - Credential exists
    /// - Status is Active (0)
    /// - Not expired (if expiration_date set)
    pub fn is_valid(&self, blinded_revocation_key: Vec<u8>) -> bool {
        // Look up credential ID from revocation key
        let credential_id = match self.revocation_index.get(&blinded_revocation_key) {
            Some(id) => id,
            None => return false,
        };

        // Get anchor
        let anchor = match self.anchors.get(credential_id) {
            Some(a) => a,
            None => return false,
        };

        // Check status is Active
        if anchor.status != STATUS_ACTIVE {
            return false;
        }

        // Check expiration if set
        if let Some(expiration) = anchor.expiration_date {
            let now = env::block_timestamp_ms();
            if now > expiration {
                return false;
            }
        }

        true
    }

    /// Revoke credential (owner only, irreversible)
    ///
    /// Once revoked, the credential cannot be reinstated.
    /// This is permanent revocation.
    ///
    /// # Panics
    /// * If credential doesn't exist
    /// * If caller is not the owner
    /// * If credential is already revoked
    pub fn revoke_credential(
        &mut self,
        blinded_credential_id: Vec<u8>,
        encrypted_reason: Vec<u8>,
    ) {
        let caller = env::predecessor_account_id();

        // Get existing anchor
        let mut anchor = self.anchors.get(&blinded_credential_id)
            .expect("Credential not found")
            .clone();

        // Verify ownership
        assert!(
            anchor.owner == caller,
            "Not authorized: only owner can revoke credential"
        );

        // Check not already revoked
        assert!(
            anchor.status != STATUS_REVOKED,
            "Credential already revoked"
        );

        // Revoke (irreversible)
        anchor.status = STATUS_REVOKED;
        anchor.encrypted_revocation_reason = Some(encrypted_reason);

        // Store updated anchor
        self.anchors.insert(blinded_credential_id, anchor);

        log!(
            "CREDENTIAL_REVOKED: {{\"owner\": \"{}\", \"revoked_at\": {}}}",
            caller,
            env::block_timestamp_ms()
        );
    }

    /// Suspend credential (owner only, reversible)
    ///
    /// Suspended credentials can be reinstated by the owner.
    ///
    /// # Panics
    /// * If credential doesn't exist
    /// * If caller is not the owner
    /// * If credential is revoked (cannot suspend revoked)
    /// * If credential is already suspended
    pub fn suspend_credential(&mut self, blinded_credential_id: Vec<u8>) {
        let caller = env::predecessor_account_id();

        // Get existing anchor
        let mut anchor = self.anchors.get(&blinded_credential_id)
            .expect("Credential not found")
            .clone();

        // Verify ownership
        assert!(
            anchor.owner == caller,
            "Not authorized: only owner can suspend credential"
        );

        // Check status allows suspension
        assert!(
            anchor.status != STATUS_REVOKED,
            "Cannot suspend revoked credential"
        );

        assert!(
            anchor.status != STATUS_SUSPENDED,
            "Credential already suspended"
        );

        // Suspend (reversible)
        anchor.status = STATUS_SUSPENDED;

        // Store updated anchor
        self.anchors.insert(blinded_credential_id, anchor);

        log!(
            "CREDENTIAL_SUSPENDED: {{\"owner\": \"{}\", \"suspended_at\": {}}}",
            caller,
            env::block_timestamp_ms()
        );
    }

    /// Reinstate suspended credential (owner only)
    ///
    /// Only suspended credentials can be reinstated.
    /// Revoked credentials cannot be reinstated.
    ///
    /// # Panics
    /// * If credential doesn't exist
    /// * If caller is not the owner
    /// * If credential is revoked (cannot reinstate revoked)
    /// * If credential is already active
    pub fn reinstate_credential(&mut self, blinded_credential_id: Vec<u8>) {
        let caller = env::predecessor_account_id();

        // Get existing anchor
        let mut anchor = self.anchors.get(&blinded_credential_id)
            .expect("Credential not found")
            .clone();

        // Verify ownership
        assert!(
            anchor.owner == caller,
            "Not authorized: only owner can reinstate credential"
        );

        // Check status is Suspended
        assert!(
            anchor.status != STATUS_REVOKED,
            "Cannot reinstate revoked credential"
        );

        assert!(
            anchor.status == STATUS_SUSPENDED,
            "Credential not suspended"
        );

        // Reinstate
        anchor.status = STATUS_ACTIVE;

        // Store updated anchor
        self.anchors.insert(blinded_credential_id, anchor);

        log!(
            "CREDENTIAL_REINSTATED: {{\"owner\": \"{}\", \"reinstated_at\": {}}}",
            caller,
            env::block_timestamp_ms()
        );
    }

    /// Get caller's issued credential IDs (blinded)
    ///
    /// Returns the list of blinded credential IDs issued by the caller.
    /// This allows issuers to find their own credentials.
    pub fn get_my_credentials(&self) -> Vec<Vec<u8>> {
        let caller = env::predecessor_account_id();
        self.owner_credentials.get(&caller).cloned().unwrap_or_default()
    }

    /// Get total count of anchored credentials (statistics only)
    pub fn get_credential_count(&self) -> u64 {
        self.anchor_count
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
        builder.block_timestamp(1000000000); // 1000 seconds in ms
        builder
    }

    /// Create mock blinded credential ID (32 bytes)
    fn mock_blinded_credential_id(seed: u8) -> Vec<u8> {
        vec![seed; 32]
    }

    /// Create mock blinded revocation key (32 bytes, different from credential ID)
    fn mock_blinded_revocation_key(seed: u8) -> Vec<u8> {
        vec![seed.wrapping_add(100); 32]  // Ensure different from credential ID
    }

    /// Create mock credential hash
    fn mock_credential_hash() -> Vec<u8> {
        b"sha256_hash_of_full_credential_xyz".to_vec()
    }

    /// Create mock encrypted metadata
    fn mock_encrypted_metadata() -> Vec<u8> {
        b"encrypted_credential_metadata_content".to_vec()
    }

    /// Create mock nonce (24 bytes)
    fn mock_nonce() -> Vec<u8> {
        vec![0u8; 24]
    }

    #[test]
    fn test_anchor_credential_success() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();

        registry.anchor_credential(
            mock_blinded_credential_id(1),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // Verify anchor count
        assert_eq!(registry.get_credential_count(), 1);

        // Verify owner can find their credentials
        let creds = registry.get_my_credentials();
        assert_eq!(creds.len(), 1);
        assert_eq!(creds[0], mock_blinded_credential_id(1));
    }

    #[test]
    fn test_get_anchor_retrieves_encrypted_blob() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);
        let hash = mock_credential_hash();
        let metadata = mock_encrypted_metadata();

        registry.anchor_credential(
            credential_id.clone(),
            mock_blinded_revocation_key(1),
            hash.clone(),
            metadata.clone(),
            mock_nonce(),
            Some(2000000000), // Expires in future
        );

        // Retrieve by blinded credential ID
        let anchor = registry.get_anchor(credential_id).unwrap();

        // Verify encrypted blob is unchanged
        assert_eq!(anchor.credential_hash, hash);
        assert_eq!(anchor.encrypted_metadata, metadata);
        assert_eq!(anchor.owner, owner);
        assert_eq!(anchor.status, STATUS_ACTIVE);
        assert_eq!(anchor.expiration_date, Some(2000000000));
    }

    #[test]
    fn test_check_status_by_revocation_key() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let revocation_key = mock_blinded_revocation_key(1);

        registry.anchor_credential(
            mock_blinded_credential_id(1),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // Check status using revocation key (not credential ID)
        let status = registry.check_status(revocation_key).unwrap();
        assert_eq!(status, STATUS_ACTIVE);
    }

    #[test]
    fn test_is_valid_returns_true_for_active_credential() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let revocation_key = mock_blinded_revocation_key(1);

        registry.anchor_credential(
            mock_blinded_credential_id(1),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            Some(2000000000), // Expires in future
        );

        assert!(registry.is_valid(revocation_key));
    }

    #[test]
    fn test_is_valid_returns_false_for_expired_credential() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let mut context = get_context(owner.clone());
        context.block_timestamp(3000000000); // Time after expiration
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let revocation_key = mock_blinded_revocation_key(1);

        registry.anchor_credential(
            mock_blinded_credential_id(1),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            Some(2000000000), // Already expired at current time
        );

        assert!(!registry.is_valid(revocation_key));
    }

    #[test]
    fn test_revoke_credential_changes_status() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);

        registry.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // Revoke
        registry.revoke_credential(credential_id.clone(), b"encrypted_reason".to_vec());

        // Check status via revocation key
        let status = registry.check_status(revocation_key.clone()).unwrap();
        assert_eq!(status, STATUS_REVOKED);

        // is_valid should return false
        assert!(!registry.is_valid(revocation_key));
    }

    #[test]
    #[should_panic(expected = "Not authorized: only owner can revoke credential")]
    fn test_non_owner_revoke_fails() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let attacker: AccountId = "attacker.near".parse().unwrap();

        // Anchor as owner
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);

        registry.anchor_credential(
            credential_id.clone(),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // Try to revoke as attacker
        let context = get_context(attacker);
        testing_env!(context.build());

        registry.revoke_credential(credential_id, b"malicious_reason".to_vec());
    }

    #[test]
    fn test_suspend_and_reinstate_cycle() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);

        registry.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // Initially active
        assert_eq!(registry.check_status(revocation_key.clone()).unwrap(), STATUS_ACTIVE);

        // Suspend
        registry.suspend_credential(credential_id.clone());
        assert_eq!(registry.check_status(revocation_key.clone()).unwrap(), STATUS_SUSPENDED);

        // is_valid should return false while suspended
        assert!(!registry.is_valid(revocation_key.clone()));

        // Reinstate
        registry.reinstate_credential(credential_id.clone());
        assert_eq!(registry.check_status(revocation_key.clone()).unwrap(), STATUS_ACTIVE);

        // is_valid should return true after reinstatement
        assert!(registry.is_valid(revocation_key));
    }

    #[test]
    #[should_panic(expected = "Cannot reinstate revoked credential")]
    fn test_reinstate_revoked_credential_fails() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);

        registry.anchor_credential(
            credential_id.clone(),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // Revoke
        registry.revoke_credential(credential_id.clone(), b"reason".to_vec());

        // Try to reinstate revoked credential - should fail
        registry.reinstate_credential(credential_id);
    }

    #[test]
    fn test_get_my_credentials_returns_owner_credentials() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();

        // Anchor multiple credentials
        for i in 1..=3 {
            registry.anchor_credential(
                mock_blinded_credential_id(i),
                mock_blinded_revocation_key(i),
                mock_credential_hash(),
                mock_encrypted_metadata(),
                mock_nonce(),
                None,
            );
        }

        let creds = registry.get_my_credentials();
        assert_eq!(creds.len(), 3);
    }

    #[test]
    fn test_different_blinded_keys_work_correctly() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);

        registry.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // Can retrieve by credential ID
        assert!(registry.get_anchor(credential_id.clone()).is_some());

        // Can check status by revocation key
        assert!(registry.check_status(revocation_key.clone()).is_some());

        // Cannot retrieve by revocation key (it's different)
        assert!(registry.get_anchor(revocation_key.clone()).is_none());

        // Cannot check status by credential ID
        assert!(registry.check_status(credential_id).is_none());
    }

    #[test]
    fn test_revocation_key_does_not_reveal_credential_id() {
        // This test verifies that the revocation key cannot be used
        // to discover the credential ID directly.
        //
        // The revocation_index maps: revocation_key -> credential_id
        // But this mapping is internal. External callers can only:
        // - check_status(revocation_key) -> returns status, not credential_id
        // - is_valid(revocation_key) -> returns bool, not credential_id
        //
        // There is intentionally NO method to get credential_id from revocation_key.

        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);

        registry.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        // External caller with revocation_key can:
        // - Check status: returns 0 (active)
        assert_eq!(registry.check_status(revocation_key.clone()).unwrap(), STATUS_ACTIVE);

        // - Check validity: returns true
        assert!(registry.is_valid(revocation_key.clone()));

        // External caller CANNOT:
        // - Get the credential_id from revocation_key
        // - Get the anchor using revocation_key
        // These operations require the credential_id which is NOT revealed.

        // This test passes because we verify the API doesn't expose credential_id
    }

    #[test]
    fn test_no_plaintext_issuer_subject_in_storage() {
        // This test verifies that no plaintext issuer/subject DIDs are stored.
        //
        // The EncryptedCredentialAnchor struct contains:
        // - credential_hash: hash, not plaintext
        // - encrypted_metadata: encrypted blob (contains issuer/subject)
        // - status, timestamps: public by necessity
        // - owner: AccountId (issuer's NEAR account, not DID)
        //
        // There is NO plaintext issuer DID or subject DID field.

        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);

        // Store credential with encrypted metadata containing issuer/subject
        let encrypted_metadata = b"encrypted{issuer:did:example:123,subject:did:example:456}".to_vec();

        registry.anchor_credential(
            credential_id.clone(),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            encrypted_metadata.clone(),
            mock_nonce(),
            None,
        );

        let anchor = registry.get_anchor(credential_id).unwrap();

        // The metadata is stored as encrypted blob
        assert_eq!(anchor.encrypted_metadata, encrypted_metadata);

        // There is NO anchor.issuer_did or anchor.subject_did field
        // Contract has no knowledge of what's inside encrypted_metadata
    }

    #[test]
    fn test_owner_credentials_only_contains_blinded_ids() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let credential_id = mock_blinded_credential_id(1);

        registry.anchor_credential(
            credential_id.clone(),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );

        let creds = registry.get_my_credentials();

        // Returned list contains only blinded IDs, not plaintext identifiers
        assert_eq!(creds.len(), 1);
        assert_eq!(creds[0], credential_id);
        assert_eq!(creds[0].len(), 32); // Blinded key is 32 bytes
    }

    #[test]
    #[should_panic(expected = "Credential ID and revocation key must be different")]
    fn test_same_credential_and_revocation_key_fails() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();
        let same_key = mock_blinded_credential_id(1);

        // Using same key for both should fail
        registry.anchor_credential(
            same_key.clone(),
            same_key.clone(),  // Same as credential_id - not allowed
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );
    }

    #[test]
    #[should_panic(expected = "Invalid blinded_credential_id length: expected 32 bytes")]
    fn test_invalid_credential_id_length_fails() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();

        registry.anchor_credential(
            vec![0u8; 16], // Invalid: 16 bytes instead of 32
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );
    }

    #[test]
    #[should_panic(expected = "Invalid blinded_revocation_key length: expected 32 bytes")]
    fn test_invalid_revocation_key_length_fails() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();

        registry.anchor_credential(
            mock_blinded_credential_id(1),
            vec![0u8; 16], // Invalid: 16 bytes instead of 32
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_nonce(),
            None,
        );
    }

    #[test]
    #[should_panic(expected = "Invalid nonce length: expected 24 bytes")]
    fn test_invalid_nonce_length_fails() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = CredentialRegistry::new();

        registry.anchor_credential(
            mock_blinded_credential_id(1),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            vec![0u8; 12], // Invalid: 12 bytes instead of 24
            None,
        );
    }

    #[test]
    fn test_is_valid_returns_false_for_nonexistent() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let registry = CredentialRegistry::new();

        // Non-existent revocation key
        assert!(!registry.is_valid(mock_blinded_revocation_key(99)));
    }

    #[test]
    fn test_check_status_returns_none_for_nonexistent() {
        let owner: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let registry = CredentialRegistry::new();

        // Non-existent revocation key
        assert!(registry.check_status(mock_blinded_revocation_key(99)).is_none());
    }
}
