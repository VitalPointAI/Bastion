/**
 * Mission Creation Store
 *
 * Phase 35 Plan 01: PostgreSQL CRUD for mission_assignments table
 * and problem_sets.metadata JSONB column for mission-specific data.
 * Singleton pattern with lazy table initialization.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { MissionAssignment, MissionMetadata } from './mission-creation-types.js';

// ─── Table Initialization ────────────────────────────────────────────────────

async function initMissionTables(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mission_assignments (
      id TEXT PRIMARY KEY,
      source_opord_ps_id TEXT NOT NULL REFERENCES problem_sets(id),
      target_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) UNIQUE,
      task_ids TEXT[] NOT NULL,
      task_statement TEXT NOT NULL,
      purpose TEXT NOT NULL,
      commanders_intent JSONB,
      task_organization JSONB,
      constraints JSONB,
      ccirs JSONB,
      roe_references TEXT[],
      area_of_operations JSONB,
      timeline JSONB,
      warno_drafted BOOLEAN DEFAULT FALSE,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_mission_assignment_source
      ON mission_assignments(source_opord_ps_id);
    CREATE INDEX IF NOT EXISTS idx_mission_assignment_target
      ON mission_assignments(target_problem_set_id);
  `);

  // Add metadata JSONB column to problem_sets if not present
  await pool.query(`
    ALTER TABLE problem_sets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
  `);
}

// ─── Row Mapping ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): MissionAssignment {
  return {
    id: row.id,
    sourceOpordPsId: row.source_opord_ps_id,
    targetProblemSetId: row.target_problem_set_id,
    taskIds: row.task_ids,
    taskStatement: row.task_statement,
    purpose: row.purpose,
    commandersIntent: row.commanders_intent,
    taskOrganization: row.task_organization,
    constraints: row.constraints,
    ccirs: row.ccirs,
    roeReferences: row.roe_references ?? [],
    areaOfOperations: row.area_of_operations,
    timeline: row.timeline,
    warnoDrafted: row.warno_drafted ?? false,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// ─── Mission Creation Store ──────────────────────────────────────────────────

class MissionCreationStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initMissionTables();
    this.initialized = true;
  }

  /**
   * Create a new mission assignment linking an OPORD to a child problem set.
   */
  async createMissionAssignment(input: {
    sourceOpordPsId: string;
    targetProblemSetId: string;
    taskIds: string[];
    taskStatement: string;
    purpose: string;
    commandersIntent?: Record<string, unknown>;
    taskOrganization?: Record<string, unknown>;
    constraints?: Record<string, unknown>;
    ccirs?: Record<string, unknown>;
    roeReferences?: string[];
    areaOfOperations?: Record<string, unknown>;
    timeline?: Record<string, unknown>;
    createdBy: string;
  }): Promise<MissionAssignment> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `MA-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO mission_assignments (
        id, source_opord_ps_id, target_problem_set_id, task_ids,
        task_statement, purpose, commanders_intent, task_organization,
        constraints, ccirs, roe_references, area_of_operations, timeline,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id,
        input.sourceOpordPsId,
        input.targetProblemSetId,
        input.taskIds,
        input.taskStatement,
        input.purpose,
        input.commandersIntent ? JSON.stringify(input.commandersIntent) : null,
        input.taskOrganization ? JSON.stringify(input.taskOrganization) : null,
        input.constraints ? JSON.stringify(input.constraints) : null,
        input.ccirs ? JSON.stringify(input.ccirs) : null,
        input.roeReferences ?? [],
        input.areaOfOperations ? JSON.stringify(input.areaOfOperations) : null,
        input.timeline ? JSON.stringify(input.timeline) : null,
        input.createdBy,
      ]
    );

    return mapRow(result.rows[0]);
  }

  /**
   * Get all mission assignments originating from a given OPORD problem set.
   */
  async getAssignmentsBySource(sourceOpordPsId: string): Promise<MissionAssignment[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM mission_assignments WHERE source_opord_ps_id = $1 ORDER BY created_at DESC',
      [sourceOpordPsId]
    );

    return result.rows.map(mapRow);
  }

  /**
   * Get the mission assignment for a given target (child) problem set.
   */
  async getAssignmentByTarget(targetProblemSetId: string): Promise<MissionAssignment | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM mission_assignments WHERE target_problem_set_id = $1',
      [targetProblemSetId]
    );

    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  /**
   * Mark a mission assignment's WARNO as drafted.
   */
  async markWarnoAsDrafted(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      'UPDATE mission_assignments SET warno_drafted = TRUE WHERE id = $1',
      [id]
    );
  }

  /**
   * Set mission metadata on a problem set's metadata JSONB column.
   */
  async setMissionMetadata(problemSetId: string, metadata: MissionMetadata): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      'UPDATE problem_sets SET metadata = $2 WHERE id = $1',
      [problemSetId, JSON.stringify(metadata)]
    );
  }

  /**
   * Get mission metadata from a problem set's metadata JSONB column.
   */
  async getMissionMetadata(problemSetId: string): Promise<MissionMetadata | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT metadata FROM problem_sets WHERE id = $1',
      [problemSetId]
    );

    if (!result.rows[0]?.metadata) return null;

    const meta = result.rows[0].metadata;
    // Return null if metadata is empty default
    if (!meta.missionState) return null;

    return meta as MissionMetadata;
  }
}

export const missionCreationStore = new MissionCreationStore();
export { MissionCreationStore };
