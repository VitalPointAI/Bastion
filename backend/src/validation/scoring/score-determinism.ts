/**
 * Determinism Scoring
 *
 * Phase 31 Plan 02 (stub): Scores consistency across multiple agent runs
 * on the same scenario. Uses cosine similarity for structured output
 * comparison and text similarity for free-text responses.
 */

import type { TestScenario } from '../validation-types.js';

/**
 * Score determinism by comparing multiple agent outputs for the same scenario.
 *
 * @param runs - Array of agent outputs from repeated invocations
 * @param scenario - The test scenario with expected output
 * @returns Evaluation result with consistency scores
 */
export async function scoreDeterminism(
  runs: Array<string | Record<string, unknown>>,
  _scenario: TestScenario,
): Promise<{ score: number; details: Record<string, unknown> }> {
  if (runs.length < 2) {
    return { score: 1.0, details: { reason: 'single run, determinism=1' } };
  }

  // Normalize outputs to strings for comparison
  const normalized = runs.map((r) =>
    typeof r === 'string' ? r : JSON.stringify(r),
  );

  // Calculate pairwise similarity
  let totalSimilarity = 0;
  let pairCount = 0;
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      totalSimilarity += stringSimilarity(normalized[i], normalized[j]);
      pairCount++;
    }
  }

  const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 1.0;

  return {
    score: Math.round(avgSimilarity * 1000) / 1000,
    details: {
      runCount: runs.length,
      pairCount,
      avgSimilarity,
      method: 'string_similarity',
    },
  };
}

/**
 * Simple string similarity using character bigram overlap (Dice coefficient).
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) {
    bigramsA.add(a.substring(i, i + 2));
  }

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) {
    bigramsB.add(b.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}
