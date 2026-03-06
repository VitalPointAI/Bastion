/**
 * Resource Store
 *
 * Phase 4.4 Plan 01: Resource catalog CRUD operations
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { Resource, ResourceCategory, ResourceStatus } from './types.js';

export async function initResourceTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      serial_number TEXT,
      sidc TEXT,
      status TEXT NOT NULL,
      specifications JSONB NOT NULL DEFAULT '{}',
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_resource_mission ON resources(mission_id);
    CREATE INDEX IF NOT EXISTS idx_resource_category ON resources(category);
    CREATE INDEX IF NOT EXISTS idx_resource_status ON resources(status);
  `);
}

export class ResourceStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initResourceTable();
      this.initialized = true;
    }
  }

  /**
   * Create a new resource
   */
  async createResource(
    missionId: string,
    name: string,
    category: ResourceCategory,
    status: ResourceStatus,
    specifications: Record<string, unknown>,
    serialNumber?: string,
    sidc?: string,
    location?: { lat: number; lng: number }
  ): Promise<Resource> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `RES-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO resources (
        id, mission_id, name, category, serial_number, sidc,
        status, specifications, location_lat, location_lng, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        id,
        missionId,
        name,
        category,
        serialNumber || null,
        sidc || null,
        status,
        JSON.stringify(specifications),
        location?.lat || null,
        location?.lng || null,
        now,
      ]
    );

    return {
      id,
      missionId,
      name,
      category,
      serialNumber,
      sidc,
      status,
      specifications,
      location,
      createdAt: now,
    };
  }

  /**
   * Get resource by ID
   */
  async getResource(id: string): Promise<Resource | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM resources WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToResource(result.rows[0]);
  }

  /**
   * List resources with optional filtering
   */
  async listResources(filters: {
    missionId?: string;
    category?: ResourceCategory;
    status?: ResourceStatus;
  } = {}): Promise<Resource[]> {
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
      conditions.push(`status = $${idx}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM resources ${where} ORDER BY name ASC`,
      params
    );

    return result.rows.map((row) => this.rowToResource(row));
  }

  /**
   * Update resource status
   */
  async updateStatus(id: string, newStatus: ResourceStatus): Promise<Resource | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'UPDATE resources SET status = $1 WHERE id = $2 RETURNING *',
      [newStatus, id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToResource(result.rows[0]);
  }

  /**
   * Delete resource
   */
  async deleteResource(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM resources WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Convert database row to Resource object
   */
  private rowToResource(row: {
    id: string;
    mission_id: string;
    name: string;
    category: string;
    serial_number?: string;
    sidc?: string;
    status: string;
    specifications: unknown;
    location_lat?: number;
    location_lng?: number;
    created_at: Date;
  }): Resource {
    return {
      id: row.id,
      missionId: row.mission_id,
      name: row.name,
      category: row.category as ResourceCategory,
      serialNumber: row.serial_number,
      sidc: row.sidc,
      status: row.status as ResourceStatus,
      specifications:
        typeof row.specifications === 'string'
          ? JSON.parse(row.specifications)
          : row.specifications,
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
export const resourceStore = new ResourceStore();
