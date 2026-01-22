/**
 * RAFT (Relationships, Actors, Functions, Tensions) Zod Schemas
 *
 * Validation schemas for RAFT entities with .describe() annotations
 * for LLM extraction guidance. These schemas are designed to be used
 * both for runtime validation and AI-assisted entity extraction.
 */

import { z } from 'zod';

// ============================================================================
// Enum Schemas
// ============================================================================

/**
 * Actor type classification
 */
export const ActorTypeSchema = z.enum([
  'nation',
  'organization',
  'individual',
  'non_state_actor',
]).describe('Type of actor: nation (sovereign states), organization (NGOs, corps), individual (key leaders), or non_state_actor (terrorist groups, militias)');

/**
 * Relationship type classification
 */
export const RelationshipTypeSchema = z.enum([
  'alliance',
  'conflict',
  'dependency',
  'competition',
  'cooperation',
]).describe('Type of relationship: alliance (formal/informal agreement), conflict (hostility), dependency (reliance), competition (vying for resources), cooperation (working together)');

/**
 * Function domain classification (DIME expanded to DIMEFIL)
 */
export const FunctionDomainSchema = z.enum([
  'diplomatic',
  'informational',
  'military',
  'economic',
  'legal',
  'intelligence',
  'financial',
]).describe('Domain of actor function: diplomatic, informational, military, economic, legal, intelligence, or financial');

/**
 * Tension intensity levels
 */
export const TensionIntensitySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]).describe('Intensity level of tension: low (background friction), medium (active disagreement), high (significant conflict potential), critical (imminent crisis)');

/**
 * Tension domain classification (PMESII without infrastructure)
 */
export const TensionDomainSchema = z.enum([
  'political',
  'military',
  'economic',
  'social',
  'information',
]).describe('Domain of tension: political (governance), military (armed conflict), economic (trade/resources), social (cultural/demographic), information (media/narratives)');

// ============================================================================
// Actor Schemas
// ============================================================================

/**
 * Full Actor schema with all fields
 */
export const ActorSchema = z.object({
  id: z.string()
    .describe('Unique identifier in format ACT-{uuid}'),
  name: z.string()
    .describe('Primary name of the actor (e.g., "United States", "NATO", "Vladimir Putin")'),
  type: ActorTypeSchema
    .describe('Classification of actor type'),
  aliases: z.array(z.string())
    .describe('Alternative names used to refer to this actor (e.g., "USA", "America" for United States)'),
  attributes: z.record(z.string(), z.unknown())
    .describe('Flexible key-value attributes like population, GDP, military size, etc.'),
  workspaceId: z.string().optional()
    .describe('Workspace ID for multi-tenant isolation'),
  sourceDocumentIds: z.array(z.string())
    .describe('IDs of documents this actor was extracted from for provenance'),
  createdAt: z.date()
    .describe('Timestamp when this actor record was created'),
  updatedAt: z.date()
    .describe('Timestamp when this actor record was last modified'),
});

/**
 * Actor input schema for creation (no id/timestamps)
 */
export const ActorInputSchema = z.object({
  name: z.string().min(1)
    .describe('Primary name of the actor - required, must be non-empty'),
  type: ActorTypeSchema
    .describe('Classification of actor type - required'),
  aliases: z.array(z.string()).default([])
    .describe('Alternative names for this actor - optional, defaults to empty array'),
  attributes: z.record(z.string(), z.unknown()).default({})
    .describe('Key-value attributes - optional, defaults to empty object'),
  workspaceId: z.string().optional()
    .describe('Workspace ID for isolation - optional'),
  sourceDocumentIds: z.array(z.string()).default([])
    .describe('Source document IDs - optional, defaults to empty array'),
});

// ============================================================================
// Relationship Schemas
// ============================================================================

/**
 * Full Relationship schema with all fields
 */
export const RelationshipSchema = z.object({
  id: z.string()
    .describe('Unique identifier in format REL-{uuid}'),
  sourceActorId: z.string()
    .describe('ID of the actor where the relationship originates'),
  targetActorId: z.string()
    .describe('ID of the actor the relationship points to'),
  type: RelationshipTypeSchema
    .describe('Classification of the relationship type'),
  strength: z.number().min(-1).max(1)
    .describe('Relationship strength from -1.0 (hostile) to 1.0 (allied)'),
  description: z.string().optional()
    .describe('Free-text description of the relationship'),
  evidence: z.array(z.string())
    .describe('Supporting evidence or references for this relationship'),
  temporalStart: z.date().optional()
    .describe('When the relationship began - null if unknown'),
  temporalEnd: z.date().optional()
    .describe('When the relationship ended - null means ongoing'),
  workspaceId: z.string().optional()
    .describe('Workspace ID for multi-tenant isolation'),
  sourceDocumentIds: z.array(z.string())
    .describe('IDs of documents this relationship was extracted from'),
  createdAt: z.date()
    .describe('Timestamp when this relationship record was created'),
  updatedAt: z.date()
    .describe('Timestamp when this relationship record was last modified'),
});

/**
 * Relationship input schema for creation (no id/timestamps)
 */
