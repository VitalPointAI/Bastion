/**
 * Admin Configuration Types
 *
 * TypeScript interfaces mirroring backend admin configuration types.
 * Consistent with backend/src/strategic/config/types.ts
 *
 * Uses const objects instead of enums for erasableSyntaxOnly compatibility.
 */

// ============================================================================
// LLM Provider Configuration
// ============================================================================

/**
 * Supported LLM providers.
 */
export const LLMProvider = {
  Anthropic: 'anthropic',
  OpenAI: 'openai',
  AzureOpenAI: 'azure-openai',
  NearAI: 'near-ai',
  Local: 'local',
} as const;

export type LLMProvider = typeof LLMProvider[keyof typeof LLMProvider];

/**
 * Model assignments for different tasks.
 */
export interface LLMModels {
  extraction: string;
  analysis: string;
  summarization: string;
  redTeam: string;
}

/**
 * LLM provider configuration.
 * Note: apiKey is masked by backend (last 4 chars only).
 */
export interface OAuthStatus {
  connected: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  tokenExpiresAt: string | null;
  scopes: string[];
}

export interface LLMProviderConfig {
  provider: LLMProvider;
  models: LLMModels;
  apiKey: string;
  baseUrl?: string;
  maxRequestsPerMinute: number;
  maxTokensPerDay: number;
  maxCostPerDocument: number;
  alertThreshold: number;
  oauth?: {
    clientId?: string;
    clientSecret?: string;
    connected?: boolean;
    tokenExpiresAt?: string;
    scopes?: string[];
  };
}

/**
 * Partial update for LLM config.
 */
export type LLMProviderConfigUpdate = Partial<LLMProviderConfig>;

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Available agents and their enabled status.
 */
export interface EnabledAgents {
  osintCollector: boolean;
  documentProcessor: boolean;
  threatMonitor: boolean;
  fusionAgent: boolean;
  extractionAgent: boolean;
  assessmentAgent: boolean;
  redTeamAgent: boolean;
  devilsAdvocate: boolean;
  coaGenerator: boolean;
}

/**
 * Agent configuration settings.
 */
export interface AgentConfig {
  enabledAgents: EnabledAgents;
  defaultConfidenceThreshold: number;
  requireHumanReviewFor: string[];
}

/**
 * Partial update for agent config.
 */
export interface AgentConfigUpdate {
  enabledAgents?: Partial<EnabledAgents>;
  defaultConfidenceThreshold?: number;
  requireHumanReviewFor?: string[];
}

// ============================================================================
// OSINT Source Configuration
// ============================================================================

/**
 * OSINT source types.
 */
export const OSINTSourceType = {
  RSS: 'RSS',
  API: 'API',
  Scrape: 'SCRAPE',
  Manual: 'MANUAL',
} as const;

export type OSINTSourceType = typeof OSINTSourceType[keyof typeof OSINTSourceType];

/**
 * OSINT source configuration.
 * Note: apiKey is masked by backend when present.
 */
export interface OSINTSourceConfig {
  id: string;
  name: string;
  type: OSINTSourceType;
  url: string;
  credibilityRating: number;
  enabled: boolean;
  apiKey?: string;
  rateLimit?: number;
  categories: string[];
  regions: string[];
}

/**
 * Input for creating a new OSINT source (no id).
 */
export type OSINTSourceConfigInput = Omit<OSINTSourceConfig, 'id'>;

/**
 * Partial update for OSINT source.
 */
export type OSINTSourceConfigUpdate = Partial<Omit<OSINTSourceConfig, 'id'>>;

// ============================================================================
// Workflow Configuration
// ============================================================================

/**
 * Risk levels for workflow escalation.
 */
export const RiskLevel = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Extreme: 'EXTREME',
} as const;

export type RiskLevel = typeof RiskLevel[keyof typeof RiskLevel];

/**
 * Escalation timeout settings per risk level (in hours).
 */
export interface EscalationTimeouts {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  EXTREME: number;
}

/**
 * Approval authority settings per risk level.
 */
export interface ApprovalAuthority {
  riskLevel: RiskLevel;
  requiredRole: string;
  canDelegate: boolean;
}

/**
 * Notification settings for workflow events.
 */
export interface NotificationsConfig {
  emailOnPending: boolean;
  emailOnEscalation: boolean;
  slackWebhook?: string;
}

