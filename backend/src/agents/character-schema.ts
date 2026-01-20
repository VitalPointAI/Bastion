/**
 * Character Schema
 *
 * Zod schemas for Eliza-compatible character definitions, MCP tools, and agent teams.
 * These schemas enable rich personality configuration for AI agents.
 */

import { z } from 'zod';

// ============================================================================
// Message Examples Schema
// ============================================================================

/**
 * Schema for individual messages in a conversation example.
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

/**
 * Schema for a conversation example (array of message pairs).
 */
export const MessageExampleSchema = z.array(MessageSchema);

// ============================================================================
// Voice Settings Schema
// ============================================================================

/**
 * Schema for voice configuration settings.
 */
export const VoiceSettingsSchema = z.object({
  model: z.string().optional(),
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2).optional(),
}).optional();

// ============================================================================
// Character Style Schema
// ============================================================================

/**
 * Schema for character communication style.
 */
export const CharacterStyleSchema = z.object({
  /** Universal style traits that apply to all communication */
  all: z.array(z.string()).default([]),
  /** Chat-specific style traits */
  chat: z.array(z.string()).default([]),
  /** Post/social media-specific style traits */
  post: z.array(z.string()).default([]),
});

// ============================================================================
// Character Settings Schema
// ============================================================================

/**
 * Schema for character settings.
 */
export const CharacterSettingsSchema = z.object({
  /** Voice configuration */
  voice: VoiceSettingsSchema,
  /** Secret values (not exposed in responses) */
  secrets: z.record(z.string(), z.string()).optional(),
});

// ============================================================================
// Character Schema (Eliza-compatible)
// ============================================================================

/**
 * Main character schema following Eliza character file format.
 * Enables rich personality configuration for AI agents.
 */
export const CharacterSchema = z.object({
  /** Character's name */
  name: z.string().min(1).max(100),

  /** Array of biography entries describing the character */
  bio: z.array(z.string()).default([]),

  /** Backstory and history entries */
  lore: z.array(z.string()).default([]),

  /** RAG-ready knowledge base entries */
  knowledge: z.array(z.string()).default([]),

  /** Conversation examples for few-shot learning */
  messageExamples: z.array(MessageExampleSchema).default([]),

  /** Social media style examples */
  postExamples: z.array(z.string()).default([]),

  /** Topics of interest the character engages with */
  topics: z.array(z.string()).default([]),

  /** Communication style configuration */
  style: CharacterStyleSchema.default({ all: [], chat: [], post: [] }),

  /** Personality descriptors/adjectives */
  adjectives: z.array(z.string()).default([]),

  /** LLM provider for this character (optional override) */
  modelProvider: z.string().optional(),

  /** Character settings */
  settings: CharacterSettingsSchema.optional(),

  /** Enabled plugins/tools for this character */
  plugins: z.array(z.string()).default([]),
});

// ============================================================================
// Tool Category Enum
// ============================================================================

/**
 * MCP tool categories.
 */
export const ToolCategorySchema = z.enum(['data', 'action', 'integration', 'analysis']);

// ============================================================================
// JSON Schema (for tool input/output definitions)
// ============================================================================

/**
 * JSON Schema definition for tool parameters.
 * Follows JSON Schema draft-07 format.
 */
export const JSONSchemaPropertySchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.object({
    type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']).optional(),
    description: z.string().optional(),
    enum: z.array(z.unknown()).optional(),
    default: z.unknown().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    items: z.lazy(() => JSONSchemaPropertySchema).optional(),
    properties: z.record(z.string(), z.lazy(() => JSONSchemaPropertySchema)).optional(),
    required: z.array(z.string()).optional(),
    additionalProperties: z.union([z.boolean(), z.lazy(() => JSONSchemaPropertySchema)]).optional(),
  }).passthrough()
);

export const JSONSchemaSchema = z.object({
  type: z.literal('object').default('object'),
  properties: z.record(z.string(), JSONSchemaPropertySchema).default({}),
  required: z.array(z.string()).default([]),
  additionalProperties: z.boolean().optional(),
  description: z.string().optional(),
}).passthrough();

