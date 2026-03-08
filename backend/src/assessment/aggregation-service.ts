/**
 * Aggregation Service
 *
 * Phase 37 Plan 02: Runs when an AAR is finalized to propagate T/P/U
 * ratings upward through the problem set hierarchy and check reframing triggers.
 *
 * The strategic dashboard queries across the hierarchy using sourceProblemSetId,
 * so no duplicate records are needed -- the latest rating at the tactical level
 * IS the authoritative rating.
 */

import { aarStructuredStore } from './aar-structured-store.js';
import { metlStore } from './metl-store.js';
import { moeStore } from './moe-store.js';
import { mopStore } from './mop-store.js';
import { decayService } from './decay-service.js';
import { getPool } from '../lib/database.js';

class AggregationService {
  /**
   * Propagate ratings after AAR finalization.
   *
   * 1. Gets the AAR and its METL assessments
   * 2. Verifies the tactical-level assessment is recorded
   * 3. Resets decay timers for all assessed METL tasks
   *
   * The strategic dashboard already aggregates via sourceProblemSetId in
   * metlStore.getLatestProficiency, so no duplicate records are created.
   */
  async propagateRatings(aarId: string): Promise<void> {
    // 1. Get the AAR
    const aar = await aarStructuredStore.getById(aarId);
    if (!aar) {
      throw new Error(`AAR ${aarId} not found`);
    }

    if (aar.status !== 'finalized') {
      throw new Error(`AAR ${aarId} is not finalized`);
    }

    // 2. Get all METL assessments linked to this AAR
    const assessments = await metlStore.getAssessmentsByAAR(aarId);
    if (assessments.length === 0) {
      console.log(`[aggregation] No METL assessments linked to AAR ${aarId}, skipping propagation`);
      return;
    }

    // 3. Check for parent problem sets in the hierarchy
    const pool = getPool();
    const psResult = await pool.query(
      'SELECT parent_problem_set_id FROM problem_sets WHERE id = $1',
      [aar.problemSetId],
    );

    if (psResult.rows.length > 0 && psResult.rows[0].parent_problem_set_id) {
      const parentId = psResult.rows[0].parent_problem_set_id as string;
      console.log(
        `[aggregation] AAR ${aarId}: ${assessments.length} assessment(s) at tactical level ` +
        `(problem set ${aar.problemSetId}), parent: ${parentId}`,
      );

      // Check for strategic (grandparent) level
      const grandparentResult = await pool.query(
        'SELECT parent_problem_set_id FROM problem_sets WHERE id = $1',
        [parentId],
      );

      if (grandparentResult.rows.length > 0 && grandparentResult.rows[0].parent_problem_set_id) {
        const strategicId = grandparentResult.rows[0].parent_problem_set_id as string;
        console.log(`[aggregation] Strategic level detected: ${strategicId}`);
      }
    }

    // 4. Reset decay timers for all assessed METL task IDs
    const taskIds = Array.from(new Set(assessments.map((a) => a.metlTaskId)));
    await decayService.resetTimers(taskIds);

    console.log(
      `[aggregation] Propagation complete for AAR ${aarId}: ` +
      `${assessments.length} assessment(s), ${taskIds.length} task timer(s) reset`,
    );
  }

  /**
   * Check if reframing should be triggered for a problem set.
   *
   * Thresholds:
   * - 2+ declining MOEs, OR
   * - 3+ red MOPs
   *
   * Returns true if reframing suggestion should fire.
   * Actual gate creation will be wired in Plan 06.
   */
  async checkReframingTrigger(problemSetId: string): Promise<boolean> {
    // Get MOEs and MOPs for the problem set
    const moes = await moeStore.listByProblemSet(problemSetId);
    const mops = await mopStore.listByProblemSet(problemSetId);

    // Count declining MOEs
    const decliningMOEs = moes.filter((m) => m.trend === 'declining').length;

    // Count red MOPs
    const redMOPs = mops.filter((m) => m.status === 'red').length;

    const shouldTrigger = decliningMOEs >= 2 || redMOPs >= 3;

    if (shouldTrigger) {
      console.log(
        `[aggregation] Reframing trigger FIRED for problem set ${problemSetId}: ` +
        `${decliningMOEs} declining MOE(s), ${redMOPs} red MOP(s)`,
      );
    }

    return shouldTrigger;
  }
}

// Singleton export
export const aggregationService = new AggregationService();
