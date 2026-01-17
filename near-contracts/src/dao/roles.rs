/**
 * DAO Role Management
 *
 * Provides role-based access control with:
 * - Role kinds: Everyone, Member, Group
 * - Agent tiers: NotAgent (human), SupportAgent, RepresentAgent, OrganizeAgent
 * - Clearance requirements integration with Classification
 * - Maximum autonomy levels per role
 *
 * Key design:
 * - Roles are DAO-scoped using composite keys (dao_id:role_name)
 * - AI agents have bounded participation based on trust tiers
 * - Roles can require minimum security clearance level
 */

use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{env, log, near, AccountId, BorshStorageKey};

use crate::privacy::Classification;

use super::types::AutonomyLevel;

/// Storage keys for role collections
#[derive(BorshStorageKey)]
#[near]
pub enum RoleStorageKey {
    /// Role definitions: (dao_id, role_name) -> Role
    Roles,
    /// Member role assignments: (dao_id, account) -> role names
    MemberRoles,
    /// Agent registry: account -> AgentTier
    AgentRegistry,
}

/// Actions that can be performed on proposals
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Action {
    /// Submit a new proposal
    AddProposal,
    /// Vote to approve a proposal
    VoteApprove,
    /// Vote to reject a proposal
    VoteReject,
    /// Vote to remove a proposal (spam/invalid)
    VoteRemove,
    /// Finalize a proposal after voting ends
    Finalize,
    /// Execute an approved proposal
    Execute,
}

impl Action {
    /// Convert to string for permission matching
    pub fn to_string(&self) -> String {
        match self {
            Action::AddProposal => "AddProposal".to_string(),
            Action::VoteApprove => "VoteApprove".to_string(),
            Action::VoteReject => "VoteReject".to_string(),
            Action::VoteRemove => "VoteRemove".to_string(),
            Action::Finalize => "Finalize".to_string(),
            Action::Execute => "Execute".to_string(),
        }
    }
}

/// AI agent trust tiers
///
/// Determines what level of autonomous action an AI agent can take.
/// NotAgent indicates a human account (no restrictions based on agent tier).
#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, PartialOrd, Ord)]
pub enum AgentTier {
    /// Not an AI agent - human account (default, least restricted)
    #[default]
    NotAgent,
    /// Support agent - limited to information retrieval and basic assistance
    SupportAgent,
    /// Represent agent - can act on behalf of users with explicit delegation
    RepresentAgent,
    /// Organize agent - can coordinate multi-party actions and workflows
    OrganizeAgent,
}

/// Role membership kind following SputnikDAO v2 patterns
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub enum RoleKind {
    /// Anyone can hold this role
    Everyone,
    /// Requires minimum token balance
    Member { min_balance: U128 },
    /// Explicit group membership
    Group { members: Vec<AccountId> },
}

/// Permission for a specific proposal kind and action
///
/// Supports wildcard matching with "*":
/// - "*:*" matches all proposal kinds and actions
/// - "Transfer:*" matches any action on Transfer proposals
/// - "*:VoteApprove" matches VoteApprove on any proposal kind
/// - "Transfer:VoteApprove" matches exactly Transfer proposals and VoteApprove action
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Permission {
    /// Proposal kind pattern (supports "*" wildcard)
    pub proposal_kind_pattern: String,
    /// Action pattern (supports "*" wildcard)
    pub action_pattern: String,
}

impl Permission {
    /// Create a new permission with explicit patterns
    pub fn new(proposal_kind_pattern: &str, action_pattern: &str) -> Self {
        Self {
            proposal_kind_pattern: proposal_kind_pattern.to_string(),
            action_pattern: action_pattern.to_string(),
        }
    }

    /// Create a wildcard permission that matches everything
    pub fn all() -> Self {
        Self {
            proposal_kind_pattern: "*".to_string(),
            action_pattern: "*".to_string(),
        }
    }
}

/// Role definition with clearance and agent tier restrictions
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Role {
    /// Role name (unique within DAO)
    pub name: String,
    /// Kind of membership (Everyone, Member, Group)
    pub kind: RoleKind,
    /// Permissions granted by this role
    pub permissions: Vec<Permission>,
    /// Minimum security clearance required to hold this role
    /// None = no clearance required
    pub required_clearance: Option<Classification>,
    /// Agent tiers allowed to hold this role
    /// Empty = humans only (NotAgent accounts)
    pub allowed_agent_tiers: Vec<AgentTier>,
    /// Maximum autonomy level for actions taken with this role
    pub max_autonomy: AutonomyLevel,
}

