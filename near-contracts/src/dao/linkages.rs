/**
 * DAO Linkages Module
 *
 * Provides hierarchical DAO relationships, cross-DAO approvals, and coalition voting:
 * - DAORelationship: Parent-child hierarchy and resource sharing between DAOs
 * - CrossDAORequirement: Require approvals from multiple DAOs for proposals
 * - CoalitionProposal: Multi-party coalition voting (e.g., Five Eyes, NATO)
 *
 * Key features:
 * - Inherited membership from parent DAOs in hierarchy
 * - Cross-DAO approval tracking with three requirement types
 * - Coalition voting with party membership verification
 */

use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};
use std::collections::HashMap;

/// Storage keys for linkage collections
#[derive(BorshStorageKey)]
#[near]
pub enum LinkageStorageKey {
    /// DAO relationships: dao_id -> DAORelationship
    Relationships,
    /// Cross-DAO requirements: "dao_id:proposal_id" -> CrossDAORequirement
    CrossDAORequirements,
    /// Coalition proposals: "dao_id:proposal_id" -> CoalitionProposal
    CoalitionProposals,
}

/// Requirement type for cross-DAO approvals
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum RequirementType {
    /// All listed DAOs must approve (unanimous)
    #[default]
    AllRequired,
    /// More than 50% of listed DAOs must approve
    MajorityRequired,
    /// At least one DAO must approve
    AnyOne,
}

/// DAO relationship tracking parent-child hierarchy and resource sharing
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct DAORelationship {
    /// Parent DAO ID (None if root DAO)
    pub parent_dao_id: Option<String>,
    /// Child DAO IDs that inherit from this DAO
    pub child_dao_ids: Vec<String>,
    /// DAOs that share resources with this one
    pub shared_with: Vec<String>,
    /// Timestamp when relationship was established
    pub created_at: u64,
}

impl Default for DAORelationship {
    fn default() -> Self {
        Self {
            parent_dao_id: None,
            child_dao_ids: Vec::new(),
            shared_with: Vec::new(),
            created_at: 0,
        }
    }
}

/// Cross-DAO approval requirement for a proposal
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct CrossDAORequirement {
    /// DAOs that must approve this proposal
    pub required_dao_ids: Vec<String>,
    /// Type of requirement (all, majority, any)
    pub requirement_type: RequirementType,
    /// Approval status per DAO
    pub approvals_received: HashMap<String, bool>,
    /// Timestamp when requirement was created
    pub created_at: u64,
}

/// Individual party approval record for coalition voting
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct CoalitionApproval {
    /// Party identifier (e.g., "USA", "GBR", "AUS")
    pub party: String,
    /// Whether this party has approved
    pub approved: bool,
    /// Account that submitted the approval
    pub approved_by: Option<AccountId>,
    /// Timestamp when approval was recorded
    pub approved_at: Option<u64>,
}

/// Coalition proposal requiring multi-party approval
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct CoalitionProposal {
    /// Base proposal ID
    pub base_proposal_id: u64,
    /// Base DAO ID where proposal originated
    pub base_dao_id: String,
    /// Required coalition parties (e.g., ["USA", "GBR", "AUS"])
    pub required_parties: Vec<String>,
    /// Party approvals
    pub party_approvals: HashMap<String, CoalitionApproval>,
    /// Whether all parties are required (true) or just majority (false)
    pub all_parties_required: bool,
    /// Timestamp when coalition proposal was created
    pub created_at: u64,
}

/// DAO Linkage Manager for managing hierarchical relationships and coalition voting
#[near(serializers = [borsh])]
pub struct DAOLinkageManager {
    /// DAO relationships: dao_id -> DAORelationship
    relationships: LookupMap<String, DAORelationship>,
    /// Cross-DAO requirements: composite key "dao_id:proposal_id" -> CrossDAORequirement
    cross_dao_requirements: LookupMap<String, CrossDAORequirement>,
    /// Coalition proposals: composite key "dao_id:proposal_id" -> CoalitionProposal
    coalition_proposals: LookupMap<String, CoalitionProposal>,
}

