/**
 * AI Role Graph — LangGraph StateGraph for staff role execution
 *
 * Phase 16 Plan 03: Full LangGraph StateGraph with interrupt-based human review.
 * Runs agent teams in parallel fan-out, checkpoints via PostgreSQL, and pauses
 * at review with interrupt(). Notification dispatch fires before interrupt() so
 * the review surfaces in the notification tray, channel feed, and product badge.
 *
 * Based on the existing strategy-reviewer-graph.ts pattern.
 */

import { StateGraph, END, START, interrupt, Annotation, messagesStateReducer } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { HumanMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import { getMessageBus } from '../messaging/message-bus.js';
import type { AIRunStore } from './ai-run-store.js';
import type { AIChannelStore } from './ai-channel-store.js';
import type { ProductVersionStore } from './product-version-store.js';
import type { AIContextStore } from './ai-context-store.js';
import type { StaffAgentDef, ReviewFeedback } from './types.js';
import { getDefaultAgentsForRole } from './agent-library.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 3;

/** DID used for all system notifications dispatched by this graph */
const GRAPH_SYSTEM_DID = 'did:system:ai-role-graph';

// ─── State Annotation ─────────────────────────────────────────────────────────

const AIRoleStateAnnotation = Annotation.Root({
  scenarioId: Annotation<string>(),
  roleKey: Annotation<string>(),
  runId: Annotation<string>(),
  triggerContext: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (a, b) => ({ ...a, ...b }),
  }),
  agentTeam: Annotation<StaffAgentDef[]>({
    default: () => [],
    reducer: (_a, b) => b,
  }),
  sharedContext: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (a, b) => ({ ...a, ...b }),
  }),
  currentProducts: Annotation<unknown[]>({
    default: () => [],
    reducer: (_a, b) => b,
  }),
  draftContent: Annotation<Record<string, string>>({
    default: () => ({}),
    reducer: (a, b) => ({ ...a, ...b }),
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  status: Annotation<'running' | 'awaiting_review' | 'complete' | 'failed'>({
    default: () => 'running',
    reducer: (_a, b) => b,
  }),
  reviewFeedback: Annotation<ReviewFeedback | null>({
    default: () => null,
    reducer: (_a, b) => b,
  }),
  iterationCount: Annotation<number>({
    default: () => 0,
    reducer: (_a, b) => b,
  }),
  draftProductId: Annotation<string | null>({
    default: () => null,
    reducer: (_a, b) => b,
  }),
});

type AIRoleStateType = typeof AIRoleStateAnnotation.State;

// ─── Store Context ────────────────────────────────────────────────────────────

export type StoreContext = {
  aiRunStore: AIRunStore;
  aiChannelStore: AIChannelStore;
  productVersionStore: ProductVersionStore;
  aiContextStore: AIContextStore;
};

// ─── Node Functions ───────────────────────────────────────────────────────────

/**
 * assembleContextNode: loads agent team, shared context, and current products.
 * Emits task_started channel event.
 */
function assembleContextNode(stores: StoreContext) {
  return async (state: AIRoleStateType): Promise<Partial<AIRoleStateType>> => {
    const { scenarioId, roleKey, runId } = state;

    // Load default agent team for this role
    const agentTeam = getDefaultAgentsForRole(roleKey);

    // Load shared context from AIContextStore
    const sharedContext = await stores.aiContextStore.readAll(scenarioId);

    // Emit task_started channel event
    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'task_started',
      payload: {
        agentCount: agentTeam.length,
        agents: agentTeam.map(a => ({ name: a.name, focus: a.focus })),
      },
    });

    return {
      agentTeam,
      sharedContext,
      messages: [
        new HumanMessage(`Starting AI run for ${roleKey} with ${agentTeam.length} agents.`),
      ],
    };
  };
}

/**
 * runAgentsNode: invokes each agent in parallel using Promise.all.
 * Emits task_progress events. MAX_ITERATIONS = 3.
 */
