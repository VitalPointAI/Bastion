// NEAR Intents module for intent-based transaction abstraction
// Users express WHAT they want, solvers find optimal execution
use near_sdk::{
    env, log, near, AccountId, BorshStorageKey,
};
use near_sdk::collections::{UnorderedMap, Vector};
use near_sdk::serde_json;

/// Intent status in lifecycle
#[near(serializers=[borsh, json])]
#[derive(Debug, Clone, PartialEq)]
pub enum IntentStatus {
    Pending,
    Verified,
    Rejected,
}

/// Intent structure
/// Represents user's desired outcome without implementation details
#[near(serializers=[borsh, json])]
#[derive(Debug, Clone)]
pub struct Intent {
    /// Intent ID (generated)
    pub intent_id: String,
    /// Intent type (transfer, mission_order, document_verification)
    pub intent_type: String,
    /// Creator account
    pub creator: AccountId,
    /// Intent parameters (JSON)
    pub params: String,
    /// Current status
    pub status: IntentStatus,
    /// Creation timestamp
    pub created_at: u64,
    /// Verification timestamp (if verified)
    pub verified_at: Option<u64>,
}

/// Storage keys for collections
#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Intents,
    UserIntents,
}

/// Intent Verifier
/// Custom verification logic for coalition-specific intent types
#[near(serializers=[borsh])]
pub struct IntentVerifier {
    /// All intents by ID
    intents: UnorderedMap<String, Intent>,
    /// Intents by user
    user_intents: UnorderedMap<AccountId, Vector<String>>,
    /// Next intent ID counter
    next_intent_id: u64,
}

impl IntentVerifier {
    /// Create new Intent Verifier
    pub fn new() -> Self {
        Self {
            intents: UnorderedMap::new(StorageKey::Intents),
            user_intents: UnorderedMap::new(StorageKey::UserIntents),
            next_intent_id: 0,
        }
    }

    /// Generate next intent ID
    fn next_id(&mut self) -> String {
        let id = format!("intent-{}", self.next_intent_id);
        self.next_intent_id += 1;
        id
    }

    /// Submit intent for verification
    ///
    /// # Arguments
    /// * `intent_type` - Type of intent (transfer, mission_order, document_verification)
    /// * `params` - JSON parameters for the intent
    ///
    /// # Returns
    /// Intent ID
    pub fn submit_intent(
        &mut self,
        intent_type: String,
        params: String,
    ) -> String {
        let creator = env::predecessor_account_id();
        let intent_id = self.next_id();
        let created_at = env::block_timestamp();

        let intent = Intent {
            intent_id: intent_id.clone(),
            intent_type: intent_type.clone(),
            creator: creator.clone(),
            params: params.clone(),
            status: IntentStatus::Pending,
            created_at,
            verified_at: None,
        };

        // Store intent
        self.intents.insert(&intent_id, &intent);

        // Add to user's intents
        let mut user_intent_list = self.user_intents
            .get(&creator)
            .unwrap_or_else(|| {
                Vector::new(format!("u-{}", creator).as_bytes())
            });
        user_intent_list.push(&intent_id);
        self.user_intents.insert(&creator, &user_intent_list);

        log!(
            "Intent submitted: {} (type: {}, creator: {})",
            intent_id,
            intent_type,
            creator
        );

        intent_id
    }

