/**
 * Workspace Role Store
 *
 * Phase 19: Workspace Membership and Invite System
 *
 * Manages the off-chain mapping between military role labels (commander, xo, s1-s9, etc.)
 * and on-chain DAO role names (council, member, agent). Military templates are auto-created
 * on workspace setup; custom roles can be added, removed, and queried.
 *
 * Pattern: Military labels are the presentation layer; DAO role names are the authority layer.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import { MILITARY_ROLE_TEMPLATES } from './types.js';
import type { WorkspaceRole, WorkspaceType } from './types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initWorkspaceRoleTable(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_roles (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      military_label TEXT NOT NULL,
      dao_role_name TEXT NOT NULL,
      permissions TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(problem_set_id, military_label)
    );

    CREATE INDEX IF NOT EXISTS idx_problem_set_roles_problem_set ON problem_set_roles(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_problem_set_roles_label ON problem_set_roles(problem_set_id, military_label);
  `);
}

// ============================================================================
// Row Mapping
// ============================================================================

interface WorkspaceRoleRow {
  id: string;
  problem_set_id: string;
  military_label: string;
  dao_role_name: string;
  permissions: string[];
  created_at: Date;
}

// ============================================================================
// Workspace Role Store
// ============================================================================

export class WorkspaceRoleStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initWorkspaceRoleTable();
      this.initialized = true;
    }
  }

  private mapRow(row: WorkspaceRoleRow): WorkspaceRole {
    return {
      id: row.id,
      workspaceId: row.problem_set_id,
      militaryLabel: row.military_label,
      daoRoleName: row.dao_role_name,
      permissions: row.permissions,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Initialize military role templates for a newly created workspace.
   *
   * Looks up the pre-defined MILITARY_ROLE_TEMPLATES for the workspace type and
   * inserts each as a problem_set_roles row. Called by the API route after workspace
   * creation succeeds (off-chain + on-chain).
   *
   * @param workspaceId - Off-chain workspace ID (WS-{uuid})
   * @param workspaceType - Workspace type determines which template set to use
   * @returns All created roles
   */
  async initRolesForWorkspace(
    workspaceId: string,
    workspaceType: WorkspaceType,
  ): Promise<WorkspaceRole[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const templates = MILITARY_ROLE_TEMPLATES[workspaceType];
    const now = new Date();
    const createdRoles: WorkspaceRole[] = [];

    for (const template of templates) {
      const id = `WR-${randomUUID()}`;

      await pool.query(
        `
        INSERT INTO problem_set_roles (id, problem_set_id, military_label, dao_role_name, permissions, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (problem_set_id, military_label) DO NOTHING
        `,
        [id, workspaceId, template.label, template.daoRole, template.permissions, now],
      );

      createdRoles.push({
        id,
        workspaceId,
        militaryLabel: template.label,
        daoRoleName: template.daoRole,
        permissions: template.permissions,
        createdAt: now,
      });
    }

    return createdRoles;
  }

  /**
   * Get all roles for a workspace (templates + custom roles).
   */
  async getRolesForWorkspace(workspaceId: string): Promise<WorkspaceRole[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_roles WHERE problem_set_id = $1 ORDER BY created_at ASC',
      [workspaceId],
    );
    return result.rows.map((row) => this.mapRow(row as WorkspaceRoleRow));
  }

  /**
   * Get a specific role by its military label within a workspace.
   */
  async getRoleByLabel(workspaceId: string, label: string): Promise<WorkspaceRole | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_roles WHERE problem_set_id = $1 AND military_label = $2',
      [workspaceId, label],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as WorkspaceRoleRow);
  }

  /**
   * Add a custom role to a workspace (beyond the standard military templates).
   *
   * @param workspaceId - Workspace to add the role to
   * @param label - Military-style label for the role (must be unique within the workspace)
   * @param daoRoleName - Corresponding DAO role name ('council' | 'member' | 'agent')
   * @param permissions - Array of permission strings for this role
   * @returns Created role
   */
  async addCustomRole(
    workspaceId: string,
    label: string,
    daoRoleName: string,
    permissions: string[],
  ): Promise<WorkspaceRole> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `WR-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO problem_set_roles (id, problem_set_id, military_label, dao_role_name, permissions, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [id, workspaceId, label, daoRoleName, permissions, now],
    );

    return {
      id,
      workspaceId,
      militaryLabel: label,
      daoRoleName,
      permissions,
      createdAt: now,
    };
  }

  /**
   * Remove a role from a workspace by its military label.
   * Note: Cannot remove roles that are assigned to active members — caller must
   * reassign members first.
   */
  async removeRole(workspaceId: string, label: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      'DELETE FROM problem_set_roles WHERE problem_set_id = $1 AND military_label = $2',
      [workspaceId, label],
    );
  }
}

// Singleton export — import workspaceRoleStore rather than constructing new instances
export const workspaceRoleStore = new WorkspaceRoleStore();
