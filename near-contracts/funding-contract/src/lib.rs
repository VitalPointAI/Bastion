/**
 * Funding Contract for NEAR Implicit Account Activation
 *
 * PURPOSE: Hold NEAR balance and transfer minimum funding to new implicit accounts
 * during user registration. This activates accounts on-chain.
 *
 * SECURITY:
 * - Only authorized_caller can invoke fund() method
 * - Admin can withdraw remaining balance
 * - All funding operations logged with timestamps
 */

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

/// Funding event for audit trail
#[derive(BorshDeserialize, BorshSerialize, Clone)]
#[borsh(crate = "near_sdk::borsh")]
pub struct FundingEvent {
    pub account_id: AccountId,
    pub amount: NearToken,
    pub timestamp: u64,
    pub block_height: u64,
}

/// Public view of funding event
#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct FundingEventView {
    pub account_id: AccountId,
    pub amount: String, // yoctoNEAR as string
    pub timestamp: u64,
    pub block_height: u64,
}

impl From<&FundingEvent> for FundingEventView {
    fn from(event: &FundingEvent) -> Self {
        FundingEventView {
            account_id: event.account_id.clone(),
            amount: event.amount.as_yoctonear().to_string(),
            timestamp: event.timestamp,
            block_height: event.block_height,
        }
    }
}

#[near(contract_state)]
pub struct FundingContract {
    /// Admin who can withdraw and change settings
    admin: AccountId,
    /// Backend account authorized to call fund()
    authorized_caller: AccountId,
    /// Amount to transfer per funding (default 0.1 NEAR)
    funding_amount: NearToken,
    /// Accounts that have been funded (prevent double-funding)
    funded_accounts: LookupMap<AccountId, bool>,
    /// Funding history for audit
    funding_history: Vector<FundingEvent>,
    /// Total accounts funded
    total_funded: u64,
}

impl Default for FundingContract {
    fn default() -> Self {
        env::panic_str("Contract must be initialized with admin and authorized_caller")
    }
}

#[near]
impl FundingContract {
    /// Initialize contract with admin and authorized caller
    #[init]
    pub fn new(admin: AccountId, authorized_caller: AccountId) -> Self {
        require!(!env::state_exists(), "Already initialized");

        Self {
            admin,
            authorized_caller,
            funding_amount: NearToken::from_millinear(100), // 0.1 NEAR
            funded_accounts: LookupMap::new(b"f"),
            funding_history: Vector::new(b"h"),
            total_funded: 0,
        }
    }

    /// Fund an implicit account (called by authorized backend)
    ///
    /// # Arguments
    /// * `account_id` - The 64-character hex implicit account to fund
    ///
    /// # Panics
    /// * If caller is not authorized_caller
    /// * If account has already been funded
    /// * If contract balance is insufficient
    #[payable]
    pub fn fund(&mut self, account_id: AccountId) -> Promise {
        // Verify caller authorization
        require!(
            env::predecessor_account_id() == self.authorized_caller,
            "Unauthorized: only authorized caller can fund accounts"
        );

        // Verify account hasn't been funded already
        require!(
            !self.funded_accounts.contains_key(&account_id),
            "Account has already been funded"
        );

        // Verify sufficient balance
        let balance = env::account_balance();
        let storage_cost = NearToken::from_millinear(10); // Reserve for storage
        require!(
            balance.saturating_sub(storage_cost) >= self.funding_amount,
            "Insufficient contract balance for funding"
        );

        // Record funding before transfer (prevent reentrancy)
        self.funded_accounts.insert(&account_id, &true);
        self.total_funded += 1;

        // Log funding event
        let event = FundingEvent {
            account_id: account_id.clone(),
            amount: self.funding_amount,
            timestamp: env::block_timestamp(),
            block_height: env::block_height(),
        };
        self.funding_history.push(&event);

        // Transfer NEAR to activate the implicit account
        Promise::new(account_id).transfer(self.funding_amount)
    }

