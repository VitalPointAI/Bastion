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
    description: 'Run a graph algorithm (PageRank, eigenvector centrality, community detection, shortest path, betweenness centrality).',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        algorithm: {
          type: 'string',
          description: 'Algorithm to run',
          enum: ['pagerank', 'eigenvector_centrality', 'louvain', 'shortest_path', 'betweenness_centrality'],
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
// Graph Algorithm Helpers (exported for use in API endpoints)
// =============================================================================

/**
 * Adjacency entry for a single actor node
 */
export interface AdjacencyEntry {
  name: string;
  type: string;
  neighbors: Array<{ id: string; weight: number }>;
}

/**
 * Fetch the full adjacency list from Neo4j.
 * Returns a Map<actorId, AdjacencyEntry> for use in power-iteration algorithms.
 * Weights are absolute values of relationship strength (0 when missing).
 */
export async function fetchAdjacencyList(
  workspaceId?: string
): Promise<Map<string, AdjacencyEntry>> {
  let cypher: string;
  const params: Record<string, unknown> = {};

  if (workspaceId) {
    cypher = `
      MATCH (a:Actor {workspaceId: $workspaceId})
      OPTIONAL MATCH (a)-[r:RELATES_TO]-(b:Actor {workspaceId: $workspaceId})
      RETURN a.id as actorId, a.name as name, a.type as type,
             collect({neighborId: b.id, strength: abs(r.strength)}) as neighbors
    `;
    params.workspaceId = workspaceId;
  } else {
    cypher = `
      MATCH (a:Actor)
      OPTIONAL MATCH (a)-[r:RELATES_TO]-(b:Actor)
      RETURN a.id as actorId, a.name as name, a.type as type,
             collect({neighborId: b.id, strength: abs(r.strength)}) as neighbors
    `;
  }

  const result = await executeReadQuery(cypher, params);
  const adjacency = new Map<string, AdjacencyEntry>();

  for (const record of result.records) {
    const actorId = record.get('actorId') as string;
    if (!actorId) continue;

    const name = record.get('name') as string;
    const type = record.get('type') as string;
    const rawNeighbors = record.get('neighbors') as Array<{ neighborId: string | null; strength: number | null }>;

    const neighbors: Array<{ id: string; weight: number }> = rawNeighbors
      .filter(n => n.neighborId !== null && n.neighborId !== undefined)
      .map(n => ({
        id: n.neighborId as string,
        weight: n.strength != null ? n.strength : 0,
      }));

    adjacency.set(actorId, { name, type, neighbors });
  }

  return adjacency;
}

/**
 * Fetch the adjacency list for a specific container's sub-graph.
 * Returns a Map<actorId, AdjacencyEntry> scoped to actors tagged with the given containerId.
 * Used for container-scoped centrality analysis and graph summaries.
 */
export async function fetchAdjacencyListByContainer(
  containerId: string
): Promise<Map<string, AdjacencyEntry>> {
  const now = new Date().toISOString();
  const cypher = `
    MATCH (a:Actor)
    WHERE $containerId IN a.containerIds
      AND (a.validTo IS NULL OR a.validTo > $now)
    OPTIONAL MATCH (a)-[r:RELATES_TO]-(b:Actor)
    WHERE $containerId IN b.containerIds
      AND (b.validTo IS NULL OR b.validTo > $now)
      AND (r.validTo IS NULL OR r.validTo > $now)
    RETURN a.id as actorId, a.name as name, a.type as type,
           collect({neighborId: b.id, strength: abs(r.strength)}) as neighbors
  `;

  const result = await executeReadQuery(cypher, { containerId, now });
  const adjacency = new Map<string, AdjacencyEntry>();

  for (const record of result.records) {
    const actorId = record.get('actorId') as string;
    if (!actorId) continue;

    const name = record.get('name') as string;
    const type = record.get('type') as string;
    const rawNeighbors = record.get('neighbors') as Array<{ neighborId: string | null; strength: number | null }>;

    const neighbors: Array<{ id: string; weight: number }> = rawNeighbors
      .filter(n => n.neighborId !== null && n.neighborId !== undefined)
      .map(n => ({
        id: n.neighborId as string,
        weight: n.strength != null ? n.strength : 0,
      }));

    adjacency.set(actorId, { name, type, neighbors });
  }

  return adjacency;
}

/**
 * Tension data for container-scoped graph summaries
 */
export interface ContainerTension {
  id: string;
  description: string;
  intensity: string;
  domain: string;
  actorIds: string[];
}

/**
 * Fetch tensions scoped to a specific container.
 * Returns tension objects for use in container graph summaries.
 */
export async function fetchTensionsByContainer(
  containerId: string
): Promise<ContainerTension[]> {
  const now = new Date().toISOString();
  const cypher = `
    MATCH (t:Tension)
    WHERE $containerId IN t.containerIds
      AND (t.validTo IS NULL OR t.validTo > $now)
    RETURN t.id as id, t.description as description, t.intensity as intensity,
           t.domain as domain, t.actorIds as actorIds
  `;

  const result = await executeReadQuery(cypher, { containerId, now });

  return result.records.map(record => ({
    id: record.get('id') as string,
    description: record.get('description') as string,
    intensity: record.get('intensity') as string,
    domain: record.get('domain') as string,
    actorIds: record.get('actorIds') as string[] || [],
  }));
}

/**
 * Eigenvector centrality result entry
 */
export interface EigenvectorResult {
  actorId: string;
  name: string;
  type: string;
  eigenvectorScore: number;
  rank: number;
}

/**
 * Compute eigenvector centrality via power iteration (L-infinity normalization).
 * Score for actor i: proportional to sum of (weight * score) of all neighbors.
 * Converges when max delta < epsilon or maxIter is reached.
 */
export function computeEigenvectorCentrality(
  adjacency: Map<string, AdjacencyEntry>,
  maxIter = 100,
  epsilon = 1e-6
): EigenvectorResult[] {
  const ids = Array.from(adjacency.keys());
  const n = ids.length;

  if (n === 0) return [];

  // Initialize uniform scores
  const scores = new Map<string, number>();
  for (const id of ids) {
    scores.set(id, 1 / n);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const newScores = new Map<string, number>();

    for (const id of ids) {
      const entry = adjacency.get(id)!;
      let sum = 0;
      for (const neighbor of entry.neighbors) {
        const nScore = scores.get(neighbor.id) ?? 0;
        sum += neighbor.weight * nScore;
      }
      newScores.set(id, sum);
    }

    // L-infinity normalization (divide by max)
    let maxScore = 0;
    for (const s of newScores.values()) {
      if (s > maxScore) maxScore = s;
    }
    if (maxScore > 0) {
      for (const [id, s] of newScores) {
        newScores.set(id, s / maxScore);
      }
    } else {
      // No edges: uniform convergence
      for (const id of ids) {
        newScores.set(id, 1 / n);
      }
    }

    // Convergence check
    let maxDelta = 0;
    for (const id of ids) {
      const delta = Math.abs((newScores.get(id) ?? 0) - (scores.get(id) ?? 0));
      if (delta > maxDelta) maxDelta = delta;
    }

    // Update scores
    for (const [id, s] of newScores) {
      scores.set(id, s);
    }

    if (maxDelta < epsilon) break;
  }

  // Build sorted result
  const results: EigenvectorResult[] = ids.map(id => ({
    actorId: id,
    name: adjacency.get(id)!.name,
    type: adjacency.get(id)!.type,
    eigenvectorScore: scores.get(id) ?? 0,
    rank: 0,
  }));

  results.sort((a, b) => b.eigenvectorScore - a.eigenvectorScore);
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}

/**
 * PageRank result entry
 */
export interface PageRankResult {
  actorId: string;
  name: string;
  type: string;
  pageRankScore: number;
  rank: number;
}

/**
 * Compute iterative PageRank via power iteration with damping factor.
 * Score for actor i: (1 - d)/N + d * sum(old_score[j] / outDegree[j]) for in-neighbors j.
 * Because RAFT relationships are undirected, each neighbor is treated as an in-neighbor.
 */
export function computePageRank(
  adjacency: Map<string, AdjacencyEntry>,
  damping = 0.85,
  maxIter = 100,
  epsilon = 1e-6
): PageRankResult[] {
  const ids = Array.from(adjacency.keys());
  const n = ids.length;

  if (n === 0) return [];

  const teleport = (1 - damping) / n;

  // Initialize uniform scores
  const scores = new Map<string, number>();
  for (const id of ids) {
    scores.set(id, 1 / n);
  }

  // Compute out-degree (sum of neighbor weights) for each node
  const outDegree = new Map<string, number>();
  for (const id of ids) {
    const entry = adjacency.get(id)!;
    let deg = 0;
    for (const neighbor of entry.neighbors) {
      deg += neighbor.weight > 0 ? neighbor.weight : 1;
    }
    outDegree.set(id, deg || 1); // prevent division by zero for isolated nodes
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const newScores = new Map<string, number>();

    for (const id of ids) {
      const entry = adjacency.get(id)!;
      let inFlow = 0;
      for (const neighbor of entry.neighbors) {
        const nScore = scores.get(neighbor.id) ?? 0;
        const nDeg = outDegree.get(neighbor.id) ?? 1;
        const weight = neighbor.weight > 0 ? neighbor.weight : 1;
        inFlow += (nScore / nDeg) * weight;
      }
      newScores.set(id, teleport + damping * inFlow);
    }

    // Convergence check
    let maxDelta = 0;
    for (const id of ids) {
      const delta = Math.abs((newScores.get(id) ?? 0) - (scores.get(id) ?? 0));
      if (delta > maxDelta) maxDelta = delta;
    }

    // Update scores
    for (const [id, s] of newScores) {
      scores.set(id, s);
    }

    if (maxDelta < epsilon) break;
  }

  // Build sorted result
  const results: PageRankResult[] = ids.map(id => ({
    actorId: id,
    name: adjacency.get(id)!.name,
    type: adjacency.get(id)!.type,
    pageRankScore: scores.get(id) ?? 0,
    rank: 0,
  }));

  results.sort((a, b) => b.pageRankScore - a.pageRankScore);
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}

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
    assertedBy?: string;
    assertedVia?: 'manual_entry' | 'doc_intelligence' | 'osint' | 'vision_pipeline' | 'ai_inference' | 'sigint';
  }) => {
    const actor = await actorStore.createActor(input, {
      assertedBy: input.assertedBy,
      assertedVia: input.assertedVia,
    });
    return {
      actorId: actor.id,
      actor: {
        ...actor,
        jsonldType: actor.jsonldType,
        confidence: actor.confidence,
        provenance: {
          assertedBy: actor.assertedBy,
          assertedVia: actor.assertedVia,
          derivedFrom: actor.derivedFrom,
        },
      },
    };
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
    algorithm: 'pagerank' | 'eigenvector_centrality' | 'louvain' | 'shortest_path' | 'betweenness_centrality';
    sourceActorId?: string;
    targetActorId?: string;
    workspaceId?: string;
    limit?: number;
  }) => {
    const limit = input.limit || 20;
    let cypher: string;
    const params: Record<string, unknown> = {};

    switch (input.algorithm) {
      case 'pagerank': {
        // Iterative PageRank via power iteration (no GDS dependency)
        const adjacency = await fetchAdjacencyList(input.workspaceId);
        const results = computePageRank(adjacency);
        return { results: results.slice(0, limit) };
      }

      case 'eigenvector_centrality': {
        // Eigenvector centrality via power iteration
        const adjacency = await fetchAdjacencyList(input.workspaceId);
        const results = computeEigenvectorCentrality(adjacency);
        return { results: results.slice(0, limit) };
      }

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
   * Returns full JSON-LD semantic entity data for LangGraph agent consumption.
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

    // Compute confidence tier for LangGraph agent interpretation
    function getTier(c: number): 'high' | 'medium' | 'low' {
      if (c > 0.85) return 'high';
      if (c >= 0.5) return 'medium';
      return 'low';
    }

    return {
      actor: {
        id: actor.id,
        name: actor.name,
        type: actor.type,
        jsonldType: actor.jsonldType,
        confidence: actor.confidence,
        confidenceTier: getTier(actor.confidence),
        validFrom: actor.validFrom,
        validTo: actor.validTo,
        provenance: {
          assertedBy: actor.assertedBy,
          assertedVia: actor.assertedVia,
          derivedFrom: actor.derivedFrom,
          sourceWeight: actor.sourceWeight,
        },
        aliases: actor.aliases,
        attributes: actor.attributes,
        workspaceId: actor.workspaceId,
      },
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

    // Compute confidence tier helper
    function getTier(c: number): 'high' | 'medium' | 'low' {
      if (c > 0.85) return 'high';
      if (c >= 0.5) return 'medium';
      return 'low';
    }

    if (format === 'nodes_edges') {
      return {
        nodes: limitedActors.map(a => ({
          id: a.id,
          label: a.name,
          type: a.type,
          jsonldType: a.jsonldType,
          confidence: a.confidence,
          confidenceTier: getTier(a.confidence),
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
          jsonldType: a.jsonldType,
          confidence: a.confidence,
          confidenceTier: getTier(a.confidence),
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
            data: {
              id: a.id,
              label: a.name,
              type: a.type,
              jsonldType: a.jsonldType,
              confidence: a.confidence,
              confidenceTier: getTier(a.confidence),
            },
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
