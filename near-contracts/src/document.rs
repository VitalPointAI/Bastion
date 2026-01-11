/**
 * Encrypted Document Registry
 *
 * Stores encrypted IPFS CIDs and metadata on-chain for provenance and auditability.
 * ALL data encrypted by default - only owner AccountId and timestamps plaintext.
 *
 * Architecture:
 * - Large files → encrypted client-side → IPFS (off-chain, cost-effective)
 * - IPFS CID → encrypted client-side → NEAR blockchain (on-chain for provenance)
 * - Metadata → encrypted client-side → NEAR blockchain (on-chain with privacy)
 */

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, log, AccountId, BorshStorageKey};

/// Document with ALL encrypted fields (except owner and timestamp)
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Document {
    /// Encrypted IPFS CID (references to off-chain IPFS content)
    pub encrypted_cid: String,
    /// Encrypted classification level
    pub encrypted_classification: String,
    /// Encrypted key for decrypting the content encryption key
    pub encrypted_metadata_key: String,
    /// Owner AccountId (plaintext - required for access control)
    pub owner: AccountId,
    /// Creation timestamp (plaintext - required for sorting/filtering)
    pub created_at: u64,
    /// Encrypted JSON blob with additional metadata
    pub encrypted_metadata: String,
}

/// Storage keys for collections
#[derive(BorshStorageKey, BorshSerialize)]
pub enum StorageKey {
    Documents,
    UserDocuments,
}

/// Document registry managing encrypted documents
#[derive(BorshDeserialize, BorshSerialize)]
pub struct DocumentRegistry {
    /// All documents: document_id → Document
    pub documents: UnorderedMap<String, Document>,
    /// User document index: AccountId → Vec<document_id>
    pub user_documents: LookupMap<AccountId, Vec<String>>,
    /// Document counter for unique IDs
    pub document_counter: u64,
}

impl DocumentRegistry {
    /// Initialize new document registry
    pub fn new() -> Self {
        Self {
            documents: UnorderedMap::new(StorageKey::Documents),
            user_documents: LookupMap::new(StorageKey::UserDocuments),
            document_counter: 0,
        }
    }

    /// Register a new encrypted document
    ///
    /// @param encrypted_cid - Encrypted IPFS CID
    /// @param encrypted_classification - Encrypted classification level
    /// @param encrypted_metadata_key - Encrypted key for content decryption
    /// @param encrypted_metadata - Encrypted additional metadata
    /// @returns document_id
    pub fn register_document(
        &mut self,
        encrypted_cid: String,
        encrypted_classification: String,
        encrypted_metadata_key: String,
        encrypted_metadata: String,
    ) -> String {
        let owner = env::predecessor_account_id();
        let created_at = env::block_timestamp();

        // Increment counter for unique IDs
        self.document_counter += 1;

        // Generate unique document ID
        let document_id = format!("doc-{}-{}-{}", owner, created_at, self.document_counter);

        let document = Document {
            encrypted_cid: encrypted_cid.clone(),
            encrypted_classification: encrypted_classification.clone(),
            encrypted_metadata_key,
            owner: owner.clone(),
            created_at,
            encrypted_metadata,
        };

        // Store document
        self.documents.insert(&document_id, &document);

        // Update user document index
        let mut user_docs = self.user_documents.get(&owner).unwrap_or_default();
        user_docs.push(document_id.clone());
        self.user_documents.insert(&owner, &user_docs);

        // Emit event for PostgreSQL sync (Plan 1-03A)
        log!(
            "DOCUMENT_REGISTERED: {{\"document_id\": \"{}\", \"encrypted_cid\": \"{}\", \"owner\": \"{}\", \"created_at\": {}, \"encrypted_classification\": \"{}\"}}",
            document_id,
            encrypted_cid,
            owner,
            created_at,
            encrypted_classification
        );

        document_id
    }