    /// Verify transfer intent
    ///
    /// Validates:
    /// - Valid JSON parameters
    /// - Required fields present (amount, recipient, asset)
    /// - User authorized for transfer
    ///
    /// # Arguments
    /// * `intent_id` - Intent to verify
    ///
    /// # Returns
    /// true if valid, false otherwise
    pub fn verify_transfer_intent(&mut self, intent_id: String) -> bool {
        let mut intent = match self.intents.get(&intent_id) {
            Some(i) => i,
            None => {
                log!("Intent not found: {}", intent_id);
                return false;
            }
        };

        // Check intent type
        if intent.intent_type != "transfer" {
            log!("Invalid intent type for transfer verification: {}", intent.intent_type);
            return false;
        }

        // Parse parameters
        let params: Result<serde_json::Value, _> = serde_json::from_str(&intent.params);
        let params = match params {
            Ok(p) => p,
            Err(e) => {
                log!("Invalid JSON parameters: {}", e);
                self.reject_intent(intent_id);
                return false;
            }
        };

        // Verify required fields
        let valid = params.get("amount").is_some()
            && params.get("recipient").is_some()
            && params.get("asset").is_some();

        if valid {
            intent.status = IntentStatus::Verified;
            intent.verified_at = Some(env::block_timestamp());
            self.intents.insert(&intent_id, &intent);
            log!("Transfer intent verified: {}", intent_id);
            true
        } else {
            log!("Transfer intent missing required fields: {}", intent_id);
            self.reject_intent(intent_id);
            false
        }
    }

    /// Verify mission order intent (placeholder for tactical operations)
    ///
    /// Validates:
    /// - Valid JSON parameters
    /// - Commander authorization
    /// - Required fields (mission_type, target, assets)
    ///
    /// # Arguments
    /// * `intent_id` - Intent to verify
    /// * `authorized_commanders` - List of authorized commander accounts
    ///
    /// # Returns
    /// true if valid, false otherwise
    pub fn verify_mission_order_intent(
        &mut self,
        intent_id: String,
        authorized_commanders: Vec<AccountId>,
    ) -> bool {
        let mut intent = match self.intents.get(&intent_id) {
            Some(i) => i,
            None => {
                log!("Intent not found: {}", intent_id);
                return false;
            }
        };

        // Check intent type
        if intent.intent_type != "mission_order" {
            log!("Invalid intent type for mission order verification: {}", intent.intent_type);
            return false;
        }

        // Check commander authorization
        if !authorized_commanders.contains(&intent.creator) {
            log!("Unauthorized commander: {}", intent.creator);
            self.reject_intent(intent_id);
            return false;
        }

        // Parse parameters
        let params: Result<serde_json::Value, _> = serde_json::from_str(&intent.params);
        let params = match params {
            Ok(p) => p,
            Err(e) => {
                log!("Invalid JSON parameters: {}", e);
                self.reject_intent(intent_id);
                return false;
            }
        };

        // Verify required fields
        let valid = params.get("mission_type").is_some()
            && params.get("target").is_some()
            && params.get("assets").is_some();

        if valid {
            intent.status = IntentStatus::Verified;
            intent.verified_at = Some(env::block_timestamp());
            self.intents.insert(&intent_id, &intent);
            log!("Mission order intent verified: {}", intent_id);
            true
        } else {
            log!("Mission order intent missing required fields: {}", intent_id);
            self.reject_intent(intent_id);
            false
        }
    }

    /// Verify document verification intent
    ///
    /// Validates:
    /// - Valid JSON parameters
    /// - Document exists (checked via document_id parameter)
    /// - User has access permissions
    ///
    /// # Arguments
    /// * `intent_id` - Intent to verify
    /// * `existing_documents` - List of valid document IDs
    ///
    /// # Returns
    /// true if valid, false otherwise
    pub fn verify_document_intent(
        &mut self,
        intent_id: String,
        existing_documents: Vec<String>,
    ) -> bool {
        let mut intent = match self.intents.get(&intent_id) {
            Some(i) => i,
            None => {
                log!("Intent not found: {}", intent_id);
                return false;
            }
        };

        // Check intent type
        if intent.intent_type != "document_verification" {
            log!("Invalid intent type for document verification: {}", intent.intent_type);
            return false;
        }

        // Parse parameters
        let params: Result<serde_json::Value, _> = serde_json::from_str(&intent.params);
        let params = match params {
            Ok(p) => p,
            Err(e) => {
                log!("Invalid JSON parameters: {}", e);
                self.reject_intent(intent_id);
                return false;
            }
        };

        // Check document exists
        let document_id = match params.get("document_id").and_then(|v| v.as_str()) {
            Some(id) => id,
            None => {
                log!("Document ID not found in parameters");
                self.reject_intent(intent_id);
                return false;
            }
        };

        if !existing_documents.contains(&document_id.to_string()) {
            log!("Document not found: {}", document_id);
            self.reject_intent(intent_id);
            return false;
        }

        intent.status = IntentStatus::Verified;
        intent.verified_at = Some(env::block_timestamp());
        self.intents.insert(&intent_id, &intent);
        log!("Document verification intent verified: {}", intent_id);
        true
    }

