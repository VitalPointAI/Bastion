/**
 * Sensor Store
 *
 * Phase 4.4 Plan 01: Sensor registration and tracking
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { Sensor, SensorCategory, SensorStatus, SensorCapabilities } from './types.js';

export async function initSensorTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sensors (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      sidc TEXT,
      capabilities JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION,
      data_feed_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sensor_mission ON sensors(mission_id);
    CREATE INDEX IF NOT EXISTS idx_sensor_category ON sensors(category);
    CREATE INDEX IF NOT EXISTS idx_sensor_status ON sensors(status);
  `);
}

export class SensorStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initSensorTable();
      this.initialized = true;
    }
  }

  /**
   * Create a new sensor
   */
  async createSensor(
    missionId: string,
    name: string,
    category: SensorCategory,
    capabilities: SensorCapabilities,
    status: SensorStatus,
    sidc?: string,
    location?: { lat: number; lng: number },
    dataFeedUrl?: string
  ): Promise<Sensor> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `SEN-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO sensors (
        id, mission_id, name, category, sidc, capabilities,
        status, location_lat, location_lng, data_feed_url, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        id,
        missionId,
        name,
        category,
        sidc || null,
        JSON.stringify(capabilities),
        status,
        location?.lat || null,
        location?.lng || null,
        dataFeedUrl || null,
        now,
      ]
    );

    return {
      id,
      missionId,
      name,
      category,
      sidc,
      capabilities,
      status,
      location,
      dataFeedUrl,
      createdAt: now,
    };
  }

  /**
   * Get sensor by ID
   */
  async getSensor(id: string): Promise<Sensor | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM sensors WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToSensor(result.rows[0]);
  }

  /**
   * List sensors with optional filtering
   */
  async listSensors(filters: {
    missionId?: string;
    category?: SensorCategory;
    status?: SensorStatus;
  } = {}): Promise<Sensor[]> {
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
      conditions.push(`category = $${idx++}`);
      params.push(filters.category);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM sensors ${where} ORDER BY name ASC`,
      params
    );

    return result.rows.map((row) => this.rowToSensor(row));
  }

  /**
   * Update sensor status
   */
  async updateStatus(id: string, newStatus: SensorStatus): Promise<Sensor | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'UPDATE sensors SET status = $1 WHERE id = $2 RETURNING *',
      [newStatus, id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToSensor(result.rows[0]);
  }

  /**
   * Get sensors by location (bounding box query for map view)
   *
   * Note: API endpoints will be created in Plan 4.4-08
   */
  async getSensorsByLocation(
    missionId: string,
    bbox: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    }
  ): Promise<Sensor[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM sensors
       WHERE mission_id = $1
       AND location_lat IS NOT NULL
       AND location_lng IS NOT NULL
       AND location_lat BETWEEN $2 AND $3
       AND location_lng BETWEEN $4 AND $5
       ORDER BY name ASC`,
      [missionId, bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng]
    );

    return result.rows.map((row) => this.rowToSensor(row));
  }

  /**
   * Delete sensor
   */
  async deleteSensor(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM sensors WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Convert database row to Sensor object
   */
  private rowToSensor(row: {
    id: string;
    mission_id: string;
    name: string;
    category: string;
    sidc?: string;
    capabilities: unknown;
    status: string;
    location_lat?: number;
    location_lng?: number;
    data_feed_url?: string;
    created_at: Date;
  }): Sensor {
    return {
      id: row.id,
      missionId: row.mission_id,
      name: row.name,
      category: row.category as SensorCategory,
      sidc: row.sidc,
      capabilities:
        typeof row.capabilities === 'string'
          ? JSON.parse(row.capabilities)
          : row.capabilities,
      status: row.status as SensorStatus,
      location:
        row.location_lat !== null && row.location_lat !== undefined &&
        row.location_lng !== null && row.location_lng !== undefined
          ? { lat: row.location_lat, lng: row.location_lng }
          : undefined,
      dataFeedUrl: row.data_feed_url,
      createdAt: new Date(row.created_at),
    };
  }
}

// Singleton instance
export const sensorStore = new SensorStore();