impl DAOLinkageManager {
    /// Initialize new DAO linkage manager
    pub fn new() -> Self {
        Self {
            relationships: LookupMap::new(LinkageStorageKey::Relationships),
            cross_dao_requirements: LookupMap::new(LinkageStorageKey::CrossDAORequirements),
            coalition_proposals: LookupMap::new(LinkageStorageKey::CoalitionProposals),
        }
    }

    // === Helper Functions ===

    /// Create composite key for cross-DAO requirements and coalition proposals
    fn proposal_key(dao_id: &str, proposal_id: u64) -> String {
        format!("{}:{}", dao_id, proposal_id)
    }

    // === Hierarchical DAO Management ===

    /// Establish parent-child relationship between DAOs
    ///
    /// # Arguments
    /// * `child_dao_id` - The child DAO
    /// * `parent_dao_id` - The parent DAO
    ///
    /// # Effects
    /// - Sets parent on child DAO relationship
    /// - Adds child to parent's child list
    pub fn set_parent(&mut self, child_dao_id: &str, parent_dao_id: &str) {
        let timestamp = env::block_timestamp();

        // Update child's relationship
        let mut child_rel = self.relationships
            .get(&child_dao_id.to_string())
            .cloned()
            .unwrap_or_else(|| DAORelationship {
                created_at: timestamp,
                ..Default::default()
            });

        // Remove from old parent if exists
        if let Some(old_parent) = &child_rel.parent_dao_id {
            if let Some(mut old_parent_rel) = self.relationships.get(old_parent).cloned() {
                old_parent_rel.child_dao_ids.retain(|id| id != child_dao_id);
                self.relationships.insert(old_parent.clone(), old_parent_rel);
            }
        }

        child_rel.parent_dao_id = Some(parent_dao_id.to_string());
        self.relationships.insert(child_dao_id.to_string(), child_rel);

        // Update parent's relationship
        let mut parent_rel = self.relationships
            .get(&parent_dao_id.to_string())
            .cloned()
            .unwrap_or_else(|| DAORelationship {
                created_at: timestamp,
                ..Default::default()
            });

        if !parent_rel.child_dao_ids.contains(&child_dao_id.to_string()) {
            parent_rel.child_dao_ids.push(child_dao_id.to_string());
        }
        self.relationships.insert(parent_dao_id.to_string(), parent_rel);

        log!(
            "DAO_PARENT_SET: {{\"child_dao_id\": \"{}\", \"parent_dao_id\": \"{}\"}}",
            child_dao_id,
            parent_dao_id
        );
    }

    /// Get parent DAO ID for a DAO
    pub fn get_parent(&self, dao_id: &str) -> Option<String> {
        self.relationships
            .get(&dao_id.to_string())
            .and_then(|rel| rel.parent_dao_id.clone())
    }

    /// Get child DAO IDs for a DAO
    pub fn get_children(&self, dao_id: &str) -> Vec<String> {
        self.relationships
            .get(&dao_id.to_string())
            .map(|rel| rel.child_dao_ids.clone())
            .unwrap_or_default()
    }

    /// Add resource sharing relationship between DAOs
    pub fn add_shared_dao(&mut self, dao_id: &str, shared_with_dao_id: &str) {
        let timestamp = env::block_timestamp();

        let mut rel = self.relationships
            .get(&dao_id.to_string())
            .cloned()
            .unwrap_or_else(|| DAORelationship {
                created_at: timestamp,
                ..Default::default()
            });

        if !rel.shared_with.contains(&shared_with_dao_id.to_string()) {
            rel.shared_with.push(shared_with_dao_id.to_string());
            self.relationships.insert(dao_id.to_string(), rel);

            log!(
                "DAO_SHARED: {{\"dao_id\": \"{}\", \"shared_with\": \"{}\"}}",
                dao_id,
                shared_with_dao_id
            );
        }
    }