impl Role {
    /// Create a council role (full permissions, humans only)
    pub fn council() -> Self {
        Self {
            name: "council".to_string(),
            kind: RoleKind::Group { members: vec![] },
            permissions: vec![Permission::all()],
            required_clearance: Some(Classification::Secret),
            allowed_agent_tiers: vec![], // Humans only
            max_autonomy: AutonomyLevel::NotAutonomous,
        }
    }

    /// Create a member role (basic voting, no clearance)
    pub fn member() -> Self {
        Self {
            name: "member".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![
                Permission::new("*", "AddProposal"),
                Permission::new("*", "VoteApprove"),
                Permission::new("*", "VoteReject"),
            ],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::NotAgent],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        }
    }

    /// Create an agent role (limited permissions, allows SupportAgent)
    pub fn agent() -> Self {
        Self {
            name: "agent".to_string(),
            kind: RoleKind::Everyone,
            permissions: vec![
                Permission::new("*", "AddProposal"),
            ],
            required_clearance: None,
            allowed_agent_tiers: vec![AgentTier::SupportAgent],
            max_autonomy: AutonomyLevel::SemiAutonomous,
        }
    }
}

/// Role manager for DAO role management
///
/// Handles role CRUD operations and member role assignments.
/// Uses composite string keys (dao_id:role_name) for storage.
#[near(serializers = [borsh])]
pub struct RoleManager {
    /// Role definitions: composite key "dao_id:role_name" -> Role
    roles: LookupMap<String, Role>,
    /// Member role assignments: composite key "dao_id:account" -> Vec<role_name>
    member_roles: LookupMap<String, Vec<String>>,
    /// Agent registry: account -> AgentTier
    agent_registry: LookupMap<AccountId, AgentTier>,
    /// Track role names per DAO for listing: dao_id -> Vec<role_name>
    dao_role_names: LookupMap<String, Vec<String>>,
}

impl RoleManager {
    /// Initialize new RoleManager
    pub fn new() -> Self {
        Self {
            roles: LookupMap::new(RoleStorageKey::Roles),
            member_roles: LookupMap::new(RoleStorageKey::MemberRoles),
            agent_registry: LookupMap::new(RoleStorageKey::AgentRegistry),
            dao_role_names: LookupMap::new(b"dao_role_names".to_vec()),
        }
    }

    // === Role CRUD Operations ===

    /// Create a new role in a DAO
    ///
    /// # Panics
    /// - If role with same name already exists in this DAO
    pub fn create_role(&mut self, dao_id: &str, role: Role) {
        let key = Self::role_key(dao_id, &role.name);

        assert!(
            !self.roles.contains_key(&key),
            "Role '{}' already exists in DAO '{}'",
            role.name,
            dao_id
        );

        // Track role name for listing
        let mut role_names = self.dao_role_names.get(dao_id).cloned().unwrap_or_default();
        role_names.push(role.name.clone());
        self.dao_role_names.insert(dao_id.to_string(), role_names);

        // Store role
        self.roles.insert(key, role.clone());

        log!(
            "ROLE_CREATED: {{\"dao_id\": \"{}\", \"role\": \"{}\"}}",
            dao_id,
            role.name
        );
    }

    /// Get a role by DAO ID and role name
    pub fn get_role(&self, dao_id: &str, role_name: &str) -> Option<Role> {
        let key = Self::role_key(dao_id, role_name);
        self.roles.get(&key).cloned()
    }

    /// List all roles in a DAO
    pub fn list_roles(&self, dao_id: &str) -> Vec<Role> {
        let role_names = self.dao_role_names.get(dao_id).cloned().unwrap_or_default();
        role_names
            .iter()
            .filter_map(|name| self.get_role(dao_id, name))
            .collect()
    }

    /// Update an existing role
    ///
    /// # Panics
    /// - If role doesn't exist
    pub fn update_role(&mut self, dao_id: &str, role: Role) {
        let key = Self::role_key(dao_id, &role.name);

        assert!(
            self.roles.contains_key(&key),
            "Role '{}' does not exist in DAO '{}'",
            role.name,
            dao_id
        );

        self.roles.insert(key, role.clone());

        log!(
            "ROLE_UPDATED: {{\"dao_id\": \"{}\", \"role\": \"{}\"}}",
            dao_id,
            role.name
        );
    }

