/**
 * DAO Voting Engine
 *
 * Provides pluggable voting mechanisms for BASTION DAO governance:
 * - WeightKind: TokenWeight, RoleWeight, Equal voting strategies
 * - ThresholdKind: Absolute count or Ratio-based thresholds
 * - VotePolicy: Configurable policies per proposal type
 * - VotingEngine: Central engine for vote management and result calculation
 *
 * Key features:
 * - Default policies per ProposalKind with military-appropriate thresholds
 * - StrikeAuthorization requires unanimous approval with 100% quorum
 * - Support for veto threshold in semi-autonomous flows
 * - Prevention of duplicate voting
 */

use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};

use super::types::ProposalKind;

/// Storage keys for voting collections
#[derive(BorshStorageKey)]
#[near]
pub enum VotingStorageKey {
    /// Votes per proposal: (dao_id, proposal_id) -> Vec<Vote>
    Votes,
    /// Vote policies: (dao_id, proposal_kind_label) -> VotePolicy
    Policies,
}

/// Weight calculation strategy for votes
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum WeightKind {
    /// Weight based on token holdings (queries staking contract)
    TokenWeight,
    /// One vote per role member (1 if has any role in DAO)
    #[default]
    RoleWeight,
    /// Equal voting: one vote per account regardless of role/tokens
    Equal,
}

/// Threshold specification for voting decisions
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ThresholdKind {
    /// Absolute count threshold (e.g., need exactly 5 votes)
    Absolute { count: u32 },
    /// Ratio-based threshold (e.g., 2/3 majority)
    Ratio { numerator: u32, denominator: u32 },
}

impl Default for ThresholdKind {
    fn default() -> Self {
        ThresholdKind::Ratio {
            numerator: 1,
            denominator: 2,
        }
    }
}

impl ThresholdKind {
    /// Check if a value meets this threshold
    ///
    /// For Absolute: value >= count
    /// For Ratio: value * denominator >= numerator * total
    pub fn is_met(&self, value: u32, total: u32) -> bool {
        match self {
            ThresholdKind::Absolute { count } => value >= *count,
            ThresholdKind::Ratio { numerator, denominator } => {
                if *denominator == 0 {
                    return false;
                }
                // Use u64 to avoid overflow
                (value as u64) * (*denominator as u64) >= (*numerator as u64) * (total as u64)
            }
        }
    }

    /// Create a 50% ratio threshold
    pub fn half() -> Self {
        ThresholdKind::Ratio {
            numerator: 1,
            denominator: 2,
        }
    }

    /// Create a 2/3 majority threshold
    pub fn two_thirds() -> Self {
        ThresholdKind::Ratio {
            numerator: 2,
            denominator: 3,
        }
    }

    /// Create a unanimous (100%) threshold
    pub fn unanimous() -> Self {
        ThresholdKind::Ratio {
            numerator: 1,
            denominator: 1,
        }
    }

    /// Create a 10% threshold
    pub fn ten_percent() -> Self {
        ThresholdKind::Ratio {
            numerator: 1,
            denominator: 10,
        }
    }

    /// Create a 25% threshold
    pub fn quarter() -> Self {
        ThresholdKind::Ratio {
            numerator: 1,
            denominator: 4,
        }
    }
}

/// Vote type (approve, reject, or abstain)
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum VoteType {
    /// Approve the proposal
    Approve,
    /// Reject the proposal
    Reject,
    /// Abstain from voting (counts toward quorum but not threshold)
    Abstain,
}

/// Individual vote record
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Vote {
    /// Account that cast the vote
    pub voter: AccountId,
    /// Type of vote
    pub vote_type: VoteType,
    /// Weight of this vote
    pub weight: u32,
    /// Timestamp when vote was cast (nanoseconds)
    pub timestamp: u64,
}

/// Voting policy configuration
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct VotePolicy {
    /// How to calculate vote weights
    pub weight_kind: WeightKind,
    /// Threshold for approval (approve / (approve + reject))
    pub threshold: ThresholdKind,
    /// Minimum participation required (total voted / total eligible)
    pub quorum: ThresholdKind,
    /// Threshold for veto (used in semi-autonomous mode)
    /// If Some and met by reject votes, proposal is vetoed
    pub veto_threshold: Option<ThresholdKind>,
}

