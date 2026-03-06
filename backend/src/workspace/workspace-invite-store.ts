/**
 * Workspace Invite Store
 *
 * Phase 19: Workspace Membership and Invite System
 * Token-based invite lifecycle with clearance gating.
 *
 * Token pattern: SHA-256 hash is stored; raw token returned to caller for invite link.
 * Mirrors the proven mission invite-store.ts pattern.
 */

import { randomBytes, createHash, randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { WorkspaceInvite } from './types.js';

async function initWorkspaceInviteTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_invites (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      invitee_email TEXT,
      invitee_did TEXT,
      role TEXT NOT NULL,
      dao_role TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      approved_by TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_pi_problem_set ON problem_set_invites(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_pi_token ON problem_set_invites(token);
  `);
}

export class WorkspaceInviteStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspaceInviteTable();
      this.initialized = true;
    }
  }

  /**
   * Generate a secure invite token.
   * Raw token is URL-safe base64 (for invite links).
   * Only the SHA-256 hash is stored in the database.
   */
  private generateToken(expiresInHours: number = 72): {
    rawToken: string;
    hashedToken: string;
    expiresAt: Date;
  } {
    const rawToken = randomBytes(32).toString('base64url');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    return { rawToken, hashedToken, expiresAt };
  }

  /**
   * Create a workspace invite.
   * Returns both the invite record (with hashed token) and the raw token for the invite link.
   * Default expiry: 72 hours.
   */
  async createInvite(
    workspaceId: string,
    role: string,
    daoRole: string,
    createdBy: string,
    options?: {
      inviteeEmail?: string;
      inviteeDid?: string;
      expiresInHours?: number;
    },
  ): Promise<{ invite: WorkspaceInvite; rawToken: string }> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `PI-${randomUUID()}`;
    const now = new Date();

    const { rawToken, hashedToken, expiresAt } = this.generateToken(
      options?.expiresInHours ?? 72,
    );

    await pool.query(
      `
      INSERT INTO problem_set_invites (
        id, problem_set_id, token, invitee_email, invitee_did,
        role, dao_role, expires_at, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        id,
        workspaceId,
        hashedToken,
        options?.inviteeEmail ?? null,
        options?.inviteeDid ?? null,
        role,
        daoRole,
        expiresAt,
        createdBy,
        now,
      ],
    );

    const invite: WorkspaceInvite = {
      id,
      workspaceId,
      token: hashedToken,
      inviteeEmail: options?.inviteeEmail ?? null,
      inviteeDid: options?.inviteeDid ?? null,
      role,
      daoRole,
      expiresAt,
      acceptedAt: null,
      approvedAt: null,
      approvedBy: null,
      createdBy,
      createdAt: now,
    };

    return { invite, rawToken };
  }

  /**
   * Look up an invite by raw token (hashes it for DB lookup).
   * Only returns invites that are not expired and not yet accepted.
   */
  async getInviteByToken(rawToken: string): Promise<WorkspaceInvite | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const result = await pool.query(
      `SELECT * FROM problem_set_invites
       WHERE token = $1
       AND expires_at > NOW()
       AND accepted_at IS NULL`,
      [hashedToken],
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Get an invite by its ID.
   */
  async getInviteById(id: string): Promise<WorkspaceInvite | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM problem_set_invites WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * List all invites for a workspace, ordered by creation date (newest first).
   */
  async listInvitesForWorkspace(workspaceId: string): Promise<WorkspaceInvite[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM problem_set_invites WHERE problem_set_id = $1 ORDER BY created_at DESC',
      [workspaceId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * List pending invites (not yet accepted and not expired) for a workspace.
   */
  async listPendingInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM problem_set_invites
       WHERE problem_set_id = $1
       AND accepted_at IS NULL
       AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [workspaceId],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Mark an invite as accepted.
   */
  async markAccepted(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query(
      'UPDATE problem_set_invites SET accepted_at = NOW() WHERE id = $1',
      [id],
    );
  }

  /**
   * Mark an invite as approved by an admin (for gated workspaces).
   */
  async markApproved(id: string, approvedBy: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query(
      'UPDATE problem_set_invites SET approved_at = NOW(), approved_by = $2 WHERE id = $1',
      [id, approvedBy],
    );
  }

  /**
   * Cancel (delete) an invite.
   */
  async cancelInvite(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query('DELETE FROM problem_set_invites WHERE id = $1', [id]);
  }

  /**
   * Delete all expired, unaccepted invites.
   * Returns the number of invites deleted.
   */
  async cleanupExpired(): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM problem_set_invites WHERE expires_at < NOW() AND accepted_at IS NULL',
    );
    return result.rowCount ?? 0;
  }

  /**
   * Map a database row (snake_case) to a WorkspaceInvite (camelCase).
   */
  private mapRow(row: {
    id: string;
    problem_set_id: string;
    token: string;
    invitee_email: string | null;
    invitee_did: string | null;
    role: string;
    dao_role: string;
    expires_at: Date;
    accepted_at: Date | null;
    approved_at: Date | null;
    approved_by: string | null;
    created_by: string;
    created_at: Date;
  }): WorkspaceInvite {
    return {
      id: row.id,
      workspaceId: row.problem_set_id,
      token: row.token,
      inviteeEmail: row.invitee_email,
      inviteeDid: row.invitee_did,
      role: row.role,
      daoRole: row.dao_role,
      expiresAt: new Date(row.expires_at),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      approvedBy: row.approved_by,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
    };
  }
}

export const workspaceInviteStore = new WorkspaceInviteStore();
