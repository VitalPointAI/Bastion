/**
 * Exercise Position Store
 *
 * Quick Task 9: CRUD operations for exercise_positions and
 * exercise_position_phase_mappings tables.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  ExercisePosition,
  PositionPhaseMapping,
  CreatePositionInput,
  UpdatePositionInput,
} from './position-types.js';

// ─── Row Mappers ─────────────────────────────────────────────────────────────

function rowToPosition(row: Record<string, unknown>): ExercisePosition {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    side: row.side as ExercisePosition['side'],
    title: row.title as string,
    duties: (row.duties as string) ?? null,
    sortOrder: row.sort_order as number,
    assignedTo: (row.assigned_to as string) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    phaseMappings: [],
  };
}

function rowToPhaseMapping(row: Record<string, unknown>): PositionPhaseMapping {
  return {
    id: row.id as string,
    positionId: row.position_id as string,
    exercisePhase: row.exercise_phase as string,
    title: row.title as string,
    duties: (row.duties as string) ?? null,
  };
}

// ─── Table Init ─────────────────────────────────────────────────────────────

let tablesInitialized = false;

export async function initPositionTables(): Promise<void> {
  if (tablesInitialized) return;
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercise_positions (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL,
      side VARCHAR(20) NOT NULL CHECK (side IN ('blue', 'red', 'neutral', 'green')),
      title VARCHAR(200) NOT NULL,
      duties TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      assigned_to VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_exercise_positions_problem_set
    ON exercise_positions(problem_set_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercise_position_phase_mappings (
      id TEXT PRIMARY KEY,
      position_id TEXT NOT NULL REFERENCES exercise_positions(id) ON DELETE CASCADE,
      exercise_phase VARCHAR(100) NOT NULL,
      title VARCHAR(200) NOT NULL,
      duties TEXT,
      UNIQUE(position_id, exercise_phase)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_position_phase_mappings_position
    ON exercise_position_phase_mappings(position_id)
  `);

  tablesInitialized = true;
  console.log('+ exercise position tables initialized');
}

// ─── Store ───────────────────────────────────────────────────────────────────

export class PositionStore {
  private pool = getPool();

  /**
   * Find all positions for a problem set with phase mappings eagerly loaded.
   * Ordered by side, sort_order, title.
   */
  async findByProblemSet(problemSetId: string): Promise<ExercisePosition[]> {
    const posResult = await this.pool.query(
      `SELECT * FROM exercise_positions
       WHERE problem_set_id = $1
       ORDER BY side, sort_order, title`,
      [problemSetId]
    );

    const positions = posResult.rows.map(rowToPosition);
    if (positions.length === 0) return positions;

    const positionIds = positions.map((p) => p.id);
    const mapResult = await this.pool.query(
      `SELECT * FROM exercise_position_phase_mappings
       WHERE position_id = ANY($1)
       ORDER BY exercise_phase`,
      [positionIds]
    );

    const mappingsByPosition = new Map<string, PositionPhaseMapping[]>();
    for (const row of mapResult.rows) {
      const mapping = rowToPhaseMapping(row);
      const existing = mappingsByPosition.get(mapping.positionId) ?? [];
      existing.push(mapping);
      mappingsByPosition.set(mapping.positionId, existing);
    }

    for (const pos of positions) {
      pos.phaseMappings = mappingsByPosition.get(pos.id) ?? [];
    }

    return positions;
  }

  /**
   * Create a new position with optional phase mappings.
   */
  async create(problemSetId: string, input: CreatePositionInput): Promise<ExercisePosition> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO exercise_positions
         (id, problem_set_id, side, title, duties, sort_order, assigned_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        problemSetId,
        input.side,
        input.title,
        input.duties ?? null,
        input.sortOrder ?? 0,
        input.assignedTo ?? null,
        now,
        now,
      ]
    );

    // Insert phase mappings if provided
    if (input.phaseMappings && input.phaseMappings.length > 0) {
      for (const mapping of input.phaseMappings) {
        await this.pool.query(
          `INSERT INTO exercise_position_phase_mappings
             (id, position_id, exercise_phase, title, duties)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), id, mapping.exercisePhase, mapping.title, mapping.duties ?? null]
        );
      }
    }

    return this.findById(id);
  }

  /**
   * Update position fields.
   */
  async update(id: string, input: UpdatePositionInput): Promise<ExercisePosition> {
    const now = new Date();
    const setClauses: string[] = ['updated_at = $1'];
    const values: unknown[] = [now];
    let i = 2;

    if (input.side !== undefined)       { setClauses.push(`side = $${i++}`);        values.push(input.side); }
    if (input.title !== undefined)      { setClauses.push(`title = $${i++}`);       values.push(input.title); }
    if (input.duties !== undefined)     { setClauses.push(`duties = $${i++}`);      values.push(input.duties); }
    if (input.sortOrder !== undefined)  { setClauses.push(`sort_order = $${i++}`);  values.push(input.sortOrder); }
    if (input.assignedTo !== undefined) { setClauses.push(`assigned_to = $${i++}`); values.push(input.assignedTo); }

    values.push(id);
    await this.pool.query(
      `UPDATE exercise_positions SET ${setClauses.join(', ')} WHERE id = $${i}`,
      values
    );

    return this.findById(id);
  }

  /**
   * Delete a position (cascades to phase mappings).
   */
  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM exercise_positions WHERE id = $1', [id]);
  }

  /**
   * Replace all phase mappings for a position (full replacement strategy).
   */
  async setPhaseMappings(
    positionId: string,
    mappings: Array<{ exercisePhase: string; title: string; duties?: string }>
  ): Promise<PositionPhaseMapping[]> {
    // Delete existing mappings
    await this.pool.query(
      'DELETE FROM exercise_position_phase_mappings WHERE position_id = $1',
      [positionId]
    );

    // Insert new mappings
    const result: PositionPhaseMapping[] = [];
    for (const mapping of mappings) {
      const mapId = randomUUID();
      await this.pool.query(
        `INSERT INTO exercise_position_phase_mappings
           (id, position_id, exercise_phase, title, duties)
         VALUES ($1, $2, $3, $4, $5)`,
        [mapId, positionId, mapping.exercisePhase, mapping.title, mapping.duties ?? null]
      );
      result.push({
        id: mapId,
        positionId,
        exercisePhase: mapping.exercisePhase,
        title: mapping.title,
        duties: mapping.duties ?? null,
      });
    }

    return result;
  }

  /**
   * Bulk create positions for seed template loading.
   */
  async bulkCreate(problemSetId: string, positions: CreatePositionInput[]): Promise<ExercisePosition[]> {
    const results: ExercisePosition[] = [];
    for (const input of positions) {
      const pos = await this.create(problemSetId, input);
      results.push(pos);
    }
    return results;
  }

  /**
   * Find a single position by ID with phase mappings.
   */
  private async findById(id: string): Promise<ExercisePosition> {
    const posResult = await this.pool.query(
      'SELECT * FROM exercise_positions WHERE id = $1',
      [id]
    );
    const position = rowToPosition(posResult.rows[0]);

    const mapResult = await this.pool.query(
      `SELECT * FROM exercise_position_phase_mappings
       WHERE position_id = $1 ORDER BY exercise_phase`,
      [id]
    );
    position.phaseMappings = mapResult.rows.map(rowToPhaseMapping);

    return position;
  }
}
