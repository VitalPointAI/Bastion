/**
 * Course of Action (COA) Store
 *
 * Phase 05 Plan 01: CRUD operations for COAs with 3-minimum enforcement
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type {
  COA,
  CreateCOAInput,
  UpdateCOAInput,
  RedTeamResult,
  COAComparisonScore
} from '../types.js';

/**
 * Initialize coas table
 */
async function initCOATable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS coas (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      scheme TEXT NOT NULL,
      commanders_intent JSONB NOT NULL,
      tasks JSONB NOT NULL DEFAULT '[]',
      risks JSONB NOT NULL DEFAULT '[]',
      supporting_efforts TEXT[] NOT NULL DEFAULT '{}',
      decisive_operation TEXT NOT NULL DEFAULT '',
      shaping TEXT NOT NULL DEFAULT '',
      sustaining_operations TEXT NOT NULL DEFAULT '',
      red_team_results JSONB,
      comparison_score JSONB,
      selected BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coas_plan ON coas(plan_id);
    CREATE INDEX IF NOT EXISTS idx_coas_number ON coas(plan_id, number);
    CREATE INDEX IF NOT EXISTS idx_coas_selected ON coas(plan_id, selected);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_coas_plan_number ON coas(plan_id, number);
  `);
}

/**
 * Helper to convert database row to COA
 */
function rowToCOA(row: any): COA {
  return {
    id: row.id,
    planId: row.plan_id,
    number: row.number,
    name: row.name,
    description: row.description,
    scheme: row.scheme,
    commandersIntent: row.commanders_intent,
    tasks: row.tasks,
    risks: row.risks,
    supportingEfforts: row.supporting_efforts,
    decisiveOperation: row.decisive_operation,
    shaping: row.shaping,
    sustainingOperations: row.sustaining_operations,
    redTeamResults: row.red_team_results
      ? {
          ...row.red_team_results,
          simulatedAt: new Date(row.red_team_results.simulatedAt)
        }
      : undefined,
    comparisonScore: row.comparison_score
      ? {
          ...row.comparison_score,
          comparedAt: new Date(row.comparison_score.comparedAt)
        }
      : undefined,
    selected: row.selected,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/**
 * COA Store singleton
 */
class COAStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initCOATable();
    this.initialized = true;
  }

  /**
   * Create a new COA
   */
  async create(input: CreateCOAInput, createdBy: string): Promise<COA> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `COA-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO coas (
        id, plan_id, number, name, description, scheme, commanders_intent,
        tasks, risks, supporting_efforts, decisive_operation, shaping,
        sustaining_operations, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `,
      [
        id,
        input.planId,
        input.number,
        input.name,
        input.description,
        input.scheme,
        JSON.stringify(input.commandersIntent),
        JSON.stringify(input.tasks ?? []),
        JSON.stringify(input.risks ?? []),
        input.supportingEfforts ?? [],
        input.decisiveOperation ?? '',
        input.shaping ?? '',
        input.sustainingOperations ?? '',
        createdBy,
        now,
        now
      ]
    );

    const result = await pool.query('SELECT * FROM coas WHERE id = $1', [id]);
    return rowToCOA(result.rows[0]);
  }

  /**
   * Find COA by ID
   */
  async findById(id: string): Promise<COA | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coas WHERE id = $1', [id]);
    return result.rows[0] ? rowToCOA(result.rows[0]) : null;
  }

  /**
   * Find all COAs for a plan
   */
  async findByPlan(planId: string): Promise<COA[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM coas WHERE plan_id = $1 ORDER BY number ASC',
      [planId]
    );
    return result.rows.map(rowToCOA);
  }

  /**
   * Count COAs for a plan
   */
  async countByPlan(planId: string): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM coas WHERE plan_id = $1',
      [planId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Update COA
   */
  async update(id: string, updates: UpdateCOAInput): Promise<COA> {
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
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.scheme !== undefined) {
      setClauses.push(`scheme = $${paramIndex++}`);
      values.push(updates.scheme);
    }
    if (updates.commandersIntent !== undefined) {
      setClauses.push(`commanders_intent = $${paramIndex++}`);
      values.push(JSON.stringify(updates.commandersIntent));
    }
    if (updates.tasks !== undefined) {
      setClauses.push(`tasks = $${paramIndex++}`);
      values.push(JSON.stringify(updates.tasks));
    }
    if (updates.risks !== undefined) {
      setClauses.push(`risks = $${paramIndex++}`);
      values.push(JSON.stringify(updates.risks));
    }
    if (updates.supportingEfforts !== undefined) {
      setClauses.push(`supporting_efforts = $${paramIndex++}`);
      values.push(updates.supportingEfforts);
    }
    if (updates.decisiveOperation !== undefined) {
      setClauses.push(`decisive_operation = $${paramIndex++}`);
      values.push(updates.decisiveOperation);
    }
    if (updates.shaping !== undefined) {
      setClauses.push(`shaping = $${paramIndex++}`);
      values.push(updates.shaping);
    }
    if (updates.sustainingOperations !== undefined) {
      setClauses.push(`sustaining_operations = $${paramIndex++}`);
      values.push(updates.sustainingOperations);
    }

    values.push(id);

    await pool.query(
      `UPDATE coas SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query('SELECT * FROM coas WHERE id = $1', [id]);
    return rowToCOA(result.rows[0]);
  }

  /**
   * Update Red Team results for a COA
   */
  async updateRedTeamResults(id: string, results: RedTeamResult): Promise<COA> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      `
      UPDATE coas
      SET red_team_results = $1,
          updated_at = $2
      WHERE id = $3
      `,
      [JSON.stringify(results), now, id]
    );

    const result = await pool.query('SELECT * FROM coas WHERE id = $1', [id]);
    return rowToCOA(result.rows[0]);
  }

  /**
   * Update comparison score for a COA
   */
  async updateComparisonScore(id: string, score: COAComparisonScore): Promise<COA> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      `
      UPDATE coas
      SET comparison_score = $1,
          updated_at = $2
      WHERE id = $3
      `,
      [JSON.stringify(score), now, id]
    );

    const result = await pool.query('SELECT * FROM coas WHERE id = $1', [id]);
    return rowToCOA(result.rows[0]);
  }

  /**
   * Select a COA (sets selected=true for one, false for all others in plan)
   */
  async selectCOA(planId: string, coaId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    // Begin transaction
    await pool.query('BEGIN');

    try {
      // Deselect all COAs for this plan
      await pool.query(
        'UPDATE coas SET selected = FALSE, updated_at = $1 WHERE plan_id = $2',
        [now, planId]
      );

      // Select the specified COA
      await pool.query(
        'UPDATE coas SET selected = TRUE, updated_at = $1 WHERE id = $2',
        [now, coaId]
      );

      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Delete COA
   */
  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query('DELETE FROM coas WHERE id = $1', [id]);
  }

  /**
   * Validate minimum 3 COAs requirement
   * Returns whether the plan has at least 3 COAs
   */
  async validateMinimumCOAs(planId: string): Promise<{ valid: boolean; count: number }> {
    const count = await this.countByPlan(planId);
    return {
      valid: count >= 3,
      count
    };
  }
}

export const coaStore = new COAStore();
