/**
 * Subspace Store
 *
 * CRUD operations for brain_subspaces table.
 * Subspaces are named subsets of graph nodes: either manually selected
 * (node_ids array) or defined by a smart query (query_definition JSONB).
 */

import { getPool } from '../../lib/database.js';

// =====================
// Types
// =====================

export interface SubspaceRow {
  id: string;
  problemSetId: string;
  name: string;
  subspaceType: 'manual' | 'smart';
  nodeIds: string[];
  queryDefinition: Record<string, unknown> | null;
  createdBy: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubspaceUpdates {
  name?: string;
  nodeIds?: string[];
  queryDefinition?: Record<string, unknown> | null;
  isShared?: boolean;
}

// =====================
// Row mapper
// =====================

function rowToSubspace(row: Record<string, unknown>): SubspaceRow {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    name: row.name as string,
    subspaceType: row.subspace_type as 'manual' | 'smart',
    nodeIds: (row.node_ids as string[]) || [],
    queryDefinition: row.query_definition as Record<string, unknown> | null,
    createdBy: row.created_by as string,
    isShared: row.is_shared as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// =====================
// CRUD functions
// =====================

/**
 * Create a new subspace in the database.
 */
export async function createSubspace(
  problemSetId: string,
  name: string,
  subspaceType: 'manual' | 'smart',
  createdBy: string,
  nodeIds?: string[],
  queryDefinition?: Record<string, unknown> | null,
): Promise<SubspaceRow> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO brain_subspaces
      (problem_set_id, name, subspace_type, created_by, node_ids, query_definition, is_shared)
     VALUES ($1, $2, $3, $4, $5, $6, false)
     RETURNING *`,
    [
      problemSetId,
      name,
      subspaceType,
      createdBy,
      nodeIds ?? [],
      queryDefinition ? JSON.stringify(queryDefinition) : null,
    ],
  );
  return rowToSubspace(result.rows[0]);
}

/**
 * Get all subspaces visible to a user for a given problem set.
 * Returns the user's own subspaces plus any shared subspaces.
 */
export async function getSubspaces(
  problemSetId: string,
  createdBy?: string,
): Promise<SubspaceRow[]> {
  const pool = getPool();

  if (createdBy) {
    const result = await pool.query(
      `SELECT * FROM brain_subspaces
       WHERE problem_set_id = $1 AND (created_by = $2 OR is_shared = true)
       ORDER BY created_at ASC`,
      [problemSetId, createdBy],
    );
    return result.rows.map(rowToSubspace);
  }

  const result = await pool.query(
    `SELECT * FROM brain_subspaces
     WHERE problem_set_id = $1
     ORDER BY created_at ASC`,
    [problemSetId],
  );
  return result.rows.map(rowToSubspace);
}

/**
 * Get a single subspace by its UUID.
 */
export async function getSubspaceById(id: string): Promise<SubspaceRow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM brain_subspaces WHERE id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return rowToSubspace(result.rows[0]);
}

/**
 * Update a subspace's mutable fields.
 */
export async function updateSubspace(
  id: string,
  updates: SubspaceUpdates,
): Promise<SubspaceRow> {
  const pool = getPool();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(updates.name);
  }
  if (updates.nodeIds !== undefined) {
    setClauses.push(`node_ids = $${idx++}`);
    values.push(updates.nodeIds);
  }
  if (updates.queryDefinition !== undefined) {
    setClauses.push(`query_definition = $${idx++}`);
    values.push(updates.queryDefinition ? JSON.stringify(updates.queryDefinition) : null);
  }
  if (updates.isShared !== undefined) {
    setClauses.push(`is_shared = $${idx++}`);
    values.push(updates.isShared);
  }

  if (setClauses.length === 0) {
    const existing = await getSubspaceById(id);
    if (!existing) throw new Error(`Subspace ${id} not found`);
    return existing;
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE brain_subspaces SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (result.rows.length === 0) throw new Error(`Subspace ${id} not found`);
  return rowToSubspace(result.rows[0]);
}

/**
 * Delete a subspace by ID.
 */
export async function deleteSubspace(id: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM brain_subspaces WHERE id = $1`, [id]);
}
