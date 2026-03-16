/**
 * Entity MCP Tools
 *
 * MCP tool definitions for searching, matching, and merging entities in the RAFT graph.
 * Used by Entity Resolution Agent for deduplication and alias management.
 */

import type { MCPToolInput } from '../../agents/character-schema.js';
import { actorStore } from '../raft/actor-store.js';
import { relationshipStore } from '../raft/relationship-store.js';
import type { ActorType } from '../raft/types.js';

/**
 * Tool definitions for registration in ToolRegistry
 */
export const entityToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'search_entities',
    name: 'Search Entities',
    description: 'Search the canonical entity registry for actors by name. Supports fuzzy matching to find similar names.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - name or partial name',
        },
        entityType: {
          type: 'string',
          description: 'Filter by entity type',
          enum: ['nation', 'organization', 'individual', 'non_state_actor'],
        },
        workspaceId: {
          type: 'string',
          description: 'Filter by workspace',
        },
        fuzzy: {
          type: 'boolean',
          description: 'Use fuzzy matching for approximate name search',
          default: false,
        },
      },
      required: ['query'],
    },
    handler: 'builtin',
    permissions: ['tool:search_entities'],
    isEnabled: true,
  },
  {
    toolId: 'create_entity_alias',
    name: 'Create Entity Alias',
    description: 'Register an alias for an existing entity. Useful when the same actor is referenced by different names in documents.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        canonicalId: {
          type: 'string',
          description: 'ID of the canonical entity',
        },
        alias: {
          type: 'string',
          description: 'New alias to add',
        },
        source: {
          type: 'string',
          description: 'Document or source where alias was found',
        },
      },
      required: ['canonicalId', 'alias', 'source'],
    },
    handler: 'builtin',
    permissions: ['tool:create_entity_alias'],
    isEnabled: true,
  },
  {
    toolId: 'merge_entities',
    name: 'Merge Entities',
    description: 'Merge duplicate entities into a canonical entity. Transfers all relationships and aliases to the target entity.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        sourceIds: {
          type: 'array',
          description: 'IDs of entities to merge (will be deleted)',
          items: { type: 'string' },
        },
        targetId: {
          type: 'string',
          description: 'ID of the canonical entity to keep',
        },
      },
      required: ['sourceIds', 'targetId'],
    },
    handler: 'builtin',
    permissions: ['tool:merge_entities'],
    isEnabled: true,
  },
  {
    toolId: 'get_entity_references',
    name: 'Get Entity References',
    description: 'Find all document references to an entity. Returns document IDs and objective IDs where the entity appears.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'Entity ID',
        },
      },
      required: ['entityId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_entity_references'],
    isEnabled: true,
  },
];

/**
 * Tool execution handlers
 */
export const entityToolHandlers = {
  /**
   * Search for entities by name.
   * Returns JSON-LD fields (jsonldType, confidence, provenance) in results.
   */
  async search_entities(input: {
    query: string;
    entityType?: ActorType;
    workspaceId?: string;
    fuzzy?: boolean;
  }): Promise<{ entities: unknown[] }> {
    const entities = await actorStore.findActorsByName(input.query, input.fuzzy || false);

    // Apply additional filters
    let filtered = entities;

    if (input.entityType) {
      filtered = filtered.filter(e => e.type === input.entityType);
    }

    if (input.workspaceId) {
      filtered = filtered.filter(e => e.workspaceId === input.workspaceId);
    }

    // Shape with JSON-LD fields for agent consumption
    const shaped = filtered.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      jsonldType: e.jsonldType,
      confidence: e.confidence,
      validFrom: e.validFrom,
      validTo: e.validTo,
      provenance: {
        assertedBy: e.assertedBy,
        assertedVia: e.assertedVia,
        derivedFrom: e.derivedFrom,
      },
      aliases: e.aliases,
      workspaceId: e.workspaceId,
    }));

    return { entities: shaped };
  },

  /**
   * Add an alias to an entity
   */
  async create_entity_alias(input: {
    canonicalId: string;
    alias: string;
    source: string;
  }): Promise<{ success: boolean }> {
    const success = await actorStore.addAlias(input.canonicalId, input.alias);

    // Also update source document IDs if source is a document ID
    if (success && input.source.startsWith('DOC-')) {
      const actor = await actorStore.getActor(input.canonicalId);
      if (actor && !actor.sourceDocumentIds.includes(input.source)) {
        await actorStore.updateActor(input.canonicalId, {
          sourceDocumentIds: [...actor.sourceDocumentIds, input.source],
        });
      }
    }

    return { success };
  },

  /**
   * Merge multiple entities into one
   */
  async merge_entities(input: {
    sourceIds: string[];
    targetId: string;
  }): Promise<{ mergedCount: number; canonicalId: string }> {
    let mergedCount = 0;

    for (const sourceId of input.sourceIds) {
      if (sourceId !== input.targetId) {
        const merged = await actorStore.mergeActors(sourceId, input.targetId);
        if (merged) {
          mergedCount++;
        }
      }
    }

    return { mergedCount, canonicalId: input.targetId };
  },

  /**
   * Get all references to an entity.
   * Returns JSON-LD fields (jsonldType, confidence, provenance) alongside document/objective refs.
   */
  async get_entity_references(input: {
    entityId: string;
  }): Promise<{ documentIds: string[]; objectiveIds: string[]; jsonldType?: string; confidence?: number; provenance?: Record<string, unknown> }> {
    const actor = await actorStore.getActor(input.entityId);

    if (!actor) {
      return { documentIds: [], objectiveIds: [] };
    }

    // Get relationships to find linked objectives (stored in evidence field)
    const relationships = await relationshipStore.getActorRelationships(input.entityId, 'both');
    const objectiveIds = relationships.flatMap(r => r.evidence || []);

    return {
      documentIds: actor.sourceDocumentIds,
      objectiveIds: [...new Set(objectiveIds)],
      jsonldType: actor.jsonldType,
      confidence: actor.confidence,
      provenance: {
        assertedBy: actor.assertedBy,
        assertedVia: actor.assertedVia,
        derivedFrom: actor.derivedFrom,
      },
    };
  },
};
