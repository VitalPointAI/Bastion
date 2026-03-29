/**
 * Graph Construction Service
 *
 * Extracts RAFT entities from text using LLM and populates the Neo4j graph.
 * Processes strategic objectives to build a connected knowledge graph of
 * actors, relationships, and tensions for analysis.
 */

import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { actorStore } from '../raft/actor-store.js';
import { relationshipStore } from '../raft/relationship-store.js';
import { tensionStore } from '../raft/tension-store.js';
import { entityResolutionService } from '../resolution/resolution-service.js';
import { normalizeActorName } from '../resolution/name-normalizer.js';
import { detectContradiction, type AssertionInput } from '../contradiction-detector.js';
import { SOURCE_WEIGHTS, HALF_LIFE_DEFAULTS } from '../confidence-calculator.js';
import type { SourceMethod } from '../provenance-types.js';
import {
  ActorExtractionResponseSchema,
  RelationshipExtractionResponseSchema,
  TensionExtractionResponseSchema,
  type ExtractedActor,
  type ExtractedRelationship,
  type ExtractedTension,
  type GraphExtractionResult,
} from './extraction-schemas.js';
import {
  ACTOR_EXTRACTION_PROMPT,
  RELATIONSHIP_EXTRACTION_PROMPT,
  TENSION_EXTRACTION_PROMPT,
} from './prompts.js';

// ============================================================================
// Types
// ============================================================================

export interface GraphBuildResult {
  /** Number of new actors created */
  actorsCreated: number;
  /** Number of actors merged via entity resolution */
  actorsMerged: number;
  /** Number of relationships created */
  relationshipsCreated: number;
  /** Number of tensions created */
  tensionsCreated: number;
  /** Errors encountered during processing */
  errors: string[];
}

/** Entity created during graph construction — emitted via onEntityCreated callback */
export interface GraphEntityEvent {
  type: 'actor' | 'relationship' | 'tension';
  data: {
    id: string;
    name?: string;
    actorType?: string;
    source?: string;
    target?: string;
    relationshipType?: string;
    strength?: number;
    description?: string;
    intensity?: string;
    domain?: string;
    actors?: string[];
  };
}

export interface GraphBuildOptions {
  /** Workspace ID for multi-tenant isolation */
  workspaceId?: string;
  /** Whether to run entity resolution after building */
  runEntityResolution?: boolean;
  /** Source document ID for provenance tracking */
  sourceDocumentId: string;
  /** Container IDs for container-scoped graph tagging */
  containerIds?: string[];
  /** Provenance: who asserted these entities (user DID or system identifier) */
  assertedBy?: string;
  /** Provenance: which ingestion pathway produced these entities */
  assertedVia?: SourceMethod;
  /** NATO STANAG 2022 source reliability rating (A-F) from doc-intelligence Trust Agent */
  natoSourceReliability?: string;
  /** NATO STANAG 2022 information credibility rating (1-6) from doc-intelligence Trust Agent */
  natoInformationCredibility?: number;
  /** Called when an individual entity is created (for live streaming) */
  onEntityCreated?: (entity: GraphEntityEvent) => void;
  /** Called with running totals after each objective is processed */
  onProgress?: (progress: GraphBuildResult) => void;
}

// ============================================================================
// Graph Builder Class
// ============================================================================

/**
 * Graph Construction Service
 * Extracts RAFT entities from text and populates the graph
 */
export class GraphBuilder {
  private readonly agentId = 'graph-extractor';

  /**
   * Extract actors from text using LLM
   */
  async extractActors(text: string): Promise<ExtractedActor[]> {
    try {
      const llm = await createLLMForAgent({ agentId: this.agentId });

      const response = await llm.invoke([
        { role: 'system', content: ACTOR_EXTRACTION_PROMPT },
        { role: 'user', content: `Extract actors from:\n\n${text}` },
      ]);

      const parsed = this.parseJsonResponse(response.content);
      if (!parsed) return [];

      // Validate with Zod schema
      const result = ActorExtractionResponseSchema.safeParse(parsed);
      if (result.success) {
        return result.data.actors;
      }

      // Try parsing as array directly
      if (Array.isArray(parsed)) {
        return parsed as ExtractedActor[];
      }

      console.error('Actor extraction validation failed:', result.error);
      return [];
    } catch (error) {
      console.error('Actor extraction error:', error);
      return [];
    }
  }

