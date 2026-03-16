/**
 * Confidence Calculator
 *
 * Pure utility functions for computing confidence values in the semantic
 * knowledge graph. All functions are stateless and have no side effects.
 *
 * Implements the locked formulas from Phase 47 CONTEXT.md:
 * - Decay: conf(t) = conf_0 * 2^(-t/half_life)
 * - Fusion: conf = 1 - prod(1 - w_i)
 */

import type { SourceMethod } from './provenance-types.js';

// ============================================================================
// Source Reliability Weights
// ============================================================================

/**
 * Default base reliability weights by source method.
 * Mirrors the military intelligence reliability rating system (A-F / 1-6).
 * These weights are configurable per workspace — these are defaults.
 */
export const SOURCE_WEIGHTS: Record<SourceMethod, number> = {
  manual_entry:     0.95,
  sigint:           0.90,
  doc_intelligence: 0.75,
  vision_pipeline:  0.70,
  osint:            0.65,
  ai_inference:     0.60,
};

// ============================================================================
// Half-Life Defaults by Fact Type
// ============================================================================

/**
 * Default half-life in days for confidence decay, by fact category.
 * Used when an entity does not have an explicit halfLifeDays value.
 *
 * These are configurable per workspace — these are defaults.
 */
export const HALF_LIFE_DEFAULTS: Record<string, number> = {
  personnel:   180,
  capability:  365,
  political:    90,
  geographic: 1825,
  economic:    365,
};

// ============================================================================
// Confidence Decay
// ============================================================================

/**
 * Compute confidence at a given point in time using the exponential decay formula:
 *   conf(t) = conf_0 * 2^(-t/half_life)
 *
 * This is a pure function computed on read — no stored updates required.
 * Re-confirmation (updating lastAssertedAt) resets the clock.
 *
 * @param baseConfidence  - Initial confidence value (0-1) at time of assertion
 * @param lastAssertedAt  - Date when the assertion was last confirmed/asserted
 * @param halfLifeDays    - Half-life in days for this fact type
 * @param atTime          - Point in time to compute confidence at (default: now)
 * @returns               - Decayed confidence value (0-1)
 */
export function computeDecayedConfidence(
  baseConfidence: number,
  lastAssertedAt: Date,
  halfLifeDays: number,
  atTime: Date = new Date(),
): number {
  const ageMs = atTime.getTime() - lastAssertedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return baseConfidence * Math.pow(0.5, ageDays / halfLifeDays);
}

// ============================================================================
// Multi-Source Confidence Fusion
// ============================================================================

/**
 * Fuse confidence values from multiple independent sources using the
 * complement product formula:
 *   conf = 1 - prod(1 - w_i)
 *
 * This models the probability that at least one of the independent sources
 * is correct. Sources are weighted by their reliability.
 *
 * Example: manual_entry (0.95) + osint (0.65)
 *   conf = 1 - (1-0.95)(1-0.65) = 1 - 0.05 * 0.35 = 1 - 0.0175 = 0.9825
 *
 * @param weights - Array of source reliability weights (0-1) to fuse
 * @returns       - Fused confidence value (0-1)
 */
export function fuseConfidence(weights: number[]): number {
  if (weights.length === 0) return 0;
  const complement = weights.reduce((acc, w) => acc * (1 - w), 1);
  return 1 - complement;
}