impl Default for VotePolicy {
    fn default() -> Self {
        Self {
            weight_kind: WeightKind::RoleWeight,
            threshold: ThresholdKind::half(),
            quorum: ThresholdKind::ten_percent(),
            veto_threshold: None,
        }
    }
}

impl VotePolicy {
    /// Create default policy for a proposal kind
    ///
    /// Policies are military-appropriate:
    /// - StrikeAuthorization: 100% threshold, 100% quorum (unanimous)
    /// - ConfigChange: 67% threshold, 50% quorum
    /// - Transfer: 50% threshold, 25% quorum
    /// - Default: 50% threshold, 10% quorum
    pub fn for_proposal_kind(kind: &ProposalKind) -> Self {
        match kind {
            ProposalKind::StrikeAuthorization => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::unanimous(),
                quorum: ThresholdKind::unanimous(),
                veto_threshold: None, // No veto - requires full approval
            },
            ProposalKind::ConfigChange => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::two_thirds(),
                quorum: ThresholdKind::half(),
                veto_threshold: Some(ThresholdKind::Ratio {
                    numerator: 1,
                    denominator: 3,
                }),
            },
            ProposalKind::Transfer => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::half(),
                quorum: ThresholdKind::quarter(),
                veto_threshold: Some(ThresholdKind::half()),
            },
            ProposalKind::MissionOrder => Self {
                weight_kind: WeightKind::RoleWeight,
                threshold: ThresholdKind::two_thirds(),
                quorum: ThresholdKind::half(),
                veto_threshold: Some(ThresholdKind::Ratio {
                    numerator: 1,
                    denominator: 3,
                }),
            },
            _ => Self::default(),
        }
    }
}

/// Result of vote calculation
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct VotingResult {
    /// Total weight of all votes cast
    pub total_weight: u32,
    /// Weight of approve votes
    pub approve_weight: u32,
    /// Weight of reject votes
    pub reject_weight: u32,
    /// Weight of abstain votes
    pub abstain_weight: u32,
    /// Whether quorum requirement was met
    pub quorum_met: bool,
    /// Whether approval threshold was met (only meaningful if quorum met)
    pub approved: bool,
    /// Whether veto threshold was met (for semi-autonomous)
    pub vetoed: bool,
}

impl VotingResult {
    /// Check if the result represents a successful approval
    pub fn is_approved(&self) -> bool {
        self.quorum_met && self.approved && !self.vetoed
    }

    /// Check if the result represents a rejection
    pub fn is_rejected(&self) -> bool {
        self.quorum_met && (!self.approved || self.vetoed)
    }
}

/// Voting engine for managing votes and calculating results
#[near(serializers = [borsh])]
pub struct VotingEngine {
    /// Votes per proposal: composite key "dao_id:proposal_id" -> Vec<Vote>
    votes: LookupMap<String, Vec<Vote>>,
    /// Policies per proposal kind: composite key "dao_id:kind_label" -> VotePolicy
    policies: LookupMap<String, VotePolicy>,
}

impl VotingEngine {
    /// Initialize new voting engine
    pub fn new() -> Self {
        Self {
            votes: LookupMap::new(VotingStorageKey::Votes),
            policies: LookupMap::new(VotingStorageKey::Policies),
        }
    }

    /// Create composite key for vote storage
    fn vote_key(dao_id: &str, proposal_id: u64) -> String {
        format!("{}:{}", dao_id, proposal_id)
    }

    /// Create composite key for policy storage
    fn policy_key(dao_id: &str, proposal_kind_label: &str) -> String {
        format!("{}:{}", dao_id, proposal_kind_label)
    }

    /// Set voting policy for a specific proposal kind in a DAO
    pub fn set_policy(&mut self, dao_id: &str, proposal_kind: &ProposalKind, policy: VotePolicy) {
        let key = Self::policy_key(dao_id, &proposal_kind.to_policy_label());
        self.policies.insert(key.clone(), policy.clone());

        log!(
            "VOTE_POLICY_SET: {{\"dao_id\": \"{}\", \"kind\": \"{}\", \"weight_kind\": \"{:?}\", \"threshold\": \"{:?}\"}}",
            dao_id,
            proposal_kind.to_policy_label(),
            policy.weight_kind,
            policy.threshold
        );
    }

