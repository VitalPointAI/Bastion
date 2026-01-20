/**
 * Strategic Objective Schema
 * Zod schema for strategic objectives per JP 5-0 and military doctrine
 *
 * Captures:
 * - Full Ends-Ways-Means structure
 * - DIME categorization (primary and supporting instruments)
 * - Objective hierarchy (parent/child relationships)
 * - Constraints, assumptions, and risks
 * - Extraction metadata (AI vs human, confidence scores)
 * - Workflow status
 */

import { z } from 'zod';
import { DIMEInstrumentSchema, MidlifeCategorySchema, MidlifeCategorizedBySchema } from './dime.js';
import { EndsWaysMeansSchema } from './ends-ways-means.js';

/**
 * Priority levels for strategic objectives
 */
export const PrioritySchema = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]).describe('Priority level of the strategic objective');

export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Status of a strategic objective in the approval workflow
 */
export const ObjectiveStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'OPERATIONALIZED',
]).describe('Current status of the objective in the approval workflow');

export type ObjectiveStatus = z.infer<typeof ObjectiveStatusSchema>;

/**
 * Extraction source - whether the objective was extracted by human or AI
 */
export const ExtractedBySchema = z.enum([
  'HUMAN',
  'AI',
]).describe('Whether the objective was extracted by human input or AI analysis');

export type ExtractedBy = z.infer<typeof ExtractedBySchema>;

/**
 * Strategic Objective Schema
 * Complete representation of a strategic objective per military doctrine
 */
export const StrategicObjectiveSchema = z.object({
  id: z.string().describe('Unique identifier for this objective'),
  documentId: z.string().describe('Source document ID this objective was extracted from'),
  sourceReference: z.string().describe('Page, section, or paragraph reference in source document'),
  description: z.string().describe('Full text description of the strategic objective'),
  endsWaysMeans: EndsWaysMeansSchema.describe('Ends-Ways-Means breakdown of the objective'),
  primaryInstrument: DIMEInstrumentSchema.describe('Primary DIME category for this objective'),
  supportingInstruments: z.array(DIMEInstrumentSchema).default([])
    .describe('Secondary DIME instruments that support this objective'),
  midlifeCategory: MidlifeCategorySchema.optional()
    .describe('MIDLIFE category: Military, Information, Diplomatic, Legal, Intelligence, Financial, Economic'),
  midlifeCategorizedBy: MidlifeCategorizedBySchema.optional()
    .describe('Whether MIDLIFE category was assigned by AI or human override'),
  midlifeConfidence: z.number().min(0).max(1).optional()
    .describe('Confidence score (0-1) for AI MIDLIFE categorization'),
  parentObjectiveId: z.string().optional()
    .describe('ID of higher-level parent objective in hierarchy'),
  childObjectiveIds: z.array(z.string()).default([])
    .describe('IDs of lower-level supporting objectives'),
  constraints: z.array(z.string())
    .describe('ROE, policy, legal, and other constraints on achieving this objective'),
  assumptions: z.array(z.string())
    .describe('Planning assumptions underlying this objective'),
  risks: z.array(z.string())
    .describe('Identified risks to achieving this objective'),
  status: ObjectiveStatusSchema.default('DRAFT')
    .describe('Current workflow status'),
  priority: PrioritySchema.default('MEDIUM')
    .describe('Priority level of this objective'),
  extractedBy: ExtractedBySchema
    .describe('Whether extracted by human or AI'),
  extractionConfidence: z.number().min(0).max(1).optional()
    .describe('AI confidence score (0-1) if AI-extracted'),
  humanVerified: z.boolean().default(false)
    .describe('Whether a human has verified AI extraction'),
  createdAt: z.date().describe('When this objective was created'),
  updatedAt: z.date().describe('When this objective was last modified'),
});

export type StrategicObjective = z.infer<typeof StrategicObjectiveSchema>;
