/**
 * Confidence Threshold Evaluation
 *
 * Phase 21 Plan 05: Evaluates entity linkage confidence scores to determine
 * whether a linkage should be auto-committed or queued for human review.
 *
 * Per user decision: threshold of 0.85 with inclusive comparison.
 * Linkages >= threshold auto-commit; below threshold need human review.
 */

// ─── Constants ─────────────────────────────────────────────────────────────

/** Default confidence threshold for auto-commit vs human review (inclusive). */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.85;

// ─── Types ─────────────────────────────────────────────────────────────────

/**
 * Configuration for confidence evaluation.
 * Supports global threshold and per-workspace overrides.
 */
export interface ConfidenceConfig {
  /** Global confidence threshold (default: 0.85) */
  threshold: number;
  /** Per-workspace threshold overrides keyed by workspace ID */
  workspaceOverride?: Record<string, number>;
}

/**
 * Result of confidence evaluation for a single linkage.
 */
export interface ConfidenceResult {
  /** Whether the linkage should be auto-committed */
  autoCommit: boolean;
  /** Whether the linkage needs human review */
  needsReview: boolean;
  /** The evaluated confidence score */
  confidence: number;
  /** The threshold that was applied */
  threshold: number;
}

// ─── Evaluation ────────────────────────────────────────────────────────────

/**
 * Evaluate a confidence score against the threshold.
 *
 * @param confidence - The confidence score (0-1) for the entity linkage
 * @param config - Optional partial configuration (defaults to DEFAULT_CONFIDENCE_THRESHOLD)
 * @returns Evaluation result with autoCommit and needsReview flags
 *
 * @example
 * evaluateConfidence(0.90)              // { autoCommit: true, needsReview: false, ... }
 * evaluateConfidence(0.80)              // { autoCommit: false, needsReview: true, ... }
 * evaluateConfidence(0.85)              // { autoCommit: true, needsReview: false, ... } (inclusive)
 * evaluateConfidence(0.70, { threshold: 0.70 }) // { autoCommit: true, ... }
 */
export function evaluateConfidence(
  confidence: number,
  config?: Partial<ConfidenceConfig>,
): ConfidenceResult {
  const threshold = config?.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const autoCommit = confidence >= threshold;

  return {
    autoCommit,
    needsReview: !autoCommit,
    confidence,
    threshold,
  };
}
