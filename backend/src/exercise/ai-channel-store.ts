/**
 * AI Channel Store
 *
 * Phase 16 Plan 02: CRUD + PostgreSQL NOTIFY for ai_channel_events table.
 * Stores real-time channel activity for AI-assigned roles; emits pg_notify
 * on each insert so SSE endpoints can push events to clients immediately.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { AIChannelEvent } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function toAIChannelEvent(row: Record<string, unknown>): AIChannelEvent {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    roleKey: row.role_key as string,
    runId: (row.run_id as string | undefined) ?? undefined,
    eventType: row.event_type as AIChannelEvent['eventType'],
    payload: (row.payload as Record<string, unknown>) ?? {},
    agentName: (row.agent_name as string | undefined) ?? undefined,
    createdAt: new Date(row.created_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class AIChannelStore {
  constructor(private pool: Pool) {}

  /**
   * Insert a channel event and NOTIFY subscribers via pg_notify.
   *
   * Channel name format: channel:{scenarioId}:{roleKey}
   * This allows SSE endpoints to subscribe per (scenario, role) pair.
   */
  async create(event: Omit<AIChannelEvent, 'id' | 'createdAt'>): Promise<AIChannelEvent> {
    const id = randomUUID();

    await this.pool.query(
      `INSERT INTO ai_channel_events
         (id, scenario_id, role_key, run_id, event_type, payload, agent_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        id,
        event.scenarioId,
        event.roleKey,
        event.runId ?? null,
        event.eventType,
        JSON.stringify(event.payload),
        event.agentName ?? null,
      ]
    );

    // NOTIFY subscribers so SSE endpoints receive real-time events
    const notifyPayload = JSON.stringify({
      id,
      scenarioId: event.scenarioId,
      roleKey: event.roleKey,
      runId: event.runId,
      eventType: event.eventType,
      agentName: event.agentName,
    });
    await this.pool.query(
      `SELECT pg_notify($1, $2)`,
      [`channel:${event.scenarioId}:${event.roleKey}`, notifyPayload]
    );

    const result = await this.pool.query(
      'SELECT * FROM ai_channel_events WHERE id = $1',
      [id]
    );
    return toAIChannelEvent(result.rows[0]);
  }

  /**
   * Find events for a specific role in a scenario, ordered by creation time ASC.
   * Optional limit for backfill scenarios (e.g., reconnecting SSE clients).
   */
  async findByRole(scenarioId: string, roleKey: string, limit?: number): Promise<AIChannelEvent[]> {
    const query = limit
      ? `SELECT * FROM ai_channel_events
         WHERE scenario_id = $1 AND role_key = $2
         ORDER BY created_at ASC
         LIMIT $3`
      : `SELECT * FROM ai_channel_events
         WHERE scenario_id = $1 AND role_key = $2
         ORDER BY created_at ASC`;

    const params = limit ? [scenarioId, roleKey, limit] : [scenarioId, roleKey];
    const result = await this.pool.query(query, params);
    return result.rows.map(toAIChannelEvent);
  }

  /**
   * Find all events produced during a specific AI run
   */
  async findByRun(runId: string): Promise<AIChannelEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM ai_channel_events
       WHERE run_id = $1
       ORDER BY created_at ASC`,
      [runId]
    );
    return result.rows.map(toAIChannelEvent);
  }
}