    /// Get voting policy for a proposal kind in a DAO
    ///
    /// Returns custom policy if set, otherwise default policy for the kind
    pub fn get_policy(&self, dao_id: &str, proposal_kind: &ProposalKind) -> VotePolicy {
        let key = Self::policy_key(dao_id, &proposal_kind.to_policy_label());
        self.policies
            .get(&key)
            .cloned()
            .unwrap_or_else(|| VotePolicy::for_proposal_kind(proposal_kind))
    }

    /// Cast a vote on a proposal
    ///
    /// # Arguments
    /// * `dao_id` - DAO identifier
    /// * `proposal_id` - Proposal identifier
    /// * `voter` - Account casting the vote
    /// * `vote_type` - Type of vote (Approve, Reject, Abstain)
    /// * `weight` - Weight of the vote
    ///
    /// # Returns
    /// * `Ok(())` on success
    /// * `Err(String)` if voter has already voted
    pub fn cast_vote(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        voter: AccountId,
        vote_type: VoteType,
        weight: u32,
    ) -> Result<(), String> {
        let key = Self::vote_key(dao_id, proposal_id);

        // Get existing votes
        let mut votes = self.votes.get(&key).cloned().unwrap_or_default();

        // Check for duplicate vote
        if votes.iter().any(|v| v.voter == voter) {
            return Err(format!("Account {} has already voted on this proposal", voter));
        }

        // Create and record vote
        let vote = Vote {
            voter: voter.clone(),
            vote_type,
            weight,
            timestamp: env::block_timestamp(),
        };

        votes.push(vote);
        self.votes.insert(key, votes);

        log!(
            "VOTE_CAST: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"voter\": \"{}\", \"vote_type\": \"{:?}\", \"weight\": {}}}",
            dao_id,
            proposal_id,
            voter,
            vote_type,
            weight
        );

        Ok(())
    }

    /// Get all votes for a proposal
    pub fn get_votes(&self, dao_id: &str, proposal_id: u64) -> Vec<Vote> {
        let key = Self::vote_key(dao_id, proposal_id);
        self.votes.get(&key).cloned().unwrap_or_default()
    }

    /// Check if an account has voted on a proposal
    pub fn has_voted(&self, dao_id: &str, proposal_id: u64, voter: &AccountId) -> bool {
        let votes = self.get_votes(dao_id, proposal_id);
        votes.iter().any(|v| &v.voter == voter)
    }

    /// Get vote by a specific voter
    pub fn get_vote(&self, dao_id: &str, proposal_id: u64, voter: &AccountId) -> Option<Vote> {
        let votes = self.get_votes(dao_id, proposal_id);
        votes.into_iter().find(|v| &v.voter == voter)
    }

    /// Calculate voting result for a proposal
    ///
    /// # Arguments
    /// * `dao_id` - DAO identifier
    /// * `proposal_id` - Proposal identifier
    /// * `policy` - Voting policy to apply
    /// * `total_eligible_weight` - Total weight of all eligible voters
    ///
    /// # Returns
    /// VotingResult with calculated totals and threshold checks
    pub fn calculate_result(
        &self,
        dao_id: &str,
        proposal_id: u64,
        policy: &VotePolicy,
        total_eligible_weight: u32,
    ) -> VotingResult {
        let votes = self.get_votes(dao_id, proposal_id);

        // Sum weights by vote type
        let mut approve_weight = 0u32;
        let mut reject_weight = 0u32;
        let mut abstain_weight = 0u32;

        for vote in &votes {
            match vote.vote_type {
                VoteType::Approve => approve_weight += vote.weight,
                VoteType::Reject => reject_weight += vote.weight,
                VoteType::Abstain => abstain_weight += vote.weight,
            }
        }

        let total_weight = approve_weight + reject_weight + abstain_weight;

        // Check quorum (participation / eligible)
        let quorum_met = policy.quorum.is_met(total_weight, total_eligible_weight);

        // Check approval threshold (approve / (approve + reject))
        // Abstain doesn't count against approval
        let vote_weight = approve_weight + reject_weight;
        let approved = if vote_weight > 0 {
            policy.threshold.is_met(approve_weight, vote_weight)
        } else {
            false
        };

        // Check veto threshold if applicable
        let vetoed = match &policy.veto_threshold {
            Some(veto_threshold) if vote_weight > 0 => {
                veto_threshold.is_met(reject_weight, vote_weight)
            }
            _ => false,
        };

        VotingResult {
            total_weight,
            approve_weight,
            reject_weight,
            abstain_weight,
            quorum_met,
            approved,
            vetoed,
        }
    }

