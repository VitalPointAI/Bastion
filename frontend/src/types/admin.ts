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
export interface LLMProviderConfig {
  provider: LLMProvider;
  models: LLMModels;
  apiKey: string;
  baseUrl?: string;
  maxRequestsPerMinute: number;
  maxTokensPerDay: number;
  maxCostPerDocument: number;
  alertThreshold: number;
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