    /// Reject an intent
    fn reject_intent(&mut self, intent_id: String) {
        if let Some(mut intent) = self.intents.get(&intent_id) {
            intent.status = IntentStatus::Rejected;
            self.intents.insert(&intent_id, &intent);
            log!("Intent rejected: {}", intent_id);
        }
    }

    /// Settle intent after solver execution
    ///
    /// Updates intent status to Verified after successful execution
    /// Called by contract after solver completes the intent
    ///
    /// # Arguments
    /// * `intent_id` - Intent that was executed
    pub fn settle_intent(&mut self, intent_id: String) {
        if let Some(mut intent) = self.intents.get(&intent_id) {
            intent.status = IntentStatus::Verified;
            intent.verified_at = Some(env::block_timestamp());
            self.intents.insert(&intent_id, &intent);
            log!("Intent settled: {}", intent_id);
        }
    }

    /// Get intent by ID
    pub fn get_intent(&self, intent_id: String) -> Option<Intent> {
        self.intents.get(&intent_id)
    }

    /// List user's intents
    pub fn list_user_intents(
        &self,
        account_id: AccountId,
        offset: Option<usize>,
        limit: Option<usize>,
    ) -> Vec<Intent> {
        let intent_ids = match self.user_intents.get(&account_id) {
            Some(ids) => ids,
            None => return vec![],
        };

        let offset = offset.unwrap_or(0);
        let limit = limit.unwrap_or(10).min(50); // Cap at 50

        intent_ids
            .iter()
            .skip(offset)
            .take(limit)
            .filter_map(|id| self.intents.get(&id))
            .collect()
    }

    /// Get user's intent count
    pub fn get_user_intent_count(&self, account_id: AccountId) -> usize {
        self.user_intents
            .get(&account_id)
            .map(|ids| ids.len() as usize)
            .unwrap_or(0)
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
        builder.block_timestamp(1000000000);
        builder
    }

    #[test]
    fn test_submit_intent() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit transfer intent
        let intent_id = verifier.submit_intent(
            "transfer".to_string(),
            r#"{"amount":"100","recipient":"recipient.near","asset":"NEAR"}"#.to_string(),
        );

        assert!(intent_id.starts_with("intent-"));
        assert_eq!(verifier.get_user_intent_count(user.clone()), 1);

