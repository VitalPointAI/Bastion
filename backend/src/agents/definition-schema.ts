/**
 * Agent Definition Schema
 *
 * Zod schema for validating agent definitions in admin API.
 */

import { z } from 'zod';
import { LLMProviderSchema } from '../strategic/config/types.js';

/**
 * Schema for creating/updating agent definitions via admin API.
 */
export const AgentDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum(['governance', 'strategic', 'custom']),
  phase: z.enum(['Support', 'Represent', 'Organize']).optional().default('Support'),
  capabilities: z.array(z.string()),
  modelConfig: z.object({
    provider: LLMProviderSchema,
    model: z.string(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().positive().optional(),
  }).optional(),
  maxAutonomy: z.enum(['NotAutonomous', 'SemiAutonomous', 'Autonomous']).optional().default('NotAutonomous'),
  isEnabled: z.boolean().default(true),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
