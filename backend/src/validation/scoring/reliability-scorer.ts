/**
 * Reliability Scorer
 *
 * Phase 31 Plan 02: Dual-layer evaluation combining deterministic functional
 * assertions with LLM-as-judge semantic evaluation. Detects disagreement
 * between the two layers.
 */

import { ChatOpenAI } from '@langchain/openai';
import type {
  TestScenario,
  EvaluationResult,
  AssertionResult,
} from '../validation-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Threshold above which functional vs LLM-judge disagreement is flagged. */
const DISAGREEMENT_THRESHOLD = 0.25;

/** Weight for functional score in combined calculation. */
const FUNCTIONAL_WEIGHT = 0.4;

/** Weight for LLM judge score in combined calculation. */
const LLM_JUDGE_WEIGHT = 0.6;

/**
 * LLM-as-judge rubric for reliability evaluation.
 * Evaluates completeness, accuracy, and quality of agent output.
 */
const JUDGE_RUBRIC = `You are an expert evaluator assessing AI agent output quality.

Given the scenario input, agent output, and expected reference output, evaluate the agent's response.

Score 0-10 on these criteria:
1. COMPLETENESS: Does the output address all aspects of the input?
2. ACCURACY: Is the information factually correct and aligned with the expected output?
3. QUALITY: Is the output well-structured, clear, and professional?
4. RELEVANCE: Does the output stay focused on the task requirements?

Output your evaluation as JSON (no markdown wrapping):
{
  "criteria": [
    { "name": "COMPLETENESS", "score": <0-10>, "comment": "<brief>" },
    { "name": "ACCURACY", "score": <0-10>, "comment": "<brief>" },
    { "name": "QUALITY", "score": <0-10>, "comment": "<brief>" },
    { "name": "RELEVANCE", "score": <0-10>, "comment": "<brief>" }
  ],
  "overall": <0-10>,
  "rationale": "<2-3 sentence summary>"
}`;

// ---------------------------------------------------------------------------
// Functional assertions
// ---------------------------------------------------------------------------

/**
 * Check that output contains required citations.
 */
function checkCitations(
  outputText: string,
  requiredCitations: string[]
): AssertionResult {
  let found = 0;
  const missing: string[] = [];

  for (const citation of requiredCitations) {
    if (outputText.includes(citation)) {
      found++;
    } else {
      missing.push(citation);
    }
  }

  const score = requiredCitations.length > 0 ? found / requiredCitations.length : 1;

  return {
    name: 'required-citations',
    passed: missing.length === 0,
    expected: `All ${requiredCitations.length} citations present`,
    actual: `${found}/${requiredCitations.length} found`,
    details: missing.length > 0
      ? `Missing: ${missing.slice(0, 5).join(', ')}`
      : 'All citations present',
  };
}

/**
 * Check that output contains required terminology (case-insensitive).
 */
function checkTerminology(
  outputText: string,
  requiredTerminology: string[]
): AssertionResult {
  const lowerOutput = outputText.toLowerCase();
  let found = 0;
  const missing: string[] = [];

  for (const term of requiredTerminology) {
    if (lowerOutput.includes(term.toLowerCase())) {
      found++;
    } else {
      missing.push(term);
    }
  }

  const score = requiredTerminology.length > 0 ? found / requiredTerminology.length : 1;

  return {
    name: 'required-terminology',
    passed: missing.length === 0,
    expected: `All ${requiredTerminology.length} terms present`,
    actual: `${found}/${requiredTerminology.length} found`,
    details: missing.length > 0
      ? `Missing: ${missing.slice(0, 5).join(', ')}`
      : 'All terms present',
  };
}

/**
 * Validate structured output against expected fields.
 */
function checkStructuredOutput(
  output: Record<string, unknown>,
  expected: Record<string, unknown>
): AssertionResult {
  const expectedKeys = Object.keys(expected);
  if (expectedKeys.length === 0) {
    return {
      name: 'structured-output',
      passed: true,
      expected: 'No fields to validate',
      actual: 'No fields to validate',
    };
  }

  let matching = 0;
  const mismatches: string[] = [];

  for (const key of expectedKeys) {
    if (
      key in output &&
      JSON.stringify(output[key]) === JSON.stringify(expected[key])
    ) {
      matching++;
    } else {
      mismatches.push(key);
    }
  }

  const score = matching / expectedKeys.length;

  return {
    name: 'structured-output',
    passed: mismatches.length === 0,
    expected: `All ${expectedKeys.length} fields match`,
    actual: `${matching}/${expectedKeys.length} fields match`,
    details: mismatches.length > 0
      ? `Mismatched: ${mismatches.slice(0, 5).join(', ')}`
      : 'All fields match',
  };
}

/**
 * Extract numeric score (0-1) from an AssertionResult based on actual vs expected.
 */
