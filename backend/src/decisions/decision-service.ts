/**
 * Decision Service
 *
 * Phase 53 Plan 04: Business logic layer over decision and RACI stores.
 * Enforces RACI roles, auto-seeds defaults, and provides dashboard summary.
 *
 * Sits between the REST API (decisions.ts) and the raw stores (raci-store, decision-store).
 */

import { getPool } from '../lib/database.js';
import { raciStore } from './raci-store.js';
import { decisionStore } from './decision-store.js';
import type { RACIAssignment, Decision, RACIRole, DecisionStatus, Echelon } from './decision-types.js';

// ---------------------------------------------------------------------------
// Decision Service
// ---------------------------------------------------------------------------

export class DecisionService {
  /**
   * Get RACI matrix for a problem set. Auto-seeds defaults if empty.
   * Echelon is read from problem set metadata (default: 'operational').
   */
  async getRACIMatrix(problemSetId: string): Promise<RACIAssignment[]> {
    let assignments = await raciStore.getByProblemSet(problemSetId);

    if (assignments.length === 0) {
      // Determine echelon from problem_sets table
      const echelon = await this._getProblemSetEchelon(problemSetId);
      await raciStore.seedDefaults(problemSetId, echelon);
      assignments = await raciStore.getByProblemSet(problemSetId);
    }

    return assignments;
  }

  /**
   * Get all decisions a specific position needs to act on.
   * Queries RACI for position's R/A assignments, then finds pending decisions of those types.
   */
  async getPendingForPosition(problemSetId: string, position: string): Promise<Decision[]> {
    const positionAssignments = await raciStore.getByPosition(problemSetId, position);

    // Filter to R (Responsible) and A (Accountable) roles — these are action roles
    const actionTypes = positionAssignments
      .filter((a) => a.raci_role === 'R' || a.raci_role === 'A')
      .map((a) => a.decision_type);

    if (actionTypes.length === 0) {
      return [];
    }

    // Get all pending decisions and filter to relevant types
    const pendingDecisions = await decisionStore.getPending(problemSetId);
    return pendingDecisions.filter((d) => actionTypes.includes(d.decision_type));
  }

  /**
   * Create a new decision request.
   * Validates decision_type exists in RACI matrix.
   */
  async createDecision(params: {
    problem_set_id: string;
    decision_type: string;
    title: string;
    description?: string;
    context_json?: Record<string, unknown>;
    requested_by?: string;
  }): Promise<Decision> {
    // Ensure RACI matrix is seeded and decision_type is known
    const matrix = await this.getRACIMatrix(params.problem_set_id);
    const typeExists = matrix.some((a) => a.decision_type === params.decision_type);

    if (!typeExists) {
      throw new Error(
        `Unknown decision_type '${params.decision_type}' for problem set ${params.problem_set_id}`,
      );
    }

    return decisionStore.create(params);
  }

  /**
   * Process a decision action (approve/reject/defer/request info).
   * Validates that the acting user's position has R or A role for this decision type.
   * Returns updated decision.
   */
  async actOnDecision(
    decisionId: string,
    action: DecisionStatus,
    actorDid: string,
    actorPosition: string,
  ): Promise<Decision> {
    const decision = await decisionStore.getById(decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    // Check actor has R or A role for this decision type
    const positionAssignments = await raciStore.getByPosition(
      decision.problem_set_id,
      actorPosition,
    );

    const hasAuthority = positionAssignments.some(
      (a) =>
        a.decision_type === decision.decision_type &&
        (a.raci_role === 'R' || a.raci_role === 'A'),
    );

    if (!hasAuthority) {
      throw new Error(
        `Position '${actorPosition}' does not have Responsible or Accountable role for decision type '${decision.decision_type}'`,
      );
    }

    return decisionStore.updateStatus(decisionId, action, actorDid);
  }

  /**
   * Update RACI assignment. Only commander/xo positions can modify.
   * RACI changes themselves should go through a decision gate (future — for now, direct update).
   */
  async updateRACIAssignment(
    problemSetId: string,
    decisionType: string,
    position: string,
    raciRole: RACIRole,
    actorPosition: string,
  ): Promise<RACIAssignment> {
    const authorizedPositions = ['commander', 'xo'];
    if (!authorizedPositions.includes(actorPosition.toLowerCase())) {
      throw new Error(
        `Only commander or xo may modify RACI assignments. Actor position: '${actorPosition}'`,
      );
    }

    return raciStore.upsert(problemSetId, decisionType, position, raciRole);
  }

  /**
   * Get decisions summary for dashboard display.
   * Returns counts by status and list of recent decisions.
   */
  async getDashboardSummary(problemSetId: string): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    deferred: number;
    info_requested: number;
    recent: Decision[];
  }> {
    const allDecisions = await decisionStore.getByProblemSet(problemSetId);

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      deferred: 0,
      info_requested: 0,
    };

    for (const d of allDecisions) {
      if (d.status in counts) {
        counts[d.status as keyof typeof counts]++;
      }
    }

    // Return most recent 20 decisions
    const recent = allDecisions.slice(0, 20);

    return { ...counts, recent };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Look up the echelon for a problem set. Defaults to 'operational' if not found.
   */
  private async _getProblemSetEchelon(problemSetId: string): Promise<Echelon> {
    try {
      const pool = getPool();
      const result = await pool.query(
        'SELECT echelon FROM problem_sets WHERE id = $1 LIMIT 1',
        [problemSetId],
      );
      if (result.rows.length > 0 && result.rows[0].echelon) {
        return result.rows[0].echelon as Echelon;
      }
    } catch (err) {
      console.warn('[decisionService] Could not read problem set echelon, defaulting to operational:', err);
    }
    return 'operational';
  }
}

export const decisionService = new DecisionService();