    /// Get vote weight for an account based on weight kind
    ///
    /// # Arguments
    /// * `dao_id` - DAO identifier
    /// * `_account` - Account to get weight for
    /// * `weight_kind` - How to calculate weight
    /// * `has_role` - Whether account has any role in the DAO
    ///
    /// # Returns
    /// Vote weight for the account
    pub fn get_vote_weight(
        &self,
        _dao_id: &str,
        _account: &AccountId,
        weight_kind: WeightKind,
        has_role: bool,
    ) -> u32 {
        match weight_kind {
            WeightKind::TokenWeight => {
                // TODO: Query staking contract for token balance
                // For now, stub with 1 to allow basic functionality
                1
            }
            WeightKind::RoleWeight => {
                // 1 if has any role in DAO, 0 otherwise
                if has_role {
                    1
                } else {
                    0
                }
            }
            WeightKind::Equal => {
                // Everyone gets equal weight of 1
                1
            }
        }
    }

    /// Clear all votes for a proposal (used when proposal is removed/cancelled)
    pub fn clear_votes(&mut self, dao_id: &str, proposal_id: u64) {
        let key = Self::vote_key(dao_id, proposal_id);
        self.votes.remove(&key);

        log!(
            "VOTES_CLEARED: {{\"dao_id\": \"{}\", \"proposal_id\": {}}}",
            dao_id,
            proposal_id
        );
    }

    /// Get vote count for a proposal
    pub fn get_vote_count(&self, dao_id: &str, proposal_id: u64) -> usize {
        self.get_votes(dao_id, proposal_id).len()
    }
}

impl Default for VotingEngine {
    fn default() -> Self {
        Self::new()
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
        builder.block_timestamp(1_000_000_000);
        builder
    }

    // === ThresholdKind Tests ===

    #[test]
    fn test_threshold_absolute() {
        let threshold = ThresholdKind::Absolute { count: 5 };

        assert!(!threshold.is_met(4, 10));
        assert!(threshold.is_met(5, 10));
        assert!(threshold.is_met(6, 10));
    }

    #[test]
    fn test_threshold_ratio_half() {
        let threshold = ThresholdKind::half();

        assert!(!threshold.is_met(4, 10)); // 40% < 50%
        assert!(threshold.is_met(5, 10)); // 50% >= 50%
        assert!(threshold.is_met(6, 10)); // 60% >= 50%
    }

    #[test]
    fn test_threshold_ratio_two_thirds() {
        let threshold = ThresholdKind::two_thirds();

        assert!(!threshold.is_met(6, 10)); // 60% < 67%
        assert!(threshold.is_met(7, 10)); // 70% >= 67%
        assert!(threshold.is_met(10, 10)); // 100% >= 67%
    }

    #[test]
    fn test_threshold_ratio_unanimous() {
        let threshold = ThresholdKind::unanimous();

        assert!(!threshold.is_met(9, 10)); // 90% < 100%
        assert!(threshold.is_met(10, 10)); // 100% = 100%
    }

    #[test]
    fn test_threshold_ratio_zero_denominator() {
        let threshold = ThresholdKind::Ratio {
            numerator: 1,
            denominator: 0,
        };
        assert!(!threshold.is_met(5, 10));
    }

    #[test]
    fn test_threshold_default() {
        let threshold: ThresholdKind = Default::default();
        // Default is 50%
        assert!(!threshold.is_met(4, 10));
        assert!(threshold.is_met(5, 10));
    }

    // === VotePolicy Tests ===

    #[test]
    fn test_vote_policy_default() {
        let policy: VotePolicy = Default::default();

        assert_eq!(policy.weight_kind, WeightKind::RoleWeight);
        assert!(policy.veto_threshold.is_none());
    }

    #[test]
    fn test_vote_policy_strike_authorization() {
        let policy = VotePolicy::for_proposal_kind(&ProposalKind::StrikeAuthorization);

        // Should require unanimous approval
        assert!(matches!(policy.threshold, ThresholdKind::Ratio { numerator: 1, denominator: 1 }));
        assert!(matches!(policy.quorum, ThresholdKind::Ratio { numerator: 1, denominator: 1 }));
        assert!(policy.veto_threshold.is_none());
    }