export const RelationshipInputSchema = z.object({
  sourceActorId: z.string()
    .describe('ID of the source actor - required'),
  targetActorId: z.string()
    .describe('ID of the target actor - required'),
  type: RelationshipTypeSchema
    .describe('Type of relationship - required'),
  strength: z.number().min(-1).max(1)
    .describe('Strength from -1.0 (hostile) to 1.0 (allied) - required'),
  description: z.string().optional()
    .describe('Description of the relationship - optional'),
  evidence: z.array(z.string()).default([])
    .describe('Supporting evidence - optional, defaults to empty array'),
  temporalStart: z.date().optional()
    .describe('When relationship began - optional'),
  temporalEnd: z.date().optional()
    .describe('When relationship ended - optional, null means ongoing'),
  workspaceId: z.string().optional()
    .describe('Workspace ID - optional'),
  sourceDocumentIds: z.array(z.string()).default([])
    .describe('Source document IDs - optional, defaults to empty array'),
});

// ============================================================================
// ActorFunction Schemas
// ============================================================================

/**
 * Full ActorFunction schema with all fields
 */
export const ActorFunctionSchema = z.object({
  id: z.string()
    .describe('Unique identifier in format FUN-{uuid}'),
  actorId: z.string()
    .describe('ID of the actor this function belongs to'),
  domain: FunctionDomainSchema
    .describe('DIMEFIL domain this function operates in'),
  description: z.string()
    .describe('Description of the function or capability'),
  capabilities: z.array(z.string())
    .describe('List of specific capabilities within this function'),
  limitations: z.array(z.string())
    .describe('Known constraints, weaknesses, or limitations'),
  workspaceId: z.string().optional()
    .describe('Workspace ID for multi-tenant isolation'),
  sourceDocumentIds: z.array(z.string())
    .describe('IDs of documents this function was extracted from'),
  createdAt: z.date()
    .describe('Timestamp when this function record was created'),
  updatedAt: z.date()
    .describe('Timestamp when this function record was last modified'),
});

/**
 * ActorFunction input schema for creation (no id/timestamps)
 */
export const ActorFunctionInputSchema = z.object({
  actorId: z.string()
    .describe('ID of the actor this function belongs to - required'),
  domain: FunctionDomainSchema
    .describe('DIMEFIL domain - required'),
  description: z.string().min(1)
    .describe('Description of the function - required, must be non-empty'),
  capabilities: z.array(z.string()).default([])
    .describe('Capabilities - optional, defaults to empty array'),
  limitations: z.array(z.string()).default([])
    .describe('Limitations - optional, defaults to empty array'),
  workspaceId: z.string().optional()
    .describe('Workspace ID - optional'),
  sourceDocumentIds: z.array(z.string()).default([])
    .describe('Source document IDs - optional, defaults to empty array'),
});

// ============================================================================
// Tension Schemas
// ============================================================================

/**
 * Full Tension schema with all fields
 */
export const TensionSchema = z.object({
  id: z.string()
    .describe('Unique identifier in format TEN-{uuid}'),
  actorIds: z.array(z.string()).min(2)
    .describe('IDs of actors involved in this tension (minimum 2)'),
  description: z.string()
    .describe('Description of the tension or point of friction'),
  intensity: TensionIntensitySchema
    .describe('Current intensity level of the tension'),
  domain: TensionDomainSchema
    .describe('Primary domain where this tension manifests'),
  triggers: z.array(z.string())
    .describe('Factors that could escalate this tension'),
  mitigators: z.array(z.string())
    .describe('Factors that could de-escalate this tension'),
  linkedObjectiveIds: z.array(z.string())
    .describe('Strategic objective IDs affected by this tension'),
  workspaceId: z.string().optional()
    .describe('Workspace ID for multi-tenant isolation'),
  sourceDocumentIds: z.array(z.string())
    .describe('IDs of documents this tension was extracted from'),
  createdAt: z.date()
    .describe('Timestamp when this tension record was created'),
  updatedAt: z.date()
    .describe('Timestamp when this tension record was last modified'),
});

/**
 * Tension input schema for creation (no id/timestamps)
 */
export const TensionInputSchema = z.object({
  actorIds: z.array(z.string()).min(2)
    .describe('Actor IDs involved - required, minimum 2 actors'),
  description: z.string().min(1)
    .describe('Description of the tension - required, must be non-empty'),
  intensity: TensionIntensitySchema
    .describe('Intensity level - required'),
  domain: TensionDomainSchema
    .describe('Domain of tension - required'),
  triggers: z.array(z.string()).default([])
    .describe('Escalation triggers - optional, defaults to empty array'),
  mitigators: z.array(z.string()).default([])
    .describe('De-escalation factors - optional, defaults to empty array'),
  linkedObjectiveIds: z.array(z.string()).default([])
    .describe('Linked objective IDs - optional, defaults to empty array'),
  workspaceId: z.string().optional()
    .describe('Workspace ID - optional'),
  sourceDocumentIds: z.array(z.string()).default([])
    .describe('Source document IDs - optional, defaults to empty array'),
});

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type ActorType = z.infer<typeof ActorTypeSchema>;
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
export type FunctionDomain = z.infer<typeof FunctionDomainSchema>;
export type TensionIntensity = z.infer<typeof TensionIntensitySchema>;
export type TensionDomain = z.infer<typeof TensionDomainSchema>;

export type Actor = z.infer<typeof ActorSchema>;
export type ActorInput = z.infer<typeof ActorInputSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type RelationshipInput = z.infer<typeof RelationshipInputSchema>;
export type ActorFunction = z.infer<typeof ActorFunctionSchema>;
export type ActorFunctionInput = z.infer<typeof ActorFunctionInputSchema>;
export type Tension = z.infer<typeof TensionSchema>;
export type TensionInput = z.infer<typeof TensionInputSchema>;
