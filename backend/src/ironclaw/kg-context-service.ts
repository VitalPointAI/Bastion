/**
 * KG Context Service
 *
 * Provides always-available knowledge graph context for every Ironclaw
 * conversation. Wraps GraphSummaryService (centrality analysis, community
 * detection, temporal boosting, 5-min TTL cache) and formats output for
 * injection into message preambles.
 *
 * Both the main Ironclaw chat path and the design interview path use this
 * single service, replacing prior duplicated/divergent implementations.
 *
 * Key constraints:
 * - Ironclaw sidecar is network-isolated (no Neo4j / main PG access)
 * - All KG data must flow through the backend as message preamble text
 * - Must never block message flow (300ms timeout with graceful degradation)
 */

import { graphSummaryService, TTLCache } from '../exercise/graph-summary-service.js';
import type { GraphSummary } from '../exercise/graph-summary-service.js';
import { getPool } from '../lib/database.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters for per-message KG context block. */
const MESSAGE_CHAR_BUDGET = 2000;

/** Timeout for context assembly (never blocks message flow). */
const CONTEXT_TIMEOUT_MS = 300;

/** TTL for problemSetId → containerId[] mapping cache. */
const CONTAINER_MAPPING_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// KGContextService
// ---------------------------------------------------------------------------

