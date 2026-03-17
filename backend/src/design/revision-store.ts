/**
 * Design Revision Store
 *
 * Phase 49 Plan 03: CRUD operations for design_revisions table.
 * Supports the fork-and-merge revision system: Plan tab staff propose changes
 * to Design artifacts, DAO governance approves, and approved revisions are
 * merged back into the operational_designs table.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ArtifactType =
  | 'problem-framing'
  | 'cog-analysis'
  | 'lines-of-effort'
  | 'operational-approach';

export type RevisionStatus = 'pending' | 'approved' | 'rejected' | 'merged';

export interface DesignRevision {
  id: string;
  problemSetId: string;
  artifactType: ArtifactType;
  proposedBy: string;
  proposedAt: string;
  originalData: unknown;
  proposedData: unknown;
  rationale: string | null;
  status: RevisionStatus;
  gateId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  mergedAt: string | null;
}

// ─── Column Mapping ──────────────────────────────────────────────────────────

/** Maps artifact_type values to their corresponding column in operational_designs. */
const ARTIFACT_COLUMN_MAP: Record<ArtifactType, string> = {
  'problem-framing': 'problem_framing',
  'cog-analysis': 'cog_analysis',
  'lines-of-effort': 'lines_of_effort',
  'operational-approach': 'operational_approach',
};

const VALID_ARTIFACT_TYPES = Object.keys(ARTIFACT_COLUMN_MAP) as ArtifactType[];

// ─── Row-to-Model Mapping ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRevision(row: Record<string, any>): DesignRevision {
  return {
    id: row.id,
    problemSetId: row.problem_set_id,
    artifactType: row.artifact_type as ArtifactType,
    proposedBy: row.proposed_by,
    proposedAt: new Date(row.proposed_at).toISOString(),
    originalData: row.original_data,
    proposedData: row.proposed_data,
    rationale: row.rationale ?? null,
    status: row.status as RevisionStatus,
    gateId: row.gate_id ?? null,
    reviewedBy: row.reviewed_by ?? null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    mergedAt: row.merged_at ? new Date(row.merged_at).toISOString() : null,
  };
}

// ─── Revision Store ──────────────────────────────────────────────────────────

export const revisionStore = {
  /**
   * Create a new revision proposal for a Design artifact.
   */
  async create(params: {
    problemSetId: string;
    artifactType: ArtifactType;
    proposedBy: string;
    originalData: unknown;
    proposedData: unknown;
    rationale?: string;
    gateId?: string;
  }): Promise<DesignRevision> {
    if (!VALID_ARTIFACT_TYPES.includes(params.artifactType)) {
      throw new Error(
        `Invalid artifactType: ${params.artifactType}. Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`
      );
    }

    const pool = getPool();
    const id = `REV-${randomUUID()}`;
    const now = new Date();

    const result = await pool.query(
      `INSERT INTO design_revisions (
        id, problem_set_id, artifact_type, proposed_by, proposed_at,
        original_data, proposed_data, rationale, status, gate_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
      RETURNING *`,
      [
        id,
        params.problemSetId,
        params.artifactType,
        params.proposedBy,
        now,
        JSON.stringify(params.originalData),
        JSON.stringify(params.proposedData),
        params.rationale ?? null,
        params.gateId ?? null,
      ]
    );

    return rowToRevision(result.rows[0]);
  },

  /**
   * List revisions for a problem set, optionally filtered by status.
   */
  async findByProblemSet(
    problemSetId: string,
    status?: string
  ): Promise<DesignRevision[]> {
    const pool = getPool();

    if (status) {
      const result = await pool.query(
        `SELECT * FROM design_revisions
         WHERE problem_set_id = $1 AND status = $2
         ORDER BY proposed_at DESC`,
        [problemSetId, status]
      );
      return result.rows.map(rowToRevision);
    }

    const result = await pool.query(
      `SELECT * FROM design_revisions
       WHERE problem_set_id = $1
       ORDER BY proposed_at DESC`,
      [problemSetId]
    );
    return result.rows.map(rowToRevision);
  },

  /**
   * Find a single revision by ID. Returns null if not found.
   */
  async findById(id: string): Promise<DesignRevision | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM design_revisions WHERE id = $1',
      [id]
    );
    if (!result.rows[0]) return null;
    return rowToRevision(result.rows[0]);
  },

  /**
   * Update the status of a revision (used by governance callbacks).
   */
  async updateStatus(
    id: string,
    status: RevisionStatus,
    reviewedBy?: string
  ): Promise<DesignRevision> {
    const pool = getPool();
    const now = new Date();

    const result = await pool.query(
      `UPDATE design_revisions
       SET status = $1,
           reviewed_by = COALESCE($2, reviewed_by),
           reviewed_at = $3
       WHERE id = $4
       RETURNING *`,
      [status, reviewedBy ?? null, now, id]
    );

    if (!result.rows[0]) {
      throw new Error(`Revision not found: ${id}`);
    }

    return rowToRevision(result.rows[0]);
  },

  /**
   * Merge an approved revision into the operational_designs table.
   *
   * Reads proposed_data from the revision and writes it to the corresponding
   * column in operational_designs (artifact_type -> column mapping).
   * Then marks the revision as 'merged'.
   */
  async merge(id: string): Promise<DesignRevision> {
    const pool = getPool();

    // 1. Fetch the revision record
    const revResult = await pool.query(
      'SELECT * FROM design_revisions WHERE id = $1',
      [id]
    );
    if (!revResult.rows[0]) {
      throw new Error(`Revision not found: ${id}`);
    }
    const rev = revResult.rows[0];

    // 2. Map artifact_type to operational_designs column
    const column = ARTIFACT_COLUMN_MAP[rev.artifact_type as ArtifactType];
    if (!column) {
      throw new Error(`Unknown artifact_type for merge: ${rev.artifact_type}`);
    }

    // 3. Update the operational_designs row with proposed_data
    await pool.query(
      `UPDATE operational_designs
       SET ${column} = $1,
           updated_at = NOW()
       WHERE problem_set_id = $2`,
      [JSON.stringify(rev.proposed_data), rev.problem_set_id]
    );

    // 4. Mark the revision as merged
    const now = new Date();
    const mergedResult = await pool.query(
      `UPDATE design_revisions
       SET status = 'merged',
           merged_at = $1
       WHERE id = $2
       RETURNING *`,
      [now, id]
    );

    return rowToRevision(mergedResult.rows[0]);
  },
};
