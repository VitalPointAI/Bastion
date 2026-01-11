// SSR Foundation Contract - NEAR blockchain foundation
use near_sdk::{env, log, near, require, AccountId, PanicOnDefault};

mod document;
use document::{Document, DocumentRegistry};

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
        }

        let old_state: OldState = env::state_read().expect("Failed to read state");

        // For now, just copy the state
        // When V2 is added, migration logic will be implemented here
        Self {
            owner: old_state.owner,
            initialized: old_state.initialized,
            state_version: old_state.state_version,
            document_registry: old_state.document_registry,
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
