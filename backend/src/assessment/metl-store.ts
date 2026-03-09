/**
 * METL (Mission-Essential Task List) Store
 *
 * Phase 37 Plan 01: METL task definitions and proficiency assessment CRUD.
 * Tasks are defined at strategic level and inherited downward. Proficiency
 * assessments use T/P/U ratings with per-task decay thresholds.
 *
 * Tables: metl_tasks, metl_assessments
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  METLTask,
  CreateMETLTaskInput,
  METLAssessment,
  CreateMETLAssessmentInput,
  METLProficiencySummary,
} from './types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initMETLTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS metl_tasks (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL,
      source_problem_set_id TEXT,
      task_name TEXT NOT NULL,
      task_description TEXT,
      competency_area TEXT,
      is_supplemental BOOLEAN NOT NULL DEFAULT false,
      promoted_to_strategic BOOLEAN NOT NULL DEFAULT false,
      decay_days INTEGER NOT NULL DEFAULT 90,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS metl_assessments (
      id TEXT PRIMARY KEY,
      metl_task_id TEXT NOT NULL REFERENCES metl_tasks(id),
      problem_set_id TEXT NOT NULL,
      aar_id TEXT,
      rating TEXT NOT NULL,
      assessed_by TEXT NOT NULL,
      ai_suggested_rating TEXT,
      commander_override BOOLEAN NOT NULL DEFAULT false,
      assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_metl_tasks_ps ON metl_tasks(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_metl_tasks_source ON metl_tasks(source_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_metl_assess_task ON metl_assessments(metl_task_id);
    CREATE INDEX IF NOT EXISTS idx_metl_assess_ps ON metl_assessments(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_metl_assess_date ON metl_assessments(assessed_at);
  `);
}

// ============================================================================
// Row Mapping
// ============================================================================

function mapTaskRow(row: Record<string, unknown>): METLTask {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    sourceProblemSetId: row.source_problem_set_id as string | undefined,
    taskName: row.task_name as string,
    taskDescription: row.task_description as string | undefined,
    competencyArea: row.competency_area as string | undefined,
    isSupplemental: row.is_supplemental as boolean,
    promotedToStrategic: row.promoted_to_strategic as boolean,
    decayDays: row.decay_days as number,
    createdAt: new Date(row.created_at as string),
  };
}

function mapAssessmentRow(row: Record<string, unknown>): METLAssessment {
  return {
    id: row.id as string,
    metlTaskId: row.metl_task_id as string,
    problemSetId: row.problem_set_id as string,
    aarId: row.aar_id as string | undefined,
    rating: row.rating as METLAssessment['rating'],
    assessedBy: row.assessed_by as string,
    aiSuggestedRating: row.ai_suggested_rating as string | undefined,
    commanderOverride: row.commander_override as boolean,
    assessedAt: new Date(row.assessed_at as string),
    notes: row.notes as string | undefined,
  };
}

// ============================================================================
// METL Store
// ============================================================================

class METLStore {
  private initialized = false;

  async init(): Promise<void> {
    if (!this.initialized) {
      await initMETLTables();
      this.initialized = true;
    }
  }

  /** Create a new METL task */
  async createTask(input: CreateMETLTaskInput): Promise<METLTask> {
    await this.init();
    const pool = getPool();
    const id = `METL-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO metl_tasks (id, problem_set_id, source_problem_set_id, task_name, task_description, competency_area, is_supplemental, decay_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        input.problemSetId,
        input.sourceProblemSetId ?? null,
        input.taskName,
        input.taskDescription ?? null,
        input.competencyArea ?? null,
        input.isSupplemental ?? false,
        input.decayDays ?? 90,
      ],
    );

    return mapTaskRow(result.rows[0]);
  }

  /** Get all METL tasks defined in a problem set */
  async getTasksByProblemSet(problemSetId: string): Promise<METLTask[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM metl_tasks WHERE problem_set_id = $1 ORDER BY created_at ASC',
      [problemSetId],
    );

    return result.rows.map(mapTaskRow);
  }

  /** Get tasks inherited from a strategic problem set */
  async getInheritedTasks(problemSetId: string, sourceProblemSetId: string): Promise<METLTask[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM metl_tasks
       WHERE problem_set_id = $1 AND source_problem_set_id = $2
       ORDER BY created_at ASC`,
      [problemSetId, sourceProblemSetId],
    );

    return result.rows.map(mapTaskRow);
  }

  /** Promote a supplemental task to strategic level */
  async promoteTask(taskId: string): Promise<METLTask> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      `UPDATE metl_tasks SET promoted_to_strategic = true WHERE id = $1 RETURNING *`,
      [taskId],
    );

    if (result.rows.length === 0) {
      throw new Error(`METL task ${taskId} not found`);
    }

    return mapTaskRow(result.rows[0]);
  }

  /** Create a proficiency assessment for a METL task */
  async createAssessment(input: CreateMETLAssessmentInput): Promise<METLAssessment> {
    await this.init();
    const pool = getPool();
    const id = `METLA-${randomUUID()}`;

    const result = await pool.query(
      `INSERT INTO metl_assessments (id, metl_task_id, problem_set_id, aar_id, rating, assessed_by, ai_suggested_rating, commander_override, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        input.metlTaskId,
        input.problemSetId,
        input.aarId ?? null,
        input.rating,
        input.assessedBy,
        input.aiSuggestedRating ?? null,
        input.commanderOverride ?? false,
        input.notes ?? null,
      ],
    );

    return mapAssessmentRow(result.rows[0]);
  }

  /** Get all assessments linked to a specific AAR */
  async getAssessmentsByAAR(aarId: string): Promise<METLAssessment[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM metl_assessments WHERE aar_id = $1 ORDER BY assessed_at DESC',
      [aarId],
    );

    return result.rows.map(mapAssessmentRow);
  }

  /**
   * Get the latest proficiency summary for all non-supplemental METL tasks
   * in a strategic problem set hierarchy. Uses DISTINCT ON to get the most
   * recent assessment per task with decay status calculation.
   */
  async getLatestProficiency(sourceProblemSetId: string): Promise<METLProficiencySummary[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      `SELECT DISTINCT ON (mt.id)
        mt.id AS metl_task_id,
        mt.task_name,
        mt.competency_area,
        mt.decay_days,
        ma.rating,
        ma.assessed_at,
        ma.assessed_by,
        ma.commander_override,
        CASE
          WHEN ma.assessed_at IS NULL THEN 'expired'
          WHEN NOW() - ma.assessed_at > (mt.decay_days * INTERVAL '1 day') THEN 'expired'
          WHEN NOW() - ma.assessed_at > (mt.decay_days * 0.75 * INTERVAL '1 day') THEN 'warning'
          ELSE 'current'
        END AS decay_status
      FROM metl_tasks mt
      LEFT JOIN metl_assessments ma ON ma.metl_task_id = mt.id
      WHERE mt.source_problem_set_id = $1
        AND mt.is_supplemental = false
      ORDER BY mt.id, ma.assessed_at DESC NULLS LAST`,
      [sourceProblemSetId],
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      metlTaskId: row.metl_task_id as string,
      taskName: row.task_name as string,
      competencyArea: row.competency_area as string | undefined,
      decayDays: row.decay_days as number,
      rating: row.rating as METLProficiencySummary['rating'],
      assessedAt: row.assessed_at ? new Date(row.assessed_at as string) : undefined,
      assessedBy: row.assessed_by as string | undefined,
      commanderOverride: row.commander_override as boolean | undefined,
      decayStatus: row.decay_status as METLProficiencySummary['decayStatus'],
    }));
  }

  /** Get full assessment history for a specific METL task */
  async getAssessmentHistory(metlTaskId: string): Promise<METLAssessment[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM metl_assessments WHERE metl_task_id = $1 ORDER BY assessed_at DESC',
      [metlTaskId],
    );

    return result.rows.map(mapAssessmentRow);
  }
}

// Singleton export
export const metlStore = new METLStore();
