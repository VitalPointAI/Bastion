/**
 * Ironclaw Internal Memory Inspector
 *
 * Ironclaw (the sidecar) has its own memory system — the `memory_documents`
 * table in the Ironclaw PostgreSQL database. These files are loaded into the
 * LLM context automatically on every job start, directly driving token usage.
 *
 * This service gives BASTION visibility into what's in Ironclaw's memory so
 * the commander can see:
 *   - Total token cost of memory content
 *   - Individual file sizes (which files are bloating prompts)
 *   - Last updated timestamps (which files are actively growing)
 *   - Preview of content (verify it's useful, not noise)
 *
 * The commander can also delete individual files from the Memory tab when
 * they see autonomous routine noise accumulating.
 *
 * This is READ-ONLY visibility, not a replacement for Ironclaw's memory
 * system. Ironclaw's own memory_read/memory_write tools continue to work
 * normally — we just monitor what they're doing.
 */

import pg from 'pg';

// Rough token estimator: ~4 chars per token for English prose.
// Not exact, but close enough to flag which files are expensive.
const CHARS_PER_TOKEN = 4;

// Paths ironclaw auto-loads into every job context. These are the "always on"
// files that contribute to every LLM call, so their size directly affects
// per-request token usage.
const AUTO_LOADED_PATHS = new Set(['USER.md', 'SOUL.md', 'HEARTBEAT.md', 'AGENTS.md', 'MEMORY.md']);

// ---------------------------------------------------------------------------
// Ironclaw DB pool (lazy, mirrors the pattern in routine-service.ts)
// ---------------------------------------------------------------------------

let ironclawPool: pg.Pool | null = null;

function getIronclawPool(): pg.Pool | null {
  if (!ironclawPool) {
    const url = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL;
    if (!url) return null;
    ironclawPool = new pg.Pool({ connectionString: url, max: 3 });
  }
  return ironclawPool;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoryDocumentSummary {
  id: string;
  path: string;
  lengthChars: number;
  estimatedTokens: number;
  autoLoaded: boolean;
  agentId: string | null;
  userId: string | null;
  preview: string;
  updatedAt: string;
  createdAt: string;
}

export interface MemoryInspectionReport {
  totalDocuments: number;
  totalChars: number;
  estimatedTotalTokens: number;
  autoLoadedChars: number;
  autoLoadedTokens: number;
  documents: MemoryDocumentSummary[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class IronclawInternalMemoryService {
  /**
   * Fetch a summary of all memory documents in Ironclaw's DB.
   * Returns null if the Ironclaw DB is not configured.
   */
  async inspectMemory(): Promise<MemoryInspectionReport | null> {
    const pool = getIronclawPool();
    if (!pool) return null;

    const result = await pool.query<{
      id: string;
      path: string;
      content: string;
      agent_id: string | null;
      user_id: string | null;
      updated_at: Date;
      created_at: Date;
    }>(
      `SELECT id, path, content, agent_id, user_id, updated_at, created_at
       FROM memory_documents
       ORDER BY length(content) DESC`,
    );

    const documents: MemoryDocumentSummary[] = result.rows.map((row) => {
      const lengthChars = row.content?.length ?? 0;
      return {
        id: row.id,
        path: row.path,
        lengthChars,
        estimatedTokens: Math.ceil(lengthChars / CHARS_PER_TOKEN),
        autoLoaded: AUTO_LOADED_PATHS.has(row.path),
        agentId: row.agent_id,
        userId: row.user_id,
        preview: (row.content ?? '').slice(0, 300),
        updatedAt: row.updated_at.toISOString(),
        createdAt: row.created_at.toISOString(),
      };
    });

    const totalChars = documents.reduce((sum, d) => sum + d.lengthChars, 0);
    const autoLoadedChars = documents
      .filter((d) => d.autoLoaded)
      .reduce((sum, d) => sum + d.lengthChars, 0);

    return {
      totalDocuments: documents.length,
      totalChars,
      estimatedTotalTokens: Math.ceil(totalChars / CHARS_PER_TOKEN),
      autoLoadedChars,
      autoLoadedTokens: Math.ceil(autoLoadedChars / CHARS_PER_TOKEN),
      documents,
    };
  }

  /**
   * Fetch the full content of a single memory document by id.
   * Returns null if not found or DB unavailable.
   */
  async getDocumentContent(id: string): Promise<{ path: string; content: string } | null> {
    const pool = getIronclawPool();
    if (!pool) return null;
    const result = await pool.query<{ path: string; content: string }>(
      `SELECT path, content FROM memory_documents WHERE id = $1`,
      [id],
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Delete a memory document by id. Returns true if deleted.
   * The commander uses this to free tokens when autonomous routines
   * have written noise that's inflating prompts.
   */
  async deleteDocument(id: string): Promise<boolean> {
    const pool = getIronclawPool();
    if (!pool) return false;
    const result = await pool.query(
      `DELETE FROM memory_documents WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete all memory documents matching a path prefix.
   * Useful for bulk-clearing daily logs: deleteByPrefix('daily/').
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    const pool = getIronclawPool();
    if (!pool) return 0;
    const result = await pool.query(
      `DELETE FROM memory_documents WHERE path LIKE $1`,
      [`${prefix}%`],
    );
    return result.rowCount ?? 0;
  }
}

export const ironclawInternalMemoryService = new IronclawInternalMemoryService();
