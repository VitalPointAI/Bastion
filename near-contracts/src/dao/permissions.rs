/**
 * DAO Permission Checking
 *
 * Provides permission evaluation logic with:
 * - Wildcard matching for proposal kind and action patterns
 * - Clearance verification via CredentialRegistry
 * - Agent tier restrictions
 * - Maximum autonomy level enforcement
 *
 * Permission format: "{ProposalKind}:{Action}"
 * Wildcards:
 * - "*:*" matches all proposal kinds and actions
 * - "Transfer:*" matches any action on Transfer proposals
 * - "*:VoteApprove" matches VoteApprove on any proposal kind
 */

use near_sdk::{near, AccountId};

use crate::credential_registry::CredentialRegistry;
use crate::privacy::Classification;

use super::roles::{Action, AgentTier, Permission, Role, RoleManager};
use super::types::{AutonomyLevel, Proposal, ProposalKind};

/// Permission checker for DAO access control
///
/// Combines role-based permissions with:
/// - Clearance verification (requires valid SecurityClearance credential)
/// - Agent tier restrictions (AI agents have bounded participation)
/// - Maximum autonomy enforcement per role
#[near(serializers = [borsh])]
pub struct PermissionChecker {
    // Note: PermissionChecker doesn't own the RoleManager or CredentialRegistry
    // It operates on references passed to methods for checking
    // This is a stateless utility struct
}

impl PermissionChecker {
    /// Create a new permission checker
    pub fn new() -> Self {
        Self {}
    }

    /// Main permission check combining all factors
    ///
    /// Returns true if the account has permission to perform the action
    /// on the given proposal kind in this DAO.
    ///
    /// Checks:
    /// 1. Account's agent tier must be allowed by at least one role
    /// 2. Account must have required clearance (if role requires it)
    /// 3. At least one permission must match the requested action
    pub fn can_execute(
        &self,
        role_manager: &RoleManager,
        _credential_registry: &CredentialRegistry,
        dao_id: &str,
        account: &AccountId,
        proposal_kind: &ProposalKind,
        action: Action,
        proposal_classification: &Classification,
    ) -> bool {
        // Get all roles for this account in this DAO
        let role_names = role_manager.get_member_roles(dao_id, account);
        if role_names.is_empty() {
            return false;
        }

        // Get account's agent tier
        let account_tier = role_manager.get_agent_tier(account);

        // Check each role
        for role_name in role_names {
            if let Some(role) = role_manager.get_role(dao_id, &role_name) {
                // 1. Check if account's agent tier is allowed
                if !self.is_agent_tier_allowed(&role, account_tier) {
                    continue;
                }

                // 2. Check clearance requirement
                // Note: In a real implementation, this would verify the actual clearance
                // credential via CredentialRegistry. For now, we compare the account's
                // roles against the proposal classification.
                if !self.has_sufficient_clearance(&role, proposal_classification) {
                    continue;
                }

                // 3. Check if any permission matches
                for permission in &role.permissions {
                    if self.matches_permission(permission, proposal_kind, action) {
                        return true;
                    }
                }
            }
        }

        false
    }

    /// Check if agent tier is allowed for this role
    fn is_agent_tier_allowed(&self, role: &Role, account_tier: AgentTier) -> bool {
        // NotAgent (human) is always allowed unless explicitly excluded
        if account_tier == AgentTier::NotAgent {
            // Check if NotAgent is in allowed_agent_tiers or if allowed_agent_tiers is empty
            // Empty means humans only
            return role.allowed_agent_tiers.is_empty()
                || role.allowed_agent_tiers.contains(&AgentTier::NotAgent);
        }

        // For AI agents, must be in allowed list
        role.allowed_agent_tiers.contains(&account_tier)
    }

    /// Check if role has sufficient clearance for the given classification
    ///
    /// Clearance hierarchy: Public < Secret < TopSecret
    /// A role with Secret clearance can access Public and Secret but not TopSecret
    fn has_sufficient_clearance(&self, role: &Role, required_classification: &Classification) -> bool {
        match role.required_clearance {
            None => {
                // Role has no clearance, can only access Public
                matches!(required_classification, Classification::Public)
            }
            Some(role_clearance) => {
                // Compare clearance levels
                self.clearance_level(role_clearance) >= self.clearance_level(*required_classification)
            }
        }
    }

