/**
 * Exercise Scenario Store
 *
 * Phase 14 Plan 01: CRUD operations for exercise_scenarios table.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ExerciseScenario, CreateExerciseScenario } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToScenario(row: Record<string, unknown>): ExerciseScenario {
  return {
    id: row.id as string,
    name: row.name as string,
    designation: row.designation as ExerciseScenario['designation'],
    exercisePhases: row.exercise_phases as string[],
    currentPhaseIndex: row.current_phase_index as number,
    status: row.status as ExerciseScenario['status'],
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class ScenarioStore {
  private pool = getPool();

  /**
   * Create a new exercise scenario
   */
  async create(data: CreateExerciseScenario): Promise<ExerciseScenario> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO exercise_scenarios
         (id, name, designation, exercise_phases, current_phase_index, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        data.name,
        data.designation,
        data.exercisePhases,
        data.currentPhaseIndex ?? 0,
        data.status ?? 'draft',
        data.createdBy,
        now,
        now,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM exercise_scenarios WHERE id = $1',
      [id]
    );
    return rowToScenario(result.rows[0]);
  }

  /**
   * Find scenario by ID
   */
  async findById(id: string): Promise<ExerciseScenario | null> {
    const result = await this.pool.query(
      'SELECT * FROM exercise_scenarios WHERE id = $1',
      [id]
    );
    return result.rows[0] ? rowToScenario(result.rows[0]) : null;
  }

  /**
   * Find all scenarios
   */
  async findAll(): Promise<ExerciseScenario[]> {
    const result = await this.pool.query(
      'SELECT * FROM exercise_scenarios ORDER BY created_at DESC'
    );
    return result.rows.map(rowToScenario);
  }

  /**
   * Update scenario fields
   */
  async update(id: string, data: Partial<ExerciseScenario>): Promise<ExerciseScenario> {
    const now = new Date();
    const setClauses: string[] = ['updated_at = $1'];
    const values: unknown[] = [now];
    let i = 2;

    if (data.name !== undefined)             { setClauses.push(`name = $${i++}`);                values.push(data.name); }
    if (data.designation !== undefined)      { setClauses.push(`designation = $${i++}`);          values.push(data.designation); }
    if (data.exercisePhases !== undefined)   { setClauses.push(`exercise_phases = $${i++}`);      values.push(data.exercisePhases); }
    if (data.currentPhaseIndex !== undefined){ setClauses.push(`current_phase_index = $${i++}`);  values.push(data.currentPhaseIndex); }
    if (data.status !== undefined)           { setClauses.push(`status = $${i++}`);               values.push(data.status); }

    values.push(id);
    await this.pool.query(
      `UPDATE exercise_scenarios SET ${setClauses.join(', ')} WHERE id = $${i}`,
      values
    );

    const result = await this.pool.query(
      'SELECT * FROM exercise_scenarios WHERE id = $1',
      [id]
    );
    return rowToScenario(result.rows[0]);
  }

  /**
   * Advance the scenario to the next exercise phase
   */
  async advancePhase(id: string): Promise<ExerciseScenario> {
    await this.pool.query(
      `UPDATE exercise_scenarios
       SET current_phase_index = current_phase_index + 1,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    const result = await this.pool.query(
      'SELECT * FROM exercise_scenarios WHERE id = $1',
      [id]
    );
    return rowToScenario(result.rows[0]);
  }

  /**
   * Delete a scenario (cascades to all child tables)
   */
  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM exercise_scenarios WHERE id = $1', [id]);
  }
}
