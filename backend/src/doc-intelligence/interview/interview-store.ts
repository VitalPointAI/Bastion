/**
 * Interview Store - PostgreSQL persistence for ProblemSetContext
 *
 * Handles UPSERT of scoping interview results to the problem_set_context table.
 * Supports versioning for re-run detection and incremental updates.
 */

import { getPool } from '../../lib/database.js';
import { ProblemSetContextSchema, type ProblemSetContext } from '../schemas.js';

/**
 * Save a ProblemSetContext to the database.
 * Uses UPSERT on problem_set_id, incrementing the version number.
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
      problem_set_id,
      geographic_scope,
      temporal_range,
      actor_focus,
      core_problem,
      additional_nuance,
      classification_ceiling,
      echelon,
      standing_requirements,
      version,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (problem_set_id) DO UPDATE SET
      geographic_scope = EXCLUDED.geographic_scope,
      temporal_range = EXCLUDED.temporal_range,
      actor_focus = EXCLUDED.actor_focus,
      core_problem = EXCLUDED.core_problem,
      additional_nuance = EXCLUDED.additional_nuance,
      classification_ceiling = EXCLUDED.classification_ceiling,
      echelon = EXCLUDED.echelon,
      standing_requirements = EXCLUDED.standing_requirements,
      version = problem_set_context.version + 1,
      updated_at = EXCLUDED.updated_at`,
    [
      validContext.problemSetId,
      JSON.stringify(validContext.geographicScope),
      JSON.stringify(validContext.temporalRange),
      JSON.stringify(validContext.actorFocus),
      validContext.coreProblem,
      validContext.additionalNuance ?? null,
      validContext.classificationCeiling,
      validContext.echelon,
      JSON.stringify(validContext.standingRequirements ?? []),
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
    `SELECT
      problem_set_id,
      geographic_scope,
      temporal_range,
      actor_focus,
      core_problem,
      additional_nuance,
      classification_ceiling,
      echelon,
      standing_requirements,
      version,
      updated_at
    FROM problem_set_context
    WHERE problem_set_id = $1`,
    [problemSetId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];

  return {
    problemSetId: row.problem_set_id,
    geographicScope: typeof row.geographic_scope === 'string'
      ? JSON.parse(row.geographic_scope)
      : row.geographic_scope,
    temporalRange: typeof row.temporal_range === 'string'
      ? JSON.parse(row.temporal_range)
      : row.temporal_range,
    actorFocus: typeof row.actor_focus === 'string'
      ? JSON.parse(row.actor_focus)
      : row.actor_focus,
    coreProblem: row.core_problem,
    additionalNuance: row.additional_nuance ?? undefined,
    classificationCeiling: row.classification_ceiling,
    echelon: row.echelon,
    standingRequirements: typeof row.standing_requirements === 'string'
      ? JSON.parse(row.standing_requirements)
      : row.standing_requirements ?? [],
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : row.updated_at,
    version: row.version,
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
