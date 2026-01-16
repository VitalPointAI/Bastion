---
phase: 03-dao-governance
plan: 01
type: execute
---

<objective>
Create DAO core module with multi-DAO registry, proposal types, and autonomy level configuration.

Purpose: Establish the foundation for mission-focused DAOs with configurable autonomy levels that feel natural to military commanders.
Output: DAO module with DAOConfig, DAORegistry, proposal state machine, and autonomy enum integrated into NEAR contract.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-dao-governance/3-RESEARCH.md
@.planning/phases/03-dao-governance/3-CONTEXT.md
@near-contracts/src/lib.rs
@near-contracts/src/did_registry.rs
@near-contracts/src/credential_registry.rs

**Tech stack available:**
- near-sdk-rs 5.6+, borsh serialization, LookupMap/UnorderedMap collections
- Blinded key patterns from DID/Credential registries
- Classification enum from privacy.rs

**Established patterns:**
- State versioning with migrate() function
- LookupMap for efficient storage
- Owner-based access control
- Unit tests in same file as implementation

**Key decisions from research:**
- Extend SputnikDAO v2 patterns rather than build from scratch
- Proposal state machine: InProgress → Approved/Rejected/Removed/Expired/Failed
- Three autonomy levels: Autonomous, SemiAutonomous, NotAutonomous
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create DAO module with core types and registry</name>
  <files>near-contracts/src/dao/mod.rs, near-contracts/src/dao/types.rs, near-contracts/src/dao/registry.rs</files>
  <action>
Create dao/ module directory with:

**types.rs:**
- `AutonomyLevel` enum: Autonomous (human-out-of-loop), SemiAutonomous (human-on-loop), NotAutonomous (human-in-loop)
- `DAOConfig` struct: name, description, classification (use existing Classification), default_autonomy_level, proposal_bond (U128), voting_period_ns (u64), parent_dao_id (Option)
- `DAOMetadata` struct: dao_id (String), config (DAOConfig), created_at, created_by (AccountId), member_count (u32), active_proposal_count (u32)
- `ProposalKind` enum: ConfigChange, AddMember, RemoveMember, Transfer, FunctionCall, StrikeAuthorization, MissionOrder, Custom(String)
- `ProposalStatus` enum: InProgress, Approved, Rejected, Removed, Expired, Failed
- `Proposal` struct: id (u64), kind (ProposalKind), proposer (AccountId), description, classification, autonomy_override (Option<AutonomyLevel>), status, votes_approve (u32), votes_reject (u32), created_at, voting_deadline, execution_result (Option<String>)

**registry.rs:**
- `DAORegistry` struct with LookupMap<String, DAOMetadata> for dao_id → metadata
- `new()` constructor
- `create_dao()` - creates new DAO with config, returns dao_id
- `get_dao()` - retrieves DAO metadata by id
- `update_dao()` - updates DAO config (owner only)
- `list_daos()` - returns paginated list of DAOs (with offset/limit)
- `get_dao_count()` - returns total DAO count

**mod.rs:**
- Re-export all types from types.rs and registry.rs

Use `#[near(serializers = [json, borsh])]` for all structs. Follow existing patterns from did_registry.rs for storage efficiency.

StrikeAuthorization proposals MUST default to NotAutonomous regardless of DAO config - enforce this in create logic.
  </action>
  <verify>cargo build --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>DAO module exists with all core types, DAORegistry with CRUD operations, StrikeAuthorization defaults to NotAutonomous</done>
</task>

<task type="auto">
  <name>Task 2: Create proposal management and state machine</name>
  <files>near-contracts/src/dao/proposals.rs, near-contracts/src/dao/mod.rs</files>
  <action>
Create proposals.rs with ProposalManager:

**ProposalManager struct:**
- proposals: LookupMap<(String, u64), Proposal> - (dao_id, proposal_id) → Proposal
- proposal_counts: LookupMap<String, u64> - dao_id → next_proposal_id
- dao_proposals: LookupMap<String, Vec<u64>> - dao_id → list of proposal_ids (for listing)

**Methods:**
- `new()` constructor with storage prefix
- `create_proposal(dao_id, kind, proposer, description, classification, autonomy_override, voting_period_ns)` → u64
  - Enforce: StrikeAuthorization kind forces autonomy_override to None (uses NotAutonomous)
  - Set voting_deadline = env::block_timestamp() + voting_period_ns
  - Initialize with status = InProgress, votes = 0
  - Return proposal_id
- `get_proposal(dao_id, proposal_id)` → Option<Proposal>
- `list_proposals(dao_id, offset, limit)` → Vec<Proposal>
- `get_active_proposals(dao_id)` → Vec<Proposal> (status == InProgress)
- `update_proposal_status(dao_id, proposal_id, new_status)` - internal use
- `check_expired(dao_id, proposal_id)` → bool - checks if voting_deadline passed, updates status to Expired if so
- `get_effective_autonomy(proposal, dao_config)` → AutonomyLevel
  - If proposal.kind == StrikeAuthorization, return NotAutonomous
  - If proposal.autonomy_override.is_some(), return override
  - Else return dao_config.default_autonomy_level

**State machine enforcement:**
- InProgress can transition to: Approved, Rejected, Removed, Expired, Failed
- All other states are terminal (no further transitions)
- Add `is_terminal()` helper method

Update mod.rs to export ProposalManager.

Add unit tests for:
- Proposal creation with various kinds
- StrikeAuthorization autonomy enforcement
- State machine transitions
- Expiration detection
  </action>
  <verify>cargo test --lib -- --nocapture shows all proposal tests passing</verify>
  <done>ProposalManager with full state machine, StrikeAuthorization always NotAutonomous, 10+ unit tests passing</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test --lib` passes all tests
- [ ] DAO module exports: AutonomyLevel, DAOConfig, DAOMetadata, ProposalKind, ProposalStatus, Proposal, DAORegistry, ProposalManager
- [ ] StrikeAuthorization proposals enforce NotAutonomous
- [ ] No clippy warnings in new code
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- DAO core types ready for role/permission integration in Plan 3-02
- Proposal state machine ready for voting logic in Plan 3-03
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-01-SUMMARY.md`
</output>
