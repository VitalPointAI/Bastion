/**
 * DAO Registry
 *
 * Multi-DAO registry for managing mission-focused DAOs.
 * Each DAO is a discrete governance unit for projects, capabilities, or missions.
 *
 * Storage patterns follow existing DID/Credential registries:
 * - LookupMap for efficient key-value access
 * - Owner-based access control
 * - Pagination for list operations
 */

use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};

use super::types::{DAOConfig, DAOMetadata};

/// Storage keys for DAO registry collections
#[derive(BorshStorageKey)]
#[near]
pub enum DAOStorageKey {
    /// Primary storage: dao_id -> metadata
    DAOs,
    /// List of all DAO IDs for pagination
    DAOList,
}

/// DAO Registry for managing multiple DAOs
#[near(serializers = [borsh])]
pub struct DAORegistry {
    /// Primary storage: dao_id -> DAOMetadata
    daos: LookupMap<String, DAOMetadata>,

    /// List of all DAO IDs (for pagination)
    /// Note: Using Vec for simplicity; production might use UnorderedSet
    dao_ids: Vec<String>,

    /// Total count of registered DAOs
    dao_count: u64,
}

impl DAORegistry {
    /// Initialize new DAO registry
    pub fn new() -> Self {
        Self {
            daos: LookupMap::new(DAOStorageKey::DAOs),
            dao_ids: Vec::new(),
            dao_count: 0,
        }
    }

    /// Create a new DAO with the given configuration
    ///
    /// # Arguments
    /// * `dao_id` - Unique identifier for the DAO
    /// * `config` - DAO configuration
    ///
    /// # Returns
    /// The dao_id of the created DAO
    ///
    /// # Panics
    /// * If dao_id is empty
    /// * If a DAO with this ID already exists
    pub fn create_dao(&mut self, dao_id: String, config: DAOConfig) -> String {
        let caller = env::predecessor_account_id();
        let timestamp = env::block_timestamp();

        // Validate dao_id
        assert!(!dao_id.is_empty(), "DAO ID cannot be empty");
        assert!(
            !self.daos.contains_key(&dao_id),
            "DAO with this ID already exists"
        );

        // Create metadata
        let metadata = DAOMetadata {
            dao_id: dao_id.clone(),
            config,
            created_at: timestamp,
            created_by: caller.clone(),
            member_count: 1, // Creator is first member
            active_proposal_count: 0,
        };

        // Store DAO
        self.daos.insert(dao_id.clone(), metadata.clone());
        self.dao_ids.push(dao_id.clone());
        self.dao_count += 1;

        log!(
            "DAO_CREATED: {{\"dao_id\": \"{}\", \"created_by\": \"{}\", \"name\": \"{}\"}}",
            dao_id,
            caller,
            metadata.config.name
        );

        dao_id
    }

    /// Get DAO metadata by ID
    pub fn get_dao(&self, dao_id: &str) -> Option<DAOMetadata> {
        self.daos.get(&dao_id.to_string()).cloned()
    }

    /// Update DAO configuration (owner only)
    ///
    /// # Arguments
    /// * `dao_id` - ID of the DAO to update
    /// * `config` - New configuration
    ///
    /// # Panics
    /// * If DAO doesn't exist
    /// * If caller is not the DAO creator
    pub fn update_dao(&mut self, dao_id: &str, config: DAOConfig) {
        let caller = env::predecessor_account_id();
        let timestamp = env::block_timestamp();

        let mut metadata = self
            .daos
            .get(&dao_id.to_string())
            .expect("DAO not found")
            .clone();

        // Only creator can update
        assert!(
            metadata.created_by == caller,
            "Only DAO creator can update configuration"
        );

        // Update config (preserve metadata fields)
        metadata.config = config;

        self.daos.insert(dao_id.to_string(), metadata.clone());

        log!(
            "DAO_UPDATED: {{\"dao_id\": \"{}\", \"updated_by\": \"{}\", \"timestamp\": {}}}",
            dao_id,
            caller,
            timestamp
        );
    }