    /// Remove resource sharing relationship
    pub fn remove_shared_dao(&mut self, dao_id: &str, shared_with_dao_id: &str) {
        if let Some(mut rel) = self.relationships.get(&dao_id.to_string()).cloned() {
            rel.shared_with.retain(|id| id != shared_with_dao_id);
            self.relationships.insert(dao_id.to_string(), rel);

            log!(
                "DAO_UNSHARED: {{\"dao_id\": \"{}\", \"unshared_with\": \"{}\"}}",
                dao_id,
                shared_with_dao_id
            );
        }
    }

    /// Get DAOs that share resources with this DAO
    pub fn get_shared_daos(&self, dao_id: &str) -> Vec<String> {
        self.relationships
            .get(&dao_id.to_string())
            .map(|rel| rel.shared_with.clone())
            .unwrap_or_default()
    }

    /// Check if account is member in the DAO hierarchy
    ///
    /// Returns true if account is member of:
    /// - The specified DAO directly
    /// - Any parent DAO in the hierarchy chain
    ///
    /// This enables inherited membership from parent DAOs.
    ///
    /// # Arguments
    /// * `is_member_fn` - Function that checks direct membership in a single DAO
    /// * `account` - Account to check
    /// * `dao_id` - Starting DAO to check
    pub fn is_member_in_hierarchy<F>(&self, is_member_fn: F, account: &AccountId, dao_id: &str) -> bool
    where
        F: Fn(&AccountId, &str) -> bool,
    {
        // Check direct membership
        if is_member_fn(account, dao_id) {
            return true;
        }

        // Traverse up parent chain
        let mut current_dao = dao_id.to_string();
        let mut visited = vec![current_dao.clone()]; // Prevent infinite loops

        while let Some(parent) = self.get_parent(&current_dao) {
            // Prevent infinite loops from circular references
            if visited.contains(&parent) {
                break;
            }
            visited.push(parent.clone());

            if is_member_fn(account, &parent) {
                return true;
            }
            current_dao = parent;
        }

        false
    }

    /// Get full parent chain for a DAO (for audit/display)
    pub fn get_hierarchy_chain(&self, dao_id: &str) -> Vec<String> {
        let mut chain = vec![dao_id.to_string()];
        let mut current = dao_id.to_string();
        let mut visited = vec![current.clone()];

        while let Some(parent) = self.get_parent(&current) {
            if visited.contains(&parent) {
                break; // Prevent infinite loops
            }
            visited.push(parent.clone());
            chain.push(parent.clone());
            current = parent;
        }

        chain
    }

    // === Cross-DAO Approval Management ===

    /// Create a cross-DAO approval requirement for a proposal
    ///
    /// # Arguments
    /// * `dao_id` - DAO where proposal originated
    /// * `proposal_id` - Proposal ID
    /// * `required_dao_ids` - DAOs that must approve
    /// * `requirement_type` - How many DAOs must approve
    pub fn create_cross_dao_requirement(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        required_dao_ids: Vec<String>,
        requirement_type: RequirementType,
    ) {
        let key = Self::proposal_key(dao_id, proposal_id);

        assert!(
            !required_dao_ids.is_empty(),
            "Must have at least one required DAO"
        );

        let requirement = CrossDAORequirement {
            required_dao_ids: required_dao_ids.clone(),
            requirement_type,
            approvals_received: HashMap::new(),
            created_at: env::block_timestamp(),
        };

        self.cross_dao_requirements.insert(key, requirement);

        log!(
            "CROSS_DAO_REQUIREMENT_CREATED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"required_daos\": {:?}, \"type\": \"{:?}\"}}",
            dao_id,
            proposal_id,
            required_dao_ids,
            requirement_type
        );
    }