    /// Get document by ID (returns encrypted data - caller must decrypt)
    pub fn get_document(&self, document_id: String) -> Option<Document> {
        self.documents.get(&document_id)
    }

    /// List documents for a user (with pagination)
    pub fn list_user_documents(
        &self,
        account_id: AccountId,
        offset: Option<usize>,
        limit: Option<usize>,
    ) -> Vec<Document> {
        let offset = offset.unwrap_or(0);
        let limit = limit.unwrap_or(10);

        let doc_ids = self.user_documents.get(&account_id).unwrap_or_default();

        doc_ids
            .iter()
            .skip(offset)
            .take(limit)
            .filter_map(|id| self.documents.get(id))
            .collect()
    }

    /// Get document count for a user
    pub fn get_user_document_count(&self, account_id: AccountId) -> usize {
        self.user_documents
            .get(&account_id)
            .unwrap_or_default()
            .len()
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

    #[test]
    fn test_register_document() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DocumentRegistry::new();

        let doc_id = registry.register_document(
            "encrypted_cid_xyz".to_string(),
            "encrypted_classification_secret".to_string(),
            "encrypted_key_abc".to_string(),
            "encrypted_metadata_json".to_string(),
        );

        assert!(doc_id.starts_with("doc-"));
        assert!(doc_id.contains(&owner.to_string()));
    }

    #[test]
    fn test_get_document() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DocumentRegistry::new();

        let doc_id = registry.register_document(
            "encrypted_cid_xyz".to_string(),
            "encrypted_classification_secret".to_string(),
            "encrypted_key_abc".to_string(),
            "encrypted_metadata_json".to_string(),
        );

        let doc = registry.get_document(doc_id).unwrap();
        assert_eq!(doc.encrypted_cid, "encrypted_cid_xyz");
        assert_eq!(doc.owner, owner);
    }

    #[test]
    fn test_list_user_documents() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DocumentRegistry::new();

        // Register multiple documents
        registry.register_document(
            "encrypted_cid_1".to_string(),
            "encrypted_class_1".to_string(),
            "encrypted_key_1".to_string(),
            "encrypted_meta_1".to_string(),
        );
        registry.register_document(
            "encrypted_cid_2".to_string(),
            "encrypted_class_2".to_string(),
            "encrypted_key_2".to_string(),
            "encrypted_meta_2".to_string(),
        );

        let docs = registry.list_user_documents(owner.clone(), None, None);
        assert_eq!(docs.len(), 2);
        // Both documents should be present (order may vary)
        let cids: Vec<String> = docs.iter().map(|d| d.encrypted_cid.clone()).collect();
        assert!(cids.contains(&"encrypted_cid_1".to_string()));
        assert!(cids.contains(&"encrypted_cid_2".to_string()));
    }

    #[test]
    fn test_list_user_documents_with_pagination() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DocumentRegistry::new();

        // Register 3 documents
        for i in 1..=3 {
            registry.register_document(
                format!("encrypted_cid_{}", i),
                format!("encrypted_class_{}", i),
                format!("encrypted_key_{}", i),
                format!("encrypted_meta_{}", i),
            );
        }

        // Get first page (limit 2)
        let page1 = registry.list_user_documents(owner.clone(), Some(0), Some(2));
        assert_eq!(page1.len(), 2);

        // Get second page (offset 2, limit 2)
        let page2 = registry.list_user_documents(owner.clone(), Some(2), Some(2));
        assert_eq!(page2.len(), 1);
    }

    #[test]
    fn test_get_user_document_count() {
        let owner: AccountId = "owner.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DocumentRegistry::new();

        assert_eq!(registry.get_user_document_count(owner.clone()), 0);

        registry.register_document(
            "encrypted_cid_1".to_string(),
            "encrypted_class_1".to_string(),
            "encrypted_key_1".to_string(),
            "encrypted_meta_1".to_string(),
        );

        assert_eq!(registry.get_user_document_count(owner.clone()), 1);
    }
}
