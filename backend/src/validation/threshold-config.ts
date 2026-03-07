/**
 * Threshold Configuration with Scope Hierarchy
 *
 * Phase 31 Plan 01: Resolves validation thresholds using scope hierarchy
 * (agent > team > category > global) with hardcoded fallback defaults.
 */

import type { ValidationCategory, ThresholdConfigRow } from './validation-types.js';
import { validationStore } from './validation-store.js';

// ---------------------------------------------------------------------------
// Hardcoded fallback defaults (used when no DB thresholds exist)
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS: Record<
  string,
  {
    warningThreshold: number;
    criticalThreshold: number;
    gracePeriodRuns: number;
    immediateDisable: boolean;
  }
> = {
  determinism: {
    warningThreshold: 0.7,
    criticalThreshold: 0.5,
    gracePeriodRuns: 3,
    immediateDisable: false,
  },
  reliability: {
    warningThreshold: 0.7,
    criticalThreshold: 0.5,
    gracePeriodRuns: 3,
    immediateDisable: false,
  },
  authority: {
    warningThreshold: 0.7,
    criticalThreshold: 0.5,
    gracePeriodRuns: 3,
    immediateDisable: true, // authority violations default to immediate disable
  },
};

// ---------------------------------------------------------------------------
// Resolved threshold type
// ---------------------------------------------------------------------------

export interface ResolvedThreshold {
  warningThreshold: number;
  criticalThreshold: number;
  gracePeriodRuns: number;
  immediateDisable: boolean;
}

// ---------------------------------------------------------------------------
// Scope hierarchy resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective threshold for a given agent and category.
 *
 * Priority (highest to lowest):
 *   1. Agent-specific (scope_type='agent', scope_id=agentId)
 *   2. Team-specific  (scope_type='team',  scope_id=teamId) -- requires teamId
 *   3. Category-level  (scope_type='category', category matches)
 *   4. Global          (scope_type='global')
 *   5. Hardcoded defaults
 */
export async function getThresholdForAgent(
  agentId: string,
  category: ValidationCategory,
  teamId?: string,
): Promise<ResolvedThreshold> {
  // Fetch all thresholds matching this category from DB
  const allThresholds = await validationStore.getThresholds();
  const matching = allThresholds.filter((t) => t.category === category);

  // Try agent-specific
  const agentSpecific = matching.find(
    (t) => t.scope_type === 'agent' && t.scope_id === agentId,
  );
  if (agentSpecific) return toResolved(agentSpecific);

  // Try team-specific
  if (teamId) {
    const teamSpecific = matching.find(
      (t) => t.scope_type === 'team' && t.scope_id === teamId,
    );
    if (teamSpecific) return toResolved(teamSpecific);
  }

  // Try category-level
  const categoryLevel = matching.find((t) => t.scope_type === 'category');
  if (categoryLevel) return toResolved(categoryLevel);

  // Try global
  const globalLevel = matching.find((t) => t.scope_type === 'global');
  if (globalLevel) return toResolved(globalLevel);

  // Fallback to hardcoded defaults
  return DEFAULT_THRESHOLDS[category] ?? DEFAULT_THRESHOLDS.reliability;
}

function toResolved(row: ThresholdConfigRow): ResolvedThreshold {
  return {
    warningThreshold: row.warning_threshold,
    criticalThreshold: row.critical_threshold,
    gracePeriodRuns: row.grace_period_runs,
    immediateDisable: row.immediate_disable,
  };
}

// ---------------------------------------------------------------------------
// Seed defaults
// ---------------------------------------------------------------------------

/**
 * Insert global default thresholds for all 3 categories if none exist.
 * Idempotent -- uses ON CONFLICT DO NOTHING via upsertThreshold.
 */
export async function seedDefaultThresholds(): Promise<void> {
  const categories = ['determinism', 'reliability', 'authority'] as const;

  for (const category of categories) {
    const defaults = DEFAULT_THRESHOLDS[category];
    await validationStore.upsertThreshold({
      scope_type: 'global',
      scope_id: null,
      category,
      warning_threshold: defaults.warningThreshold,
      critical_threshold: defaults.criticalThreshold,
      grace_period_runs: defaults.gracePeriodRuns,
      immediate_disable: defaults.immediateDisable,
      updated_by: 'system',
    });
  }
}
