/**
 * MDMP Safety Matrix Enforcer
 *
 * Enforces INVARIANT 8 (FullyDelegated scope restriction) and INVARIANT 9
 * (Safety matrix enforcement) across all MDMP activity executions.
 *
 * The safety matrix defines permitted authority ranges for each activity category.
 * This enforcer prevents activities from being assigned authority levels that exceed
 * the safe bounds defined in the safety matrix.
 *
 * CRITICAL: This is a governance safety layer. All activity authority assignments
 * must pass through safety matrix validation before execution.
 */

import {
  SAFETY_MATRIX,
  ActivityCategory,
  AuthorityDesignation,
  type SafetyMatrixEntry,
} from './types.js';

// ==========================================================================
// Validation Result Types
// ==========================================================================

/**
 * Result of authority assignment validation.
 */
export interface AuthorityValidationResult {
  /** Whether the assignment is valid */
  valid: boolean;
  /** Human-readable reason for validation outcome */
  reason: string;
  /** The matrix entry used for validation */
  matrixEntry: SafetyMatrixEntry;
  /** Requested authority level */
  requestedAuthority: AuthorityDesignation;
  /** Whether this violates INVARIANT 8 (FullyDelegated restriction) */
  violatesInvariant8: boolean;
  /** Whether this violates INVARIANT 9 (Safety matrix enforcement) */
  violatesInvariant9: boolean;
}

/**
 * Permitted authority range for a category.
 */
export interface PermittedAuthorityRange {
  /** Activity category */
  category: ActivityCategory;
  /** Maximum allowed authority */
  maxAuthority: AuthorityDesignation;
  /** Minimum allowed authority */
  minAuthority: AuthorityDesignation;
  /** Whether FullyDelegated (AI_AUTONOMOUS) is permitted */
  fullyDelegatedPermitted: boolean;
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Violation record for phase activity validation.
 */
export interface ActivityViolation {
  /** Activity ID that violates safety matrix */
  activityId: string;
  /** Activity category */
  category: ActivityCategory;
  /** Requested authority that violated matrix */
  requestedAuthority: AuthorityDesignation;
  /** What invariant was violated */
  invariantViolated: string;
  /** Human-readable reason */
  reason: string;
}

// ==========================================================================
// Authority Ordering
// ==========================================================================

/**
 * Authority rank mapping from designation to numeric rank.
 *
 * The AuthorityDesignation enum has two naming conventions (merged via
 * TypeScript enum merging in types.ts):
 *   - Military ranks: Individual, NCO, CompanyGrade, FieldGrade, GeneralOfficer
 *   - AI autonomy levels: AI_AUTONOMOUS, AI_PRIMARY, HYBRID_AI_LED, HYBRID_HUMAN_LED, HUMAN_ONLY
 *
 * Both map to the same 5-tier authority model (0 = least human control, 4 = most).
 */
const AUTHORITY_RANK: Map<string, number> = new Map([
  // Military rank values (used by SAFETY_MATRIX)
  [AuthorityDesignation.Individual, 0],
  [AuthorityDesignation.NCO, 1],
  [AuthorityDesignation.CompanyGrade, 2],
  [AuthorityDesignation.FieldGrade, 3],
  [AuthorityDesignation.GeneralOfficer, 4],
  // AI autonomy values (used by activity registry)
  [AuthorityDesignation.AI_AUTONOMOUS, 0],
  [AuthorityDesignation.AI_PRIMARY, 1],
  [AuthorityDesignation.HYBRID_AI_LED, 2],
  [AuthorityDesignation.HYBRID_HUMAN_LED, 3],
  [AuthorityDesignation.HUMAN_ONLY, 4],
]);

/**
 * Get numeric rank for authority level (0 = least human control, 4 = most).
 */
function getAuthorityRank(authority: AuthorityDesignation): number {
  const rank = AUTHORITY_RANK.get(authority);
  if (rank === undefined) {
    throw new Error(`Unknown authority designation: ${authority}`);
  }
  return rank;
}

/**
 * Check if requested authority is within permitted range.
 */
function isWithinRange(
  requested: AuthorityDesignation,
  min: AuthorityDesignation,
  max: AuthorityDesignation
): boolean {
  const requestedRank = getAuthorityRank(requested);
  const minRank = getAuthorityRank(min);
  const maxRank = getAuthorityRank(max);
  return requestedRank >= minRank && requestedRank <= maxRank;
}

// ==========================================================================
// Safety Matrix Enforcer
// ==========================================================================

/**
 * Safety Matrix Enforcer for MDMP governance.
 *
 * Validates all authority assignments against the safety matrix defined in types.ts.
 * Enforces INVARIANT 8 (FullyDelegated restriction) and INVARIANT 9 (matrix enforcement).
 */
export class SafetyMatrixEnforcer {
  private matrixCache: Map<ActivityCategory, SafetyMatrixEntry>;

