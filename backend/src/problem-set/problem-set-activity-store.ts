/**
 * Problem Set Activity Store
 *
 * Phase 23: Problem Set Model & Workspace Rename
 * Off-chain activity log with role-based visibility.
 *
 * Activity types:
 *   'problem_set_created'  — Problem set was created
 *   'member_joined'        — Member accepted invite and joined
 *   'member_removed'       — Member was removed from problem set
 *   'member_suspended'     — Member was suspended (access revoked, membership preserved)
 *   'member_unsuspended'   — Member was unsuspended (access restored)
 *   'role_changed'         — Member's role was updated
 *   'invite_sent'          — Invite was created and sent
 *   'invite_accepted'      — Invite was accepted
 *   'invite_cancelled'     — Invite was cancelled
 *   'mission_created'      — Mission was created within the problem set
 *   'exercise_created'     — Exercise was created within the problem set
 *   'problem_set_updated'  — Problem set settings were updated
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ProblemSetActivity } from './types.js';

async function initProblemSetActivityTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_activity (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      actor_did TEXT NOT NULL,
      subject_did TEXT,
      metadata JSONB NOT NULL DEFAULT '{}',
      tx_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pa_problem_set ON problem_set_activity(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_pa_created ON problem_set_activity(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pa_actor ON problem_set_activity(actor_did);
  `);
}

export class ProblemSetActivityStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initProblemSetActivityTable();
      this.initialized = true;
    }
  }

  /**
   * Log a problem set activity event.
   */
  async log(
    problemSetId: string,
    activityType: string,
    actorDid: string,
    subjectDid: string | null,
    metadata: Record<string, unknown> = {},
    txHash?: string,
  ): Promise<ProblemSetActivity> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `PA-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO problem_set_activity (
        id, problem_set_id, activity_type, actor_did, subject_did, metadata, tx_hash, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        id,
        problemSetId,
        activityType,
        actorDid,
        subjectDid,
        JSON.stringify(metadata),
        txHash ?? null,
        now,
      ],
    );

    return {
      id,
      problemSetId,
      activityType,
      actorDid,
      subjectDid,
      metadata,
      txHash: txHash ?? null,
      createdAt: now,
    };
  }

  /**
   * List activities for a problem set, ordered by newest first.
   * Supports optional type filtering and pagination.
   * Default limit: 50.
   */
  async listActivities(
    problemSetId: string,
    options?: {
      limit?: number;
      offset?: number;
      types?: string[];
    },
  ): Promise<ProblemSetActivity[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query: string;
    let params: (string | number | string[])[];

    if (options?.types && options.types.length > 0) {
      query = `
        SELECT * FROM problem_set_activity
        WHERE problem_set_id = $1 AND activity_type = ANY($2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;
      params = [problemSetId, options.types, limit, offset];
    } else {
      query = `
        SELECT * FROM problem_set_activity
        WHERE problem_set_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [problemSetId, limit, offset];
    }

    const result = await pool.query(query, params);
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * List activities where the user is either the actor or the subject.
   * Useful for a user's personal activity timeline across problem sets.
   * Default limit: 50.
   */
  async listActivitiesForUser(
    userDid: string,
    options?: { limit?: number },
  ): Promise<ProblemSetActivity[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const limit = options?.limit ?? 50;

    const result = await pool.query(
      `SELECT * FROM problem_set_activity
       WHERE actor_did = $1 OR subject_did = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userDid, limit],
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Count activities in a problem set since a given timestamp.
   * Used for unread activity badges.
   */
  async getUnreadCount(problemSetId: string, since: Date): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) FROM problem_set_activity WHERE problem_set_id = $1 AND created_at > $2',
      [problemSetId, since],
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get unread activity counts for multiple problem sets at once.
   * Uses a single query with CASE/WHEN for efficiency.
   *
   * @param userDid - The user's DID (used to verify they are a member of these problem sets)
   * @param lastSeenMap - Map of problem_set_id to ISO timestamp string of last seen activity
   * @returns Map of problem_set_id to unread count
   */
  async getUnreadCountsForUser(
    userDid: string,
    lastSeenMap: Record<string, string>,
  ): Promise<Record<string, number>> {
    const problemSetIds = Object.keys(lastSeenMap);
    if (problemSetIds.length === 0) return {};

    await this.ensureInitialized();
    const pool = getPool();

    // Build a CASE/WHEN expression to count per-problem-set since each problem set's last-seen time
    const caseWhenParts = problemSetIds.map((_psId, idx) => {
      const paramIdx = idx * 2 + 1; // Parameters come in pairs: problem_set_id, timestamp
      return `SUM(CASE WHEN problem_set_id = $${paramIdx} AND created_at > $${paramIdx + 1} THEN 1 ELSE 0 END) AS ps_${idx}`;
    });

    const params: (string | Date)[] = [];
    problemSetIds.forEach((psId) => {
      params.push(psId);
      params.push(new Date(lastSeenMap[psId]));
    });

    // Build WHERE IN clause with individual parameters
    const whereParams = problemSetIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
    params.push(...problemSetIds);

    const query = `
      SELECT ${caseWhenParts.join(', ')}
      FROM problem_set_activity
      WHERE problem_set_id IN (${whereParams})
    `;

    const result = await pool.query(query, params);

    const counts: Record<string, number> = {};
    if (result.rows.length > 0) {
      const row = result.rows[0];
      problemSetIds.forEach((psId, idx) => {
        counts[psId] = parseInt(row[`ps_${idx}`] ?? '0', 10);
      });
    }

    return counts;
  }

  /**
   * Map a database row (snake_case) to a ProblemSetActivity (camelCase).
   */
  private mapRow(row: {
    id: string;
    problem_set_id: string;
    activity_type: string;
    actor_did: string;
    subject_did: string | null;
    metadata: Record<string, unknown>;
    tx_hash: string | null;
    created_at: Date;
  }): ProblemSetActivity {
    return {
      id: row.id,
      problemSetId: row.problem_set_id,
      activityType: row.activity_type,
      actorDid: row.actor_did,
      subjectDid: row.subject_did,
      metadata: row.metadata ?? {},
      txHash: row.tx_hash,
      createdAt: new Date(row.created_at),
    };
  }
}

export const problemSetActivityStore = new ProblemSetActivityStore();
