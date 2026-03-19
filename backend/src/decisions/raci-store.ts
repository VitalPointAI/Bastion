/**
 * RACI Matrix PostgreSQL Store
 *
 * Phase 53 Plan 02: CRUD operations for RACI assignments and delegations.
 * Uses getPool() pattern consistent with other stores in the project.
 *
 * RACI is a first-class standalone artifact — assignments are versioned and
 * every delegation/revocation is logged to the raci_delegations audit trail.
 */

import { getPool } from '../lib/database.js';
import type { RACIAssignment, RACIDelegation, RACIRole, Echelon } from './decision-types.js';
import { getDefaultsForEchelon } from './raci-defaults.js';

// ---------------------------------------------------------------------------
// Helper: map a DB row to RACIAssignment
// ---------------------------------------------------------------------------

function rowToAssignment(row: Record<string, unknown>): RACIAssignment {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    decision_type: row.decision_type as string,
    position: row.position as string,
    raci_role: row.raci_role as RACIRole,
    delegated_to: (row.delegated_to as string) ?? null,
    delegated_by: (row.delegated_by as string) ?? null,
    delegation_reason: (row.delegation_reason as string) ?? null,
    delegation_type: (row.delegation_type as 'permanent' | 'temporary') ?? null,
    delegation_expires_at: row.delegation_expires_at
      ? (row.delegation_expires_at as Date).toISOString()
      : null,
    version: row.version as number,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helper: map a DB row to RACIDelegation
// ---------------------------------------------------------------------------

function rowToDelegation(row: Record<string, unknown>): RACIDelegation {
  return {
    id: row.id as string,
    raci_assignment_id: row.raci_assignment_id as string,
    from_did: row.from_did as string,
    to_did: row.to_did as string,
    reason: row.reason as string,
    delegation_type: row.delegation_type as 'permanent' | 'temporary',
    expires_at: row.expires_at ? (row.expires_at as Date).toISOString() : null,
    created_at: (row.created_at as Date).toISOString(),
    revoked_at: row.revoked_at ? (row.revoked_at as Date).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// RACI Store
// ---------------------------------------------------------------------------

export const raciStore = {
  /**
   * Get all RACI assignments for a problem set.
   */
  async getByProblemSet(problemSetId: string): Promise<RACIAssignment[]> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT * FROM raci_assignments WHERE problem_set_id = $1 ORDER BY decision_type, position',
        [problemSetId],
      );
      return result.rows.map(rowToAssignment);
    } catch (err) {
      console.error('[raciStore] getByProblemSet error:', err);
      throw err;
    }
  },

  /**
   * Get all decisions a position is involved in for a problem set.
   */
  async getByPosition(problemSetId: string, position: string): Promise<RACIAssignment[]> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT * FROM raci_assignments WHERE problem_set_id = $1 AND position = $2 ORDER BY decision_type',
        [problemSetId, position],
      );
      return result.rows.map(rowToAssignment);
    } catch (err) {
      console.error('[raciStore] getByPosition error:', err);
      throw err;
    }
  },

  /**
   * Get who is R/A/C/I for a specific decision type in a problem set.
   */
  async getByDecisionType(problemSetId: string, decisionType: string): Promise<RACIAssignment[]> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT * FROM raci_assignments WHERE problem_set_id = $1 AND decision_type = $2 ORDER BY raci_role, position',
        [problemSetId, decisionType],
      );
      return result.rows.map(rowToAssignment);
    } catch (err) {
      console.error('[raciStore] getByDecisionType error:', err);
      throw err;
    }
  },

  /**
   * Get the Responsible (R) assignment for a decision type.
   */
  async getResponsible(problemSetId: string, decisionType: string): Promise<RACIAssignment | null> {
    const pool = getPool();
    try {
      const result = await pool.query(
        "SELECT * FROM raci_assignments WHERE problem_set_id = $1 AND decision_type = $2 AND raci_role = 'R' LIMIT 1",
        [problemSetId, decisionType],
      );
      return result.rows.length > 0 ? rowToAssignment(result.rows[0]) : null;
    } catch (err) {
      console.error('[raciStore] getResponsible error:', err);
      throw err;
    }
  },

  /**
   * Get the Accountable (A) assignment for a decision type.
   */
  async getAccountable(problemSetId: string, decisionType: string): Promise<RACIAssignment | null> {
    const pool = getPool();
    try {
      const result = await pool.query(
        "SELECT * FROM raci_assignments WHERE problem_set_id = $1 AND decision_type = $2 AND raci_role = 'A' LIMIT 1",
        [problemSetId, decisionType],
      );
      return result.rows.length > 0 ? rowToAssignment(result.rows[0]) : null;
    } catch (err) {
      console.error('[raciStore] getAccountable error:', err);
      throw err;
    }
  },

  /**
   * Create or update a RACI assignment.
   * Uses ON CONFLICT DO UPDATE to handle existing entries.
   */
  async upsert(
    problemSetId: string,
    decisionType: string,
    position: string,
    raciRole: RACIRole,
  ): Promise<RACIAssignment> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `INSERT INTO raci_assignments (problem_set_id, decision_type, position, raci_role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (problem_set_id, decision_type, position)
         DO UPDATE SET
           raci_role  = EXCLUDED.raci_role,
           version    = raci_assignments.version + 1,
           updated_at = NOW()
         RETURNING *`,
        [problemSetId, decisionType, position, raciRole],
      );
      return rowToAssignment(result.rows[0]);
    } catch (err) {
      console.error('[raciStore] upsert error:', err);
      throw err;
    }
  },

  /**
   * Delete a RACI assignment.
   */
  async remove(problemSetId: string, decisionType: string, position: string): Promise<void> {
    const pool = getPool();
    try {
      await pool.query(
        'DELETE FROM raci_assignments WHERE problem_set_id = $1 AND decision_type = $2 AND position = $3',
        [problemSetId, decisionType, position],
      );
    } catch (err) {
      console.error('[raciStore] remove error:', err);
      throw err;
    }
  },

  /**
   * Seed doctrinal defaults from JP 5-0 for a problem set.
   * Uses ON CONFLICT DO NOTHING — existing overrides are preserved.
   */
  async seedDefaults(problemSetId: string, echelon: Echelon): Promise<void> {
    const pool = getPool();
    const defaults = getDefaultsForEchelon(echelon);
    if (defaults.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const d of defaults) {
        await client.query(
          `INSERT INTO raci_assignments (problem_set_id, decision_type, position, raci_role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (problem_set_id, decision_type, position) DO NOTHING`,
          [problemSetId, d.decision_type, d.position, d.raci_role],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[raciStore] seedDefaults error:', err);
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Delegate a RACI assignment to another person.
   * Increments version, sets delegation fields, logs to raci_delegations.
   */
  async delegate(
    assignmentId: string,
    toDid: string,
    byDid: string,
    reason: string,
    type: 'permanent' | 'temporary',
    expiresAt?: string,
  ): Promise<RACIAssignment> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update the assignment with delegation fields
      const assignmentResult = await client.query(
        `UPDATE raci_assignments
         SET delegated_to           = $1,
             delegated_by           = $2,
             delegation_reason      = $3,
             delegation_type        = $4,
             delegation_expires_at  = $5,
             version                = version + 1,
             updated_at             = NOW()
         WHERE id = $6
         RETURNING *`,
        [toDid, byDid, reason, type, expiresAt ?? null, assignmentId],
      );

      if (assignmentResult.rows.length === 0) {
        throw new Error(`RACI assignment not found: ${assignmentId}`);
      }

      // Log to audit trail
      await client.query(
        `INSERT INTO raci_delegations
           (raci_assignment_id, from_did, to_did, reason, delegation_type, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [assignmentId, byDid, toDid, reason, type, expiresAt ?? null],
      );

      await client.query('COMMIT');
      return rowToAssignment(assignmentResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[raciStore] delegate error:', err);
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Revoke a delegation, restoring the original assignment.
   * Logs revocation to raci_delegations.
   */
  async revokeDelegation(assignmentId: string, byDid: string): Promise<RACIAssignment> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear delegation fields
      const assignmentResult = await client.query(
        `UPDATE raci_assignments
         SET delegated_to          = NULL,
             delegated_by          = NULL,
             delegation_reason     = NULL,
             delegation_type       = NULL,
             delegation_expires_at = NULL,
             version               = version + 1,
             updated_at            = NOW()
         WHERE id = $1
         RETURNING *`,
        [assignmentId],
      );

      if (assignmentResult.rows.length === 0) {
        throw new Error(`RACI assignment not found: ${assignmentId}`);
      }

      // Mark the most recent active delegation as revoked
      await client.query(
        `UPDATE raci_delegations
         SET revoked_at = NOW()
         WHERE raci_assignment_id = $1
           AND revoked_at IS NULL`,
        [assignmentId],
      );

      // Also log the revocation as a new audit entry (from → to reversed, revoked immediately)
      await client.query(
        `INSERT INTO raci_delegations
           (raci_assignment_id, from_did, to_did, reason, delegation_type, revoked_at)
         VALUES ($1, $2, $3, 'revocation', 'temporary', NOW())`,
        [assignmentId, byDid, byDid],
      );

      await client.query('COMMIT');
      return rowToAssignment(assignmentResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[raciStore] revokeDelegation error:', err);
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get the full delegation audit trail for an assignment.
   */
  async getDelegationHistory(assignmentId: string): Promise<RACIDelegation[]> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT * FROM raci_delegations WHERE raci_assignment_id = $1 ORDER BY created_at ASC',
        [assignmentId],
      );
      return result.rows.map(rowToDelegation);
    } catch (err) {
      console.error('[raciStore] getDelegationHistory error:', err);
      throw err;
    }
  },

  /**
   * Get all currently delegated assignments for a problem set.
   */
  async getActiveDelegations(problemSetId: string): Promise<RACIAssignment[]> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT * FROM raci_assignments WHERE problem_set_id = $1 AND delegated_to IS NOT NULL ORDER BY decision_type, position',
        [problemSetId],
      );
      return result.rows.map(rowToAssignment);
    } catch (err) {
      console.error('[raciStore] getActiveDelegations error:', err);
      throw err;
    }
  },

  /**
   * Revoke all expired temporary delegations.
   * Returns the number of delegations revoked.
   * Safe to call on startup and periodically.
   */
  async cleanExpiredDelegations(): Promise<number> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find all assignments with expired temporary delegations
      const expiredResult = await client.query(
        `SELECT id FROM raci_assignments
         WHERE delegation_type = 'temporary'
           AND delegation_expires_at IS NOT NULL
           AND delegation_expires_at < NOW()`,
      );

      const expiredIds: string[] = expiredResult.rows.map(
        (r: Record<string, unknown>) => r.id as string,
      );

      if (expiredIds.length === 0) {
        await client.query('COMMIT');
        return 0;
      }

      // Clear delegation fields on expired assignments
      await client.query(
        `UPDATE raci_assignments
         SET delegated_to          = NULL,
             delegated_by          = NULL,
             delegation_reason     = NULL,
             delegation_type       = NULL,
             delegation_expires_at = NULL,
             version               = version + 1,
             updated_at            = NOW()
         WHERE id = ANY($1::uuid[])`,
        [expiredIds],
      );

      // Mark audit entries as revoked
      await client.query(
        `UPDATE raci_delegations
         SET revoked_at = NOW()
         WHERE raci_assignment_id = ANY($1::uuid[])
           AND revoked_at IS NULL`,
        [expiredIds],
      );

      await client.query('COMMIT');
      return expiredIds.length;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[raciStore] cleanExpiredDelegations error:', err);
      throw err;
    } finally {
      client.release();
    }
  },
};
