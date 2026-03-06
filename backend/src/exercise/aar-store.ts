/**
 * AAR (After-Action Review) Event Store
 *
 * Phase 22 Plan 04: Training-mode infrastructure for capturing exercise events.
 *
 * Records decisions, AI recommendations, governance votes, outcomes, and phase changes
 * in training workspaces. Events are append-only — no delete or update methods.
 * This ensures AAR data persists across checkpoint resets.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ============================================================================
// Types
// ============================================================================

export interface AAREvent {
  id: string;
  workspaceId: string;
  scenarioId: string | null;
  exercisePhase: string;
  eventType: 'decision' | 'ai_recommendation' | 'governance_vote' | 'outcome' | 'phase_change';
  actorDid: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Table Initialization
// ============================================================================

async function initAARTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aar_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      scenario_id TEXT,
      exercise_phase TEXT NOT NULL DEFAULT 'unknown',
      event_type TEXT NOT NULL,
      actor_did TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aar_workspace ON aar_events(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_aar_type ON aar_events(event_type);
  `);
}

// ============================================================================
// AAR Store
// ============================================================================

class AARStore {
  private initialized = false;

  async init(): Promise<void> {
    if (!this.initialized) {
      await initAARTable();
      this.initialized = true;
    }
  }

  /**
   * Record an AAR event. Append-only — events are never deleted or updated.
   */
  async record(
    event: Omit<AAREvent, 'id' | 'createdAt'>,
  ): Promise<AAREvent> {
    await this.init();
    const pool = getPool();
    const id = randomUUID();

    const result = await pool.query(
      `INSERT INTO aar_events (id, workspace_id, scenario_id, exercise_phase, event_type, actor_did, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING created_at`,
      [
        id,
        event.workspaceId,
        event.scenarioId ?? null,
        event.exercisePhase,
        event.eventType,
        event.actorDid,
        JSON.stringify(event.payload),
      ],
    );

    return {
      id,
      ...event,
      createdAt: new Date(result.rows[0].created_at),
    };
  }

  /**
   * List AAR events for a workspace, with optional filters.
   */
  async listByWorkspace(
    workspaceId: string,
    opts?: { eventType?: string; limit?: number },
  ): Promise<AAREvent[]> {
    await this.init();
    const pool = getPool();

    const conditions = ['workspace_id = $1'];
    const params: unknown[] = [workspaceId];
    let paramIndex = 2;

    if (opts?.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(opts.eventType);
    }

    const limitClause = opts?.limit ? ` LIMIT $${paramIndex++}` : '';
    if (opts?.limit) params.push(opts.limit);

    const result = await pool.query(
      `SELECT * FROM aar_events WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC${limitClause}`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      scenarioId: row.scenario_id,
      exercisePhase: row.exercise_phase,
      eventType: row.event_type,
      actorDid: row.actor_did,
      payload: row.payload,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * List all AAR events for a scenario across workspaces.
   */
  async listByScenario(scenarioId: string): Promise<AAREvent[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM aar_events WHERE scenario_id = $1 ORDER BY created_at DESC',
      [scenarioId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      scenarioId: row.scenario_id,
      exercisePhase: row.exercise_phase,
      eventType: row.event_type,
      actorDid: row.actor_did,
      payload: row.payload,
      createdAt: new Date(row.created_at),
    }));
  }
}

// Singleton export
export const aarStore = new AARStore();
