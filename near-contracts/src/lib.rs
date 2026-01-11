// SSR Foundation Contract - NEAR blockchain foundation
use near_sdk::{env, log, near, require, AccountId, PanicOnDefault};

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
        }

        let old_state: OldState = env::state_read().expect("Failed to read state");

        // For now, just copy the state
        // When V2 is added, migration logic will be implemented here
        Self {
            owner: old_state.owner,
            initialized: old_state.initialized,
            state_version: old_state.state_version,
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
}