// ============================================================================
// MCP Tool Schema
// ============================================================================

/**
 * Schema for tool handler types.
 */
export const ToolHandlerSchema = z.enum(['builtin', 'webhook', 'function']);

/**
 * Schema for tool configuration.
 */
export const ToolConfigSchema = z.object({
  /** Webhook endpoint for webhook handlers */
  endpoint: z.string().url().optional(),
  /** Request timeout in milliseconds */
  timeout: z.number().min(1000).max(300000).optional(),
  /** Rate limit (requests per minute) */
  rateLimit: z.number().min(1).max(1000).optional(),
});

/**
 * Schema for MCP tool registration.
 * Follows MCP (Model Context Protocol) tool definition format.
 */
export const MCPToolSchema = z.object({
  /** Unique tool identifier */
  toolId: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i, 'Tool ID must be alphanumeric with underscores/hyphens'),

  /** Tool DID (assigned during registration) */
  toolDID: z.string().optional(),

  /** Human-readable tool name */
  name: z.string().min(1).max(100),

  /** Tool description */
  description: z.string().min(1).max(500),

  /** Tool category */
  category: ToolCategorySchema,

  /** JSON Schema for input parameters */
  inputSchema: JSONSchemaSchema,

  /** JSON Schema for expected output format (optional) */
  outputSchema: JSONSchemaSchema.optional(),

  /** Handler type */
  handler: ToolHandlerSchema,

  /** Tool configuration */
  config: ToolConfigSchema.optional(),

  /** Required ABAC permissions to use this tool */
  permissions: z.array(z.string()).default([]),

  /** Whether the tool is enabled */
  isEnabled: z.boolean().default(true),

  /** Creation timestamp */
  createdAt: z.string().datetime().optional(),

  /** Creator's DID */
  createdBy: z.string().optional(),
});

/**
 * Schema for MCP tool creation input (without auto-generated fields).
 */
export const MCPToolInputSchema = MCPToolSchema.omit({
  toolDID: true,
  createdAt: true,
  createdBy: true,
});

/**
 * Schema for MCP tool update input.
 */
export const MCPToolUpdateSchema = MCPToolSchema.partial().omit({
  toolId: true,
  toolDID: true,
  createdAt: true,
  createdBy: true,
});

// ============================================================================
// Team Member Schema
// ============================================================================

/**
 * Schema for team member roles.
 */
export const TeamMemberRoleSchema = z.enum(['coordinator', 'specialist', 'validator', 'executor']);

/**
 * Schema for team member configuration.
 */
export const TeamMemberSchema = z.object({
  /** Agent ID */
  agentId: z.string().min(1),

  /** Member's role in the team */
  role: TeamMemberRoleSchema,

  /** Member's responsibilities */
  responsibilities: z.array(z.string()).default([]),

  /** Can this member initiate workflows? */
  canInitiate: z.boolean().default(false),

  /** Can this member escalate to human? */
  canEscalate: z.boolean().default(true),
});

// ============================================================================
// Team Workflow Schema
// ============================================================================

/**
 * Schema for workflow types.
 */
export const WorkflowTypeSchema = z.enum(['sequential', 'parallel', 'consensus', 'hierarchical']);

/**
 * Schema for workflow stage.
 */
export const WorkflowStageSchema = z.object({
  /** Stage identifier */
  stageId: z.string().min(1),

  /** Stage name */
  name: z.string().min(1).max(100),

  /** Agent IDs responsible for this stage */
  assignedAgents: z.array(z.string()).default([]),

  /** Required approval count (for consensus workflows) */
  requiredApprovals: z.number().min(1).optional(),

  /** Timeout in seconds */
  timeout: z.number().min(60).max(86400).optional(),

  /** Next stages (for parallel/branching workflows) */
  nextStages: z.array(z.string()).default([]),
});

/**
 * Schema for team workflow definition.
 */
