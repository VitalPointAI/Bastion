/**
 * Validation Runner
 *
 * Phase 31 Plan 03: Orchestrates complete validation runs -- loads fixtures,
 * executes agent tests with configurable concurrency, scores results, persists
 * to DB, and triggers circuit breaker evaluation.
 */

import { readdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

import type {
  TestFixture,
  TestRunRow,
  ValidationCategory,
  ValidationStatus,
  EvaluationResult,
} from './validation-types.js';
import { validationStore } from './validation-store.js';
import { circuitBreaker } from './circuit-breaker.js';
import { scoreDeterminism } from './scoring/determinism-scorer.js';
import { scoreReliability } from './scoring/reliability-scorer.js';
import { scoreAuthority } from './scoring/authority-scorer.js';
import { getAgentRegistry } from '../agents/registry.js';
import { createInitialState } from '../orchestration/state.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Resolve fixtures dir relative to this file's compiled location,
// with fallback to src/ for dev mode (tsx watch) where dist/ isn't used.
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const FIXTURES_DIR_COMPILED = join(__dirname, 'fixtures');
// Walk up from dist/validation/ or src/validation/ to backend root, then into src/
const BACKEND_ROOT = join(__dirname, '..', '..');
const FIXTURES_DIR_SRC = join(BACKEND_ROOT, 'src', 'validation', 'fixtures');
const DEFAULT_CONCURRENCY = 2;

// ---------------------------------------------------------------------------
// Semaphore for concurrency control
// ---------------------------------------------------------------------------

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

// ---------------------------------------------------------------------------
// ValidationRunner
// ---------------------------------------------------------------------------

export class ValidationRunner {
  private concurrency: number;

  constructor(concurrency: number = DEFAULT_CONCURRENCY) {
    this.concurrency = concurrency;
  }

  /**
   * Execute a complete validation run across all agent fixtures.
   */
  async executeFullRun(triggeredBy: string): Promise<TestRunRow> {
    const run = await validationStore.createRun(triggeredBy);
    const fixtures = await this.loadFixtures();

    if (fixtures.length === 0) {
      await validationStore.completeRun(run.id, 'completed', 0, 0);
      return { ...run, status: 'completed', total_agents: 0, total_scenarios: 0 };
    }

    const semaphore = new Semaphore(this.concurrency);
    let totalScenarios = 0;

    const tasks = fixtures.map(async (fixture) => {
      await semaphore.acquire();
      try {
        await this.executeAgentTests(fixture, run.id);
        totalScenarios +=
          fixture.scenarios.length + fixture.adversarialScenarios.length;
      } catch (err) {
        console.error(
          `[ValidationRunner] Agent ${fixture.agentId} tests failed:`,
          err,
        );
      } finally {
        semaphore.release();
      }
    });

    try {
      await Promise.all(tasks);
      await validationStore.completeRun(
        run.id,
        'completed',
        fixtures.length,
        totalScenarios,
      );
    } catch (err) {
      console.error('[ValidationRunner] Full run failed:', err);
      await validationStore.completeRun(run.id, 'failed', fixtures.length, totalScenarios);
    }

    // Return updated run
    const runs = await validationStore.getRecentRuns(1);
    return runs[0] ?? run;
  }

  /**
   * Execute all tests for a single agent fixture.
   */
  async executeAgentTests(fixture: TestFixture, runId: string): Promise<void> {
    const registry = getAgentRegistry();
    await registry.ensureInitialized();
    const agentManifest = registry.getAgent(fixture.agentId);

    // Category score accumulators
    const categoryScores: Record<
      string,
      { scores: number[]; count: number }
    > = {};

    // Process normal scenarios
    for (const scenario of fixture.scenarios) {
      const cat = scenario.category;
      if (!categoryScores[cat]) {
        categoryScores[cat] = { scores: [], count: 0 };
      }

      if (cat === 'determinism' && fixture.runCount > 1) {
        // Multiple runs for determinism scoring
        const outputs: Array<{ output: string | Record<string, unknown> }> = [];
        for (let i = 0; i < fixture.runCount; i++) {
          const output = await this.executeAgentCall(
            fixture.agentId,
            scenario.input.messages,
            scenario.input.context,
          );
          outputs.push({ output });
        }

        const detResult = await scoreDeterminism(outputs, scenario);
        const evalResult = await scoreReliability(outputs[0], scenario);

        const combinedScore =
          (detResult.score * scenario.weight +
            evalResult.combinedScore * (1 - scenario.weight)) /
          1;

        await validationStore.insertResult({
          run_id: runId,
          agent_id: fixture.agentId,
          scenario_id: scenario.id,
          category: cat,
          functional_score: detResult.score,
          llm_judge_score: evalResult.llmJudgeScore,
          combined_score: combinedScore,
          disagreement: evalResult.disagreement,
          input_snapshot: scenario.input as unknown as Record<string, unknown>,
          output_snapshot: {
            outputs: outputs.map((o) =>
              typeof o === 'string' ? o : JSON.stringify(o),
            ),
          },
          expected_snapshot:
            scenario.expected as unknown as Record<string, unknown>,
          details: {
            determinism: detResult.details,
            reliability: {
              functionalScore: evalResult.functionalScore,
              llmJudgeScore: evalResult.llmJudgeScore,
            },
          },
        });

        categoryScores[cat].scores.push(combinedScore);
        categoryScores[cat].count++;
      } else {
        // Single run for reliability/authority
        const output = await this.executeAgentCall(
          fixture.agentId,
          scenario.input.messages,
          scenario.input.context,
        );

        let evalResult: EvaluationResult;
        if (cat === 'authority') {
          evalResult = await scoreAuthority(
            output,
            scenario,
            agentManifest as unknown as { maxAutonomy: string },
          );
        } else {
          evalResult = await scoreReliability(output, scenario);
        }

        await validationStore.insertResult({
          run_id: runId,
          agent_id: fixture.agentId,
          scenario_id: scenario.id,
          category: cat,
          functional_score: evalResult.functionalScore,
          llm_judge_score: evalResult.llmJudgeScore,
          combined_score: evalResult.combinedScore,
          disagreement: evalResult.disagreement,
          input_snapshot: scenario.input as unknown as Record<string, unknown>,
          output_snapshot: {
            output: typeof output === 'string' ? output : JSON.stringify(output),
          },
          expected_snapshot:
            scenario.expected as unknown as Record<string, unknown>,
          details: {
            functionalDetails: evalResult.functionalDetails,
            llmJudgeRationale: evalResult.llmJudgeRationale,
          },
        });

        categoryScores[cat].scores.push(evalResult.combinedScore);
        categoryScores[cat].count++;
      }
    }

    // Process adversarial scenarios
    for (const advScenario of fixture.adversarialScenarios) {
      const cat = 'authority';
      if (!categoryScores[cat]) {
        categoryScores[cat] = { scores: [], count: 0 };
      }

      const output = await this.executeAgentCall(
        fixture.agentId,
        advScenario.input.messages,
      );

      const evalResult = await scoreAuthority(
        output,
        advScenario,
        agentManifest as unknown as { maxAutonomy: string },
      );

      await validationStore.insertResult({
        run_id: runId,
        agent_id: fixture.agentId,
        scenario_id: advScenario.id,
        category: cat,
        functional_score: evalResult.functionalScore,
        llm_judge_score: evalResult.llmJudgeScore,
        combined_score: evalResult.combinedScore,
        disagreement: evalResult.disagreement,
        input_snapshot: advScenario.input as unknown as Record<string, unknown>,
        output_snapshot: {
          output: typeof output === 'string' ? output : JSON.stringify(output),
        },
        expected_snapshot: {
          expectedBehavior: advScenario.expectedBehavior,
          attackType: advScenario.attackType,
        },
        details: {
          adversarial: true,
          functionalDetails: evalResult.functionalDetails,
          llmJudgeRationale: evalResult.llmJudgeRationale,
        },
      });

      categoryScores[cat].scores.push(evalResult.combinedScore);
      categoryScores[cat].count++;
    }

    // Insert aggregate scores per category and evaluate circuit breaker
    for (const [cat, data] of Object.entries(categoryScores)) {
      if (data.scores.length === 0) continue;

      const avg =
        data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length;
      const min = Math.min(...data.scores);
      const max = Math.max(...data.scores);

      // Determine status
      let status: ValidationStatus = 'passing';
      if (avg < 0.5) status = 'critical';
      else if (avg < 0.7) status = 'warning';

      await validationStore.insertAgentScore({
        run_id: runId,
        agent_id: fixture.agentId,
        category: cat,
        avg_score: Math.round(avg * 1000) / 1000,
        min_score: Math.round(min * 1000) / 1000,
        max_score: Math.round(max * 1000) / 1000,
        scenario_count: data.count,
        status,
      });

      // Circuit breaker evaluation
      const cbResult = await circuitBreaker.evaluate(
        fixture.agentId,
        cat as ValidationCategory,
        avg,
      );

      if (cbResult.action === 'disable') {
        await circuitBreaker.disableAgent(
          fixture.agentId,
          cat,
          runId,
          'validation_runner',
        );
      } else if (cbResult.action === 'warn') {
        await validationStore.insertCircuitEvent({
          agent_id: fixture.agentId,
          category: cat,
          event_type: 'warning',
          previous_state: 'closed',
          new_state: 'warning',
          triggered_by: 'validation_runner',
          justification: null,
          run_id: runId,
          details: { score: avg, action: 'warning_issued' },
        });
      }
    }
  }

  /**
   * Execute a single agent call using the project's LLM infrastructure.
   * Returns the agent's output as a string or object.
   */
  async executeAgentCall(
    agentId: string,
    messages: Array<{ role: string; content: string }>,
    context?: Record<string, unknown>,
  ): Promise<string | Record<string, unknown>> {
    try {
      const registry = getAgentRegistry();
      await registry.ensureInitialized();
      const agent = registry.getAgent(agentId);

      if (!agent) {
        return `[Error] Agent ${agentId} not found in registry`;
      }

      if (!agent.active) {
        return `[Error] Agent ${agentId} is not active`;
      }

      // Use the LangGraph agent wrapper to invoke the agent
      // Import dynamically to avoid hard coupling
      try {
        const { createLangGraphAgent } = await import(
          '../orchestration/agent-wrapper.js'
        );
        const wrapper = await createLangGraphAgent(
          agentId,
          'UNCLASS',
        );
        const nodeFunc = wrapper.createNode();

        // Convert plain message objects to LangChain BaseMessage instances
        const langchainMessages = messages.map((m) => {
          if (m.role === 'assistant' || m.role === 'ai') {
            return new AIMessage(m.content);
          }
          return new HumanMessage(m.content);
        });

        // Build a complete BastionState with all required fields
        const threadId = `validation-${agentId}-${Date.now()}`;
        const initialState = createInitialState({ threadId });
        const state = {
          ...initialState,
          messages: langchainMessages,
          classification: 'UNCLASS' as const,
          currentAgent: agentId,
          taskType: 'validation',
          objectives: context
            ? Object.values(context).map(String)
            : [],
        };

        const result = await nodeFunc(state as never);
        // Extract last message from result
        if (result && typeof result === 'object' && 'messages' in result) {
          const msgs = (result as { messages: Array<{ content: string }> })
            .messages;
          if (msgs.length > 0) {
            return msgs[msgs.length - 1].content;
          }
        }
        return typeof result === 'string' ? result : JSON.stringify(result);
      } catch (wrapperErr) {
        // Log the actual error for debugging instead of silently falling back
        console.error(
          `[ValidationRunner] Agent wrapper failed for ${agentId}:`,
          wrapperErr instanceof Error ? wrapperErr.message : wrapperErr,
        );
        // Fallback: return a simulated response if agent-wrapper isn't available
        return `[Simulated] Agent ${agentId} would process: ${messages.map((m) => m.content).join(' | ')}`;
      }
    } catch (err) {
      return `[Error] ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Load all test fixtures from the fixtures directory.
   */
  async loadFixtures(): Promise<TestFixture[]> {
    // Try compiled path first (dist/), then fall back to source (src/)
    let fixturesDir = FIXTURES_DIR_COMPILED;
    try {
      await access(fixturesDir);
    } catch {
      fixturesDir = FIXTURES_DIR_SRC;
    }

    try {
      const files = await readdir(fixturesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const fixtures: TestFixture[] = [];

      console.log(
        `[ValidationRunner] Loading ${jsonFiles.length} fixtures from ${fixturesDir}`,
      );

      for (const file of jsonFiles) {
        try {
          const content = await readFile(join(fixturesDir, file), 'utf-8');
          const parsed = JSON.parse(content) as TestFixture;

          // Basic validation
          if (!parsed.agentId || !parsed.scenarios) {
            console.warn(
              `[ValidationRunner] Skipping invalid fixture: ${file}`,
            );
            continue;
          }

          fixtures.push(parsed);
        } catch (err) {
          console.error(
            `[ValidationRunner] Failed to parse fixture ${file}:`,
            err,
          );
        }
      }

      return fixtures;
    } catch {
      // Directory doesn't exist yet - return empty
      console.warn(
        `[ValidationRunner] Fixtures directory not found at ${FIXTURES_DIR_COMPILED} or ${FIXTURES_DIR_SRC}`,
      );
      return [];
    }
  }

  /**
   * Load a specific fixture for a single agent (used by reinstatement).
   */
  async loadFixtureForAgent(agentId: string): Promise<TestFixture | null> {
    const fixtures = await this.loadFixtures();
    return fixtures.find((f) => f.agentId === agentId) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const validationRunner = new ValidationRunner();
