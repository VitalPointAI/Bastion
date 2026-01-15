// SSR Foundation Contract - NEAR blockchain foundation
use near_sdk::{env, log, near, require, AccountId, PanicOnDefault, Promise};

mod document;
use document::{Document, DocumentRegistry};

mod privacy;
use privacy::{Classification, PrivacyRouter, RoutingResult};

mod attestation;
use attestation::{AttestationReport, AttestationVerifier};

mod chain_signatures;
use chain_signatures::ChainSignatureManager;

mod intents;
use intents::{Intent, IntentVerifier};

mod did_registry;
use did_registry::{DIDRegistry, EncryptedDIDEntry};

mod credential_registry;
use credential_registry::{CredentialRegistry, EncryptedCredentialAnchor};

/// Main contract structure with state versioning pattern
/// State version is tracked internally for safe upgrades
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Contract owner
    owner: AccountId,
    /// Initialization status
    initialized: bool,
    /// State version for migrations (V1)
    state_version: u8,
    /// Encrypted document registry
    document_registry: DocumentRegistry,
    /// Privacy router for classification-based routing
    privacy_router: PrivacyRouter,
    /// Attestation verifier for TEE result validation
    attestation_verifier: AttestationVerifier,
    /// Chain Signatures manager for multi-chain key management
    chain_signature_manager: ChainSignatureManager,
    /// Intent verifier for intent-based transactions
    intent_verifier: IntentVerifier,
    /// Encrypted DID registry for universal identity management
    did_registry: DIDRegistry,
    /// Encrypted credential registry for on-chain verification
    credential_registry: CredentialRegistry,
}

#[near]
impl Contract {
    /// Initialize contract with owner
    #[init]
    pub fn new(owner: AccountId) -> Self {
        require!(!env::state_exists(), "Contract already initialized");

        // Use testnet MPC contract for development
        let mpc_contract: AccountId = "v1.signer.testnet".parse().unwrap();

        Self {
            owner,
            initialized: true,
            state_version: 1,
            document_registry: DocumentRegistry::new(),
            privacy_router: PrivacyRouter::new(),
            attestation_verifier: AttestationVerifier::new(),
            chain_signature_manager: ChainSignatureManager::new(mpc_contract),
            intent_verifier: IntentVerifier::new(),
            did_registry: DIDRegistry::new(),
            credential_registry: CredentialRegistry::new(),
        }
    }

    /// Migrate contract state (for future upgrades)
    /// When V2 is needed, this will handle migration from V1 to V2
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        use near_sdk::borsh::{self, BorshDeserialize};

        // Read old state
        #[derive(BorshDeserialize)]
        struct OldState {
            owner: AccountId,
            initialized: bool,
            state_version: u8,
            document_registry: DocumentRegistry,
            privacy_router: PrivacyRouter,
            attestation_verifier: AttestationVerifier,
            chain_signature_manager: ChainSignatureManager,
            intent_verifier: IntentVerifier,
            did_registry: DIDRegistry,
            credential_registry: CredentialRegistry,
        }

        let old_state: OldState = env::state_read().expect("Failed to read state");

