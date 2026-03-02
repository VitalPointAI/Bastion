/**
 * Trigger Router — Debounce + context merge for concurrent AI role triggers
 *
 * Phase 16 Plan 03: Prevents duplicate runs by merging multiple triggers
 * within a 2-second window into a single enriched pg-boss job.
 * Uses singletonKey for pg-boss deduplication: one active job per role.
 */

import { PgBoss, type Job, type WorkOptions } from 'pg-boss';
import type { AIRoleRun } from './types.js';
import type { AIRunStore } from './ai-run-store.js';
import type { AgentRunner } from './ai-role-runner.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TriggerContext {
  triggerType: AIRoleRun['triggerType'];
  payload: Record<string, unknown>;
}

interface PendingEntry {
  timeout: ReturnType<typeof setTimeout>;
  contexts: TriggerContext[];
}

// ─── TriggerRouter ────────────────────────────────────────────────────────────

export class TriggerRouter {
  private pending = new Map<string, PendingEntry>();
  private readonly MERGE_WINDOW_MS = 2000;

  constructor(
    private boss: PgBoss,
    private aiRunStore: AIRunStore,
  ) {}

  /**
   * Trigger an AI role execution, merging concurrent triggers within 2s window.
   * If an active (non-queued) run exists, merges context into it instead.
   */
  async trigger(
    scenarioId: string,
    roleKey: string,
    event: TriggerContext
  ): Promise<void> {
    const key = `${scenarioId}:${roleKey}`;

    // Check if there's already an active run — if so, merge context into it
    const activeRun = await this.aiRunStore.findActiveRun(scenarioId, roleKey);
    if (activeRun && activeRun.status !== 'queued') {
      // Merge new trigger context into existing run (don't spawn duplicate)
      await this.aiRunStore.mergeTriggerContext(activeRun.id, event.payload);
      return;
    }

    // Debounce: merge multiple triggers within MERGE_WINDOW_MS into one job
    const existing = this.pending.get(key);
    if (existing) {
      clearTimeout(existing.timeout);
      existing.contexts.push(event);
    } else {
      this.pending.set(key, { contexts: [event], timeout: null! });
    }

    const entry = this.pending.get(key)!;
    entry.timeout = setTimeout(async () => {
      this.pending.delete(key);
      await this.dispatchMergedRun(scenarioId, roleKey, entry.contexts);
    }, this.MERGE_WINDOW_MS);
  }

  /**
   * Dispatch a merged run as a pg-boss job.
   * singletonKey ensures only one active job exists per (scenario, role) pair.
   */
  private async dispatchMergedRun(
    scenarioId: string,
    roleKey: string,
    contexts: TriggerContext[]
  ): Promise<void> {
    const mergedContext = contexts.reduce(
      (acc, ctx) => ({ ...acc, ...ctx.payload }),
      { triggerTypes: contexts.map(c => c.triggerType) } as Record<string, unknown>
    );
    const primaryTriggerType = contexts[0].triggerType;

    await this.boss.send(
      'ai-role-execution',
      {
        scenarioId,
        roleKey,
        triggerContext: mergedContext,
        triggerType: primaryTriggerType,
      },
      {
        singletonKey: `${scenarioId}:${roleKey}`, // Deduplication: one active job per role
        retryLimit: 2,
        retryDelay: 30,
      }
    );
  }
}

// ─── Worker Registration ──────────────────────────────────────────────────────

/**
 * Register the pg-boss worker for 'ai-role-execution' jobs.
 * Call once at app startup after pg-boss is initialized.
 */
export async function registerAIRoleWorker(
  boss: PgBoss,
  runner: AgentRunner,
  aiRunStore: AIRunStore
): Promise<void> {
  await boss.createQueue('ai-role-execution');
  boss.work(
    'ai-role-execution',
    { localConcurrency: 3 } as WorkOptions,
    async (jobs: Job<{ scenarioId: string; roleKey: string; triggerContext: Record<string, unknown>; triggerType: AIRoleRun['triggerType'] }>[]) => {
      for (const job of jobs) {
        const { scenarioId, roleKey, triggerContext, triggerType } = job.data;

        try {
          const run = await aiRunStore.create({ scenarioId, roleKey, triggerType, triggerContext });
          await runner.start(run, triggerContext);
        } catch (err) {
          console.error(`[TriggerRouter] Failed to execute AI role job for ${scenarioId}:${roleKey}:`, err);
          throw err; // Rethrow so pg-boss can retry
        }
      }
    }
  );
}
