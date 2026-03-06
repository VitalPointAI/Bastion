/**
 * Mission Store
 *
 * Phase 4.4 Plan 01: Mission CRUD operations with lifecycle state management
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { Mission, MissionState } from './types.js';
import { MissionInputSchema } from './schemas.js';
import type { z } from 'zod';

type MissionInput = z.infer<typeof MissionInputSchema>;

export async function initMissionTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      classification TEXT NOT NULL,
      area_of_ops JSONB,
      workspace_id TEXT,
      state TEXT NOT NULL DEFAULT 'planning',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_mission_workspace ON missions(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_mission_state ON missions(state);
    CREATE INDEX IF NOT EXISTS idx_mission_created_by ON missions(created_by);
  `);

  // Migration: Make columns nullable if they exist with NOT NULL constraints
  await pool.query(`
    ALTER TABLE missions ALTER COLUMN description DROP NOT NULL;
    ALTER TABLE missions ALTER COLUMN area_of_ops DROP NOT NULL;
    ALTER TABLE missions ALTER COLUMN workspace_id DROP NOT NULL;
  `).catch(() => {
    // Ignore errors if columns are already nullable or don't exist
  });
}

export class MissionStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initMissionTable();
      this.initialized = true;
    }
  }

  /**
   * Create a new mission
   */
  async createMission(input: MissionInput, createdBy: string): Promise<Mission> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `MSN-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO missions (
        id, name, description, classification, area_of_ops,
        workspace_id, state, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        id,
        input.name,
        input.description ?? null,
        input.classification,
        input.areaOfOperations ? JSON.stringify(input.areaOfOperations) : null,
        input.workspaceId ?? null,
        'planning',
        createdBy,
        now,
        now,
      ]
    );

    return {
      id,
      name: input.name,
      description: input.description,
      classification: input.classification,
      areaOfOperations: input.areaOfOperations,
      workspaceId: input.workspaceId,
      state: 'planning',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get mission by ID
   */
  async getMission(id: string): Promise<Mission | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM missions WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToMission(result.rows[0]);
  }

  /**
   * List missions with optional filtering
   */
  async listMissions(filters: {
    workspaceId?: string;
    state?: MissionState;
    createdBy?: string;
  } = {}): Promise<Mission[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.workspaceId) {
      conditions.push(`workspace_id = $${idx++}`);
      params.push(filters.workspaceId);
    }
    if (filters.state) {
      conditions.push(`state = $${idx++}`);
      params.push(filters.state);
    }
    if (filters.createdBy) {
      conditions.push(`created_by = $${idx}`);
      params.push(filters.createdBy);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM missions ${where} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map((row) => this.rowToMission(row));
  }

  /**
   * Update mission fields
   */
  async updateMission(
    id: string,
    updates: Partial<Omit<MissionInput, 'workspaceId'>>
  ): Promise<Mission | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      params.push(updates.description);
    }
    if (updates.classification !== undefined) {
      fields.push(`classification = $${idx++}`);
      params.push(updates.classification);
    }
    if (updates.areaOfOperations !== undefined) {
      fields.push(`area_of_ops = $${idx++}`);
      params.push(JSON.stringify(updates.areaOfOperations));
    }

    if (fields.length === 0) {
      return this.getMission(id);
    }

    fields.push(`updated_at = $${idx++}`);
    params.push(new Date());
    params.push(id);

    const result = await pool.query(
      `UPDATE missions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) return null;
    return this.rowToMission(result.rows[0]);
  }

  /**
   * Transition mission state with validation
   *
   * State machine: planning -> active -> complete -> archived
   */
  async transitionState(id: string, newState: MissionState): Promise<Mission | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const current = await this.getMission(id);
    if (!current) return null;

    // Validate state transitions
    const validTransitions: Record<MissionState, MissionState[]> = {
      planning: ['active'],
      active: ['complete'],
      complete: ['archived'],
      archived: [],
    };

    if (!validTransitions[current.state].includes(newState)) {
      throw new Error(
        `Invalid state transition: ${current.state} -> ${newState}`
      );
    }

    const now = new Date();
    const updates: string[] = [`state = $1`, `updated_at = $2`];
    const params: unknown[] = [newState, now];
    let idx = 3;

    // Track state transition timestamps
    if (newState === 'active') {
      updates.push(`activated_at = $${idx++}`);
      params.push(now);
    } else if (newState === 'complete') {
      updates.push(`completed_at = $${idx++}`);
      params.push(now);
    }

    params.push(id);

    const result = await pool.query(
      `UPDATE missions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    return this.rowToMission(result.rows[0]);
  }

  /**
   * Convert database row to Mission object
   */
  private rowToMission(row: {
    id: string;
    name: string;
    description: string | null;
    classification: string;
    area_of_ops: unknown | null;
    workspace_id: string | null;
    state: string;
    created_by: string;
    created_at: Date;
    updated_at: Date;
    activated_at?: Date;
    completed_at?: Date;
  }): Mission {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      classification: row.classification as 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET',
      areaOfOperations: row.area_of_ops
        ? typeof row.area_of_ops === 'string'
          ? JSON.parse(row.area_of_ops)
          : row.area_of_ops
        : undefined,
      workspaceId: row.workspace_id ?? undefined,
      state: row.state as MissionState,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      activatedAt: row.activated_at ? new Date(row.activated_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
}

// Singleton instance
export const missionStore = new MissionStore();