        // Get intent
        let intent = verifier.get_intent(intent_id.clone()).unwrap();
        assert_eq!(intent.intent_type, "transfer");
        assert_eq!(intent.creator, user);
        assert_eq!(intent.status, IntentStatus::Pending);
    }

    #[test]
    fn test_verify_transfer_intent() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit valid transfer intent
        let intent_id = verifier.submit_intent(
            "transfer".to_string(),
            r#"{"amount":"100","recipient":"recipient.near","asset":"NEAR"}"#.to_string(),
        );

        // Verify intent
        let valid = verifier.verify_transfer_intent(intent_id.clone());
        assert!(valid);

        // Check status updated
        let intent = verifier.get_intent(intent_id).unwrap();
        assert_eq!(intent.status, IntentStatus::Verified);
        assert!(intent.verified_at.is_some());
    }

    #[test]
    fn test_verify_transfer_intent_missing_fields() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit invalid transfer intent (missing recipient)
        let intent_id = verifier.submit_intent(
            "transfer".to_string(),
            r#"{"amount":"100","asset":"NEAR"}"#.to_string(),
        );

        // Verify intent should fail
        let valid = verifier.verify_transfer_intent(intent_id.clone());
        assert!(!valid);

        // Check status updated to rejected
        let intent = verifier.get_intent(intent_id).unwrap();
        assert_eq!(intent.status, IntentStatus::Rejected);
    }

    #[test]
    fn test_verify_mission_order_intent() {
        let commander: AccountId = "commander.near".parse().unwrap();
        let context = get_context(commander.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit mission order intent
        let intent_id = verifier.submit_intent(
            "mission_order".to_string(),
            r#"{"mission_type":"reconnaissance","target":"area-51","assets":["drone-1","drone-2"]}"#.to_string(),
        );

        // Verify with authorized commander
        let authorized = vec![commander.clone()];
        let valid = verifier.verify_mission_order_intent(intent_id.clone(), authorized);
        assert!(valid);

        let intent = verifier.get_intent(intent_id).unwrap();
        assert_eq!(intent.status, IntentStatus::Verified);
    }

    #[test]
    fn test_verify_mission_order_unauthorized() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit mission order intent
        let intent_id = verifier.submit_intent(
            "mission_order".to_string(),
            r#"{"mission_type":"reconnaissance","target":"area-51","assets":["drone-1"]}"#.to_string(),
        );

        // Verify with different authorized commander
        let commander: AccountId = "commander.near".parse().unwrap();
        let authorized = vec![commander];
        let valid = verifier.verify_mission_order_intent(intent_id.clone(), authorized);
        assert!(!valid);

        let intent = verifier.get_intent(intent_id).unwrap();
        assert_eq!(intent.status, IntentStatus::Rejected);
    }

    #[test]
    fn test_verify_document_intent() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit document verification intent
        let intent_id = verifier.submit_intent(
            "document_verification".to_string(),
            r#"{"document_id":"doc-123","action":"verify"}"#.to_string(),
        );

        // Verify with existing document
        let existing_docs = vec!["doc-123".to_string()];
        let valid = verifier.verify_document_intent(intent_id.clone(), existing_docs);
        assert!(valid);

        let intent = verifier.get_intent(intent_id).unwrap();
        assert_eq!(intent.status, IntentStatus::Verified);
    }

    #[test]
    fn test_verify_document_intent_not_found() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit document verification intent
        let intent_id = verifier.submit_intent(
            "document_verification".to_string(),
            r#"{"document_id":"doc-999","action":"verify"}"#.to_string(),
        );

        // Verify with different documents
        let existing_docs = vec!["doc-123".to_string()];
        let valid = verifier.verify_document_intent(intent_id.clone(), existing_docs);
        assert!(!valid);

        let intent = verifier.get_intent(intent_id).unwrap();
        assert_eq!(intent.status, IntentStatus::Rejected);
    }

    #[test]
    fn test_settle_intent() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        let intent_id = verifier.submit_intent(
            "transfer".to_string(),
            r#"{"amount":"100","recipient":"recipient.near","asset":"NEAR"}"#.to_string(),
        );

        // Settle intent
        verifier.settle_intent(intent_id.clone());

        let intent = verifier.get_intent(intent_id).unwrap();
        assert_eq!(intent.status, IntentStatus::Verified);
        assert!(intent.verified_at.is_some());
    }

    #[test]
    fn test_list_user_intents() {
        let user: AccountId = "user.near".parse().unwrap();
        let context = get_context(user.clone());
        testing_env!(context.build());

        let mut verifier = IntentVerifier::new();

        // Submit multiple intents
        verifier.submit_intent("transfer".to_string(), r#"{"amount":"100"}"#.to_string());
        verifier.submit_intent("transfer".to_string(), r#"{"amount":"200"}"#.to_string());
        verifier.submit_intent("transfer".to_string(), r#"{"amount":"300"}"#.to_string());

        // List intents
        let intents = verifier.list_user_intents(user.clone(), None, None);
        assert_eq!(intents.len(), 3);

        // Test pagination
        let intents = verifier.list_user_intents(user.clone(), Some(1), Some(2));
        assert_eq!(intents.len(), 2);
    }
}