function runAgentsNode(stores: StoreContext) {
  return async (state: AIRoleStateType): Promise<Partial<AIRoleStateType>> => {
    const { scenarioId, roleKey, runId, agentTeam, sharedContext, triggerContext, iterationCount } = state;

    // MAX_ITERATIONS guard: if exceeded, skip agent execution and go to review
    if (iterationCount >= MAX_ITERATIONS) {
      await stores.aiChannelStore.create({
        scenarioId,
        roleKey,
        runId,
        eventType: 'task_progress',
        payload: { phase: 'max_iterations_reached', iterationCount, escalated: true },
      });
      return {
        draftContent: {
          ...state.draftContent,
          escalation_notice: `Maximum iteration limit (${MAX_ITERATIONS}) reached. Human review required to proceed or approve the current draft.`,
        },
      };
    }

    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'task_progress',
      payload: { phase: 'agents_starting', iterationCount, agentCount: agentTeam.length },
    });

    // Context summary to pass to each agent
    const contextSummary = JSON.stringify({
      scenarioId,
      roleKey,
      triggerContext,
      sharedContext: Object.keys(sharedContext).length > 0 ? sharedContext : undefined,
      currentProducts: state.currentProducts?.length > 0 ? `${state.currentProducts.length} existing products` : 'no existing products',
    }, null, 2);

    // Fan-out: invoke all agents in parallel
    const agentDrafts = await Promise.all(
      agentTeam.map(async (agent) => {
        try {
          const llm = await createLLMForAgent({ agentId: `ai-role-${roleKey}-${agent.id}` });
          const systemMessage = { role: 'system' as const, content: agent.systemPromptHint };
          const userMessage = {
            role: 'user' as const,
            content: `${agent.focus}\n\nScenario Context:\n${contextSummary}`,
          };

          const response = await llm.invoke([systemMessage, userMessage]);
          const content = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

          return { agentName: agent.name, agentId: agent.id, content, success: true };
        } catch (err) {
          return {
            agentName: agent.name,
            agentId: agent.id,
            content: `Agent error: ${err instanceof Error ? err.message : String(err)}`,
            success: false,
          };
        }
      })
    );

    // Consolidate agent drafts
    const newDraftContent: Record<string, string> = {};
    for (const draft of agentDrafts) {
      newDraftContent[`agent_${draft.agentId}`] = draft.content;
    }

    // Write agent contributions to shared context
    await stores.aiContextStore.write(scenarioId, roleKey, {
      lastRunAgents: agentTeam.map(a => a.name),
      lastRunIteration: iterationCount,
    });

    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'task_progress',
      payload: {
        phase: 'agents_complete',
        agentsSucceeded: agentDrafts.filter(d => d.success).length,
        agentsFailed: agentDrafts.filter(d => !d.success).length,
      },
    });

    return {
      draftContent: newDraftContent,
    };
  };
}

/**
 * mergeDraftsNode: consolidates per-agent draftContent into a combined product draft.
 * Saves draft via ProductVersionStore. Emits draft_ready channel event.
 */
function mergeDraftsNode(stores: StoreContext) {
  return async (state: AIRoleStateType): Promise<Partial<AIRoleStateType>> => {
    const { scenarioId, roleKey, runId, draftContent, agentTeam } = state;

    // Merge all agent drafts into a single product draft
    const sections: string[] = [];
    for (const agent of agentTeam) {
      const agentDraft = draftContent[`agent_${agent.id}`];
      if (agentDraft) {
        sections.push(`### ${agent.name} (${agent.focus})\n\n${agentDraft}`);
      }
    }

    // Check for escalation notice
    if (draftContent.escalation_notice) {
      sections.push(`### Escalation Notice\n\n${draftContent.escalation_notice}`);
    }

    const mergedContent = sections.join('\n\n---\n\n');

    // Save a version snapshot
    let draftProductId: string | null = state.draftProductId;
    try {
      const productType = `${roleKey}_ai_draft`;
      // Derive a stable product ID from scenario+role (not runId) so it survives iterations
      if (!draftProductId) {
        const { createHash } = await import('crypto');
        draftProductId = createHash('sha256')
          .update(`${scenarioId}:${roleKey}:ai_draft`)
          .digest('hex')
          .slice(0, 36);
      }
      // Ensure the parent staff_products row exists (idempotent)
      await stores.productVersionStore.ensureProduct(
        draftProductId, scenarioId, roleKey, productType, 'agent:ai-role-graph'
      );
      const versionEntry = await stores.productVersionStore.create({
        productId: draftProductId,
        version: state.iterationCount + 1,
        content: mergedContent,
        structured: {
          roleKey,
          agentCount: agentTeam.length,
          productType,
          iterationCount: state.iterationCount,
        },
        createdBy: `agent:ai-role-graph`,
        revisionNotes: state.iterationCount > 0 ? `Revision iteration ${state.iterationCount + 1}` : undefined,
      });
      draftProductId = versionEntry.productId;
    } catch (err) {
      console.error('[ai-role-graph] Failed to save product version:', err);
    }

    // Emit draft_ready channel event
    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'draft_ready',
      payload: {
        draftProductId,
        contentLength: mergedContent.length,
        sections: sections.length,
        iterationCount: state.iterationCount,
      },
    });

    return {
      draftProductId,
      draftContent: { ...state.draftContent, merged: mergedContent },
    };
  };
}