    #[test]
    fn test_vote_policy_config_change() {
        let policy = VotePolicy::for_proposal_kind(&ProposalKind::ConfigChange);

        // Should require 2/3 majority
        assert!(matches!(policy.threshold, ThresholdKind::Ratio { numerator: 2, denominator: 3 }));
        assert!(policy.veto_threshold.is_some());
    }

    #[test]
    fn test_vote_policy_transfer() {
        let policy = VotePolicy::for_proposal_kind(&ProposalKind::Transfer);

        // Should require simple majority
        assert!(matches!(policy.threshold, ThresholdKind::Ratio { numerator: 1, denominator: 2 }));
        assert!(matches!(policy.quorum, ThresholdKind::Ratio { numerator: 1, denominator: 4 }));
    }

    // === VotingResult Tests ===

    #[test]
    fn test_voting_result_is_approved() {
        let result = VotingResult {
            total_weight: 10,
            approve_weight: 7,
            reject_weight: 3,
            abstain_weight: 0,
            quorum_met: true,
            approved: true,
            vetoed: false,
        };

        assert!(result.is_approved());
        assert!(!result.is_rejected());
    }

    #[test]
    fn test_voting_result_is_rejected_no_quorum() {
        let result = VotingResult {
            total_weight: 2,
            approve_weight: 2,
            reject_weight: 0,
            abstain_weight: 0,
            quorum_met: false,
            approved: true,
            vetoed: false,
        };

        assert!(!result.is_approved());
        // Not rejected either because quorum not met
        assert!(!result.is_rejected());
    }

    #[test]
    fn test_voting_result_is_rejected_threshold_not_met() {
        let result = VotingResult {
            total_weight: 10,
            approve_weight: 3,
            reject_weight: 7,
            abstain_weight: 0,
            quorum_met: true,
            approved: false,
            vetoed: false,
        };

        assert!(!result.is_approved());
        assert!(result.is_rejected());
    }

    #[test]
    fn test_voting_result_is_vetoed() {
        let result = VotingResult {
            total_weight: 10,
            approve_weight: 6,
            reject_weight: 4,
            abstain_weight: 0,
            quorum_met: true,
            approved: true,
            vetoed: true,
        };

        assert!(!result.is_approved());
        assert!(result.is_rejected());
    }

    // === VotingEngine Tests ===

    #[test]
    fn test_voting_engine_cast_vote() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        let result = engine.cast_vote(
            dao_id,
            proposal_id,
            owner.clone(),
            VoteType::Approve,
            1,
        );

        assert!(result.is_ok());

