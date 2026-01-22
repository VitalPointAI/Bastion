/**
 * RAFT Graph MCP Tools
 *
 * MCP tool definitions for RAFT graph operations including:
 * - Actor, relationship, and tension management
 * - Graph algorithms (PageRank, community detection, shortest path)
 * - Graph visualization export
 */

import type { MCPToolInput } from '../../agents/character-schema.js';
import { actorStore } from '../raft/actor-store.js';
import { relationshipStore } from '../raft/relationship-store.js';
import { tensionStore } from '../raft/tension-store.js';
import { executeReadQuery } from '../neo4j-client.js';

/**
 * Tool definitions for registration in ToolRegistry
 */
export const raftToolDefinitions: MCPToolInput[] = [
  // ==========================================================================
  // Actor Management Tools
  // ==========================================================================
  {
    toolId: 'create_actor',
    name: 'Create Actor',
    description: 'Add an actor node to the RAFT graph. Actors are entities that can take action: nations, organizations, individuals, or non-state actors.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Actor name',
        },
        type: {
          type: 'string',
          description: 'Actor type',
          enum: ['nation', 'organization', 'individual', 'non_state_actor'],
        },
        aliases: {
          type: 'array',
          description: 'Alternative names or abbreviations',
          items: { type: 'string' },
        },
        attributes: {
          type: 'object',
          description: 'Additional attributes as key-value pairs',
          additionalProperties: true,
        },
        workspaceId: {
          type: 'string',
          description: 'Optional workspace ID for multi-tenant isolation',
        },
        sourceDocumentIds: {
          type: 'array',
          description: 'Source document IDs where actor was mentioned',
          items: { type: 'string' },
        },
      },
      required: ['name', 'type'],
    },
    handler: 'builtin',
    permissions: ['tool:create_actor'],
    isEnabled: true,
  },
  // ==========================================================================
  // Relationship Management Tools
  // ==========================================================================
  {
    toolId: 'create_relationship',
    name: 'Create Relationship',
    description: 'Add a relationship edge between two actors. Strength ranges from -1.0 (hostile) to 1.0 (allied).',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        sourceActorId: {
          type: 'string',
          description: 'ID of the source actor',
        },
        targetActorId: {
          type: 'string',
          description: 'ID of the target actor',
        },
        type: {
          type: 'string',
          description: 'Relationship type',
          enum: ['alliance', 'conflict', 'dependency', 'competition', 'cooperation'],
        },
        strength: {
          type: 'number',
          description: 'Relationship strength from -1.0 (hostile) to 1.0 (allied)',
          minimum: -1,
          maximum: 1,
        },
        description: {
          type: 'string',
          description: 'Description of the relationship',
        },
        evidence: {
          type: 'array',
          description: 'Evidence supporting this relationship',
          items: { type: 'string' },
        },
        workspaceId: {
          type: 'string',
          description: 'Optional workspace ID',
        },
        sourceDocumentIds: {
          type: 'array',
          description: 'Source document IDs',
          items: { type: 'string' },
        },
      },
      required: ['sourceActorId', 'targetActorId', 'type'],
    },
    handler: 'builtin',
    permissions: ['tool:create_relationship'],
    isEnabled: true,
  },
  // ==========================================================================
  // Tension Management Tools
  // ==========================================================================
  {
    toolId: 'create_tension',
    name: 'Create Tension',
    description: 'Record a tension or point of friction between actors. Tensions represent potential conflict areas.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        actorIds: {
          type: 'array',
          description: 'IDs of actors involved in the tension (minimum 2)',
          items: { type: 'string' },
          minItems: 2,
        },
        description: {
          type: 'string',
          description: 'Description of the tension',
        },
        intensity: {
          type: 'string',
          description: 'Tension intensity level',
          enum: ['low', 'medium', 'high', 'critical'],
        },
        domain: {
          type: 'string',
          description: 'PMESII domain where tension exists',
          enum: ['political', 'military', 'economic', 'social', 'information'],
        },
        triggers: {
          type: 'array',
          description: 'Events or conditions that could escalate the tension',
          items: { type: 'string' },
        },
        mitigators: {
          type: 'array',
          description: 'Factors that could reduce the tension',
          items: { type: 'string' },
        },
        linkedObjectiveIds: {
          type: 'array',
          description: 'Strategic objectives linked to this tension',
          items: { type: 'string' },
        },
        workspaceId: {
          type: 'string',
          description: 'Optional workspace ID',
        },
        sourceDocumentIds: {
          type: 'array',
          description: 'Source document IDs',
          items: { type: 'string' },
        },
      },
      required: ['actorIds', 'description', 'intensity', 'domain'],
    },
    handler: 'builtin',
    permissions: ['tool:create_tension'],
    isEnabled: true,
  },
  {
    toolId: 'update_edge_weight',
    name: 'Update Edge Weight',
    description: 'Modify the strength of a relationship between actors.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        relationshipId: {
          type: 'string',
          description: 'ID of the relationship to update',
        },
        strength: {
          type: 'number',
          description: 'New strength value from -1.0 to 1.0',
          minimum: -1,
          maximum: 1,
        },
        evidence: {
          type: 'string',
          description: 'Evidence supporting the change',
        },
      },
      required: ['relationshipId', 'strength'],
    },
    handler: 'builtin',
    permissions: ['tool:update_edge_weight'],
    isEnabled: true,
  },
  // ==========================================================================
  // Graph Query Tools
  // ==========================================================================
  {
    toolId: 'query_graph',
    name: 'Query Graph',
    description: 'Execute a Cypher query against the RAFT graph database.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        cypher: {
          type: 'string',
          description: 'Cypher query to execute',
        },
        parameters: {
          type: 'object',
          description: 'Query parameters',
          additionalProperties: true,
        },
      },
      required: ['cypher'],
    },
    handler: 'builtin',
    permissions: ['tool:query_graph'],
    isEnabled: true,
  },
  {
    toolId: 'run_graph_algorithm',
    name: 'Run Graph Algorithm',
    description: 'Run a graph algorithm (PageRank, community detection, shortest path, betweenness centrality).',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        algorithm: {
          type: 'string',
          description: 'Algorithm to run',
          enum: ['pagerank', 'louvain', 'shortest_path', 'betweenness_centrality'],
        },
        sourceActorId: {
          type: 'string',
          description: 'Source actor ID (for path algorithms)',
        },
        targetActorId: {
          type: 'string',
          description: 'Target actor ID (for path algorithms)',
        },
        workspaceId: {
          type: 'string',
          description: 'Optional workspace filter',
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['algorithm'],
    },
    handler: 'builtin',
    permissions: ['tool:run_graph_algorithm'],
    isEnabled: true,
  },
  {
    toolId: 'get_actor_profile',
    name: 'Get Actor Profile',
    description: 'Get comprehensive profile of an actor including all relationships and tensions.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: {
          type: 'string',
          description: 'ID of the actor',
        },
      },
      required: ['actorId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_actor_profile'],
    isEnabled: true,
  },
  {
    toolId: 'export_graph_visualization',
    name: 'Export Graph Visualization',
    description: 'Export graph data for visualization in different formats.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'string',
          description: 'Optional workspace filter',
        },
        format: {
          type: 'string',
          description: 'Output format',
          enum: ['nodes_edges', 'd3', 'cytoscape'],
          default: 'nodes_edges',
        },
        includeRelationshipTypes: {
          type: 'array',
          description: 'Filter to specific relationship types',
          items: { type: 'string' },
        },
        maxNodes: {
          type: 'integer',
          description: 'Maximum nodes to include',
          default: 100,
          minimum: 1,
          maximum: 500,
        },
      },
      required: [],
    },
    handler: 'builtin',
    permissions: ['tool:export_graph_visualization'],
    isEnabled: true,
  },
];