  /**
   * Extract relationships from text using LLM
   */
  async extractRelationships(
    text: string,
    actorNames: string[]
  ): Promise<ExtractedRelationship[]> {
    try {
      const llm = await createLLMForAgent({ agentId: this.agentId });

      const response = await llm.invoke([
        { role: 'system', content: RELATIONSHIP_EXTRACTION_PROMPT },
        { role: 'user', content: `Actors: ${actorNames.join(', ')}\n\nText:\n${text}` },
      ]);

      const parsed = this.parseJsonResponse(response.content);
      if (!parsed) return [];

      // Validate with Zod schema
      const result = RelationshipExtractionResponseSchema.safeParse(parsed);
      if (result.success) {
        return result.data.relationships;
      }

      // Try parsing as array directly
      if (Array.isArray(parsed)) {
        return parsed as ExtractedRelationship[];
      }

      console.error('Relationship extraction validation failed:', result.error);
      return [];
    } catch (error) {
      console.error('Relationship extraction error:', error);
      return [];
    }
  }

  /**
   * Extract tensions from text using LLM
   */
  async extractTensions(
    text: string,
    actorNames: string[]
  ): Promise<ExtractedTension[]> {
    try {
      const llm = await createLLMForAgent({ agentId: this.agentId });

      const response = await llm.invoke([
        { role: 'system', content: TENSION_EXTRACTION_PROMPT },
        { role: 'user', content: `Actors: ${actorNames.join(', ')}\n\nText:\n${text}` },
      ]);

      const parsed = this.parseJsonResponse(response.content);
      if (!parsed) return [];

      // Validate with Zod schema
      const result = TensionExtractionResponseSchema.safeParse(parsed);
      if (result.success) {
        return result.data.tensions;
      }

      // Try parsing as array directly
      if (Array.isArray(parsed)) {
        return parsed as ExtractedTension[];
      }

      console.error('Tension extraction validation failed:', result.error);
      return [];
    } catch (error) {
      console.error('Tension extraction error:', error);
      return [];
    }
  }

  /**
   * Extract all graph entities from text using LLM
   */
  async extractFromText(text: string): Promise<GraphExtractionResult> {
    // Extract actors first
    const actors = await this.extractActors(text);
    const actorNames = actors.map(a => a.name);

    // Extract relationships using actor context
    const relationships = actorNames.length > 0
      ? await this.extractRelationships(text, actorNames)
      : [];

    // Extract tensions using actor context
    const tensions = actorNames.length > 0
      ? await this.extractTensions(text, actorNames)
      : [];

    return { actors, relationships, tensions };
  }

