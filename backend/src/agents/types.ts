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

  // ── MDMP Agent Capabilities (Phase 5.1) ──
  /** Surface, classify, and track planning assumptions */
  AssumptionAuditing = 'AssumptionAuditing',
  /** Detect statistical bias, data staleness, and coverage gaps */
  DataBiasDetection = 'DataBiasDetection',
  /** Validate orders format, consistency, and intent traceability */
  OrdersValidation = 'OrdersValidation',
  /** Generate alternative problem framings from multiple perspectives */
  ProblemFraming = 'ProblemFraming',
  /** Parse ROE, map authorities to tasks, validate compliance */
  ROECompliance = 'ROECompliance',
  /** Produce calibrated confidence intervals and detect false precision */
  UncertaintyQuantification = 'UncertaintyQuantification',

  // ── Phase 5.2 Agent Capabilities (Escalation & Competition Modeling) ──
  /** Synthesize adversary capability models and generate MLCOA/MDCOA */
  AdversaryModeling = 'AdversaryModeling',
  /** Model cascading effects across operational domains */
  EffectCascading = 'EffectCascading',
  /** Model escalation dynamics and thresholds */
  EscalationModeling = 'EscalationModeling',
  /** Detect potential deception in adversary actions and intelligence */
  DeceptionDetection = 'DeceptionDetection',
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
  /** Eliza-compatible character definition for personality */
  character?: AgentCharacter;
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

// ============================================================================
// Character Types (Eliza-compatible)
// ============================================================================

/**
 * Message in a conversation example.
 */
export interface CharacterMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Voice settings for character.
 */
export interface CharacterVoiceSettings {
  model?: string;
  voice?: string;
  speed?: number;
}

/**
 * Character communication style.
 */
export interface CharacterStyle {
  /** Universal style traits */
  all: string[];
  /** Chat-specific style */
  chat: string[];
  /** Post-specific style */
  post: string[];
}

/**
 * Character settings.
 */
export interface CharacterSettings {
  voice?: CharacterVoiceSettings;
  secrets?: Record<string, string>;
}

/**
 * Eliza-compatible character definition for AI agents.
 */
export interface AgentCharacter {
  /** Character's name */
  name: string;
  /** Biography entries */
  bio: string[];
  /** Backstory and history */
  lore: string[];
  /** RAG-ready knowledge base */
  knowledge: string[];
  /** Conversation examples */
  messageExamples: CharacterMessage[][];
  /** Social media style examples */
  postExamples: string[];
  /** Topics of interest */
  topics: string[];
  /** Communication style */
  style: CharacterStyle;
  /** Personality descriptors */
  adjectives: string[];
  /** LLM provider override */
  modelProvider?: string;
  /** Character settings */
  settings?: CharacterSettings;
  /** Enabled plugins/tools */
  plugins: string[];
}

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * Tool category for classification.
 */
export type ToolCategory = 'data' | 'action' | 'integration' | 'analysis';

/**
 * Tool handler types.
 */
export type ToolHandler = 'builtin' | 'webhook' | 'function';

/**
 * JSON Schema for tool parameters (simplified).
 */
export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
  additionalProperties?: boolean;
  description?: string;
}

export interface JSONSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
}

/**
 * Tool configuration.
 */
export interface ToolConfig {
  /** Webhook endpoint */
  endpoint?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Rate limit (requests/min) */
  rateLimit?: number;
}

/**
 * MCP Tool definition.
 */
export interface MCPTool {
  /** Unique tool identifier */
  toolId: string;
  /** Tool DID */
  toolDID: string;
  /** Human-readable name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: ToolCategory;
  /** JSON Schema for input parameters */
  inputSchema: JSONSchema;
  /** JSON Schema for expected output */
  outputSchema?: JSONSchema;
  /** Handler type */
  handler: ToolHandler;
  /** Tool configuration */
  config?: ToolConfig;
  /** Required permissions */
  permissions: string[];
  /** Whether enabled */
  isEnabled: boolean;
  /** Creation timestamp */
  createdAt: string;
  /** Creator DID */
  createdBy: string;
  /** Blinded key for DID lookup */
  toolBlindedKey?: string;
  /** Public key for verification */
  toolPublicKey?: string;
}

// ============================================================================
// Agent Team Types
// ============================================================================

/**
 * Team member role.
 */
export type TeamMemberRole = 'coordinator' | 'specialist' | 'validator' | 'executor';

/**
 * Team member configuration.
 */
export interface TeamMember {
  /** Agent ID */
  agentId: string;
  /** Role in the team */
  role: TeamMemberRole;
  /** Responsibilities */
  responsibilities: string[];
  /** Can initiate workflows */
  canInitiate: boolean;
  /** Can escalate to human */
  canEscalate: boolean;
}

/**
 * Workflow stage definition.
 */
export interface WorkflowStage {
  /** Stage ID */
  stageId: string;
  /** Stage name */
  name: string;
  /** Assigned agent IDs */
  assignedAgents: string[];
  /** Required approvals for consensus */
  requiredApprovals?: number;
  /** Timeout in seconds */
  timeout?: number;
  /** Next stages */
  nextStages: string[];
}

/**
 * Workflow type for team coordination.
 */
export type WorkflowType = 'sequential' | 'parallel' | 'consensus' | 'hierarchical';

/**
 * Team workflow definition.
 */
export interface TeamWorkflow {
  /** Workflow type */
  type: WorkflowType;
  /** Workflow stages */
  stages: WorkflowStage[];
  /** Stages requiring human approval */
  humanCheckpoints: string[];
}

/**
 * Escalation policy configuration.
 */
export interface EscalationPolicy {
  /** Enable escalation */
  enabled: boolean;
  /** Timeout before escalation (seconds) */
  timeoutSeconds: number;
  /** Escalation targets (DID or role) */
  targets: string[];
  /** Notification channels */
  notificationChannels: ('email' | 'slack' | 'webhook')[];
}

/**
 * Agent team configuration.
 */
export interface AgentTeam {
  /** Unique team identifier */
  teamId: string;
  /** Team DID */
  teamDID: string;
  /** Team name */
  name: string;
  /** Team description */
  description: string;
  /** Team's mission statement */
  purpose: string;
  /** Team members */
  members: TeamMember[];
  /** Workflow definition */
  workflow: TeamWorkflow;
  /** Shared context keys */
  sharedContext: string[];
  /** Escalation policy */
  escalationPolicy: EscalationPolicy;
  /** Max concurrent executions */
  maxConcurrency: number;
  /** Whether enabled */
  isEnabled: boolean;
  /** Creation timestamp */
  createdAt: string;
  /** Creator DID */
  createdBy: string;
  /** Blinded key for DID lookup */
  teamBlindedKey?: string;
  /** Public key for verification */
  teamPublicKey?: string;
}