    /// Convert classification to numeric level for comparison
    fn clearance_level(&self, classification: Classification) -> u8 {
        match classification {
            Classification::Public => 0,
            Classification::Secret => 1,
            Classification::TopSecret => 2,
        }
    }

    /// Check if a permission matches the requested proposal kind and action
    ///
    /// Wildcard matching:
    /// - "*" matches any value
    /// - "{kind}:*" matches any action for that proposal kind
    /// - "*:{action}" matches that action for any proposal kind
    /// - Exact match: "{kind}:{action}"
    pub fn matches_permission(
        &self,
        permission: &Permission,
        proposal_kind: &ProposalKind,
        action: Action,
    ) -> bool {
        // Convert proposal kind to string for matching
        let kind_str = proposal_kind.to_policy_label();
        let action_str = action.to_string();

        // Check proposal kind pattern
        let kind_matches = permission.proposal_kind_pattern == "*"
            || permission.proposal_kind_pattern == kind_str;

        // Check action pattern
        let action_matches =
            permission.action_pattern == "*" || permission.action_pattern == action_str;

        kind_matches && action_matches
    }

    /// Check clearance via CredentialRegistry
    ///
    /// In production, this would:
    /// 1. Derive blinded credential key from account
    /// 2. Query CredentialRegistry for valid SecurityClearance credential
    /// 3. Compare credential's classification level to required level
    ///
    /// NOTE: Actual clearance data is encrypted; this checks existence and validity
    /// of anchored credential. The classification level would be verified off-chain
    /// by the credential verifier.
    pub fn check_clearance(
        &self,
        _credential_registry: &CredentialRegistry,
        _account: &AccountId,
        _required_classification: &Classification,
        blinded_revocation_key: Option<Vec<u8>>,
    ) -> bool {
        // If no revocation key provided, assume no clearance
        let key = match blinded_revocation_key {
            Some(k) => k,
            None => return false,
        };

        // Check if credential is valid (exists, active, not expired)
        _credential_registry.is_valid(key)
    }

    /// Get maximum autonomy level for an account across all qualifying roles
    ///
    /// Returns the highest max_autonomy among roles that the account qualifies for.
    /// If account is an agent with tier higher than role's allowed tiers, skip that role.
    pub fn get_max_autonomy_for_account(
        &self,
        role_manager: &RoleManager,
        dao_id: &str,
        account: &AccountId,
    ) -> AutonomyLevel {
        let role_names = role_manager.get_member_roles(dao_id, account);
        let account_tier = role_manager.get_agent_tier(account);

        let mut max_autonomy = AutonomyLevel::NotAutonomous;

        for role_name in role_names {
            if let Some(role) = role_manager.get_role(dao_id, &role_name) {
                // Skip role if agent tier not allowed
                if !self.is_agent_tier_allowed(&role, account_tier) {
                    continue;
                }

                // Compare autonomy levels (higher is more autonomous)
                max_autonomy = self.max_autonomy_level(max_autonomy, role.max_autonomy);
            }
        }

        max_autonomy
    }

    /// Compare two autonomy levels and return the higher one
    fn max_autonomy_level(&self, a: AutonomyLevel, b: AutonomyLevel) -> AutonomyLevel {
        let level_a = self.autonomy_to_level(a);
        let level_b = self.autonomy_to_level(b);

        if level_a >= level_b {
            a
        } else {
            b
        }
    }

    /// Convert autonomy level to numeric for comparison
    fn autonomy_to_level(&self, level: AutonomyLevel) -> u8 {
        match level {
            AutonomyLevel::NotAutonomous => 0,
            AutonomyLevel::SemiAutonomous => 1,
            AutonomyLevel::Autonomous => 2,
        }
    }

