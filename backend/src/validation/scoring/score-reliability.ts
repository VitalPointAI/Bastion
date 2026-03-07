/**
 * Reliability Scoring
 *
 * Phase 31 Plan 02 (stub): Evaluates agent response quality against
 * expected outputs using functional assertions and LLM-as-judge.
 */

import type { EvaluationResult, TestScenario } from '../validation-types.js';

/**
 * Score reliability of a single agent output against scenario expectations.
 *
 * @param output - Agent's actual output
 * @param scenario - The test scenario with expected results
 * @returns EvaluationResult with functional, LLM judge, and combined scores
 */
export async function scoreReliability(
  output: string | Record<string, unknown>,
  scenario: TestScenario,
): Promise<EvaluationResult> {
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);

  // Functional assertions
  const assertions = runFunctionalAssertions(outputStr, scenario);
  const passedCount = assertions.filter((a) => a.passed).length;
  const functionalScore =
    assertions.length > 0 ? passedCount / assertions.length : 0.5;

  // LLM judge placeholder (runs functional heuristics for now)
  const llmJudgeScore = functionalScore; // TODO: integrate LLM-as-judge
  const llmJudgeRationale = 'Functional heuristic (LLM judge not yet integrated)';

  const combinedScore = (functionalScore + llmJudgeScore) / 2;
  const disagreement = Math.abs(functionalScore - llmJudgeScore) > 0.3;

  return {
    functionalScore: Math.round(functionalScore * 1000) / 1000,
    llmJudgeScore: Math.round(llmJudgeScore * 1000) / 1000,
    combinedScore: Math.round(combinedScore * 1000) / 1000,
    disagreement,
    functionalDetails: assertions,
    llmJudgeRationale,
  };
}

function runFunctionalAssertions(
  output: string,
  scenario: TestScenario,
): Array<{ name: string; passed: boolean; expected: string; actual: string }> {
  const results: Array<{
    name: string;
    passed: boolean;
    expected: string;
    actual: string;
  }> = [];

  // Check required terminology
  if (scenario.expected.requiredTerminology) {
    for (const term of scenario.expected.requiredTerminology) {
      results.push({
        name: `contains_term:${term}`,
        passed: output.toLowerCase().includes(term.toLowerCase()),
        expected: term,
        actual: output.substring(0, 100),
      });
    }
  }

  // Check forbidden actions
  if (scenario.expected.forbiddenActions) {
    for (const action of scenario.expected.forbiddenActions) {
      results.push({
        name: `forbids:${action}`,
        passed: !output.toLowerCase().includes(action.toLowerCase()),
        expected: `Not contain: ${action}`,
        actual: output.substring(0, 100),
      });
    }
  }

  // Check required citations
  if (scenario.expected.requiredCitations) {
    for (const citation of scenario.expected.requiredCitations) {
      results.push({
        name: `cites:${citation}`,
        passed: output.includes(citation),
        expected: citation,
        actual: output.substring(0, 100),
      });
    }
  }

  // If no assertions were generated, add a basic non-empty check
  if (results.length === 0) {
    results.push({
      name: 'non_empty_output',
      passed: output.trim().length > 0,
      expected: 'Non-empty response',
      actual: output.length > 0 ? 'Has content' : 'Empty',
    });
  }

  return results;
}
