---
phase: 03-dao-governance
plan: 02
type: execute
---

<objective>
Create role and permission system with clearance integration and AI participation tiers.

Purpose: Enable fine-grained access control where roles can require security clearances and AI agents have bounded participation based on trust tiers.
Output: Role definitions, permission matching with wildcards, clearance verification via CredentialRegistry, AI trust tier enforcement.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-dao-governance/3-RESEARCH.md
@.planning/phases/03-dao-governance/3-CONTEXT.md
@.planning/phases/02-identity-security-framework/2-01-SUMMARY.md
@.planning/phases/02-identity-security-framework/2-02-SUMMARY.md
@near-contracts/src/dao/mod.rs
@near-contracts/src/credential_registry.rs
@near-contracts/src/privacy.rs

**Tech stack available:**
- DAO core types from 3-01 (AutonomyLevel, ProposalKind)
- CredentialRegistry for clearance verification
- Classification enum from privacy.rs
- Blinded key lookup patterns

**Established patterns from research:**
- SputnikDAO v2 role patterns: RoleKind (Everyone, Member, Group)
- Permission wildcards: "Transfer:VoteApprove", "*:*", "Transfer:*"
- Clearance checks before permission matching

**Key decisions:**
- AI agents have trust tiers mapped to autonomy levels
- Support agents → SemiAutonomous or NotAutonomous
- Roles can require minimum clearance level
- Permission format: "{ProposalKind}:{Action}"
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create role definitions with clearance and AI tier integration</name>
  <files>near-contracts/src/dao/roles.rs, near-contracts/src/dao/mod.rs</files>
  <action>
Create roles.rs with role management:

**Enums:**
- `RoleKind` enum: Everyone, Member { min_balance: U128 }, Group { members: Vec<AccountId> }
- `AgentTier` enum: NotAgent (human), SupportAgent, RepresentAgent, OrganizeAgent
- `Action` enum: AddProposal, VoteApprove, VoteReject, VoteRemove, Finalize, Execute

**Structs:**
- `Permission` struct: proposal_kind_pattern (String - supports "*"), action_pattern (String - supports "*")
- `Role` struct:
  - name: String
  - kind: RoleKind
  - permissions: Vec<Permission>
  - required_clearance: Option<Classification> - minimum clearance to hold this role
  - allowed_agent_tiers: Vec<AgentTier> - which agent types can hold this role (empty = humans only)
  - max_autonomy: AutonomyLevel - maximum autonomy level members can use

**RoleManager struct:**
- roles: LookupMap<(String, String), Role> - (dao_id, role_name) → Role
- member_roles: LookupMap<(String, AccountId), Vec<String>> - (dao_id, account) → role names
- agent_registry: LookupMap<AccountId, AgentTier> - account → agent tier (None = human)

**Methods:**
- `new()` constructor
- `create_role(dao_id, role)` - creates new role in DAO
- `get_role(dao_id, role_name)` → Option<Role>
- `list_roles(dao_id)` → Vec<Role>
- `assign_role(dao_id, account, role_name)` - assigns role to account
- `remove_role(dao_id, account, role_name)` - removes role from account
- `get_member_roles(dao_id, account)` → Vec<String>
- `register_agent(account, tier)` - registers an account as an AI agent with tier
- `get_agent_tier(account)` → AgentTier (defaults to NotAgent)
- `is_agent(account)` → bool

**Default roles to create for new DAOs:**
- "council" - full permissions, requires clearance, humans only
- "member" - basic voting, no clearance required
- "agent" - limited permissions, allows SupportAgent tier

Update mod.rs to export all role types.
  </action>
  <verify>cargo build --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>RoleManager with role CRUD, agent registry, clearance requirements on roles</done>
</task>

<task type="auto">
  <name>Task 2: Implement permission matching with wildcards and clearance verification</name>
  <files>near-contracts/src/dao/permissions.rs, near-contracts/src/dao/mod.rs</files>
  <action>
Create permissions.rs with permission evaluation logic:

**PermissionChecker struct:**
- role_manager: reference to RoleManager
- credential_registry: reference to CredentialRegistry (for clearance checks)

**Methods:**
- `can_execute(dao_id, account, proposal_kind, action, proposal_classification)` → bool
  Main permission check that combines all factors:
  1. Get all roles for account in this DAO
  2. For each role:
     a. Check if account's agent tier is allowed (or account is human)
     b. Check if account has required clearance (if role requires it)
     c. Check if any permission matches the requested action
  3. Return true if any role grants permission

- `matches_permission(permission, proposal_kind, action)` → bool
  Wildcard matching logic:
  - "*" matches any value
  - "{kind}:*" matches any action for that proposal kind
  - "*:{action}" matches that action for any proposal kind
  - Exact match: "{kind}:{action}"

- `check_clearance(account, required_classification)` → bool
  - Derive blinded credential key from account
  - Query CredentialRegistry for valid SecurityClearance credential
  - Compare credential's classification level to required level
  - Return true if credential level >= required level
  - NOTE: Actual clearance data is encrypted; this checks existence and validity of anchored credential

- `get_max_autonomy_for_account(dao_id, account)` → AutonomyLevel
  - Get all roles for account
  - Return the highest max_autonomy among roles that account qualifies for
  - If account is agent with tier > role's allowed tiers, skip that role

- `can_vote_on_proposal(dao_id, account, proposal)` → bool
  - Convenience method combining permission check with proposal classification check
  - Ensures account has clearance for proposal's classification level

**Unit tests:**
- Wildcard matching: "*:*", "Transfer:*", "*:VoteApprove"
- Clearance hierarchy: SECRET role can't vote on TOPSECRET proposal
- Agent tier restrictions: SupportAgent can't use OrganizeAgent role
- Max autonomy enforcement

Update mod.rs to export PermissionChecker.
  </action>
  <verify>cargo test --lib -- --nocapture shows all permission tests passing</verify>
  <done>PermissionChecker with wildcard matching, clearance verification, agent tier enforcement, 15+ unit tests</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test --lib` passes all tests
- [ ] Permission wildcards work correctly
- [ ] Clearance requirements enforced on roles
- [ ] Agent tiers restrict role access appropriately
- [ ] Max autonomy tracked per role
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- Role system integrates with existing CredentialRegistry
- Ready for voting engine in Plan 3-03 to use permission checks
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-02-SUMMARY.md`
</output>
