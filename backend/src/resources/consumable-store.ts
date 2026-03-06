/**
 * Consumable Store
 *
 * Phase 4.4 Plan 01: Consumable inventory tracking with low stock alerts
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { Consumable, ConsumableCategory } from './types.js';

export async function initConsumableTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consumables (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity DOUBLE PRECISION NOT NULL,
      unit TEXT NOT NULL,
      minimum_level DOUBLE PRECISION NOT NULL,
      current_level DOUBLE PRECISION NOT NULL,
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_consumable_mission ON consumables(mission_id);
    CREATE INDEX IF NOT EXISTS idx_consumable_category ON consumables(category);
    CREATE INDEX IF NOT EXISTS idx_consumable_low_stock ON consumables(mission_id, current_level, minimum_level);
  `);
}

export class ConsumableStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initConsumableTable();
      this.initialized = true;
    }
  }

  /**
   * Create consumable inventory item
   */
  async createConsumable(
    missionId: string,
    category: ConsumableCategory,
    name: string,
    quantity: number,
    unit: string,
    minimumLevel: number,
    currentLevel: number,
    location?: { lat: number; lng: number }
  ): Promise<Consumable> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `CON-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO consumables (
        id, mission_id, category, name, quantity, unit,
        minimum_level, current_level, location_lat, location_lng, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        id,
        missionId,
        category,
        name,
        quantity,
        unit,
        minimumLevel,
        currentLevel,
        location?.lat || null,
        location?.lng || null,
        now,
      ]
    );

    return {
      id,
      missionId,
      category,
      name,
      quantity,
      unit,
      minimumLevel,
      currentLevel,
      location,
      createdAt: now,
    };
  }

  /**
   * Get consumable by ID
   */
  async getConsumable(id: string): Promise<Consumable | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM consumables WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToConsumable(result.rows[0]);
  }

  /**
   * List consumables with optional filtering
   */
  async listConsumables(filters: {
    missionId?: string;
    category?: ConsumableCategory;
  } = {}): Promise<Consumable[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.missionId) {
      conditions.push(`mission_id = $${idx++}`);
      params.push(filters.missionId);
    }
    if (filters.category) {
      conditions.push(`category = $${idx}`);
      params.push(filters.category);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM consumables ${where} ORDER BY name ASC`,
      params
    );

    return result.rows.map((row) => this.rowToConsumable(row));
  }

  /**
   * Update consumable level
   */
  async updateLevel(id: string, newLevel: number): Promise<Consumable | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'UPDATE consumables SET current_level = $1 WHERE id = $2 RETURNING *',
      [newLevel, id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToConsumable(result.rows[0]);
  }

  /**
   * Get low stock items for a mission
   *
   * Returns consumables where current_level < minimum_level
   */
  async getLowStock(missionId: string): Promise<Consumable[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM consumables
       WHERE mission_id = $1
       AND current_level < minimum_level
       ORDER BY (current_level / NULLIF(minimum_level, 0)) ASC`,
      [missionId]
    );

    return result.rows.map((row) => this.rowToConsumable(row));
  }

  /**
   * Delete consumable
   */
  async deleteConsumable(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM consumables WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Convert database row to Consumable object
   */
  private rowToConsumable(row: {
    id: string;
    mission_id: string;
    category: string;
    name: string;
    quantity: number;
    unit: string;
    minimum_level: number;
    current_level: number;
    location_lat?: number;
    location_lng?: number;
    created_at: Date;
  }): Consumable {
    return {
      id: row.id,
      missionId: row.mission_id,
      category: row.category as ConsumableCategory,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      minimumLevel: row.minimum_level,
      currentLevel: row.current_level,
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
export const consumableStore = new ConsumableStore();