    /// List DAOs with pagination
    ///
    /// # Arguments
    /// * `offset` - Starting index
    /// * `limit` - Maximum number of results
    ///
    /// # Returns
    /// Vector of DAOMetadata for the requested page
    pub fn list_daos(&self, offset: usize, limit: usize) -> Vec<DAOMetadata> {
        self.dao_ids
            .iter()
            .skip(offset)
            .take(limit)
            .filter_map(|id| self.daos.get(id).cloned())
            .collect()
    }

    /// Get total count of registered DAOs
    pub fn get_dao_count(&self) -> u64 {
        self.dao_count
    }

    /// Check if a DAO exists
    pub fn dao_exists(&self, dao_id: &str) -> bool {
        self.daos.contains_key(&dao_id.to_string())
    }

    /// Increment member count for a DAO (internal use)
    pub fn increment_member_count(&mut self, dao_id: &str) {
        if let Some(mut metadata) = self.daos.get(&dao_id.to_string()).cloned() {
            metadata.member_count += 1;
            self.daos.insert(dao_id.to_string(), metadata);
        }
    }

    /// Decrement member count for a DAO (internal use)
    pub fn decrement_member_count(&mut self, dao_id: &str) {
        if let Some(mut metadata) = self.daos.get(&dao_id.to_string()).cloned() {
            if metadata.member_count > 0 {
                metadata.member_count -= 1;
            }
            self.daos.insert(dao_id.to_string(), metadata);
        }
    }

    /// Increment active proposal count for a DAO (internal use)
    pub fn increment_proposal_count(&mut self, dao_id: &str) {
        if let Some(mut metadata) = self.daos.get(&dao_id.to_string()).cloned() {
            metadata.active_proposal_count += 1;
            self.daos.insert(dao_id.to_string(), metadata);
        }
    }

    /// Decrement active proposal count for a DAO (internal use)
    pub fn decrement_proposal_count(&mut self, dao_id: &str) {
        if let Some(mut metadata) = self.daos.get(&dao_id.to_string()).cloned() {
            if metadata.active_proposal_count > 0 {
                metadata.active_proposal_count -= 1;
            }
            self.daos.insert(dao_id.to_string(), metadata);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dao::types::AutonomyLevel;
    use crate::privacy::Classification;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder.block_timestamp(1000000);
        builder
    }

    fn mock_dao_config() -> DAOConfig {
        DAOConfig {
            name: "Test DAO".to_string(),
            description: "A test DAO for unit testing".to_string(),
            classification: Classification::Public,
            default_autonomy_level: AutonomyLevel::NotAutonomous,
            proposal_bond: 1_000_000_000_000_000_000_000_000, // 1 NEAR
            voting_period_ns: 86400_000_000_000,              // 24 hours in ns
            parent_dao_id: None,
        }
    }

    #[test]
    fn test_create_dao_success() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();

        let dao_id = registry.create_dao("mission-alpha".to_string(), mock_dao_config());

        assert_eq!(dao_id, "mission-alpha");
        assert_eq!(registry.get_dao_count(), 1);
        assert!(registry.dao_exists("mission-alpha"));
    }

    #[test]
    fn test_get_dao_returns_metadata() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("test-dao".to_string(), mock_dao_config());

        let metadata = registry.get_dao("test-dao").unwrap();

