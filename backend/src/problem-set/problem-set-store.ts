/**
 * Problem Set Store
 *
 * Phase 23: Problem Set Model & Workspace Rename
 *
 * Off-chain CRUD for problem sets. Every problem set has a corresponding on-chain NEAR DAO.
 * This store manages the PostgreSQL shadow table; API routes are responsible for triggering
 * on-chain DAO creation via signAndSubmitFunctionCall before or after calling createProblemSet.
 *
 * Invariant: Problem Set = DAO. A row in this table means a DAO exists (or is being created).
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  AppMode,
  ProblemSet,
  Echelon,
  CreateProblemSetInput,
} from './types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initProblemSetTables(): Promise<void> {
  const pool = getPool();

  // Primary problem set registry — off-chain mirror of on-chain DAOs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_sets (
      id TEXT PRIMARY KEY,
      dao_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      echelon TEXT NOT NULL,
      classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
      parent_problem_set_id TEXT REFERENCES problem_sets(id),
      invite_mode TEXT NOT NULL DEFAULT 'gated',
      discoverability TEXT NOT NULL DEFAULT 'private',
      problem_statement TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_problem_set_parent ON problem_sets(parent_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_problem_set_classification ON problem_sets(classification);
    CREATE INDEX IF NOT EXISTS idx_problem_set_echelon ON problem_sets(echelon);
  `);

  // Phase 22: Add mode column for training/operational mode filtering
  await pool.query(`
    ALTER TABLE problem_sets ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'operational';
    CREATE INDEX IF NOT EXISTS idx_problem_set_mode ON problem_sets(mode);
  `);

  // Add problem_set_id FK to exercise_scenarios (missions AND exercises nest under problem sets)
  // This is a nullable column migration — existing exercises remain unaffected
  await pool.query(`
    ALTER TABLE exercise_scenarios
    ADD COLUMN IF NOT EXISTS problem_set_id TEXT REFERENCES problem_sets(id);
  `);
}

// ============================================================================
// Row Mapping
// ============================================================================

interface ProblemSetRow {
  id: string;
  dao_id: string;
  name: string;
  description: string | null;
  problem_statement: string | null;
  echelon: string;
  classification: string;
  parent_problem_set_id: string | null;
  invite_mode: string;
  discoverability: string;
  mode: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Problem Set Store
// ============================================================================

export class ProblemSetStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initProblemSetTables();
      this.initialized = true;
    }
  }

  private mapRow(row: ProblemSetRow): ProblemSet {
    return {
      id: row.id,
      daoId: row.dao_id,
      name: row.name,
      description: row.description,
      problemStatement: row.problem_statement ?? null,
      echelon: row.echelon as Echelon,
      classification: row.classification as ProblemSet['classification'],
      parentProblemSetId: row.parent_problem_set_id,
      inviteMode: row.invite_mode as ProblemSet['inviteMode'],
      discoverability: row.discoverability as ProblemSet['discoverability'],
      mode: (row.mode ?? 'operational') as AppMode,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Create a new problem set record.
   *
   * NOTE: Does NOT call on-chain DAO creation — the API route handles that step
   * before or in parallel. The daoId is generated here and returned for the caller
   * to use when submitting the create_dao transaction.
   *
   * @param input - Problem set creation input
   * @param createdBy - DID of the creator (did:near:{accountId})
   * @returns Created problem set with generated IDs
   */
  async createProblemSet(input: CreateProblemSetInput, createdBy: string): Promise<ProblemSet> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `PS-${randomUUID()}`;
    // DAO ID includes UUID to prevent naming collisions on-chain
    const daoId = `ps-${input.echelon.toLowerCase()}-${randomUUID()}`;
    const now = new Date();

    const mode = input.mode ?? 'operational';

    await pool.query(
      `
      INSERT INTO problem_sets (
        id, dao_id, name, description, echelon, classification,
        parent_problem_set_id, invite_mode, discoverability, problem_statement, mode, created_by,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        id,
        daoId,
        input.name,
        input.description ?? null,
        input.echelon,
        input.classification,
        input.parentProblemSetId ?? null,
        input.inviteMode ?? 'gated',
        input.discoverability ?? 'private',
        input.problemStatement ?? null,
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
      problemStatement: input.problemStatement ?? null,
      echelon: input.echelon,
      classification: input.classification,
      parentProblemSetId: input.parentProblemSetId ?? null,
      inviteMode: input.inviteMode ?? 'gated',
      discoverability: input.discoverability ?? 'private',
      mode: input.mode ?? 'operational',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a problem set by its off-chain ID (PS-{uuid}).
   */
  async getProblemSet(id: string): Promise<ProblemSet | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query('SELECT * FROM problem_sets WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as ProblemSetRow);
  }

  /**
   * Get a problem set by its on-chain DAO ID.
   */
  async getProblemSetByDaoId(daoId: string): Promise<ProblemSet | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query('SELECT * FROM problem_sets WHERE dao_id = $1', [daoId]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0] as ProblemSetRow);
  }

  /**
   * List direct children of a problem set (one level down only).
   */
  async listChildProblemSets(parentId: string): Promise<ProblemSet[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_sets WHERE parent_problem_set_id = $1 ORDER BY created_at ASC',
      [parentId],
    );
    return result.rows.map((row) => this.mapRow(row as ProblemSetRow));
  }

  /**
   * List all problem sets of a given echelon.
   */
  async listProblemSetsByEchelon(echelon: Echelon): Promise<ProblemSet[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_sets WHERE echelon = $1 ORDER BY created_at ASC',
      [echelon],
    );
    return result.rows.map((row) => this.mapRow(row as ProblemSetRow));
  }

  /**
   * List problem sets for a user filtered by mode.
   * Joins with problem_set_members to return only problem sets the user belongs to,
   * filtered by the specified app mode.
   *
   * @param userDid - User DID (did:near:{accountId})
   * @param mode - App mode to filter by ('training' or 'operational')
   * @returns Array of problem sets matching the mode where user is an active member
   */
  async listForUser(userDid: string, mode: AppMode): Promise<ProblemSet[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `SELECT w.* FROM problem_sets w
       INNER JOIN problem_set_members wm ON w.id = wm.problem_set_id
       WHERE wm.user_did = $1 AND wm.status = 'active' AND w.mode = $2
       ORDER BY w.created_at ASC`,
      [userDid, mode],
    );
    return result.rows.map((row) => this.mapRow(row as ProblemSetRow));
  }

  /**
   * Update mutable problem set fields (name, description, problemStatement, inviteMode, discoverability).
   * Returns the updated problem set.
   */
  async updateProblemSet(
    id: string,
    updates: Partial<Pick<ProblemSet, 'name' | 'description' | 'problemStatement' | 'inviteMode' | 'discoverability'>>,
  ): Promise<ProblemSet> {
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
    if (updates.problemStatement !== undefined) {
      setClauses.push(`problem_statement = $${paramIndex++}`);
      values.push(updates.problemStatement);
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
      const current = await this.getProblemSet(id);
      if (!current) throw new Error(`Problem set not found: ${id}`);
      return current;
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id); // for WHERE clause

    const result = await pool.query(
      `UPDATE problem_sets SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) throw new Error(`Problem set not found: ${id}`);
    return this.mapRow(result.rows[0] as ProblemSetRow);
  }

  /**
   * Delete a problem set by ID.
   * Child tables use ON DELETE CASCADE so members, invites, activity, roles,
   * compartments, subscriptions, escalation rules, and panel config are removed automatically.
   *
   * @returns true if deleted, false if not found
   */
  async deleteProblemSet(id: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('DELETE FROM problem_sets WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get the full hierarchy rooted at a problem set — all descendants (not just direct children).
   * Uses a recursive CTE for efficient single-query traversal.
   *
   * @param rootId - The root problem set ID to start from
   * @returns Array of all problem sets in the hierarchy (root + all descendants), ordered by depth
   */
  async getHierarchy(rootId: string): Promise<ProblemSet[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      WITH RECURSIVE problem_set_tree AS (
        -- Base case: start from the root
        SELECT *, 0 AS depth FROM problem_sets WHERE id = $1
        UNION ALL
        -- Recursive: find children of each level
        SELECT ps.*, pst.depth + 1
        FROM problem_sets ps
        INNER JOIN problem_set_tree pst ON ps.parent_problem_set_id = pst.id
      )
      SELECT * FROM problem_set_tree ORDER BY depth ASC, created_at ASC
      `,
      [rootId],
    );

    return result.rows.map((row) => this.mapRow(row as ProblemSetRow));
  }
}

// Singleton export — import problemSetStore rather than constructing new instances
export const problemSetStore = new ProblemSetStore();
