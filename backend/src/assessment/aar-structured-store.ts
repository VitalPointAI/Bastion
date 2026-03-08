/**
 * Structured AAR (After-Action Review) Store
 *
 * Phase 37 Plan 01: Doctrinal FM 7-0 AAR CRUD with lifecycle management.
 * Completely separate from the existing aar-store.ts (Phase 22 event log).
 *
 * Tables: structured_aars, aar_observations
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  StructuredAAR,
  CreateAARInput,
  UpdateAARInput,
  AARObservation,
  CreateObservationInput,
} from './types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initAARTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS structured_aars (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL,
      training_event_name TEXT NOT NULL,
      initiated_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      what_was_planned TEXT NOT NULL DEFAULT '',
      what_happened TEXT NOT NULL DEFAULT '',
      why TEXT NOT NULL DEFAULT '',
      finalized_at TIMESTAMPTZ,
      finalized_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS aar_observations (
      id TEXT PRIMARY KEY,
      aar_id TEXT NOT NULL REFERENCES structured_aars(id),
      observation_type TEXT NOT NULL,
      content TEXT NOT NULL,
      metl_task_id TEXT,
      suggested_by_ai BOOLEAN NOT NULL DEFAULT false,
      ai_accepted BOOLEAN,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_aar_problem_set ON structured_aars(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_aar_status ON structured_aars(status);
    CREATE INDEX IF NOT EXISTS idx_aar_obs_aar ON aar_observations(aar_id);
  `);
}

// ============================================================================
// Row Mapping
// ============================================================================

function mapAARRow(row: Record<string, unknown>): StructuredAAR {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    trainingEventName: row.training_event_name as string,
    initiatedBy: row.initiated_by as string,
    status: row.status as StructuredAAR['status'],
    whatWasPlanned: row.what_was_planned as string,
    whatHappened: row.what_happened as string,
    why: row.why as string,
    finalizedAt: row.finalized_at ? new Date(row.finalized_at as string) : undefined,
    finalizedBy: row.finalized_by as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapObservationRow(row: Record<string, unknown>): AARObservation {
  return {
    id: row.id as string,
    aarId: row.aar_id as string,
    observationType: row.observation_type as AARObservation['observationType'],
    content: row.content as string,
    metlTaskId: row.metl_task_id as string | undefined,
    suggestedByAi: row.suggested_by_ai as boolean,
    aiAccepted: row.ai_accepted as boolean | undefined,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
  };
}

// ============================================================================
// Structured AAR Store
// ============================================================================

class StructuredAARStore {
  private initialized = false;

  async init(): Promise<void> {
    if (!this.initialized) {
      await initAARTables();
      this.initialized = true;
    }
  }

  /** Create a new structured AAR in draft status */
  async create(input: CreateAARInput): Promise<StructuredAAR> {
    await this.init();
    const pool = getPool();
    const id = `AAR-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO structured_aars (id, problem_set_id, training_event_name, initiated_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, input.problemSetId, input.trainingEventName, input.initiatedBy],
    );

    return mapAARRow(result.rows[0]);
  }

  /** Get a structured AAR by ID */
  async getById(id: string): Promise<StructuredAAR | null> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM structured_aars WHERE id = $1',
      [id],
    );

    return result.rows.length > 0 ? mapAARRow(result.rows[0]) : null;
  }

  /** List AARs for a problem set, ordered by most recent first */
  async listByProblemSet(problemSetId: string): Promise<StructuredAAR[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM structured_aars WHERE problem_set_id = $1 ORDER BY created_at DESC',
      [problemSetId],
    );

    return result.rows.map(mapAARRow);
  }

  /** Update an AAR (only if not finalized) */
  async update(id: string, input: UpdateAARInput): Promise<StructuredAAR> {
    await this.init();
    const pool = getPool();

    // Build dynamic SET clause from provided fields
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.whatWasPlanned !== undefined) {
      setClauses.push(`what_was_planned = $${paramIndex++}`);
      params.push(input.whatWasPlanned);
    }
    if (input.whatHappened !== undefined) {
      setClauses.push(`what_happened = $${paramIndex++}`);
      params.push(input.whatHappened);
    }
    if (input.why !== undefined) {
      setClauses.push(`why = $${paramIndex++}`);
      params.push(input.why);
    }
    if (input.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE structured_aars
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND status != 'finalized'
       RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      throw new Error(`AAR ${id} not found or is finalized`);
    }

    return mapAARRow(result.rows[0]);
  }

  /** Finalize an AAR (locks it from further edits) */
  async finalize(id: string, finalizedBy: string): Promise<StructuredAAR> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      `UPDATE structured_aars
       SET status = 'finalized', finalized_at = NOW(), finalized_by = $1, updated_at = NOW()
       WHERE id = $2 AND status != 'finalized'
       RETURNING *`,
      [finalizedBy, id],
    );

    if (result.rows.length === 0) {
      throw new Error(`AAR ${id} not found or already finalized`);
    }

    return mapAARRow(result.rows[0]);
  }

  /** Add an observation to an AAR */
  async addObservation(input: CreateObservationInput): Promise<AARObservation> {
    await this.init();
    const pool = getPool();
    const id = `AARO-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO aar_observations (id, aar_id, observation_type, content, metl_task_id, suggested_by_ai, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        input.aarId,
        input.observationType,
        input.content,
        input.metlTaskId ?? null,
        input.suggestedByAi ?? false,
        input.createdBy,
      ],
    );

    return mapObservationRow(result.rows[0]);
  }

  /** List observations for an AAR */
  async listObservations(aarId: string): Promise<AARObservation[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM aar_observations WHERE aar_id = $1 ORDER BY created_at ASC',
      [aarId],
    );

    return result.rows.map(mapObservationRow);
  }

  /** Update an observation (accept/reject AI suggestion, edit content) */
  async updateObservation(
    id: string,
    updates: { aiAccepted?: boolean; content?: string },
  ): Promise<AARObservation> {
    await this.init();
    const pool = getPool();

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.aiAccepted !== undefined) {
      setClauses.push(`ai_accepted = $${paramIndex++}`);
      params.push(updates.aiAccepted);
    }
    if (updates.content !== undefined) {
      setClauses.push(`content = $${paramIndex++}`);
      params.push(updates.content);
    }

    if (setClauses.length === 0) {
      throw new Error('No updates provided');
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE aar_observations SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      throw new Error(`Observation ${id} not found`);
    }

    return mapObservationRow(result.rows[0]);
  }
}

// Singleton export
export const aarStructuredStore = new StructuredAARStore();