        // For now, just copy the state
        // When V2 is added, migration logic will be implemented here
        Self {
            owner: old_state.owner,
            initialized: old_state.initialized,
            state_version: old_state.state_version,
            document_registry: old_state.document_registry,
            privacy_router: old_state.privacy_router,
            attestation_verifier: old_state.attestation_verifier,
            chain_signature_manager: old_state.chain_signature_manager,
            intent_verifier: old_state.intent_verifier,
            did_registry: old_state.did_registry,
            credential_registry: old_state.credential_registry,
        }
    }

    /// Get the contract owner
    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    /// Check if contract is initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }

    /// Get state version
    pub fn get_state_version(&self) -> u8 {
        self.state_version
    }

    /// Example method with validation pattern
    pub fn owner_only_action(&mut self, message: String) {
        // Early validation with require! pattern (fail fast)
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can call this method"
        );

        require!(
            self.initialized,
            "Contract not initialized"
        );

        // Now perform the action
        log!("Owner action: {}", message);
    }

    /// Public method demonstrating proper validation
    pub fn update_data(&mut self, value: u64) {
        // Validate contract state
        require!(
            self.initialized,
            "Contract not initialized"
        );

        // Validate input
        require!(
            value > 0,
            "Value must be greater than zero"
        );

        // Log the action
        log!("Data updated with value: {}", value);

        // In a real implementation, state would be updated here
    }

    // ===== Document Registry Methods =====

    /// Register an encrypted document with IPFS CID
    ///
    /// ALL data encrypted by default (CID, classification, metadata)
    /// Only owner AccountId and timestamp plaintext (required for access control)
    pub fn register_document(
        &mut self,
        encrypted_cid: String,
        encrypted_classification: String,
        encrypted_metadata_key: String,
        encrypted_metadata: String,
    ) -> String {
        require!(self.initialized, "Contract not initialized");

        self.document_registry.register_document(
            encrypted_cid,
            encrypted_classification,
            encrypted_metadata_key,
            encrypted_metadata,
        )
    }

    /// Get document by ID (returns encrypted data - caller must decrypt client-side)
    pub fn get_document(&self, document_id: String) -> Option<Document> {
        self.document_registry.get_document(document_id)
    }

    /// List documents for a user with pagination
    pub fn list_user_documents(
        &self,
        account_id: AccountId,
        offset: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<Document> {
        self.document_registry.list_user_documents(
            account_id,
            offset.map(|o| o as usize),
            limit.map(|l| l as usize),
        )
    }

    /// Get document count for a user
    pub fn get_user_document_count(&self, account_id: AccountId) -> u64 {
        self.document_registry.get_user_document_count(account_id) as u64
    }

    // ===== Privacy Routing Methods =====

    /// Set Phala backend account for TEE routing (owner-only)
    pub fn set_phala_backend(&mut self, phala_account: AccountId) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can set Phala backend"
        );
        require!(
            self.initialized,
            "Contract not initialized"
        );

        self.privacy_router.set_phala_backend(phala_account.clone());
        log!("Phala backend configured: {}", phala_account);
    }

    /// Get current Phala backend account
    pub fn get_phala_backend(&self) -> Option<AccountId> {
        self.privacy_router.phala_backend_account.clone()
    }

    /// Process data with classification-based routing
    ///
    /// Public data: processed on-chain immediately, returns result
    /// Secret/TopSecret data: routed to Phala TEE, returns Promise
    pub fn process_data(&mut self, data: Vec<u8>, classification: Classification) -> Promise {
        require!(
            self.initialized,
            "Contract not initialized"
        );

        log!("Processing {} bytes with classification: {:?}", data.len(), classification);

        // Route based on classification
        match self.privacy_router.route_data(data, classification) {
            RoutingResult::OnChain(result) => {
                // On-chain processing completed immediately
                log!("On-chain processing complete, result: {} bytes", result.len());
                // Return a resolved promise with the result
                Promise::new(env::current_account_id())
            }
            RoutingResult::OffChainTEE(promise) => {
                // TEE routing returns promise for async processing
                log!("TEE routing initiated");
                promise
            }
        }
    }

    // ===== Attestation Verification Methods =====

    /// Set trusted application hash for TEE verification (owner-only)
    pub fn set_trusted_app_hash(&mut self, app_hash: String) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can set trusted app hash"
        );
        require!(
            self.initialized,
            "Contract not initialized"
        );

        self.attestation_verifier.set_expected_app_hash(app_hash.clone());
        log!("Trusted app hash configured: {}", app_hash);
    }

    /// Add trusted hardware identity (owner-only)
    pub fn add_trusted_hw_identity(&mut self, hw_id: String) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can add trusted hardware identity"
        );
        require!(
            self.initialized,
            "Contract not initialized"
        );

        self.attestation_verifier.add_trusted_hw_identity(hw_id.clone());
        log!("Trusted hardware identity added: {}", hw_id);
    }

    /// Callback to handle TEE result with attestation verification
    ///
    /// This is called after TEE processing completes
    /// It verifies the attestation before accepting the result
    #[private]
    pub fn on_tee_result(
        &mut self,
        #[callback_result] result: Result<Vec<u8>, near_sdk::PromiseError>,
        attestation: AttestationReport,
    ) {
        match result {
            Ok(data) => {
                log!("TEE result received: {} bytes", data.len());

                // Verify attestation before trusting result
                match self.attestation_verifier.verify_attestation(&attestation, &data) {
                    Ok(()) => {
                        log!("Attestation verified, result accepted");
                        // In production, store the result or emit event
                        // For now, just log success
                    }
                    Err(err) => {
                        log!("Attestation verification failed: {}", err);
                        env::panic_str(&format!("Attestation verification failed: {}", err));
                    }
                }
            }
            Err(e) => {
                log!("TEE call failed: {:?}", e);
                env::panic_str("TEE processing failed");
            }
        }
    }

    // ===== Chain Signatures Methods =====

    /// Register chain path for multi-chain address derivation (owner-only)
    ///
    /// Derives and stores address deterministically from path
    /// Same path will always generate same address
    pub fn register_chain_path(
        &mut self,
        path_name: String,
        derivation_path: String,
    ) -> near_sdk::PromiseOrValue<String> {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can register chain paths"
        );
        require!(
            self.initialized,
            "Contract not initialized"
        );

        let result = self.chain_signature_manager.register_path(path_name.clone(), derivation_path);

        log!("Chain path registered: {}", path_name);

        result
    }

    /// Get derived address for a registered path (view method)
    ///
    /// Returns deterministic address if path exists, None otherwise
    pub fn get_derived_address(&self, path_name: String) -> Option<String> {
        self.chain_signature_manager.derive_address(path_name)
    }

    /// Sign transaction using Chain Signatures MPC network
    ///
    /// Requests threshold signature from 8 MPC nodes
    /// Returns Promise with aggregated signature
    pub fn sign_transaction(
        &mut self,
        transaction_data: Vec<u8>,
        chain_path: String,
        target_chain: String,
    ) -> Promise {
        require!(
            self.initialized,
            "Contract not initialized"
        );
        require!(
            !transaction_data.is_empty(),
            "Transaction data cannot be empty"
        );

        log!(
            "Signing transaction for {} ({} bytes)",
            target_chain,
            transaction_data.len()
        );

        self.chain_signature_manager.request_signature(
            transaction_data,
            chain_path,
            target_chain,
        )
    }

    /// Get all registered chain paths (view method)
    pub fn get_all_chain_paths(&self) -> Vec<String> {
        self.chain_signature_manager.get_all_paths()
    }

    // ===== Intent Methods =====

    /// Submit intent for processing
    ///
    /// User expresses desired outcome without implementation details
    /// Verifier validates intent, solver network executes
    pub fn submit_intent(
        &mut self,
        intent_type: String,
        params: String,
    ) -> String {
        require!(
            self.initialized,
            "Contract not initialized"
        );
        require!(
            !intent_type.is_empty() && !params.is_empty(),
            "Intent type and params cannot be empty"
        );

        let intent_id = self.intent_verifier.submit_intent(intent_type, params);

        log!("Intent submitted: {}", intent_id);

        intent_id
    }

    /// Verify transfer intent
    ///
    /// Validates transfer parameters before execution
    /// Called internally before routing to solvers
    pub fn verify_transfer_intent(&mut self, intent_id: String) -> bool {
        require!(
            self.initialized,
            "Contract not initialized"
        );

        self.intent_verifier.verify_transfer_intent(intent_id)
    }

    /// Verify mission order intent
    ///
    /// Validates mission parameters and commander authorization
    /// Owner provides list of authorized commanders
    pub fn verify_mission_order_intent(
        &mut self,
        intent_id: String,
        authorized_commanders: Vec<AccountId>,
    ) -> bool {
        require!(
            self.initialized,
            "Contract not initialized"
        );

        self.intent_verifier.verify_mission_order_intent(intent_id, authorized_commanders)
    }

    /// Verify document verification intent
    ///
    /// Checks document exists and user has permissions
    pub fn verify_document_verification_intent(&mut self, intent_id: String) -> bool {
        require!(
            self.initialized,
            "Contract not initialized"
        );

        // Get list of existing documents for validation
        let creator = match self.intent_verifier.get_intent(intent_id.clone()) {
            Some(intent) => intent.creator,
            None => return false,
        };

        // Get user's documents as proof of existence
        let user_docs = self.document_registry.list_user_documents(creator, None, None);
        let doc_ids: Vec<String> = user_docs.iter().map(|d| d.encrypted_cid.clone()).collect();

        self.intent_verifier.verify_document_intent(intent_id, doc_ids)
    }

    /// Settle intent after solver execution
    ///
    /// Updates intent status to Verified after successful execution
    /// Called after solver completes the intent
    pub fn settle_intent(&mut self, intent_id: String) {
        require!(
            self.initialized,
            "Contract not initialized"
        );

        self.intent_verifier.settle_intent(intent_id.clone());
        log!("Intent settlement recorded: {}", intent_id);
    }

    /// Get intent by ID (view method)
    pub fn get_intent(&self, intent_id: String) -> Option<Intent> {
        self.intent_verifier.get_intent(intent_id)
    }

    /// List user's intents with pagination (view method)
    pub fn list_user_intents(
        &self,
        account_id: AccountId,
        offset: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<Intent> {
        self.intent_verifier.list_user_intents(
            account_id,
            offset.map(|o| o as usize),
            limit.map(|l| l as usize),
        )
    }

    /// Get user's intent count (view method)
    pub fn get_user_intent_count(&self, account_id: AccountId) -> u64 {
        self.intent_verifier.get_user_intent_count(account_id) as u64
    }

    // ===== Encrypted DID Registry Methods =====

    /// Store encrypted DID document
    ///
    /// Privacy-preserving DID storage using blinded keys.
    /// ALL document content must be encrypted off-chain before submission.
    ///
    /// # Arguments
    /// * `blinded_key` - HKDF-derived lookup key (32 bytes, computed off-chain)
    /// * `encrypted_document` - PQ-encrypted DID document blob
    /// * `encrypted_entity_type` - PQ-encrypted entity type
    /// * `nonce` - Encryption nonce (24 bytes)
    pub fn store_did(
        &mut self,
        blinded_key: Vec<u8>,
        encrypted_document: Vec<u8>,
        encrypted_entity_type: Vec<u8>,
        nonce: Vec<u8>,
    ) {
        require!(self.initialized, "Contract not initialized");

        self.did_registry.store_did(
            blinded_key,
            encrypted_document,
            encrypted_entity_type,
            nonce,
        )
    }

    /// Retrieve encrypted DID entry by blinded key
    ///
    /// Returns encrypted blob - decryption happens off-chain.
    /// Caller must have the correct secret to derive the blinded key.
    pub fn get_did(&self, blinded_key: Vec<u8>) -> Option<EncryptedDIDEntry> {
        self.did_registry.get_did(blinded_key)
    }

    /// Get blinded key for caller's DID (if registered)
    ///
    /// Allows owner to retrieve their blinded key if they've lost it.
    /// Only returns the key to the owner account.
    pub fn get_my_blinded_key(&self) -> Option<Vec<u8>> {
        self.did_registry.get_my_blinded_key()
    }

    /// Update encrypted DID document (owner only)
    ///
    /// Updates the encrypted document while preserving ownership.
    /// Entity type cannot be changed after registration.
    pub fn update_did(
        &mut self,
        blinded_key: Vec<u8>,
        encrypted_document: Vec<u8>,
        nonce: Vec<u8>,
    ) {
        require!(self.initialized, "Contract not initialized");

        self.did_registry.update_did(blinded_key, encrypted_document, nonce)
    }

    /// Deactivate DID (owner only, irreversible)
    ///
    /// Once deactivated, the DID cannot be reactivated or updated.
    /// This is permanent revocation following W3C DID spec.
    pub fn deactivate_did(&mut self, blinded_key: Vec<u8>) {
        require!(self.initialized, "Contract not initialized");

        self.did_registry.deactivate_did(blinded_key)
    }

    /// Check if DID is active (public revocation check)
    ///
    /// Anyone can check if a DID is active given the blinded key.
    /// Enables revocation verification without revealing identity.
    pub fn is_did_active(&self, blinded_key: Vec<u8>) -> bool {
        self.did_registry.is_active(blinded_key)
    }

    /// Check if caller owns a DID entry
    pub fn has_did(&self) -> bool {
        self.did_registry.has_did()
    }

    /// Get total count of registered DIDs (statistics only)
    pub fn get_did_count(&self) -> u64 {
        self.did_registry.get_did_count()
    }

    // ===== Encrypted Credential Registry Methods =====

    /// Anchor an encrypted credential
    ///
    /// Privacy-preserving credential anchoring using dual blinded keys.
    /// Credential content must be encrypted off-chain before submission.
    ///
    /// # Arguments
    /// * `blinded_credential_id` - HKDF(secret, "credential", hash) - 32 bytes
    /// * `blinded_revocation_key` - HKDF(secret, "revocation", hash) - 32 bytes, DIFFERENT key
    /// * `credential_hash` - Hash of the full credential (cryptographic commitment)
    /// * `encrypted_metadata` - Encrypted credential metadata (type, issuer, subject)
    /// * `nonce` - Encryption nonce (24 bytes)
    /// * `expiration_date` - Optional expiration timestamp in milliseconds
    pub fn anchor_credential(
        &mut self,
        blinded_credential_id: Vec<u8>,
        blinded_revocation_key: Vec<u8>,
        credential_hash: Vec<u8>,
        encrypted_metadata: Vec<u8>,
        nonce: Vec<u8>,
        expiration_date: Option<u64>,
    ) {
        require!(self.initialized, "Contract not initialized");

        self.credential_registry.anchor_credential(
            blinded_credential_id,
            blinded_revocation_key,
            credential_hash,
            encrypted_metadata,
            nonce,
            expiration_date,
        )
    }

    /// Get encrypted credential anchor by blinded credential ID
    ///
    /// Returns encrypted blob - decryption happens off-chain.
    /// Caller must have the correct secret to derive the blinded key.
    pub fn get_credential_anchor(&self, blinded_credential_id: Vec<u8>) -> Option<EncryptedCredentialAnchor> {
        self.credential_registry.get_anchor(blinded_credential_id)
    }

    /// Check credential status by revocation key (for validators)
    ///
    /// Returns status code without revealing credential ID.
    /// Status: 0=Active, 1=Revoked, 2=Suspended
    pub fn check_credential_status(&self, blinded_revocation_key: Vec<u8>) -> Option<u8> {
        self.credential_registry.check_status(blinded_revocation_key)
    }

    /// Verify credential is active (not revoked/suspended/expired)
    ///
    /// Returns true only if credential exists, is Active, and not expired.
    pub fn is_credential_valid(&self, blinded_revocation_key: Vec<u8>) -> bool {
        self.credential_registry.is_valid(blinded_revocation_key)
    }

    /// Revoke credential (owner only, irreversible)
    ///
    /// Once revoked, the credential cannot be reinstated.
    ///
    /// # Arguments
    /// * `blinded_credential_id` - The blinded ID for this credential
    /// * `encrypted_reason` - Encrypted revocation reason
    pub fn revoke_credential(&mut self, blinded_credential_id: Vec<u8>, encrypted_reason: Vec<u8>) {
        require!(self.initialized, "Contract not initialized");

        self.credential_registry.revoke_credential(blinded_credential_id, encrypted_reason)
    }

    /// Suspend credential (owner only, reversible)
    ///
    /// Suspended credentials can be reinstated by the owner.
    pub fn suspend_credential(&mut self, blinded_credential_id: Vec<u8>) {
        require!(self.initialized, "Contract not initialized");

        self.credential_registry.suspend_credential(blinded_credential_id)
    }

    /// Reinstate suspended credential (owner only)
    ///
    /// Only suspended credentials can be reinstated.
    /// Revoked credentials cannot be reinstated.
    pub fn reinstate_credential(&mut self, blinded_credential_id: Vec<u8>) {
        require!(self.initialized, "Contract not initialized");

        self.credential_registry.reinstate_credential(blinded_credential_id)
    }

    /// Get caller's issued credential IDs (blinded)
    ///
    /// Returns the list of blinded credential IDs issued by the caller.
    pub fn get_my_issued_credentials(&self) -> Vec<Vec<u8>> {
        self.credential_registry.get_my_credentials()
    }

    /// Get total count of anchored credentials (statistics only)
    pub fn get_credential_count(&self) -> u64 {
        self.credential_registry.get_credential_count()
    }
}