  constructor() {
    // Build fast lookup cache
    this.matrixCache = new Map();
    for (const entry of SAFETY_MATRIX) {
      this.matrixCache.set(entry.category, entry);
    }
  }

  /**
   * Validate an authority assignment for a given activity category.
   *
   * INVARIANT 8: FullyDelegated (AI_AUTONOMOUS) only permitted for 4 categories:
   *   DataAggregation, ValidationConsistency, Monitoring, MetaCognitive
   *
   * INVARIANT 9: All activities must respect the min/max authority bounds
   *   and control posture requirements from SAFETY_MATRIX.
   *
   * @param category - Activity category from MDMP activity registry
   * @param requestedAuthority - Proposed authority level
   * @returns Validation result with detailed reasoning
   */
  validateAuthorityAssignment(
    category: ActivityCategory,
    requestedAuthority: AuthorityDesignation
  ): AuthorityValidationResult {
    const matrixEntry = this.matrixCache.get(category);

    if (!matrixEntry) {
      return {
        valid: false,
        reason: `Activity category ${category} not found in safety matrix`,
        matrixEntry: null as any,
        requestedAuthority,
        violatesInvariant8: false,
        violatesInvariant9: true,
      };
    }

    // Check INVARIANT 9: Authority within permitted range
    const withinRange = isWithinRange(
      requestedAuthority,
      matrixEntry.minAuthority,
      matrixEntry.maxAuthority
    );

    if (!withinRange) {
      // Distinguish INVARIANT 8 (FullyDelegated restriction) from INVARIANT 9 (general range)
      // If the requested authority is below minimum for a non-fully-delegated category,
      // that's an attempt at excessive autonomy → INVARIANT 8
      const requestedRank = getAuthorityRank(requestedAuthority);
      const minRank = getAuthorityRank(matrixEntry.minAuthority);
      const isInvariant8 = !matrixEntry.permitsFullyDelegated && requestedRank < minRank;

      return {
        valid: false,
        reason: isInvariant8
          ? `INVARIANT 8 VIOLATION: Authority ${requestedAuthority} is below minimum ${matrixEntry.minAuthority} for ${category}. FullyDelegated only permitted for: DataAggregation, ValidationConsistency, Monitoring, MetaCognitive.`
          : `INVARIANT 9 VIOLATION: Authority ${requestedAuthority} outside permitted range [${matrixEntry.minAuthority}, ${matrixEntry.maxAuthority}] for ${category}`,
        matrixEntry,
        requestedAuthority,
        violatesInvariant8: isInvariant8,
        violatesInvariant9: !isInvariant8,
      };
    }

    // Check human-in-loop requirement
    if (matrixEntry.requiresHumanInLoop) {
      const requestedRank = getAuthorityRank(requestedAuthority);
      const maxRank = getAuthorityRank(matrixEntry.maxAuthority);
      if (requestedRank < maxRank) {
        return {
          valid: false,
          reason: `INVARIANT 9 VIOLATION: ${category} requires human-in-loop. Minimum authority: ${matrixEntry.maxAuthority}.`,
          matrixEntry,
          requestedAuthority,
          violatesInvariant8: false,
          violatesInvariant9: true,
        };
      }
    }

    // Valid assignment
    return {
      valid: true,
      reason: `Authority ${requestedAuthority} is within permitted range [${matrixEntry.minAuthority}, ${matrixEntry.maxAuthority}] for ${category}`,
      matrixEntry,
      requestedAuthority,
      violatesInvariant8: false,
      violatesInvariant9: false,
    };
  }

