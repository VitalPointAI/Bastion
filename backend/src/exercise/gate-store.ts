/**
 * Exercise Gate Store
 *
 * Phase 14 Plan 01: CRUD for exercise_gates.
 * Gates control phase transitions and information releases — they are
 * visible to all participants (no team column filtering needed here
 * since gate visibility is uniform), but only exercise_control can open them.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { ExerciseGate, CreateExerciseGate } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToGate(row: Record<string, unknown>): ExerciseGate {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    exercisePhase: row.exercise_phase as string,
    gateType: row.gate_type as ExerciseGate['gateType'],
    conditionDescription: row.condition_description as string,
    isOpen: Boolean(row.is_open),
    openedBy: (row.opened_by as string | null) ?? null,
    openedAt: row.opened_at ? new Date(row.opened_at as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class GateStore {
  private pool = getPool();

  /**
   * Create a new exercise gate
   */
  async create(data: CreateExerciseGate): Promise<ExerciseGate> {
    const id = randomUUID();
    const now = new Date();

    await this.pool.query(
      `INSERT INTO exercise_gates
         (id, scenario_id, exercise_phase, gate_type, condition_description,
          is_open, opened_by, opened_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        data.scenarioId,
        data.exercisePhase,
        data.gateType,
        data.conditionDescription,
        data.isOpen ?? false,
        data.openedBy ?? null,
        data.openedAt ?? null,
        now,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM exercise_gates WHERE id = $1',
      [id]
    );
    return rowToGate(result.rows[0]);
  }

  /**
   * Find all gates for a scenario
   */
  async findByScenario(scenarioId: string): Promise<ExerciseGate[]> {
    const result = await this.pool.query(
      `SELECT * FROM exercise_gates
       WHERE scenario_id = $1
       ORDER BY exercise_phase, created_at ASC`,
      [scenarioId]
    );
    return result.rows.map(rowToGate);
  }

  /**
   * Find gates for a specific exercise phase
   */
  async findByPhase(
    scenarioId: string,
    phase: string
  ): Promise<ExerciseGate[]> {
    const result = await this.pool.query(
      `SELECT * FROM exercise_gates
       WHERE scenario_id = $1 AND exercise_phase = $2
       ORDER BY created_at ASC`,
      [scenarioId, phase]
    );
    return result.rows.map(rowToGate);
  }

  /**
   * Open a gate — records who opened it and when
   */
  async openGate(id: string, openedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE exercise_gates
       SET is_open = true, opened_by = $1, opened_at = NOW()
       WHERE id = $2`,
      [openedBy, id]
    );
  }

  /**
   * Check whether all gates for a phase are open (phase is ready to transition)
   */
  async isPhaseReady(scenarioId: string, phase: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_open THEN 1 ELSE 0 END) AS open_count
       FROM exercise_gates
       WHERE scenario_id = $1 AND exercise_phase = $2`,
      [scenarioId, phase]
    );

    const total = parseInt(result.rows[0].total as string, 10);
    const openCount = parseInt(result.rows[0].open_count as string, 10);

    // A phase with no gates is considered ready
    return total === 0 || total === openCount;
  }
}
