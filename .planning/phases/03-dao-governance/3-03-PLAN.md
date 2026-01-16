---
phase: 03-dao-governance
plan: 03
type: execute
---

<objective>
Create pluggable voting engine with autonomy-aware execution flows.

Purpose: Enable modular voting mechanisms that can be swapped per proposal type, with execution flows that respect autonomy levels (autonomous/semi-autonomous/human-in-loop).
Output: VotingEngine trait, WeightedVoting implementation, autonomy-aware proposal execution with veto windows.
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
@near-contracts/src/dao/mod.rs
@near-contracts/src/dao/types.rs
@near-contracts/src/dao/proposals.rs
@near-contracts/src/dao/roles.rs
@near-contracts/src/dao/permissions.rs

**Tech stack available:**
- DAO core types (AutonomyLevel, Proposal, ProposalStatus)
- RoleManager and PermissionChecker from 3-02
- ProposalManager from 3-01

**Established patterns from research:**
- SputnikDAO v2 vote counting with role-weighted vs token-weighted options
- Threshold as Weight (absolute) or Ratio (fraction of total)
- Quorum requirements to prevent low-turnout exploitation

**Key decisions from context:**
- Modular voting engine: different proposal types can use different mechanisms
- Three autonomy levels affect execution flow
- Semi-autonomous has veto window before execution
- Strike auth always human-in-loop
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create pluggable voting engine with weighted voting implementation</name>
  <files>near-contracts/src/dao/voting.rs, near-contracts/src/dao/mod.rs</files>
  <action>
Create voting.rs with pluggable voting mechanism:

**Enums:**
- `WeightKind` enum: TokenWeight, RoleWeight (one vote per role member), Equal (one vote per account)
- `ThresholdKind` enum: Absolute { count: u32 }, Ratio { numerator: u32, denominator: u32 }

**Structs:**
- `VotePolicy` struct:
  - weight_kind: WeightKind
  - threshold: ThresholdKind
  - quorum: ThresholdKind - minimum participation required
  - veto_threshold: Option<ThresholdKind> - for semi-autonomous veto

- `Vote` struct:
  - voter: AccountId
  - vote_type: VoteType (Approve, Reject, Abstain)
  - weight: u32
  - timestamp: u64

- `VoteType` enum: Approve, Reject, Abstain

- `VotingResult` struct:
  - total_weight: u32
  - approve_weight: u32
  - reject_weight: u32
  - abstain_weight: u32
  - quorum_met: bool
  - approved: bool
  - vetoed: bool (for semi-autonomous)

**VotingEngine struct:**
- votes: LookupMap<(String, u64), Vec<Vote>> - (dao_id, proposal_id) → votes
- policies: LookupMap<(String, String), VotePolicy> - (dao_id, proposal_kind) → policy
- default_policy: VotePolicy

**Methods:**
- `new()` constructor with sensible default policy (RoleWeight, 50% threshold, 10% quorum)
- `set_policy(dao_id, proposal_kind, policy)` - set voting policy for proposal type
- `get_policy(dao_id, proposal_kind)` → VotePolicy
- `cast_vote(dao_id, proposal_id, voter, vote_type, weight)` → Result
  - Prevent duplicate votes from same voter
  - Record vote with timestamp
- `get_votes(dao_id, proposal_id)` → Vec<Vote>
- `has_voted(dao_id, proposal_id, voter)` → bool
- `calculate_result(dao_id, proposal_id, policy, total_eligible_weight)` → VotingResult
  - Sum weights by vote type
  - Check quorum (participation / eligible)
  - Check threshold (approve / (approve + reject))
  - Check veto if applicable
- `get_vote_weight(dao_id, account, weight_kind)` → u32
  - TokenWeight: query staking contract (stub for now, return 1)
  - RoleWeight: 1 if has any role in DAO
  - Equal: always 1

**Default policies per ProposalKind:**
- StrikeAuthorization: 100% threshold (unanimous), 100% quorum
- ConfigChange: 67% threshold, 50% quorum
- Transfer: 50% threshold, 25% quorum
- Default: 50% threshold, 10% quorum