// Internal implementation - separate from public interface
impl Contract {
    /// Private helper method
    #[allow(dead_code)]
    fn internal_validate(&self) -> bool {
        self.initialized
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
        builder
    }

    #[test]
    fn test_initialization() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let contract = Contract::new(owner.clone());

        assert!(contract.is_initialized());
        assert_eq!(contract.get_owner(), owner);
        assert_eq!(contract.get_state_version(), 1);
        assert_eq!(contract.get_user_document_count(owner), 0);
    }

    #[test]
    fn test_owner_only_action() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        // Should succeed for owner
        contract.owner_only_action("Test message".to_string());
    }

    #[test]
    #[should_panic(expected = "Only owner can call this method")]
    fn test_owner_only_action_fails_for_non_owner() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let non_owner: AccountId = "user.near".parse().unwrap();

        let context = get_context(non_owner);
        testing_env!(context.build());

        let mut contract = Contract::new(owner);

        // Should panic for non-owner
        contract.owner_only_action("Test message".to_string());
    }

    #[test]
    fn test_update_data() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner);

        // Should succeed with valid value
        contract.update_data(100);
    }

    #[test]
    #[should_panic(expected = "Value must be greater than zero")]
    fn test_update_data_fails_with_zero() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner);

        // Should panic with zero value
        contract.update_data(0);
    }

    #[test]
    fn test_document_registry() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        // Register encrypted document
        let doc_id = contract.register_document(
            "encrypted_cid_abc123".to_string(),
            "encrypted_classification_secret".to_string(),
            "encrypted_key_xyz789".to_string(),
            "encrypted_metadata_json".to_string(),
        );

        // Verify document was registered
        assert!(doc_id.starts_with("doc-"));
        assert_eq!(contract.get_user_document_count(owner.clone()), 1);

        // Retrieve document
        let doc = contract.get_document(doc_id.clone()).unwrap();
        assert_eq!(doc.encrypted_cid, "encrypted_cid_abc123");
        assert_eq!(doc.owner, owner);

        // List user documents
        let docs = contract.list_user_documents(owner.clone(), None, None);
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].encrypted_cid, "encrypted_cid_abc123");
    }

    // ===== DID Registry Integration Tests =====

    /// Create mock blinded key (32 bytes)
    fn mock_blinded_key(seed: u8) -> Vec<u8> {
        vec![seed; 32]
    }

    /// Create mock nonce (24 bytes)
    fn mock_nonce() -> Vec<u8> {
        vec![0u8; 24]
    }

    #[test]
    fn test_did_registry_store_and_get() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        let blinded_key = mock_blinded_key(1);
        let encrypted_doc = b"encrypted_did_document".to_vec();
        let encrypted_type = b"encrypted_human".to_vec();

        // Store DID
        contract.store_did(
            blinded_key.clone(),
            encrypted_doc.clone(),
            encrypted_type.clone(),
            mock_nonce(),
        );

        // Verify storage
        assert!(contract.has_did());
        assert_eq!(contract.get_did_count(), 1);

        // Retrieve by blinded key
        let entry = contract.get_did(blinded_key.clone()).unwrap();
        assert_eq!(entry.encrypted_document, encrypted_doc);
        assert_eq!(entry.encrypted_entity_type, encrypted_type);
        assert_eq!(entry.owner, owner);
        assert!(entry.active);
    }

    #[test]
    fn test_did_registry_get_my_blinded_key() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let blinded_key = mock_blinded_key(1);

        contract.store_did(
            blinded_key.clone(),
            b"encrypted_doc".to_vec(),
            b"encrypted_type".to_vec(),
            mock_nonce(),
        );

        // Owner can retrieve their blinded key
        let retrieved = contract.get_my_blinded_key().unwrap();
        assert_eq!(retrieved, blinded_key);
    }

    #[test]
    fn test_did_registry_update_and_deactivate() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let blinded_key = mock_blinded_key(1);

        // Store initial DID
        contract.store_did(
            blinded_key.clone(),
            b"original_encrypted_doc".to_vec(),
            b"encrypted_type".to_vec(),
            mock_nonce(),
        );

        // Update the document
        let new_nonce = vec![1u8; 24];
        contract.update_did(
            blinded_key.clone(),
            b"updated_encrypted_doc".to_vec(),
            new_nonce.clone(),
        );

        // Verify update
        let entry = contract.get_did(blinded_key.clone()).unwrap();
        assert_eq!(entry.encrypted_document, b"updated_encrypted_doc".to_vec());
        assert_eq!(entry.nonce, new_nonce);
        assert!(entry.active);

        // Deactivate
        contract.deactivate_did(blinded_key.clone());

        // Verify deactivation
        assert!(!contract.is_did_active(blinded_key));
    }

    #[test]
    #[should_panic(expected = "DID already registered for this account")]
    fn test_did_registry_duplicate_registration_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        // First registration succeeds
        contract.store_did(
            mock_blinded_key(1),
            b"doc1".to_vec(),
            b"type1".to_vec(),
            mock_nonce(),
        );

        // Second registration fails (same owner)
        contract.store_did(
            mock_blinded_key(2),
            b"doc2".to_vec(),
            b"type2".to_vec(),
            mock_nonce(),
        );
    }

    #[test]
    #[should_panic(expected = "Not authorized: only owner can update DID")]
    fn test_did_registry_non_owner_update_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let attacker: AccountId = "bob.near".parse().unwrap();

        // Register as owner
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let blinded_key = mock_blinded_key(1);

        contract.store_did(
            blinded_key.clone(),
            b"doc".to_vec(),
            b"type".to_vec(),
            mock_nonce(),
        );

        // Try to update as attacker
        let context = get_context(attacker);
        testing_env!(context.build());

        contract.update_did(
            blinded_key,
            b"malicious_doc".to_vec(),
            mock_nonce(),
        );
    }

    #[test]
    #[should_panic(expected = "Not authorized: only owner can deactivate DID")]
    fn test_did_registry_non_owner_deactivate_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let attacker: AccountId = "bob.near".parse().unwrap();

        // Register as owner
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let blinded_key = mock_blinded_key(1);

        contract.store_did(
            blinded_key.clone(),
            b"doc".to_vec(),
            b"type".to_vec(),
            mock_nonce(),
        );

        // Try to deactivate as attacker
        let context = get_context(attacker);
        testing_env!(context.build());

        contract.deactivate_did(blinded_key);
    }

    #[test]
    fn test_did_registry_is_active_false_for_nonexistent() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let contract = Contract::new(owner.clone());

        // Non-existent DID should return false
        assert!(!contract.is_did_active(mock_blinded_key(99)));
    }

    #[test]
    fn test_did_registry_has_did_false_before_registration() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let contract = Contract::new(owner.clone());

        // No DID registered yet
        assert!(!contract.has_did());
        assert!(contract.get_my_blinded_key().is_none());
    }

    #[test]
    fn test_did_initialization_count_zero() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let contract = Contract::new(owner.clone());

        // DID count should be zero initially
        assert_eq!(contract.get_did_count(), 0);
    }

    // ===== Credential Registry Integration Tests =====

    /// Create mock blinded credential ID (32 bytes)
    fn mock_blinded_credential_id(seed: u8) -> Vec<u8> {
        vec![seed; 32]
    }

    /// Create mock blinded revocation key (32 bytes, different from credential ID)
    fn mock_blinded_revocation_key(seed: u8) -> Vec<u8> {
        vec![seed.wrapping_add(100); 32]
    }

    /// Create mock credential hash
    fn mock_credential_hash() -> Vec<u8> {
        b"sha256_credential_commitment_hash".to_vec()
    }

    /// Create mock encrypted metadata
    fn mock_encrypted_metadata() -> Vec<u8> {
        b"encrypted_credential_metadata".to_vec()
    }

    /// Create mock credential nonce (24 bytes)
    fn mock_credential_nonce() -> Vec<u8> {
        vec![0u8; 24]
    }

    #[test]
    fn test_credential_registry_anchor_and_get() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());

        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);
        let hash = mock_credential_hash();
        let metadata = mock_encrypted_metadata();

        // Anchor credential
        contract.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            hash.clone(),
            metadata.clone(),
            mock_credential_nonce(),
            None,
        );

        // Verify storage
        assert_eq!(contract.get_credential_count(), 1);

        // Retrieve by blinded credential ID
        let anchor = contract.get_credential_anchor(credential_id.clone()).unwrap();
        assert_eq!(anchor.credential_hash, hash);
        assert_eq!(anchor.encrypted_metadata, metadata);
        assert_eq!(anchor.owner, issuer);
        assert_eq!(anchor.status, 0); // STATUS_ACTIVE
    }

    #[test]
    fn test_credential_registry_check_status_by_revocation_key() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());
        let revocation_key = mock_blinded_revocation_key(1);

        contract.anchor_credential(
            mock_blinded_credential_id(1),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_credential_nonce(),
            None,
        );

        // Check status using revocation key
        let status = contract.check_credential_status(revocation_key.clone()).unwrap();
        assert_eq!(status, 0); // STATUS_ACTIVE

        // is_valid should return true
        assert!(contract.is_credential_valid(revocation_key));
    }

    #[test]
    fn test_credential_registry_revoke_credential() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());
        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);

        contract.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_credential_nonce(),
            None,
        );

        // Revoke
        contract.revoke_credential(credential_id.clone(), b"encrypted_reason".to_vec());

        // Status should be 1 (REVOKED)
        let status = contract.check_credential_status(revocation_key.clone()).unwrap();
        assert_eq!(status, 1);

        // is_valid should return false
        assert!(!contract.is_credential_valid(revocation_key));
    }

    #[test]
    #[should_panic(expected = "Not authorized: only owner can revoke credential")]
    fn test_credential_registry_non_owner_revoke_fails() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let attacker: AccountId = "attacker.near".parse().unwrap();

        // Anchor as issuer
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());
        let credential_id = mock_blinded_credential_id(1);

        contract.anchor_credential(
            credential_id.clone(),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_credential_nonce(),
            None,
        );

        // Try to revoke as attacker
        let context = get_context(attacker);
        testing_env!(context.build());

        contract.revoke_credential(credential_id, b"malicious_reason".to_vec());
    }

    #[test]
    fn test_credential_registry_suspend_reinstate_cycle() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());
        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);

        contract.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_credential_nonce(),
            None,
        );

        // Initially active
        assert_eq!(contract.check_credential_status(revocation_key.clone()).unwrap(), 0);

        // Suspend
        contract.suspend_credential(credential_id.clone());
        assert_eq!(contract.check_credential_status(revocation_key.clone()).unwrap(), 2);
        assert!(!contract.is_credential_valid(revocation_key.clone()));

        // Reinstate
        contract.reinstate_credential(credential_id.clone());
        assert_eq!(contract.check_credential_status(revocation_key.clone()).unwrap(), 0);
        assert!(contract.is_credential_valid(revocation_key));
    }

    #[test]
    #[should_panic(expected = "Cannot reinstate revoked credential")]
    fn test_credential_registry_reinstate_revoked_fails() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());
        let credential_id = mock_blinded_credential_id(1);

        contract.anchor_credential(
            credential_id.clone(),
            mock_blinded_revocation_key(1),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_credential_nonce(),
            None,
        );

        // Revoke (irreversible)
        contract.revoke_credential(credential_id.clone(), b"reason".to_vec());

        // Try to reinstate - should fail
        contract.reinstate_credential(credential_id);
    }

    #[test]
    fn test_credential_registry_get_my_issued_credentials() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());

        // Anchor multiple credentials
        for i in 1..=3 {
            contract.anchor_credential(
                mock_blinded_credential_id(i),
                mock_blinded_revocation_key(i),
                mock_credential_hash(),
                mock_encrypted_metadata(),
                mock_credential_nonce(),
                None,
            );
        }

        let creds = contract.get_my_issued_credentials();
        assert_eq!(creds.len(), 3);
    }

    #[test]
    fn test_credential_registry_different_keys() {
        let issuer: AccountId = "issuer.near".parse().unwrap();
        let context = get_context(issuer.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(issuer.clone());
        let credential_id = mock_blinded_credential_id(1);
        let revocation_key = mock_blinded_revocation_key(1);

        contract.anchor_credential(
            credential_id.clone(),
            revocation_key.clone(),
            mock_credential_hash(),
            mock_encrypted_metadata(),
            mock_credential_nonce(),
            None,
        );

        // Can retrieve by credential ID
        assert!(contract.get_credential_anchor(credential_id.clone()).is_some());

        // Can check status by revocation key
        assert!(contract.check_credential_status(revocation_key.clone()).is_some());

        // Cannot retrieve by revocation key (different key)
        assert!(contract.get_credential_anchor(revocation_key.clone()).is_none());

        // Cannot check status by credential ID
        assert!(contract.check_credential_status(credential_id).is_none());
    }

    #[test]
    fn test_credential_initialization_count_zero() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let contract = Contract::new(owner.clone());

        // Credential count should be zero initially
        assert_eq!(contract.get_credential_count(), 0);
    }
}
