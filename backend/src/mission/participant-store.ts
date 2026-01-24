/**
 * Participant Store
 *
 * Phase 4.4 Plan 01: Mission participant CRUD operations
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { MissionParticipant, ParticipantRole } from './types.js';

export async function initParticipantTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mission_participants (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      user_did TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      invited_by TEXT NOT NULL,
      UNIQUE(mission_id, user_did)
    );
    CREATE INDEX IF NOT EXISTS idx_participant_mission ON mission_participants(mission_id);
    CREATE INDEX IF NOT EXISTS idx_participant_user ON mission_participants(user_did);
  `);
}

export class ParticipantStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initParticipantTable();
      this.initialized = true;
    }
  }

  /**
   * Add a participant to a mission
   */
  async addParticipant(
    missionId: string,
    userDid: string,
    role: ParticipantRole,
    invitedBy: string
  ): Promise<MissionParticipant> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `PRT-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO mission_participants (
        id, mission_id, user_did, role, joined_at, invited_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [id, missionId, userDid, role, now, invitedBy]
    );

    return {
      id,
      missionId,
      userDid,
      role,
      joinedAt: now,
      invitedBy,
    };
  }

  /**
   * Remove a participant from a mission
   */
  async removeParticipant(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM mission_participants WHERE id = $1',
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * List all participants for a mission
   */
  async listParticipants(missionId: string): Promise<MissionParticipant[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM mission_participants WHERE mission_id = $1 ORDER BY joined_at ASC',
      [missionId]
    );

    return result.rows.map((row) => this.rowToParticipant(row));
  }

  /**
   * Get a specific participant
   */
  async getParticipant(id: string): Promise<MissionParticipant | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM mission_participants WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.rowToParticipant(result.rows[0]);
  }

  /**
   * Get participant by mission and user DID
   */
  async getParticipantByUser(
    missionId: string,
    userDid: string
  ): Promise<MissionParticipant | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM mission_participants WHERE mission_id = $1 AND user_did = $2',
      [missionId, userDid]
    );
    if (result.rows.length === 0) return null;
    return this.rowToParticipant(result.rows[0]);
  }

  /**
   * Convert database row to MissionParticipant object
   */
  private rowToParticipant(row: {
    id: string;
    mission_id: string;
    user_did: string;
    role: string;
    joined_at: Date;
    invited_by: string;
  }): MissionParticipant {
    return {
      id: row.id,
      missionId: row.mission_id,
      userDid: row.user_did,
      role: row.role as ParticipantRole,
      joinedAt: new Date(row.joined_at),
      invitedBy: row.invited_by,
    };
  }
}

// Singleton instance
export const participantStore = new ParticipantStore();