Unit tests for vote counting, quorum checks, threshold calculations.
  </action>
  <verify>cargo build --target wasm32-unknown-unknown --release compiles without errors</verify>
  <done>VotingEngine with pluggable policies, weighted voting, quorum/threshold logic</done>
</task>

<task type="auto">
  <name>Task 2: Implement autonomy-aware execution flows</name>
  <files>near-contracts/src/dao/execution.rs, near-contracts/src/dao/mod.rs</files>
  <action>
Create execution.rs with autonomy-aware proposal execution:

**Enums:**
- `ExecutionState` enum:
  - Pending - waiting for votes
  - ReadyForExecution - votes passed, awaiting execution
  - InVetoWindow { deadline: u64 } - semi-autonomous veto period
  - AwaitingHumanApproval - human-in-loop waiting for explicit approval
  - Executed { result: String }
  - Vetoed { by: AccountId }
  - Rejected

**Structs:**
- `ExecutionConfig` struct:
  - veto_window_ns: u64 - duration of veto window for semi-autonomous (default 1 hour)
  - execution_delay_ns: u64 - delay before execution for safety (default 0 for autonomous)

**ProposalExecutor struct:**
- execution_states: LookupMap<(String, u64), ExecutionState>
- execution_configs: LookupMap<String, ExecutionConfig> - per DAO config

**Methods:**
- `new()` constructor
- `process_voting_complete(dao_id, proposal_id, voting_result, effective_autonomy)` → ExecutionState
  Based on effective_autonomy:
  - Autonomous: If approved → ReadyForExecution, schedule immediate execution
  - SemiAutonomous: If approved → InVetoWindow with deadline
  - NotAutonomous: If approved → AwaitingHumanApproval
  - If rejected → Rejected

- `check_veto_window(dao_id, proposal_id)` → ExecutionState
  - If current time > deadline and no veto, transition to ReadyForExecution
  - Return current state

- `submit_veto(dao_id, proposal_id, vetoer)` → Result
  - Only valid during InVetoWindow
  - Verify vetoer has veto permission (council role)
  - Transition to Vetoed

- `submit_human_approval(dao_id, proposal_id, approver)` → Result
  - Only valid during AwaitingHumanApproval
  - Verify approver has Execute permission for this proposal kind
  - Transition to ReadyForExecution

- `execute_proposal(dao_id, proposal_id)` → Result<String>
  - Only valid in ReadyForExecution state
  - Match on ProposalKind and execute action:
    - ConfigChange: Update DAO config
    - AddMember/RemoveMember: Update role assignments
    - Transfer: Create Promise for transfer (stub)
    - FunctionCall: Create cross-contract call (stub)
    - StrikeAuthorization: Emit event, record authorization
    - MissionOrder: Emit event, record order
    - Custom: Emit event only
  - Return execution result string
  - Transition to Executed

- `get_execution_state(dao_id, proposal_id)` → ExecutionState

**Events (use env::log_str with JSON):**
- ProposalApproved { dao_id, proposal_id, autonomy_level }
- VetoWindowStarted { dao_id, proposal_id, deadline }
- ProposalVetoed { dao_id, proposal_id, vetoer }
- HumanApprovalReceived { dao_id, proposal_id, approver }
- ProposalExecuted { dao_id, proposal_id, result }
- StrikeAuthorized { dao_id, proposal_id, approver, target } - special audit event

Unit tests for all execution flows and state transitions.
  </action>
  <verify>cargo test --lib -- --nocapture shows all execution tests passing</verify>
  <done>ProposalExecutor with three autonomy flows, veto mechanism, execution state machine, audit events</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cargo build --target wasm32-unknown-unknown --release` succeeds
- [ ] `cargo test --lib` passes all tests
- [ ] Autonomous proposals execute immediately after vote passes
- [ ] Semi-autonomous proposals enter veto window
- [ ] Human-in-loop proposals wait for explicit approval
- [ ] StrikeAuthorization emits special audit event
- [ ] Veto mechanism works during window
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- Voting engine ready for coalition voting in 3-04
- Execution flows demonstrate all three autonomy levels
</success_criteria>

<output>
After completion, create `.planning/phases/03-dao-governance/3-03-SUMMARY.md`
</output>
