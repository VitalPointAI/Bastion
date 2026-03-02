/**
 * AI Role Runner — Abstraction layer for LangGraph agent execution
 *
 * Phase 16 Plan 03: AgentRunner interface + LangGraphAgentRunner implementation.
 * Provides an abstraction that allows future replacement of LangGraph with
 * another runner (e.g., Rust sidecar) without changing channel/UI code.
 */

import type { AIRoleRun } from './types.js';
import type { AIRunStore } from './ai-run-store.js';
import type { AIChannelStore } from './ai-channel-store.js';
import type { ProductVersionStore } from './product-version-store.js';
import type { AIContextStore } from './ai-context-store.js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { createAIRoleGraph } from './ai-role-graph.js';

// ─── Interface ────────────────────────────────────────────────────────────────

/** Abstraction interface — LangGraph implements this; future runners (Rust sidecar) will too */
export interface AgentRunner {
  start(run: AIRoleRun, triggerContext: Record<string, unknown>): Promise<void>;
  pause(runId: string): Promise<void>;
  resume(runId: string, feedback?: Record<string, unknown>): Promise<void>;
  getStatus(runId: string): Promise<AIRoleRun['status']>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class LangGraphAgentRunner implements AgentRunner {
  constructor(
    private checkpointer: PostgresSaver,
    private aiRunStore: AIRunStore,
    private aiChannelStore: AIChannelStore,
    private productVersionStore: ProductVersionStore,
    private aiContextStore: AIContextStore,
  ) {}

  async start(run: AIRoleRun, triggerContext: Record<string, unknown>): Promise<void> {
    // Update status from 'queued' to 'running'
    await this.aiRunStore.updateStatus(run.id, 'running');

    const graph = await createAIRoleGraph(this.checkpointer, {
      aiRunStore: this.aiRunStore,
      aiChannelStore: this.aiChannelStore,
      productVersionStore: this.productVersionStore,
      aiContextStore: this.aiContextStore,
    });

    const config = { configurable: { thread_id: run.id } };
    await graph.invoke({
      scenarioId: run.scenarioId,
      roleKey: run.roleKey,
      runId: run.id,
      triggerContext,
      status: 'running' as const,
      iterationCount: 0,
    }, config);
  }

  async pause(runId: string): Promise<void> {
    // The LangGraph interrupt already pauses graph execution; this updates the DB status
    await this.aiRunStore.updateStatus(runId, 'paused', { pausedAt: new Date() });
  }

  async resume(runId: string, feedback?: Record<string, unknown>): Promise<void> {
    const run = await this.aiRunStore.findById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    await this.aiRunStore.updateStatus(runId, 'running', { resumedAt: new Date() });

    const graph = await createAIRoleGraph(this.checkpointer, {
      aiRunStore: this.aiRunStore,
      aiChannelStore: this.aiChannelStore,
      productVersionStore: this.productVersionStore,
      aiContextStore: this.aiContextStore,
    });

    const config = { configurable: { thread_id: runId } };
    // When resuming from interrupt(), pass the feedback as the new input
    await graph.invoke(feedback ?? null, config);
  }

  async getStatus(runId: string): Promise<AIRoleRun['status']> {
    const run = await this.aiRunStore.findById(runId);
    return run?.status ?? 'failed';
  }
}
