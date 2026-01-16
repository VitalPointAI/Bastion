---
phase: 03-dao-governance
plan: 04
type: execute
---

<objective>
Implement DAO linkages (hierarchical, resource sharing, cross-DAO approvals) and integrate DAO module into main contract.

Purpose: Enable mission-focused DAOs that can have parent-child relationships, share members/resources, and require cross-DAO approvals for high-consequence decisions.
Output: Hierarchical DAO relationships, cross-DAO approval dependencies, coalition voting, full contract integration with public methods.
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
@near-contracts/src/lib.rs
@near-contracts/src/dao/mod.rs

**From context - three linkage types:**
1. Hierarchical dependencies: Parent DAOs spawn child DAOs, decisions cascade down
2. Resource sharing: Members, assets, authorities shared across DAOs
3. Cross-DAO approvals: Some decisions require approval from multiple DAOs

**From research - coalition voting pattern:**
- CoalitionProposal with required_parties
- Party membership verification via credentials
- All parties or majority required
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement hierarchical DAOs and cross-DAO approval dependencies</name>
  <files>near-contracts/src/dao/linkages.rs, near-contracts/src/dao/mod.rs</files>
  <action>
Create linkages.rs with DAO relationship management:

**Structs:**
- `DAORelationship` struct:
  - parent_dao_id: Option<String>
  - child_dao_ids: Vec<String>
  - shared_with: Vec<String> - DAOs that share resources with this one
  - created_at: u64

- `CrossDAORequirement` struct:
  - required_dao_ids: Vec<String> - DAOs that must also approve
  - requirement_type: RequirementType
  - approvals_received: HashMap<String, bool>

- `RequirementType` enum:
  - AllRequired - all listed DAOs must approve (unanimous)
  - MajorityRequired - >50% of listed DAOs must approve
  - AnyOne - at least one DAO must approve

- `CoalitionProposal` struct:
  - base_proposal_id: u64
  - base_dao_id: String
  - required_parties: Vec<String> - nation/org codes ["USA", "GBR", "AUS"]
  - party_approvals: HashMap<String, CoalitionApproval>
  - all_parties_required: bool

- `CoalitionApproval` struct:
  - party: String
  - approved: bool
  - approved_by: Option<AccountId>
  - approved_at: Option<u64>

**DAOLinkageManager struct:**
- relationships: LookupMap<String, DAORelationship>
- cross_dao_requirements: LookupMap<(String, u64), CrossDAORequirement> - (dao_id, proposal_id)
- coalition_proposals: LookupMap<(String, u64), CoalitionProposal>

**Methods:**
- `new()` constructor
- `set_parent(child_dao_id, parent_dao_id)` - establish parent-child relationship
- `get_parent(dao_id)` → Option<String>
- `get_children(dao_id)` → Vec<String>
- `add_shared_dao(dao_id, shared_with_dao_id)` - establish resource sharing
- `get_shared_daos(dao_id)` → Vec<String>
- `is_member_in_hierarchy(account, dao_id)` → bool
  - Check if account is member of dao_id OR any parent DAO
  - Enables inherited membership from parent DAOs

- `create_cross_dao_requirement(dao_id, proposal_id, required_dao_ids, requirement_type)`
- `record_cross_dao_approval(dao_id, proposal_id, approving_dao_id)` → bool
  - Record that approving_dao approved this proposal
  - Return true if all requirements now met
- `check_cross_dao_approved(dao_id, proposal_id)` → bool

- `create_coalition_proposal(dao_id, proposal_id, required_parties, all_parties_required)`
- `record_party_approval(dao_id, proposal_id, party, approved_by)` → bool
  - Verify approved_by has CoalitionMembership credential for claimed party
  - Record approval
  - Return true if coalition requirement met
- `check_coalition_approved(dao_id, proposal_id)` → bool
- `get_coalition_status(dao_id, proposal_id)` → CoalitionProposal

