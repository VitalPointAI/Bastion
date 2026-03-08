/**
 * CCIR Request Store
 *
 * Phase 35 Plan 01: PostgreSQL CRUD for ccir_requests table.
 * Handles Commander's Critical Information Requirements and
 * Priority Intelligence Requirements requests between problem sets.
 * Singleton pattern with lazy table initialization.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { CcirRequest } from './mission-creation-types.js';

// ─── Table Initialization ────────────────────────────────────────────────────

async function initCcirTable(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ccir_requests (
      id TEXT PRIMARY KEY,
      requesting_ps_id TEXT NOT NULL REFERENCES problem_sets(id),
      target_ps_id TEXT NOT NULL REFERENCES problem_sets(id),
      request_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      resolved_by TEXT,
      resolved_at TIMESTAMPTZ,
      response_data JSONB,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_ccir_requests_requester
      ON ccir_requests(requesting_ps_id);
    CREATE INDEX IF NOT EXISTS idx_ccir_requests_target
      ON ccir_requests(target_ps_id);
  `);
}

// ─── Row Mapping ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): CcirRequest {
  return {
    id: row.id,
    requestingPsId: row.requesting_ps_id,
    targetPsId: row.target_ps_id,
    requestType: row.request_type,
    description: row.description,
    status: row.status,
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    responseData: row.response_data ?? null,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// ─── CCIR Request Store ──────────────────────────────────────────────────────

class CcirRequestStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initCcirTable();
    this.initialized = true;
  }

  /**
   * Create a new CCIR/PIR request from one problem set to another.
   */
  async createRequest(input: {
    requestingPsId: string;
    targetPsId: string;
    requestType: 'ccir' | 'pir';
    description: string;
    createdBy: string;
  }): Promise<CcirRequest> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `CCIR-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO ccir_requests (
        id, requesting_ps_id, target_ps_id, request_type,
        description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        id,
        input.requestingPsId,
        input.targetPsId,
        input.requestType,
        input.description,
        input.createdBy,
      ]
    );

    return mapRow(result.rows[0]);
  }

  /**
   * Get all CCIR requests made by a given problem set.
   */
  async getRequestsByRequester(requestingPsId: string): Promise<CcirRequest[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM ccir_requests WHERE requesting_ps_id = $1 ORDER BY created_at DESC',
      [requestingPsId]
    );

    return result.rows.map(mapRow);
  }

  /**
   * Get all incoming CCIR requests targeting a given problem set (for parent J2 review).
   */
  async getRequestsByTarget(targetPsId: string): Promise<CcirRequest[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM ccir_requests WHERE target_ps_id = $1 ORDER BY created_at DESC',
      [targetPsId]
    );

    return result.rows.map(mapRow);
  }

  /**
   * Resolve a CCIR request (approve or deny).
   */
  async resolveRequest(
    id: string,
    status: 'approved' | 'denied',
    resolvedBy: string,
    responseData?: Record<string, unknown>
  ): Promise<CcirRequest> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `UPDATE ccir_requests
       SET status = $2, resolved_by = $3, resolved_at = NOW(), response_data = $4
       WHERE id = $1
       RETURNING *`,
      [
        id,
        status,
        resolvedBy,
        responseData ? JSON.stringify(responseData) : null,
      ]
    );

    return mapRow(result.rows[0]);
  }
}

export const ccirRequestStore = new CcirRequestStore();
export { CcirRequestStore };
