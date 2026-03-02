/**
 * AI Run Store
 *
 * Phase 16 Plan 02: CRUD for ai_role_runs table.
 * Tracks AI execution run lifecycle for each role invocation within a scenario.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { AIRoleRun, CreateAIRoleRun } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function toAIRoleRun(row: Record<string, unknown>): AIRoleRun {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    roleKey: row.role_key as string,
    triggerType: row.trigger_type as AIRoleRun['triggerType'],
    triggerContext: (row.trigger_context as Record<string, unknown>) ?? {},
    status: row.status as AIRoleRun['status'],
    pausedAt: row.paused_at ? new Date(row.paused_at as string) : undefined,
    resumedAt: row.resumed_at ? new Date(row.resumed_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    error: (row.error as string | undefined) ?? undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class AIRunStore {
  constructor(private pool: Pool) {}

  /**
   * Create a new AI role run in 'queued' status
   */
  async create(input: CreateAIRoleRun): Promise<AIRoleRun> {
    const id = randomUUID();

    await this.pool.query(
      `INSERT INTO ai_role_runs
         (id, scenario_id, role_key, trigger_type, trigger_context, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'queued', NOW(), NOW())`,
      [
        id,
        input.scenarioId,
        input.roleKey,
        input.triggerType,
        JSON.stringify(input.triggerContext),
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM ai_role_runs WHERE id = $1',
      [id]
    );
    return toAIRoleRun(result.rows[0]);
  }

  /**
   * Find a run by its ID
   */
  async findById(id: string): Promise<AIRoleRun | null> {
    const result = await this.pool.query(
      'SELECT * FROM ai_role_runs WHERE id = $1',
      [id]
    );
    return result.rows[0] ? toAIRoleRun(result.rows[0]) : null;
  }

  /**
   * Find all runs for a scenario + role combination, ordered by creation time
   */
  async findByScenarioAndRole(scenarioId: string, roleKey: string): Promise<AIRoleRun[]> {
    const result = await this.pool.query(
      `SELECT * FROM ai_role_runs
       WHERE scenario_id = $1 AND role_key = $2
       ORDER BY created_at ASC`,
      [scenarioId, roleKey]
    );
    return result.rows.map(toAIRoleRun);
  }

  /**
   * Find the currently active run for a role (queued, running, awaiting_review, or paused)
   */
  async findActiveRun(scenarioId: string, roleKey: string): Promise<AIRoleRun | null> {
    const result = await this.pool.query(
      `SELECT * FROM ai_role_runs
       WHERE scenario_id = $1
         AND role_key = $2
         AND status IN ('queued', 'running', 'awaiting_review', 'paused')
       ORDER BY created_at DESC
       LIMIT 1`,
      [scenarioId, roleKey]
    );
    return result.rows[0] ? toAIRoleRun(result.rows[0]) : null;
  }

  /**
   * Update run status and optional fields (error, pausedAt, resumedAt, completedAt)
   */
  async updateStatus(
    id: string,
    status: AIRoleRun['status'],
    extra?: Partial<Pick<AIRoleRun, 'error' | 'pausedAt' | 'resumedAt' | 'completedAt'>>
  ): Promise<AIRoleRun> {
    const setClauses: string[] = ['status = $1', 'updated_at = NOW()'];
    const values: unknown[] = [status];
    let i = 2;

    if (extra?.error !== undefined) {
      setClauses.push(`error = $${i++}`);
      values.push(extra.error);
    }
    if (extra?.pausedAt !== undefined) {
      setClauses.push(`paused_at = $${i++}`);
      values.push(extra.pausedAt);
    }
    if (extra?.resumedAt !== undefined) {
      setClauses.push(`resumed_at = $${i++}`);
      values.push(extra.resumedAt);
    }
    if (extra?.completedAt !== undefined) {
      setClauses.push(`completed_at = $${i++}`);
      values.push(extra.completedAt);
    }

    values.push(id);
    await this.pool.query(
      `UPDATE ai_role_runs SET ${setClauses.join(', ')} WHERE id = $${i}`,
      values
    );

    const result = await this.pool.query(
      'SELECT * FROM ai_role_runs WHERE id = $1',
      [id]
    );
    return toAIRoleRun(result.rows[0]);
  }

  /**
   * Additively merge additional context into the existing trigger_context using JSONB || operator.
   * Never overwrites — only adds/updates keys.
   */
  async mergeTriggerContext(id: string, additionalContext: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `UPDATE ai_role_runs
       SET trigger_context = trigger_context || $1,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(additionalContext), id]
    );
  }
}
