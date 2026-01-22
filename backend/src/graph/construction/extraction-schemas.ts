/**
 * RAFT Entity Extraction Schemas
 *
 * Zod schemas for LLM extraction of actors, relationships, and tensions
 * from strategic documents. These schemas define the structure of extracted
 * entities before they are transformed into graph nodes.
 */

import { z } from 'zod';

// ============================================================================
// Actor Extraction Schema
// ============================================================================

export const ExtractedActorSchema = z.object({
  name: z.string()
    .describe('Primary name of the actor'),
  type: z.enum(['nation', 'organization', 'individual', 'non_state_actor'])
    .describe('Type of actor'),
  aliases: z.array(z.string()).optional()
    .describe('Alternative names, abbreviations, or aliases'),
  role: z.string().optional()
    .describe('Role this actor plays in the context'),
}).describe('An actor (entity) mentioned in the text');

export type ExtractedActor = z.infer<typeof ExtractedActorSchema>;

// ============================================================================
// Relationship Extraction Schema
// ============================================================================

export const ExtractedRelationshipSchema = z.object({
  sourceActor: z.string()
    .describe('Name of the first actor'),
  targetActor: z.string()
    .describe('Name of the second actor'),
  type: z.enum(['alliance', 'conflict', 'dependency', 'competition', 'cooperation'])
    .describe('Type of relationship'),
  strength: z.number().min(-1).max(1).optional()
    .describe('Relationship strength from -1 (hostile) to 1 (allied)'),
  description: z.string().optional()
    .describe('Brief description of the relationship'),
}).describe('A relationship between two actors');

export type ExtractedRelationship = z.infer<typeof ExtractedRelationshipSchema>;

// ============================================================================
// Tension Extraction Schema
// ============================================================================

export const ExtractedTensionSchema = z.object({
  actors: z.array(z.string()).min(2)
    .describe('Names of actors involved in the tension'),
  description: z.string()
    .describe('Description of the tension or conflict'),
  intensity: z.enum(['low', 'medium', 'high', 'critical'])
    .describe('Intensity level of the tension'),
  domain: z.enum(['political', 'military', 'economic', 'social', 'information'])
    .describe('Domain where tension manifests'),
}).describe('A point of friction or conflict between actors');

export type ExtractedTension = z.infer<typeof ExtractedTensionSchema>;

// ============================================================================
// Combined Extraction Result Schema
// ============================================================================

export const GraphExtractionResultSchema = z.object({
  actors: z.array(ExtractedActorSchema),
  relationships: z.array(ExtractedRelationshipSchema),
  tensions: z.array(ExtractedTensionSchema),
});

export type GraphExtractionResult = z.infer<typeof GraphExtractionResultSchema>;

// ============================================================================
// Response Schemas (for validating LLM responses)
// ============================================================================

export const ActorExtractionResponseSchema = z.object({
  actors: z.array(ExtractedActorSchema),
});

export const RelationshipExtractionResponseSchema = z.object({
  relationships: z.array(ExtractedRelationshipSchema),
});

export const TensionExtractionResponseSchema = z.object({
  tensions: z.array(ExtractedTensionSchema),
});

export type ActorExtractionResponse = z.infer<typeof ActorExtractionResponseSchema>;
export type RelationshipExtractionResponse = z.infer<typeof RelationshipExtractionResponseSchema>;
export type TensionExtractionResponse = z.infer<typeof TensionExtractionResponseSchema>;
