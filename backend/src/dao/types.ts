/**
 * DAO Types
 *
 * TypeScript interfaces mirroring NEAR contract types for DAO governance.
 * Consistent with near-contracts/src/dao/types.rs and related modules.
 */

/**
 * Autonomy level for proposal execution.
 * Determines the degree of human oversight required for decisions.
 */
export enum AutonomyLevel {
  /** Human-out-of-the-loop: AI/system can approve and execute within delegated authority */
  Autonomous = 'Autonomous',
  /** Human-on-the-loop: AI can approve, human monitors with veto window */
  SemiAutonomous = 'SemiAutonomous',
  /** Human-in-the-loop: Human must explicitly approve before execution */
  NotAutonomous = 'NotAutonomous',
}

/**
 * Types of proposals that can be submitted.
 * Extends SputnikDAO v2 patterns with military-specific types.
 */
export enum ProposalKind {
  ConfigChange = 'ConfigChange',
  AddMember = 'AddMember',
  RemoveMember = 'RemoveMember',
  Transfer = 'Transfer',
  FunctionCall = 'FunctionCall',
  /** Authorize a strike/lethal action - always requires human-in-loop */
  StrikeAuthorization = 'StrikeAuthorization',
  MissionOrder = 'MissionOrder',
  Custom = 'Custom',
}

/**
 * Proposal status following SputnikDAO v2 state machine.
 */
export enum ProposalStatus {
  /** Actively being voted on */
  InProgress = 'InProgress',
  /** Voting passed, proposal approved for execution */
  Approved = 'Approved',
  /** Voting failed, proposal rejected */
  Rejected = 'Rejected',
  /** Removed (spam/invalid), bond may be forfeited */
  Removed = 'Removed',
  /** Voting period elapsed without resolution */
  Expired = 'Expired',
  /** Execution failed after approval */
  Failed = 'Failed',
}

/**
 * Execution state for a proposal.
 */
export enum ExecutionState {
  /** Waiting for voting to complete */
  Pending = 'Pending',
  /** Voting passed, ready for immediate execution */
  ReadyForExecution = 'ReadyForExecution',
  /** Semi-autonomous: in veto window, council can veto */
  InVetoWindow = 'InVetoWindow',
  /** Human-in-loop: waiting for explicit human approval */
  AwaitingHumanApproval = 'AwaitingHumanApproval',
  /** Successfully executed */
  Executed = 'Executed',
  /** Vetoed during veto window */
  Vetoed = 'Vetoed',
  /** Voting rejected the proposal */
  Rejected = 'Rejected',
}

/**
 * Vote type (approve, reject, or abstain).
 */
export enum VoteType {
  Approve = 'Approve',
  Reject = 'Reject',
  Abstain = 'Abstain',
}

/**
 * Data classification levels (consistent with privacy.rs).
 */
export enum Classification {
  Public = 'Public',
  Secret = 'Secret',
  TopSecret = 'TopSecret',
}

/**
 * Requirement type for cross-DAO approvals.
 */
export enum RequirementType {
  AllRequired = 'AllRequired',
  MajorityRequired = 'MajorityRequired',
  AnyOne = 'AnyOne',
}

/**
 * DAO configuration - immutable settings defined at creation.
 */
export interface DAOConfig {
  /** Human-readable name for the DAO */
  name: string;
  /** Description of the DAO's purpose */
  description: string;
  /** Classification level for the DAO (affects proposal visibility) */
  classification: Classification;
  /** Default autonomy level for proposals */
  default_autonomy_level: AutonomyLevel;
  /** Bond required to submit a proposal (in yoctoNEAR) */
  proposal_bond: string;
  /** Voting period duration in nanoseconds */
  voting_period_ns: string;
  /** Optional parent DAO ID for hierarchical governance */
  parent_dao_id: string | null;
}

/**
 * DAO metadata - runtime state including computed fields.
 */
