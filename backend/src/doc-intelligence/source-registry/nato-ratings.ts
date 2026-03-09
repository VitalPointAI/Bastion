/**
 * NATO Admiralty System (STANAG 2511 / AJP-2.1 Edition B)
 *
 * Source reliability (A-F) and information credibility (1-6) ratings
 * used throughout the document intelligence pipeline for standardized
 * trust evaluation.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * NATO Source Reliability rating: A through F.
 */
export const SourceReliabilitySchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F']).describe(
  'NATO Source Reliability: A=Completely Reliable, B=Usually Reliable, ' +
  'C=Fairly Reliable, D=Not Usually Reliable, E=Unreliable, F=Cannot Be Judged'
);

/**
 * NATO Information Credibility rating: 1 through 6.
 */
export const InformationCredibilitySchema = z.number().int().min(1).max(6).describe(
  'NATO Information Credibility: 1=Confirmed, 2=Probably True, ' +
  '3=Possibly True, 4=Doubtfully True, 5=Improbable, 6=Cannot Be Judged'
);

/**
 * Composite NATO rating with override tracking for audit trail.
 */
export const NATORatingSchema = z.object({
  sourceReliability: SourceReliabilitySchema,
  informationCredibility: InformationCredibilitySchema,
  assessedBy: z.string(),
  assessedAt: z.string().datetime(),
  reasoning: z.string(),
  overriddenBy: z.string().optional(),
  overrideReason: z.string().optional(),
  overrideAt: z.string().datetime().optional(),
  originalRating: z.object({
    sourceReliability: SourceReliabilitySchema,
    informationCredibility: InformationCredibilitySchema,
  }).optional(),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type SourceReliability = z.infer<typeof SourceReliabilitySchema>;
export type InformationCredibility = z.infer<typeof InformationCredibilitySchema>;
export type NATORating = z.infer<typeof NATORatingSchema>;

// ============================================================================
// Display Labels
// ============================================================================

/**
 * Human-readable labels for source reliability grades A-F.
 */
export const RELIABILITY_LABELS: Record<SourceReliability, string> = {
  A: 'Completely Reliable',
  B: 'Usually Reliable',
  C: 'Fairly Reliable',
  D: 'Not Usually Reliable',
  E: 'Unreliable',
  F: 'Reliability Cannot Be Judged',
};

/**
 * Human-readable labels for information credibility scores 1-6.
 */
export const CREDIBILITY_LABELS: Record<InformationCredibility, string> = {
  1: 'Confirmed by Other Sources',
  2: 'Probably True',
  3: 'Possibly True',
  4: 'Doubtfully True',
  5: 'Improbable',
  6: 'Truth Cannot Be Judged',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a NATO rating as a human-readable string.
 *
 * @example
 * formatNATORating(rating) // "Source: B - Usually Reliable | Info: 3 - Possibly True"
 */
export function formatNATORating(rating: NATORating): string {
  const reliabilityLabel = RELIABILITY_LABELS[rating.sourceReliability];
  const credibilityLabel = CREDIBILITY_LABELS[rating.informationCredibility as InformationCredibility];
  return `Source: ${rating.sourceReliability} - ${reliabilityLabel} | Info: ${rating.informationCredibility} - ${credibilityLabel}`;
}

/**
 * Determine if a rating requires human review.
 * Returns true if source reliability is D/E/F or information credibility is 4/5/6.
 */
export function isHumanReviewRequired(rating: NATORating): boolean {
  const lowReliability: SourceReliability[] = ['D', 'E', 'F'];
  const lowCredibility = [4, 5, 6];
  return (
    lowReliability.includes(rating.sourceReliability) ||
    lowCredibility.includes(rating.informationCredibility)
  );
}
