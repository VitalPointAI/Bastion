/**
 * AI Context Store
 *
 * Phase 16 Plan 02: Shared context store with additive JSONB merge + LISTEN/NOTIFY.
 * Supports cross-role coordination by letting each AI role write partial context
 * that other roles can read. ALWAYS uses JSONB || merge (never full overwrite).
 */

import { Pool, PoolClient } from 'pg';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIContextEntry {
  scenarioId: string;
  roleKey: string;
  contextData: Record<string, unknown>;
  updatedAt: Date;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class AIContextStore {
  constructor(private pool: Pool) {}

  /**
   * Additively write context data for a role within a scenario.
   *
   * Uses UPSERT with JSONB || merge operator — never overwrites existing keys
   * unless they appear in the new data object. After write, emits pg_notify
   * on 'context:{scenarioId}' so other roles can react to new context.
   */
  async write(scenarioId: string, roleKey: string, data: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO ai_context_store (scenario_id, role_key, context_data, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (scenario_id, role_key) DO UPDATE
         SET context_data = ai_context_store.context_data || $3,
             updated_at = NOW()`,
      [scenarioId, roleKey, JSON.stringify(data)]
    );

    // Notify cross-role listeners of what changed
    const notifyPayload = JSON.stringify({
      sourceRole: roleKey,
      keys: Object.keys(data),
    });
    // pg_notify to channel 'context:{scenarioId}' for cross-role listeners
    await this.pool.query(
      `SELECT pg_notify('context:' || $1, $2)`,
      [scenarioId, notifyPayload]
    );
  }

  /**
   * Read the current context data for a specific role.
   * Returns empty object if no context has been written yet.
   */
  async read(scenarioId: string, roleKey: string): Promise<Record<string, unknown>> {
    const result = await this.pool.query(
      `SELECT context_data FROM ai_context_store
       WHERE scenario_id = $1 AND role_key = $2`,
      [scenarioId, roleKey]
    );
    return (result.rows[0]?.context_data as Record<string, unknown>) ?? {};
  }

  /**
   * Read all role contexts for a scenario.
   * Returns a map of { roleKey: contextData } for every role that has written context.
   */
  async readAll(scenarioId: string): Promise<Record<string, Record<string, unknown>>> {
    const result = await this.pool.query(
      `SELECT role_key, context_data FROM ai_context_store
       WHERE scenario_id = $1`,
      [scenarioId]
    );
    const out: Record<string, Record<string, unknown>> = {};
    for (const row of result.rows) {
      out[row.role_key as string] = (row.context_data as Record<string, unknown>) ?? {};
    }
    return out;
  }

  /**
   * Read context with a row-level lock for consistent snapshot reads.
   * Caller must provide a pg PoolClient that is already inside a transaction.
   * Use this when an agent needs to read-and-write atomically.
   */
  async readWithLock(
    client: PoolClient,
    scenarioId: string,
    roleKey: string
  ): Promise<Record<string, unknown>> {
    const result = await client.query(
      `SELECT context_data FROM ai_context_store
       WHERE scenario_id = $1 AND role_key = $2
       FOR UPDATE`,
      [scenarioId, roleKey]
    );
    return (result.rows[0]?.context_data as Record<string, unknown>) ?? {};
  }
}