    /// Record approval from a DAO for cross-DAO requirement
    ///
    /// # Returns
    /// `true` if all requirements are now met, `false` otherwise
    pub fn record_cross_dao_approval(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        approving_dao_id: &str,
    ) -> bool {
        let key = Self::proposal_key(dao_id, proposal_id);

        let mut requirement = match self.cross_dao_requirements.get(&key).cloned() {
            Some(r) => r,
            None => return false,
        };

        // Verify approving DAO is in required list
        if !requirement.required_dao_ids.contains(&approving_dao_id.to_string()) {
            return false;
        }

        // Record approval
        requirement.approvals_received.insert(approving_dao_id.to_string(), true);
        self.cross_dao_requirements.insert(key.clone(), requirement.clone());

        log!(
            "CROSS_DAO_APPROVAL: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"approving_dao\": \"{}\"}}",
            dao_id,
            proposal_id,
            approving_dao_id
        );

        // Check if requirement is met
        self.check_cross_dao_approved(dao_id, proposal_id)
    }

    /// Check if cross-DAO approval requirement is met
    pub fn check_cross_dao_approved(&self, dao_id: &str, proposal_id: u64) -> bool {
        let key = Self::proposal_key(dao_id, proposal_id);

        let requirement = match self.cross_dao_requirements.get(&key) {
            Some(r) => r,
            None => return true, // No requirement = approved
        };

        let approved_count = requirement
            .approvals_received
            .values()
            .filter(|&&v| v)
            .count();
        let total_required = requirement.required_dao_ids.len();

        match requirement.requirement_type {
            RequirementType::AllRequired => approved_count == total_required,
            RequirementType::MajorityRequired => approved_count > total_required / 2,
            RequirementType::AnyOne => approved_count >= 1,
        }
    }

    /// Get cross-DAO requirement status
    pub fn get_cross_dao_requirement(&self, dao_id: &str, proposal_id: u64) -> Option<CrossDAORequirement> {
        let key = Self::proposal_key(dao_id, proposal_id);
        self.cross_dao_requirements.get(&key).cloned()
    }

    // === Coalition Voting Management ===

    /// Create a coalition proposal requiring multi-party approval
    ///
    /// # Arguments
    /// * `dao_id` - DAO where proposal originated
    /// * `proposal_id` - Proposal ID
    /// * `required_parties` - Party codes that must approve (e.g., ["USA", "GBR"])
    /// * `all_parties_required` - true for unanimous, false for majority
    pub fn create_coalition_proposal(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        required_parties: Vec<String>,
        all_parties_required: bool,
    ) {
        let key = Self::proposal_key(dao_id, proposal_id);

        assert!(
            !required_parties.is_empty(),
            "Must have at least one required party"
        );

        // Initialize party approvals
        let mut party_approvals = HashMap::new();
        for party in &required_parties {
            party_approvals.insert(
                party.clone(),
                CoalitionApproval {
                    party: party.clone(),
                    approved: false,
                    approved_by: None,
                    approved_at: None,
                },
            );
        }

        let proposal = CoalitionProposal {
            base_proposal_id: proposal_id,
            base_dao_id: dao_id.to_string(),
            required_parties: required_parties.clone(),
            party_approvals,
            all_parties_required,
            created_at: env::block_timestamp(),
        };

        self.coalition_proposals.insert(key, proposal);

        log!(
            "COALITION_PROPOSAL_CREATED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"parties\": {:?}, \"unanimous\": {}}}",
            dao_id,
            proposal_id,
            required_parties,
            all_parties_required
        );
    }

