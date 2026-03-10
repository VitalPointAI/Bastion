/**
 * Interview Store - PostgreSQL persistence for ProblemSetContext
 *
 * Handles UPSERT of scoping interview results to the problem_set_context table.
 * Uses the context_data JSONB column for flexible schema storage.
 * Supports versioning for re-run detection and incremental updates.
 */

import { getPool } from '../../lib/database.js';
import { ProblemSetContextSchema, type ProblemSetContext } from '../schemas.js';

/**
 * Save a ProblemSetContext to the database.
 * Uses UPSERT on problem_set_id, incrementing the version number.
 * Stores the full context as JSONB in the context_data column.
 */
export async function saveProblemSetContext(
  context: ProblemSetContext
): Promise<void> {
  const pool = getPool();

  // Validate the context before saving
  const parsed = ProblemSetContextSchema.safeParse(context);
  if (!parsed.success) {
    throw new Error(
      `Invalid ProblemSetContext: ${JSON.stringify(parsed.error)}`
    );
  }

  const validContext = parsed.data;

  await pool.query(
    `INSERT INTO problem_set_context (
      id,
      problem_set_id,
      context_data,
      version,
      updated_at
    ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
    ON CONFLICT (problem_set_id) DO UPDATE SET
      context_data = EXCLUDED.context_data,
      version = problem_set_context.version + 1,
      updated_at = EXCLUDED.updated_at`,
    [
      validContext.problemSetId,
      JSON.stringify(validContext),
      validContext.version,
      validContext.updatedAt,
    ]
  );
}

/**
 * Retrieve the current ProblemSetContext for a problem set.
 * Returns null if no context has been saved yet.
 */
export async function getProblemSetContext(
  problemSetId: string
): Promise<ProblemSetContext | null> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT context_data, version, updated_at
    FROM problem_set_context
    WHERE problem_set_id = $1`,
    [problemSetId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  // context_data is JSONB — PostgreSQL driver returns it as a parsed object
  const contextData = typeof row.context_data === 'string'
    ? JSON.parse(row.context_data)
    : row.context_data;

  // Merge stored version/updatedAt from columns (source of truth) with JSONB data
  return {
    ...contextData,
    problemSetId,
    version: row.version,
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : row.updated_at,
  };
}

/**
 * Get just the version number for a problem set context.
 * Useful for re-run detection without loading the full context.
 * Returns 0 if no context exists.
 */
export async function getContextVersion(
  problemSetId: string
): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT version FROM problem_set_context WHERE problem_set_id = $1`,
    [problemSetId]
  );

  if (result.rows.length === 0) return 0;
  return result.rows[0].version;
}
