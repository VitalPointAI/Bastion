/**
 * Ironclaw Memory Stores
 *
 * Phase 57 Plan 01: Dual-scope persistent memory (user + context) and
 * interaction outcome tracking. Three singleton exports:
 *   - ironclawUserMemoryStore
 *   - ironclawContextMemoryStore
 *   - ironclawOutcomeStore
 *
 * Follows the IronclawStore singleton pattern from ironclaw-store.ts.
 * All user memory queries MUST include user_did in WHERE clause.
 * All context memory queries MUST include problem_set_id in WHERE clause.
 */

import { getPool } from '../lib/database.js';
import type {
  UserMemoryEntry,
  ContextMemoryEntry,
  InteractionOutcome,
  MemorySource,
} from './ironclaw-memory-types.js';
import { USER_MEMORY_TTL_DAYS, CONTEXT_MEMORY_TTL_DAYS } from './ironclaw-memory-types.js';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToUserMemory(row: Record<string, unknown>): UserMemoryEntry {
  return {
    id: row.id as string,
    user_did: row.user_did as string,
    memory_key: row.memory_key as string,
    memory_value: row.memory_value as Record<string, unknown>,
    confidence: Number(row.confidence),
    source: row.source as MemorySource,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
    expires_at: (row.expires_at as Date).toISOString(),
  };
}

function rowToContextMemory(row: Record<string, unknown>): ContextMemoryEntry {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    memory_key: row.memory_key as string,
    memory_value: row.memory_value as Record<string, unknown>,
    session_count: row.session_count as number,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
    expires_at: (row.expires_at as Date).toISOString(),
  };
}

