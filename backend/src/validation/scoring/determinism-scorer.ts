/**
 * Determinism Scorer
 *
 * Phase 31 Plan 02: Compares multiple runs of the same input to measure
 * output consistency. Uses structured diff and/or embedding similarity
 * depending on the scenario's scoringMethod.
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { cosineSimilarity } from './cosine-similarity.js';
import type {
  TestScenario,
  AssertionResult,
  ScoringMethod,
} from '../validation-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeterminismResult {
  score: number; // 0-1
  details: AssertionResult[];
}

interface RunOutput {
  output: Record<string, unknown> | string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively collect all leaf keys from an object, returning a flat
 * key-value map with dot-separated paths.
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Map<string, unknown> {
  const result = new Map<string, unknown>();

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const nested = flattenObject(value as Record<string, unknown>, fullKey);
      for (const entry of Array.from(nested.entries())) {
        result.set(entry[0], entry[1]);
      }
    } else {
      result.set(fullKey, value);
    }
  }

  return result;
}

/**
 * Compare two values for equality. Arrays are compared element-wise by length
 * and JSON stringification of elements.
 */
function valuesMatch(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((el, i) => JSON.stringify(el) === JSON.stringify(b[i]));
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Structured diff between two outputs. Returns fraction of matching fields.
 */
function structuredDiffScore(
  a: Record<string, unknown> | string,
  b: Record<string, unknown> | string
): { score: number; detail: string } {
  // If both are strings, simple equality check
  if (typeof a === 'string' && typeof b === 'string') {
    const match = a === b;
    return {
      score: match ? 1.0 : 0.0,
      detail: match ? 'String outputs identical' : 'String outputs differ',
    };
  }

  // If types differ, score 0
  if (typeof a !== typeof b) {
    return { score: 0, detail: 'Output types differ (string vs object)' };
  }

  const flatA = flattenObject(a as Record<string, unknown>);
  const flatB = flattenObject(b as Record<string, unknown>);

  // Union of all keys
  const allKeys = new Set<string>([
    ...Array.from(flatA.keys()),
    ...Array.from(flatB.keys()),
  ]);

  if (allKeys.size === 0) {
    return { score: 1.0, detail: 'Both outputs empty' };
  }

  let matching = 0;
  const mismatches: string[] = [];

  for (const key of Array.from(allKeys)) {
    const valA = flatA.get(key);
    const valB = flatB.get(key);

    if (flatA.has(key) && flatB.has(key) && valuesMatch(valA, valB)) {
      matching++;
    } else {
      mismatches.push(key);
    }
  }

  const score = matching / allKeys.size;
  const detail =
    mismatches.length === 0
      ? `All ${allKeys.size} fields match`
      : `${matching}/${allKeys.size} fields match; mismatches: ${mismatches.slice(0, 5).join(', ')}${mismatches.length > 5 ? '...' : ''}`;

  return { score, detail };
}

/**
 * Get embedding for a text string. Handles errors gracefully.
 */
async function getEmbedding(
  embeddings: OpenAIEmbeddings,
  text: string
): Promise<number[] | null> {
  try {
    return await embeddings.embedQuery(text);
  } catch (err) {
    console.error('[determinism-scorer] Embedding error:', err);
    return null;
  }
}

/**
 * Semantic similarity score between two outputs using embeddings.
 */
async function semanticSimilarityScore(
  a: Record<string, unknown> | string,
  b: Record<string, unknown> | string,
  embeddings: OpenAIEmbeddings
): Promise<{ score: number; detail: string }> {
  const textA = typeof a === 'string' ? a : JSON.stringify(a);
  const textB = typeof b === 'string' ? b : JSON.stringify(b);

  const [embA, embB] = await Promise.all([
    getEmbedding(embeddings, textA),
    getEmbedding(embeddings, textB),
  ]);

  if (!embA || !embB) {
    return {
      score: 0,
      detail: 'Embedding generation failed; score defaulted to 0',
    };
  }

  const similarity = cosineSimilarity(embA, embB);
  return {
    score: Math.max(0, similarity), // clamp negative similarities to 0
    detail: `Cosine similarity: ${similarity.toFixed(4)}`,
  };
}

// ---------------------------------------------------------------------------
// Pair generation
// ---------------------------------------------------------------------------

function generatePairs(count: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

/**
 * Score determinism across multiple runs of the same input.
 *
 * Compares each unique pair of runs using the specified scoring method
 * (structured_diff, semantic_similarity, or both).
 *
 * @param runs - Array of run outputs to compare
 * @param scenario - Test scenario with scoringMethod configuration
 * @returns Score (0-1) and per-pair comparison details
 */
export async function scoreDeterminism(
  runs: RunOutput[],
  scenario: TestScenario
): Promise<DeterminismResult> {
  // Single run edge case
  if (runs.length <= 1) {
    return {
      score: 1.0,
      details: [
        {
          name: 'single-run',
          passed: true,
          expected: 'N/A',
          actual: 'N/A',
          details: 'Single run, no determinism comparison',
        },
      ],
    };
  }

  const pairs = generatePairs(runs.length);
  const details: AssertionResult[] = [];
  let totalScore = 0;

  // Lazily initialize embeddings only when needed
  let embeddings: OpenAIEmbeddings | null = null;
  const method: ScoringMethod = scenario.scoringMethod;

  if (method === 'semantic_similarity' || method === 'both') {
    embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
    });
  }

  for (const [i, j] of pairs) {
    const outputA = runs[i].output;
    const outputB = runs[j].output;
    const pairLabel = `run-${i}-vs-${j}`;

    let pairScore = 0;

    if (method === 'structured_diff') {
      const result = structuredDiffScore(outputA, outputB);
      pairScore = result.score;
      details.push({
        name: `${pairLabel}/structured_diff`,
        passed: result.score >= 0.9,
        expected: 'Consistent output',
        actual: result.detail,
        details: `Score: ${result.score.toFixed(4)}`,
      });
    } else if (method === 'semantic_similarity') {
      const result = await semanticSimilarityScore(
        outputA,
        outputB,
        embeddings!
      );
      pairScore = result.score;
      details.push({
        name: `${pairLabel}/semantic_similarity`,
        passed: result.score >= 0.9,
        expected: 'Semantically similar output',
        actual: result.detail,
        details: `Score: ${result.score.toFixed(4)}`,
      });
    } else {
      // 'both' — weighted average
      const structResult = structuredDiffScore(outputA, outputB);
      const semanticResult = await semanticSimilarityScore(
        outputA,
        outputB,
        embeddings!
      );

      pairScore = 0.5 * structResult.score + 0.5 * semanticResult.score;

      details.push({
        name: `${pairLabel}/structured_diff`,
        passed: structResult.score >= 0.9,
        expected: 'Consistent output',
        actual: structResult.detail,
        details: `Score: ${structResult.score.toFixed(4)}`,
      });
      details.push({
        name: `${pairLabel}/semantic_similarity`,
        passed: semanticResult.score >= 0.9,
        expected: 'Semantically similar output',
        actual: semanticResult.detail,
        details: `Score: ${semanticResult.score.toFixed(4)}`,
      });
    }

    totalScore += pairScore;
  }

  const averageScore = totalScore / pairs.length;

  return {
    score: averageScore,
    details,
  };
}
