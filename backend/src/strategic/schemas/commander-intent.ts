/**
 * Commander's Intent Schema
 * Zod schema for Commander's Intent per JP 5-0 and FM 6-0
 *
 * Commander's Intent provides purpose, key tasks, and end state to enable
 * mission command and subordinate initiative. Extended to include Klein's
 * 7 facets for robust intent communication.
 *
 * @see https://pavilion.dinfos.edu/Article/Article/2163950/the-elements-of-commanders-intent/
 * @see JP 5-0 Joint Planning
 * @see FM 6-0 Commander and Staff Organization and Operations
 */

import { z } from 'zod';

/**
 * Commander's Intent Schema
 * Captures the commander's vision for mission success
 *
 * Required elements (JP 5-0):
 * - Purpose: Why we are conducting this operation
 * - Key Tasks: What must be accomplished
 * - End State: Conditions that define success
 *
 * Extended elements (Klein's 7 facets):
 * - Expanded Purpose: Broader context
 * - Rationale: Why this approach was chosen
 * - Key Decisions: Decisions subordinates may need to make
 * - Anti-Goals: Outcomes to explicitly avoid
 */
export const CommanderIntentSchema = z.object({
  id: z.string().describe('Unique identifier for this commander\'s intent'),
  objectiveId: z.string().describe('Strategic objective this intent supports'),

  // Required elements (JP 5-0)
  purpose: z.string().describe('Why we are conducting this operation'),
  keyTasks: z.array(z.string()).describe('What must be accomplished'),
  endState: z.string().describe('Conditions that define success'),

  // Extended elements (Klein's 7 facets)
  expandedPurpose: z.string().optional()
    .describe('Broader context and rationale for the operation'),
  rationale: z.string().optional()
    .describe('Why this approach was chosen over alternatives'),
  keyDecisions: z.array(z.string()).optional()
    .describe('Anticipated decisions subordinates may need to make'),
  antiGoals: z.array(z.string()).optional()
    .describe('Outcomes to explicitly avoid'),
  constraints: z.array(z.string()).optional()
    .describe('Weather, ROE, political, or other constraints'),

  // Traceability
  sourceObjectiveId: z.string()
    .describe('ID of the source strategic objective this intent derives from'),

  // Metadata
  issuedBy: z.string().describe('Commander who issued this intent'),
  issuedAt: z.date().describe('When this intent was issued'),
  classification: z.string().describe('Classification level of this intent'),
});

export type CommanderIntent = z.infer<typeof CommanderIntentSchema>;
