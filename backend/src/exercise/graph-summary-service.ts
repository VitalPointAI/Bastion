/**
 * Graph Summary Service
 *
 * Generates compact text summaries of a container's knowledge graph sub-graph
 * using centrality analysis, temporal boosting, community detection, and a TTL cache.
 * Designed for LLM consumption -- gives AI agents a "strategic picture at a glance."
 */

import {
  fetchAdjacencyListByContainer,
  fetchTensionsByContainer,
  computeEigenvectorCentrality,
  type AdjacencyEntry,
  type EigenvectorResult,
  type ContainerTension,
} from '../graph/tools/raft-tools.js';

// =============================================================================
// TTL Cache
// =============================================================================

/**
 * Generic in-memory TTL cache.
 * Entries expire after ttlMs milliseconds and are lazily evicted on get().
 */
export class TTLCache<T> {
  private cache = new Map<string, { data: T; expiresAt: number }>();

  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries whose key starts with the given prefix.
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

// =============================================================================
// Interfaces
// =============================================================================

export interface GraphSummary {
  topActors: Array<{
    name: string;
    type: string;
    centrality: number;
    temporalRelevance?: string;
  }>;
  keyRelationships: Array<{
    source: string;
    target: string;
    type: string;
    strength: number;
  }>;
  activeTensions: Array<{
    description: string;
    intensity: string;
    domain: string;
    actors: string[];
  }>;
  communityClusters: Array<{
    actors: string[];
    cohesion: number;
  }>;
  summary: string;
}

// =============================================================================
// Community Detection (simple connected-component analysis)
// =============================================================================

/**
 * Detect communities via connected-component analysis on the adjacency list.
 * Returns clusters of actor names with cohesion (internal edges / possible edges).
 */
function detectCommunities(
  adj: Map<string, AdjacencyEntry>
): Array<{ actors: string[]; cohesion: number }> {
  const visited = new Set<string>();
  const components: string[][] = [];

  // BFS to find connected components
  for (const id of adj.keys()) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    visited.add(id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      const entry = adj.get(current);
      if (entry) {
        for (const neighbor of entry.neighbors) {
          if (!visited.has(neighbor.id) && adj.has(neighbor.id)) {
            visited.add(neighbor.id);
            queue.push(neighbor.id);
          }
        }
      }
    }

    if (component.length >= 2) {
      components.push(component);
    }
  }

  // Compute cohesion for each component
  return components.map(component => {
    const memberSet = new Set(component);
    let internalEdges = 0;

    for (const actorId of component) {
      const entry = adj.get(actorId);
      if (entry) {
        for (const neighbor of entry.neighbors) {
          if (memberSet.has(neighbor.id)) {
            internalEdges++;
          }
        }
      }
    }

    // Each edge counted twice (once from each endpoint)
    internalEdges = Math.floor(internalEdges / 2);
    const possibleEdges = (component.length * (component.length - 1)) / 2;
    const cohesion = possibleEdges > 0 ? internalEdges / possibleEdges : 0;

    // Map IDs to names
    const actorNames = component.map(id => adj.get(id)?.name ?? id);

    return { actors: actorNames, cohesion: Math.round(cohesion * 1000) / 1000 };
  }).sort((a, b) => b.actors.length - a.actors.length);
}

// =============================================================================
// Relationship Extraction
// =============================================================================

/**
 * Extract key relationships from adjacency list, sorted by weight (highest first).
 */
function extractKeyRelationships(
  adj: Map<string, AdjacencyEntry>,
  limit: number = 15
): Array<{ source: string; target: string; type: string; strength: number }> {
  const seen = new Set<string>();
  const relationships: Array<{ source: string; target: string; type: string; strength: number }> = [];

  for (const [actorId, entry] of adj) {
    for (const neighbor of entry.neighbors) {
      // Deduplicate bidirectional edges
      const edgeKey = [actorId, neighbor.id].sort().join(':');
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);

      const neighborEntry = adj.get(neighbor.id);
      relationships.push({
        source: entry.name,
        target: neighborEntry?.name ?? neighbor.id,
        type: neighbor.weight >= 0.5 ? 'cooperative' : neighbor.weight <= -0.5 ? 'adversarial' : 'neutral',
        strength: neighbor.weight,
      });
    }
  }

  relationships.sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));
  return relationships.slice(0, limit);
}

// =============================================================================
// Temporal Boosting
// =============================================================================

/**
 * Apply temporal boosting: actors/relationships matching current scenario phase
 * keywords get re-prioritized. Returns the boosted top actors list.
 */
function applyTemporalBoosting(
  topActors: Array<{ name: string; type: string; centrality: number; temporalRelevance?: string }>,
  scenarioPhase: string,
  adj: Map<string, AdjacencyEntry>
): Array<{ name: string; type: string; centrality: number; temporalRelevance?: string }> {
  // Extract keywords from scenario phase name (split on spaces, hyphens, underscores)
  const phaseKeywords = scenarioPhase
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter(kw => kw.length > 2);

  if (phaseKeywords.length === 0) return topActors;

  // Check each actor for temporal relevance
  const boostedActors = topActors.map(actor => {
    const actorLower = actor.name.toLowerCase();
    const isRelevant = phaseKeywords.some(kw => actorLower.includes(kw));

    // Also check if any neighbor descriptions contain phase keywords
    let neighborRelevance = false;
    for (const [, entry] of adj) {
      if (entry.name === actor.name) {
        for (const neighbor of entry.neighbors) {
          const neighborEntry = adj.get(neighbor.id);
          if (neighborEntry) {
            const neighborLower = neighborEntry.name.toLowerCase();
            if (phaseKeywords.some(kw => neighborLower.includes(kw))) {
              neighborRelevance = true;
              break;
            }
          }
        }
        break;
      }
    }

    if (isRelevant || neighborRelevance) {
      return {
        ...actor,
        temporalRelevance: 'active in current phase',
      };
    }
    return actor;
  });

  // Re-sort: temporally relevant actors first, then by centrality
  boostedActors.sort((a, b) => {
    const aRelevant = a.temporalRelevance ? 1 : 0;
    const bRelevant = b.temporalRelevance ? 1 : 0;
    if (aRelevant !== bRelevant) return bRelevant - aRelevant;
    return b.centrality - a.centrality;
  });

  return boostedActors;
}

