/**
 * Proposal Manager
 *
 * Manages proposal lifecycle for DAO governance with:
 * - Full CRUD operations for proposals
 * - State machine enforcement (InProgress → terminal states)
 * - Expiration detection
 * - Effective autonomy calculation (StrikeAuthorization forced to NotAutonomous)
 *
 * Storage design follows SputnikDAO v2 patterns:
 * - Composite key (dao_id, proposal_id) for cross-DAO queries
 * - Separate indexes for efficient listing
 */

use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};

use super::types::{
    AutonomyLevel, DAOConfig, Proposal, ProposalKind, ProposalStatus,
};
use crate::privacy::Classification;

/// Storage keys for proposal collections
#[derive(BorshStorageKey)]
#[near]
pub enum ProposalStorageKey {
    /// Primary storage: (dao_id, proposal_id) -> Proposal
    Proposals,
    /// Proposal counts per DAO
    ProposalCounts,
    /// Proposal IDs list per DAO
    DAOProposals,
}

/// Helper to create composite key for proposal storage
fn proposal_key(dao_id: &str, proposal_id: u64) -> String {
    format!("{}:{}", dao_id, proposal_id)
}

/// Proposal Manager for DAO governance
#[near(serializers = [borsh])]
pub struct ProposalManager {
    /// Primary storage: (dao_id, proposal_id) encoded as string -> Proposal
    proposals: LookupMap<String, Proposal>,

    /// Proposal counts per DAO: dao_id -> next_proposal_id
    proposal_counts: LookupMap<String, u64>,

    /// Proposal IDs per DAO: dao_id -> Vec<proposal_ids>
    dao_proposals: LookupMap<String, Vec<u64>>,
}

impl ProposalManager {
    /// Initialize new proposal manager
    pub fn new() -> Self {
        Self {
            proposals: LookupMap::new(ProposalStorageKey::Proposals),
            proposal_counts: LookupMap::new(ProposalStorageKey::ProposalCounts),
            dao_proposals: LookupMap::new(ProposalStorageKey::DAOProposals),
        }
    }

    /// Create a new proposal
    ///
    /// # Arguments
    /// * `dao_id` - ID of the DAO this proposal belongs to
    /// * `kind` - Type of proposal
    /// * `proposer` - Account creating the proposal
    /// * `description` - Human-readable description
    /// * `classification` - Security classification level
    /// * `autonomy_override` - Optional override for autonomy level
    /// * `voting_period_ns` - Voting period duration in nanoseconds
    ///
    /// # Returns
    /// The proposal ID
    ///
    /// # Enforces
    /// * StrikeAuthorization kind ignores autonomy_override (always NotAutonomous)
    pub fn create_proposal(
        &mut self,
        dao_id: String,
        kind: ProposalKind,
        proposer: AccountId,
        description: String,
        classification: Classification,
        autonomy_override: Option<AutonomyLevel>,
        voting_period_ns: u64,
    ) -> u64 {
        let timestamp = env::block_timestamp();

        // Get next proposal ID for this DAO
        let proposal_id = self.proposal_counts
            .get(&dao_id)
            .cloned()
            .unwrap_or(0);

        // Calculate voting deadline
        let voting_deadline = timestamp + voting_period_ns;

        // Enforce StrikeAuthorization always uses NotAutonomous
        // Even if caller specifies an override, we ignore it for strike auth
        let effective_override = if kind.requires_human_in_loop() {
            None // Will use NotAutonomous via get_effective_autonomy()
        } else {
            autonomy_override
        };

        // Create proposal
        let proposal = Proposal {
            id: proposal_id,
            kind: kind.clone(),
            proposer: proposer.clone(),
            description: description.clone(),
            classification,
            autonomy_override: effective_override,
            status: ProposalStatus::InProgress,
            votes_approve: 0,
            votes_reject: 0,
            created_at: timestamp,
            voting_deadline,
            execution_result: None,
        };

        // Store proposal
        let key = proposal_key(&dao_id, proposal_id);
        self.proposals.insert(key, proposal);

        // Update proposal count
        self.proposal_counts.insert(dao_id.clone(), proposal_id + 1);

        // Update DAO proposals list
        let mut proposal_list = self.dao_proposals
            .get(&dao_id)
            .cloned()
            .unwrap_or_default();
        proposal_list.push(proposal_id);
        self.dao_proposals.insert(dao_id.clone(), proposal_list);

        log!(
            "PROPOSAL_CREATED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"kind\": \"{}\", \"proposer\": \"{}\", \"deadline\": {}}}",
            dao_id,
            proposal_id,
            kind.to_policy_label(),
            proposer,
            voting_deadline
        );

        proposal_id
    }

