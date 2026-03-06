/**
 * Workspace Store
 *
 * Phase 19: Workspace Membership and Invite System
 *
 * Off-chain CRUD for workspaces. Every workspace has a corresponding on-chain NEAR DAO.
 * This store manages the PostgreSQL shadow table; API routes are responsible for triggering
 * on-chain DAO creation via signAndSubmitFunctionCall before or after calling createWorkspace.
 *
 * Invariant: Workspace = DAO. A row in this table means a DAO exists (or is being created).
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  AppMode,
  Workspace,
  WorkspaceType,
  CreateWorkspaceInput,
} from './types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initWorkspaceTables(): Promise<void> {
  const pool = getPool();

  // Primary workspace registry — off-chain mirror of on-chain DAOs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      dao_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      workspace_type TEXT NOT NULL,
      classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
      parent_workspace_id TEXT REFERENCES workspaces(id),
      invite_mode TEXT NOT NULL DEFAULT 'gated',
      discoverability TEXT NOT NULL DEFAULT 'private',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_parent ON workspaces(parent_workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_classification ON workspaces(classification);
    CREATE INDEX IF NOT EXISTS idx_workspace_type ON workspaces(workspace_type);
  `);

  // Phase 22: Add mode column for training/operational mode filtering
  await pool.query(`
    ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'operational';
    CREATE INDEX IF NOT EXISTS idx_workspace_mode ON workspaces(mode);
  `);

  // Add workspace_id FK to exercise_scenarios (missions AND exercises nest under workspaces)
  // This is a nullable column migration — existing exercises remain unaffected
  await pool.query(`
    ALTER TABLE exercise_scenarios
    ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id);
  `);
}

// ============================================================================
// Row Mapping
// ============================================================================

interface WorkspaceRow {
  id: string;
  dao_id: string;
  name: string;
  description: string | null;
  workspace_type: string;
  classification: string;
  parent_workspace_id: string | null;
  invite_mode: string;
  discoverability: string;
  mode: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Workspace Store
// ============================================================================

export class WorkspaceStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspaceTables();
      this.initialized = true;
    }
  }

  private mapRow(row: WorkspaceRow): Workspace {
    return {
      id: row.id,
      daoId: row.dao_id,
      name: row.name,
      description: row.description,
      workspaceType: row.workspace_type as WorkspaceType,
      classification: row.classification as Workspace['classification'],
      parentWorkspaceId: row.parent_workspace_id,
      inviteMode: row.invite_mode as Workspace['inviteMode'],
      discoverability: row.discoverability as Workspace['discoverability'],
      mode: (row.mode ?? 'operational') as AppMode,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Create a new workspace record.
   *
   * NOTE: Does NOT call on-chain DAO creation — the API route handles that step
   * before or in parallel. The daoId is generated here and returned for the caller
   * to use when submitting the create_dao transaction.
   *
   * @param input - Workspace creation input
   * @param createdBy - DID of the creator (did:near:{accountId})
   * @returns Created workspace with generated IDs
   */
  async createWorkspace(input: CreateWorkspaceInput, createdBy: string): Promise<Workspace> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `WS-${randomUUID()}`;
    // DAO ID includes UUID to prevent naming collisions on-chain
    const daoId = `ws-${input.workspaceType.toLowerCase()}-${randomUUID()}`;
    const now = new Date();

    const mode = input.mode ?? 'operational';

    await pool.query(
      `
      INSERT INTO workspaces (
        id, dao_id, name, description, workspace_type, classification,
        parent_workspace_id, invite_mode, discoverability, mode, created_by,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        id,
        daoId,
        input.name,
        input.description ?? null,
        input.workspaceType,
        input.classification,
        input.parentWorkspaceId ?? null,
        input.inviteMode ?? 'gated',
        input.discoverability ?? 'private',
        mode,
        createdBy,
        now,
        now,
      ],
    );

    return {
      id,
      daoId,
      name: input.name,
      description: input.description ?? null,
      workspaceType: input.workspaceType,
      classification: input.classification,
      parentWorkspaceId: input.parentWorkspaceId ?? null,
      inviteMode: input.inviteMode ?? 'gated',
      discoverability: input.discoverability ?? 'private',
      mode: input.mode ?? 'operational',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a workspace by its off-chain ID (WS-{uuid}).
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query('SELECT * FROM workspaces WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as WorkspaceRow);
  }

  /**
   * Get a workspace by its on-chain DAO ID.
   */
  async getWorkspaceByDaoId(daoId: string): Promise<Workspace | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query('SELECT * FROM workspaces WHERE dao_id = $1', [daoId]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as WorkspaceRow);
  }

  /**
   * List direct children of a workspace (one level down only).
   */
  async listChildWorkspaces(parentId: string): Promise<Workspace[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM workspaces WHERE parent_workspace_id = $1 ORDER BY created_at ASC',
      [parentId],
    );
    return result.rows.map((row) => this.mapRow(row as WorkspaceRow));
  }

  /**
   * List all workspaces of a given type.
   */
  async listWorkspacesByType(type: WorkspaceType): Promise<Workspace[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM workspaces WHERE workspace_type = $1 ORDER BY created_at ASC',
      [type],
    );
    return result.rows.map((row) => this.mapRow(row as WorkspaceRow));
  }

  /**
   * List workspaces for a user filtered by mode.
   * Joins with workspace_members to return only workspaces the user belongs to,
   * filtered by the specified app mode.
   *
   * @param userDid - User DID (did:near:{accountId})
   * @param mode - App mode to filter by ('training' or 'operational')
   * @returns Array of workspaces matching the mode where user is an active member
   */
  async listForUser(userDid: string, mode: AppMode): Promise<Workspace[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `SELECT w.* FROM workspaces w
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_did = $1 AND wm.status = 'active' AND w.mode = $2
       ORDER BY w.created_at ASC`,
      [userDid, mode],
    );
    return result.rows.map((row) => this.mapRow(row as WorkspaceRow));
  }

  /**
   * Update mutable workspace fields (name, description, inviteMode, discoverability).
   * Returns the updated workspace.
   */
  async updateWorkspace(
    id: string,
    updates: Partial<Pick<Workspace, 'name' | 'description' | 'inviteMode' | 'discoverability'>>,
  ): Promise<Workspace> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.inviteMode !== undefined) {
      setClauses.push(`invite_mode = $${paramIndex++}`);
      values.push(updates.inviteMode);
    }
    if (updates.discoverability !== undefined) {
      setClauses.push(`discoverability = $${paramIndex++}`);
      values.push(updates.discoverability);
    }

    if (setClauses.length === 0) {
      const current = await this.getWorkspace(id);
      if (!current) throw new Error(`Workspace not found: ${id}`);
      return current;
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id); // for WHERE clause

    const result = await pool.query(
      `UPDATE workspaces SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) throw new Error(`Workspace not found: ${id}`);
    return this.mapRow(result.rows[0] as WorkspaceRow);
  }

  /**
   * Get the full hierarchy rooted at a workspace — all descendants (not just direct children).
   * Uses a recursive CTE for efficient single-query traversal.
   *
   * @param rootId - The root workspace ID to start from
   * @returns Array of all workspaces in the hierarchy (root + all descendants), ordered by depth
   */
  async getHierarchy(rootId: string): Promise<Workspace[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      WITH RECURSIVE workspace_tree AS (
        -- Base case: start from the root
        SELECT *, 0 AS depth FROM workspaces WHERE id = $1
        UNION ALL
        -- Recursive: find children of each level
        SELECT w.*, wt.depth + 1
        FROM workspaces w
        INNER JOIN workspace_tree wt ON w.parent_workspace_id = wt.id
      )
      SELECT * FROM workspace_tree ORDER BY depth ASC, created_at ASC
      `,
      [rootId],
    );

    return result.rows.map((row) => this.mapRow(row as WorkspaceRow));
  }
}

// Singleton export — import workspaceStore rather than constructing new instances
export const workspaceStore = new WorkspaceStore();