    /// Record party approval for coalition proposal
    ///
    /// NOTE: In production, the caller should verify that `approved_by` has
    /// a valid CoalitionMembership credential for the claimed party via
    /// the CredentialRegistry before calling this method.
    ///
    /// # Arguments
    /// * `dao_id` - DAO where proposal originated
    /// * `proposal_id` - Proposal ID
    /// * `party` - Party code submitting approval
    /// * `approved_by` - Account submitting approval (should be verified to have party membership)
    ///
    /// # Returns
    /// `true` if coalition approval requirement is now met, `false` otherwise
    pub fn record_party_approval(
        &mut self,
        dao_id: &str,
        proposal_id: u64,
        party: &str,
        approved_by: AccountId,
    ) -> bool {
        let key = Self::proposal_key(dao_id, proposal_id);

        let mut proposal = match self.coalition_proposals.get(&key).cloned() {
            Some(p) => p,
            None => return false,
        };

        // Verify party is in required list
        if !proposal.required_parties.contains(&party.to_string()) {
            return false;
        }

        // Record approval
        let approval = CoalitionApproval {
            party: party.to_string(),
            approved: true,
            approved_by: Some(approved_by.clone()),
            approved_at: Some(env::block_timestamp()),
        };

        proposal.party_approvals.insert(party.to_string(), approval);
        self.coalition_proposals.insert(key.clone(), proposal);

        log!(
            "COALITION_PARTY_APPROVED: {{\"dao_id\": \"{}\", \"proposal_id\": {}, \"party\": \"{}\", \"approved_by\": \"{}\"}}",
            dao_id,
            proposal_id,
            party,
            approved_by
        );

        // Check if coalition requirement is met
        self.check_coalition_approved(dao_id, proposal_id)
    }

    /// Check if coalition approval requirement is met
    pub fn check_coalition_approved(&self, dao_id: &str, proposal_id: u64) -> bool {
        let key = Self::proposal_key(dao_id, proposal_id);

        let proposal = match self.coalition_proposals.get(&key) {
            Some(p) => p,
            None => return true, // No coalition = approved
        };

        let approved_count = proposal
            .party_approvals
            .values()
            .filter(|a| a.approved)
            .count();
        let total_required = proposal.required_parties.len();

        if proposal.all_parties_required {
            approved_count == total_required
        } else {
            approved_count > total_required / 2
        }
    }

    /// Get coalition proposal status
    pub fn get_coalition_status(&self, dao_id: &str, proposal_id: u64) -> Option<CoalitionProposal> {
        let key = Self::proposal_key(dao_id, proposal_id);
        self.coalition_proposals.get(&key).cloned()
    }

    /// Get list of parties that have approved
    pub fn get_approved_parties(&self, dao_id: &str, proposal_id: u64) -> Vec<String> {
        let key = Self::proposal_key(dao_id, proposal_id);

        self.coalition_proposals
            .get(&key)
            .map(|p| {
                p.party_approvals
                    .values()
                    .filter(|a| a.approved)
                    .map(|a| a.party.clone())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get list of parties still pending approval
    pub fn get_pending_parties(&self, dao_id: &str, proposal_id: u64) -> Vec<String> {
        let key = Self::proposal_key(dao_id, proposal_id);

        self.coalition_proposals
            .get(&key)
            .map(|p| {
                p.party_approvals
                    .values()
                    .filter(|a| !a.approved)
                    .map(|a| a.party.clone())
                    .collect()
            })
            .unwrap_or_default()
    }
}

impl Default for DAOLinkageManager {
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

    // === Hierarchical DAO Tests ===

    #[test]
    fn test_set_parent_basic() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.set_parent("mission-alpha", "strategic-hq");

        assert_eq!(
            manager.get_parent("mission-alpha"),
            Some("strategic-hq".to_string())
        );
        assert!(manager.get_children("strategic-hq").contains(&"mission-alpha".to_string()));
    }

    #[test]
    fn test_set_parent_chain() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        // Create 3-level hierarchy
        manager.set_parent("tactical", "operational");
        manager.set_parent("operational", "strategic");

        let chain = manager.get_hierarchy_chain("tactical");
        assert_eq!(chain, vec!["tactical", "operational", "strategic"]);
    }

    #[test]
    fn test_change_parent() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.set_parent("child", "parent-a");
        assert!(manager.get_children("parent-a").contains(&"child".to_string()));

        // Change parent
        manager.set_parent("child", "parent-b");
        assert!(!manager.get_children("parent-a").contains(&"child".to_string()));
        assert!(manager.get_children("parent-b").contains(&"child".to_string()));
        assert_eq!(manager.get_parent("child"), Some("parent-b".to_string()));
    }

