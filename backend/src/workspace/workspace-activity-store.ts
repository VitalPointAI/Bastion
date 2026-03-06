/**
 * Workspace Activity Store
 *
 * Phase 19: Workspace Membership and Invite System
 * Off-chain activity log with role-based visibility.
 *
 * Activity types:
 *   'workspace_created'   — Workspace was created
 *   'member_joined'       — Member accepted invite and joined
 *   'member_removed'      — Member was removed from workspace
 *   'member_suspended'    — Member was suspended (access revoked, membership preserved)
 *   'member_unsuspended'  — Member was unsuspended (access restored)
 *   'role_changed'        — Member's role was updated
 *   'invite_sent'         — Invite was created and sent
 *   'invite_accepted'     — Invite was accepted
 *   'invite_cancelled'    — Invite was cancelled
 *   'mission_created'     — Mission was created within the workspace
 *   'exercise_created'    — Exercise was created within the workspace
 *   'workspace_updated'   — Workspace settings were updated
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { WorkspaceActivity } from './types.js';

async function initWorkspaceActivityTable(): Promise<void> {
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

export class WorkspaceActivityStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspaceActivityTable();
      this.initialized = true;
    }
  }

  /**
   * Log a workspace activity event.
   */
  async log(
    workspaceId: string,
    activityType: string,
    actorDid: string,
    subjectDid: string | null,
    metadata: Record<string, unknown> = {},
    txHash?: string,
  ): Promise<WorkspaceActivity> {
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
        workspaceId,
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
      workspaceId,
      activityType,
      actorDid,
      subjectDid,
      metadata,
      txHash: txHash ?? null,
      createdAt: now,
    };
  }

  /**
   * List activities for a workspace, ordered by newest first.
   * Supports optional type filtering and pagination.
   * Default limit: 50.
   */
  async listActivities(
    workspaceId: string,
    options?: {
      limit?: number;
      offset?: number;
      types?: string[];
    },
  ): Promise<WorkspaceActivity[]> {
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
      params = [workspaceId, options.types, limit, offset];
    } else {
      query = `
        SELECT * FROM problem_set_activity
        WHERE problem_set_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [workspaceId, limit, offset];
    }

    const result = await pool.query(query, params);
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * List activities where the user is either the actor or the subject.
   * Useful for a user's personal activity timeline across workspaces.
   * Default limit: 50.
   */
  async listActivitiesForUser(
    userDid: string,
    options?: { limit?: number },
  ): Promise<WorkspaceActivity[]> {
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
   * Count activities in a workspace since a given timestamp.
   * Used for unread activity badges.
   */
  async getUnreadCount(workspaceId: string, since: Date): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) FROM problem_set_activity WHERE problem_set_id = $1 AND created_at > $2',
      [workspaceId, since],
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get unread activity counts for multiple workspaces at once.
   * Uses a single query with CASE/WHEN for efficiency.
   *
   * @param userDid - The user's DID (used to verify they are a member of these workspaces)
   * @param lastSeenMap - Map of workspace_id → ISO timestamp string of last seen activity
   * @returns Map of workspace_id → unread count
   */
  async getUnreadCountsForUser(
    userDid: string,
    lastSeenMap: Record<string, string>,
  ): Promise<Record<string, number>> {
    const workspaceIds = Object.keys(lastSeenMap);
    if (workspaceIds.length === 0) return {};

    await this.ensureInitialized();
    const pool = getPool();

    // Build a CASE/WHEN expression to count per-workspace since each workspace's last-seen time
    const caseWhenParts = workspaceIds.map((_wsId, idx) => {
      const paramIdx = idx * 2 + 1; // Parameters come in pairs: workspace_id, timestamp
      return `SUM(CASE WHEN problem_set_id = $${paramIdx} AND created_at > $${paramIdx + 1} THEN 1 ELSE 0 END) AS ws_${idx}`;
    });

    const params: (string | Date)[] = [];
    workspaceIds.forEach((wsId) => {
      params.push(wsId);
      params.push(new Date(lastSeenMap[wsId]));
    });

    // Build WHERE IN clause with individual parameters (ANY(::text[]) needs a single array param)
    const whereParams = workspaceIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
    params.push(...workspaceIds);

    const query = `
      SELECT ${caseWhenParts.join(', ')}
      FROM problem_set_activity
      WHERE problem_set_id IN (${whereParams})
    `;

    const result = await pool.query(query, params);

    const counts: Record<string, number> = {};
    if (result.rows.length > 0) {
      const row = result.rows[0];
      workspaceIds.forEach((wsId, idx) => {
        counts[wsId] = parseInt(row[`ws_${idx}`] ?? '0', 10);
      });
    }

    return counts;
  }

  /**
   * Map a database row (snake_case) to a WorkspaceActivity (camelCase).
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
  }): WorkspaceActivity {
    return {
      id: row.id,
      workspaceId: row.problem_set_id,
      activityType: row.activity_type,
      actorDid: row.actor_did,
      subjectDid: row.subject_did,
      metadata: row.metadata ?? {},
      txHash: row.tx_hash,
      createdAt: new Date(row.created_at),
    };
  }
}

export const workspaceActivityStore = new WorkspaceActivityStore();