    /// Admin: Withdraw remaining balance
    ///
    /// # Arguments
    /// * `amount` - Amount to withdraw in yoctoNEAR (optional, withdraws all if None)
    pub fn withdraw(&mut self, amount: Option<U128>) -> Promise {
        require!(
            env::predecessor_account_id() == self.admin,
            "Unauthorized: only admin can withdraw"
        );

        let balance = env::account_balance();
        let storage_cost = NearToken::from_millinear(50); // Reserve minimum for contract
        let available = balance.saturating_sub(storage_cost);

        let withdraw_amount = match amount {
            Some(a) => {
                let requested = NearToken::from_yoctonear(a.0);
                require!(requested <= available, "Insufficient available balance");
                requested
            }
            None => available,
        };

        require!(withdraw_amount > NearToken::from_yoctonear(0), "Nothing to withdraw");

        Promise::new(self.admin.clone()).transfer(withdraw_amount)
    }

    /// Admin: Update authorized caller
    pub fn set_authorized_caller(&mut self, new_caller: AccountId) {
        require!(
            env::predecessor_account_id() == self.admin,
            "Unauthorized: only admin can change authorized caller"
        );
        self.authorized_caller = new_caller;
    }

    /// Admin: Update funding amount
    pub fn set_funding_amount(&mut self, amount_millinear: u128) {
        require!(
            env::predecessor_account_id() == self.admin,
            "Unauthorized: only admin can change funding amount"
        );
        self.funding_amount = NearToken::from_millinear(amount_millinear);
    }

    /// Admin: Transfer admin role
    pub fn set_admin(&mut self, new_admin: AccountId) {
        require!(
            env::predecessor_account_id() == self.admin,
            "Unauthorized: only admin can transfer admin role"
        );
        self.admin = new_admin;
    }

    // ==================== View Methods ====================

    /// Get contract balance (available for funding)
    pub fn get_balance(&self) -> U128 {
        U128(env::account_balance().as_yoctonear())
    }

    /// Get available balance (minus storage reserve)
    pub fn get_available_balance(&self) -> U128 {
        let balance = env::account_balance();
        let storage_cost = NearToken::from_millinear(10);
        U128(balance.saturating_sub(storage_cost).as_yoctonear())
    }

    /// Get funding amount per account
    pub fn get_funding_amount(&self) -> U128 {
        U128(self.funding_amount.as_yoctonear())
    }

    /// Get total accounts funded
    pub fn get_total_funded(&self) -> u64 {
        self.total_funded
    }

    /// Check if an account has been funded
    pub fn is_funded(&self, account_id: AccountId) -> bool {
        self.funded_accounts.contains_key(&account_id)
    }

    /// Get recent funding history (paginated)
    pub fn get_funding_history(&self, from_index: u64, limit: u64) -> Vec<FundingEventView> {
        let len = self.funding_history.len();
        if from_index >= len {
            return vec![];
        }

        let end = std::cmp::min(from_index + limit, len);
        (from_index..end)
            .filter_map(|i| self.funding_history.get(i))
            .map(|e| FundingEventView::from(&e))
            .collect()
    }

    /// Get admin account
    pub fn get_admin(&self) -> AccountId {
        self.admin.clone()
    }

    /// Get authorized caller
    pub fn get_authorized_caller(&self) -> AccountId {
        self.authorized_caller.clone()
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
        builder.account_balance(NearToken::from_near(10));
        builder
    }

    #[test]
    fn test_init() {
        let admin: AccountId = "admin.testnet".parse().unwrap();
        let caller: AccountId = "backend.testnet".parse().unwrap();

        let context = get_context(admin.clone());
        testing_env!(context.build());

        let contract = FundingContract::new(admin.clone(), caller.clone());

        assert_eq!(contract.get_admin(), admin);
        assert_eq!(contract.get_authorized_caller(), caller);
        assert_eq!(contract.get_total_funded(), 0);
    }