    /// Convenience method to check if account can vote on a proposal
    ///
    /// Combines permission check with proposal classification check.
    /// Ensures account has clearance for proposal's classification level.
    pub fn can_vote_on_proposal(
        &self,
        role_manager: &RoleManager,
        credential_registry: &CredentialRegistry,
        dao_id: &str,
        account: &AccountId,
        proposal: &Proposal,
        action: Action,
    ) -> bool {
        // Must be a voting action
        if !matches!(
            action,
            Action::VoteApprove | Action::VoteReject | Action::VoteRemove
        ) {
            return false;
        }

        self.can_execute(
            role_manager,
            credential_registry,
            dao_id,
            account,
            &proposal.kind,
            action,
            &proposal.classification,
        )
    }
}

impl Default for PermissionChecker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dao::roles::{Permission, Role, RoleKind, RoleManager};
    use crate::privacy::Classification;
    use near_sdk::json_types::U128;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder.block_timestamp(1000000000);
        builder
    }

    fn setup_test_environment() -> (RoleManager, CredentialRegistry, PermissionChecker) {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let role_manager = RoleManager::new();
        let credential_registry = CredentialRegistry::new();
        let permission_checker = PermissionChecker::new();

        (role_manager, credential_registry, permission_checker)
    }

    // === Wildcard Matching Tests ===

    #[test]
    fn test_wildcard_all_matches_everything() {
        let checker = PermissionChecker::new();
        let permission = Permission::all(); // "*:*"

        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::Transfer,
            Action::VoteApprove
        ));
        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::ConfigChange,
            Action::Execute
        ));
        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::StrikeAuthorization,
            Action::AddProposal
        ));
    }

    #[test]
    fn test_wildcard_kind_matches_any_action() {
        let checker = PermissionChecker::new();
        let permission = Permission::new("transfer", "*");

        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::Transfer,
            Action::VoteApprove
        ));
        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::Transfer,
            Action::Execute
        ));
        assert!(!checker.matches_permission(
            &permission,
            &ProposalKind::ConfigChange,
            Action::VoteApprove
        ));
    }

    #[test]
    fn test_wildcard_action_matches_any_kind() {
        let checker = PermissionChecker::new();
        let permission = Permission::new("*", "VoteApprove");

        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::Transfer,
            Action::VoteApprove
        ));
        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::MissionOrder,
            Action::VoteApprove
        ));
        assert!(!checker.matches_permission(
            &permission,
            &ProposalKind::Transfer,
            Action::VoteReject
        ));
    }

    #[test]
    fn test_exact_match() {
        let checker = PermissionChecker::new();
        let permission = Permission::new("transfer", "VoteApprove");

        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::Transfer,
            Action::VoteApprove
        ));
        assert!(!checker.matches_permission(
            &permission,
            &ProposalKind::Transfer,
            Action::VoteReject
        ));
        assert!(!checker.matches_permission(
            &permission,
            &ProposalKind::ConfigChange,
            Action::VoteApprove
        ));
    }

    #[test]
    fn test_custom_proposal_kind_matching() {
        let checker = PermissionChecker::new();
        let permission = Permission::new("custom:emergency", "*");

        assert!(checker.matches_permission(
            &permission,
            &ProposalKind::Custom("emergency".to_string()),
            Action::Execute
        ));
        assert!(!checker.matches_permission(
            &permission,
            &ProposalKind::Custom("routine".to_string()),
            Action::Execute
        ));
    }

    // === Clearance Hierarchy Tests ===

    #[test]
    fn test_clearance_hierarchy_public() {
        let checker = PermissionChecker::new();

        // Role with no clearance can only access Public
        let role_no_clearance = Role {
            name: "basic".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![],
            max_autonomy: AutonomyLevel::NotAutonomous,
        };

        assert!(checker.has_sufficient_clearance(&role_no_clearance, &Classification::Public));
        assert!(!checker.has_sufficient_clearance(&role_no_clearance, &Classification::Secret));
        assert!(!checker.has_sufficient_clearance(&role_no_clearance, &Classification::TopSecret));
    }

    #[test]
    fn test_clearance_hierarchy_secret() {
        let checker = PermissionChecker::new();

        let role_secret = Role {
            name: "secret".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: Some(Classification::Secret),
            allowed_agent_tiers: vec![],
            max_autonomy: AutonomyLevel::NotAutonomous,
        };

        // Secret clearance can access Public and Secret
        assert!(checker.has_sufficient_clearance(&role_secret, &Classification::Public));
        assert!(checker.has_sufficient_clearance(&role_secret, &Classification::Secret));
        // But not TopSecret
        assert!(!checker.has_sufficient_clearance(&role_secret, &Classification::TopSecret));
    }

    #[test]
    fn test_clearance_hierarchy_topsecret() {
        let checker = PermissionChecker::new();

        let role_ts = Role {
            name: "topsecret".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: Some(Classification::TopSecret),
            allowed_agent_tiers: vec![],
            max_autonomy: AutonomyLevel::NotAutonomous,
        };

        // TopSecret clearance can access all levels
        assert!(checker.has_sufficient_clearance(&role_ts, &Classification::Public));
        assert!(checker.has_sufficient_clearance(&role_ts, &Classification::Secret));
        assert!(checker.has_sufficient_clearance(&role_ts, &Classification::TopSecret));
    }

    // === Agent Tier Restriction Tests ===

    #[test]
    fn test_agent_tier_humans_only_role() {
        let checker = PermissionChecker::new();

        // Empty allowed_agent_tiers = humans only
        let role = Role {
            name: "council".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![], // Humans only
            max_autonomy: AutonomyLevel::NotAutonomous,
        };

        // Human (NotAgent) is allowed
        assert!(checker.is_agent_tier_allowed(&role, AgentTier::NotAgent));
        // AI agents are not allowed
        assert!(!checker.is_agent_tier_allowed(&role, AgentTier::SupportAgent));
        assert!(!checker.is_agent_tier_allowed(&role, AgentTier::RepresentAgent));
        assert!(!checker.is_agent_tier_allowed(&role, AgentTier::OrganizeAgent));
    }

    #[test]
    fn test_agent_tier_support_agent_allowed() {
        let checker = PermissionChecker::new();

        let role = Role {
            name: "agent".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::SupportAgent],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        };

        // SupportAgent is allowed
        assert!(checker.is_agent_tier_allowed(&role, AgentTier::SupportAgent));
        // Higher tiers are not allowed (must be explicitly listed)
        assert!(!checker.is_agent_tier_allowed(&role, AgentTier::RepresentAgent));
        assert!(!checker.is_agent_tier_allowed(&role, AgentTier::OrganizeAgent));
        // Human is not allowed (not in allowed_agent_tiers)
        assert!(!checker.is_agent_tier_allowed(&role, AgentTier::NotAgent));
    }

    #[test]
    fn test_agent_tier_mixed_allowed() {
        let checker = PermissionChecker::new();

        let role = Role {
            name: "mixed".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![
                AgentTier::NotAgent,
                AgentTier::SupportAgent,
                AgentTier::RepresentAgent,
            ],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        };

        assert!(checker.is_agent_tier_allowed(&role, AgentTier::NotAgent));
        assert!(checker.is_agent_tier_allowed(&role, AgentTier::SupportAgent));
        assert!(checker.is_agent_tier_allowed(&role, AgentTier::RepresentAgent));
        assert!(!checker.is_agent_tier_allowed(&role, AgentTier::OrganizeAgent));
    }

    // === Max Autonomy Tests ===

    #[test]
    fn test_max_autonomy_single_role() {
        let (mut role_manager, _, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        // Create role with SemiAutonomous
        let role = Role {
            name: "operator".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::NotAgent],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        };
        role_manager.create_role(dao_id, role);
        role_manager.assign_role(dao_id, &account, "operator");

        let max = checker.get_max_autonomy_for_account(&role_manager, dao_id, &account);
        assert_eq!(max, AutonomyLevel::SemiAutonomous);
    }

    #[test]
    fn test_max_autonomy_multiple_roles_takes_highest() {
        let (mut role_manager, _, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        // Create role with NotAutonomous
        let role1 = Role {
            name: "basic".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::NotAgent],
            max_autonomy: AutonomyLevel::NotAutonomous,
        };
        role_manager.create_role(dao_id, role1);

        // Create role with Autonomous
        let role2 = Role {
            name: "admin".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::NotAgent],
            max_autonomy: AutonomyLevel::Autonomous,
        };
        role_manager.create_role(dao_id, role2);

        role_manager.assign_role(dao_id, &account, "basic");
        role_manager.assign_role(dao_id, &account, "admin");

        let max = checker.get_max_autonomy_for_account(&role_manager, dao_id, &account);
        assert_eq!(max, AutonomyLevel::Autonomous);
    }

    #[test]
    fn test_max_autonomy_skips_disallowed_tier() {
        let (mut role_manager, _, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let agent: AccountId = "agent.near".parse().unwrap();

        // Register as SupportAgent
        role_manager.register_agent(&agent, AgentTier::SupportAgent);

        // Create role that only allows humans (high autonomy)
        let role1 = Role {
            name: "human_admin".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![], // Humans only
            max_autonomy: AutonomyLevel::Autonomous,
        };
        role_manager.create_role(dao_id, role1);

        // Create role that allows SupportAgent (lower autonomy)
        let role2 = Role {
            name: "agent_helper".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::SupportAgent],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        };
        role_manager.create_role(dao_id, role2);

        role_manager.assign_role(dao_id, &agent, "human_admin");
        role_manager.assign_role(dao_id, &agent, "agent_helper");

        // Agent should only get SemiAutonomous from agent_helper
        // human_admin is skipped because it doesn't allow SupportAgent
        let max = checker.get_max_autonomy_for_account(&role_manager, dao_id, &agent);
        assert_eq!(max, AutonomyLevel::SemiAutonomous);
    }

    // === Integrated Permission Check Tests ===

    #[test]
    fn test_can_execute_with_valid_permission() {
        let (mut role_manager, credential_registry, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        // Create role with Transfer:VoteApprove permission
        let role = Role {
            name: "voter".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::new("transfer", "VoteApprove")],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::NotAgent],
            max_autonomy: AutonomyLevel::NotAutonomous,
        };
        role_manager.create_role(dao_id, role);
        role_manager.assign_role(dao_id, &account, "voter");

        // Should be able to VoteApprove on Transfer proposals
        assert!(checker.can_execute(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &ProposalKind::Transfer,
            Action::VoteApprove,
            &Classification::Public,
        ));

        // Should NOT be able to Execute
        assert!(!checker.can_execute(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &ProposalKind::Transfer,
            Action::Execute,
            &Classification::Public,
        ));

        // Should NOT be able to vote on ConfigChange
        assert!(!checker.can_execute(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &ProposalKind::ConfigChange,
            Action::VoteApprove,
            &Classification::Public,
        ));
    }

    #[test]
    fn test_can_execute_blocked_by_clearance() {
        let (mut role_manager, credential_registry, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        // Create role with no clearance
        let role = Role {
            name: "basic".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None, // No clearance
            allowed_agent_tiers: vec![AgentTier::NotAgent],
            max_autonomy: AutonomyLevel::NotAutonomous,
        };
        role_manager.create_role(dao_id, role);
        role_manager.assign_role(dao_id, &account, "basic");

        // Can access Public proposals
        assert!(checker.can_execute(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &ProposalKind::Transfer,
            Action::VoteApprove,
            &Classification::Public,
        ));

        // Cannot access Secret proposals
        assert!(!checker.can_execute(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &ProposalKind::Transfer,
            Action::VoteApprove,
            &Classification::Secret,
        ));
    }

    #[test]
    fn test_can_execute_blocked_by_agent_tier() {
        let (mut role_manager, credential_registry, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let agent: AccountId = "agent.near".parse().unwrap();

        // Register as OrganizeAgent
        role_manager.register_agent(&agent, AgentTier::OrganizeAgent);

        // Create role that only allows SupportAgent
        let role = Role {
            name: "support_only".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::SupportAgent],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        };
        role_manager.create_role(dao_id, role);
        role_manager.assign_role(dao_id, &agent, "support_only");

        // OrganizeAgent cannot use SupportAgent-only role
        assert!(!checker.can_execute(
            &role_manager,
            &credential_registry,
            dao_id,
            &agent,
            &ProposalKind::Transfer,
            Action::VoteApprove,
            &Classification::Public,
        ));
    }

    #[test]
    fn test_can_execute_no_roles() {
        let (role_manager, credential_registry, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let account: AccountId = "nobody.near".parse().unwrap();

        // Account has no roles
        assert!(!checker.can_execute(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &ProposalKind::Transfer,
            Action::VoteApprove,
            &Classification::Public,
        ));
    }

    #[test]
    fn test_can_vote_on_proposal() {
        let (mut role_manager, credential_registry, checker) = setup_test_environment();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        role_manager.create_default_roles(dao_id);
        role_manager.assign_role(dao_id, &account, "member");

        let proposal = Proposal {
            id: 1,
            kind: ProposalKind::Transfer,
            proposer: "alice.near".parse().unwrap(),
            description: "Transfer funds".to_string(),
            classification: Classification::Public,
            autonomy_override: None,
            status: crate::dao::types::ProposalStatus::InProgress,
            votes_approve: 0,
            votes_reject: 0,
            created_at: 0,
            voting_deadline: 0,
            execution_result: None,
        };

        // Should be able to vote
        assert!(checker.can_vote_on_proposal(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &proposal,
            Action::VoteApprove,
        ));

        // Should NOT be able to execute (not a voting action)
        assert!(!checker.can_vote_on_proposal(
            &role_manager,
            &credential_registry,
            dao_id,
            &account,
            &proposal,
            Action::Execute,
        ));
    }

    // === Credential Check Tests ===

    #[test]
    fn test_check_clearance_no_key() {
        let (_, credential_registry, checker) = setup_test_environment();
        let account: AccountId = "bob.near".parse().unwrap();

        // No revocation key = no clearance
        assert!(!checker.check_clearance(
            &credential_registry,
            &account,
            &Classification::Secret,
            None,
        ));
    }

    #[test]
    fn test_check_clearance_invalid_key() {
        let (_, credential_registry, checker) = setup_test_environment();
        let account: AccountId = "bob.near".parse().unwrap();

        // Invalid key = no clearance
        let fake_key = vec![42u8; 32];
        assert!(!checker.check_clearance(
            &credential_registry,
            &account,
            &Classification::Secret,
            Some(fake_key),
        ));
    }

    #[test]
    fn test_check_clearance_with_valid_credential() {
        let context = get_context("issuer.near".parse().unwrap());
        testing_env!(context.build());

        let mut credential_registry = CredentialRegistry::new();
        let checker = PermissionChecker::new();
        let account: AccountId = "bob.near".parse().unwrap();

        // Anchor a credential
        let credential_id = vec![1u8; 32];
        let revocation_key = vec![2u8; 32];

        credential_registry.anchor_credential(
            credential_id,
            revocation_key.clone(),
            vec![0u8; 32], // credential hash
            vec![0u8; 10], // encrypted metadata
            vec![0u8; 24], // nonce
            None,          // no expiration
        );

        // Valid key should pass
        assert!(checker.check_clearance(
            &credential_registry,
            &account,
            &Classification::Secret,
            Some(revocation_key),
        ));
    }

    // === Member Role Balance Tests ===

    #[test]
    fn test_role_kind_member_with_balance() {
        let checker = PermissionChecker::new();

        let role = Role {
            name: "staker".to_string(),
            kind: RoleKind::Member {
                min_balance: U128(1_000_000),
            },
            permissions: vec![Permission::all()],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::NotAgent],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        };

        // Role should allow NotAgent
        assert!(checker.is_agent_tier_allowed(&role, AgentTier::NotAgent));
    }

    // === Default Checker Tests ===

    #[test]
    fn test_permission_checker_default() {
        let checker1 = PermissionChecker::new();
        let checker2 = PermissionChecker::default();

        // Both should work identically
        let permission = Permission::all();
        assert!(checker1.matches_permission(&permission, &ProposalKind::Transfer, Action::Execute));
        assert!(checker2.matches_permission(&permission, &ProposalKind::Transfer, Action::Execute));
    }
}