// =============================================================================
// Tool Handlers
// =============================================================================

export const raftToolHandlers = {
  /**
   * Create Actor tool handler
   */
  create_actor: async (input: {
    name: string;
    type: 'nation' | 'organization' | 'individual' | 'non_state_actor';
    aliases?: string[];
    attributes?: Record<string, unknown>;
    workspaceId?: string;
    sourceDocumentIds?: string[];
  }) => {
    const actor = await actorStore.createActor(input);
    return { actorId: actor.id, actor };
  },

  /**
   * Create Relationship tool handler
   */
  create_relationship: async (input: {
    sourceActorId: string;
    targetActorId: string;
    type: 'alliance' | 'conflict' | 'dependency' | 'competition' | 'cooperation';
    strength?: number;
    description?: string;
    evidence?: string[];
    workspaceId?: string;
    sourceDocumentIds?: string[];
  }) => {
    const relationship = await relationshipStore.createRelationship({
      ...input,
      strength: input.strength ?? 0,
    });
    return { relationshipId: relationship.id, relationship };
  },

  /**
   * Create Tension tool handler
   */
  create_tension: async (input: {
    actorIds: string[];
    description: string;
    intensity: 'low' | 'medium' | 'high' | 'critical';
    domain: 'political' | 'military' | 'economic' | 'social' | 'information';
    triggers?: string[];
    mitigators?: string[];
    linkedObjectiveIds?: string[];
    workspaceId?: string;
    sourceDocumentIds?: string[];
  }) => {
    const tension = await tensionStore.createTension(input);
    return { tensionId: tension.id, tension };
  },

  /**
   * Update Edge Weight tool handler
   */
  update_edge_weight: async (input: {
    relationshipId: string;
    strength: number;
    evidence?: string;
  }) => {
    const success = await relationshipStore.updateRelationship(input.relationshipId, {
      strength: input.strength,
    });
    return { success };
  },

  /**
   * Query Graph tool handler
   */
  query_graph: async (input: {
    cypher: string;
    parameters?: Record<string, unknown>;
  }) => {
    const result = await executeReadQuery(input.cypher, input.parameters || {});
    return {
      records: result.records.map(r => r.toObject()),
      summary: {
        counters: result.summary.counters.updates(),
        queryType: result.summary.queryType,
      },
    };
  },

  /**
   * Run Graph Algorithm tool handler
   */
  run_graph_algorithm: async (input: {
    algorithm: 'pagerank' | 'louvain' | 'shortest_path' | 'betweenness_centrality';
    sourceActorId?: string;
    targetActorId?: string;
    workspaceId?: string;
    limit?: number;
  }) => {
    const limit = input.limit || 20;
    let cypher: string;
    const params: Record<string, unknown> = {};

    switch (input.algorithm) {
      case 'pagerank':
        // Simple degree-based ranking (approximation without GDS)
        cypher = `
          MATCH (a:Actor)
          OPTIONAL MATCH (a)-[r]-()
          WITH a, count(r) as degree
          RETURN a.id as actorId, a.name as name, a.type as type, degree,
                 toFloat(degree) as score
          ORDER BY degree DESC
          LIMIT $limit
        `;
        params.limit = limit;
        break;

      case 'louvain':
        // Community detection via connected components (approximation)
        cypher = `
          MATCH (a:Actor)-[r:RELATES_TO]-(b:Actor)
          WHERE r.type IN ['alliance', 'cooperation']
          WITH a, collect(DISTINCT b.id) as neighbors
          RETURN a.id as actorId, a.name as name, neighbors,
                 size(neighbors) as communitySize
          ORDER BY communitySize DESC
          LIMIT $limit
        `;
        params.limit = limit;
        break;

      case 'shortest_path':
        if (!input.sourceActorId || !input.targetActorId) {
          return { error: 'shortest_path requires sourceActorId and targetActorId' };
        }
        cypher = `
          MATCH path = shortestPath(
            (a:Actor {id: $sourceId})-[*..10]-(b:Actor {id: $targetId})
          )
          RETURN [n in nodes(path) | {id: n.id, name: n.name, type: n.type}] as path,
                 length(path) as hops
        `;
        params.sourceId = input.sourceActorId;
        params.targetId = input.targetActorId;
        break;

      case 'betweenness_centrality':
        // Simplified betweenness based on relationship count diversity
        cypher = `
          MATCH (a:Actor)-[r:RELATES_TO]-()
          WITH a, count(DISTINCT r.type) as typeCount, count(r) as totalRels
          RETURN a.id as actorId, a.name as name, a.type as type,
                 typeCount, totalRels,
                 typeCount * totalRels as betweennessScore
          ORDER BY betweennessScore DESC
          LIMIT $limit
        `;
        params.limit = limit;
        break;

      default:
        return { error: `Unknown algorithm: ${input.algorithm}` };
    }

    const result = await executeReadQuery(cypher, params);
    return { results: result.records.map(r => r.toObject()) };
  },

  /**
   * Get Actor Profile tool handler
   */
  get_actor_profile: async (input: { actorId: string }) => {
    const actor = await actorStore.getActor(input.actorId);
    if (!actor) {
      return { error: 'Actor not found' };
    }

    const relationships = await relationshipStore.getActorRelationships(input.actorId, 'both');
    const tensions = await tensionStore.getTensionsForActor(input.actorId);

    // Collect related actor IDs
    const relatedActorIds = new Set<string>();
    for (const rel of relationships) {
      relatedActorIds.add(
        rel.sourceActorId === input.actorId ? rel.targetActorId : rel.sourceActorId
      );
    }
    for (const tension of tensions) {
      tension.actorIds.forEach(id => {
        if (id !== input.actorId) relatedActorIds.add(id);
      });
    }

    return {
      actor,
      relationships,
      tensions,
      relatedActorCount: relatedActorIds.size,
      stats: {
        allianceCount: relationships.filter(r => r.type === 'alliance').length,
        conflictCount: relationships.filter(r => r.type === 'conflict').length,
        cooperationCount: relationships.filter(r => r.type === 'cooperation').length,
        competitionCount: relationships.filter(r => r.type === 'competition').length,
        dependencyCount: relationships.filter(r => r.type === 'dependency').length,
        tensionCount: tensions.length,
        highIntensityTensions: tensions.filter(
          t => t.intensity === 'high' || t.intensity === 'critical'
        ).length,
      },
    };
  },

  /**
   * Export Graph Visualization tool handler
   */
  export_graph_visualization: async (input: {
    workspaceId?: string;
    format?: 'nodes_edges' | 'd3' | 'cytoscape';
    includeRelationshipTypes?: string[];
    maxNodes?: number;
  }) => {
    const format = input.format || 'nodes_edges';
    const maxNodes = input.maxNodes || 100;

    // Get actors
    const actors = await actorStore.listActors(input.workspaceId);
    const limitedActors = actors.slice(0, maxNodes);
    const actorIds = new Set(limitedActors.map(a => a.id));

    // Get relationships between these actors
    const allRelationships: Array<{
      source: string;
      target: string;
      type: string;
      strength: number;
      id: string;
    }> = [];

    for (const actor of limitedActors) {
      const rels = await relationshipStore.getActorRelationships(actor.id, 'out');
      for (const rel of rels) {
        if (actorIds.has(rel.targetActorId)) {
          if (
            !input.includeRelationshipTypes ||
            input.includeRelationshipTypes.includes(rel.type)
          ) {
            allRelationships.push({
              id: rel.id,
              source: rel.sourceActorId,
              target: rel.targetActorId,
              type: rel.type,
              strength: rel.strength,
            });
          }
        }
      }
    }

    if (format === 'nodes_edges') {
      return {
        nodes: limitedActors.map(a => ({
          id: a.id,
          label: a.name,
          type: a.type,
          aliases: a.aliases,
        })),
        edges: allRelationships,
      };
    } else if (format === 'd3') {
      return {
        nodes: limitedActors.map(a => ({
          id: a.id,
          name: a.name,
          group: a.type,
        })),
        links: allRelationships.map(r => ({
          source: r.source,
          target: r.target,
          value: Math.abs(r.strength) * 10 || 1,
          type: r.type,
        })),
      };
    } else {
      // cytoscape format
      return {
        elements: {
          nodes: limitedActors.map(a => ({
            data: { id: a.id, label: a.name, type: a.type },
          })),
          edges: allRelationships.map(r => ({
            data: {
              id: r.id,
              source: r.source,
              target: r.target,
              type: r.type,
              strength: r.strength,
            },
          })),
        },
      };
    }
  },
};