        assert_eq!(metadata.dao_id, "test-dao");
        assert_eq!(metadata.config.name, "Test DAO");
        assert_eq!(metadata.created_by, owner);
        assert_eq!(metadata.member_count, 1);
        assert_eq!(metadata.active_proposal_count, 0);
    }

    #[test]
    fn test_get_dao_nonexistent_returns_none() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let registry = DAORegistry::new();

        assert!(registry.get_dao("nonexistent").is_none());
    }

    #[test]
    #[should_panic(expected = "DAO with this ID already exists")]
    fn test_create_duplicate_dao_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("duplicate".to_string(), mock_dao_config());
        registry.create_dao("duplicate".to_string(), mock_dao_config()); // Should panic
    }

    #[test]
    #[should_panic(expected = "DAO ID cannot be empty")]
    fn test_create_empty_id_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("".to_string(), mock_dao_config());
    }

    #[test]
    fn test_update_dao_owner_only() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("updatable".to_string(), mock_dao_config());

        // Update with new config
        let mut new_config = mock_dao_config();
        new_config.name = "Updated DAO".to_string();

        registry.update_dao("updatable", new_config);

        let metadata = registry.get_dao("updatable").unwrap();
        assert_eq!(metadata.config.name, "Updated DAO");
    }

    #[test]
    #[should_panic(expected = "Only DAO creator can update configuration")]
    fn test_update_dao_non_owner_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let attacker: AccountId = "bob.near".parse().unwrap();

        // Create as owner
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("owned".to_string(), mock_dao_config());

        // Try to update as non-owner
        let context = get_context(attacker);
        testing_env!(context.build());

        registry.update_dao("owned", mock_dao_config());
    }

    #[test]
    fn test_list_daos_pagination() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();

        // Create 5 DAOs
        for i in 1..=5 {
            let mut config = mock_dao_config();
            config.name = format!("DAO {}", i);
            registry.create_dao(format!("dao-{}", i), config);
        }

        // Test pagination
        let page1 = registry.list_daos(0, 2);
        assert_eq!(page1.len(), 2);
        assert_eq!(page1[0].config.name, "DAO 1");
        assert_eq!(page1[1].config.name, "DAO 2");

        let page2 = registry.list_daos(2, 2);
        assert_eq!(page2.len(), 2);
        assert_eq!(page2[0].config.name, "DAO 3");
        assert_eq!(page2[1].config.name, "DAO 4");

        let page3 = registry.list_daos(4, 2);
        assert_eq!(page3.len(), 1);
        assert_eq!(page3[0].config.name, "DAO 5");

        // Beyond end
        let page4 = registry.list_daos(10, 2);
        assert_eq!(page4.len(), 0);
    }

    #[test]
    fn test_member_count_operations() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("counting".to_string(), mock_dao_config());

        // Initial count is 1 (creator)
        assert_eq!(registry.get_dao("counting").unwrap().member_count, 1);

        // Increment
        registry.increment_member_count("counting");
        assert_eq!(registry.get_dao("counting").unwrap().member_count, 2);

        registry.increment_member_count("counting");
        assert_eq!(registry.get_dao("counting").unwrap().member_count, 3);

        // Decrement
        registry.decrement_member_count("counting");
        assert_eq!(registry.get_dao("counting").unwrap().member_count, 2);

        // Decrement to 0 (edge case)
        registry.decrement_member_count("counting");
        registry.decrement_member_count("counting");
        assert_eq!(registry.get_dao("counting").unwrap().member_count, 0);

        // Decrement past 0 should stay at 0
        registry.decrement_member_count("counting");
        assert_eq!(registry.get_dao("counting").unwrap().member_count, 0);
    }

    #[test]
    fn test_proposal_count_operations() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("proposals".to_string(), mock_dao_config());

        // Initial count is 0
        assert_eq!(
            registry.get_dao("proposals").unwrap().active_proposal_count,
            0
        );

        // Increment
        registry.increment_proposal_count("proposals");
        registry.increment_proposal_count("proposals");
        assert_eq!(
            registry.get_dao("proposals").unwrap().active_proposal_count,
            2
        );

        // Decrement
        registry.decrement_proposal_count("proposals");
        assert_eq!(
            registry.get_dao("proposals").unwrap().active_proposal_count,
            1
        );
    }

    #[test]
    fn test_dao_with_parent() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();

        // Create parent DAO
        registry.create_dao("strategic-hq".to_string(), mock_dao_config());

        // Create child DAO with parent reference
        let mut child_config = mock_dao_config();
        child_config.name = "Mission Alpha".to_string();
        child_config.parent_dao_id = Some("strategic-hq".to_string());

        registry.create_dao("mission-alpha".to_string(), child_config);

        let child = registry.get_dao("mission-alpha").unwrap();
        assert_eq!(child.config.parent_dao_id, Some("strategic-hq".to_string()));
    }

    #[test]
    fn test_dao_exists() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut registry = DAORegistry::new();
        registry.create_dao("exists".to_string(), mock_dao_config());

        assert!(registry.dao_exists("exists"));
        assert!(!registry.dao_exists("does-not-exist"));
    }
}
