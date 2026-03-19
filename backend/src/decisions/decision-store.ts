/**
 * Decision PostgreSQL Store
 *
 * Phase 53 Plan 02: CRUD operations for decisions.
 * Uses getPool() pattern consistent with other stores in the project.
 *
 * Decisions flow through the RACI matrix to determine routing.
 * Each decision can be linked to a DAO proposal for on-chain governance.
 */

import { getPool } from '../lib/database.js';
import type { Decision, DecisionStatus } from './decision-types.js';

// ---------------------------------------------------------------------------
// Helper: map a DB row to Decision
// ---------------------------------------------------------------------------

function rowToDecision(row: Record<string, unknown>): Decision {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    decision_type: row.decision_type as string,
    title: row.title as string,
    description: row.description as string,
    context_json: (row.context_json as Record<string, unknown>) ?? {},
    status: row.status as DecisionStatus,
    decided_by: (row.decided_by as string) ?? null,
    decided_at: row.decided_at ? (row.decided_at as Date).toISOString() : null,
    requested_by: (row.requested_by as string) ?? null,
    dao_proposal_id: (row.dao_proposal_id as number) ?? null,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Create Params type
// ---------------------------------------------------------------------------

interface CreateDecisionParams {
  problem_set_id: string;
  decision_type: string;
  title: string;
  description?: string;
  context_json?: Record<string, unknown>;
  requested_by?: string;
}

// ---------------------------------------------------------------------------
// Decision Store
// ---------------------------------------------------------------------------

export const decisionStore = {
  /**
   * Create a new decision record.
   */
  async create(params: CreateDecisionParams): Promise<Decision> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `INSERT INTO decisions
           (problem_set_id, decision_type, title, description, context_json, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          params.problem_set_id,
          params.decision_type,
          params.title,
          params.description ?? '',
          JSON.stringify(params.context_json ?? {}),
          params.requested_by ?? null,
        ],
      );
      return rowToDecision(result.rows[0]);
    } catch (err) {
      console.error('[decisionStore] create error:', err);
      throw err;
    }
  },

  /**
   * Get a decision by ID.
   */
  async getById(id: string): Promise<Decision | null> {
    const pool = getPool();
    try {
      const result = await pool.query('SELECT * FROM decisions WHERE id = $1', [id]);
      return result.rows.length > 0 ? rowToDecision(result.rows[0]) : null;
    } catch (err) {
      console.error('[decisionStore] getById error:', err);
      throw err;
    }
  },

  /**
   * Get decisions for a problem set, with optional filters.
   * Ordered by created_at DESC.
   */
  async getByProblemSet(
    problemSetId: string,
    filters?: { status?: DecisionStatus; decision_type?: string },
  ): Promise<Decision[]> {
    const pool = getPool();
    try {
      const conditions: string[] = ['problem_set_id = $1'];
      const values: unknown[] = [problemSetId];
      let paramIndex = 2;

      if (filters?.status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(filters.status);
        paramIndex++;
      }

      if (filters?.decision_type) {
        conditions.push(`decision_type = $${paramIndex}`);
        values.push(filters.decision_type);
      }

      const sql = `SELECT * FROM decisions WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
      const result = await pool.query(sql, values);
      return result.rows.map(rowToDecision);
    } catch (err) {
      console.error('[decisionStore] getByProblemSet error:', err);
      throw err;
    }
  },

  /**
   * Get all pending decisions for a problem set.
   * Shortcut for getByProblemSet(id, { status: 'pending' }).
   */
  async getPending(problemSetId: string): Promise<Decision[]> {
    const pool = getPool();
    try {
      const result = await pool.query(
        "SELECT * FROM decisions WHERE problem_set_id = $1 AND status = 'pending' ORDER BY created_at DESC",
        [problemSetId],
      );
      return result.rows.map(rowToDecision);
    } catch (err) {
      console.error('[decisionStore] getPending error:', err);
      throw err;
    }
  },

  /**
   * Update the status of a decision.
   * Sets status, decided_by, and decided_at = NOW().
   */
  async updateStatus(id: string, status: DecisionStatus, decidedBy: string): Promise<Decision> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `UPDATE decisions
         SET status     = $1,
             decided_by = $2,
             decided_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, decidedBy, id],
      );
      if (result.rows.length === 0) {
        throw new Error(`Decision not found: ${id}`);
      }
      return rowToDecision(result.rows[0]);
    } catch (err) {
      console.error('[decisionStore] updateStatus error:', err);
      throw err;
    }
  },

  /**
   * Link a DAO proposal to a decision.
   * Called after a DAO proposal is created on-chain.
   */
  async linkDaoProposal(id: string, proposalId: number): Promise<void> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'UPDATE decisions SET dao_proposal_id = $1, updated_at = NOW() WHERE id = $2',
        [proposalId, id],
      );
      if (result.rowCount === 0) {
        throw new Error(`Decision not found: ${id}`);
      }
    } catch (err) {
      console.error('[decisionStore] linkDaoProposal error:', err);
      throw err;
    }
  },
};