    /// Delete a role from a DAO
    ///
    /// # Panics
    /// - If role doesn't exist
    pub fn delete_role(&mut self, dao_id: &str, role_name: &str) {
        let key = Self::role_key(dao_id, role_name);

        assert!(
            self.roles.contains_key(&key),
            "Role '{}' does not exist in DAO '{}'",
            role_name,
            dao_id
        );

        self.roles.remove(&key);

        // Remove from role names list
        if let Some(mut role_names) = self.dao_role_names.get(dao_id).cloned() {
            role_names.retain(|n| n != role_name);
            self.dao_role_names.insert(dao_id.to_string(), role_names);
        }

        log!(
            "ROLE_DELETED: {{\"dao_id\": \"{}\", \"role\": \"{}\"}}",
            dao_id,
            role_name
        );
    }

    // === Member Role Management ===

    /// Assign a role to an account in a DAO
    ///
    /// # Panics
    /// - If role doesn't exist
    /// - If account already has this role
    pub fn assign_role(&mut self, dao_id: &str, account: &AccountId, role_name: &str) {
        // Verify role exists
        let role_key = Self::role_key(dao_id, role_name);
        assert!(
            self.roles.contains_key(&role_key),
            "Role '{}' does not exist in DAO '{}'",
            role_name,
            dao_id
        );

        let member_key = Self::member_key(dao_id, account);
        let mut roles = self.member_roles.get(&member_key).cloned().unwrap_or_default();

        assert!(
            !roles.contains(&role_name.to_string()),
            "Account '{}' already has role '{}' in DAO '{}'",
            account,
            role_name,
            dao_id
        );

        roles.push(role_name.to_string());
        self.member_roles.insert(member_key, roles);

        log!(
            "ROLE_ASSIGNED: {{\"dao_id\": \"{}\", \"account\": \"{}\", \"role\": \"{}\"}}",
            dao_id,
            account,
            role_name
        );
    }

    /// Remove a role from an account in a DAO
    ///
    /// # Panics
    /// - If account doesn't have this role
    pub fn remove_role(&mut self, dao_id: &str, account: &AccountId, role_name: &str) {
        let member_key = Self::member_key(dao_id, account);
        let mut roles = self.member_roles.get(&member_key).cloned().unwrap_or_default();

        let original_len = roles.len();
        roles.retain(|r| r != role_name);

        assert!(
            roles.len() < original_len,
            "Account '{}' does not have role '{}' in DAO '{}'",
            account,
            role_name,
            dao_id
        );

        self.member_roles.insert(member_key, roles);

        log!(
            "ROLE_REMOVED: {{\"dao_id\": \"{}\", \"account\": \"{}\", \"role\": \"{}\"}}",
            dao_id,
            account,
            role_name
        );
    }

    /// Get all role names for an account in a DAO
    pub fn get_member_roles(&self, dao_id: &str, account: &AccountId) -> Vec<String> {
        let member_key = Self::member_key(dao_id, account);
        self.member_roles.get(&member_key).cloned().unwrap_or_default()
    }

    // === Agent Registry ===

    /// Register an account as an AI agent with a specific tier
    pub fn register_agent(&mut self, account: &AccountId, tier: AgentTier) {
        self.agent_registry.insert(account.clone(), tier);

        log!(
            "AGENT_REGISTERED: {{\"account\": \"{}\", \"tier\": \"{:?}\"}}",
            account,
            tier
        );
    }

    /// Unregister an AI agent (revert to NotAgent/human)
    pub fn unregister_agent(&mut self, account: &AccountId) {
        self.agent_registry.remove(account);

        log!(
            "AGENT_UNREGISTERED: {{\"account\": \"{}\"}}",
            account
        );
    }

    /// Get the agent tier for an account
    /// Returns NotAgent (human) if not registered as agent
    pub fn get_agent_tier(&self, account: &AccountId) -> AgentTier {
        self.agent_registry
            .get(account)
            .copied()
            .unwrap_or(AgentTier::NotAgent)
    }

