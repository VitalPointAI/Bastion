/**
 * String Similarity Matching for Entity Resolution
 *
 * Provides string comparison functions for identifying potential
 * duplicate actors based on name similarity.
 */

import StringComparison from 'string-comparison';

export interface MatchScore {
  score: number;
  algorithm: 'exact' | 'jaro_winkler' | 'levenshtein';
}

export interface MatchCandidate {
  actor1Id: string;
  actor1Name: string;
  actor2Id: string;
  actor2Name: string;
  score: MatchScore;
}

/**
 * Normalize name for comparison
 * - Lowercase
 * - Remove common prefixes (The, Republic of, etc.)
 * - Normalize whitespace
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(the|republic of|kingdom of|state of)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two names
 * Returns best score from multiple algorithms
 */
export function calculateSimilarity(name1: string, name2: string): MatchScore {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  // Exact match (normalized)
  if (n1 === n2) {
    return { score: 1.0, algorithm: 'exact' };
  }

  // Jaro-Winkler (good for names with common prefixes)
  const jwScore = StringComparison.jaroWinkler.similarity(n1, n2);

  // Levenshtein (normalized)
  const levScore = StringComparison.levenshtein.similarity(n1, n2);

  // Return best score
  if (jwScore >= levScore) {
    return { score: jwScore, algorithm: 'jaro_winkler' };
  }
  return { score: levScore, algorithm: 'levenshtein' };
}

/**
 * Check if any alias matches
 */
export function matchWithAliases(
  name1: string,
  aliases1: string[],
  name2: string,
  aliases2: string[],
  threshold: number = 0.85
): MatchScore | null {
  const allNames1 = [name1, ...aliases1];
  const allNames2 = [name2, ...aliases2];

  let bestScore: MatchScore | null = null;

  for (const n1 of allNames1) {
    for (const n2 of allNames2) {
      const score = calculateSimilarity(n1, n2);
      if (score.score >= threshold) {
        if (!bestScore || score.score > bestScore.score) {
          bestScore = score;
        }
      }
    }
  }

  return bestScore;
}
