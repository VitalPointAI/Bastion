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

mod dao;
use dao::{
    DAORegistry, DAOConfig, DAOMetadata, AutonomyLevel,
    ProposalManager, Proposal, ProposalKind, ProposalStatus,
    RoleManager, Role, AgentTier,
    VotingEngine, VoteType, Vote, VotePolicy,
    ProposalExecutor, ExecutionState,
    DAOLinkageManager, RequirementType, CoalitionProposal,
    PermissionChecker, Action,
};

mod mdmp;

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
    /// DAO registry for multi-DAO management
    dao_registry: DAORegistry,
    /// Proposal manager for DAO proposals
    proposal_manager: ProposalManager,
    /// Role manager for DAO membership and permissions
    role_manager: RoleManager,
    /// Voting engine for DAO voting
    voting_engine: VotingEngine,
    /// Proposal executor for autonomy-aware execution
    proposal_executor: ProposalExecutor,
    /// DAO linkage manager for hierarchical relationships
    dao_linkages: DAOLinkageManager,
    /// Permission checker for access control
    permission_checker: PermissionChecker,
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
            dao_registry: DAORegistry::new(),
            proposal_manager: ProposalManager::new(),
            role_manager: RoleManager::new(),
            voting_engine: VotingEngine::new(),
            proposal_executor: ProposalExecutor::new(),
            dao_linkages: DAOLinkageManager::new(),
            permission_checker: PermissionChecker::new(),
        }
    }

    /// Migrate contract state (for future upgrades)
    /// When V2 is needed, this will handle migration from V1 to V2
    #[private]
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        use near_sdk::borsh::{self, BorshDeserialize};

        // Read old state (V1 without DAO fields)
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

        // Migrate to V2 with DAO fields initialized fresh
        Self {
            owner: old_state.owner,
            initialized: old_state.initialized,
            state_version: 2, // Bump to V2
            document_registry: old_state.document_registry,
            privacy_router: old_state.privacy_router,
            attestation_verifier: old_state.attestation_verifier,
            chain_signature_manager: old_state.chain_signature_manager,
            intent_verifier: old_state.intent_verifier,
            did_registry: old_state.did_registry,
            credential_registry: old_state.credential_registry,
            // Initialize new DAO fields
            dao_registry: DAORegistry::new(),
            proposal_manager: ProposalManager::new(),
            role_manager: RoleManager::new(),
            voting_engine: VotingEngine::new(),
            proposal_executor: ProposalExecutor::new(),
            dao_linkages: DAOLinkageManager::new(),
            permission_checker: PermissionChecker::new(),
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

    // ===== DAO Management Methods =====

    /// Create a new DAO
    ///
    /// Registers a new DAO with the given configuration.
    /// The caller becomes the DAO council (initial admin).
    ///
    /// # Arguments
    /// * `dao_id` - Unique identifier for the DAO
    /// * `config` - DAO configuration including name, autonomy level, etc.
    ///
    /// # Returns
    /// DAO ID as String
    pub fn create_dao(&mut self, dao_id: String, config: DAOConfig) -> String {
        require!(self.initialized, "Contract not initialized");

        let created_dao_id = self.dao_registry.create_dao(dao_id, config.clone());

        // Initialize default roles for the DAO
        self.role_manager.create_default_roles(&created_dao_id);

        // Assign caller as council member (admin)
        let caller = env::predecessor_account_id();
        self.role_manager.assign_role(&created_dao_id, &caller, "council");

        log!("DAO created: {} by {}", created_dao_id, caller);
        created_dao_id
    }

    /// Get DAO metadata by ID
    pub fn get_dao(&self, dao_id: String) -> Option<DAOMetadata> {
        self.dao_registry.get_dao(&dao_id)
    }

    /// List DAOs with pagination
    pub fn list_daos(&self, offset: u32, limit: u32) -> Vec<DAOMetadata> {
        self.dao_registry.list_daos(offset as usize, limit as usize)
    }

    /// Update DAO configuration (council only)
    pub fn update_dao_config(&mut self, dao_id: String, config: DAOConfig) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()),
            "Only council can update DAO config"
        );

        self.dao_registry.update_dao(&dao_id, config);
        log!("DAO config updated: {} by {}", dao_id, caller);
    }

    /// Get total DAO count
    pub fn get_dao_count(&self) -> u64 {
        self.dao_registry.get_dao_count()
    }

    // ===== Proposal Management Methods =====

    /// Create a new proposal
    ///
    /// # Arguments
    /// * `dao_id` - DAO where proposal is created
    /// * `kind` - Type of proposal
    /// * `description` - Description of what the proposal does
    /// * `classification` - Security classification (affects who can view/vote)
    ///
    /// # Returns
    /// Proposal ID as u64
    pub fn create_proposal(
        &mut self,
        dao_id: String,
        kind: ProposalKind,
        description: String,
        classification: Classification,
    ) -> u64 {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();

        // Check caller has permission to create this proposal type
        let can_propose = self.permission_checker.can_execute(
            &self.role_manager,
            &self.credential_registry,
            &dao_id,
            &caller,
            &kind,
            Action::AddProposal,
            &classification,
        );
        require!(can_propose, "No permission to create this proposal type");

        // Get DAO config for voting period
        let dao = self.dao_registry.get_dao(&dao_id)
            .expect("DAO not found");

        let proposal_id = self.proposal_manager.create_proposal(
            dao_id.clone(),
            kind.clone(),
            caller.clone(),
            description,
            classification,
            None, // No autonomy override
            dao.config.voting_period_ns,
        );

        log!(
            "Proposal created: dao={}, id={}, kind={:?}, proposer={}",
            dao_id,
            proposal_id,
            kind,
            caller
        );

        proposal_id
    }

    /// Get proposal by ID
    pub fn get_proposal(&self, dao_id: String, proposal_id: u64) -> Option<Proposal> {
        self.proposal_manager.get_proposal(&dao_id, proposal_id)
    }

    /// List proposals for a DAO with pagination
    pub fn list_proposals(&self, dao_id: String, offset: u32, limit: u32) -> Vec<Proposal> {
        self.proposal_manager.list_proposals(&dao_id, offset as usize, limit as usize)
    }

    /// Get proposal count for a DAO
    pub fn get_proposal_count(&self, dao_id: String) -> u64 {
        self.proposal_manager.get_proposal_count(&dao_id)
    }

    // ===== Voting Methods =====

    /// Cast a vote on a proposal
    ///
    /// # Arguments
    /// * `dao_id` - DAO containing the proposal
    /// * `proposal_id` - Proposal to vote on
    /// * `vote_type` - Approve, Reject, or Abstain
    pub fn cast_vote(&mut self, dao_id: String, proposal_id: u64, vote_type: VoteType) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();

        // Get proposal to check classification
        let proposal = self.proposal_manager.get_proposal(&dao_id, proposal_id)
            .expect("Proposal not found");

        // Check proposal is still active
        require!(
            proposal.status == ProposalStatus::InProgress,
            "Proposal is not in voting phase"
        );

        // Check voting deadline
        require!(
            env::block_timestamp() < proposal.voting_deadline,
            "Voting period has ended"
        );

        // Determine action based on vote type
        let action = match vote_type {
            VoteType::Approve => Action::VoteApprove,
            VoteType::Reject => Action::VoteReject,
            VoteType::Abstain => Action::VoteApprove, // Use approve for abstain permission check
        };

        // Check permission
        let can_vote = self.permission_checker.can_execute(
            &self.role_manager,
            &self.credential_registry,
            &dao_id,
            &caller,
            &proposal.kind,
            action,
            &proposal.classification,
        );
        require!(can_vote, "No permission to vote on this proposal");

        // Get vote weight
        let has_role = !self.role_manager.get_member_roles(&dao_id, &caller).is_empty();
        let policy = self.voting_engine.get_policy(&dao_id, &proposal.kind);
        let weight = self.voting_engine.get_vote_weight(&dao_id, &caller, policy.weight_kind, has_role);

        // Cast the vote
        self.voting_engine
            .cast_vote(&dao_id, proposal_id, caller.clone(), vote_type, weight)
            .expect("Failed to cast vote");

        log!(
            "Vote cast: dao={}, proposal={}, voter={}, type={:?}",
            dao_id,
            proposal_id,
            caller,
            vote_type
        );

        // Check if voting should complete (after deadline or unanimous)
        self.try_finalize_voting(&dao_id, proposal_id);
    }

    /// Get votes for a proposal
    pub fn get_votes(&self, dao_id: String, proposal_id: u64) -> Vec<Vote> {
        self.voting_engine.get_votes(&dao_id, proposal_id)
    }

    /// Check if voting has completed and process result
    fn try_finalize_voting(&mut self, dao_id: &str, proposal_id: u64) {
        let proposal = match self.proposal_manager.get_proposal(dao_id, proposal_id) {
            Some(p) => p,
            None => return,
        };

        // Only finalize if deadline passed
        if env::block_timestamp() < proposal.voting_deadline {
            return;
        }

        // Get voting policy and calculate result
        let policy = self.voting_engine.get_policy(dao_id, &proposal.kind);

        // Count eligible voters - get from DAO metadata
        let dao_meta = self.dao_registry.get_dao(dao_id).unwrap();
        let total_eligible = dao_meta.member_count;

        let result = self.voting_engine.calculate_result(
            dao_id,
            proposal_id,
            &policy,
            total_eligible.max(1),
        );

        // Get effective autonomy level for this proposal
        let dao = self.dao_registry.get_dao(dao_id).unwrap();
        let effective_autonomy = proposal.autonomy_override
            .unwrap_or(dao.config.default_autonomy_level);

        // Force human-in-loop for StrikeAuthorization
        let effective_autonomy = if matches!(proposal.kind, ProposalKind::StrikeAuthorization) {
            AutonomyLevel::NotAutonomous
        } else {
            effective_autonomy
        };

        // Process voting completion
        let execution_state = self.proposal_executor.process_voting_complete(
            dao_id,
            proposal_id,
            &result,
            effective_autonomy,
        );

        // Update proposal status based on execution state
        let new_status = match execution_state {
            ExecutionState::Rejected => ProposalStatus::Rejected,
            ExecutionState::ReadyForExecution => ProposalStatus::Approved,
            ExecutionState::InVetoWindow { .. } => ProposalStatus::Approved,
            ExecutionState::AwaitingHumanApproval => ProposalStatus::Approved,
            _ => proposal.status,
        };

        self.proposal_manager.update_proposal_status(dao_id, proposal_id, new_status);
    }

    // ===== Execution Methods =====

    /// Submit veto during veto window (council only)
    pub fn submit_veto(&mut self, dao_id: String, proposal_id: u64) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()),
            "Only council can submit veto"
        );

        let result = self.proposal_executor.submit_veto(&dao_id, proposal_id, caller.clone());
        require!(result.is_ok(), result.clone().unwrap_err());

        self.proposal_manager.update_proposal_status(&dao_id, proposal_id, ProposalStatus::Rejected);
        log!("Proposal vetoed: dao={}, id={}, by={}", dao_id, proposal_id, caller);
    }

    /// Submit human approval for human-in-loop proposals
    pub fn submit_human_approval(&mut self, dao_id: String, proposal_id: u64) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();

        // Get proposal to check kind
        let proposal = self.proposal_manager.get_proposal(&dao_id, proposal_id)
            .expect("Proposal not found");

        // Check permission to execute this proposal type
        let can_execute = self.permission_checker.can_execute(
            &self.role_manager,
            &self.credential_registry,
            &dao_id,
            &caller,
            &proposal.kind,
            Action::Execute,
            &proposal.classification,
        );
        require!(can_execute, "No permission to approve this proposal");

        let result = self.proposal_executor.submit_human_approval(&dao_id, proposal_id, caller.clone());
        require!(result.is_ok(), result.clone().unwrap_err());

        log!("Human approval received: dao={}, id={}, by={}", dao_id, proposal_id, caller);
    }

    /// Execute a proposal that is ready for execution
    pub fn execute_proposal(&mut self, dao_id: String, proposal_id: u64) -> String {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();

        // Check veto window if applicable
        self.proposal_executor.check_veto_window(&dao_id, proposal_id);

        // Get proposal
        let proposal = self.proposal_manager.get_proposal(&dao_id, proposal_id)
            .expect("Proposal not found");

        // Check permission to execute
        let can_execute = self.permission_checker.can_execute(
            &self.role_manager,
            &self.credential_registry,
            &dao_id,
            &caller,
            &proposal.kind,
            Action::Execute,
            &proposal.classification,
        );
        require!(can_execute, "No permission to execute this proposal");

        // Execute
        let result = self.proposal_executor.execute_proposal(
            &dao_id,
            proposal_id,
            &proposal.kind,
            caller.clone(),
            None,
        );
        require!(result.is_ok(), result.clone().unwrap_err());

        // Update proposal status to Approved (execution complete)
        self.proposal_manager.update_proposal_status(&dao_id, proposal_id, ProposalStatus::Approved);

        log!("Proposal executed: dao={}, id={}, by={}", dao_id, proposal_id, caller);
        result.unwrap()
    }

    /// Get execution state for a proposal
    pub fn get_execution_state(&self, dao_id: String, proposal_id: u64) -> ExecutionState {
        self.proposal_executor.get_execution_state(&dao_id, proposal_id)
    }

    // ===== Role Management Methods =====

    /// Assign role to account (council only)
    pub fn assign_role(&mut self, dao_id: String, account: AccountId, role_name: String) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()) || caller == self.owner,
            "Only council or owner can assign roles"
        );

        self.role_manager.assign_role(&dao_id, &account, &role_name);
        log!("Role assigned: dao={}, account={}, role={}", dao_id, account, role_name);
    }

    /// Remove role from account (council only)
    pub fn remove_role_from_member(&mut self, dao_id: String, account: AccountId, role_name: String) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()) || caller == self.owner,
            "Only council or owner can remove roles"
        );

        self.role_manager.remove_role(&dao_id, &account, &role_name);
        log!("Role removed: dao={}, account={}, role={}", dao_id, account, role_name);
    }

    /// Register an AI agent with trust tier (owner only)
    pub fn register_agent(&mut self, account: AccountId, tier: AgentTier) {
        require!(self.initialized, "Contract not initialized");
        require!(
            env::predecessor_account_id() == self.owner,
            "Only contract owner can register agents"
        );

        self.role_manager.register_agent(&account, tier);
        log!("Agent registered: account={}, tier={:?}", account, tier);
    }

    /// Get member's roles in a DAO
    pub fn get_member_roles(&self, dao_id: String, account: AccountId) -> Vec<String> {
        self.role_manager.get_member_roles(&dao_id, &account)
    }

    /// Create a custom role for a DAO (council only)
    pub fn create_role(&mut self, dao_id: String, role: Role) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()) || caller == self.owner,
            "Only council or owner can create roles"
        );

        self.role_manager.create_role(&dao_id, role.clone());
        log!("Role created: dao={}, role={}", dao_id, role.name);
    }

    // ===== DAO Linkage Methods =====

    /// Set parent DAO for hierarchy (council only)
    pub fn set_dao_parent(&mut self, child_dao_id: String, parent_dao_id: String) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();

        // Must be council of child DAO to set parent
        let roles = self.role_manager.get_member_roles(&child_dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()) || caller == self.owner,
            "Only council can set parent DAO"
        );

        self.dao_linkages.set_parent(&child_dao_id, &parent_dao_id);
        log!("DAO parent set: child={}, parent={}", child_dao_id, parent_dao_id);
    }

    /// Get parent DAO for a DAO
    pub fn get_dao_parent(&self, dao_id: String) -> Option<String> {
        self.dao_linkages.get_parent(&dao_id)
    }

    /// Get child DAOs
    pub fn get_dao_children(&self, dao_id: String) -> Vec<String> {
        self.dao_linkages.get_children(&dao_id)
    }

    /// Add cross-DAO approval requirement
    pub fn add_cross_dao_requirement(
        &mut self,
        dao_id: String,
        proposal_id: u64,
        required_dao_ids: Vec<String>,
        requirement_type: RequirementType,
    ) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()) || caller == self.owner,
            "Only council can add cross-DAO requirements"
        );

        self.dao_linkages.create_cross_dao_requirement(
            &dao_id,
            proposal_id,
            required_dao_ids.clone(),
            requirement_type,
        );

        log!(
            "Cross-DAO requirement added: dao={}, proposal={}, required={:?}",
            dao_id,
            proposal_id,
            required_dao_ids
        );
    }

    /// Record cross-DAO approval
    pub fn record_cross_dao_approval(
        &mut self,
        dao_id: String,
        proposal_id: u64,
        approving_dao_id: String,
    ) -> bool {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();

        // Must be council of approving DAO
        let roles = self.role_manager.get_member_roles(&approving_dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()),
            "Only council of approving DAO can record approval"
        );

        let all_approved = self.dao_linkages.record_cross_dao_approval(
            &dao_id,
            proposal_id,
            &approving_dao_id,
        );

        log!(
            "Cross-DAO approval recorded: dao={}, proposal={}, approving_dao={}, complete={}",
            dao_id,
            proposal_id,
            approving_dao_id,
            all_approved
        );

        all_approved
    }

    /// Check if cross-DAO requirements are met
    pub fn check_cross_dao_approved(&self, dao_id: String, proposal_id: u64) -> bool {
        self.dao_linkages.check_cross_dao_approved(&dao_id, proposal_id)
    }

    /// Create a coalition proposal requiring multi-party approval
    pub fn create_coalition_proposal(
        &mut self,
        dao_id: String,
        proposal_id: u64,
        required_parties: Vec<String>,
        all_parties_required: bool,
    ) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()) || caller == self.owner,
            "Only council can create coalition proposals"
        );

        self.dao_linkages.create_coalition_proposal(
            &dao_id,
            proposal_id,
            required_parties.clone(),
            all_parties_required,
        );

        log!(
            "Coalition proposal created: dao={}, proposal={}, parties={:?}",
            dao_id,
            proposal_id,
            required_parties
        );
    }

    /// Record party approval for coalition proposal
    ///
    /// NOTE: In production, caller's party membership should be verified
    /// via CoalitionMembership credential in credential_registry
    pub fn record_coalition_approval(
        &mut self,
        dao_id: String,
        proposal_id: u64,
        party: String,
    ) -> bool {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();

        // In production: verify caller has CoalitionMembership credential for this party
        // For now, we trust the caller to represent their party honestly

        let all_approved = self.dao_linkages.record_party_approval(
            &dao_id,
            proposal_id,
            &party,
            caller.clone(),
        );

        log!(
            "Coalition approval recorded: dao={}, proposal={}, party={}, by={}, complete={}",
            dao_id,
            proposal_id,
            party,
            caller,
            all_approved
        );

        all_approved
    }

    /// Get coalition proposal status
    pub fn get_coalition_status(&self, dao_id: String, proposal_id: u64) -> Option<CoalitionProposal> {
        self.dao_linkages.get_coalition_status(&dao_id, proposal_id)
    }

    /// Check if coalition requirements are met
    pub fn check_coalition_approved(&self, dao_id: String, proposal_id: u64) -> bool {
        self.dao_linkages.check_coalition_approved(&dao_id, proposal_id)
    }

    /// Set voting policy for a proposal kind in a DAO
    pub fn set_vote_policy(&mut self, dao_id: String, proposal_kind: ProposalKind, policy: VotePolicy) {
        require!(self.initialized, "Contract not initialized");

        let caller = env::predecessor_account_id();
        let roles = self.role_manager.get_member_roles(&dao_id, &caller);
        require!(
            roles.contains(&"council".to_string()) || caller == self.owner,
            "Only council can set vote policy"
        );

        self.voting_engine.set_policy(&dao_id, &proposal_kind, policy);
        log!("Vote policy set: dao={}, kind={:?}", dao_id, proposal_kind);
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

    // ===== DAO Integration Tests =====

    fn get_context_with_time(predecessor: AccountId, timestamp: u64) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder.block_timestamp(timestamp);
        builder
    }

    fn create_test_dao_config(name: &str) -> DAOConfig {
        DAOConfig {
            name: name.to_string(),
            description: "Test DAO".to_string(),
            classification: Classification::Public,
            default_autonomy_level: AutonomyLevel::Autonomous,
            proposal_bond: 1_000_000_000_000_000_000_000_000, // 1 NEAR
            voting_period_ns: 86_400_000_000_000, // 24 hours in ns
            parent_dao_id: None,
        }
    }

    #[test]
    fn test_dao_creation() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));

        assert!(!dao_id.is_empty());
        assert_eq!(contract.get_dao_count(), 1);

        let dao = contract.get_dao(dao_id.clone()).unwrap();
        assert_eq!(dao.config.name, "Test DAO");

        // Creator should be council
        let roles = contract.get_member_roles(dao_id.clone(), owner.clone());
        assert!(roles.contains(&"council".to_string()));
    }

    #[test]
    fn test_dao_proposal_lifecycle() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context_with_time(owner.clone(), 1_000_000_000);
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        // Create DAO
        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));

        // Create proposal
        let proposal_id = contract.create_proposal(
            dao_id.clone(),
            ProposalKind::Transfer,
            "Transfer funds".to_string(),
            Classification::Public,
        );

        assert_eq!(proposal_id, 0); // First proposal has ID 0
        assert_eq!(contract.get_proposal_count(dao_id.clone()), 1);

        let proposal = contract.get_proposal(dao_id.clone(), proposal_id).unwrap();
        assert_eq!(proposal.description, "Transfer funds");
        assert!(matches!(proposal.status, ProposalStatus::InProgress));
    }

    #[test]
    fn test_dao_voting() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let timestamp = 1_000_000_000u64;

        let context = get_context_with_time(alice.clone(), timestamp);
        testing_env!(context.build());

        let mut contract = Contract::new(alice.clone());

        // Create DAO and add bob as member
        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));
        contract.assign_role(dao_id.clone(), bob.clone(), "member".to_string());

        // Create proposal
        let proposal_id = contract.create_proposal(
            dao_id.clone(),
            ProposalKind::Transfer,
            "Transfer funds".to_string(),
            Classification::Public,
        );

        // Alice votes
        contract.cast_vote(dao_id.clone(), proposal_id, VoteType::Approve);

        // Bob votes
        let context = get_context_with_time(bob.clone(), timestamp + 1000);
        testing_env!(context.build());
        contract.cast_vote(dao_id.clone(), proposal_id, VoteType::Approve);

        // Check votes
        let votes = contract.get_votes(dao_id.clone(), proposal_id);
        assert_eq!(votes.len(), 2);
    }

    #[test]
    fn test_dao_role_management() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let member: AccountId = "bob.near".parse().unwrap();

        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));

        // Assign member role
        contract.assign_role(dao_id.clone(), member.clone(), "member".to_string());

        let roles = contract.get_member_roles(dao_id.clone(), member.clone());
        assert!(roles.contains(&"member".to_string()));

        // Remove member role
        contract.remove_role_from_member(dao_id.clone(), member.clone(), "member".to_string());

        let roles = contract.get_member_roles(dao_id.clone(), member.clone());
        assert!(!roles.contains(&"member".to_string()));
    }

    #[test]
    fn test_dao_hierarchy() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        // Create parent and child DAOs
        let parent_dao_id = contract.create_dao("strategic-hq".to_string(), create_test_dao_config("Strategic HQ"));
        let child_dao_id = contract.create_dao("mission-alpha".to_string(), create_test_dao_config("Mission Alpha"));

        // Set parent-child relationship
        contract.set_dao_parent(child_dao_id.clone(), parent_dao_id.clone());

        // Verify relationship
        assert_eq!(
            contract.get_dao_parent(child_dao_id.clone()),
            Some(parent_dao_id.clone())
        );
        assert!(contract.get_dao_children(parent_dao_id.clone()).contains(&child_dao_id));
    }

    #[test]
    fn test_cross_dao_approval() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();

        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(alice.clone());

        // Create two DAOs
        let dao_a = contract.create_dao("dao-a".to_string(), create_test_dao_config("DAO A"));
        let dao_b = contract.create_dao("dao-b".to_string(), create_test_dao_config("DAO B"));

        // Assign bob as council of DAO B
        contract.assign_role(dao_b.clone(), bob.clone(), "council".to_string());

        // Create proposal in DAO A
        let proposal_id = contract.create_proposal(
            dao_a.clone(),
            ProposalKind::Transfer,
            "Joint operation".to_string(),
            Classification::Public,
        );

        // Add cross-DAO requirement
        contract.add_cross_dao_requirement(
            dao_a.clone(),
            proposal_id,
            vec![dao_b.clone()],
            RequirementType::AllRequired,
        );

        // Not approved yet
        assert!(!contract.check_cross_dao_approved(dao_a.clone(), proposal_id));

        // Bob (DAO B council) approves
        let context = get_context(bob.clone());
        testing_env!(context.build());

        let all_approved = contract.record_cross_dao_approval(
            dao_a.clone(),
            proposal_id,
            dao_b.clone(),
        );

        assert!(all_approved);
        assert!(contract.check_cross_dao_approved(dao_a.clone(), proposal_id));
    }

    #[test]
    fn test_coalition_voting() {
        let usa_rep: AccountId = "usa.near".parse().unwrap();
        let gbr_rep: AccountId = "gbr.near".parse().unwrap();

        let context = get_context(usa_rep.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(usa_rep.clone());

        // Create coalition DAO
        let dao_id = contract.create_dao("coalition-dao".to_string(), create_test_dao_config("Coalition DAO"));

        // Create proposal
        let proposal_id = contract.create_proposal(
            dao_id.clone(),
            ProposalKind::MissionOrder,
            "Joint operation".to_string(),
            Classification::Public,
        );

        // Create coalition requirement
        contract.create_coalition_proposal(
            dao_id.clone(),
            proposal_id,
            vec!["USA".to_string(), "GBR".to_string()],
            true, // All parties required
        );

        // USA approves
        assert!(!contract.record_coalition_approval(dao_id.clone(), proposal_id, "USA".to_string()));

        // GBR approves
        let context = get_context(gbr_rep.clone());
        testing_env!(context.build());
        assert!(contract.record_coalition_approval(dao_id.clone(), proposal_id, "GBR".to_string()));

        // Coalition approved
        assert!(contract.check_coalition_approved(dao_id.clone(), proposal_id));

        // Check status
        let status = contract.get_coalition_status(dao_id.clone(), proposal_id).unwrap();
        assert!(status.party_approvals.get("USA").unwrap().approved);
        assert!(status.party_approvals.get("GBR").unwrap().approved);
    }

    #[test]
    fn test_agent_registration() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let agent: AccountId = "agent.near".parse().unwrap();

        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        // Register agent
        contract.register_agent(agent.clone(), AgentTier::SupportAgent);

        // Create DAO and try to assign role to agent
        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));
        contract.assign_role(dao_id.clone(), agent.clone(), "member".to_string());

        let roles = contract.get_member_roles(dao_id.clone(), agent);
        assert!(roles.contains(&"member".to_string()));
    }

    #[test]
    fn test_execution_state_tracking() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));

        let proposal_id = contract.create_proposal(
            dao_id.clone(),
            ProposalKind::Transfer,
            "Test".to_string(),
            Classification::Public,
        );

        // Initially pending
        let state = contract.get_execution_state(dao_id.clone(), proposal_id);
        assert!(matches!(state, ExecutionState::Pending));
    }

    #[test]
    fn test_dao_list_pagination() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());

        // Create multiple DAOs
        for i in 0..5 {
            contract.create_dao(format!("dao-{}", i), create_test_dao_config(&format!("DAO {}", i)));
        }

        assert_eq!(contract.get_dao_count(), 5);

        // List with pagination
        let daos = contract.list_daos(0, 3);
        assert_eq!(daos.len(), 3);

        let daos = contract.list_daos(3, 3);
        assert_eq!(daos.len(), 2);
    }

    #[test]
    #[should_panic(expected = "Only council can update DAO config")]
    fn test_dao_update_requires_council() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let non_council: AccountId = "bob.near".parse().unwrap();

        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));

        // Non-council tries to update
        let context = get_context(non_council);
        testing_env!(context.build());

        contract.update_dao_config(dao_id, create_test_dao_config("Updated"));
    }

    #[test]
    #[should_panic(expected = "Only council can submit veto")]
    fn test_veto_requires_council() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let non_council: AccountId = "bob.near".parse().unwrap();

        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(owner.clone());
        let dao_id = contract.create_dao("test-dao".to_string(), create_test_dao_config("Test DAO"));
        let proposal_id = contract.create_proposal(
            dao_id.clone(),
            ProposalKind::Transfer,
            "Test".to_string(),
            Classification::Public,
        );

        // Non-council tries to veto
        let context = get_context(non_council);
        testing_env!(context.build());

        contract.submit_veto(dao_id, proposal_id);
    }

    #[test]
    fn test_dao_initialization() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let contract = Contract::new(owner.clone());

        // DAO count should be zero initially
        assert_eq!(contract.get_dao_count(), 0);
    }
}