function extractAssertionScore(result: AssertionResult): number {
  // Parse "X/Y found" or "X/Y fields match" patterns
  const match = result.actual.match(/(\d+)\/(\d+)/);
  if (match) {
    const [, num, denom] = match;
    return parseInt(denom, 10) > 0 ? parseInt(num, 10) / parseInt(denom, 10) : 1;
  }
  return result.passed ? 1.0 : 0.0;
}

/**
 * Run all applicable functional assertions on the output.
 */
function runFunctionalAssertions(
  output: Record<string, unknown> | string,
  scenario: TestScenario
): { score: number; details: AssertionResult[] } {
  const outputText =
    typeof output === 'string' ? output : JSON.stringify(output);
  const details: AssertionResult[] = [];
  const scores: number[] = [];

  if (scenario.expected.requiredCitations && scenario.expected.requiredCitations.length > 0) {
    const result = checkCitations(outputText, scenario.expected.requiredCitations);
    details.push(result);
    scores.push(extractAssertionScore(result));
  }

  if (scenario.expected.requiredTerminology && scenario.expected.requiredTerminology.length > 0) {
    const result = checkTerminology(outputText, scenario.expected.requiredTerminology);
    details.push(result);
    scores.push(extractAssertionScore(result));
  }

  if (
    scenario.expected.structuredOutput &&
    typeof output === 'object' &&
    output !== null
  ) {
    const result = checkStructuredOutput(
      output as Record<string, unknown>,
      scenario.expected.structuredOutput
    );
    details.push(result);
    scores.push(extractAssertionScore(result));
  }

  // Weighted average of present assertion scores
  const score =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s, 0) / scores.length
      : 1.0; // No assertions to check = pass

  return { score, details };
}

// ---------------------------------------------------------------------------
// LLM-as-judge evaluation
// ---------------------------------------------------------------------------

/**
 * Run LLM-as-judge evaluation using a ChatOpenAI model with temperature=0.
 */
async function runLLMJudge(
  output: Record<string, unknown> | string,
  scenario: TestScenario
): Promise<{ score: number; rationale: string }> {
  try {
    const judge = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
    });

    const outputText =
      typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    const expectedText = scenario.expected.freeTextReference
      ? scenario.expected.freeTextReference
      : JSON.stringify(scenario.expected, null, 2);

    const inputText = scenario.input.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `${JUDGE_RUBRIC}

--- SCENARIO INPUT ---
${inputText}

--- AGENT OUTPUT ---
${outputText}

--- EXPECTED REFERENCE ---
${expectedText}`;

    const response = await judge.invoke([{ role: 'user', content: prompt }]);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Strip markdown code fences if present
    const cleaned = content.replace(/```(?:json)?\n?/g, '').trim();

    const parsed = JSON.parse(cleaned) as {
      criteria?: Array<{ name: string; score: number; comment: string }>;
      overall?: number;
      rationale?: string;
    };

    const overallScore =
      typeof parsed.overall === 'number' ? parsed.overall / 10 : 0;

    return {
      score: Math.max(0, Math.min(1, overallScore)),
      rationale: parsed.rationale ?? 'No rationale provided',
    };
  } catch (err) {
    console.error('[reliability-scorer] LLM judge error:', err);
    return {
      score: 0,
      rationale: `LLM judge evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

/**
 * Score reliability of agent output using dual-layer evaluation.
 *
 * Layer 1 (Functional): Deterministic checks for citations, terminology,
 * and structured output conformance.
 *
 * Layer 2 (LLM-as-judge): Semantic evaluation using rubric-based scoring.
 *
 * Flags disagreement when the two layers diverge by more than 0.25.
 *
 * @param output - Agent's output (structured object or free text)
 * @param scenario - Test scenario with expected values
 * @returns EvaluationResult with both scores, combined score, and disagreement flag
 */
export async function scoreReliability(
  output: Record<string, unknown> | string,
  scenario: TestScenario
): Promise<EvaluationResult> {
  // Layer 1: Functional assertions
  const functional = runFunctionalAssertions(output, scenario);

  // Layer 2: LLM-as-judge
  const llmJudge = await runLLMJudge(output, scenario);

  // Disagreement detection
  const disagreement =
    Math.abs(functional.score - llmJudge.score) > DISAGREEMENT_THRESHOLD;

  // Combined score (LLM judge weighted higher for semantic quality)
  const combinedScore =
    FUNCTIONAL_WEIGHT * functional.score + LLM_JUDGE_WEIGHT * llmJudge.score;

  return {
    functionalScore: functional.score,
    llmJudgeScore: llmJudge.score,
    combinedScore,
    disagreement,
    functionalDetails: functional.details,
    llmJudgeRationale: llmJudge.rationale,
  };
}
