/**
 * Change Tracker - Per-user/agent change detection
 *
 * Tracks when each user/agent last accessed the briefing for a problem set,
 * and detects what has changed since that access. Uses graph snapshot hashing
 * for lightweight change detection without expensive full-graph serialization.
 *
 * Phase 40 Plan 08: Strategic Environment Briefing
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { getPool } from '../../lib/database.js';
import { executeReadQuery } from '../../graph/neo4j-client.js';
import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';

// ============================================================================
// Types
// ============================================================================

export interface AccessRecord {
  accessedAt: Date;
  graphSnapshotHash: string;
}

export interface ChangeSet {
  newEntities: ChangedEntity[];
  modifiedEntities: ChangedEntity[];
  newRelationships: ChangedRelationship[];
  revokedEntities: ChangedEntity[];
  summary: string;
}

export interface ChangedEntity {
  id: string;
  name: string;
  type: string;
  updatedAt: Date;
}

export interface ChangedRelationship {
  id: string;
  sourceActorId: string;
  targetActorId: string;
  type: string;
  description?: string;
  createdAt: Date;
}

// ============================================================================
// ChangeTracker
// ============================================================================

/**
 * Tracks per-user/agent access to problem set briefings and detects
 * changes in the knowledge graph since the user's last access.
 */
