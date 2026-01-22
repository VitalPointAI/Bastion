/**
 * Graph Construction Module
 *
 * Exports the graph builder and extraction schemas for building
 * RAFT knowledge graphs from strategic documents.
 */

// Graph builder service
export { graphBuilder, GraphBuilder } from './graph-builder.js';
export type { GraphBuildResult, GraphBuildOptions } from './graph-builder.js';

// Extraction schemas
export {
  ExtractedActorSchema,
  ExtractedRelationshipSchema,
  ExtractedTensionSchema,
  GraphExtractionResultSchema,
  ActorExtractionResponseSchema,
  RelationshipExtractionResponseSchema,
  TensionExtractionResponseSchema,
} from './extraction-schemas.js';

export type {
  ExtractedActor,
  ExtractedRelationship,
  ExtractedTension,
  GraphExtractionResult,
  ActorExtractionResponse,
  RelationshipExtractionResponse,
  TensionExtractionResponse,
} from './extraction-schemas.js';

// Prompts
export {
  ACTOR_EXTRACTION_PROMPT,
  RELATIONSHIP_EXTRACTION_PROMPT,
  TENSION_EXTRACTION_PROMPT,
  COMBINED_EXTRACTION_PROMPT,
} from './prompts.js';