export class KGContextService {
  /** Cache: problemSetId → container IDs */
  private containerMapping = new TTLCache<string[]>(CONTAINER_MAPPING_TTL_MS);

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Get a character-budgeted KG context block for injection into a message
   * preamble. Returns empty string on timeout, error, or no data.
   *
   * @param problemSetId - The current problem set
   * @param _userMessage - Optional user message for future relevance filtering
   */
  async getContextForMessage(
    problemSetId: string,
    _userMessage?: string,
  ): Promise<string> {
    try {
      const timeoutPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(''), CONTEXT_TIMEOUT_MS),
      );
      const buildPromise = this._buildMessageContext(problemSetId);
      return await Promise.race([buildPromise, timeoutPromise]);
    } catch {
      return '';
    }
  }

  /**
   * Get unfiltered, complete KG context for the design interview path.
   * No character budget — the design interview needs comprehensive grounding.
   * Still timeout-protected (500ms for the fuller fetch).
   */
  async getFullContext(problemSetId: string): Promise<string | null> {
    try {
      const timeoutPromise = new Promise<string | null>((resolve) =>
        setTimeout(() => resolve(null), 500),
      );
      const buildPromise = this._buildFullContext(problemSetId);
      return await Promise.race([buildPromise, timeoutPromise]);
    } catch {
      return null;
    }
  }

  /**
   * Fire-and-forget cache warming. Call on session start so the first
   * user message has cached data available.
   */
  warmCache(problemSetId: string): void {
    this._getContainerIds(problemSetId)
      .then((containerIds) => {
        for (const id of containerIds) {
          graphSummaryService.getGraphSummary(id).catch(() => {});
        }
      })
      .catch(() => {});
  }

  /**
   * Invalidate cached KG data for a problem set.
   * Call when graph entities are mutated.
   */
  async invalidateCache(problemSetId: string): Promise<void> {
    this.containerMapping.invalidate(problemSetId);
    try {
      const containerIds = await this._getContainerIds(problemSetId);
      for (const id of containerIds) {
        graphSummaryService.invalidateContainer(id);
      }
    } catch {
      // Non-fatal
    }
  }

  // -------------------------------------------------------------------------
  // Internal: Context Building
  // -------------------------------------------------------------------------

  /**
   * Build a character-budgeted KG context block from graph summaries.
   */
  private async _buildMessageContext(problemSetId: string): Promise<string> {
    const summaries = await this._getSummaries(problemSetId);
    if (summaries.length === 0) return '';

    const parts: string[] = ['[KNOWLEDGE GRAPH — OPERATIONAL PICTURE]'];
    let charsUsed = parts[0].length;

    for (const { name, summary } of summaries) {
      const section = this._formatSummaryCompact(name, summary);
      if (charsUsed + section.length > MESSAGE_CHAR_BUDGET) break;
      parts.push(section);
      charsUsed += section.length;
    }

    return parts.join('\n');
  }

  /**
   * Build unfiltered KG context for the design interview path.
   */
  private async _buildFullContext(problemSetId: string): Promise<string | null> {
    const summaries = await this._getSummaries(problemSetId);
    if (summaries.length === 0) return null;

    // Also fetch strategic objectives from PostgreSQL
    let objectivesSection = '';
    try {
      const pool = getPool();
      const objResult = await pool.query(
        `SELECT description, primary_instrument, priority FROM strategic_objectives
         WHERE document_id IN (SELECT id FROM documents WHERE workspace_id = $1)
         ORDER BY priority ASC LIMIT 15`,
        [problemSetId],
      );
      if (objResult.rows.length > 0) {
        const lines = (objResult.rows as Array<Record<string, unknown>>).map(
          (obj) => `- [${obj.primary_instrument ?? 'unknown'}/${obj.priority ?? 'MEDIUM'}] ${obj.description}`,
        );
        objectivesSection = `\n### Strategic Objectives\n${lines.join('\n')}`;
      }
    } catch { /* objectives not available */ }

    const parts: string[] = [];
    for (const { name, summary } of summaries) {
      parts.push(this._formatSummaryFull(name, summary));
    }

    return parts.join('\n\n') + objectivesSection;
  }

  // -------------------------------------------------------------------------
  // Internal: Container Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve problemSetId → container IDs via problem_set_environments mapping.
   * Cached with 30-min TTL.
   */
  private async _getContainerIds(problemSetId: string): Promise<string[]> {
    const cached = this.containerMapping.get(problemSetId);
    if (cached) return cached;

    const pool = getPool();
    const mappingResult = await pool.query(
      `SELECT environment_id FROM problem_set_environments WHERE problem_set_id = $1`,
      [problemSetId],
    );

    if (mappingResult.rows.length === 0) {
      this.containerMapping.set(problemSetId, []);
      return [];
    }

    const environmentId = (mappingResult.rows[0] as { environment_id: string }).environment_id;

    const containerResult = await pool.query(
      `SELECT id FROM strategic_containers WHERE environment_id = $1`,
      [environmentId],
    );

    const ids = (containerResult.rows as Array<{ id: string }>).map((r) => r.id);
    this.containerMapping.set(problemSetId, ids);
    return ids;
  }

  // -------------------------------------------------------------------------
  // Internal: Summary Retrieval
  // -------------------------------------------------------------------------

  /**
   * Get graph summaries for all containers in a problem set.
   */
  private async _getSummaries(
    problemSetId: string,
  ): Promise<Array<{ name: string; summary: GraphSummary }>> {
    const containerIds = await this._getContainerIds(problemSetId);
    if (containerIds.length === 0) {
      // Fall back: try using problemSetId directly as workspaceId
      // (some older problem sets may not have environment mappings)
      const fallback = await graphSummaryService.getGraphSummary(problemSetId);
      if (fallback) {
        return [{ name: 'default', summary: fallback }];
      }
      return [];
    }

    const results: Array<{ name: string; summary: GraphSummary }> = [];
    for (const id of containerIds) {
      const summary = await graphSummaryService.getGraphSummary(id);
      if (summary) {
        results.push({ name: id, summary });
      }
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Internal: Formatting
  // -------------------------------------------------------------------------

  /**
   * Format a graph summary into a compact block for message preamble.
   * Prioritizes: top actors, critical tensions, key relationships.
   */
  private _formatSummaryCompact(_containerName: string, summary: GraphSummary): string {
    const lines: string[] = [];

    // Top actors (max 5)
    if (summary.topActors.length > 0) {
      const actors = summary.topActors.slice(0, 5).map((a) => {
        const temporal = a.temporalRelevance ? ' *' : '';
        return `${a.name} (${a.type}, c:${a.centrality.toFixed(2)}${temporal})`;
      });
      lines.push(`Key Actors: ${actors.join('; ')}`);
    }

    // Active tensions (max 3)
    if (summary.activeTensions.length > 0) {
      const tensions = summary.activeTensions.slice(0, 3).map(
        (t) => `${t.description} [${t.intensity}]`,
      );
      lines.push(`Tensions: ${tensions.join('; ')}`);
    }

    // Key relationships (max 5)
    if (summary.keyRelationships.length > 0) {
      const rels = summary.keyRelationships.slice(0, 5).map(
        (r) => `${r.source}→${r.target} (${r.type})`,
      );
      lines.push(`Relationships: ${rels.join('; ')}`);
    }

    // Community clusters (count only for compact)
    if (summary.communityClusters.length > 0) {
      const largest = summary.communityClusters[0];
      lines.push(
        `${summary.communityClusters.length} actor cluster(s), largest: ${largest.actors.length} actors (cohesion: ${largest.cohesion})`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Format a graph summary into full detail for design interview context.
   */
  private _formatSummaryFull(_containerName: string, summary: GraphSummary): string {
    const parts: string[] = [];

    if (summary.topActors.length > 0) {
      parts.push('### Key Actors');
      for (const a of summary.topActors) {
        const temporal = a.temporalRelevance ? ` [${a.temporalRelevance}]` : '';
        parts.push(`- ${a.name} (${a.type}, centrality: ${a.centrality.toFixed(3)}${temporal})`);
      }
    }

    if (summary.keyRelationships.length > 0) {
      parts.push('\n### Key Relationships');
      for (const r of summary.keyRelationships) {
        parts.push(`- ${r.source} → ${r.target}: ${r.type} (strength: ${r.strength.toFixed(2)})`);
      }
    }

    if (summary.activeTensions.length > 0) {
      parts.push('\n### Active Tensions');
      for (const t of summary.activeTensions) {
        const actors = t.actors.length > 0 ? ` (${t.actors.join(', ')})` : '';
        parts.push(`- ${t.description} [${t.intensity}, ${t.domain}]${actors}`);
      }
    }

    if (summary.communityClusters.length > 0) {
      parts.push('\n### Community Clusters');
      for (const c of summary.communityClusters.slice(0, 5)) {
        parts.push(`- [${c.actors.join(', ')}] (cohesion: ${c.cohesion})`);
      }
    }

    // Include the pre-built summary text if available
    if (summary.summary) {
      parts.push(`\n### Summary\n${summary.summary}`);
    }

    return parts.join('\n');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const kgContextService = new KGContextService();