    /// Check if an account is registered as an AI agent
    pub fn is_agent(&self, account: &AccountId) -> bool {
        matches!(
            self.get_agent_tier(account),
            AgentTier::SupportAgent | AgentTier::RepresentAgent | AgentTier::OrganizeAgent
        )
    }

    // === Default Roles ===

    /// Create default roles for a new DAO
    pub fn create_default_roles(&mut self, dao_id: &str) {
        self.create_role(dao_id, Role::council());
        self.create_role(dao_id, Role::member());
        self.create_role(dao_id, Role::agent());
    }

    // === Helper Functions ===

    /// Create composite key for role storage
    fn role_key(dao_id: &str, role_name: &str) -> String {
        format!("{}:{}", dao_id, role_name)
    }

    /// Create composite key for member role storage
    fn member_key(dao_id: &str, account: &AccountId) -> String {
        format!("{}:{}", dao_id, account)
    }
}

impl Default for RoleManager {
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
        builder
    }

    #[test]
    fn test_create_role() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";

        manager.create_role(dao_id, Role::council());

        let role = manager.get_role(dao_id, "council").unwrap();
        assert_eq!(role.name, "council");
        assert!(matches!(role.kind, RoleKind::Group { .. }));
    }

    #[test]
    #[should_panic(expected = "Role 'council' already exists")]
    fn test_create_duplicate_role_fails() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";

        manager.create_role(dao_id, Role::council());
        manager.create_role(dao_id, Role::council()); // Should panic
    }

    #[test]
    fn test_list_roles() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";

        manager.create_default_roles(dao_id);

        let roles = manager.list_roles(dao_id);
        assert_eq!(roles.len(), 3);

        let names: Vec<String> = roles.iter().map(|r| r.name.clone()).collect();
        assert!(names.contains(&"council".to_string()));
        assert!(names.contains(&"member".to_string()));
        assert!(names.contains(&"agent".to_string()));
    }

    #[test]
    fn test_update_role() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";

        manager.create_role(dao_id, Role::council());

        // Update to remove clearance requirement
        let mut updated = Role::council();
        updated.required_clearance = None;
        manager.update_role(dao_id, updated);

        let role = manager.get_role(dao_id, "council").unwrap();
        assert!(role.required_clearance.is_none());
    }

    #[test]
    fn test_delete_role() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";

        manager.create_role(dao_id, Role::council());
        assert!(manager.get_role(dao_id, "council").is_some());

        manager.delete_role(dao_id, "council");
        assert!(manager.get_role(dao_id, "council").is_none());
    }

    #[test]
    fn test_assign_and_remove_role() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        manager.create_role(dao_id, Role::member());
        manager.assign_role(dao_id, &account, "member");

        let roles = manager.get_member_roles(dao_id, &account);
        assert_eq!(roles.len(), 1);
        assert_eq!(roles[0], "member");

        manager.remove_role(dao_id, &account, "member");
        let roles = manager.get_member_roles(dao_id, &account);
        assert!(roles.is_empty());
    }

    #[test]
    #[should_panic(expected = "Role 'nonexistent' does not exist")]
    fn test_assign_nonexistent_role_fails() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        manager.assign_role(dao_id, &account, "nonexistent");
    }

    #[test]
    #[should_panic(expected = "already has role")]
    fn test_assign_duplicate_role_fails() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        manager.create_role(dao_id, Role::member());
        manager.assign_role(dao_id, &account, "member");
        manager.assign_role(dao_id, &account, "member"); // Should panic
    }

    #[test]
    fn test_agent_registry() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let agent: AccountId = "agent-1.near".parse().unwrap();
        let human: AccountId = "human.near".parse().unwrap();

        // Not registered = NotAgent (human)
        assert_eq!(manager.get_agent_tier(&agent), AgentTier::NotAgent);
        assert!(!manager.is_agent(&agent));

        // Register as SupportAgent
        manager.register_agent(&agent, AgentTier::SupportAgent);
        assert_eq!(manager.get_agent_tier(&agent), AgentTier::SupportAgent);
        assert!(manager.is_agent(&agent));

        // Human remains NotAgent
        assert_eq!(manager.get_agent_tier(&human), AgentTier::NotAgent);
        assert!(!manager.is_agent(&human));

        // Unregister
        manager.unregister_agent(&agent);
        assert_eq!(manager.get_agent_tier(&agent), AgentTier::NotAgent);
        assert!(!manager.is_agent(&agent));
    }

    #[test]
    fn test_agent_tier_ordering() {
        // Verify tier ordering for permission checks
        assert!(AgentTier::NotAgent < AgentTier::SupportAgent);
        assert!(AgentTier::SupportAgent < AgentTier::RepresentAgent);
        assert!(AgentTier::RepresentAgent < AgentTier::OrganizeAgent);
    }

    #[test]
    fn test_action_to_string() {
        assert_eq!(Action::AddProposal.to_string(), "AddProposal");
        assert_eq!(Action::VoteApprove.to_string(), "VoteApprove");
        assert_eq!(Action::VoteReject.to_string(), "VoteReject");
        assert_eq!(Action::VoteRemove.to_string(), "VoteRemove");
        assert_eq!(Action::Finalize.to_string(), "Finalize");
        assert_eq!(Action::Execute.to_string(), "Execute");
    }

    #[test]
    fn test_permission_creation() {
        let perm = Permission::new("Transfer", "VoteApprove");
        assert_eq!(perm.proposal_kind_pattern, "Transfer");
        assert_eq!(perm.action_pattern, "VoteApprove");

        let all_perm = Permission::all();
        assert_eq!(all_perm.proposal_kind_pattern, "*");
        assert_eq!(all_perm.action_pattern, "*");
    }

    #[test]
    fn test_default_roles_structure() {
        // Council: full permissions, requires clearance, humans only
        let council = Role::council();
        assert_eq!(council.name, "council");
        assert_eq!(council.permissions.len(), 1);
        assert!(council.required_clearance.is_some());
        assert!(council.allowed_agent_tiers.is_empty());
        assert_eq!(council.max_autonomy, AutonomyLevel::NotAutonomous);

        // Member: basic voting, no clearance
        let member = Role::member();
        assert_eq!(member.name, "member");
        assert_eq!(member.permissions.len(), 3);
        assert!(member.required_clearance.is_none());
        assert!(member.allowed_agent_tiers.contains(&AgentTier::NotAgent));
        assert_eq!(member.max_autonomy, AutonomyLevel::SemiAutonomous);

        // Agent: limited permissions, allows SupportAgent
        let agent = Role::agent();
        assert_eq!(agent.name, "agent");
        assert_eq!(agent.permissions.len(), 1);
        assert!(agent.required_clearance.is_none());
        assert!(agent.allowed_agent_tiers.contains(&AgentTier::SupportAgent));
    }

    #[test]
    fn test_role_kind_variants() {
        let everyone = RoleKind::Everyone;
        assert!(matches!(everyone, RoleKind::Everyone));

        let member = RoleKind::Member { min_balance: U128(1000) };
        if let RoleKind::Member { min_balance } = member {
            assert_eq!(min_balance.0, 1000);
        } else {
            panic!("Expected Member variant");
        }

        let group = RoleKind::Group { members: vec!["alice.near".parse().unwrap()] };
        if let RoleKind::Group { members } = group {
            assert_eq!(members.len(), 1);
        } else {
            panic!("Expected Group variant");
        }
    }

    #[test]
    fn test_multiple_roles_per_member() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao_id = "test-dao";
        let account: AccountId = "bob.near".parse().unwrap();

        manager.create_default_roles(dao_id);
        manager.assign_role(dao_id, &account, "member");
        manager.assign_role(dao_id, &account, "council");

        let roles = manager.get_member_roles(dao_id, &account);
        assert_eq!(roles.len(), 2);
        assert!(roles.contains(&"member".to_string()));
        assert!(roles.contains(&"council".to_string()));
    }

    #[test]
    fn test_roles_isolated_between_daos() {
        let context = get_context("alice.near".parse().unwrap());
        testing_env!(context.build());

        let mut manager = RoleManager::new();
        let dao1 = "dao-1";
        let dao2 = "dao-2";
        let account: AccountId = "bob.near".parse().unwrap();

        manager.create_default_roles(dao1);
        manager.create_default_roles(dao2);

        manager.assign_role(dao1, &account, "council");

        // Account has council role in dao1
        assert!(manager.get_member_roles(dao1, &account).contains(&"council".to_string()));
        // But not in dao2
        assert!(!manager.get_member_roles(dao2, &account).contains(&"council".to_string()));
    }
}
