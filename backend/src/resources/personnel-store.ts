/**
 * Personnel Store
 *
 * Phase 4.4 Plan 01: Personnel tracking and assignment
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { Personnel } from './types.js';

export async function initPersonnelTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS personnel (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      rank TEXT NOT NULL,
      specialty TEXT NOT NULL,
      readiness_status TEXT NOT NULL,
      clearance_level TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_personnel_mission ON personnel(mission_id);
    CREATE INDEX IF NOT EXISTS idx_personnel_unit ON personnel(unit_id);
    CREATE INDEX IF NOT EXISTS idx_personnel_clearance ON personnel(clearance_level);
  `);
}

export class PersonnelStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initPersonnelTable();
      this.initialized = true;
    }
  }

  /**
   * Create personnel record
   */
  async createPersonnel(
    missionId: string,
    name: string,
    rank: string,
    specialty: string,
    readinessStatus: 'ready' | 'limited' | 'unavailable',
    clearanceLevel: 'UNCLASS' | 'SECRET' | 'TOPSECRET',
    unitId?: string
  ): Promise<Personnel> {
    await this.ensureInitialized();
    const pool = getPool();

    // Duplicate check: same name + rank + mission must not already exist
    const dupCheck = await pool.query(
      `SELECT id FROM personnel WHERE name = $1 AND rank = $2 AND mission_id = $3 LIMIT 1`,
      [name, rank, missionId]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error(`Duplicate personnel: "${rank} ${name}" already exists in this mission`);
    }

    const id = `PER-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO personnel (
        id, mission_id, unit_id, name, rank, specialty,
        readiness_status, clearance_level, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        id,
        missionId,
        unitId || null,
        name,
        rank,
        specialty,
        readinessStatus,
        clearanceLevel,
        now,
      ]
    );

    return {
      id,
      missionId,
      unitId,
      name,
      rank,
      specialty,
      readinessStatus,
      clearanceLevel,
      createdAt: now,
    };
  }

  /**
   * Get personnel by ID
   */
  async getPersonnel(id: string): Promise<Personnel | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM personnel WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToPersonnel(result.rows[0]);
  }

  /**
   * List personnel by unit
   */
  async listByUnit(unitId: string): Promise<Personnel[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM personnel WHERE unit_id = $1 ORDER BY rank ASC, name ASC',
      [unitId]
    );

    return result.rows.map((row) => this.rowToPersonnel(row));
  }

  /**
   * List personnel by mission
   */
  async listByMission(missionId: string): Promise<Personnel[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM personnel WHERE mission_id = $1 ORDER BY rank ASC, name ASC',
      [missionId]
    );

    return result.rows.map((row) => this.rowToPersonnel(row));
  }

  /**
   * Update personnel unit assignment
   */
  async assignToUnit(id: string, unitId: string | null): Promise<Personnel | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'UPDATE personnel SET unit_id = $1 WHERE id = $2 RETURNING *',
      [unitId, id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToPersonnel(result.rows[0]);
  }

  /**
   * Update personnel readiness status
   */
  async updateReadiness(
    id: string,
    readinessStatus: 'ready' | 'limited' | 'unavailable'
  ): Promise<Personnel | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'UPDATE personnel SET readiness_status = $1 WHERE id = $2 RETURNING *',
      [readinessStatus, id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToPersonnel(result.rows[0]);
  }

  /**
   * Delete personnel record
   */
  async deletePersonnel(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM personnel WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Convert database row to Personnel object
   */
  private rowToPersonnel(row: {
    id: string;
    mission_id: string;
    unit_id?: string;
    name: string;
    rank: string;
    specialty: string;
    readiness_status: string;
    clearance_level: string;
    created_at: Date;
  }): Personnel {
    return {
      id: row.id,
      missionId: row.mission_id,
      unitId: row.unit_id,
      name: row.name,
      rank: row.rank,
      specialty: row.specialty,
      readinessStatus: row.readiness_status as 'ready' | 'limited' | 'unavailable',
      clearanceLevel: row.clearance_level as 'UNCLASS' | 'SECRET' | 'TOPSECRET',
      createdAt: new Date(row.created_at),
    };
  }
}

// Singleton instance
export const personnelStore = new PersonnelStore();
