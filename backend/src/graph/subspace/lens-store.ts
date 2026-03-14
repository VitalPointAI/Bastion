/**
 * Lens Store
 *
 * CRUD operations for brain_lenses table.
 * Lenses are named filter/visualization configurations that control how the
 * brain graph is rendered: node type filters, actor category filters,
 * DIME category filters, clustering mode, and visibility toggles.
 */

import { getPool } from '../../lib/database.js';

// =====================
// Types
// =====================

export interface LensConfig {
  clusterMode?: string;
  nodeTypeFilters?: string[];
  actorCategoryFilters?: string[];
  dimeCategoryFilters?: string[];
  showGapNodes?: boolean;
  showConfidenceOverlay?: boolean;
  isShared?: boolean;
}

export interface LensRow {
  id: string;
  problemSetId: string;
  name: string;
  isBuiltIn: boolean;
  clusterMode: string;
  nodeTypeFilters: string[];
  actorCategoryFilters: string[];
  dimeCategoryFilters: string[];
  showGapNodes: boolean;
  showConfidenceOverlay: boolean;
  createdBy: string;
  isShared: boolean;
  clonedFrom: string | null;
  createdAt: string;
  updatedAt: string;
}

// =====================
// Row mapper
// =====================

function rowToLens(row: Record<string, unknown>): LensRow {
  return {
    id: row.id as string,
    problemSetId: row.problem_set_id as string,
    name: row.name as string,
    isBuiltIn: row.is_built_in as boolean,
    clusterMode: (row.cluster_mode as string) || 'container',
    nodeTypeFilters: (row.node_type_filters as string[]) || [],
    actorCategoryFilters: (row.actor_category_filters as string[]) || [],
    dimeCategoryFilters: (row.dime_category_filters as string[]) || [],
    showGapNodes: row.show_gap_nodes as boolean,
    showConfidenceOverlay: row.show_confidence_overlay as boolean,
    createdBy: row.created_by as string,
    isShared: row.is_shared as boolean,
    clonedFrom: (row.cloned_from as string) || null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// =====================
// CRUD functions
// =====================

/**
 * Create a new lens.
 */
export async function createLens(
  problemSetId: string,
  name: string,
  createdBy: string,
  config: LensConfig,
): Promise<LensRow> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO brain_lenses
      (problem_set_id, name, created_by, cluster_mode, node_type_filters,
       actor_category_filters, dime_category_filters, show_gap_nodes,
       show_confidence_overlay, is_shared, is_built_in)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
     RETURNING *`,
    [
      problemSetId,
      name,
      createdBy,
      config.clusterMode ?? 'container',
      config.nodeTypeFilters ?? [],
      config.actorCategoryFilters ?? [],
      config.dimeCategoryFilters ?? [],
      config.showGapNodes ?? true,
      config.showConfidenceOverlay ?? false,
      config.isShared ?? false,
    ],
  );
  return rowToLens(result.rows[0]);
}

/**
 * Get all lenses visible to a user for a given problem set.
 * Returns user's own lenses, shared lenses, and built-in lenses.
 */
export async function getLenses(
  problemSetId: string,
  createdBy?: string,
): Promise<LensRow[]> {
  const pool = getPool();

  if (createdBy) {
    const result = await pool.query(
      `SELECT * FROM brain_lenses
       WHERE problem_set_id = $1 AND (created_by = $2 OR is_shared = true OR is_built_in = true)
       ORDER BY is_built_in DESC, created_at ASC`,
      [problemSetId, createdBy],
    );
    return result.rows.map(rowToLens);
  }

  const result = await pool.query(
    `SELECT * FROM brain_lenses
     WHERE problem_set_id = $1
     ORDER BY is_built_in DESC, created_at ASC`,
    [problemSetId],
  );
  return result.rows.map(rowToLens);
}

/**
 * Get a single lens by ID.
 */
export async function getLensById(id: string): Promise<LensRow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM brain_lenses WHERE id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return rowToLens(result.rows[0]);
}

/**
 * Update a lens's mutable fields (derived from LensConfig).
 */
export async function updateLens(
  id: string,
  updates: Partial<LensConfig> & { name?: string },
): Promise<LensRow> {
  const pool = getPool();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(updates.name);
  }
  if (updates.clusterMode !== undefined) {
    setClauses.push(`cluster_mode = $${idx++}`);
    values.push(updates.clusterMode);
  }
  if (updates.nodeTypeFilters !== undefined) {
    setClauses.push(`node_type_filters = $${idx++}`);
    values.push(updates.nodeTypeFilters);
  }
  if (updates.actorCategoryFilters !== undefined) {
    setClauses.push(`actor_category_filters = $${idx++}`);
    values.push(updates.actorCategoryFilters);
  }
  if (updates.dimeCategoryFilters !== undefined) {
    setClauses.push(`dime_category_filters = $${idx++}`);
    values.push(updates.dimeCategoryFilters);
  }
  if (updates.showGapNodes !== undefined) {
    setClauses.push(`show_gap_nodes = $${idx++}`);
    values.push(updates.showGapNodes);
  }
  if (updates.showConfidenceOverlay !== undefined) {
    setClauses.push(`show_confidence_overlay = $${idx++}`);
    values.push(updates.showConfidenceOverlay);
  }
  if (updates.isShared !== undefined) {
    setClauses.push(`is_shared = $${idx++}`);
    values.push(updates.isShared);
  }

  if (setClauses.length === 0) {
    const existing = await getLensById(id);
    if (!existing) throw new Error(`Lens ${id} not found`);
    return existing;
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE brain_lenses SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (result.rows.length === 0) throw new Error(`Lens ${id} not found`);
  return rowToLens(result.rows[0]);
}

/**
 * Delete a lens by ID.
 * Built-in lenses cannot be deleted — throws an error if attempted.
 */
export async function deleteLens(id: string): Promise<void> {
  const pool = getPool();

  // Prevent deletion of built-in lenses
  const existing = await getLensById(id);
  if (!existing) return; // Already gone
  if (existing.isBuiltIn) {
    throw new Error(`Cannot delete built-in lens: ${existing.name}`);
  }

  await pool.query(`DELETE FROM brain_lenses WHERE id = $1`, [id]);
}

/**
 * Clone a lens for a new user. Preserves all config, sets cloned_from reference.
 */
export async function cloneLens(id: string, newCreatedBy: string): Promise<LensRow> {
  const pool = getPool();

  const source = await getLensById(id);
  if (!source) throw new Error(`Lens ${id} not found`);

  const result = await pool.query(
    `INSERT INTO brain_lenses
      (problem_set_id, name, created_by, cluster_mode, node_type_filters,
       actor_category_filters, dime_category_filters, show_gap_nodes,
       show_confidence_overlay, is_shared, is_built_in, cloned_from)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, false, $10)
     RETURNING *`,
    [
      source.problemSetId,
      `${source.name} (copy)`,
      newCreatedBy,
      source.clusterMode,
      source.nodeTypeFilters,
      source.actorCategoryFilters,
      source.dimeCategoryFilters,
      source.showGapNodes,
      source.showConfidenceOverlay,
      source.id,
    ],
  );
  return rowToLens(result.rows[0]);
}
