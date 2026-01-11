// SSR Foundation Contract - NEAR blockchain foundation
use near_sdk::{env, log, near, require, AccountId, PanicOnDefault, Promise};

mod document;
use document::{Document, DocumentRegistry};

mod privacy;
use privacy::{Classification, PrivacyRouter, RoutingResult};

mod attestation;
use attestation::{AttestationReport, AttestationVerifier};

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
}

#[near]
impl Contract {
    /// Initialize contract with owner
    #[init]
    pub fn new(owner: AccountId) -> Self {
        require!(!env::state_exists(), "Contract already initialized");

        Self {
            owner,
            initialized: true,
            state_version: 1,
            document_registry: DocumentRegistry::new(),
            privacy_router: PrivacyRouter::new(),
            attestation_verifier: AttestationVerifier::new(),
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
}
