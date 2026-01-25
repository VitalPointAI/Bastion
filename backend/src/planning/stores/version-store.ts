/**
 * Plan Version Store
 *
 * Phase 05 Plan 01: Version history tracking with Yjs snapshots
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type { PlanVersion, CreateVersionInput } from '../types.js';

/**
 * Initialize plan_versions table
 */
async function initVersionTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_versions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      yjs_update BYTEA NOT NULL,
      snapshot JSONB NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      change_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_versions_plan ON plan_versions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_versions_plan_version ON plan_versions(plan_id, version DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_plan_version_unique ON plan_versions(plan_id, version);
  `);
}

/**
 * Helper to convert database row to PlanVersion
 */
function rowToVersion(row: any): PlanVersion {
  return {
    id: row.id,
    planId: row.plan_id,
    version: row.version,
    yjsUpdate: row.yjs_update,
    snapshot: row.snapshot,
    changedBy: row.changed_by,
    changedAt: new Date(row.changed_at),
    changeReason: row.change_reason
  };
}

/**
 * Version Store singleton
 */
class VersionStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initVersionTable();
    this.initialized = true;
  }

  /**
   * Create a new version
   */
  async create(input: CreateVersionInput): Promise<PlanVersion> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `VER-${randomUUID()}`;
    const now = new Date();

    // Get current version count to determine next version number
    const versionCount = await this.getVersionCount(input.planId);
    const version = versionCount + 1;

    await pool.query(
      `
      INSERT INTO plan_versions (
        id, plan_id, version, yjs_update, snapshot,
        changed_by, changed_at, change_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        id,
        input.planId,
        version,
        input.yjsUpdate,
        JSON.stringify(input.snapshot),
        input.changedBy,
        now,
        input.changeReason ?? null
      ]
    );

    const result = await pool.query('SELECT * FROM plan_versions WHERE id = $1', [id]);
    return rowToVersion(result.rows[0]);
  }

  /**
   * Find all versions for a plan (ordered by version DESC)
   */
  async findByPlan(planId: string): Promise<PlanVersion[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM plan_versions WHERE plan_id = $1 ORDER BY version DESC',
      [planId]
    );
    return result.rows.map(rowToVersion);
  }

  /**
   * Find latest version for a plan
   */
  async findLatest(planId: string): Promise<PlanVersion | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM plan_versions WHERE plan_id = $1 ORDER BY version DESC LIMIT 1',
      [planId]
    );
    return result.rows[0] ? rowToVersion(result.rows[0]) : null;
  }

  /**
   * Find specific version by version number
   */
  async findByVersion(planId: string, version: number): Promise<PlanVersion | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM plan_versions WHERE plan_id = $1 AND version = $2',
      [planId, version]
    );
    return result.rows[0] ? rowToVersion(result.rows[0]) : null;
  }

  /**
   * Get version count for a plan
   */
  async getVersionCount(planId: string): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM plan_versions WHERE plan_id = $1',
      [planId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export const versionStore = new VersionStore();
