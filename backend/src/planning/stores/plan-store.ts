/**
 * Operational Plan Store
 *
 * Phase 05 Plan 01: CRUD operations for operational plans with JP 5-0 workflow
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type {
  OperationalPlan,
  CreateOperationalPlanInput,
  UpdateOperationalPlanInput,
  JP50Step,
  StepStatus,
  SituationParagraph,
  MissionStatement,
  ExecutionParagraph,
  SustainmentParagraph,
  CommandSignalParagraph,
  AnnexLetter,
  Annex
} from '../types.js';

/**
 * Initialize operational_plans table
 */
async function initPlanTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS operational_plans (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      objective_ids TEXT[] NOT NULL,
      name TEXT NOT NULL,
      classification TEXT NOT NULL,
      plan_type TEXT NOT NULL,
      step TEXT NOT NULL DEFAULT 'planning_initiation',
      step_statuses JSONB NOT NULL DEFAULT '{}',
      commander_approval JSONB NOT NULL DEFAULT '{"coaApproved": false, "planApproved": false}',
      situation JSONB NOT NULL DEFAULT '{}',
      mission_statement JSONB NOT NULL DEFAULT '{}',
      execution JSONB NOT NULL DEFAULT '{}',
      sustainment JSONB NOT NULL DEFAULT '{}',
      command_signal JSONB NOT NULL DEFAULT '{}',
      annexes JSONB NOT NULL DEFAULT '{}',
      yjs_document_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_plans_mission ON operational_plans(mission_id);
    CREATE INDEX IF NOT EXISTS idx_plans_objectives ON operational_plans USING GIN(objective_ids);
    CREATE INDEX IF NOT EXISTS idx_plans_step ON operational_plans(step);
    CREATE INDEX IF NOT EXISTS idx_plans_created_by ON operational_plans(created_by);
  `);
}

/**
 * Helper to convert database row to OperationalPlan
 */
function rowToPlan(row: any): OperationalPlan {
  return {
    id: row.id,
    missionId: row.mission_id,
    objectiveIds: row.objective_ids,
    name: row.name,
    classification: row.classification,
    planType: row.plan_type,
    step: row.step,
    stepStatuses: row.step_statuses,
    commanderApproval: {
      coaApproved: row.commander_approval.coaApproved,
      planApproved: row.commander_approval.planApproved,
      coaApprovedAt: row.commander_approval.coaApprovedAt
        ? new Date(row.commander_approval.coaApprovedAt)
        : undefined,
      planApprovedAt: row.commander_approval.planApprovedAt
        ? new Date(row.commander_approval.planApprovedAt)
        : undefined,
      coaApprovedBy: row.commander_approval.coaApprovedBy,
      planApprovedBy: row.commander_approval.planApprovedBy
    },
    situation: row.situation as SituationParagraph,
    mission: row.mission_statement as MissionStatement,
    execution: row.execution as ExecutionParagraph,
    sustainment: row.sustainment as SustainmentParagraph,
    commandSignal: row.command_signal as CommandSignalParagraph,
    annexes: row.annexes as Record<AnnexLetter, Annex>,
    yjsDocumentId: row.yjs_document_id,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/**
 * Plan Store singleton
 */
class PlanStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initPlanTable();
    this.initialized = true;
  }

  /**
   * Create a new operational plan
   */
  async create(input: CreateOperationalPlanInput, createdBy: string): Promise<OperationalPlan> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `OPLAN-${randomUUID()}`;
    const now = new Date();

    // Initialize step statuses - all not_started except first
    const stepStatuses: Record<JP50Step, StepStatus> = {
      planning_initiation: 'in_progress',
      mission_analysis: 'not_started',
      coa_development: 'not_started',
      coa_analysis: 'not_started',
      coa_comparison: 'not_started',
      coa_approval: 'not_started',
      plan_development: 'not_started',
      plan_approval: 'not_started'
    };

    await pool.query(
      `
      INSERT INTO operational_plans (
        id, mission_id, objective_ids, name, classification, plan_type,
        step, step_statuses, yjs_document_id, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        id,
        input.missionId,
        input.objectiveIds,
        input.name,
        input.classification,
        input.planType,
        'planning_initiation',
        JSON.stringify(stepStatuses),
        input.yjsDocumentId,
        createdBy,
        now,
        now
      ]
    );

    const result = await pool.query('SELECT * FROM operational_plans WHERE id = $1', [id]);
    return rowToPlan(result.rows[0]);
  }

  /**
   * Find all plans with optional pagination
   */
  async findAll(limit?: number, offset?: number): Promise<OperationalPlan[]> {
    await this.ensureInitialized();
    const pool = getPool();

    let query = 'SELECT * FROM operational_plans ORDER BY created_at DESC';
    const values: any[] = [];

    if (limit !== undefined) {
      values.push(limit);
      query += ` LIMIT $${values.length}`;
    }

    if (offset !== undefined) {
      values.push(offset);
      query += ` OFFSET $${values.length}`;
    }

    const result = await pool.query(query, values);
    return result.rows.map(rowToPlan);
  }

  /**
   * Find plan by ID
   */
  async findById(id: string): Promise<OperationalPlan | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM operational_plans WHERE id = $1', [id]);
    return result.rows[0] ? rowToPlan(result.rows[0]) : null;
  }

  /**
   * Find all plans for a mission
   */
  async findByMission(missionId: string): Promise<OperationalPlan[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM operational_plans WHERE mission_id = $1 ORDER BY created_at DESC',
      [missionId]
    );
    return result.rows.map(rowToPlan);
  }

  /**
   * Find all plans linked to a specific strategic objective
   */
  async findByObjective(objectiveId: string): Promise<OperationalPlan[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM operational_plans WHERE $1 = ANY(objective_ids) ORDER BY created_at DESC',
      [objectiveId]
    );
    return result.rows.map(rowToPlan);
  }

  /**
   * Update plan
   */
  async update(id: string, updates: UpdateOperationalPlanInput): Promise<OperationalPlan> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    const setClauses: string[] = ['updated_at = $1'];
    const values: any[] = [now];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.classification !== undefined) {
      setClauses.push(`classification = $${paramIndex++}`);
      values.push(updates.classification);
    }
    if (updates.planType !== undefined) {
      setClauses.push(`plan_type = $${paramIndex++}`);
      values.push(updates.planType);
    }
    if (updates.situation !== undefined) {
      setClauses.push(`situation = $${paramIndex++}`);
      values.push(JSON.stringify(updates.situation));
    }
    if (updates.mission !== undefined) {
      setClauses.push(`mission_statement = $${paramIndex++}`);
      values.push(JSON.stringify(updates.mission));
    }
    if (updates.execution !== undefined) {
      setClauses.push(`execution = $${paramIndex++}`);
      values.push(JSON.stringify(updates.execution));
    }
    if (updates.sustainment !== undefined) {
      setClauses.push(`sustainment = $${paramIndex++}`);
      values.push(JSON.stringify(updates.sustainment));
    }
    if (updates.commandSignal !== undefined) {
      setClauses.push(`command_signal = $${paramIndex++}`);
      values.push(JSON.stringify(updates.commandSignal));
    }
    if (updates.annexes !== undefined) {
      setClauses.push(`annexes = $${paramIndex++}`);
      values.push(JSON.stringify(updates.annexes));
    }

    values.push(id);

    await pool.query(
      `UPDATE operational_plans SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query('SELECT * FROM operational_plans WHERE id = $1', [id]);
    return rowToPlan(result.rows[0]);
  }

  /**
   * Update step status
   */
  async updateStep(id: string, step: JP50Step, status: StepStatus): Promise<OperationalPlan> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      `
      UPDATE operational_plans
      SET step = $1,
          step_statuses = jsonb_set(step_statuses, $2, $3),
          updated_at = $4
      WHERE id = $5
      `,
      [step, `{${step}}`, JSON.stringify(status), now, id]
    );

    const result = await pool.query('SELECT * FROM operational_plans WHERE id = $1', [id]);
    return rowToPlan(result.rows[0]);
  }

  /**
   * Record COA approval by commander
   */
  async recordCOAApproval(id: string, commanderDID: string): Promise<OperationalPlan> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      `
      UPDATE operational_plans
      SET commander_approval = jsonb_set(
            jsonb_set(
              jsonb_set(commander_approval, '{coaApproved}', 'true'),
              '{coaApprovedAt}', $1
            ),
            '{coaApprovedBy}', $2
          ),
          updated_at = $3
      WHERE id = $4
      `,
      [JSON.stringify(now.toISOString()), JSON.stringify(commanderDID), now, id]
    );

    const result = await pool.query('SELECT * FROM operational_plans WHERE id = $1', [id]);
    return rowToPlan(result.rows[0]);
  }

  /**
   * Record plan approval by commander
   */
  async recordPlanApproval(id: string, commanderDID: string): Promise<OperationalPlan> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      `
      UPDATE operational_plans
      SET commander_approval = jsonb_set(
            jsonb_set(
              jsonb_set(commander_approval, '{planApproved}', 'true'),
              '{planApprovedAt}', $1
            ),
            '{planApprovedBy}', $2
          ),
          updated_at = $3
      WHERE id = $4
      `,
      [JSON.stringify(now.toISOString()), JSON.stringify(commanderDID), now, id]
    );

    const result = await pool.query('SELECT * FROM operational_plans WHERE id = $1', [id]);
    return rowToPlan(result.rows[0]);
  }

  /**
   * Delete plan
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query('DELETE FROM operational_plans WHERE id = $1', [id]);
  }
}

export const planStore = new PlanStore();
