/**
 * AgentStore
 *
 * Phase 51: Unified Agent Architecture
 * PostgreSQL-backed CRUD store for StandardAgent instances.
 * Replaces the in-memory Map in AgentRegistry with durable storage.
 *
 * Table: agents_v2 (created by migration 034)
 */

import { getPool } from '../lib/database.js';
import type { StandardAgent } from './standard-agent.js';

// ============================================================================
// AgentStore class
// ============================================================================

export class AgentStore {
  /**
   * Persist an agent (insert or update on conflict).
   * Health columns are stored separately from agent_data JSONB for efficient
   * queries (e.g. filter by status, sort by success_rate).
   */
  async registerAgent(agent: StandardAgent): Promise<void> {
    // Enforce DID — every agent must have a DID for smart contract authorization
    if (!agent.agentDID) {
      const { createAgentDID } = await import('./agent-did.js');
      const didResult = await createAgentDID(agent.agentId);
      agent.agentDID = didResult.did;
      if ('agentBlindedKey' in agent) (agent as unknown as Record<string, unknown>).agentBlindedKey = didResult.blindedKey;
      if ('agentPublicKey' in agent) (agent as unknown as Record<string, unknown>).agentPublicKey = didResult.publicKey;
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO agents_v2 (
         agent_id, agent_data, status, last_invocation,
         success_rate, avg_response_time_ms, validation_score,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (agent_id) DO UPDATE SET
         agent_data            = EXCLUDED.agent_data,
         status                = EXCLUDED.status,
         last_invocation       = EXCLUDED.last_invocation,
         success_rate          = EXCLUDED.success_rate,
         avg_response_time_ms  = EXCLUDED.avg_response_time_ms,
         validation_score      = EXCLUDED.validation_score,
         updated_at            = NOW()`,
      [
        agent.agentId,
        JSON.stringify(agent),
        agent.status,
        agent.lastInvocation ?? null,
        agent.successRate ?? null,
        agent.avgResponseTimeMs ?? null,
        agent.validationScore ?? null,
      ]
    );

    // Auto-generate test fixture for validation pipeline (fire-and-forget)
    this.generateFixtureForAgent(agent).catch((err) => {
      console.warn(`[AgentStore] Fixture generation failed for ${agent.agentId}:`, err instanceof Error ? err.message : err);
    });
  }

  /** Generate a test fixture file for a newly registered agent */
  private async generateFixtureForAgent(agent: StandardAgent): Promise<void> {
    try {
      const { generateFixture } = await import('../validation/fixture-generator.js');
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');

      const __dirname = fileURLToPath(new URL('.', import.meta.url));
      const fixturesDir = join(__dirname, '..', 'validation', 'fixtures');
      await mkdir(fixturesDir, { recursive: true });

      const fixturePath = join(fixturesDir, `${agent.agentId}.json`);
      // Only generate if fixture doesn't exist yet
      const { access } = await import('node:fs/promises');
      try { await access(fixturePath); return; } catch { /* doesn't exist — generate */ }

      const fixture = generateFixture(agent);
      await writeFile(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8');
      console.log(`[AgentStore] Generated fixture for ${agent.agentId}`);
    } catch {
      // Non-critical — fixture generation is best-effort
    }
  }

  /**
   * Retrieve a single agent by ID.
   * Returns undefined if not found.
   */
  async getAgent(agentId: string): Promise<StandardAgent | undefined> {
    const pool = getPool();
    const result = await pool.query<{ agent_data: StandardAgent }>(
      `SELECT agent_data FROM agents_v2 WHERE agent_id = $1`,
      [agentId]
    );
    if (result.rows.length === 0) return undefined;
    return result.rows[0].agent_data;
  }

  /**
   * List all agents, optionally filtered by status.
   */
  async listAgents(filters?: { status?: string }): Promise<StandardAgent[]> {
    const pool = getPool();
    if (filters?.status) {
      const result = await pool.query<{ agent_data: StandardAgent }>(
        `SELECT agent_data FROM agents_v2 WHERE status = $1 ORDER BY created_at`,
        [filters.status]
      );
      return result.rows.map((r) => r.agent_data);
    }
    const result = await pool.query<{ agent_data: StandardAgent }>(
      `SELECT agent_data FROM agents_v2 ORDER BY created_at`
    );
    return result.rows.map((r) => r.agent_data);
  }

  /**
   * Apply partial updates to an existing agent's stored data.
   * Merges the updates into the existing agent_data JSONB.
   */
  async updateAgent(
    agentId: string,
    updates: Partial<StandardAgent>
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE agents_v2
       SET agent_data = agent_data || $2::jsonb,
           status     = COALESCE($3, status),
           updated_at = NOW()
       WHERE agent_id = $1`,
      [
        agentId,
        JSON.stringify(updates),
        updates.status ?? null,
      ]
    );
  }

  /**
   * Remove an agent and all associated memory (FK cascade on agent_memory).
   */
  async deleteAgent(agentId: string): Promise<void> {
    const pool = getPool();
    await pool.query(`DELETE FROM agents_v2 WHERE agent_id = $1`, [agentId]);
  }

  /**
   * Update health metrics columns for an agent.
   * Used after each invocation to track performance.
   */
  async updateHealth(
    agentId: string,
    health: {
      lastInvocation: Date;
      successRate: number;
      avgResponseTimeMs: number;
    }
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE agents_v2
       SET last_invocation      = $2,
           success_rate         = $3,
           avg_response_time_ms = $4,
           updated_at           = NOW()
       WHERE agent_id = $1`,
      [agentId, health.lastInvocation, health.successRate, health.avgResponseTimeMs]
    );
  }

  /**
   * Append an entry to the agent_action_log audit trail.
   */
  async logAction(
    agentId: string,
    action: string,
    details?: unknown
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO agent_action_log (agent_id, action, details)
       VALUES ($1, $2, $3)`,
      [agentId, action, details !== undefined ? JSON.stringify(details) : null]
    );
  }
}

// ============================================================================
// Singleton factory
// ============================================================================

let _store: AgentStore | null = null;

/**
 * Returns the shared AgentStore singleton.
 * Call once at startup; subsequent calls return the same instance.
 */
export function getAgentStore(): AgentStore {
  if (!_store) _store = new AgentStore();
  return _store;
}