  /**
   * Build graph from a strategic objective
   */
  async buildFromObjective(
    objectiveId: string,
    objectiveText: string,
    options: GraphBuildOptions
  ): Promise<GraphBuildResult> {
    const result: GraphBuildResult = {
      actorsCreated: 0,
      actorsMerged: 0,
      relationshipsCreated: 0,
      tensionsCreated: 0,
      errors: [],
    };

    try {
      // Extract entities from objective text
      const extracted = await this.extractFromText(objectiveText);

      // Resolve provenance from options (default to ai_inference for LLM extraction)
      const assertedVia: SourceMethod = options.assertedVia ?? 'ai_inference';
      const assertedBy = options.assertedBy ?? 'system:llm-extraction';
      const now = new Date().toISOString();

      const provenance = {
        assertedBy,
        assertedVia,
        derivedFrom: [options.sourceDocumentId],
        validFrom: new Date(),
        natoSourceReliability: options.natoSourceReliability,
        natoInformationCredibility: options.natoInformationCredibility,
      };

      // Create actor name to ID mapping for relationship creation
      const actorNameToId = new Map<string, string>();

      // Create or find actors
      for (const actor of extracted.actors) {
        try {
          // Phase 62: Normalize actor name to canonical form before lookup/creation
          // e.g. "PRC" → "China", "DPRK" → "North Korea"
          const canonicalName = normalizeActorName(actor.name);

          // Check if actor already exists (by canonical name)
          const existing = await actorStore.findActorsByName(canonicalName, false);

          if (existing.length > 0) {
            // Actor exists, add alias if new and link to document
            const existingActor = existing[0];
            actorNameToId.set(canonicalName.toLowerCase(), existingActor.id);
            // Also map the original (pre-normalization) name so relationship lookups work
            actorNameToId.set(actor.name.toLowerCase(), existingActor.id);

            // If the raw name differs from canonical, add it as an alias
            if (canonicalName !== actor.name && !existingActor.aliases.includes(actor.name)) {
              await actorStore.addAlias(existingActor.id, actor.name);
            }

            // Also map aliases
            for (const alias of actor.aliases || []) {
              actorNameToId.set(alias.toLowerCase(), existingActor.id);

              // Add any new aliases to existing actor
              if (!existingActor.aliases.includes(alias)) {
                await actorStore.addAlias(existingActor.id, alias);
              }
            }

            // Check for contradictions on affiliation/type property if incoming differs
            if (existingActor.type !== actor.type) {
              const existingAssertion: AssertionInput = {
                id: existingActor.id,
                entityId: existingActor.id,
                propertyKey: 'type',
                value: existingActor.type,
                validFrom: existingActor.validFrom ?? now,
                validTo: existingActor.validTo ?? null,
                confidence: existingActor.confidence ?? SOURCE_WEIGHTS[existingActor.assertedVia ?? 'manual_entry'],
                workspaceId: existingActor.workspaceId,
              };
              const incomingAssertion: AssertionInput = {
                id: `${existingActor.id}-incoming`,
                entityId: existingActor.id,
                propertyKey: 'type',
                value: actor.type,
                validFrom: now,
                validTo: null,
                confidence: SOURCE_WEIGHTS[assertedVia],
                workspaceId: options.workspaceId,
              };
              await detectContradiction(existingAssertion, incomingAssertion).catch(() => {
                // Non-fatal: log but continue
                console.warn(`[Graph Builder] Contradiction check failed for actor ${canonicalName}`);
              });
            }
          } else {
            // Derive half-life from actor type
            const halfLifeDays = actor.type === 'individual'
              ? HALF_LIFE_DEFAULTS['personnel']
              : actor.type === 'nation'
                ? HALF_LIFE_DEFAULTS['geographic']
                : HALF_LIFE_DEFAULTS['political'];

            // Build initial aliases: include the raw name as an alias if it differs
            const initialAliases = [...(actor.aliases || [])];
            if (canonicalName !== actor.name && !initialAliases.includes(actor.name)) {
              initialAliases.push(actor.name);
            }

            // Create new actor with canonical name and JSON-LD provenance
            const newActor = await actorStore.createActor(
              {
                name: canonicalName,
                type: actor.type,
                aliases: initialAliases,
                attributes: actor.role ? { role: actor.role } : {},
                workspaceId: options.workspaceId,
                sourceDocumentIds: [options.sourceDocumentId],
                containerIds: options.containerIds || [],
              },
              { ...provenance, halfLifeDays },
            );
            actorNameToId.set(canonicalName.toLowerCase(), newActor.id);
            // Also map the original name for relationship lookups
            actorNameToId.set(actor.name.toLowerCase(), newActor.id);

            // Map aliases too
            for (const alias of actor.aliases || []) {
              actorNameToId.set(alias.toLowerCase(), newActor.id);
            }

            result.actorsCreated++;
            options.onEntityCreated?.({
              type: 'actor',
              data: { id: newActor.id, name: canonicalName, actorType: actor.type },
            });
          }
        } catch (error) {
          result.errors.push(`Failed to create actor ${actor.name}: ${error}`);
        }
      }

      // Create relationships
      for (const rel of extracted.relationships) {
        try {
          const sourceId = this.resolveActorId(rel.sourceActor, actorNameToId);
          const targetId = this.resolveActorId(rel.targetActor, actorNameToId);

          if (sourceId && targetId) {
            await relationshipStore.createRelationship(
              {
                sourceActorId: sourceId,
                targetActorId: targetId,
                type: rel.type,
                strength: rel.strength ?? 0,
                description: rel.description,
                evidence: [objectiveId],
                workspaceId: options.workspaceId,
                sourceDocumentIds: [options.sourceDocumentId],
                containerIds: options.containerIds || [],
              },
              { ...provenance, halfLifeDays: HALF_LIFE_DEFAULTS['political'] },
            );
            result.relationshipsCreated++;
            options.onEntityCreated?.({
              type: 'relationship',
              data: {
                id: `${sourceId}-${targetId}`,
                source: rel.sourceActor,
                target: rel.targetActor,
                relationshipType: rel.type,
                strength: rel.strength ?? 0,
              },
            });
          } else {
            result.errors.push(
              `Could not resolve actors for relationship: ${rel.sourceActor} -> ${rel.targetActor}`
            );
          }
        } catch (error) {
          result.errors.push(`Failed to create relationship: ${error}`);
        }
      }

      // Create tensions
      for (const tension of extracted.tensions) {
        try {
          const actorIds = tension.actors
            .map(name => this.resolveActorId(name, actorNameToId))
            .filter((id): id is string => id !== undefined);

          if (actorIds.length >= 2) {
            const newTension = await tensionStore.createTension(
              {
                actorIds,
                description: tension.description,
                intensity: tension.intensity,
                domain: tension.domain,
                triggers: [],
                mitigators: [],
                linkedObjectiveIds: [objectiveId],
                workspaceId: options.workspaceId,
                sourceDocumentIds: [options.sourceDocumentId],
                containerIds: options.containerIds || [],
              },
              { ...provenance, halfLifeDays: HALF_LIFE_DEFAULTS['political'] },
            );
            result.tensionsCreated++;
            options.onEntityCreated?.({
              type: 'tension',
              data: {
                id: newTension.id,
                description: tension.description,
                intensity: tension.intensity,
                domain: tension.domain,
                actors: tension.actors,
              },
            });
          } else {
            result.errors.push(
              `Could not resolve enough actors for tension: ${tension.actors.join(', ')}`
            );
          }
        } catch (error) {
          result.errors.push(`Failed to create tension: ${error}`);
        }
      }

      // Run entity resolution if requested
      if (options.runEntityResolution) {
        try {
          const resolution = await entityResolutionService.findDuplicates(options.workspaceId);
          const merges = await entityResolutionService.autoMergeDuplicates(resolution);
          result.actorsMerged = merges.length;
        } catch (error) {
          result.errors.push(`Entity resolution failed: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Graph construction failed: ${error}`);
    }

    return result;
  }

  /**
   * Build graph from all objectives in a document
   */
  async buildFromDocument(
    documentId: string,
    objectives: Array<{ id: string; description: string }>,
    options: Omit<GraphBuildOptions, 'sourceDocumentId'>
  ): Promise<GraphBuildResult> {
    const combined: GraphBuildResult = {
      actorsCreated: 0,
      actorsMerged: 0,
      relationshipsCreated: 0,
      tensionsCreated: 0,
      errors: [],
    };

    console.log(`[Graph Builder] Processing ${objectives.length} objectives from document ${documentId}`);

    for (const objective of objectives) {
      const result = await this.buildFromObjective(objective.id, objective.description, {
        ...options,
        sourceDocumentId: documentId,
        runEntityResolution: false, // Run once at end
      });

      combined.actorsCreated += result.actorsCreated;
      combined.relationshipsCreated += result.relationshipsCreated;
      combined.tensionsCreated += result.tensionsCreated;
      combined.errors.push(...result.errors);

      // Emit running totals after each objective
      options.onProgress?.(combined);
    }

    // Run entity resolution once at the end
    if (options.runEntityResolution !== false) {
      try {
        const resolution = await entityResolutionService.findDuplicates(options.workspaceId);
        const merges = await entityResolutionService.autoMergeDuplicates(resolution);
        combined.actorsMerged = merges.length;
      } catch (error) {
        combined.errors.push(`Entity resolution failed: ${error}`);
      }
    }

    console.log(
      `[Graph Builder] Completed: ${combined.actorsCreated} actors, ` +
      `${combined.relationshipsCreated} relationships, ` +
      `${combined.tensionsCreated} tensions, ` +
      `${combined.actorsMerged} merges, ` +
      `${combined.errors.length} errors`
    );

    return combined;
  }

  /**
   * Resolve actor name to ID (handles case-insensitive matching)
   */
  private resolveActorId(
    name: string,
    actorNameToId: Map<string, string>
  ): string | undefined {
    // Try exact match first
    const exactMatch = actorNameToId.get(name.toLowerCase());
    if (exactMatch) return exactMatch;

    // Try partial match
    for (const [key, id] of actorNameToId.entries()) {
      if (key.includes(name.toLowerCase()) || name.toLowerCase().includes(key)) {
        return id;
      }
    }

    return undefined;
  }

  /**
   * Parse JSON from LLM response (handles markdown code blocks)
   */
  private parseJsonResponse(content: unknown): unknown {
    const text = typeof content === 'string' ? content : JSON.stringify(content);

    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
      return JSON.parse(jsonString);
    } catch {
      // Try to find JSON object or array in the text
      const objectMatch = jsonString.match(/\{[\s\S]*\}/);
      const arrayMatch = jsonString.match(/\[[\s\S]*\]/);

      if (objectMatch) {
        try {
          return JSON.parse(objectMatch[0]);
        } catch {
          // Fall through
        }
      }

      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[0]);
        } catch {
          // Fall through
        }
      }

      console.error('Failed to parse JSON response:', jsonString.substring(0, 200));
      return null;
    }
  }
}

// Export singleton instance
export const graphBuilder = new GraphBuilder();