    /// Get a proposal by DAO ID and proposal ID
    pub fn get_proposal(&self, dao_id: &str, proposal_id: u64) -> Option<Proposal> {
        let key = proposal_key(dao_id, proposal_id);
        self.proposals.get(&key).cloned()
    }

    /// List proposals for a DAO with pagination
    ///
    /// # Arguments
    /// * `dao_id` - ID of the DAO
    /// * `offset` - Starting index
    /// * `limit` - Maximum number of results
    pub fn list_proposals(&self, dao_id: &str, offset: usize, limit: usize) -> Vec<Proposal> {
        let proposal_ids = self.dao_proposals
            .get(&dao_id.to_string())
            .cloned()
            .unwrap_or_default();

        proposal_ids
            .iter()
            .skip(offset)
            .take(limit)
            .filter_map(|id| self.get_proposal(dao_id, *id))
            .collect()
    }

    /// Get all active (InProgress) proposals for a DAO
    pub fn get_active_proposals(&self, dao_id: &str) -> Vec<Proposal> {
        let proposal_ids = self.dao_proposals
            .get(&dao_id.to_string())
            .cloned()
            .unwrap_or_default();

        proposal_ids
            .iter()
            .filter_map(|id| self.get_proposal(dao_id, *id))
            .filter(|p| p.status == ProposalStatus::InProgress)
            .collect()
    }

    /// Update proposal status (internal use)
    ///
    /// # Panics
    /// * If proposal doesn't exist
    /// * If current status is already terminal
    /// * If transition is not allowed
    pub fn update_proposal_status(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        new_status: ProposalStatus,
    ) {
        let key = proposal_key(dao_id, proposal_id);
        let mut proposal = self.proposals
            .get(&key)
            .expect("Proposal not found")
            .clone();

        // Verify state machine rules
        assert!(
            !proposal.status.is_terminal(),
            "Cannot transition from terminal status"
        );

        // Only InProgress can transition to other states
        assert!(
            proposal.status == ProposalStatus::InProgress,
            "Can only transition from InProgress status"
        );

        proposal.status = new_status;
        self.proposals.insert(key, proposal);

        log!(
            "PROPOSAL_STATUS_CHANGED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"new_status\": {:?}}}",
            dao_id,
            proposal_id,
            new_status
        );
    }

    /// Check if a proposal has expired and update status if so
    ///
    /// # Returns
    /// `true` if the proposal was expired (status changed to Expired)
    /// `false` if the proposal is not expired or doesn't exist
    pub fn check_expired(&mut self, dao_id: &str, proposal_id: u64) -> bool {
        let key = proposal_key(dao_id, proposal_id);
        let timestamp = env::block_timestamp();

        if let Some(mut proposal) = self.proposals.get(&key).cloned() {
            // Only check if still in progress
            if proposal.status == ProposalStatus::InProgress
                && timestamp > proposal.voting_deadline
            {
                let deadline = proposal.voting_deadline;
                proposal.status = ProposalStatus::Expired;
                self.proposals.insert(key, proposal);

                log!(
                    "PROPOSAL_EXPIRED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"deadline\": {}, \"current_time\": {}}}",
                    dao_id,
                    proposal_id,
                    deadline,
                    timestamp
                );

                return true;
            }
        }

        false
    }

    /// Get effective autonomy level for a proposal considering DAO config
    ///
    /// # Critical Rule
    /// StrikeAuthorization proposals ALWAYS return NotAutonomous regardless of:
    /// - DAO default autonomy level
    /// - Proposal autonomy override
    pub fn get_effective_autonomy(&self, proposal: &Proposal, dao_config: &DAOConfig) -> AutonomyLevel {
        proposal.get_effective_autonomy(dao_config.default_autonomy_level)
    }

    /// Get proposal count for a DAO
    pub fn get_proposal_count(&self, dao_id: &str) -> u64 {
        self.proposal_counts
            .get(&dao_id.to_string())
            .cloned()
            .unwrap_or(0)
    }

