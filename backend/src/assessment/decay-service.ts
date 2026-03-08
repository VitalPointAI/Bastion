/**
 * Decay Service
 *
 * Phase 37 Plan 02: Computes proficiency decay status from assessed_at timestamps
 * and per-task configurable decay thresholds. Decay is computed on read -- there
 * is no background worker or separate timer table.
 */

import { metlStore } from './metl-store.js';
import type { DecayStatus, METLProficiencySummary } from './types.js';

/** Decay report entry with days remaining calculation */
export interface DecayReportEntry {
  metlTaskId: string;
  taskName: string;
  rating: string;
  decayStatus: DecayStatus;
  daysRemaining: number;
}

class DecayService {
  /**
   * Compute decay status from an assessment date and a decay threshold.
   *
   * - null assessedAt => 'expired' (never assessed)
   * - elapsed > decayDays => 'expired'
   * - elapsed > decayDays * 0.75 => 'warning'
   * - otherwise => 'current'
   */
  computeDecayStatus(assessedAt: Date | null, decayDays: number): DecayStatus {
    if (!assessedAt) {
      return 'expired';
    }

    const now = new Date();
    const elapsedMs = now.getTime() - assessedAt.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

    if (elapsedDays > decayDays) {
      return 'expired';
    }

    if (elapsedDays > decayDays * 0.75) {
      return 'warning';
    }

    return 'current';
  }

  /**
   * Reset decay timers for the given METL task IDs.
   *
   * Since decay is computed on read from assessed_at, the most recent
   * assessment's assessed_at IS the timer. This method exists as a hook
   * for future notification clearing.
   */
  async resetTimers(metlTaskIds: string[]): Promise<void> {
    if (metlTaskIds.length === 0) return;

    console.log(
      `[decay] Timers reset for ${metlTaskIds.length} METL task(s): ` +
      metlTaskIds.join(', '),
    );
  }

  /**
   * Get a decay report for all METL tasks in a strategic problem set hierarchy.
   *
   * Uses metlStore.getLatestProficiency to get current state, then enriches
   * each entry with a daysRemaining calculation.
   */
  async getDecayReport(sourceProblemSetId: string): Promise<DecayReportEntry[]> {
    const proficiencies = await metlStore.getLatestProficiency(sourceProblemSetId);

    return proficiencies.map((p: METLProficiencySummary) => {
      const daysRemaining = this.computeDaysRemaining(p.assessedAt ?? null, p.decayDays);

      return {
        metlTaskId: p.metlTaskId,
        taskName: p.taskName,
        rating: p.rating ?? 'U',
        decayStatus: p.decayStatus,
        daysRemaining,
      };
    });
  }

  /**
   * Compute days remaining before proficiency expires.
   * Returns 0 if already expired, negative values not returned.
   */
  private computeDaysRemaining(assessedAt: Date | null, decayDays: number): number {
    if (!assessedAt) {
      return 0;
    }

    const now = new Date();
    const elapsedMs = now.getTime() - assessedAt.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const remaining = decayDays - elapsedDays;

    return Math.max(0, Math.round(remaining));
  }
}

// Singleton export
export const decayService = new DecayService();
