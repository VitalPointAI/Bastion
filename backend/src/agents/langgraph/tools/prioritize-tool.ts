/**
 * Domain Prioritization Tool - LangChain Wrapper
 *
 * Wraps the existing DomainPrioritizer as a LangChain tool
 * that can be invoked by LLM agents.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getDomainPrioritizer,
  type PrioritizeInput,
  type PrioritizeOutput,
} from '../../../strategic/tools/domain-prioritizer.js';

/**
 * Zod schema for prioritization input.
 */
const PrioritizeToolInputSchema = z.object({
  objectives: z
    .array(
      z.object({
        id: z.string().describe('Objective ID'),
        description: z.string().describe('Objective description'),
        currentPriority: z
          .string()
          .optional()
          .describe('Current priority level'),
        metadata: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Additional metadata'),
      })
    )
    .describe('List of objectives to prioritize'),
  domain: z
    .enum(['strategic', 'operational', 'tactical', 'resource'])
    .describe('Domain for weighting presets'),
  criteria: z
    .object({
      urgency: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Weight for urgency criterion'),
      impact: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Weight for impact criterion'),
      feasibility: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Weight for feasibility criterion'),
      risk: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Weight for risk criterion'),
      alignment: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Weight for strategic alignment criterion'),
      dependencies: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe('Weight for dependencies criterion'),
    })
    .optional()
    .describe('Optional custom criteria weights'),
});

/**
 * LangChain tool for domain prioritization.
 *
 * Prioritizes strategic objectives using weighted criteria analysis.
 * Supports different domain presets with different weight distributions:
 * - strategic: emphasizes impact and alignment
 * - operational: balanced with feasibility focus
 * - tactical: emphasizes urgency and feasibility
 * - resource: emphasizes feasibility and impact
 */
export const prioritizeDomainTool = tool(
  async (input: PrioritizeInput): Promise<string> => {
    const prioritizer = getDomainPrioritizer();
    const result: PrioritizeOutput = prioritizer.prioritize(input);

    // Return structured JSON that the LLM can parse
    return JSON.stringify({
      rankedObjectives: result.rankedObjectives,
      summary: result.summary,
      methodology: result.methodology,
    });
  },
  {
    name: 'prioritize_domain',
    description: `Prioritize strategic objectives using weighted criteria analysis.

Domains and their focus:
- strategic: Emphasizes impact (30%) and alignment (20%)
- operational: Balanced with feasibility (25%) and urgency (20%)
- tactical: Emphasizes urgency (35%) and feasibility (25%)
- resource: Emphasizes feasibility (35%) and impact (20%)

Criteria evaluated:
- Urgency: Time-sensitivity of the objective
- Impact: Magnitude of effect if achieved
- Feasibility: Resource and capability availability
- Risk: Potential negative consequences (inverse scored)
- Alignment: How well it supports strategic goals
- Dependencies: Whether it blocks other objectives

Returns ranked objectives with scores, breakdowns, and priority recommendations.`,
    schema: PrioritizeToolInputSchema,
  }
);

/**
 * Get the tool's metadata for registration.
 */
export function getPrioritizeToolMetadata() {
  return {
    toolId: 'prioritize-domain',
    name: 'Domain Prioritization',
    description: 'Prioritize objectives using weighted criteria analysis',
    category: 'analysis' as const,
    version: getDomainPrioritizer().getVersion(),
  };
}