    #[test]
    fn test_fund_unauthorized() {
        let admin: AccountId = "admin.testnet".parse().unwrap();
        let caller: AccountId = "backend.testnet".parse().unwrap();
        let unauthorized: AccountId = "hacker.testnet".parse().unwrap();

        let context = get_context(admin.clone());
        testing_env!(context.build());

        let mut contract = FundingContract::new(admin.clone(), caller.clone());

        // Switch to unauthorized caller
        let context = get_context(unauthorized);
        testing_env!(context.build());

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let target: AccountId = "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234".parse().unwrap();
            contract.fund(target);
        }));

        assert!(result.is_err());
    }

    #[test]
    fn test_double_fund_prevention() {
        let admin: AccountId = "admin.testnet".parse().unwrap();
        let caller: AccountId = "backend.testnet".parse().unwrap();
        let target: AccountId = "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234".parse().unwrap();

        let context = get_context(admin.clone());
        testing_env!(context.build());

        let mut contract = FundingContract::new(admin.clone(), caller.clone());

        // First fund should mark account
        let context = get_context(caller.clone());
        testing_env!(context.build());

        contract.fund(target.clone());
        assert!(contract.is_funded(target.clone()));
        assert_eq!(contract.get_total_funded(), 1);

        // Second fund should panic
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.fund(target);
        }));

        assert!(result.is_err());
    }

    #[test]
    fn test_admin_functions() {
        let admin: AccountId = "admin.testnet".parse().unwrap();
        let caller: AccountId = "backend.testnet".parse().unwrap();
        let new_caller: AccountId = "new-backend.testnet".parse().unwrap();
        let new_admin: AccountId = "new-admin.testnet".parse().unwrap();

        let context = get_context(admin.clone());
        testing_env!(context.build());

        let mut contract = FundingContract::new(admin.clone(), caller.clone());

        // Test set_authorized_caller
        contract.set_authorized_caller(new_caller.clone());
        assert_eq!(contract.get_authorized_caller(), new_caller);

        // Test set_funding_amount (200 milliNEAR = 0.2 NEAR)
        contract.set_funding_amount(200);
        assert_eq!(contract.get_funding_amount().0, NearToken::from_millinear(200).as_yoctonear());

        // Test set_admin
        contract.set_admin(new_admin.clone());
        assert_eq!(contract.get_admin(), new_admin);
    }

    #[test]
    fn test_admin_functions_unauthorized() {
        let admin: AccountId = "admin.testnet".parse().unwrap();
        let caller: AccountId = "backend.testnet".parse().unwrap();
        let attacker: AccountId = "attacker.testnet".parse().unwrap();

        let context = get_context(admin.clone());
        testing_env!(context.build());

        let mut contract = FundingContract::new(admin.clone(), caller.clone());

        // Switch to attacker
        let context = get_context(attacker);
        testing_env!(context.build());

        // All admin functions should fail
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.set_authorized_caller("evil.testnet".parse().unwrap());
        }));
        assert!(result.is_err());

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.set_funding_amount(1000);
        }));
        assert!(result.is_err());

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            contract.set_admin("evil.testnet".parse().unwrap());
        }));
        assert!(result.is_err());
    }

    #[test]
    fn test_view_methods() {
        let admin: AccountId = "admin.testnet".parse().unwrap();
        let caller: AccountId = "backend.testnet".parse().unwrap();

        let context = get_context(admin.clone());
        testing_env!(context.build());

        let contract = FundingContract::new(admin.clone(), caller.clone());

        // Test view methods return expected values
        assert!(contract.get_balance().0 > 0);
        assert_eq!(contract.get_funding_amount().0, NearToken::from_millinear(100).as_yoctonear());
        assert_eq!(contract.get_total_funded(), 0);
        assert!(!contract.is_funded("nonexistent.testnet".parse().unwrap()));
        assert_eq!(contract.get_funding_history(0, 10).len(), 0);
    }
}
