/**
 * Unit Store
 *
 * Phase 4.4 Plan 01: Military unit CRUD operations
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { Unit } from './types.js';

export async function initUnitTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sidc TEXT NOT NULL,
      parent_did TEXT,
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_unit_mission ON units(mission_id);
    CREATE INDEX IF NOT EXISTS idx_unit_parent_did ON units(parent_did);
  `);
}

export class UnitStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initUnitTable();
      this.initialized = true;
    }
  }

  /**
   * Create a new unit
   */
  async createUnit(
    missionId: string,
    name: string,
    sidc: string,
    parentDid?: string,
    location?: { lat: number; lng: number }
  ): Promise<Unit> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `UNIT-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO units (
        id, mission_id, name, sidc, parent_did,
        location_lat, location_lng, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        id,
        missionId,
        name,
        sidc,
        parentDid || null,
        location?.lat || null,
        location?.lng || null,
        now,
      ]
    );

    return {
      id,
      missionId,
      name,
      sidc,
      parentDid,
      location,
      createdAt: now,
    };
  }

  /**
   * Get unit by ID
   */
  async getUnit(id: string): Promise<Unit | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM units WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToUnit(result.rows[0]);
  }

  /**
   * List units for a mission
   */
  async listUnits(missionId: string): Promise<Unit[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM units WHERE mission_id = $1 ORDER BY name ASC',
      [missionId]
    );

    return result.rows.map((row) => this.rowToUnit(row));
  }

  /**
   * Update unit
   */
  async updateUnit(
    id: string,
    updates: {
      name?: string;
      sidc?: string;
      location?: { lat: number; lng: number };
    }
  ): Promise<Unit | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.sidc !== undefined) {
      fields.push(`sidc = $${idx++}`);
      params.push(updates.sidc);
    }
    if (updates.location !== undefined) {
      fields.push(`location_lat = $${idx++}`);
      params.push(updates.location.lat);
      fields.push(`location_lng = $${idx++}`);
      params.push(updates.location.lng);
    }

    if (fields.length === 0) {
      return this.getUnit(id);
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE units SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) return null;
    return this.rowToUnit(result.rows[0]);
  }

  /**
   * Delete unit
   */
  async deleteUnit(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM units WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Convert database row to Unit object
   */
  private rowToUnit(row: {
    id: string;
    mission_id: string;
    name: string;
    sidc: string;
    parent_did?: string;
    location_lat?: number;
    location_lng?: number;
    created_at: Date;
  }): Unit {
    return {
      id: row.id,
      missionId: row.mission_id,
      name: row.name,
      sidc: row.sidc,
      parentDid: row.parent_did,
      location:
        row.location_lat !== null && row.location_lat !== undefined &&
        row.location_lng !== null && row.location_lng !== undefined
          ? { lat: row.location_lat, lng: row.location_lng }
          : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}

// Singleton instance
export const unitStore = new UnitStore();