export interface DAOMetadata {
  /** Unique identifier for this DAO */
  dao_id: string;
  /** DAO configuration */
  config: DAOConfig;
  /** Creation timestamp (nanoseconds since epoch) */
  created_at: string;
  /** Account that created this DAO */
  created_by: string;
  /** Number of members in this DAO */
  member_count: number;
  /** Number of proposals currently in InProgress status */
  active_proposal_count: number;
}

/**
 * Proposal record with full lifecycle tracking.
 */
export interface Proposal {
  /** Unique proposal ID within the DAO */
  id: number;
  /** Type of proposal */
  kind: ProposalKind | { Custom: string };
  /** Account that created the proposal */
  proposer: string;
  /** Human-readable description of the proposal */
  description: string;
  /** Classification level for this proposal */
  classification: Classification;
  /** Override for autonomy level (null = use DAO default) */
  autonomy_override: AutonomyLevel | null;
  /** Current status */
  status: ProposalStatus;
  /** Number of approval votes */
  votes_approve: number;
  /** Number of rejection votes */
  votes_reject: number;
  /** Creation timestamp (nanoseconds) */
  created_at: string;
  /** Deadline for voting (nanoseconds since epoch) */
  voting_deadline: string;
  /** Result of execution attempt (if any) */
  execution_result: string | null;
}

/**
 * Individual vote record.
 */
export interface Vote {
  /** Account that cast the vote */
  voter: string;
  /** Type of vote */
  vote_type: VoteType;
  /** Weight of this vote */
  weight: number;
  /** Timestamp when vote was cast (nanoseconds) */
  timestamp: string;
}

/**
 * Coalition approval record.
 */
export interface CoalitionApproval {
  /** Party identifier (e.g., "USA", "GBR", "AUS") */
  party: string;
  /** Whether this party has approved */
  approved: boolean;
  /** Account that submitted the approval */
  approved_by: string | null;
  /** Timestamp when approval was recorded */
  approved_at: string | null;
}

/**
 * Coalition proposal requiring multi-party approval.
 */
export interface CoalitionProposal {
  /** Base proposal ID */
  base_proposal_id: number;
  /** Base DAO ID where proposal originated */
  base_dao_id: string;
  /** Required coalition parties */
  required_parties: string[];
  /** Party approvals */
  party_approvals: Record<string, CoalitionApproval>;
  /** Whether all parties are required (true) or just majority (false) */
  all_parties_required: boolean;
  /** Timestamp when coalition proposal was created */
  created_at: string;
}

/**
 * Transaction arguments for building unsigned transactions.
 */
export interface TransactionArgs {
  /** Contract to call */
  contractId: string;
  /** Method name */
  methodName: string;
  /** JSON-encoded arguments */
  args: Record<string, unknown>;
  /** Gas to attach (in yoctoNEAR) */
  gas: string;
  /** NEAR tokens to attach (in yoctoNEAR) */
  deposit: string;
}

/**
 * Role within a DAO.
 */
export interface Role {
  /** Role name */
  name: string;
  /** Role kind (e.g., 'council', 'member', 'agent') */
  kind: string;
  /** Permissions for this role */
  permissions: string[];
  /** Whether humans only (no AI agents) */
  humans_only: boolean;
  /** Maximum agent tier allowed */
  max_agent_tier: string | null;
  /** Required clearance level */
  required_clearance: string | null;
}

/**
 * Execution configuration for a DAO.
 */
export interface ExecutionConfig {
  /** Duration of veto window for semi-autonomous proposals (nanoseconds) */
  veto_window_ns: string;
  /** Delay before execution for safety (nanoseconds) */
  execution_delay_ns: string;
}

/**
 * Voting result summary.
 */
export interface VotingResult {
  /** Total weight of all votes cast */
  total_weight: number;
  /** Weight of approve votes */
  approve_weight: number;
  /** Weight of reject votes */
  reject_weight: number;
  /** Weight of abstain votes */
  abstain_weight: number;
  /** Whether quorum requirement was met */
  quorum_met: boolean;
  /** Whether approval threshold was met */
  approved: boolean;
  /** Whether veto threshold was met */
  vetoed: boolean;
}