  /**
   * Get the permitted authority range for an activity category.
   *
   * @param category - Activity category
   * @returns Permitted range with explanation
   */
  getPermittedRange(category: ActivityCategory): PermittedAuthorityRange {
    const matrixEntry = this.matrixCache.get(category);

    if (!matrixEntry) {
      return {
        category,
        maxAuthority: AuthorityDesignation.HUMAN_ONLY,
        minAuthority: AuthorityDesignation.HUMAN_ONLY,
        fullyDelegatedPermitted: false,
        explanation: `Category ${category} not found in safety matrix. Defaulting to HUMAN_ONLY.`,
      };
    }

    let explanation = `${category} permits authority from ${matrixEntry.minAuthority} to ${matrixEntry.maxAuthority}.`;
    if (matrixEntry.permitsFullyDelegated) {
      explanation += ' FullyDelegated (AI_AUTONOMOUS) is permitted.';
    }
    if (matrixEntry.requiresHumanInLoop) {
      explanation += ' HUMAN_ONLY required (human-in-loop category).';
    }

    return {
      category,
      maxAuthority: matrixEntry.maxAuthority,
      minAuthority: matrixEntry.minAuthority,
      fullyDelegatedPermitted: matrixEntry.permitsFullyDelegated,
      explanation,
    };
  }

  /**
   * Validate all activities in a phase with their authority overrides.
   *
   * Used during phase transitions to ensure no safety violations exist.
   *
   * @param phase - MDMP phase being validated
   * @param activityOverrides - Map of activityId -> proposed authority
   * @returns Array of violations (empty if all valid)
   */
  validatePhaseActivities(
    phase: string,
    activityOverrides: Map<string, { category: ActivityCategory; authority: AuthorityDesignation }>
  ): ActivityViolation[] {
    const violations: ActivityViolation[] = [];

    for (const [activityId, override] of activityOverrides.entries()) {
      const validationResult = this.validateAuthorityAssignment(
        override.category,
        override.authority
      );

      if (!validationResult.valid) {
        violations.push({
          activityId,
          category: override.category,
          requestedAuthority: override.authority,
          invariantViolated: validationResult.violatesInvariant8
            ? 'INVARIANT 8 (FullyDelegated Restriction)'
            : 'INVARIANT 9 (Safety Matrix Enforcement)',
          reason: validationResult.reason,
        });
      }
    }

    return violations;
  }

  /**
   * Get summary statistics for the safety matrix.
   */
  getSafetyMatrixSummary(): {
    totalCategories: number;
    fullyDelegatedPermitted: number;
    humanInLoopRequired: number;
    byControlPosture: Record<string, number>;
  } {
    const summary = {
      totalCategories: SAFETY_MATRIX.length,
      fullyDelegatedPermitted: 0,
      humanInLoopRequired: 0,
      byControlPosture: {} as Record<string, number>,
    };

    for (const entry of SAFETY_MATRIX) {
      if (entry.permitsFullyDelegated) summary.fullyDelegatedPermitted++;
      if (entry.requiresHumanInLoop) summary.humanInLoopRequired++;

      const posture = entry.controlPosture;
      summary.byControlPosture[posture] = (summary.byControlPosture[posture] || 0) + 1;
    }

    return summary;
  }
}

// ==========================================================================
// Export Singleton
// ==========================================================================

/**
 * Singleton safety enforcer instance.
 */
export const safetyEnforcer = new SafetyMatrixEnforcer();
