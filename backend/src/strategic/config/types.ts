/**
 * Admin Configuration Types
 * Type definitions for system configuration management
 */

import { z } from 'zod';

// ============================================================================
// LLM Provider Configuration
// ============================================================================

export const LLMProviderSchema = z.enum(['anthropic', 'openai', 'azure-openai', 'near-ai', 'local']);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

export const LLMModelsSchema = z.object({
  extraction: z.string(),       // e.g., 'claude-sonnet-4-20250514'
  analysis: z.string(),
  summarization: z.string(),
  redTeam: z.string(),
});
export type LLMModels = z.infer<typeof LLMModelsSchema>;

export const OAuthConfigSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),    // Encrypted in database
  accessToken: z.string().optional(),     // Encrypted in database
  refreshToken: z.string().optional(),    // Encrypted in database
  tokenExpiresAt: z.string().optional(),  // ISO 8601 timestamp
  scopes: z.array(z.string()).optional(),
  connected: z.boolean().optional(),
});
export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;

export const LLMProviderConfigSchema = z.object({
  provider: LLMProviderSchema,
  models: LLMModelsSchema,
  apiKey: z.string(),            // Encrypted in database
  baseUrl: z.string().optional(), // For Azure/local
  maxRequestsPerMinute: z.number().int().positive(),
  maxTokensPerDay: z.number().int().positive(),
  maxCostPerDocument: z.number().positive(),
  alertThreshold: z.number().min(0).max(1),
  useLangGraphReview: z.boolean().optional(), // Use LLM-powered LangGraph for document review
  oauth: OAuthConfigSchema.optional(),       // OAuth credentials for providers that support it
});
export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;

export const LLMProviderConfigUpdateSchema = LLMProviderConfigSchema.partial();
export type LLMProviderConfigUpdate = z.infer<typeof LLMProviderConfigUpdateSchema>;

// ============================================================================
// Agent Configuration
// ============================================================================

export const EnabledAgentsSchema = z.object({
  osintCollector: z.boolean(),
  documentProcessor: z.boolean(),
  threatMonitor: z.boolean(),
  fusionAgent: z.boolean(),
  extractionAgent: z.boolean(),
  assessmentAgent: z.boolean(),
  redTeamAgent: z.boolean(),
  devilsAdvocate: z.boolean(),
  coaGenerator: z.boolean(),
});
export type EnabledAgents = z.infer<typeof EnabledAgentsSchema>;

// Per-agent model configuration schema
export const AgentModelConfigSchema = z.object({
  agentId: z.string(),
  provider: LLMProviderSchema,
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  useGlobalDefault: z.boolean().default(false),
});
export type AgentModelConfig = z.infer<typeof AgentModelConfigSchema>;

export const AgentConfigSchema = z.object({
  enabledAgents: EnabledAgentsSchema,
  defaultConfidenceThreshold: z.number().min(0).max(1),
  requireHumanReviewFor: z.array(z.string()),
  agentModelConfigs: z.record(z.string(), AgentModelConfigSchema).optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentConfigUpdateSchema = z.object({
  enabledAgents: EnabledAgentsSchema.partial().optional(),
  defaultConfidenceThreshold: z.number().min(0).max(1).optional(),
  requireHumanReviewFor: z.array(z.string()).optional(),
});
export type AgentConfigUpdate = z.infer<typeof AgentConfigUpdateSchema>;

// ============================================================================
// OSINT Source Configuration
// ============================================================================

export const OSINTSourceTypeSchema = z.enum(['RSS', 'API', 'SCRAPE', 'MANUAL']);
export type OSINTSourceType = z.infer<typeof OSINTSourceTypeSchema>;

export const OSINTSourceConfigSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: OSINTSourceTypeSchema,
  url: z.string().url(),
  credibilityRating: z.number().min(0).max(1),
  enabled: z.boolean(),
  apiKey: z.string().optional(),     // Encrypted in database
  rateLimit: z.number().positive().optional(),
  categories: z.array(z.string()),
  regions: z.array(z.string()),
});
export type OSINTSourceConfig = z.infer<typeof OSINTSourceConfigSchema>;

export const OSINTSourceConfigInputSchema = OSINTSourceConfigSchema.omit({ id: true });
export type OSINTSourceConfigInput = z.infer<typeof OSINTSourceConfigInputSchema>;

