/**
 * Ends-Ways-Means Doctrine Schemas
 * Strategic planning framework per JP 5-0 and Lykke model
 *
 * - Ends: Desired outcomes (what success looks like)
 * - Ways: Strategies and methods (how to achieve)
 * - Means: Resources required (forces, capabilities, funding)
 *
 * @see https://nsiteam.com/social/wp-content/uploads/2019/06/Webb-Andrew-C.-Rethinking-Strategy-Art-Lykke-and-the-Development-of-the-Ends-Ways-Means-Model-of-Strategy-31-MAY-19.pdf
 */

import { z } from 'zod';

/**
 * Ends Schema - Desired outcomes and end states
 * Defines what success looks like for a strategic objective
 */
export const EndsSchema = z.object({
  description: z.string().describe('Desired end state - what success looks like'),
  conditions: z.array(z.string()).describe('Measurable conditions for success'),
  timeframe: z.string().optional().describe('When to achieve the end state'),
});

export type Ends = z.infer<typeof EndsSchema>;

/**
 * Ways Schema - Strategies and methods
 * Defines how to achieve the desired ends
 */
export const WaysSchema = z.object({
  strategies: z.array(z.string()).describe('High-level approaches to achieve ends'),
  concepts: z.array(z.string()).describe('Operational concepts to employ'),
  keyTasks: z.array(z.string()).describe('Essential tasks that must be accomplished'),
});

export type Ways = z.infer<typeof WaysSchema>;

/**
 * Means Schema - Resources required
 * Defines what resources are needed to execute the ways
 */
export const MeansSchema = z.object({
  forces: z.array(z.string()).describe('Military forces required'),
  capabilities: z.array(z.string()).describe('Required capabilities'),
  resources: z.array(z.string()).describe('Funding, materiel, and other resources'),
});

export type Means = z.infer<typeof MeansSchema>;

/**
 * Combined Ends-Ways-Means Schema
 * Complete strategic objective structure per military doctrine
 */
export const EndsWaysMeansSchema = z.object({
  ends: EndsSchema.describe('Desired outcomes - what success looks like'),
  ways: WaysSchema.describe('Strategies and methods - how to achieve ends'),
  means: MeansSchema.describe('Resources required - forces, capabilities, funding'),
});

export type EndsWaysMeans = z.infer<typeof EndsWaysMeansSchema>;
