/**
 * Problem Set Member Store
 *
 * Phase 23: Problem Set Model & Workspace Rename
 * Member CRUD with primary problem set management and suspension.
 *
 * AI agents are first-class problem set members — agent DIDs (did:near:{agentAccountId})
 * are accepted identically to human DIDs. Agent vs. human distinction is enforced at
 * the API layer via role max_agent_tier limits, not in this store.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ProblemSetMember, MemberStatus } from './types.js';

async function initProblemSetMemberTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_members (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      user_did TEXT NOT NULL,
      role TEXT NOT NULL,
      dao_role TEXT NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'active',
      suspended_at TIMESTAMPTZ,
      suspended_by TEXT,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      invited_by TEXT NOT NULL,
      UNIQUE(problem_set_id, user_did)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_per_user
      ON problem_set_members(user_did) WHERE is_primary = true;
    CREATE INDEX IF NOT EXISTS idx_pm_problem_set ON problem_set_members(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_pm_user ON problem_set_members(user_did);
    CREATE INDEX IF NOT EXISTS idx_pm_primary ON problem_set_members(user_did, is_primary);
  `);
}

export class ProblemSetMemberStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initProblemSetMemberTable();
      this.initialized = true;
    }
  }

  /**
   * Add a member to a problem set.
   * If this is the user's first problem set membership, auto-sets is_primary = true.
   * Accepts both human DIDs and agent DIDs (did:near:{agentAccountId}).
   */
  async addMember(
    problemSetId: string,
    userDid: string,
    role: string,
    daoRole: string,
    invitedBy: string,
  ): Promise<ProblemSetMember> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `PM-${randomUUID()}`;
    const now = new Date();

    // Check if this is the user's first problem set membership
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM problem_set_members WHERE user_did = $1',
      [userDid],
    );
    const existingCount = parseInt(countResult.rows[0].count, 10);
    const isPrimary = existingCount === 0;

    await pool.query(
      `
      INSERT INTO problem_set_members (
        id, problem_set_id, user_did, role, dao_role, is_primary, status, joined_at, invited_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
      `,
      [id, problemSetId, userDid, role, daoRole, isPrimary, now, invitedBy],
    );

    return {
      id,
      problemSetId,
      userDid,
      role,
      daoRole,
      isPrimary,
      status: 'active',
      suspendedAt: null,
      suspendedBy: null,
      joinedAt: now,
      invitedBy,
    };
  }

  /**
   * Get a member by problem set ID and user DID (compound key lookup).
   */
  async getMember(problemSetId: string, userDid: string): Promise<ProblemSetMember | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM problem_set_members WHERE problem_set_id = $1 AND user_did = $2',
      [problemSetId, userDid],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Get a member by their membership record ID.
   */
  async getMemberById(id: string): Promise<ProblemSetMember | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM problem_set_members WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * List all active members of a problem set.
   */
  async listMembers(problemSetId: string): Promise<ProblemSetMember[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      "SELECT * FROM problem_set_members WHERE problem_set_id = $1 AND status = 'active' ORDER BY joined_at ASC",
      [problemSetId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * List all problem sets a user belongs to (all statuses).
   */
  async listMemberships(userDid: string): Promise<ProblemSetMember[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM problem_set_members WHERE user_did = $1 ORDER BY joined_at ASC',
      [userDid],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Update a member's military role and DAO role.
   */
  async updateRole(
    problemSetId: string,
    userDid: string,
    newRole: string,
    newDaoRole: string,
  ): Promise<ProblemSetMember> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE problem_set_members
       SET role = $3, dao_role = $4
       WHERE problem_set_id = $1 AND user_did = $2
       RETURNING *`,
      [problemSetId, userDid, newRole, newDaoRole],
    );
    if (result.rows.length === 0) {
      throw new Error(`Member not found: problemSet=${problemSetId}, user=${userDid}`);
    }
    return this.mapRow(result.rows[0]);
  }

  /**
   * Set a problem set as the user's primary problem set.
   * Uses a transaction to atomically clear the old primary and set the new one.
   * The partial unique index on (user_did) WHERE is_primary = true enforces
   * the one-primary-per-user invariant at the DB level.
   */
  async setPrimary(userDid: string, problemSetId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Clear existing primary for this user
      await client.query(
        "UPDATE problem_set_members SET is_primary = false WHERE user_did = $1 AND is_primary = true",
        [userDid],
      );
      // Set new primary
      await client.query(
        'UPDATE problem_set_members SET is_primary = true WHERE problem_set_id = $1 AND user_did = $2',
        [problemSetId, userDid],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Suspend a member (access revoked, membership preserved).
   */
  async suspendMember(
    problemSetId: string,
    userDid: string,
    suspendedBy: string,
  ): Promise<ProblemSetMember> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();
    const result = await pool.query(
      `UPDATE problem_set_members
       SET status = 'suspended', suspended_at = $3, suspended_by = $4
       WHERE problem_set_id = $1 AND user_did = $2
       RETURNING *`,
      [problemSetId, userDid, now, suspendedBy],
    );
    if (result.rows.length === 0) {
      throw new Error(`Member not found: problemSet=${problemSetId}, user=${userDid}`);
    }
    return this.mapRow(result.rows[0]);
  }

  /**
   * Unsuspend a member (restores active status, clears suspension fields).
   */
  async unsuspendMember(problemSetId: string, userDid: string): Promise<ProblemSetMember> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE problem_set_members
       SET status = 'active', suspended_at = NULL, suspended_by = NULL
       WHERE problem_set_id = $1 AND user_did = $2
       RETURNING *`,
      [problemSetId, userDid],
    );
    if (result.rows.length === 0) {
      throw new Error(`Member not found: problemSet=${problemSetId}, user=${userDid}`);
    }
    return this.mapRow(result.rows[0]);
  }

  /**
   * Remove a member from a problem set entirely.
   */
  async removeMember(problemSetId: string, userDid: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query(
      'DELETE FROM problem_set_members WHERE problem_set_id = $1 AND user_did = $2',
      [problemSetId, userDid],
    );
  }

  /**
   * Get the total member count for a problem set (all statuses).
   */
  async getMemberCount(problemSetId: string): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) FROM problem_set_members WHERE problem_set_id = $1',
      [problemSetId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Map a database row (snake_case) to a ProblemSetMember (camelCase).
   */
  private mapRow(row: {
    id: string;
    problem_set_id: string;
    user_did: string;
    role: string;
    dao_role: string;
    is_primary: boolean;
    status: string;
    suspended_at: Date | null;
    suspended_by: string | null;
    joined_at: Date;
    invited_by: string;
  }): ProblemSetMember {
    return {
      id: row.id,
      problemSetId: row.problem_set_id,
      userDid: row.user_did,
      role: row.role,
      daoRole: row.dao_role,
      isPrimary: row.is_primary,
      status: row.status as MemberStatus,
      suspendedAt: row.suspended_at ? new Date(row.suspended_at) : null,
      suspendedBy: row.suspended_by,
      joinedAt: new Date(row.joined_at),
      invitedBy: row.invited_by,
    };
  }
}

export const problemSetMemberStore = new ProblemSetMemberStore();