// =============================================================================
// Summary Text Builder
// =============================================================================

/**
 * Build a compact text summary paragraph for LLM consumption.
 */
function buildSummaryText(
  topActors: Array<{ name: string; type: string; centrality: number; temporalRelevance?: string }>,
  keyRelationships: Array<{ source: string; target: string; type: string; strength: number }>,
  activeTensions: Array<{ description: string; intensity: string; domain: string; actors: string[] }>,
  communityClusters: Array<{ actors: string[]; cohesion: number }>,
  scenarioPhase?: string
): string {
  const parts: string[] = [];

  // Top actors section
  if (topActors.length > 0) {
    const actorList = topActors.slice(0, 5).map(a => {
      const relevance = a.temporalRelevance ? ` [${a.temporalRelevance}]` : '';
      return `${a.name} (${a.type}, centrality: ${a.centrality.toFixed(3)}${relevance})`;
    }).join('; ');
    parts.push(`Key actors: ${actorList}.`);
  }

  // Key dynamics
  const cooperative = keyRelationships.filter(r => r.strength >= 0.3);
  const adversarial = keyRelationships.filter(r => r.strength < -0.3);

  if (cooperative.length > 0) {
    const coopList = cooperative.slice(0, 3).map(r => `${r.source}-${r.target}`).join(', ');
    parts.push(`Cooperative links: ${coopList}.`);
  }

  if (adversarial.length > 0) {
    const advList = adversarial.slice(0, 3).map(r => `${r.source}-${r.target}`).join(', ');
    parts.push(`Adversarial links: ${advList}.`);
  }

  // Active tensions
  const highTensions = activeTensions.filter(t => t.intensity === 'high' || t.intensity === 'critical');
  if (highTensions.length > 0) {
    const tensionList = highTensions.slice(0, 3).map(t =>
      `${t.description} (${t.intensity}, ${t.domain})`
    ).join('; ');
    parts.push(`Critical tensions: ${tensionList}.`);
  } else if (activeTensions.length > 0) {
    parts.push(`${activeTensions.length} active tension(s) across ${[...new Set(activeTensions.map(t => t.domain))].join(', ')} domains.`);
  }

  // Community clusters
  if (communityClusters.length > 1) {
    parts.push(`${communityClusters.length} community cluster(s) detected, largest with ${communityClusters[0].actors.length} actors (cohesion: ${communityClusters[0].cohesion}).`);
  }

  // Phase context
  if (scenarioPhase) {
    parts.push(`Current scenario phase: ${scenarioPhase}.`);
  }

  return parts.join(' ');
}

// =============================================================================
// GraphSummaryService
// =============================================================================

export class GraphSummaryService {
  private summaryCache = new TTLCache<GraphSummary>(5 * 60 * 1000); // 5-minute TTL

  /**
   * Generate a compact graph summary for a container's sub-graph.
   * Returns null if no graph data exists or Neo4j is unavailable.
   */
  async getGraphSummary(
    containerId: string,
    scenarioPhase?: string
  ): Promise<GraphSummary | null> {
    const cacheKey = `${containerId}:${scenarioPhase || 'none'}`;

    // Check cache
    const cached = this.summaryCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Fetch container-scoped adjacency list
      const adj = await fetchAdjacencyListByContainer(containerId);

      // No entities -- return null
      if (adj.size === 0) return null;

      // Run eigenvector centrality analysis
      const centralityResults = computeEigenvectorCentrality(adj);

      // Take top 10 actors by centrality
      let topActors = centralityResults.slice(0, 10).map(r => ({
        name: r.name,
        type: r.type,
        centrality: r.eigenvectorScore,
      }));

      // Fetch active tensions
      const tensions = await fetchTensionsByContainer(containerId);
      const activeTensions = tensions.map(t => ({
        description: t.description,
        intensity: t.intensity,
        domain: t.domain,
        actors: t.actorIds,
      }));

      // Extract key relationships from adjacency list
      const keyRelationships = extractKeyRelationships(adj);

      // Detect community clusters
      const communityClusters = detectCommunities(adj);

      // Apply temporal boosting if scenario phase is provided
      if (scenarioPhase) {
        topActors = applyTemporalBoosting(topActors, scenarioPhase, adj);
      }

      // Build compact summary text for LLM consumption
      const summary = buildSummaryText(
        topActors,
        keyRelationships,
        activeTensions,
        communityClusters,
        scenarioPhase
      );

      const result: GraphSummary = {
        topActors,
        keyRelationships,
        activeTensions,
        communityClusters,
        summary,
      };

      // Cache and return
      this.summaryCache.set(cacheKey, result);
      return result;
    } catch (error) {
      // Graceful degradation: if Neo4j is unavailable, return null
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[GraphSummaryService] Failed to generate summary for container ${containerId}: ${message}`);
      return null;
    }
  }

  /**
   * Invalidate all cached entries for a given container.
   * Called when graph entities are modified in this container.
   */
  invalidateContainer(containerId: string): void {
    this.summaryCache.invalidateByPrefix(`${containerId}:`);
  }
}

/** Singleton instance */
export const graphSummaryService = new GraphSummaryService();
