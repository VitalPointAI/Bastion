/**
 * Resource Store
 *
 * Phase 4.4 Plan 01: Resource catalog CRUD operations
 * Phase 27 Plan 01: Extended with DID, capabilities, grouping, and spatial queries
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

  // Phase 27: Add new columns idempotently
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'did') THEN
        ALTER TABLE resources ADD COLUMN did TEXT UNIQUE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'blinded_key') THEN
        ALTER TABLE resources ADD COLUMN blinded_key TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'public_key') THEN
        ALTER TABLE resources ADD COLUMN public_key TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'is_autonomous') THEN
        ALTER TABLE resources ADD COLUMN is_autonomous BOOLEAN NOT NULL DEFAULT false;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'capabilities') THEN
        ALTER TABLE resources ADD COLUMN capabilities TEXT[] NOT NULL DEFAULT '{}';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'group_id') THEN
        ALTER TABLE resources ADD COLUMN group_id TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'updated_at') THEN
        ALTER TABLE resources ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_resource_did ON resources(did);
    CREATE INDEX IF NOT EXISTS idx_resource_capabilities ON resources USING GIN(capabilities);
    CREATE INDEX IF NOT EXISTS idx_resource_group ON resources(group_id);
  `);

  // Phase 27: Migrate old category values to canonical 6-value set
  await pool.query(`
    UPDATE resources SET category = CASE category
      WHEN 'weapon_system' THEN 'weapons'
      WHEN 'vehicle' THEN 'vehicles'
      WHEN 'equipment' THEN 'other'
      WHEN 'communication' THEN 'communications'
      ELSE category
    END
    WHERE category IN ('weapon_system', 'vehicle', 'equipment', 'communication');
  `);

  // Phase 27: Create resource_groups table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resource_groups (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      group_type TEXT NOT NULL,
      parent_group_id TEXT REFERENCES resource_groups(id),
      aggregate_capabilities TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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
    location?: { lat: number; lng: number },
    did?: string,
    blindedKey?: string,
    publicKey?: string,
    isAutonomous: boolean = false,
    capabilities: string[] = []
  ): Promise<Resource> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `RES-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO resources (
        id, mission_id, name, category, serial_number, sidc,
        status, specifications, location_lat, location_lng,
        did, blinded_key, public_key, is_autonomous, capabilities,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        did || null,
        blindedKey || null,
        publicKey || null,
        isAutonomous,
        capabilities,
        now,
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
      did,
      blindedKey,
      publicKey,
      isAutonomous,
      capabilities,
      createdAt: now,
      updatedAt: now,
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
      'UPDATE resources SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newStatus, id]
    );

    if (result.rows.length === 0) return null;
    return this.rowToResource(result.rows[0]);
  }

  /**
   * Full resource update — accepts partial fields
   */
  async updateResource(
    id: string,
    updates: {
      name?: string;
      serialNumber?: string;
      sidc?: string;
      status?: ResourceStatus;
      specifications?: Record<string, unknown>;
      location?: { lat: number; lng: number } | null;
      isAutonomous?: boolean;
      capabilities?: string[];
      groupId?: string | null;
    }
  ): Promise<Resource | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.serialNumber !== undefined) {
      setClauses.push(`serial_number = $${idx++}`);
      params.push(updates.serialNumber);
    }
    if (updates.sidc !== undefined) {
      setClauses.push(`sidc = $${idx++}`);
      params.push(updates.sidc);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      params.push(updates.status);
    }
    if (updates.specifications !== undefined) {
      setClauses.push(`specifications = $${idx++}`);
      params.push(JSON.stringify(updates.specifications));
    }
    if (updates.location !== undefined) {
      if (updates.location === null) {
        setClauses.push(`location_lat = NULL`);
        setClauses.push(`location_lng = NULL`);
      } else {
        setClauses.push(`location_lat = $${idx++}`);
        params.push(updates.location.lat);
        setClauses.push(`location_lng = $${idx++}`);
        params.push(updates.location.lng);
      }
    }
    if (updates.isAutonomous !== undefined) {
      setClauses.push(`is_autonomous = $${idx++}`);
      params.push(updates.isAutonomous);
    }
    if (updates.capabilities !== undefined) {
      setClauses.push(`capabilities = $${idx++}`);
      params.push(updates.capabilities);
    }
    if (updates.groupId !== undefined) {
      setClauses.push(`group_id = $${idx++}`);
      params.push(updates.groupId);
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE resources SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
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
   * Find a resource by its DID
   */
  async findByDID(did: string): Promise<Resource | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM resources WHERE did = $1', [did]);
    if (result.rows.length === 0) return null;
    return this.rowToResource(result.rows[0]);
  }

  /**
   * Find resources that have all specified capabilities (array contains)
   */
  async findByCapabilities(capabilities: string[]): Promise<Resource[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM resources WHERE capabilities @> $1 ORDER BY name ASC',
      [capabilities]
    );
    return result.rows.map((row) => this.rowToResource(row));
  }

  /**
   * Find resources within a geographic bounding box
   */
  async findInArea(
    missionId: string,
    bounds: { north: number; south: number; east: number; west: number }
  ): Promise<Resource[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM resources
       WHERE mission_id = $1
         AND location_lat IS NOT NULL
         AND location_lng IS NOT NULL
         AND location_lat BETWEEN $2 AND $3
         AND location_lng BETWEEN $4 AND $5
       ORDER BY name ASC`,
      [missionId, bounds.south, bounds.north, bounds.west, bounds.east]
    );
    return result.rows.map((row) => this.rowToResource(row));
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
    did?: string;
    blinded_key?: string;
    public_key?: string;
    is_autonomous?: boolean;
    capabilities?: string[];
    group_id?: string;
    created_at: Date;
    updated_at?: Date;
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
      did: row.did,
      blindedKey: row.blinded_key,
      publicKey: row.public_key,
      isAutonomous: row.is_autonomous ?? false,
      capabilities: row.capabilities ?? [],
      groupId: row.group_id,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(row.created_at),
    };
  }
}

// Singleton instance
export const resourceStore = new ResourceStore();
