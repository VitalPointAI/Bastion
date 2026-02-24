/**
 * LLM Extraction Schemas
 * Zod schemas for Instructor-JS LLM extraction with .describe() hints
 *
 * All field descriptions become part of the LLM prompt guidance.
 */

import { z } from 'zod';
import { DIMEInstrumentSchema, MidlifeCategorySchema, PrioritySchema } from '../schemas/index.js';

/**
 * Ends schema for extracted objectives
 * Describes what we want to achieve
 */
const ExtractedEndsSchema = z.object({
  description: z.string().default('')
    .describe('The desired end state or outcome as stated in the document'),
  conditions: z.array(z.string()).default([])
    .describe('Specific conditions that must be met for success'),
  timeframe: z.string().optional()
    .describe('When this objective should be achieved, if specified'),
});

/**
 * Ways schema for extracted objectives
 * Describes how we will achieve the ends
 */
const ExtractedWaysSchema = z.object({
  strategies: z.array(z.string()).default([])
    .describe('Broad strategies or approaches mentioned'),
  concepts: z.array(z.string()).default([])
    .describe('Operational concepts or methods'),
  keyTasks: z.array(z.string()).default([])
    .describe('Specific tasks or actions to execute'),
});

/**
 * Means schema for extracted objectives
 * Describes the resources needed
 */
const ExtractedMeansSchema = z.object({
  forces: z.array(z.string()).default([])
    .describe('Military or personnel forces required'),
  capabilities: z.array(z.string()).default([])
    .describe('Capabilities or competencies needed'),
  resources: z.array(z.string()).default([])
    .describe('Material, financial, or other resources needed'),
});

/**
 * Extracted Objective Schema
 * Simplified schema for LLM output with DIME and EWM fields
 *
 * All descriptions are critical - they become LLM prompt guidance.
 */
export const ExtractedObjectiveSchema = z.object({
  id: z.string().default('OBJ-000')
    .describe('Unique identifier for this objective, format: OBJ-{sequential number starting from 001}'),

  description: z.string()
    .describe('Full text of the strategic objective as stated in the document'),

  ends: ExtractedEndsSchema.default({ description: '', conditions: [] })
    .describe('The desired outcome (Ends) - what we want to achieve'),

  ways: ExtractedWaysSchema.default({ strategies: [], concepts: [], keyTasks: [] })
    .describe('The approach (Ways) - how we will achieve the ends'),

  means: ExtractedMeansSchema.default({ forces: [], capabilities: [], resources: [] })
    .describe('The resources (Means) - what we need to execute the ways'),

  dimeCategory: DIMEInstrumentSchema.default('INFORMATIONAL')
    .describe('Primary DIME category based on objective focus: DIPLOMATIC (foreign policy, alliances), INFORMATIONAL (communications, influence), MILITARY (armed forces, defense), or ECONOMIC (trade, sanctions, finance)'),

  supportingDIME: z.array(DIMEInstrumentSchema).default([])
    .describe('Secondary DIME instruments that support this objective'),

  midlifeCategory: MidlifeCategorySchema.default('INFORMATION')
    .describe('MIDLIFE category: MILITARY (armed forces, defense), INFORMATION (communications, media, cyber), DIPLOMATIC (foreign relations, treaties), LEGAL (international/domestic law), INTELLIGENCE (collection, analysis), FINANCIAL (banking, sanctions), or ECONOMIC (trade, resources, development)'),

  midlifeConfidence: z.number().min(0).max(1).default(0.5)
    .describe('Confidence score (0-1) for MIDLIFE categorization. Higher when language clearly indicates category.'),

  priority: PrioritySchema.default('MEDIUM')
    .describe('Assessed priority based on language (e.g., "critical", "vital", "important") and positioning in document'),

  constraints: z.array(z.string()).default([])
    .describe('Stated limitations, restrictions, or rules that constrain how this objective can be achieved'),

  assumptions: z.array(z.string()).default([])
    .describe('Stated or implied assumptions underlying this objective'),

  risks: z.array(z.string()).default([])
    .describe('Identified risks to achieving this objective'),

  sourceReference: z.string().default('Not specified')
    .describe('Exact location in document: page number, section title, or paragraph number for traceability'),
});

/**
 * Chunk Extraction Result Schema
 * Result from extracting objectives from a single text chunk
 */
export const ChunkExtractionResultSchema = z.object({
  objectives: z.array(ExtractedObjectiveSchema)
    .describe('All strategic objectives found in this chunk'),

  chunkSummary: z.string()
    .describe('Brief 1-2 sentence summary of what this chunk covers'),

  extractionConfidence: z.number().min(0).max(1)
    .describe('Confidence in extraction quality (0=low, 1=high). Lower if text is ambiguous, unclear, or objectives are implicit rather than explicit'),
});

/**
 * Document Extraction Result Schema
 * Consolidated result from extracting objectives from an entire document
 */
export const DocumentExtractionResultSchema = z.object({
  objectives: z.array(ExtractedObjectiveSchema)
    .describe('All unique strategic objectives extracted from the document'),

  documentSummary: z.string()
    .describe('2-3 sentence executive summary of the document purpose and key themes'),

  documentLevel: z.enum(['NSS', 'NDS', 'NMS', 'GEF', 'JSCP', 'CAMPAIGN_PLAN', 'OTHER'])
    .describe('Document hierarchy level: NSS=National Security Strategy, NDS=National Defense Strategy, NMS=National Military Strategy, GEF=Guidance for Employment of the Force, JSCP=Joint Strategic Capabilities Plan, CAMPAIGN_PLAN=Theater/Campaign Plan, OTHER=Other document type'),

  overallConfidence: z.number().min(0).max(1)
    .describe('Overall confidence in extraction quality across all objectives'),
});
