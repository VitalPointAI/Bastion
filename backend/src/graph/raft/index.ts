/**
 * RAFT (Relationships, Actors, Functions, Tensions) Module
 *
 * Graph-based strategic environment modeling for operational analysis.
 * Based on ATP 5-0.1 doctrine for understanding operational variables.
 *
 * This module provides:
 * - TypeScript types for RAFT entities
 * - Zod schemas for validation and LLM extraction
 * - Neo4j schema initialization
 * - CRUD operations for Actors, Relationships, and Tensions
 */

// Types
export type {
  ActorType,
  Actor,
  ActorInput,
  RelationshipType,
  Relationship,
  RelationshipInput,
  FunctionDomain,
  ActorFunction,
  ActorFunctionInput,
  TensionIntensity,
  TensionDomain,
  Tension,
  TensionInput,
} from './types.js';

// Zod Schemas
export {
  ActorTypeSchema,
  ActorSchema,
  ActorInputSchema,
  RelationshipTypeSchema,
  RelationshipSchema,
  RelationshipInputSchema,
  FunctionDomainSchema,
  ActorFunctionSchema,
  ActorFunctionInputSchema,
  TensionIntensitySchema,
  TensionDomainSchema,
  TensionSchema,
  TensionInputSchema,
} from './schemas.js';

// Schema initialization
export { initRAFTSchema } from './schema-init.js';

// Stores
export { ActorStore, actorStore } from './actor-store.js';
export { RelationshipStore, relationshipStore } from './relationship-store.js';
export { TensionStore, tensionStore } from './tension-store.js';
