/**
 * Problem Set Role Store
 *
 * Phase 23: Problem Set Model & Workspace Rename
 *
 * Manages the off-chain mapping between military role labels (commander, xo, s1-s9, etc.)
 * and on-chain DAO role names (council, member, agent). Military templates are auto-created
 * on problem set setup; custom roles can be added, removed, and queried.
 *
 * Pattern: Military labels are the presentation layer; DAO role names are the authority layer.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import { ECHELON_ROLE_TEMPLATES } from './types.js';
import type { ProblemSetRole, Echelon } from './types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initProblemSetRoleTable(): Promise<void> {
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

interface ProblemSetRoleRow {
  id: string;
  problem_set_id: string;
  military_label: string;
  dao_role_name: string;
  permissions: string[];
  created_at: Date;
}

// ============================================================================
// Problem Set Role Store
// ============================================================================

export class ProblemSetRoleStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initProblemSetRoleTable();
      this.initialized = true;
    }
  }

  private mapRow(row: ProblemSetRoleRow): ProblemSetRole {
    return {
      id: row.id,
      problemSetId: row.problem_set_id,
      militaryLabel: row.military_label,
      daoRoleName: row.dao_role_name,
      permissions: row.permissions,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Initialize military role templates for a newly created problem set.
   *
   * Looks up the pre-defined ECHELON_ROLE_TEMPLATES for the echelon and
   * inserts each as a problem_set_roles row. Called by the API route after problem set
   * creation succeeds (off-chain + on-chain).
   *
   * @param problemSetId - Off-chain problem set ID (PS-{uuid})
   * @param echelon - Echelon determines which template set to use
   * @returns All created roles
   */
  async initRolesForProblemSet(
    problemSetId: string,
    echelon: Echelon,
  ): Promise<ProblemSetRole[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const templates = ECHELON_ROLE_TEMPLATES[echelon];
    const now = new Date();
    const createdRoles: ProblemSetRole[] = [];

    for (const template of templates) {
      const id = `PR-${randomUUID()}`;

      await pool.query(
        `
        INSERT INTO problem_set_roles (id, problem_set_id, military_label, dao_role_name, permissions, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (problem_set_id, military_label) DO NOTHING
        `,
        [id, problemSetId, template.label, template.daoRole, template.permissions, now],
      );

      createdRoles.push({
        id,
        problemSetId,
        militaryLabel: template.label,
        daoRoleName: template.daoRole,
        permissions: template.permissions,
        createdAt: now,
      });
    }

    return createdRoles;
  }

  /**
   * Get all roles for a problem set (templates + custom roles).
   */
  async getRolesForProblemSet(problemSetId: string): Promise<ProblemSetRole[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_roles WHERE problem_set_id = $1 ORDER BY created_at ASC',
      [problemSetId],
    );
    return result.rows.map((row) => this.mapRow(row as ProblemSetRoleRow));
  }

  /**
   * Get a specific role by its military label within a problem set.
   */
  async getRoleByLabel(problemSetId: string, label: string): Promise<ProblemSetRole | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_roles WHERE problem_set_id = $1 AND military_label = $2',
      [problemSetId, label],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as ProblemSetRoleRow);
  }

  /**
   * Add a custom role to a problem set (beyond the standard military templates).
   *
   * @param problemSetId - Problem set to add the role to
   * @param label - Military-style label for the role (must be unique within the problem set)
   * @param daoRoleName - Corresponding DAO role name ('council' | 'member' | 'agent')
   * @param permissions - Array of permission strings for this role
   * @returns Created role
   */
  async addCustomRole(
    problemSetId: string,
    label: string,
    daoRoleName: string,
    permissions: string[],
  ): Promise<ProblemSetRole> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `PR-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO problem_set_roles (id, problem_set_id, military_label, dao_role_name, permissions, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [id, problemSetId, label, daoRoleName, permissions, now],
    );

    return {
      id,
      problemSetId,
      militaryLabel: label,
      daoRoleName,
      permissions,
      createdAt: now,
    };
  }

  /**
   * Remove a role from a problem set by its military label.
   * Note: Cannot remove roles that are assigned to active members — caller must
   * reassign members first.
   */
  async removeRole(problemSetId: string, label: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      'DELETE FROM problem_set_roles WHERE problem_set_id = $1 AND military_label = $2',
      [problemSetId, label],
    );
  }
}

// Singleton export — import problemSetRoleStore rather than constructing new instances
export const problemSetRoleStore = new ProblemSetRoleStore();
