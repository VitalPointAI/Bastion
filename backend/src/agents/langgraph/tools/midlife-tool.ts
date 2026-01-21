/**
 * MIDLIFE Categorization Tool - LangChain Wrapper
 *
 * Wraps the existing MidlifeCategorizer as a LangChain tool
 * that can be invoked by LLM agents.
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  getMidlifeCategorizer,
  type MidlifeCategorizeInput,
  type MidlifeCategorizeOutput,
} from '../../../strategic/tools/midlife-categorizer.js';

/**
 * Zod schema for MIDLIFE categorization input.
 */
const MidlifeToolInputSchema = z.object({
  objectiveId: z.string().describe('Unique identifier for the objective'),
  description: z.string().describe('Full text description of the strategic objective'),
  context: z
    .object({
      documentLevel: z
        .string()
        .optional()
        .describe('Level of source document (e.g., NSS, NDS)'),
      dimeCategory: z
        .string()
        .optional()
        .describe('Existing DIME categorization if available'),
      keywords: z
        .array(z.string())
        .optional()
        .describe('Additional keywords from document'),
    })
    .optional()
    .describe('Optional context for categorization'),
});

/**
 * LangChain tool for MIDLIFE categorization.
 *
 * Analyzes a strategic objective and determines its MIDLIFE category:
 * - MILITARY: Armed forces, defense, combat
 * - INFORMATION: Communications, influence, cyber
 * - DIPLOMATIC: Foreign relations, treaties, alliances
 * - LEGAL: International/domestic law, ROE
 * - INTELLIGENCE: Collection, analysis, ISR
 * - FINANCIAL: Banking, sanctions, monetary
 * - ECONOMIC: Trade, resources, production
 */
export const categorizeMidlifeTool = tool(
  async (input: MidlifeCategorizeInput): Promise<string> => {
    const categorizer = getMidlifeCategorizer();
    const result: MidlifeCategorizeOutput = categorizer.categorize(input);

    // Return structured JSON that the LLM can parse
    return JSON.stringify({
      category: result.category,
      confidence: result.confidence,
      rationale: result.rationale,
      alternativeCategories: result.alternativeCategories,
      indicators: result.indicators,
    });
  },
  {
    name: 'categorize_midlife',
    description: `Analyze a strategic objective and determine its MIDLIFE category.
MIDLIFE Framework:
- MILITARY: Armed forces, defense capabilities, force posture, military operations
- INFORMATION: Communications, media, cyber operations, influence, narrative control
- DIPLOMATIC: Foreign relations, treaties, alliances, international cooperation
- LEGAL: International law, domestic law, rules of engagement, legal frameworks
- INTELLIGENCE: Collection, analysis, counterintelligence, reconnaissance, ISR
- FINANCIAL: Banking, sanctions, monetary policy, financial warfare
- ECONOMIC: Trade, resources, development, industrial base, economic statecraft

Returns the primary category with confidence score, rationale, and alternative considerations.`,
    schema: MidlifeToolInputSchema,
  }
);

/**
 * Get the tool's metadata for registration.
 */
export function getMidlifeToolMetadata() {
  return {
    toolId: 'categorize-midlife',
    name: 'MIDLIFE Categorization',
    description: 'Analyze strategic objectives using the MIDLIFE framework',
    category: 'analysis' as const,
    version: getMidlifeCategorizer().getVersion(),
  };
}
