/**
 * MOE (Measure of Effectiveness) Store
 *
 * Phase 37 Plan 01: MOE CRUD and status tracking for operational assessment.
 * MOEs are linked to operational objectives from the Design tab and track
 * effectiveness using status (green/yellow/red) and trend (improving/stable/declining).
 *
 * Tables: assessment_moes, assessment_observations (shared with MOP store)
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  AssessmentMOE,
  CreateMOEInput,
  AssessmentObservation,
  CreateAssessmentObservationInput,
} from './types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initMOETables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_moes (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL,
      objective_id TEXT,
      objective_snapshot TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'green',
      trend TEXT NOT NULL DEFAULT 'stable',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS assessment_observations (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      status_update TEXT,
      trend_update TEXT,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_moes_ps ON assessment_moes(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_aobs_target ON assessment_observations(target_type, target_id);
  `);
}

// ============================================================================
// Row Mapping
// ============================================================================

function mapMOERow(row: Record<string, unknown>): AssessmentMOE {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    objectiveId: row.objective_id as string | undefined,
    objectiveSnapshot: row.objective_snapshot as string,
    name: row.name as string,
    description: row.description as string | undefined,
    status: row.status as AssessmentMOE['status'],
    trend: row.trend as AssessmentMOE['trend'],
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapObservationRow(row: Record<string, unknown>): AssessmentObservation {
  return {
    id: row.id as string,
    targetType: row.target_type as AssessmentObservation['targetType'],
    targetId: row.target_id as string,
    content: row.content as string,
    source: row.source as AssessmentObservation['source'],
    statusUpdate: row.status_update as AssessmentObservation['statusUpdate'],
    trendUpdate: row.trend_update as AssessmentObservation['trendUpdate'],
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at as string) : undefined,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
  };
}

// ============================================================================
// MOE Store
// ============================================================================

class MOEStore {
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = initMOETables().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  /** Create a new MOE linked to an operational objective */
  async create(input: CreateMOEInput): Promise<AssessmentMOE> {
    await this.init();
    const pool = getPool();
    const id = `MOE-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO assessment_moes (id, problem_set_id, objective_id, objective_snapshot, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        input.problemSetId,
        input.objectiveId ?? null,
        input.objectiveSnapshot,
        input.name,
        input.description ?? null,
        input.createdBy,
      ],
    );

    return mapMOERow(result.rows[0]);
  }

  /** Get a MOE by ID */
  async getById(id: string): Promise<AssessmentMOE | null> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM assessment_moes WHERE id = $1',
      [id],
    );

    return result.rows.length > 0 ? mapMOERow(result.rows[0]) : null;
  }

  /** List all MOEs for a problem set */
  async listByProblemSet(problemSetId: string): Promise<AssessmentMOE[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM assessment_moes WHERE problem_set_id = $1 ORDER BY created_at ASC',
      [problemSetId],
    );

    return result.rows.map(mapMOERow);
  }

  /** Update MOE status and trend */
  async updateStatus(id: string, status: string, trend: string): Promise<AssessmentMOE> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      `UPDATE assessment_moes SET status = $1, trend = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [status, trend, id],
    );

    if (result.rows.length === 0) {
      throw new Error(`MOE ${id} not found`);
    }

    return mapMOERow(result.rows[0]);
  }

  /** Add an observation to a MOE */
  async addObservation(input: CreateAssessmentObservationInput): Promise<AssessmentObservation> {
    await this.init();
    const pool = getPool();
    const id = `AOBS-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO assessment_observations (id, target_type, target_id, content, source, status_update, trend_update, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        input.targetType,
        input.targetId,
        input.content,
        input.source ?? 'manual',
        input.statusUpdate ?? null,
        input.trendUpdate ?? null,
        input.createdBy,
      ],
    );

    return mapObservationRow(result.rows[0]);
  }

  /** List observations for a specific MOE */
  async listObservations(targetId: string): Promise<AssessmentObservation[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM assessment_observations WHERE target_type = 'moe' AND target_id = $1 ORDER BY created_at DESC`,
      [targetId],
    );

    return result.rows.map(mapObservationRow);
  }

  /**
   * Approve an observation and apply its status/trend updates to the parent MOE.
   * If the observation includes statusUpdate or trendUpdate, those are applied
   * to the MOE upon approval.
   */
  async approveObservation(id: string, approvedBy: string): Promise<AssessmentObservation> {
    await this.init();
    const pool = getPool();

    // Approve the observation
    const obsResult = await pool.query(
      `UPDATE assessment_observations
       SET approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedBy, id],
    );

    if (obsResult.rows.length === 0) {
      throw new Error(`Observation ${id} not found`);
    }

    const obs = mapObservationRow(obsResult.rows[0]);

    // Apply status/trend updates to the parent MOE if present
    if (obs.statusUpdate || obs.trendUpdate) {
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (obs.statusUpdate) {
        setClauses.push(`status = $${paramIndex++}`);
        params.push(obs.statusUpdate);
      }
      if (obs.trendUpdate) {
        setClauses.push(`trend = $${paramIndex++}`);
        params.push(obs.trendUpdate);
      }

      params.push(obs.targetId);

      await pool.query(
        `UPDATE assessment_moes SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        params,
      );
    }

    return obs;
  }
}

// Singleton export
export const moeStore = new MOEStore();
