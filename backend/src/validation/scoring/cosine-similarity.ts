/**
 * Cosine Similarity Utility
 *
 * Phase 31 Plan 02: Vector cosine similarity for determinism scoring.
 * Computes dot product / (magnitude product) for two numeric vectors.
 */

/**
 * Compute cosine similarity between two numeric vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1 (0 for zero vectors)
 * @throws Error if vectors have different lengths
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector length mismatch: a has ${a.length} elements, b has ${b.length}`
    );
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dot / magnitude;
}