export const TeamWorkflowSchema = z.object({
  /** Workflow type */
  type: WorkflowTypeSchema,

  /** Workflow stages */
  stages: z.array(WorkflowStageSchema).default([]),

  /** Stage IDs requiring human approval */
  humanCheckpoints: z.array(z.string()).default([]),
});

// ============================================================================
// Escalation Policy Schema
// ============================================================================

/**
 * Schema for escalation policy.
 */
export const EscalationPolicySchema = z.object({
  /** Enable automatic escalation */
  enabled: z.boolean().default(true),

  /** Timeout before escalation (in seconds) */
  timeoutSeconds: z.number().min(60).max(86400).default(3600),

  /** Escalation targets (DID or role) */
  targets: z.array(z.string()).default([]),

  /** Notification channels */
  notificationChannels: z.array(z.enum(['email', 'slack', 'webhook'])).default([]),
});

// ============================================================================
// Agent Team Schema
// ============================================================================

/**
 * Schema for agent team configuration.
 */
export const AgentTeamSchema = z.object({
  /** Unique team identifier */
  teamId: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/i, 'Team ID must be alphanumeric with underscores/hyphens'),

  /** Team DID (assigned during creation) */
  teamDID: z.string().optional(),

  /** Team name */
  name: z.string().min(1).max(100),

  /** Team description */
  description: z.string().min(1).max(500),

  /** Team's mission statement/purpose */
  purpose: z.string().min(1).max(1000),

  /** Team members */
  members: z.array(TeamMemberSchema).default([]),

  /** Workflow definition */
  workflow: TeamWorkflowSchema,

  /** Context keys shared between members */
  sharedContext: z.array(z.string()).default([]),

  /** Escalation policy */
  escalationPolicy: EscalationPolicySchema.default({
    enabled: true,
    timeoutSeconds: 3600,
    targets: [],
    notificationChannels: [],
  }),

  /** Maximum concurrent workflow executions */
  maxConcurrency: z.number().min(1).max(100).default(5),

  /** Whether the team is enabled */
  isEnabled: z.boolean().default(true),

  /** Creation timestamp */
  createdAt: z.string().datetime().optional(),

  /** Creator's DID */
  createdBy: z.string().optional(),
});

/**
 * Schema for agent team creation input (without auto-generated fields).
 */
export const AgentTeamInputSchema = AgentTeamSchema.omit({
  teamDID: true,
  createdAt: true,
  createdBy: true,
});

/**
 * Schema for agent team update input.
 */
export const AgentTeamUpdateSchema = AgentTeamSchema.partial().omit({
  teamId: true,
  teamDID: true,
  createdAt: true,
  createdBy: true,
});

// ============================================================================
// Type Exports
// ============================================================================

export type Message = z.infer<typeof MessageSchema>;
export type MessageExample = z.infer<typeof MessageExampleSchema>;
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;
export type CharacterStyle = z.infer<typeof CharacterStyleSchema>;
export type CharacterSettings = z.infer<typeof CharacterSettingsSchema>;
export type Character = z.infer<typeof CharacterSchema>;

export type ToolCategory = z.infer<typeof ToolCategorySchema>;
export type ToolHandler = z.infer<typeof ToolHandlerSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type JSONSchema = z.infer<typeof JSONSchemaSchema>;
export type MCPTool = z.infer<typeof MCPToolSchema>;
export type MCPToolInput = z.infer<typeof MCPToolInputSchema>;
export type MCPToolUpdate = z.infer<typeof MCPToolUpdateSchema>;

export type TeamMemberRole = z.infer<typeof TeamMemberRoleSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type TeamWorkflow = z.infer<typeof TeamWorkflowSchema>;
export type EscalationPolicy = z.infer<typeof EscalationPolicySchema>;
export type AgentTeam = z.infer<typeof AgentTeamSchema>;
export type AgentTeamInput = z.infer<typeof AgentTeamInputSchema>;
export type AgentTeamUpdate = z.infer<typeof AgentTeamUpdateSchema>;
