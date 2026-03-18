/**
 * AgentMemoryStore
 *
 * Phase 51: Unified Agent Architecture
 * Per-agent memory persistence with semantic recall via cosine similarity.
 *
 * Memory types:
 *   - 'knowledge': Long-term factual/doctrinal entries (may carry an embedding)
 *   - 'working': Short-term task context (cleared on task completion)
 *   - 'episode': Summary of a completed task
 *
 * Semantic recall: caller passes a queryEmbedding (number[]) alongside the query
 * string. If embeddings exist for stored entries, cosine similarity is computed
 * in-process using the existing utility. Falls back to ILIKE text matching when
 * no embeddings are present.
 *
 * Embeddings are NOT generated here — that is the caller's responsibility to
 * keep this module decoupled from any specific embedding provider.
 *
 * Table: agent_memory (created by migration 035)
 */

import { getPool } from '../lib/database.js';
import { cosineSimilarity } from '../validation/scoring/cosine-similarity.js';
import type { MemoryEntry } from './standard-agent.js';

// ============================================================================
// Internal DB row shape
// ============================================================================

interface MemoryRow {
  entry_id: string;
  agent_id: string;
  memory_type: string;
  category: string | null;
  content: string;
  embedding: number[] | null;   // stored as JSONB array
  importance: string;           // NUMERIC comes back as string from pg driver
  created_at: Date;
  last_accessed: Date | null;
  task_id: string | null;
}

function rowToEntry(row: MemoryRow): MemoryEntry {
  return {
    entryId: row.entry_id,
    agentId: row.agent_id,
    memoryType: row.memory_type as MemoryEntry['memoryType'],
    category: row.category ?? undefined,
    content: row.content,
    embedding: row.embedding ?? undefined,
    importance: parseFloat(row.importance),
    createdAt: row.created_at,
    lastAccessed: row.last_accessed ?? undefined,
    taskId: row.task_id ?? undefined,
  };
}

// ============================================================================
// AgentMemoryStore class
// ============================================================================

export class AgentMemoryStore {
  /**
   * Persist a new memory entry.
   *
   * Embeddings are optional — pass one if it was generated externally (e.g.
   * after an async embedding call). Entries without embeddings can still be
   * retrieved via text search.
   *
   * @param agentId    - Owning agent
   * @param content    - Text content to remember
   * @param memoryType - 'knowledge' | 'working' | 'episode'
   * @param opts       - Optional metadata
   */
  async remember(
    agentId: string,
    content: string,
    memoryType: MemoryEntry['memoryType'],
    opts?: {
      category?: string;
      importance?: number;
      taskId?: string;
      embedding?: number[];
    }
  ): Promise<string> {
    const pool = getPool();
    const result = await pool.query<{ entry_id: string }>(
      `INSERT INTO agent_memory
         (agent_id, memory_type, category, content, embedding, importance, task_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING entry_id`,
      [
        agentId,
        memoryType,
        opts?.category ?? null,
        content,
        opts?.embedding !== undefined ? JSON.stringify(opts.embedding) : null,
        opts?.importance ?? 0.5,
        opts?.taskId ?? null,
      ]
    );
    return result.rows[0].entry_id;
  }

  /**
   * Recall semantically relevant memories for an agent.
   *
   * Strategy:
   *  1. If a queryEmbedding is provided: load all entries with embeddings,
   *     score via cosine similarity, return top N.
   *  2. If no queryEmbedding: fall back to ILIKE full-text search on content.
   *
   * Updates last_accessed for returned entries.
   *
   * @param agentId        - Agent to query memories for
   * @param query          - Text query (used for ILIKE fallback)
   * @param limit          - Maximum entries to return (default 5)
   * @param queryEmbedding - Optional pre-computed embedding for semantic search
   */
  async recall(
    agentId: string,
    query: string,
    limit = 5,
    queryEmbedding?: number[]
  ): Promise<MemoryEntry[]> {
    const pool = getPool();

    if (queryEmbedding && queryEmbedding.length > 0) {
      // Semantic path: load all entries with embeddings, score in-process
      const result = await pool.query<MemoryRow>(
        `SELECT * FROM agent_memory
         WHERE agent_id = $1
           AND embedding IS NOT NULL`,
        [agentId]
      );

      if (result.rows.length === 0) {
        // Fall through to text search if no embedded entries exist
        return this._textSearch(agentId, query, limit);
      }

      type ScoredRow = { row: MemoryRow; score: number };
      const scored: ScoredRow[] = result.rows
        .map((row) => {
          try {
            const score = cosineSimilarity(queryEmbedding, row.embedding!);
            return { row, score };
          } catch {
            // Dimension mismatch — skip this entry
            return { row, score: -1 };
          }
        })
        .filter((s) => s.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      const entries = scored.map((s) => rowToEntry(s.row));
      await this._touchEntries(entries.map((e) => e.entryId));
      return entries;
    }

    return this._textSearch(agentId, query, limit);
  }

  /**
   * Delete a specific memory entry.
   */
  async forget(entryId: string): Promise<void> {
    const pool = getPool();
    await pool.query(`DELETE FROM agent_memory WHERE entry_id = $1`, [entryId]);
  }

  /**
   * List all entries for an agent, optionally filtered by memory type.
   * Results ordered by importance DESC, then created_at DESC.
   */
  async listEntries(
    agentId: string,
    memoryType?: MemoryEntry['memoryType']
  ): Promise<MemoryEntry[]> {
    const pool = getPool();
    if (memoryType) {
      const result = await pool.query<MemoryRow>(
        `SELECT * FROM agent_memory
         WHERE agent_id = $1 AND memory_type = $2
         ORDER BY importance DESC, created_at DESC`,
        [agentId, memoryType]
      );
      return result.rows.map(rowToEntry);
    }
    const result = await pool.query<MemoryRow>(
      `SELECT * FROM agent_memory
       WHERE agent_id = $1
       ORDER BY importance DESC, created_at DESC`,
      [agentId]
    );
    return result.rows.map(rowToEntry);
  }

  /**
   * Delete all working-memory entries for an agent.
   * Called at task completion to free short-term context.
   */
  async clearWorkingMemory(agentId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `DELETE FROM agent_memory
       WHERE agent_id = $1 AND memory_type = 'working'`,
      [agentId]
    );
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async _textSearch(
    agentId: string,
    query: string,
    limit: number
  ): Promise<MemoryEntry[]> {
    const pool = getPool();
    const result = await pool.query<MemoryRow>(
      `SELECT * FROM agent_memory
       WHERE agent_id = $1
         AND content ILIKE $2
       ORDER BY importance DESC, created_at DESC
       LIMIT $3`,
      [agentId, `%${query}%`, limit]
    );
    const entries = result.rows.map(rowToEntry);
    await this._touchEntries(entries.map((e) => e.entryId));
    return entries;
  }

  private async _touchEntries(entryIds: string[]): Promise<void> {
    if (entryIds.length === 0) return;
    const pool = getPool();
    const placeholders = entryIds.map((_, i) => `$${i + 1}`).join(', ');
    await pool.query(
      `UPDATE agent_memory
       SET last_accessed = NOW()
       WHERE entry_id IN (${placeholders})`,
      entryIds
    );
  }
}

// ============================================================================
// Singleton factory
// ============================================================================

let _store: AgentMemoryStore | null = null;

/**
 * Returns the shared AgentMemoryStore singleton.
 */
export function getAgentMemoryStore(): AgentMemoryStore {
  if (!_store) _store = new AgentMemoryStore();
  return _store;
}
