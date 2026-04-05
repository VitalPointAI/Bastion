/**
 * Autonomous Activity Store
 *
 * Phase 65 Plan 01: PostgreSQL CRUD for ironclaw_autonomous_activity table.
 * Persists all autonomous findings pushed back from Ironclaw via the callback webhook.
 *
 * Table is created idempotently on first access (same pattern as other stores in project).
 */

import { getPool } from '../lib/database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  id: string;
  problemSetId: string;
  activityType: string;
  severity: 'critical' | 'urgent' | 'routine' | 'informational';
  summary: string;
  detail: Record<string, unknown> | null;
  decisionId: string | null;
  createdAt: Date;
  outcomeStatus: 'pending' | 'positive' | 'negative' | 'neutral';
  commanderRating: number | null; // 1 = thumbs up, -1 = thumbs down, null = unrated
  commanderNotes: string | null;
}

// ---------------------------------------------------------------------------
// Row Mapper
// ---------------------------------------------------------------------------

function rowToEntry(row: Record<string, unknown>): ActivityEntry {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    activityType: row.activity_type as string,
    severity: row.severity as ActivityEntry['severity'],
    summary: row.summary as string,
    detail: (row.detail as Record<string, unknown>) ?? null,
    decisionId: (row.decision_id as string) ?? null,
    createdAt: row.created_at as Date,
    outcomeStatus: ((row.outcome_status as string) ?? 'pending') as ActivityEntry['outcomeStatus'],
    commanderRating: row.commander_rating != null ? Number(row.commander_rating) : null,
    commanderNotes: (row.commander_notes as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// AutonomousActivityStore
// ---------------------------------------------------------------------------

export class AutonomousActivityStore {
  private tableEnsured = false;

  /**
   * Idempotent table creation — called on first use.
   * Index on (problem_set_id, created_at DESC) for efficient recent queries.
   */
  async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;

    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_autonomous_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'informational',
        summary TEXT NOT NULL,
        detail JSONB,
        decision_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        outcome_status TEXT NOT NULL DEFAULT 'pending',
        commander_rating SMALLINT,
        commander_notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_autonomous_activity_ps
        ON ironclaw_autonomous_activity(problem_set_id, created_at DESC);
    `);

    // Idempotent migrations for existing deployments
    await pool.query(`
      ALTER TABLE ironclaw_autonomous_activity
        ADD COLUMN IF NOT EXISTS outcome_status TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE ironclaw_autonomous_activity
        ADD COLUMN IF NOT EXISTS commander_rating SMALLINT;
      ALTER TABLE ironclaw_autonomous_activity
        ADD COLUMN IF NOT EXISTS commander_notes TEXT;
    `);

    this.tableEnsured = true;
  }

  /**
   * Insert a new autonomous activity entry.
   * Returns the created entry with server-generated id and created_at.
   */
  async log(entry: {
    problemSetId: string;
    activityType: string;
    severity: ActivityEntry['severity'];
    summary: string;
    detail?: Record<string, unknown>;
    decisionId?: string;
  }): Promise<ActivityEntry> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_autonomous_activity
         (problem_set_id, activity_type, severity, summary, detail, decision_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        entry.problemSetId,
        entry.activityType,
        entry.severity,
        entry.summary,
        entry.detail ? JSON.stringify(entry.detail) : null,
        entry.decisionId ?? null,
      ],
    );
    return rowToEntry(result.rows[0]);
  }

  /**
   * Get recent activity for a problem set, newest first.
   * Default limit: 50.
   */
  async getRecent(problemSetId: string, limit = 50): Promise<ActivityEntry[]> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM ironclaw_autonomous_activity
       WHERE problem_set_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [problemSetId, limit],
    );
    return result.rows.map(rowToEntry);
  }

  /**
   * Count entries for a problem set created since a given timestamp.
   * Used for per-window circuit breaker checks (e.g., 10 per 30 minutes).
   */
  async getCountSince(problemSetId: string, since: Date): Promise<number> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM ironclaw_autonomous_activity
       WHERE problem_set_id = $1 AND created_at >= $2`,
      [problemSetId, since],
    );
    return parseInt(result.rows[0].cnt as string, 10);
  }

  /**
   * Count entries for a problem set created today (UTC calendar day).
   * Used for daily circuit breaker check (max 100 per day).
   */
  async getDailyCount(problemSetId: string): Promise<number> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM ironclaw_autonomous_activity
       WHERE problem_set_id = $1
         AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')`,
      [problemSetId],
    );
    return parseInt(result.rows[0].cnt as string, 10);
  }

  /**
   * Record commander feedback (thumbs up/down) on an autonomous activity.
   * rating: 1 = positive, -1 = negative, 0 = neutral
   * Sets outcome_status based on the sign of rating.
   */
  async updateOutcome(id: string, rating: number, notes: string | null): Promise<void> {
    await this.ensureTable();
    const pool = getPool();
    const outcomeStatus = rating > 0 ? 'positive' : rating < 0 ? 'negative' : 'neutral';
    await pool.query(
      `UPDATE ironclaw_autonomous_activity
       SET commander_rating = $1, commander_notes = $2, outcome_status = $3
       WHERE id = $4`,
      [rating, notes, outcomeStatus, id],
    );
  }

  /**
   * Return all activities for a problem set that have been rated since a given date.
   * Used by decision path memory (Plan 06) to build reinforcement learning signals.
   */
  async getRatedActivities(problemSetId: string, since: Date): Promise<ActivityEntry[]> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM ironclaw_autonomous_activity
       WHERE problem_set_id = $1 AND commander_rating IS NOT NULL AND created_at >= $2
       ORDER BY created_at DESC`,
      [problemSetId, since],
    );
    return result.rows.map(rowToEntry);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const autonomousActivityStore = new AutonomousActivityStore();
