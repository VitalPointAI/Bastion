/**
 * Invite Store
 *
 * Phase 4.4 Plan 01: Secure mission invitation system with token-based access
 */

import { randomBytes, createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { MissionInvite, ParticipantRole } from './types.js';
import { participantStore } from './participant-store.js';

export async function initInviteTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mission_invites (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      invitee_email TEXT,
      invitee_did TEXT,
      role TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_invite_mission ON mission_invites(mission_id);
    CREATE INDEX IF NOT EXISTS idx_invite_token ON mission_invites(token);
    CREATE INDEX IF NOT EXISTS idx_invite_expires ON mission_invites(expires_at);
  `);
}

export class InviteStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initInviteTable();
      this.initialized = true;
    }
  }

  /**
   * Generate secure invite token
   *
   * Returns both the raw token (to send to invitee) and hashed token (to store in DB)
   */
  generateInviteToken(expirationHours: number = 72): {
    token: string;
    hashedToken: string;
    expiresAt: Date;
  } {
    const token = randomBytes(32).toString('base64url'); // URL-safe base64
    const hashedToken = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

    return { token, hashedToken, expiresAt };
  }

  /**
   * Create a mission invite
   */
  async createInvite(
    missionId: string,
    role: ParticipantRole,
    createdBy: string,
    inviteeEmail?: string,
    inviteeDid?: string,
    expirationHours: number = 72
  ): Promise<{ invite: MissionInvite; rawToken: string }> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `INV-${randomUUID()}`;
    const now = new Date();

    const { token, hashedToken, expiresAt } = this.generateInviteToken(expirationHours);

    await pool.query(
      `
      INSERT INTO mission_invites (
        id, mission_id, token, invitee_email, invitee_did,
        role, expires_at, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        id,
        missionId,
        hashedToken,
        inviteeEmail || null,
        inviteeDid || null,
        role,
        expiresAt,
        createdBy,
        now,
      ]
    );

    return {
      invite: {
        id,
        missionId,
        token: hashedToken,
        inviteeEmail,
        inviteeDid,
        role,
        expiresAt,
        createdBy,
        createdAt: now,
      },
      rawToken: token, // Return raw token to send to invitee
    };
  }

  /**
   * Get invite by token (hashes the incoming token for lookup)
   */
  async getInviteByToken(token: string): Promise<MissionInvite | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const hashedToken = createHash('sha256').update(token).digest('hex');

    const result = await pool.query(
      `SELECT * FROM mission_invites
       WHERE token = $1
       AND expires_at > NOW()
       AND accepted_at IS NULL`,
      [hashedToken]
    );

    if (result.rows.length === 0) return null;
    return this.rowToInvite(result.rows[0]);
  }

  /**
   * Accept an invite and create participant
   */
  async acceptInvite(token: string, acceptorDid: string): Promise<MissionInvite | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const invite = await this.getInviteByToken(token);
    if (!invite) return null;

    // Check if targeted invite matches acceptor
    if (invite.inviteeDid && invite.inviteeDid !== acceptorDid) {
      throw new Error('This invite is for a different user');
    }

    const now = new Date();

    // Mark invite as accepted
    const hashedToken = createHash('sha256').update(token).digest('hex');
    await pool.query(
      'UPDATE mission_invites SET accepted_at = $1 WHERE token = $2',
      [now, hashedToken]
    );

    // Create participant
    await participantStore.addParticipant(
      invite.missionId,
      acceptorDid,
      invite.role,
      invite.createdBy
    );

    return {
      ...invite,
      acceptedAt: now,
    };
  }

  /**
   * Delete expired invites (cleanup job)
   */
  async deleteExpiredInvites(): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM mission_invites WHERE expires_at < NOW() AND accepted_at IS NULL'
    );
    return result.rowCount || 0;
  }

  /**
   * List invites for a mission
   */
  async listInvites(missionId: string): Promise<MissionInvite[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM mission_invites WHERE mission_id = $1 ORDER BY created_at DESC',
      [missionId]
    );

    return result.rows.map((row) => this.rowToInvite(row));
  }

  /**
   * Convert database row to MissionInvite object
   */
  private rowToInvite(row: {
    id: string;
    mission_id: string;
    token: string;
    invitee_email?: string;
    invitee_did?: string;
    role: string;
    expires_at: Date;
    accepted_at?: Date;
    created_by: string;
    created_at: Date;
  }): MissionInvite {
    return {
      id: row.id,
      missionId: row.mission_id,
      token: row.token,
      inviteeEmail: row.invitee_email,
      inviteeDid: row.invitee_did,
      role: row.role as ParticipantRole,
      expiresAt: new Date(row.expires_at),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
    };
  }
}

// Singleton instance
export const inviteStore = new InviteStore();
