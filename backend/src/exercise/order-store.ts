/**
 * Exercise Order Store
 *
 * Phase 14 Plan 01: CRUD for exercise_orders (WARNORD, OPORD, FRAGO).
 * All team-specific queries use `AND team = ANY($N)`.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ExerciseOrder, CreateExerciseOrder } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToOrder(row: Record<string, unknown>): ExerciseOrder {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    team: row.team as ExerciseOrder['team'],
    orderType: row.order_type as ExerciseOrder['orderType'],
    exercisePhase: row.exercise_phase as string,
    version: row.version as number,
    content: row.content as ExerciseOrder['content'],
    status: row.status as ExerciseOrder['status'],
    publishedAt: row.published_at ? new Date(row.published_at as string) : null,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class OrderStore {
  private pool = getPool();

  /**
   * Create a new exercise order
   */
  async create(data: CreateExerciseOrder): Promise<ExerciseOrder> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO exercise_orders
         (id, scenario_id, team, order_type, exercise_phase, version,
          content, status, published_at, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        data.scenarioId,
        data.team,
        data.orderType,
        data.exercisePhase,
        data.version ?? 1,
        JSON.stringify(data.content ?? {}),
        data.status ?? 'draft',
        data.publishedAt ?? null,
        data.createdBy,
        now,
        now,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM exercise_orders WHERE id = $1',
      [id]
    );
    return rowToOrder(result.rows[0]);
  }

  /**
   * Find all orders for a scenario visible to the given teams
   */
  async findByScenario(
    scenarioId: string,
    visibleTeams: string[]
  ): Promise<ExerciseOrder[]> {
    const result = await this.pool.query(
      `SELECT * FROM exercise_orders
       WHERE scenario_id = $1 AND team = ANY($2)
       ORDER BY created_at DESC`,
      [scenarioId, visibleTeams]
    );
    return result.rows.map(rowToOrder);
  }

  /**
   * Find an order by ID with team barrier check
   */
  async findById(
    id: string,
    visibleTeams: string[]
  ): Promise<ExerciseOrder | null> {
    const result = await this.pool.query(
      `SELECT * FROM exercise_orders
       WHERE id = $1 AND team = ANY($2)`,
      [id, visibleTeams]
    );
    return result.rows[0] ? rowToOrder(result.rows[0]) : null;
  }

  /**
   * Update order content
   */
  async updateContent(id: string, content: object): Promise<void> {
    await this.pool.query(
      `UPDATE exercise_orders
       SET content = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(content), id]
    );
  }

  /**
   * Mark an order as published
   */
  async markPublished(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE exercise_orders
       SET status = 'published', published_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Find orders for a specific exercise phase with team filtering
   */
  async findByPhase(
    scenarioId: string,
    phase: string,
    visibleTeams: string[]
  ): Promise<ExerciseOrder[]> {
    const result = await this.pool.query(
      `SELECT * FROM exercise_orders
       WHERE scenario_id = $1 AND exercise_phase = $2 AND team = ANY($3)
       ORDER BY created_at DESC`,
      [scenarioId, phase, visibleTeams]
    );
    return result.rows.map(rowToOrder);
  }
}