/**
 * Workflow configuration settings.
 */
export interface WorkflowConfig {
  escalationTimeouts: EscalationTimeouts;
  approvalAuthority: ApprovalAuthority[];
  notifications: NotificationsConfig;
}

/**
 * Partial update for workflow config.
 */
export interface WorkflowConfigUpdate {
  escalationTimeouts?: Partial<EscalationTimeouts>;
  approvalAuthority?: ApprovalAuthority[];
  notifications?: Partial<NotificationsConfig>;
}

// ============================================================================
// Config Audit Entry
// ============================================================================

/**
 * Audit log entry for configuration changes.
 */
export interface ConfigAuditEntry {
  id: string;
  category: string;
  key: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

// ============================================================================
// Configuration Categories
// ============================================================================

/**
 * Configuration category identifiers.
 */
export const ConfigCategory = {
  LLM: 'llm',
  Agents: 'agents',
  Workflow: 'workflow',
  OSINT: 'osint',
} as const;

export type ConfigCategory = typeof ConfigCategory[keyof typeof ConfigCategory];

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response for OSINT sources list.
 */
export interface OSINTSourcesResponse {
  count: number;
  sources: OSINTSourceConfig[];
}

/**
 * Response for audit log.
 */
export interface AuditLogResponse {
  entries: ConfigAuditEntry[];
}

/**
 * Response for cache invalidation.
 */
export interface CacheInvalidationResponse {
  success: boolean;
  clearedKeys: string[];
}

// ============================================================================
// Agent Management Types (Per-Agent Model Configuration)
// ============================================================================

/**
 * LLM provider type for type safety.
 */
export type LLMProviderType = 'anthropic' | 'openai' | 'azure-openai' | 'near-ai' | 'local';

/**
 * Per-agent model configuration.
 */
export interface AgentModelConfig {
  agentId: string;
  provider: LLMProviderType;
  model: string;
  temperature?: number;
  maxTokens?: number;
  useGlobalDefault?: boolean;
}

/**
 * Agent with full configuration and DID.
 */
export interface AgentWithConfig {
  agentId: string;
  name: string;
  description: string;
  phase: 'Support' | 'Represent' | 'Organize';
  capabilities: string[];
  maxAutonomy: string;
  active: boolean;
  agentDID?: string;
  agentPublicKey?: string;
  modelConfig?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  customModelConfig?: AgentModelConfig | null;
  createdAt: string;
  createdBy: string;
}

/**
 * Agent definition for creating new agents.
 */
export interface AgentDefinition {
  id?: string;
  name: string;
  description: string;
  type: 'governance' | 'strategic' | 'custom';
  phase?: 'Support' | 'Represent' | 'Organize';
  capabilities: string[];
  modelConfig?: {
    provider: LLMProviderType;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  maxAutonomy?: 'NotAutonomous' | 'SemiAutonomous' | 'Autonomous';
  isEnabled?: boolean;
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
 * JSON Schema property for tool parameters.
 */
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
 * JSON Schema for tool input/output.
 */
export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
  additionalProperties?: boolean;
  description?: string;
}

/**
 * Tool configuration.
 */
export interface ToolConfig {
  endpoint?: string;
  timeout?: number;
  rateLimit?: number;
}

/**
 * MCP Tool definition.
 */
export interface MCPTool {
  toolId: string;
  toolDID: string;
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  handler: ToolHandler;
  config?: ToolConfig;
  permissions: string[];
  isEnabled: boolean;
  createdAt: string;
  createdBy: string;
  assignedAgentsCount?: number;
}

/**
 * Tool input for creating tools.
 */
export interface MCPToolInput {
  toolId: string;
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  handler: ToolHandler;
  config?: ToolConfig;
  permissions?: string[];
  isEnabled?: boolean;
}

/**
 * Tool update input.
 */
export type MCPToolUpdate = Partial<Omit<MCPToolInput, 'toolId'>>;

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
  agentId: string;
  role: TeamMemberRole;
  responsibilities: string[];
  canInitiate: boolean;
  canEscalate: boolean;
}

/**
 * Workflow stage definition.
 */
export interface WorkflowStage {
  stageId: string;
  name: string;
  assignedAgents: string[];
  requiredApprovals?: number;
  timeout?: number;
  nextStages: string[];
}

/**
 * Workflow type for team coordination.
 * Phase 51-05 adds: pipeline (output chains as input), supervised (leader routes)
 */
export type WorkflowType = 'sequential' | 'parallel' | 'consensus' | 'hierarchical' | 'pipeline' | 'supervised';

/**
 * Team workflow definition.
 */
export interface TeamWorkflow {
  type: WorkflowType;
  stages: WorkflowStage[];
  humanCheckpoints: string[];
}

/**
 * Escalation policy configuration.
 */
export interface EscalationPolicy {
  enabled: boolean;
  timeoutSeconds: number;
  targets: string[];
  notificationChannels: ('email' | 'slack' | 'webhook')[];
}

/**
 * Agent team configuration.
 */
export interface AgentTeam {
  teamId: string;
  teamDID: string;
  name: string;
  description: string;
  purpose: string;
  members: TeamMember[];
  workflow: TeamWorkflow;
  sharedContext: string[];
  escalationPolicy: EscalationPolicy;
  maxConcurrency: number;
  isEnabled: boolean;
  createdAt: string;
  createdBy: string;
  memberCount?: number;
  /** Problem set IDs this team is assigned to (Phase 51-05) */
  assignedProblemSets?: string[];
  /** Designated leader/orchestrator agent ID (Phase 51-05) */
  leaderId?: string;
}

/**
 * Team input for creating teams.
 */
export interface AgentTeamInput {
  teamId: string;
  name: string;
  description: string;
  purpose: string;
  members: TeamMember[];
  workflow: TeamWorkflow;
  sharedContext?: string[];
  escalationPolicy?: Partial<EscalationPolicy>;
  maxConcurrency?: number;
  isEnabled?: boolean;
}

/**
 * Team update input.
 */
export type AgentTeamUpdate = Partial<Omit<AgentTeamInput, 'teamId'>>;

/**
 * Per-agent execution trace from a team test run.
 */
export interface AgentTestTrace {
  agentId: string;
  role: string;
  input: string;
  output: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Result returned by POST /api/admin/teams/:teamId/test
 */
export interface TeamTestResult {
  teamId: string;
  prompt: string;
  scenario: string | null;
  workflowType: string;
  agentTraces: AgentTestTrace[];
  summary: {
    totalAgents: number;
    successfulAgents: number;
    failedAgents: number;
    totalDurationMs: number;
  };
  success: boolean;
}

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
 * Character communication style.
 */
export interface CharacterStyle {
  all: string[];
  chat: string[];
  post: string[];
}

/**
 * Character voice settings.
 */
export interface CharacterVoiceSettings {
  model?: string;
  voice?: string;
  speed?: number;
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
  name: string;
  bio: string[];
  lore: string[];
  knowledge: string[];
  messageExamples: CharacterMessage[][];
  postExamples: string[];
  topics: string[];
  style: CharacterStyle;
  adjectives: string[];
  modelProvider?: string;
  settings?: CharacterSettings;
  plugins: string[];
}

// ============================================================================
// Phase 51: StandardAgent Admin Types
// ============================================================================

/**
 * Classification clearance level for agents.
 */
export type AgentClearanceLevel = 'Unclassified' | 'CUI' | 'Secret' | 'TopSecret';

/**
 * Agent operational status.
 */
export type AgentStatus = 'active' | 'inactive' | 'degraded' | 'error';

/**
 * Agent skill definition (simplified for admin UI — Zod schemas not included).
 */
export interface AgentSkill {
  skillId: string;
  name: string;
  description: string;
}

/**
 * Phase 51 StandardAgent with health metrics — returned by GET /api/admin/agents.
 */
export interface StandardAgentWithHealth {
  agentId: string;
  name: string;
  description: string;
  status: AgentStatus;
  active: boolean;
  clearance: AgentClearanceLevel;
  systemPrompt?: string;
  skills: AgentSkill[] | string[];
  tools: string[];
  capabilities: string[];
  maxAutonomy: string;
  phase: string;
  agentDID?: string;
  modelConfig?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** Health metrics from agents_v2 DB columns */
  lastInvocation: string | null;
  successRate: number | null;
  avgResponseTimeMs: number | null;
  validationScore: number | null;
  /** Legacy compat */
  customModelConfig?: AgentModelConfig | null;
}

/**
 * Form data for creating/editing a Phase 51 StandardAgent.
 */
export interface StandardAgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  clearance: AgentClearanceLevel;
  skills: string[];
  tools: string[];
  capabilities: string[];
  maxAutonomy: string;
  status: AgentStatus;
  modelConfig?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Memory entry for agent memory viewer.
 */
export interface AgentMemoryEntry {
  entryId: string;
  agentId: string;
  memoryType: 'knowledge' | 'working' | 'episode';
  category?: string;
  content: string;
  importance: number;
  createdAt: string;
  lastAccessed?: string;
  taskId?: string;
}

/**
 * Tool summary for agent tool assignment UI.
 */
export interface ToolSummary {
  toolId: string;
  name: string;
  description: string;
  category: string;
  schema?: Record<string, unknown>;
}

/**
 * Result from POST /api/admin/agents/:agentId/test
 */
export interface AgentTestResult {
  output: string | null;
  durationMs: number;
  agentId: string;
  skill: string | null;
  executionTrace: Array<{
    spanId: string;
    agentId: string;
    operation: string;
    status: 'running' | 'success' | 'error';
    durationMs?: number;
    error?: string;
  }>;
  error?: string;
}

// ============================================================================
// Phase 51-08: Agent Activity Log Types
// ============================================================================

/**
 * Activity action types for agent activity audit trail.
 */
export type ActivityActionType =
  | 'llm_invocation'
  | 'tool_call'
  | 'delegation'
  | 'message_received'
  | 'message_sent'
  | 'action_card'
  | 'checkpoint'
  | 'error'
  | 'team_dispatch'
  | 'specialist_handoff';

/**
 * Activity status values.
 */
export type ActivityStatus = 'success' | 'error' | 'pending' | 'cancelled';

/**
 * A single agent activity log entry.
 */
export interface ActivityEntry {
  id: number;
  activityId: string;
  agentId: string;
  agentName?: string;
  teamId?: string;
  teamName?: string;
  problemSetId?: string;
  actionType: ActivityActionType;
  actionDetail?: string;
  inputSummary?: string;
  outputSummary?: string;
  durationMs?: number;
  status: ActivityStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Filter criteria for activity log queries.
 */
export interface ActivityFilter {
  agentId?: string;
  teamId?: string;
  type?: string;
  problemSetId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Per-agent activity stats breakdown.
 */
export interface AgentActivityStats {
  agentId: string;
  agentName?: string;
  count: number;
  successCount: number;
  errorCount: number;
  avgDurationMs?: number;
}

/**
 * Per-team activity stats breakdown.
 */
export interface TeamActivityStats {
  teamId: string;
  teamName?: string;
  count: number;
}

/**
 * Aggregated activity statistics from GET /api/admin/activity/stats.
 */
export interface ActivityStats {
  total: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
  byAgent: AgentActivityStats[];
  byTeam: TeamActivityStats[];
  byActionType: Record<string, number>;
}

/**
 * Paginated response from GET /api/admin/activity.
 */
export interface ActivityResponse {
  entries: ActivityEntry[];
  total: number;
}

// ============================================================================
// Phase 52: Skill Registry Types
// ============================================================================

/**
 * Skill assignment — which agent has a skill assigned.
 */
export interface SkillAssignment {
  skillId: string;
  agentId: string;
  assignedAt: string;
  assignedBy: string;
}

/**
 * Skill definition returned by the admin API.
 */
export interface AgentSkillDef {
  skillId: string;
  name: string;
  description: string;
  version: string;
  isEnabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Number of agents this skill is assigned to (list endpoint only) */
  assignedAgentCount?: number;
  /** Full JSON Schema for skill input parameters */
  inputSchema?: Record<string, unknown>;
  /** Full JSON Schema for skill output (optional) */
  outputSchema?: Record<string, unknown>;
  /** MCP tool IDs this skill composes */
  toolIds?: string[];
  /** System prompt fragment injected when skill is active */
  systemPromptFragment?: string;
  /** Arbitrary skill-specific metadata */
  metadata?: Record<string, unknown>;
  /** Agent assignments (detail endpoint only) */
  assignments?: SkillAssignment[];
}

/**
 * Input for creating a skill.
 */
export interface AgentSkillInput {
  name: string;
  description: string;
  version?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  toolIds?: string[];
  systemPromptFragment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Partial update for a skill.
 */
export type AgentSkillUpdate = Partial<AgentSkillInput> & { isEnabled?: boolean };
