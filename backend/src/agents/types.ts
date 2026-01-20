/**
 * Agent Types
 *
 * TypeScript interfaces for AI governance agents following NEAR AI Governance Framework.
 * Agents operate in three phases: Support, Represent, Organize.
 */

import { AutonomyLevel, ProposalKind } from '../dao/types.js';

/**
 * Agent phase according to NEAR AI Governance Framework.
 * Each phase represents increasing autonomy and decision-making capability.
 */
export enum AgentPhase {
  /** AI Assistants - support human decisions, minimize cognitive cost */
  Support = 'Support',
  /** AI Proxies - proxy human decisions, maximize representation */
  Represent = 'Represent',
  /** AI Leaders - make decisions, coordinate, maximize intelligence */
  Organize = 'Organize',
}

/**
 * Agent capabilities define what actions an agent can perform.
 */
export enum AgentCapability {
  // Support phase capabilities
  /** Summarize proposals for human review */
  ProposalSummary = 'ProposalSummary',
  /** Screen proposals for issues/spam */
  ProposalScreening = 'ProposalScreening',
  /** Analyze context and related information */
  ContextAnalysis = 'ContextAnalysis',
  /** Assess feasibility of proposals */
  FeasibilityAssessment = 'FeasibilityAssessment',
  /** Monitor for security concerns */
  SecurityMonitoring = 'SecurityMonitoring',
  /** Provide voting guidance (eligibility, autonomy explanation, next steps) */
  VotingGuidance = 'VotingGuidance',

  // Represent phase capabilities (future)
  /** Model user preferences for voting recommendations */
  PreferenceModeling = 'PreferenceModeling',
  /** Cast votes on behalf of delegator */
  DelegatedVoting = 'DelegatedVoting',

  // Organize phase capabilities (future)
  /** Build consensus among stakeholders */
  ConsensusBuilding = 'ConsensusBuilding',
  /** Coordinate committee activities */
  CommitteeCoordination = 'CommitteeCoordination',
}

/**
 * Agent manifest - registry entry for an AI governance agent.
 */
export interface AgentManifest {
  /** Unique identifier for the agent */
  agentId: string;
  /** Human-readable name */
  name: string;
  /** Description of the agent's purpose */
  description: string;
  /** Phase in AI governance progression */
  phase: AgentPhase;
  /** Capabilities this agent possesses */
  capabilities: AgentCapability[];
  /** Maximum autonomy level the agent can operate at */
  maxAutonomy: AutonomyLevel;
  /** Which proposal types this agent can act on */
  allowedProposalKinds: ProposalKind[];
  /** Proposal kinds that always require human approval */
  requiresHumanApproval: ProposalKind[];
  /** When the agent was registered */
  createdAt: Date;
  /** Who registered the agent */
  createdBy: string;
  /** Whether the agent is currently active */
  active: boolean;
  /** DID for verifiable agent identity */
  agentDID?: string;
  /** Blinded key for DID lookup */
  agentBlindedKey?: string;
  /** Public key for verification */
  agentPublicKey?: string;
  /** Per-agent model configuration (overrides global) */
  modelConfig?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Delegation scope defines boundaries for agent actions.
 */
export interface DelegationScope {
  /** Which proposal types the agent can act on */
  proposalKinds: ProposalKind[];
  /** Highest classification level the agent can access */
  maxClassification: string;
  /** Always true for v1 - agents cannot act on strike authorization */
  excludeStrikeAuth: boolean;
}

/**
 * Agent delegation - grants an agent permission to act on behalf of a human.
 */
export interface AgentDelegation {
  /** Unique identifier for this delegation */
  delegationId: string;
  /** Agent receiving the delegation */
  agentId: string;
  /** DID of the human delegating authority */
  delegatorDID: string;
  /** DAO where this delegation applies */
  daoId: string;
  /** Scope of the delegation */
  scope: DelegationScope;
  /** Maximum autonomy for this delegation */
  maxAutonomy: AutonomyLevel;
  /** Optional expiration date */
  expiresAt?: Date;
  /** When the delegation was created */
  createdAt: Date;
  /** Whether the delegation has been revoked */
  revoked: boolean;
}

/**
 * Types of actions agents can perform.
 */
export enum AgentActionType {
  /** Analyze a proposal for content and implications */
  AnalyzeProposal = 'AnalyzeProposal',
  /** Screen a proposal for issues or spam */
  ScreenProposal = 'ScreenProposal',
  /** Summarize DAO activity */
  SummarizeActivity = 'SummarizeActivity',
  /** Assess feasibility of a proposal */
  AssessFeasibility = 'AssessFeasibility',
  /** Identify gaps in context or information */
  IdentifyContextGaps = 'IdentifyContextGaps',
  /** Recommend a vote (Support only - never executes vote) */
  RecommendVote = 'RecommendVote',
  /** Cast a vote on behalf of delegator (Represent phase) */
  CastDelegatedVote = 'CastDelegatedVote',
}

/**
 * Agent action - audit trail entry for actions taken by agents.
 */
export interface AgentAction {
  /** Unique identifier for this action */
  actionId: string;
  /** Agent that performed the action */
  agentId: string;
  /** DAO where action was taken */
  daoId: string;
  /** Proposal ID if action was on a specific proposal */
  proposalId?: number;
  /** Type of action taken */
  actionType: AgentActionType;
  /** Input provided to the agent */
  input: Record<string, unknown>;
  /** Output/result from the agent */
  output: Record<string, unknown>;
  /** Autonomy level used for this action */
  autonomyUsed: AutonomyLevel;
  /** Whether human approved this action */
  humanApproved: boolean;
  /** When the action was taken */
  timestamp: Date;
}

// Re-export AutonomyLevel and ProposalKind for convenience
export { AutonomyLevel, ProposalKind } from '../dao/types.js';