export class ChangeTracker {
  /**
   * Record that a user/agent accessed the briefing for a problem set.
   * Inserts into briefing_access_log with the current graph snapshot hash.
   */
  async recordAccess(
    problemSetId: string,
    accessedBy: string,
    graphSnapshotHash: string,
  ): Promise<void> {
    const pool = getPool();
    const id = `BAL-${randomUUID()}`;

    await pool.query(
      `INSERT INTO briefing_access_log (id, problem_set_id, accessed_by, accessed_at, graph_snapshot_hash)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [id, problemSetId, accessedBy, graphSnapshotHash],
    );
  }

  /**
   * Get the most recent access record for a user/agent on a problem set.
   * Returns null if the user has never accessed this briefing.
   */
  async getLastAccess(
    problemSetId: string,
    accessedBy: string,
  ): Promise<AccessRecord | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT accessed_at, graph_snapshot_hash
       FROM briefing_access_log
       WHERE problem_set_id = $1 AND accessed_by = $2
       ORDER BY accessed_at DESC
       LIMIT 1`,
      [problemSetId, accessedBy],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as { accessed_at: Date; graph_snapshot_hash: string };
    return {
      accessedAt: new Date(row.accessed_at),
      graphSnapshotHash: row.graph_snapshot_hash,
    };
  }

  /**
   * Compute a lightweight hash of the current graph state for a problem set.
   * Uses entity count + last-modified timestamp + sum of entity IDs to avoid
   * expensive full-graph serialization.
   */
  async computeGraphHash(problemSetId: string): Promise<string> {
    try {
      // Get actor count and latest update
      const actorResult = await executeReadQuery(
        `MATCH (a:Actor)
         WHERE a.workspaceId = $problemSetId
         RETURN count(a) as cnt, max(a.updatedAt) as lastUpdate,
                collect(a.id) as ids`,
        { problemSetId },
      );

      // Get relationship count and latest update
      const relResult = await executeReadQuery(
        `MATCH (a:Actor)-[r:RELATES_TO]->(b:Actor)
         WHERE a.workspaceId = $problemSetId OR b.workspaceId = $problemSetId
         RETURN count(r) as cnt, max(r.updatedAt) as lastUpdate,
                collect(r.id) as ids`,
        { problemSetId },
      );

      // Get tension count and latest update
      const tensionResult = await executeReadQuery(
        `MATCH (t:Tension)
         WHERE t.workspaceId = $problemSetId
         RETURN count(t) as cnt, max(t.updatedAt) as lastUpdate,
                collect(t.id) as ids`,
        { problemSetId },
      );

      const actorRow = actorResult.records[0];
      const relRow = relResult.records[0];
      const tensionRow = tensionResult.records[0];

      const hashInput = [
        `actors:${actorRow?.get('cnt') ?? 0}:${actorRow?.get('lastUpdate') ?? ''}`,
        `rels:${relRow?.get('cnt') ?? 0}:${relRow?.get('lastUpdate') ?? ''}`,
        `tensions:${tensionRow?.get('cnt') ?? 0}:${tensionRow?.get('lastUpdate') ?? ''}`,
        `ids:${(actorRow?.get('ids') as string[] || []).sort().join(',')}`,
        `rids:${(relRow?.get('ids') as string[] || []).sort().join(',')}`,
        `tids:${(tensionRow?.get('ids') as string[] || []).sort().join(',')}`,
      ].join('|');

      return createHash('sha256').update(hashInput).digest('hex').slice(0, 16);
    } catch (err) {
      console.error('[ChangeTracker] Graph hash computation failed:', err);
      // Return a unique hash on error so changes are always detected
      return createHash('sha256').update(Date.now().toString()).digest('hex').slice(0, 16);
    }
  }

  /**
   * Get entities and relationships that have changed since a given timestamp.
   * Queries the Neo4j graph for nodes/edges created or modified after the timestamp.
   */
  async getChangesSince(
    problemSetId: string,
    sinceTimestamp: Date,
  ): Promise<ChangeSet> {
    const sinceISO = sinceTimestamp.toISOString();

    // New entities (created after timestamp)
    let newEntities: ChangedEntity[] = [];
    try {
      const newActorResult = await executeReadQuery(
        `MATCH (a:Actor)
         WHERE a.workspaceId = $problemSetId AND a.createdAt > $since
         RETURN a.id as id, a.name as name, a.type as type, a.updatedAt as updatedAt
         ORDER BY a.createdAt DESC
         LIMIT 50`,
        { problemSetId, since: sinceISO },
      );
      newEntities = newActorResult.records.map(r => ({
        id: r.get('id') as string,
        name: r.get('name') as string,
        type: r.get('type') as string,
        updatedAt: new Date(r.get('updatedAt') as string),
      }));
    } catch {
      // Neo4j may be unavailable
    }

    // Modified entities (updated after timestamp but created before)
    let modifiedEntities: ChangedEntity[] = [];
    try {
      const modActorResult = await executeReadQuery(
        `MATCH (a:Actor)
         WHERE a.workspaceId = $problemSetId
           AND a.updatedAt > $since
           AND a.createdAt <= $since
         RETURN a.id as id, a.name as name, a.type as type, a.updatedAt as updatedAt
         ORDER BY a.updatedAt DESC
         LIMIT 50`,
        { problemSetId, since: sinceISO },
      );
      modifiedEntities = modActorResult.records.map(r => ({
        id: r.get('id') as string,
        name: r.get('name') as string,
        type: r.get('type') as string,
        updatedAt: new Date(r.get('updatedAt') as string),
      }));
    } catch {
      // Neo4j may be unavailable
    }

    // New relationships (created after timestamp)
    let newRelationships: ChangedRelationship[] = [];
    try {
      const newRelResult = await executeReadQuery(
        `MATCH (a:Actor)-[r:RELATES_TO]->(b:Actor)
         WHERE (a.workspaceId = $problemSetId OR b.workspaceId = $problemSetId)
           AND r.createdAt > $since
         RETURN r.id as id, a.id as sourceActorId, b.id as targetActorId,
                r.type as type, r.description as description, r.createdAt as createdAt
         ORDER BY r.createdAt DESC
         LIMIT 50`,
        { problemSetId, since: sinceISO },
      );
      newRelationships = newRelResult.records.map(r => ({
        id: r.get('id') as string,
        sourceActorId: r.get('sourceActorId') as string,
        targetActorId: r.get('targetActorId') as string,
        type: r.get('type') as string,
        description: r.get('description') as string | undefined,
        createdAt: new Date(r.get('createdAt') as string),
      }));
    } catch {
      // Neo4j may be unavailable
    }

    // Revoked entities -- actors with a "revoked" attribute set after timestamp
    // In practice, graph entities may be soft-deleted via attributes
    const revokedEntities: ChangedEntity[] = [];

    // Generate LLM summary of changes
    const summary = await this.generateChangeSummary(
      newEntities,
      modifiedEntities,
      newRelationships,
      revokedEntities,
    );

    return {
      newEntities,
      modifiedEntities,
      newRelationships,
      revokedEntities,
      summary,
    };
  }

  /**
   * Quick check: has anything changed since the user's last access?
   * Compares current graph hash to the hash stored at last access.
   */
  async hasChanges(
    problemSetId: string,
    accessedBy: string,
  ): Promise<boolean> {
    const lastAccess = await this.getLastAccess(problemSetId, accessedBy);
    if (!lastAccess) return true; // Never accessed = everything is new

    const currentHash = await this.computeGraphHash(problemSetId);
    return currentHash !== lastAccess.graphSnapshotHash;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Generate a one-paragraph LLM summary of what changed.
   */
  private async generateChangeSummary(
    newEntities: ChangedEntity[],
    modifiedEntities: ChangedEntity[],
    newRelationships: ChangedRelationship[],
    revokedEntities: ChangedEntity[],
  ): Promise<string> {
    const totalChanges =
      newEntities.length + modifiedEntities.length +
      newRelationships.length + revokedEntities.length;

    if (totalChanges === 0) {
      return 'No significant changes detected since last access.';
    }

    // Build a concise summary without LLM for efficiency when changes are small
    if (totalChanges <= 5) {
      const parts: string[] = [];
      if (newEntities.length > 0) {
        parts.push(`${newEntities.length} new entit${newEntities.length === 1 ? 'y' : 'ies'} added (${newEntities.map(e => e.name).join(', ')})`);
      }
      if (modifiedEntities.length > 0) {
        parts.push(`${modifiedEntities.length} entit${modifiedEntities.length === 1 ? 'y' : 'ies'} updated (${modifiedEntities.map(e => e.name).join(', ')})`);
      }
      if (newRelationships.length > 0) {
        parts.push(`${newRelationships.length} new relationship${newRelationships.length === 1 ? '' : 's'} established`);
      }
      if (revokedEntities.length > 0) {
        parts.push(`${revokedEntities.length} entit${revokedEntities.length === 1 ? 'y' : 'ies'} revoked`);
      }
      return parts.join('. ') + '.';
    }

    // Use LLM for larger change sets
    try {
      const llm = await createLLMForAgent({ agentId: 'doc-briefing-change-tracker' });
      const changeData = JSON.stringify({
        newEntities: newEntities.slice(0, 20).map(e => ({ name: e.name, type: e.type })),
        modifiedEntities: modifiedEntities.slice(0, 20).map(e => ({ name: e.name, type: e.type })),
        newRelationships: newRelationships.slice(0, 20).map(r => ({ type: r.type, description: r.description })),
        revokedEntities: revokedEntities.slice(0, 10).map(e => ({ name: e.name, type: e.type })),
      });

      const response = await llm.invoke([
        {
          role: 'system',
          content: 'Summarize the following knowledge graph changes in one concise paragraph suitable for an intelligence briefing. Focus on strategic significance.',
        },
        {
          role: 'user',
          content: changeData,
        },
      ]);

      return typeof response.content === 'string'
        ? response.content
        : 'Multiple changes detected across the knowledge graph.';
    } catch {
      // Fallback if LLM unavailable
      return `${totalChanges} changes detected: ${newEntities.length} new entities, ${modifiedEntities.length} modified, ${newRelationships.length} new relationships, ${revokedEntities.length} revoked.`;
    }
  }
}