    /// Record vote approval (increment votes_approve)
    pub fn record_vote_approve(&mut self, dao_id: &str, proposal_id: u64) {
        let key = proposal_key(dao_id, proposal_id);
        if let Some(mut proposal) = self.proposals.get(&key).cloned() {
            assert!(
                proposal.status == ProposalStatus::InProgress,
                "Cannot vote on non-active proposal"
            );
            proposal.votes_approve += 1;
            self.proposals.insert(key, proposal);
        }
    }

    /// Record vote rejection (increment votes_reject)
    pub fn record_vote_reject(&mut self, dao_id: &str, proposal_id: u64) {
        let key = proposal_key(dao_id, proposal_id);
        if let Some(mut proposal) = self.proposals.get(&key).cloned() {
            assert!(
                proposal.status == ProposalStatus::InProgress,
                "Cannot vote on non-active proposal"
            );
            proposal.votes_reject += 1;
            self.proposals.insert(key, proposal);
        }
    }

    /// Record execution result
    pub fn record_execution_result(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        result: String,
    ) {
        let key = proposal_key(dao_id, proposal_id);
        if let Some(mut proposal) = self.proposals.get(&key).cloned() {
            proposal.execution_result = Some(result);
            self.proposals.insert(key, proposal);
        }
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
        builder.block_timestamp(1_000_000_000); // 1 second in ns
        builder
    }

    fn mock_dao_config() -> DAOConfig {
        DAOConfig {
            name: "Test DAO".to_string(),
            description: "Test".to_string(),
            classification: Classification::Public,
            default_autonomy_level: AutonomyLevel::SemiAutonomous,
            proposal_bond: 1_000_000_000_000_000_000_000_000,
            voting_period_ns: 86_400_000_000_000, // 24 hours
            parent_dao_id: None,
        }
    }