    #[test]
    fn test_multiple_children() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.set_parent("mission-a", "strategic");
        manager.set_parent("mission-b", "strategic");
        manager.set_parent("mission-c", "strategic");

        let children = manager.get_children("strategic");
        assert_eq!(children.len(), 3);
        assert!(children.contains(&"mission-a".to_string()));
        assert!(children.contains(&"mission-b".to_string()));
        assert!(children.contains(&"mission-c".to_string()));
    }

    #[test]
    fn test_is_member_in_hierarchy() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        // Setup hierarchy: tactical -> operational -> strategic
        manager.set_parent("tactical", "operational");
        manager.set_parent("operational", "strategic");

        // Mock membership function
        let is_member = |account: &AccountId, dao_id: &str| -> bool {
            // Alice is member of strategic only
            account.as_str() == "alice.near" && dao_id == "strategic"
        };

        let alice: AccountId = "alice.near".parse().unwrap();
        let bob: AccountId = "bob.near".parse().unwrap();

        // Alice is member of strategic, so inherits membership in tactical
        assert!(manager.is_member_in_hierarchy(is_member, &alice, "tactical"));
        assert!(manager.is_member_in_hierarchy(is_member, &alice, "operational"));
        assert!(manager.is_member_in_hierarchy(is_member, &alice, "strategic"));

        // Bob is not a member anywhere
        let bob_is_member = |_account: &AccountId, _dao_id: &str| -> bool { false };
        assert!(!manager.is_member_in_hierarchy(bob_is_member, &bob, "tactical"));
    }

    // === Shared DAO Tests ===

    #[test]
    fn test_add_shared_dao() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.add_shared_dao("dao-a", "dao-b");
        manager.add_shared_dao("dao-a", "dao-c");

        let shared = manager.get_shared_daos("dao-a");
        assert_eq!(shared.len(), 2);
        assert!(shared.contains(&"dao-b".to_string()));
        assert!(shared.contains(&"dao-c".to_string()));
    }

    #[test]
    fn test_remove_shared_dao() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.add_shared_dao("dao-a", "dao-b");
        manager.add_shared_dao("dao-a", "dao-c");

        manager.remove_shared_dao("dao-a", "dao-b");

        let shared = manager.get_shared_daos("dao-a");
        assert_eq!(shared.len(), 1);
        assert!(!shared.contains(&"dao-b".to_string()));
        assert!(shared.contains(&"dao-c".to_string()));
    }

    #[test]
    fn test_no_duplicate_shared() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.add_shared_dao("dao-a", "dao-b");
        manager.add_shared_dao("dao-a", "dao-b"); // Duplicate

        let shared = manager.get_shared_daos("dao-a");
        assert_eq!(shared.len(), 1);
    }

    // === Cross-DAO Approval Tests ===

    #[test]
    fn test_create_cross_dao_requirement() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.create_cross_dao_requirement(
            "mission-dao",
            1,
            vec!["intel-dao".to_string(), "logistics-dao".to_string()],
            RequirementType::AllRequired,
        );

        let req = manager.get_cross_dao_requirement("mission-dao", 1).unwrap();
        assert_eq!(req.required_dao_ids.len(), 2);
        assert!(req.approvals_received.is_empty());
    }

    #[test]
    fn test_cross_dao_all_required() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.create_cross_dao_requirement(
            "mission-dao",
            1,
            vec!["intel-dao".to_string(), "logistics-dao".to_string()],
            RequirementType::AllRequired,
        );

        // Not approved yet
        assert!(!manager.check_cross_dao_approved("mission-dao", 1));

        // First approval
        let result1 = manager.record_cross_dao_approval("mission-dao", 1, "intel-dao");
        assert!(!result1); // Still need logistics-dao

        // Second approval
        let result2 = manager.record_cross_dao_approval("mission-dao", 1, "logistics-dao");
        assert!(result2); // Now approved

        assert!(manager.check_cross_dao_approved("mission-dao", 1));
    }

    #[test]
    fn test_cross_dao_majority_required() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.create_cross_dao_requirement(
            "mission-dao",
            1,
            vec![
                "dao-a".to_string(),
                "dao-b".to_string(),
                "dao-c".to_string(),
            ],
            RequirementType::MajorityRequired,
        );

        // One approval - not enough (1/3)
        manager.record_cross_dao_approval("mission-dao", 1, "dao-a");
        assert!(!manager.check_cross_dao_approved("mission-dao", 1));

        // Two approvals - majority (2/3)
        let result = manager.record_cross_dao_approval("mission-dao", 1, "dao-b");
        assert!(result);
        assert!(manager.check_cross_dao_approved("mission-dao", 1));
    }

    #[test]
    fn test_cross_dao_any_one() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.create_cross_dao_requirement(
            "mission-dao",
            1,
            vec!["dao-a".to_string(), "dao-b".to_string()],
            RequirementType::AnyOne,
        );

        // One approval is enough
        let result = manager.record_cross_dao_approval("mission-dao", 1, "dao-a");
        assert!(result);
        assert!(manager.check_cross_dao_approved("mission-dao", 1));
    }

    #[test]
    fn test_cross_dao_invalid_approver() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.create_cross_dao_requirement(
            "mission-dao",
            1,
            vec!["dao-a".to_string()],
            RequirementType::AllRequired,
        );

        // Invalid DAO trying to approve
        let result = manager.record_cross_dao_approval("mission-dao", 1, "unauthorized-dao");
        assert!(!result);
        assert!(!manager.check_cross_dao_approved("mission-dao", 1));
    }

    #[test]
    fn test_no_cross_dao_requirement_returns_true() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let manager = DAOLinkageManager::new();

        // No requirement = approved by default
        assert!(manager.check_cross_dao_approved("nonexistent", 999));
    }

    // === Coalition Voting Tests ===

    #[test]
    fn test_create_coalition_proposal() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();

        manager.create_coalition_proposal(
            "five-eyes-dao",
            1,
            vec![
                "USA".to_string(),
                "GBR".to_string(),
                "CAN".to_string(),
                "AUS".to_string(),
                "NZL".to_string(),
            ],
            true, // All parties required
        );

        let status = manager.get_coalition_status("five-eyes-dao", 1).unwrap();
        assert_eq!(status.required_parties.len(), 5);
        assert!(status.all_parties_required);
        assert_eq!(status.party_approvals.len(), 5);
    }

    #[test]
    fn test_coalition_unanimous_approval() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();
        let usa_rep: AccountId = "usa-rep.near".parse().unwrap();
        let gbr_rep: AccountId = "gbr-rep.near".parse().unwrap();
        let aus_rep: AccountId = "aus-rep.near".parse().unwrap();

        manager.create_coalition_proposal(
            "coalition-dao",
            1,
            vec!["USA".to_string(), "GBR".to_string(), "AUS".to_string()],
            true, // Unanimous required
        );

        // Not approved initially
        assert!(!manager.check_coalition_approved("coalition-dao", 1));

        // USA approves
        assert!(!manager.record_party_approval("coalition-dao", 1, "USA", usa_rep));

        // GBR approves
        assert!(!manager.record_party_approval("coalition-dao", 1, "GBR", gbr_rep));

        // AUS approves - now complete
        assert!(manager.record_party_approval("coalition-dao", 1, "AUS", aus_rep));

        assert!(manager.check_coalition_approved("coalition-dao", 1));
    }

    #[test]
    fn test_coalition_majority_approval() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();
        let usa_rep: AccountId = "usa-rep.near".parse().unwrap();
        let gbr_rep: AccountId = "gbr-rep.near".parse().unwrap();

        manager.create_coalition_proposal(
            "coalition-dao",
            1,
            vec!["USA".to_string(), "GBR".to_string(), "AUS".to_string()],
            false, // Majority only
        );

        // USA approves - not enough (1/3)
        assert!(!manager.record_party_approval("coalition-dao", 1, "USA", usa_rep));

        // GBR approves - majority (2/3)
        assert!(manager.record_party_approval("coalition-dao", 1, "GBR", gbr_rep));

        assert!(manager.check_coalition_approved("coalition-dao", 1));
    }

    #[test]
    fn test_coalition_invalid_party() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();
        let imposter: AccountId = "imposter.near".parse().unwrap();

        manager.create_coalition_proposal(
            "coalition-dao",
            1,
            vec!["USA".to_string(), "GBR".to_string()],
            true,
        );

        // Invalid party trying to approve
        let result = manager.record_party_approval("coalition-dao", 1, "RUS", imposter);
        assert!(!result);
        assert!(!manager.check_coalition_approved("coalition-dao", 1));
    }

    #[test]
    fn test_get_approved_and_pending_parties() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();
        let usa_rep: AccountId = "usa-rep.near".parse().unwrap();

        manager.create_coalition_proposal(
            "coalition-dao",
            1,
            vec!["USA".to_string(), "GBR".to_string(), "AUS".to_string()],
            true,
        );

        // Initially all pending
        let pending = manager.get_pending_parties("coalition-dao", 1);
        assert_eq!(pending.len(), 3);
        let approved = manager.get_approved_parties("coalition-dao", 1);
        assert!(approved.is_empty());

        // USA approves
        manager.record_party_approval("coalition-dao", 1, "USA", usa_rep);

        let pending = manager.get_pending_parties("coalition-dao", 1);
        assert_eq!(pending.len(), 2);
        assert!(!pending.contains(&"USA".to_string()));

        let approved = manager.get_approved_parties("coalition-dao", 1);
        assert_eq!(approved.len(), 1);
        assert!(approved.contains(&"USA".to_string()));
    }

    #[test]
    fn test_coalition_approval_records_details() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();
        let usa_rep: AccountId = "usa-rep.near".parse().unwrap();

        manager.create_coalition_proposal(
            "coalition-dao",
            1,
            vec!["USA".to_string()],
            true,
        );

        manager.record_party_approval("coalition-dao", 1, "USA", usa_rep.clone());

        let status = manager.get_coalition_status("coalition-dao", 1).unwrap();
        let usa_approval = status.party_approvals.get("USA").unwrap();

        assert!(usa_approval.approved);
        assert_eq!(usa_approval.approved_by, Some(usa_rep));
        assert!(usa_approval.approved_at.is_some());
    }

    #[test]
    fn test_no_coalition_requirement_returns_true() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let manager = DAOLinkageManager::new();

        // No coalition = approved by default
        assert!(manager.check_coalition_approved("nonexistent", 999));
    }

    #[test]
    #[should_panic(expected = "Must have at least one required DAO")]
    fn test_create_cross_dao_empty_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();
        manager.create_cross_dao_requirement("dao", 1, vec![], RequirementType::AllRequired);
    }

    #[test]
    #[should_panic(expected = "Must have at least one required party")]
    fn test_create_coalition_empty_fails() {
        let owner: AccountId = "alice.near".parse().unwrap();
        let context = get_context(owner.clone());
        testing_env!(context.build());

        let mut manager = DAOLinkageManager::new();
        manager.create_coalition_proposal("dao", 1, vec![], true);
    }

    #[test]
    fn test_default_requirement_type() {
        let req_type: RequirementType = Default::default();
        assert_eq!(req_type, RequirementType::AllRequired);
    }

    #[test]
    fn test_manager_default() {
        let manager1 = DAOLinkageManager::new();
        let manager2 = DAOLinkageManager::default();

        // Both should work identically
        assert!(manager1.get_parent("nonexistent").is_none());
        assert!(manager2.get_parent("nonexistent").is_none());
    }
}