export const OSINTSourceConfigUpdateSchema = OSINTSourceConfigSchema.partial().omit({ id: true });
export type OSINTSourceConfigUpdate = z.infer<typeof OSINTSourceConfigUpdateSchema>;

// ============================================================================
// Workflow Configuration
// ============================================================================

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const EscalationTimeoutsSchema = z.object({
  LOW: z.number().positive(),      // hours
  MEDIUM: z.number().positive(),
  HIGH: z.number().positive(),
  EXTREME: z.number().positive(),
});
export type EscalationTimeouts = z.infer<typeof EscalationTimeoutsSchema>;

export const ApprovalAuthoritySchema = z.object({
  riskLevel: RiskLevelSchema,
  requiredRole: z.string(),
  canDelegate: z.boolean(),
});
export type ApprovalAuthority = z.infer<typeof ApprovalAuthoritySchema>;

export const NotificationsConfigSchema = z.object({
  emailOnPending: z.boolean(),
  emailOnEscalation: z.boolean(),
  slackWebhook: z.string().url().optional(),
});
export type NotificationsConfig = z.infer<typeof NotificationsConfigSchema>;

export const WorkflowConfigSchema = z.object({
  escalationTimeouts: EscalationTimeoutsSchema,
  approvalAuthority: z.array(ApprovalAuthoritySchema),
  notifications: NotificationsConfigSchema,
});
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

export const WorkflowConfigUpdateSchema = z.object({
  escalationTimeouts: EscalationTimeoutsSchema.partial().optional(),
  approvalAuthority: z.array(ApprovalAuthoritySchema).optional(),
  notifications: NotificationsConfigSchema.partial().optional(),
});
export type WorkflowConfigUpdate = z.infer<typeof WorkflowConfigUpdateSchema>;

// ============================================================================
// Config Audit Entry
// ============================================================================

export interface ConfigAuditEntry {
  id: string;
  category: string;
  key: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: Date;
  reason?: string;
}

// ============================================================================
// Configuration Categories
// ============================================================================

export const CONFIG_CATEGORIES = {
  LLM: 'llm',
  AGENTS: 'agents',
  WORKFLOW: 'workflow',
  OSINT: 'osint',
} as const;

export const CONFIG_KEYS = {
  LLM_PROVIDER: 'llm.provider',
  AGENT_CONFIG: 'agents.config',
  WORKFLOW_CONFIG: 'workflow.config',
  OSINT_SOURCES: 'osint.sources',
} as const;

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_LLM_CONFIG: LLMProviderConfig = {
  provider: 'anthropic',
  models: {
    extraction: 'claude-haiku-4-5-20251001',
    analysis: 'claude-haiku-4-5-20251001',
    summarization: 'claude-haiku-4-5-20251001',
    redTeam: 'claude-haiku-4-5-20251001',
  },
  apiKey: '',
  maxRequestsPerMinute: 60,
  maxTokensPerDay: 100000,
  maxCostPerDocument: 10.0,
  alertThreshold: 0.8,
  useLangGraphReview: false, // Default to rule-based for backward compatibility
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabledAgents: {
    osintCollector: true,
    documentProcessor: true,
    threatMonitor: true,
    fusionAgent: true,
    extractionAgent: true,
    assessmentAgent: true,
    redTeamAgent: false,        // Disabled by default
    devilsAdvocate: false,      // Disabled by default
    coaGenerator: true,
  },
  defaultConfidenceThreshold: 0.7,
  requireHumanReviewFor: ['HIGH', 'EXTREME'],
};

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  escalationTimeouts: {
    LOW: 24,      // 24 hours
    MEDIUM: 8,    // 8 hours
    HIGH: 4,      // 4 hours
    EXTREME: 2,   // 2 hours
  },
  approvalAuthority: [
    { riskLevel: 'LOW', requiredRole: 'ANALYST', canDelegate: true },
    { riskLevel: 'MEDIUM', requiredRole: 'SENIOR_ANALYST', canDelegate: true },
    { riskLevel: 'HIGH', requiredRole: 'DIVISION_CHIEF', canDelegate: false },
    { riskLevel: 'EXTREME', requiredRole: 'DIRECTOR', canDelegate: false },
  ],
  notifications: {
    emailOnPending: true,
    emailOnEscalation: true,
  },
};