function rowToOutcome(row: Record<string, unknown>): InteractionOutcome {
  return {
    id: row.id as string,
    user_did: row.user_did as string,
    problem_set_id: (row.problem_set_id as string) ?? null,
    outcome_type: row.outcome_type as string,
    context: (row.context as Record<string, unknown>) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// IronclawUserMemoryStore
// ---------------------------------------------------------------------------

export class IronclawUserMemoryStore {
  /**
   * Ensure the ironclaw_user_memory table and indexes exist.
   * Idempotent — safe to call at startup.
   */
  async ensureTable(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_user_memory (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_did    TEXT        NOT NULL,
        memory_key  TEXT        NOT NULL,
        memory_value JSONB      NOT NULL,
        confidence  NUMERIC(4,3) NOT NULL DEFAULT 0.5,
        source      TEXT        NOT NULL DEFAULT 'inferred',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days',
        UNIQUE (user_did, memory_key)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_user_memory_user_did
        ON ironclaw_user_memory (user_did)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_user_memory_expires_at
        ON ironclaw_user_memory (expires_at)
    `);
  }

  /**
   * Upsert a user memory entry. Updates memory_value, confidence, source,
   * updated_at, and refreshes expires_at on conflict.
   *
   * Privacy guard: no problem_set_id on user memory methods — user memories
   * are strictly scoped to user_did only.
   */
  async setUserMemory(
    userDid: string,
    memoryKey: string,
    value: Record<string, unknown>,
    source: MemorySource = 'inferred',
    confidence = 0.5,
  ): Promise<UserMemoryEntry> {
    const pool = getPool();
    const ttlInterval = `${USER_MEMORY_TTL_DAYS} days`;

    const result = await pool.query(
      `INSERT INTO ironclaw_user_memory
        (user_did, memory_key, memory_value, source, confidence, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + $6::interval)
       ON CONFLICT (user_did, memory_key) DO UPDATE SET
         memory_value = EXCLUDED.memory_value,
         source       = EXCLUDED.source,
         confidence   = EXCLUDED.confidence,
         updated_at   = NOW(),
         expires_at   = NOW() + $6::interval
       RETURNING *`,
      [userDid, memoryKey, JSON.stringify(value), source, confidence, ttlInterval],
    );

    return rowToUserMemory(result.rows[0]);
  }

  /**
   * Return all non-expired memory entries for a user.
   * Scoped strictly to user_did — no cross-user access possible.
   */
  async getActiveMemories(userDid: string): Promise<UserMemoryEntry[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM ironclaw_user_memory
       WHERE user_did = $1 AND expires_at > NOW()
       ORDER BY updated_at DESC`,
      [userDid],
    );
    return result.rows.map(rowToUserMemory);
  }

  /**
   * Return a single memory entry by user_did + memory_key.
   * Returns null if not found or expired.
   */
  async getUserMemory(userDid: string, memoryKey: string): Promise<UserMemoryEntry | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM ironclaw_user_memory
       WHERE user_did = $1 AND memory_key = $2 AND expires_at > NOW()`,
      [userDid, memoryKey],
    );
    return result.rows.length > 0 ? rowToUserMemory(result.rows[0]) : null;
  }

  /**
   * Delete a specific memory entry for a user.
   */
  async deleteUserMemory(userDid: string, memoryKey: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `DELETE FROM ironclaw_user_memory WHERE user_did = $1 AND memory_key = $2`,
      [userDid, memoryKey],
    );
  }

  /**
   * Delete ALL memory entries for a user (e.g. on account deletion or reset).
   */
  async deleteAllUserMemories(userDid: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `DELETE FROM ironclaw_user_memory WHERE user_did = $1`,
      [userDid],
    );
  }
}

// ---------------------------------------------------------------------------
// IronclawContextMemoryStore
// ---------------------------------------------------------------------------

export class IronclawContextMemoryStore {
  /**
   * Ensure the ironclaw_context_memory table and indexes exist.
   * Idempotent — safe to call at startup.
   */
  async ensureTable(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_context_memory (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id  TEXT        NOT NULL,
        memory_key      TEXT        NOT NULL,
        memory_value    JSONB       NOT NULL,
        session_count   INTEGER     NOT NULL DEFAULT 1,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '180 days',
        UNIQUE (problem_set_id, memory_key)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_context_memory_problem_set_id
        ON ironclaw_context_memory (problem_set_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_context_memory_expires_at
        ON ironclaw_context_memory (expires_at)
    `);
  }

  /**
   * Upsert a context memory entry. Increments session_count on each update.
   */
  async setContextMemory(
    problemSetId: string,
    memoryKey: string,
    value: Record<string, unknown>,
  ): Promise<ContextMemoryEntry> {
    const pool = getPool();
    const ttlInterval = `${CONTEXT_MEMORY_TTL_DAYS} days`;

    const result = await pool.query(
      `INSERT INTO ironclaw_context_memory
        (problem_set_id, memory_key, memory_value, expires_at)
       VALUES ($1, $2, $3, NOW() + $4::interval)
       ON CONFLICT (problem_set_id, memory_key) DO UPDATE SET
         memory_value  = EXCLUDED.memory_value,
         session_count = ironclaw_context_memory.session_count + 1,
         updated_at    = NOW(),
         expires_at    = NOW() + $4::interval
       RETURNING *`,
      [problemSetId, memoryKey, JSON.stringify(value), ttlInterval],
    );

    return rowToContextMemory(result.rows[0]);
  }

  /**
   * Return all non-expired memory entries for a problem set.
   */
  async getActiveMemories(problemSetId: string): Promise<ContextMemoryEntry[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM ironclaw_context_memory
       WHERE problem_set_id = $1 AND expires_at > NOW()
       ORDER BY updated_at DESC`,
      [problemSetId],
    );
    return result.rows.map(rowToContextMemory);
  }

  /**
   * Delete a specific context memory entry.
   */
  async deleteContextMemory(problemSetId: string, memoryKey: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `DELETE FROM ironclaw_context_memory WHERE problem_set_id = $1 AND memory_key = $2`,
      [problemSetId, memoryKey],
    );
  }
}

// ---------------------------------------------------------------------------
// IronclawOutcomeStore
// ---------------------------------------------------------------------------

export class IronclawOutcomeStore {
  /**
   * Ensure the ironclaw_interaction_outcomes table and indexes exist.
   * Idempotent — safe to call at startup.
   */
  async ensureTable(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_interaction_outcomes (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_did        TEXT        NOT NULL,
        problem_set_id  TEXT,
        outcome_type    TEXT        NOT NULL,
        context         JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_outcomes_user_created
        ON ironclaw_interaction_outcomes (user_did, created_at)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_outcomes_type_created
        ON ironclaw_interaction_outcomes (outcome_type, created_at)
    `);
  }

  /**
   * Record a single interaction outcome.
   *
   * @param userDid        - The user's DID
   * @param problemSetId   - The problem set context (null for global outcomes)
   * @param outcomeType    - One of OUTCOME_TYPES constants
   * @param context        - Optional structured context (e.g. {suggestion_type: 'coa'})
   */
  async recordOutcome(
    userDid: string,
    problemSetId: string | null,
    outcomeType: string,
    context: Record<string, unknown> | null,
  ): Promise<InteractionOutcome> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_interaction_outcomes
        (user_did, problem_set_id, outcome_type, context)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        userDid,
        problemSetId ?? null,
        outcomeType,
        context ? JSON.stringify(context) : null,
      ],
    );
    return rowToOutcome(result.rows[0]);
  }

  /**
   * Retrieve outcomes for a user, optionally filtered by time window and count.
   *
   * @param userDid  - The user's DID
   * @param options  - Optional filters: days (time window), limit (max rows)
   */
  async getOutcomes(
    userDid: string,
    options?: { days?: number; limit?: number },
  ): Promise<InteractionOutcome[]> {
    const pool = getPool();
    const params: unknown[] = [userDid];
    let sql = `SELECT * FROM ironclaw_interaction_outcomes WHERE user_did = $1`;

    if (options?.days) {
      params.push(options.days);
      sql += ` AND created_at > NOW() - $${params.length}::int * INTERVAL '1 day'`;
    }

    sql += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(sql, params);
    return result.rows.map(rowToOutcome);
  }

  /**
   * Return aggregated outcome counts for a user over a time window.
   *
   * @param userDid  - The user's DID
   * @param days     - Number of days to look back
   * @returns Record mapping outcome_type → count
   */
  async getOutcomeCounts(
    userDid: string,
    days: number,
  ): Promise<Record<string, number>> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT outcome_type, COUNT(*)::int AS count
       FROM ironclaw_interaction_outcomes
       WHERE user_did = $1
         AND created_at > NOW() - $2::int * INTERVAL '1 day'
       GROUP BY outcome_type`,
      [userDid, days],
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows as Array<{ outcome_type: string; count: string | number }>) {
      counts[row.outcome_type] = Number(row.count);
    }
    return counts;
  }
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

export const ironclawUserMemoryStore = new IronclawUserMemoryStore();
export const ironclawContextMemoryStore = new IronclawContextMemoryStore();
export const ironclawOutcomeStore = new IronclawOutcomeStore();