/**
 * awaitReviewNode: performs three actions before calling interrupt():
 * 1. Emits review_required channel event (surfaces in channel feed)
 * 2. Updates ai_role_runs status to 'awaiting_review'
 * 3. Dispatches a system notification via the existing MessageBus layer
 *    (surfaces in notification tray AND triggers product panel "Pending Review" badge)
 * 4. Calls interrupt({ type: 'product_review', runId })
 */
function awaitReviewNode(stores: StoreContext) {
  return async (state: AIRoleStateType): Promise<Partial<AIRoleStateType>> => {
    const { scenarioId, roleKey, runId, draftContent, iterationCount } = state;

    const productType = draftContent ? Object.keys(draftContent).filter(k => k !== 'merged')[0] ?? 'product' : 'product';

    // 1. Emit review_required channel event
    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'review_required',
      payload: {
        draftProductId: state.draftProductId,
        productType,
        iterationCount,
        message: `AI-generated ${roleKey} product is ready for review`,
      },
    });

    // 2. Update run status to awaiting_review
    await stores.aiRunStore.updateStatus(runId, 'awaiting_review');

    // 3. Dispatch system notification via MessageBus (surfaces in notification tray + product badge)
    const bus = getMessageBus();
    try {
      await bus.publish({
        sourceDid: GRAPH_SYSTEM_DID,
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: `exercise.staff.${scenarioId}`,
        messageType: 'staff.ai.review_required',
        payload: {
          type: 'review_required',
          scenarioId,
          roleKey,
          runId,
          message: `AI-generated ${roleKey} product is ready for review`,
          productType,
          draftProductId: state.draftProductId,
          iterationCount,
        },
      });
    } catch (err) {
      // Advisory only — do not fail the review gate
      console.error('[ai-role-graph] Failed to publish review_required notification:', err);
    }

    // 4. Pause execution for human review
    interrupt({ type: 'product_review', runId, scenarioId, roleKey });

    return {
      status: 'awaiting_review',
    };
  };
}

/**
 * routeReviewDecision: reads state.reviewFeedback.action → returns 'approved' | 'revision' | 'rejected'
 */
function routeReviewDecision(state: AIRoleStateType): 'approved' | 'revision' | 'rejected' {
  const action = state.reviewFeedback?.action;
  if (!action) return 'revision'; // Default to revision if no feedback (shouldn't happen)
  if (action === 'approve' || action === 'edit_approve') return 'approved';
  if (action === 'reject') return 'rejected';
  return 'revision'; // 'request_revision' | 'edit_request_revision'
}

/**
 * handleApprovedNode: publishes the latest draft as the official staff product.
 * Emits approved channel event. Updates run status to 'complete'.
 */
function handleApprovedNode(stores: StoreContext) {
  return async (state: AIRoleStateType): Promise<Partial<AIRoleStateType>> => {
    const { scenarioId, roleKey, runId, reviewFeedback } = state;

    // Apply any human edits if provided
    if (reviewFeedback?.edits && Object.keys(reviewFeedback.edits).length > 0) {
      // Save a final version with the human edits incorporated
      try {
        await stores.productVersionStore.create({
          productId: state.draftProductId ?? runId,
          version: (state.iterationCount + 2), // +2 to differentiate from AI draft
          content: Object.values(reviewFeedback.edits).join('\n\n'),
          structured: {
            roleKey,
            humanEdited: true,
            iterationCount: state.iterationCount,
          },
          createdBy: 'human:reviewer',
          revisionNotes: reviewFeedback.notes ?? 'Human-edited and approved',
        });
      } catch (err) {
        console.error('[ai-role-graph] Failed to save human-edited version:', err);
      }
    }

    // Emit approved channel event
    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'approved',
      payload: {
        draftProductId: state.draftProductId,
        notes: reviewFeedback?.notes,
        hadEdits: Boolean(reviewFeedback?.edits && Object.keys(reviewFeedback.edits).length > 0),
      },
    });

    // Update run status to complete
    await stores.aiRunStore.updateStatus(runId, 'complete', { completedAt: new Date() });

    return {
      status: 'complete',
    };
  };
}

