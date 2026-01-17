/**
 * DAO Types for Frontend
 *
 * TypeScript interfaces mirroring backend DAO types for governance UI.
 * Consistent with backend/src/dao/types.ts
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
 * Data classification levels.
 */
export enum Classification {
  Public = 'Public',
  Secret = 'Secret',
  TopSecret = 'TopSecret',
}

/**
 * DAO metadata for display.
 */
export interface DAOMetadata {
  daoId: string;
  name: string;
  description: string;
  classification: Classification;
  defaultAutonomy: AutonomyLevel;
  memberCount: number;
  activeProposalCount: number;
  parentDaoId?: string;
  createdAt: number;
  createdBy: string;
}

/**
 * Proposal with computed UI fields.
 */
export interface Proposal {
  id: number;
  daoId: string;
  kind: ProposalKind | string;
  proposer: string;
  description: string;
  classification: Classification;
  autonomyOverride?: AutonomyLevel;
  status: ProposalStatus;
  votesApprove: number;
  votesReject: number;
  createdAt: number;
  votingDeadline: number;
  executionState: ExecutionState;
  executionResult?: string;
  // Computed for UI
  effectiveAutonomy: AutonomyLevel;
  timeRemaining: string;
  requiresMyAction: boolean;
  myVote?: VoteType;
  isUrgent: boolean;
}

/**
 * Individual vote record.
 */
export interface Vote {
  voter: string;
  voteType: VoteType;
  weight: number;
  timestamp: number;
}

/**
 * Coalition status for multi-party proposals.
 */
export interface CoalitionStatus {
  requiredParties: string[];
  approvals: Record<string, { approved: boolean; approvedBy?: string; approvedAt?: number }>;
  allPartiesRequired: boolean;
  isApproved: boolean;
  pendingParties: string[];
}

/**
 * Context chain for a proposal.
 */
export interface ProposalContext {
  parentProposals: Proposal[];
  relatedProposals: Proposal[];
  strategicObjective?: string;
}

/**
 * Transaction arguments for wallet signing.
 */
export interface TransactionArgs {
  contractId: string;
  methodName: string;
  args: Record<string, unknown>;
  gas: string;
  deposit: string;
}

/**
 * API response wrapper.
 */
export interface DAOResponse<T> {
  success: boolean;
  data?: T;
  transaction?: TransactionArgs;
  error?: string;
}
