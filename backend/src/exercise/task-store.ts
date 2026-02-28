/**
 * Planning Task Store
 *
 * Phase 14 Plan 01: CRUD for planning_tasks with role-based filtering.
 * Team filtering via `AND team = ANY($N)` enforces information barrier.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { PlanningTask, CreatePlanningTask } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToTask(row: Record<string, unknown>): PlanningTask {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    scenarioId: row.scenario_id as string,
    team: row.team as PlanningTask['team'],
    assignedRole: row.assigned_role as PlanningTask['assignedRole'],
    title: row.title as string,
    description: (row.description as string) ?? '',
    deadline: row.deadline ? new Date(row.deadline as string) : null,
    status: row.status as PlanningTask['status'],
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class TaskStore {
  private pool = getPool();

  /**
   * Create a new planning task
   */
  async create(data: CreatePlanningTask): Promise<PlanningTask> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO planning_tasks
         (id, order_id, scenario_id, team, assigned_role, title, description,
          deadline, status, completed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        data.orderId,
        data.scenarioId,
        data.team,
        data.assignedRole,
        data.title,
        data.description ?? '',
        data.deadline ?? null,
        data.status ?? 'pending',
        data.completedAt ?? null,
        now,
        now,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM planning_tasks WHERE id = $1',
      [id]
    );
    return rowToTask(result.rows[0]);
  }

  /**
   * Find all tasks for a scenario visible to the given teams
   */
  async findByScenario(
    scenarioId: string,
    visibleTeams: string[]
  ): Promise<PlanningTask[]> {
    const result = await this.pool.query(
      `SELECT * FROM planning_tasks
       WHERE scenario_id = $1 AND team = ANY($2)
       ORDER BY created_at ASC`,
      [scenarioId, visibleTeams]
    );
    return result.rows.map(rowToTask);
  }

  /**
   * Find all tasks linked to a specific order with team filtering
   */
  async findByOrder(
    orderId: string,
    visibleTeams: string[]
  ): Promise<PlanningTask[]> {
    const result = await this.pool.query(
      `SELECT * FROM planning_tasks
       WHERE order_id = $1 AND team = ANY($2)
       ORDER BY created_at ASC`,
      [orderId, visibleTeams]
    );
    return result.rows.map(rowToTask);
  }

  /**
   * Find tasks by assigned role within a scenario with team filtering
   */
  async findByRole(
    scenarioId: string,
    role: string,
    visibleTeams: string[]
  ): Promise<PlanningTask[]> {
    const result = await this.pool.query(
      `SELECT * FROM planning_tasks
       WHERE scenario_id = $1 AND assigned_role = $2 AND team = ANY($3)
       ORDER BY created_at ASC`,
      [scenarioId, role, visibleTeams]
    );
    return result.rows.map(rowToTask);
  }

  /**
   * Update task status; sets completedAt automatically when status = 'complete'
   */
  async updateStatus(id: string, status: string): Promise<void> {
    const completedAt = status === 'complete' ? new Date() : null;

    await this.pool.query(
      `UPDATE planning_tasks
       SET status = $1, completed_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, completedAt, id]
    );
  }

  /**
   * Find a task by ID with team barrier check
   */
  async findById(
    id: string,
    visibleTeams: string[]
  ): Promise<PlanningTask | null> {
    const result = await this.pool.query(
      `SELECT * FROM planning_tasks
       WHERE id = $1 AND team = ANY($2)`,
      [id, visibleTeams]
    );
    return result.rows[0] ? rowToTask(result.rows[0]) : null;
  }

  /**
   * Reassign a task to a different planning role.
   * Used by PlanningBoardService.reassignTask().
   */
  async updateAssignedRole(id: string, newRole: string): Promise<void> {
    await this.pool.query(
      `UPDATE planning_tasks
       SET assigned_role = $1, updated_at = NOW()
       WHERE id = $2`,
      [newRole, id]
    );
  }
}