    #[test]
    fn test_create_proposal_basic() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        let proposal_id = manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Transfer funds".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        assert_eq!(proposal_id, 0);
        assert_eq!(manager.get_proposal_count("test-dao"), 1);

        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(proposal.kind, ProposalKind::Transfer);
        assert_eq!(proposal.proposer, owner);
        assert_eq!(proposal.status, ProposalStatus::InProgress);
        assert_eq!(proposal.votes_approve, 0);
        assert_eq!(proposal.votes_reject, 0);
    }

    #[test]
    fn test_create_multiple_proposals() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        let id1 = manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "First".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        let id2 = manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::AddMember,
            owner.clone(),
            "Second".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        let id3 = manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::ConfigChange,
            owner.clone(),
            "Third".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        assert_eq!(id1, 0);
        assert_eq!(id2, 1);
        assert_eq!(id3, 2);
        assert_eq!(manager.get_proposal_count("test-dao"), 3);
    }

    #[test]
    fn test_strike_authorization_forces_not_autonomous() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();
        let dao_config = mock_dao_config();

        // Try to create StrikeAuthorization with Autonomous override
        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::StrikeAuthorization,
            owner.clone(),
            "Authorize strike".to_string(),
            Classification::Secret,
            Some(AutonomyLevel::Autonomous), // This should be ignored
            86_400_000_000_000,
        );

        let proposal = manager.get_proposal("test-dao", 0).unwrap();

        // The autonomy_override should be None for strike auth
        assert!(proposal.autonomy_override.is_none());

        // Effective autonomy should be NotAutonomous regardless of DAO config
        let effective = manager.get_effective_autonomy(&proposal, &dao_config);
        assert_eq!(effective, AutonomyLevel::NotAutonomous);
    }

    #[test]
    fn test_normal_proposal_uses_override() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();
        let dao_config = mock_dao_config(); // Default is SemiAutonomous

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Transfer".to_string(),
            Classification::Public,
            Some(AutonomyLevel::Autonomous),
            86_400_000_000_000,
        );

        let proposal = manager.get_proposal("test-dao", 0).unwrap();

        // Override should be preserved for non-strike proposals
        assert_eq!(proposal.autonomy_override, Some(AutonomyLevel::Autonomous));

        // Effective autonomy uses override
        let effective = manager.get_effective_autonomy(&proposal, &dao_config);
        assert_eq!(effective, AutonomyLevel::Autonomous);
    }

    #[test]
    fn test_normal_proposal_uses_dao_default() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();
        let dao_config = mock_dao_config(); // Default is SemiAutonomous

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::MissionOrder,
            owner.clone(),
            "Issue order".to_string(),
            Classification::Secret,
            None, // No override
            86_400_000_000_000,
        );

        let proposal = manager.get_proposal("test-dao", 0).unwrap();

        // Effective autonomy uses DAO default
        let effective = manager.get_effective_autonomy(&proposal, &dao_config);
        assert_eq!(effective, AutonomyLevel::SemiAutonomous);
    }

    #[test]
    fn test_list_proposals_pagination() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        // Create 5 proposals
        for i in 0..5 {
            manager.create_proposal(
                "test-dao".to_string(),
                ProposalKind::Transfer,
                owner.clone(),
                format!("Proposal {}", i),
                Classification::Public,
                None,
                86_400_000_000_000,
            );
        }

        // Test pagination
        let page1 = manager.list_proposals("test-dao", 0, 2);
        assert_eq!(page1.len(), 2);
        assert_eq!(page1[0].description, "Proposal 0");
        assert_eq!(page1[1].description, "Proposal 1");

        let page2 = manager.list_proposals("test-dao", 2, 2);
        assert_eq!(page2.len(), 2);
        assert_eq!(page2[0].description, "Proposal 2");
        assert_eq!(page2[1].description, "Proposal 3");

        let page3 = manager.list_proposals("test-dao", 4, 2);
        assert_eq!(page3.len(), 1);
        assert_eq!(page3[0].description, "Proposal 4");
    }

    #[test]
    fn test_get_active_proposals() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        // Create 3 proposals
        for _ in 0..3 {
            manager.create_proposal(
                "test-dao".to_string(),
                ProposalKind::Transfer,
                owner.clone(),
                "Test".to_string(),
                Classification::Public,
                None,
                86_400_000_000_000,
            );
        }

        // All should be active initially
        let active = manager.get_active_proposals("test-dao");
        assert_eq!(active.len(), 3);

        // Mark one as approved
        manager.update_proposal_status("test-dao", 1, ProposalStatus::Approved);

        // Now only 2 should be active
        let active = manager.get_active_proposals("test-dao");
        assert_eq!(active.len(), 2);
    }

    #[test]
    fn test_status_transitions() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        // Initial status is InProgress
        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(proposal.status, ProposalStatus::InProgress);
        assert!(!proposal.status.is_terminal());

        // Transition to Approved
        manager.update_proposal_status("test-dao", 0, ProposalStatus::Approved);

        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(proposal.status, ProposalStatus::Approved);
        assert!(proposal.status.is_terminal());
    }

    #[test]
    #[should_panic(expected = "Cannot transition from terminal status")]
    fn test_cannot_transition_from_terminal() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        // First transition
        manager.update_proposal_status("test-dao", 0, ProposalStatus::Approved);

        // Second transition should fail (terminal status)
        manager.update_proposal_status("test-dao", 0, ProposalStatus::Rejected);
    }

    #[test]
    fn test_check_expired() {
        let owner: AccountId = "alice.near".parse().unwrap();

        // Create with timestamp 1s
        let mut context = get_context(owner.clone());
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            1_000_000_000, // 1 second voting period
        );

        // Check at creation time - not expired
        let expired = manager.check_expired("test-dao", 0);
        assert!(!expired);

        // Advance time past deadline
        let mut context = get_context(owner.clone());
        context.block_timestamp(3_000_000_000); // 3 seconds
        testing_env!(context.build());

        // Now should be expired
        let expired = manager.check_expired("test-dao", 0);
        assert!(expired);

        // Status should be Expired
        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(proposal.status, ProposalStatus::Expired);
    }

    #[test]
    fn test_check_expired_already_terminal() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            1_000_000_000,
        );

        // Approve the proposal
        manager.update_proposal_status("test-dao", 0, ProposalStatus::Approved);

        // Check expired should return false (already terminal)
        let expired = manager.check_expired("test-dao", 0);
        assert!(!expired);

        // Status should still be Approved, not Expired
        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(proposal.status, ProposalStatus::Approved);
    }

    #[test]
    fn test_vote_recording() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        // Record votes
        manager.record_vote_approve("test-dao", 0);
        manager.record_vote_approve("test-dao", 0);
        manager.record_vote_reject("test-dao", 0);

        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(proposal.votes_approve, 2);
        assert_eq!(proposal.votes_reject, 1);
    }

    #[test]
    #[should_panic(expected = "Cannot vote on non-active proposal")]
    fn test_cannot_vote_on_terminal() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        // Approve the proposal
        manager.update_proposal_status("test-dao", 0, ProposalStatus::Approved);

        // Try to vote - should fail
        manager.record_vote_approve("test-dao", 0);
    }

    #[test]
    fn test_execution_result_recording() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        // No execution result initially
        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert!(proposal.execution_result.is_none());

        // Record result
        manager.record_execution_result("test-dao", 0, "Transaction hash: abc123".to_string());

        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(
            proposal.execution_result,
            Some("Transaction hash: abc123".to_string())
        );
    }

    #[test]
    fn test_proposals_across_multiple_daos() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        // Create proposals in different DAOs
        manager.create_proposal(
            "dao-a".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "DAO A proposal".to_string(),
            Classification::Public,
            None,
            86_400_000_000_000,
        );

        manager.create_proposal(
            "dao-b".to_string(),
            ProposalKind::MissionOrder,
            owner.clone(),
            "DAO B proposal".to_string(),
            Classification::Secret,
            None,
            86_400_000_000_000,
        );

        // Verify separate proposal counts
        assert_eq!(manager.get_proposal_count("dao-a"), 1);
        assert_eq!(manager.get_proposal_count("dao-b"), 1);

        // Verify proposals are isolated
        let dao_a_proposals = manager.list_proposals("dao-a", 0, 10);
        assert_eq!(dao_a_proposals.len(), 1);
        assert_eq!(dao_a_proposals[0].description, "DAO A proposal");

        let dao_b_proposals = manager.list_proposals("dao-b", 0, 10);
        assert_eq!(dao_b_proposals.len(), 1);
        assert_eq!(dao_b_proposals[0].description, "DAO B proposal");
    }

    #[test]
    fn test_all_proposal_kinds() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = ProposalManager::new();
        let dao_config = mock_dao_config();

        let kinds = vec![
            ProposalKind::ConfigChange,
            ProposalKind::AddMember,
            ProposalKind::RemoveMember,
            ProposalKind::Transfer,
            ProposalKind::FunctionCall,
            ProposalKind::StrikeAuthorization,
            ProposalKind::MissionOrder,
            ProposalKind::Custom("test".to_string()),
        ];

        for (i, kind) in kinds.iter().enumerate() {
            manager.create_proposal(
                "test-dao".to_string(),
                kind.clone(),
                owner.clone(),
                format!("Kind test {}", i),
                Classification::Public,
                Some(AutonomyLevel::Autonomous),
                86_400_000_000_000,
            );

            let proposal = manager.get_proposal("test-dao", i as u64).unwrap();
            let effective = manager.get_effective_autonomy(&proposal, &dao_config);

            // Only StrikeAuthorization should be NotAutonomous
            if kind.requires_human_in_loop() {
                assert_eq!(effective, AutonomyLevel::NotAutonomous);
            } else {
                assert_eq!(effective, AutonomyLevel::Autonomous);
            }
        }

        assert_eq!(manager.get_proposal_count("test-dao"), 8);
    }

    #[test]
    fn test_proposal_voting_deadline_calculation() {
        let owner: AccountId = "alice.near".parse().unwrap();

        let mut context = get_context(owner.clone());
        let creation_time = 1_000_000_000_u64; // 1 second in ns
        context.block_timestamp(creation_time);
        testing_env!(context.build());

        let mut manager = ProposalManager::new();

        let voting_period = 3_600_000_000_000_u64; // 1 hour in ns

        manager.create_proposal(
            "test-dao".to_string(),
            ProposalKind::Transfer,
            owner.clone(),
            "Test".to_string(),
            Classification::Public,
            None,
            voting_period,
        );

        let proposal = manager.get_proposal("test-dao", 0).unwrap();
        assert_eq!(proposal.created_at, creation_time);
        assert_eq!(proposal.voting_deadline, creation_time + voting_period);
    }
}
