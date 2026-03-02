/**
 * AI Coordination Store
 *
 * Phase 16 Plan 02: Audit log CRUD for ai_coordination_log table.
 * Records every AI-to-AI exchange for auditing, debugging, and replay.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AICoordinationEntry {
  id: string;
  scenarioId: string;
  requestingRole: string;
  respondingRole: string;
  requestType: 'context_read' | 'explicit_task' | 'shared_write';
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  createdAt: Date;
}

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function toAICoordinationEntry(row: Record<string, unknown>): AICoordinationEntry {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    requestingRole: row.requesting_role as string,
    respondingRole: row.responding_role as string,
    requestType: row.request_type as AICoordinationEntry['requestType'],
    requestPayload: (row.request_payload as Record<string, unknown>) ?? {},
    responsePayload: (row.response_payload as Record<string, unknown> | undefined) ?? undefined,
    createdAt: new Date(row.created_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class AICoordinationStore {
  constructor(private pool: Pool) {}

  /**
   * Log an AI-to-AI coordination exchange
   */
  async log(entry: Omit<AICoordinationEntry, 'id' | 'createdAt'>): Promise<AICoordinationEntry> {
    const id = randomUUID();

    await this.pool.query(
      `INSERT INTO ai_coordination_log
         (id, scenario_id, requesting_role, responding_role, request_type, request_payload, response_payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        id,
        entry.scenarioId,
        entry.requestingRole,
        entry.respondingRole,
        entry.requestType,
        JSON.stringify(entry.requestPayload),
        entry.responsePayload ? JSON.stringify(entry.responsePayload) : null,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM ai_coordination_log WHERE id = $1',
      [id]
    );
    return toAICoordinationEntry(result.rows[0]);
  }

  /**
   * Find all coordination log entries for a scenario, ordered newest-first.
   * Supports pagination via optional limit and offset.
   */
  async findByScenario(
    scenarioId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<AICoordinationEntry[]> {
    const limit = options?.limit;
    const offset = options?.offset ?? 0;

    let query = `SELECT * FROM ai_coordination_log
                 WHERE scenario_id = $1
                 ORDER BY created_at DESC`;
    const params: unknown[] = [scenarioId];

    if (limit !== undefined) {
      query += ` LIMIT $2 OFFSET $3`;
      params.push(limit, offset);
    } else if (offset > 0) {
      query += ` OFFSET $2`;
      params.push(offset);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(toAICoordinationEntry);
  }

  /**
   * Find all coordination entries involving a specific role (as requester or responder)
   */
  async findByRole(scenarioId: string, roleKey: string): Promise<AICoordinationEntry[]> {
    const result = await this.pool.query(
      `SELECT * FROM ai_coordination_log
       WHERE scenario_id = $1
         AND (requesting_role = $2 OR responding_role = $2)
       ORDER BY created_at DESC`,
      [scenarioId, roleKey]
    );
    return result.rows.map(toAICoordinationEntry);
  }
}