/**
 * handleRevisionNode: stores revision feedback, increments iterationCount.
 * Emits revision_requested channel event. Loops back to run_agents.
 */
function handleRevisionNode(stores: StoreContext) {
  return async (state: AIRoleStateType): Promise<Partial<AIRoleStateType>> => {
    const { scenarioId, roleKey, runId, reviewFeedback, iterationCount } = state;

    // Save annotated feedback as a new version entry
    if (reviewFeedback?.annotations || reviewFeedback?.notes) {
      try {
        await stores.productVersionStore.create({
          productId: state.draftProductId ?? runId,
          version: iterationCount + 1,
          content: state.draftContent.merged ?? '',
          structured: {
            roleKey,
            iterationCount,
            revisionRequested: true,
          },
          createdBy: 'human:reviewer',
          revisionNotes: reviewFeedback.notes ?? 'Revision requested',
          annotatedFeedback: reviewFeedback.annotations,
        });
      } catch (err) {
        console.error('[ai-role-graph] Failed to save revision feedback version:', err);
      }
    }

    // Emit revision_requested channel event
    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'revision_requested',
      payload: {
        iterationCount,
        notes: reviewFeedback?.notes,
        annotationCount: reviewFeedback?.annotations?.length ?? 0,
      },
    });

    const newIterationCount = iterationCount + 1;

    return {
      iterationCount: newIterationCount,
      reviewFeedback: null,
      status: 'running',
    };
  };
}

/**
 * handleRejectedNode: emits rejected channel event. Updates run status to 'complete' (with rejection reason).
 */
function handleRejectedNode(stores: StoreContext) {
  return async (state: AIRoleStateType): Promise<Partial<AIRoleStateType>> => {
    const { scenarioId, roleKey, runId, reviewFeedback } = state;

    // Emit rejected channel event
    await stores.aiChannelStore.create({
      scenarioId,
      roleKey,
      runId,
      eventType: 'rejected',
      payload: {
        draftProductId: state.draftProductId,
        reason: reviewFeedback?.notes ?? 'Rejected by reviewer',
      },
    });

    // Update run status to complete (with rejection reason as error)
    await stores.aiRunStore.updateStatus(runId, 'complete', {
      completedAt: new Date(),
      error: reviewFeedback?.notes ? `Rejected: ${reviewFeedback.notes}` : 'Rejected',
    });

    return {
      status: 'complete',
    };
  };
}

// ─── Graph Factory ────────────────────────────────────────────────────────────

export async function createAIRoleGraph(
  checkpointer: PostgresSaver,
  stores: StoreContext
) {
  const graph = new StateGraph(AIRoleStateAnnotation)
    .addNode('assemble_context', assembleContextNode(stores))
    .addNode('run_agents', runAgentsNode(stores))
    .addNode('merge_drafts', mergeDraftsNode(stores))
    .addNode('await_review', awaitReviewNode(stores))
    .addNode('handle_approved', handleApprovedNode(stores))
    .addNode('handle_revision', handleRevisionNode(stores))
    .addNode('handle_rejected', handleRejectedNode(stores))
    .addEdge(START, 'assemble_context')
    .addEdge('assemble_context', 'run_agents')
    .addEdge('run_agents', 'merge_drafts')
    .addEdge('merge_drafts', 'await_review')
    .addConditionalEdges('await_review', routeReviewDecision, {
      approved: 'handle_approved',
      revision: 'handle_revision',
      rejected: 'handle_rejected',
    })
    .addEdge('handle_approved', END)
    .addEdge('handle_rejected', END)
    .addEdge('handle_revision', 'run_agents'); // Revision loops back

  return graph.compile({ checkpointer });
}

export async function runAIRoleGraph(
  checkpointer: PostgresSaver,
  stores: StoreContext,
  initialState: {
    scenarioId: string;
    roleKey: string;
    runId: string;
    triggerContext: Record<string, unknown>;
  }
): Promise<void> {
  const graph = await createAIRoleGraph(checkpointer, stores);
  const config = { configurable: { thread_id: initialState.runId } };
  await graph.invoke({
    ...initialState,
    status: 'running' as const,
    iterationCount: 0,
  }, config);
}