**Unit tests:**
- Parent-child hierarchy traversal
- Inherited membership
- Cross-DAO approval tracking
- Coalition voting with party verification
  </action>
  <verify>cargo build --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>DAOLinkageManager with hierarchical DAOs, cross-DAO approvals, coalition voting</done>
</task>

<task type="auto">
  <name>Task 2: Integrate DAO module into main contract with public methods</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/dao/mod.rs</files>
  <action>
Integrate complete DAO module into main Contract:

**Update lib.rs:**

Add imports:
```rust
mod dao;
use dao::{
    DAORegistry, DAOConfig, DAOMetadata, AutonomyLevel,
    ProposalManager, Proposal, ProposalKind, ProposalStatus,
    RoleManager, Role, RoleKind, AgentTier, PermissionChecker,
    VotingEngine, VotePolicy, VoteType,
    ProposalExecutor, ExecutionState,
    DAOLinkageManager, CrossDAORequirement, CoalitionProposal,
};
```

Add fields to Contract struct:
```rust
dao_registry: DAORegistry,
proposal_manager: ProposalManager,
role_manager: RoleManager,
voting_engine: VotingEngine,
proposal_executor: ProposalExecutor,
dao_linkages: DAOLinkageManager,
```

Update `new()` to initialize all DAO components.

Update `migrate()` to handle existing state + new DAO fields.

**Add public methods to Contract impl:**

DAO Management:
- `create_dao(config: DAOConfig)` → String (dao_id)
- `get_dao(dao_id: String)` → Option<DAOMetadata>
- `list_daos(offset: u32, limit: u32)` → Vec<DAOMetadata>
- `update_dao_config(dao_id: String, config: DAOConfig)` - owner/council only

Proposal Management:
- `create_proposal(dao_id, kind, description, classification)` → u64
- `get_proposal(dao_id, proposal_id)` → Option<Proposal>
- `list_proposals(dao_id, offset, limit)` → Vec<Proposal>

Voting:
- `cast_vote(dao_id, proposal_id, vote_type: VoteType)`
  - Check permissions via PermissionChecker
  - Record vote via VotingEngine
  - Check if voting complete, trigger execution flow if so
- `get_votes(dao_id, proposal_id)` → Vec<Vote>

Execution:
- `submit_veto(dao_id, proposal_id)` - council only, during veto window
- `submit_human_approval(dao_id, proposal_id)` - for human-in-loop proposals
- `execute_proposal(dao_id, proposal_id)` - trigger execution if ready
- `get_execution_state(dao_id, proposal_id)` → ExecutionState

Roles:
- `assign_role(dao_id, account, role_name)` - council only
- `remove_role_from_member(dao_id, account, role_name)` - council only
- `register_agent(account, tier: AgentTier)` - owner only
- `get_member_roles(dao_id, account)` → Vec<String>

Linkages:
- `set_dao_parent(child_dao_id, parent_dao_id)` - council only
- `add_cross_dao_requirement(dao_id, proposal_id, required_dao_ids)`
- `record_cross_dao_approval(dao_id, proposal_id, approving_dao_id)`
- `create_coalition_proposal(dao_id, proposal_id, required_parties)`
- `record_coalition_approval(dao_id, proposal_id, party)`

**Add integration tests:**
- Full proposal lifecycle: create → vote → execute
- Strike authorization flow with human approval
- Coalition voting across parties
- Cross-DAO approval chain
  </action>
  <verify>cargo test --lib -- --nocapture shows all integration tests passing</verify>
  <done>DAO module fully integrated into Contract, all public methods exposed, integration tests for strike auth and coalition voting</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test --lib` passes all tests (80+ tests expected)
- [ ] Contract exposes all DAO public methods
- [ ] Strike authorization flow works end-to-end with human approval
- [ ] Coalition voting requires party membership verification
- [ ] Cross-DAO approvals block execution until all DAOs approve
- [ ] Hierarchical membership inheritance works
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- DAO governance fully functional on-chain
- Ready for backend API in Plan 3-05
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-04-SUMMARY.md`
</output>
