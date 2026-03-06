/**
 * Exercise Checkpoint Store
 *
 * Phase 22 Plan 04: Training-mode infrastructure for exercise checkpoints.
 *
 * Snapshots workspace planning state at phase boundaries for replay and iteration.
 * Checkpoint reset NEVER touches the aar_events table — AAR events persist across resets.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ============================================================================
// Types
// ============================================================================

export interface ExerciseCheckpoint {
  id: string;
  workspaceId: string;
  scenarioId: string | null;
  exercisePhase: string;
  label: string;
  snapshotData: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Table Initialization
// ============================================================================

async function initCheckpointTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS exercise_checkpoints (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      scenario_id TEXT,
      exercise_phase TEXT NOT NULL,
      label TEXT NOT NULL,
      snapshot_data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoint_workspace ON exercise_checkpoints(workspace_id);
  `);
}

// ============================================================================
// Checkpoint Store
// ============================================================================

class CheckpointStore {
  private initialized = false;

  async init(): Promise<void> {
    if (!this.initialized) {
      await initCheckpointTable();
      this.initialized = true;
    }
  }

  /**
   * Create a checkpoint snapshot of workspace planning state.
   */
  async createCheckpoint(opts: {
    workspaceId: string;
    scenarioId?: string;
    exercisePhase: string;
    label: string;
    snapshotData: Record<string, unknown>;
  }): Promise<ExerciseCheckpoint> {
    await this.init();
    const pool = getPool();
    const id = randomUUID();

    const result = await pool.query(
      `INSERT INTO exercise_checkpoints (id, workspace_id, scenario_id, exercise_phase, label, snapshot_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING created_at`,
      [
        id,
        opts.workspaceId,
        opts.scenarioId ?? null,
        opts.exercisePhase,
        opts.label,
        JSON.stringify(opts.snapshotData),
      ],
    );

    return {
      id,
      workspaceId: opts.workspaceId,
      scenarioId: opts.scenarioId ?? null,
      exercisePhase: opts.exercisePhase,
      label: opts.label,
      snapshotData: opts.snapshotData,
      createdAt: new Date(result.rows[0].created_at),
    };
  }

  /**
   * List all checkpoints for a workspace, newest first.
   */
  async listForWorkspace(workspaceId: string): Promise<ExerciseCheckpoint[]> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM exercise_checkpoints WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      scenarioId: row.scenario_id,
      exercisePhase: row.exercise_phase,
      label: row.label,
      snapshotData: row.snapshot_data,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get a single checkpoint by ID.
   */
  async getCheckpoint(id: string): Promise<ExerciseCheckpoint | null> {
    await this.init();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM exercise_checkpoints WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      scenarioId: row.scenario_id,
      exercisePhase: row.exercise_phase,
      label: row.label,
      snapshotData: row.snapshot_data,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Restore a checkpoint — retrieves snapshot data for the caller to apply.
   *
   * The actual restore logic depends on what workspace state to overwrite.
   * This method returns the snapshot data; the caller applies it.
   * NOTE: Checkpoint reset NEVER touches aar_events — AAR data persists.
   */
  async restoreCheckpoint(
    id: string,
  ): Promise<{ restored: boolean; checkpointId: string; snapshotData?: Record<string, unknown> }> {
    const checkpoint = await this.getCheckpoint(id);
    if (!checkpoint) {
      return { restored: false, checkpointId: id };
    }

    return {
      restored: true,
      checkpointId: id,
      snapshotData: checkpoint.snapshotData,
    };
  }
}

// Singleton export
export const checkpointStore = new CheckpointStore();
