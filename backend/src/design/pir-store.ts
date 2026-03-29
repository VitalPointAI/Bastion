/**
 * PIR Store
 *
 * PostgreSQL CRUD for priority_intelligence_requirements table.
 * Manages CCIR, PIR, FFIR, and EEFI records linked to operational
 * design elements (assumptions, LOEs, CoG nodes).
 *
 * Singleton pattern with lazy table initialization.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PIRType = 'CCIR' | 'PIR' | 'FFIR' | 'EEFI';
export type PIRStatus = 'ACTIVE' | 'ANSWERED' | 'SUPERSEDED' | 'CANCELLED';

export interface PIR {
  id: string;
  problemSetId: string;
  type: PIRType;
  description: string;
  priority: number;
  status: PIRStatus;
  sourceType: string | null;
  sourceId: string | null;
  linkedAssumptionIds: string[];
  linkedObjectiveIds: string[];
  answer: string | null;
  answeredAt: string | null;
  answeredBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePIRInput {
  problemSetId: string;
  type: PIRType;
  description: string;
  priority?: number;
  sourceType?: string;
  sourceId?: string;
  linkedAssumptionIds?: string[];
  linkedObjectiveIds?: string[];
  createdBy: string;
}

export interface UpdatePIRInput {
  description?: string;
  type?: PIRType;
  priority?: number;
  status?: PIRStatus;
  answer?: string;
  answeredBy?: string;
  linkedAssumptionIds?: string[];
  linkedObjectiveIds?: string[];
}

export interface PIRListFilters {
  type?: PIRType;
  status?: PIRStatus;
}

// ---------------------------------------------------------------------------
// Table Initialization
// ---------------------------------------------------------------------------

async function initPIRTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS priority_intelligence_requirements (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      source_type TEXT,
      source_id TEXT,
      linked_assumption_ids TEXT[] DEFAULT '{}',
      linked_objective_ids TEXT[] DEFAULT '{}',
      answer TEXT,
      answered_at TIMESTAMPTZ,
      answered_by TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_pir_problem_set
      ON priority_intelligence_requirements(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_pir_status
      ON priority_intelligence_requirements(status);
    CREATE INDEX IF NOT EXISTS idx_pir_type
      ON priority_intelligence_requirements(type);
  `);
}

// ---------------------------------------------------------------------------
// Row Mapping
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): PIR {
  return {
    id: row.id,
    problemSetId: row.problem_set_id,
    type: row.type as PIRType,
    description: row.description,
    priority: row.priority,
    status: row.status as PIRStatus,
    sourceType: row.source_type ?? null,
    sourceId: row.source_id ?? null,
    linkedAssumptionIds: row.linked_assumption_ids ?? [],
    linkedObjectiveIds: row.linked_objective_ids ?? [],
    answer: row.answer ?? null,
    answeredAt: row.answered_at ? new Date(row.answered_at).toISOString() : null,
    answeredBy: row.answered_by ?? null,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// PIR Store
// ---------------------------------------------------------------------------

class PIRStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initPIRTable();
    this.initialized = true;
  }

  /**
   * Create a new PIR/CCIR/FFIR/EEFI.
   */
  async createPIR(input: CreatePIRInput): Promise<PIR> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `PIR-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO priority_intelligence_requirements (
        id, problem_set_id, type, description, priority,
        source_type, source_id, linked_assumption_ids, linked_objective_ids,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        input.problemSetId,
        input.type,
        input.description,
        input.priority ?? 1,
        input.sourceType ?? null,
        input.sourceId ?? null,
        input.linkedAssumptionIds ?? [],
        input.linkedObjectiveIds ?? [],
        input.createdBy,
      ]
    );

    return mapRow(result.rows[0]);
  }

  /**
   * List PIRs for a problem set with optional type/status filters.
   */
  async listPIRs(problemSetId: string, filters?: PIRListFilters): Promise<PIR[]> {
    await this.ensureInitialized();
    const pool = getPool();

    let query = 'SELECT * FROM priority_intelligence_requirements WHERE problem_set_id = $1';
    const params: unknown[] = [problemSetId];
    let paramIdx = 2;

    if (filters?.type) {
      query += ` AND type = $${paramIdx}`;
      params.push(filters.type);
      paramIdx++;
    }

    if (filters?.status) {
      query += ` AND status = $${paramIdx}`;
      params.push(filters.status);
      paramIdx++;
    }

    query += ' ORDER BY priority ASC, created_at ASC';

    const result = await pool.query(query, params);
    return result.rows.map(mapRow);
  }

  /**
   * Update a PIR record.
   */
  async updatePIR(id: string, updates: UpdatePIRInput): Promise<PIR | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIdx}`);
      params.push(updates.description);
      paramIdx++;
    }

    if (updates.type !== undefined) {
      setClauses.push(`type = $${paramIdx}`);
      params.push(updates.type);
      paramIdx++;
    }

    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramIdx}`);
      params.push(updates.priority);
      paramIdx++;
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIdx}`);
      params.push(updates.status);
      paramIdx++;

      // Auto-set answered_at when marking as ANSWERED
      if (updates.status === 'ANSWERED') {
        setClauses.push('answered_at = NOW()');
      }
    }

    if (updates.answer !== undefined) {
      setClauses.push(`answer = $${paramIdx}`);
      params.push(updates.answer);
      paramIdx++;
    }

    if (updates.answeredBy !== undefined) {
      setClauses.push(`answered_by = $${paramIdx}`);
      params.push(updates.answeredBy);
      paramIdx++;
    }

    if (updates.linkedAssumptionIds !== undefined) {
      setClauses.push(`linked_assumption_ids = $${paramIdx}`);
      params.push(updates.linkedAssumptionIds);
      paramIdx++;
    }

    if (updates.linkedObjectiveIds !== undefined) {
      setClauses.push(`linked_objective_ids = $${paramIdx}`);
      params.push(updates.linkedObjectiveIds);
      paramIdx++;
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE priority_intelligence_requirements
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0]);
  }

  /**
   * Delete a PIR record.
   */
  async deletePIR(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'DELETE FROM priority_intelligence_requirements WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Link an assumption to an existing PIR.
   */
  async linkAssumption(pirId: string, assumptionId: string): Promise<PIR | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `UPDATE priority_intelligence_requirements
       SET linked_assumption_ids = array_append(
         array_remove(linked_assumption_ids, $2), $2
       ),
       updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [pirId, assumptionId]
    );

    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0]);
  }

  /**
   * Get active PIRs ordered by priority for gap filler research targeting.
   */
  async getActivePIRsForGapResearch(problemSetId: string): Promise<PIR[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM priority_intelligence_requirements
       WHERE problem_set_id = $1 AND status = 'ACTIVE'
       ORDER BY priority ASC, created_at ASC`,
      [problemSetId]
    );

    return result.rows.map(mapRow);
  }

  /**
   * Get a single PIR by ID.
   */
  async getPIR(id: string): Promise<PIR | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM priority_intelligence_requirements WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0]);
  }
}

export const pirStore = new PIRStore();