        let votes = engine.get_votes(dao_id, proposal_id);
        assert_eq!(votes.len(), 1);
        assert_eq!(votes[0].voter, owner);
        assert_eq!(votes[0].vote_type, VoteType::Approve);
        assert_eq!(votes[0].weight, 1);
    }

    #[test]
    fn test_voting_engine_prevent_duplicate_vote() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // First vote succeeds
        let result1 = engine.cast_vote(
            dao_id,
            proposal_id,
            owner.clone(),
            VoteType::Approve,
            1,
        );
        assert!(result1.is_ok());

        // Second vote fails
        let result2 = engine.cast_vote(
            dao_id,
            proposal_id,
            owner.clone(),
            VoteType::Reject,
            1,
        );
        assert!(result2.is_err());
        assert!(result2.unwrap_err().contains("already voted"));
    }

    #[test]
    fn test_voting_engine_has_voted() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        assert!(!engine.has_voted(dao_id, proposal_id, &owner));

        engine.cast_vote(dao_id, proposal_id, owner.clone(), VoteType::Approve, 1).unwrap();

        assert!(engine.has_voted(dao_id, proposal_id, &owner));
        assert!(!engine.has_voted(dao_id, proposal_id, &bob));
    }

    #[test]
    fn test_voting_engine_get_vote() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        engine.cast_vote(dao_id, proposal_id, owner.clone(), VoteType::Reject, 5).unwrap();

        let vote = engine.get_vote(dao_id, proposal_id, &owner).unwrap();
        assert_eq!(vote.vote_type, VoteType::Reject);
        assert_eq!(vote.weight, 5);
    }

    #[test]
    fn test_voting_engine_calculate_result_simple() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let carol: AccountId = "carol.near".parse().unwrap();
        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // 2 approve, 1 reject
        engine.cast_vote(dao_id, proposal_id, alice, VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, bob, VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, carol, VoteType::Reject, 1).unwrap();

        let policy = VotePolicy::default(); // 50% threshold, 10% quorum
        let result = engine.calculate_result(dao_id, proposal_id, &policy, 5);

        assert_eq!(result.total_weight, 3);
        assert_eq!(result.approve_weight, 2);
        assert_eq!(result.reject_weight, 1);
        assert_eq!(result.abstain_weight, 0);
        assert!(result.quorum_met); // 3/5 = 60% > 10%
        assert!(result.approved); // 2/3 = 67% > 50%
        assert!(!result.vetoed);
        assert!(result.is_approved());
    }

    #[test]
    fn test_voting_engine_calculate_result_with_abstain() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let carol: AccountId = "carol.near".parse().unwrap();
        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // 1 approve, 1 reject, 1 abstain
        engine.cast_vote(dao_id, proposal_id, alice, VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, bob, VoteType::Reject, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, carol, VoteType::Abstain, 1).unwrap();

        let policy = VotePolicy::default();
        let result = engine.calculate_result(dao_id, proposal_id, &policy, 5);

        assert_eq!(result.total_weight, 3);
        assert_eq!(result.abstain_weight, 1);
        // Abstain counts toward quorum but not threshold
        // approve / (approve + reject) = 1/2 = 50% >= 50%
        assert!(result.approved);
    }

    #[test]
    fn test_voting_engine_calculate_result_quorum_not_met() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Only 1 vote out of 100 eligible
        engine.cast_vote(dao_id, proposal_id, alice, VoteType::Approve, 1).unwrap();

        let policy = VotePolicy {
            quorum: ThresholdKind::quarter(), // 25% quorum
            ..Default::default()
        };
        let result = engine.calculate_result(dao_id, proposal_id, &policy, 100);

        assert!(!result.quorum_met); // 1/100 = 1% < 25%
        assert!(result.approved); // Threshold is met but quorum isn't
        assert!(!result.is_approved()); // Not approved because quorum not met
    }

    #[test]
    fn test_voting_engine_calculate_result_veto() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let carol: AccountId = "carol.near".parse().unwrap();
        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // 2 approve, 1 reject
        engine.cast_vote(dao_id, proposal_id, alice, VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, bob, VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, carol, VoteType::Reject, 1).unwrap();

        // Policy with 1/3 veto threshold
        let policy = VotePolicy {
            veto_threshold: Some(ThresholdKind::Ratio {
                numerator: 1,
                denominator: 3,
            }),
            ..Default::default()
        };
        let result = engine.calculate_result(dao_id, proposal_id, &policy, 3);

        // 1/3 reject = 33.3% >= 33.3% veto threshold
        assert!(result.vetoed);
        assert!(!result.is_approved());
    }

    #[test]
    fn test_voting_engine_policy_management() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";

        // Get default policy
        let default_policy = engine.get_policy(dao_id, &ProposalKind::Transfer);
        assert!(matches!(default_policy.threshold, ThresholdKind::Ratio { numerator: 1, denominator: 2 }));

        // Set custom policy
        let custom_policy = VotePolicy {
            weight_kind: WeightKind::TokenWeight,
            threshold: ThresholdKind::two_thirds(),
            quorum: ThresholdKind::half(),
            veto_threshold: None,
        };
        engine.set_policy(dao_id, &ProposalKind::Transfer, custom_policy);

        // Get custom policy
        let retrieved = engine.get_policy(dao_id, &ProposalKind::Transfer);
        assert!(matches!(retrieved.weight_kind, WeightKind::TokenWeight));
        assert!(matches!(retrieved.threshold, ThresholdKind::Ratio { numerator: 2, denominator: 3 }));
    }

    #[test]
    fn test_voting_engine_get_vote_weight() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let engine = VotingEngine::new();
        let dao_id = "test-dao";

        // RoleWeight: 1 if has role
        assert_eq!(engine.get_vote_weight(dao_id, &owner, WeightKind::RoleWeight, true), 1);
        assert_eq!(engine.get_vote_weight(dao_id, &owner, WeightKind::RoleWeight, false), 0);

        // Equal: always 1
        assert_eq!(engine.get_vote_weight(dao_id, &owner, WeightKind::Equal, true), 1);
        assert_eq!(engine.get_vote_weight(dao_id, &owner, WeightKind::Equal, false), 1);

        // TokenWeight: stub returns 1
        assert_eq!(engine.get_vote_weight(dao_id, &owner, WeightKind::TokenWeight, true), 1);
    }

    #[test]
    fn test_voting_engine_clear_votes() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        engine.cast_vote(dao_id, proposal_id, owner.clone(), VoteType::Approve, 1).unwrap();
        assert_eq!(engine.get_vote_count(dao_id, proposal_id), 1);

        engine.clear_votes(dao_id, proposal_id);
        assert_eq!(engine.get_vote_count(dao_id, proposal_id), 0);
    }

    #[test]
    fn test_voting_engine_multiple_proposals() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";

        // Vote on proposal 1
        engine.cast_vote(dao_id, 1, alice.clone(), VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, 1, bob.clone(), VoteType::Reject, 1).unwrap();

        // Vote on proposal 2
        engine.cast_vote(dao_id, 2, alice.clone(), VoteType::Reject, 1).unwrap();
        engine.cast_vote(dao_id, 2, bob.clone(), VoteType::Approve, 1).unwrap();

        // Verify votes are isolated
        let votes1 = engine.get_votes(dao_id, 1);
        let votes2 = engine.get_votes(dao_id, 2);

        assert_eq!(votes1.len(), 2);
        assert_eq!(votes2.len(), 2);

        // Alice voted Approve on 1, Reject on 2
        assert_eq!(votes1.iter().find(|v| v.voter == alice).unwrap().vote_type, VoteType::Approve);
        assert_eq!(votes2.iter().find(|v| v.voter == alice).unwrap().vote_type, VoteType::Reject);
    }

    #[test]
    fn test_voting_engine_weighted_voting() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // Alice has weight 10, Bob has weight 1
        engine.cast_vote(dao_id, proposal_id, alice, VoteType::Reject, 10).unwrap();
        engine.cast_vote(dao_id, proposal_id, bob, VoteType::Approve, 1).unwrap();

        let policy = VotePolicy::default();
        let result = engine.calculate_result(dao_id, proposal_id, &policy, 11);

        assert_eq!(result.approve_weight, 1);
        assert_eq!(result.reject_weight, 10);
        // 1/11 = 9% approve < 50%
        assert!(!result.approved);
    }

    #[test]
    fn test_strike_authorization_requires_unanimous() {
        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();
        let carol: AccountId = "carol.near".parse().unwrap();
        let context = get_context(alice.clone());
        testing_env!(context.build());

        let mut engine = VotingEngine::new();
        let dao_id = "test-dao";
        let proposal_id = 1;

        // All 3 approve
        engine.cast_vote(dao_id, proposal_id, alice.clone(), VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, bob.clone(), VoteType::Approve, 1).unwrap();
        engine.cast_vote(dao_id, proposal_id, carol.clone(), VoteType::Approve, 1).unwrap();

        let policy = VotePolicy::for_proposal_kind(&ProposalKind::StrikeAuthorization);
        let result = engine.calculate_result(dao_id, proposal_id, &policy, 3);

        assert!(result.quorum_met); // 100% participation
        assert!(result.approved); // 100% approve
        assert!(result.is_approved());

        // Now test with one reject
        let mut engine2 = VotingEngine::new();
        engine2.cast_vote(dao_id, proposal_id, alice, VoteType::Approve, 1).unwrap();
        engine2.cast_vote(dao_id, proposal_id, bob, VoteType::Approve, 1).unwrap();
        engine2.cast_vote(dao_id, proposal_id, carol, VoteType::Reject, 1).unwrap();

        let result2 = engine2.calculate_result(dao_id, proposal_id, &policy, 3);
        assert!(result2.quorum_met);
        assert!(!result2.approved); // 66% < 100%
        assert!(!result2.is_approved());
    }

    #[test]
    fn test_voting_engine_default() {
        let engine1 = VotingEngine::new();
        let engine2 = VotingEngine::default();

        // Both should work identically
        assert_eq!(engine1.get_vote_count("dao", 1), 0);
        assert_eq!(engine2.get_vote_count("dao", 1), 0);
    }
}
