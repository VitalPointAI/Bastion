/**
 * Ironclaw Task Orchestrator
 *
 * Phase 52 Plan 05: Core orchestration service bridging Ironclaw chat with
 * agent execution. Manages the full task lifecycle: create, dispatch, collect
 * results, present suggestions, handle approval/refinement, and apply.
 */

import { getTaskStore } from './task-store.js';
import type { TaskStore } from './task-store.js';
import type {
  IronclawTask,
  CreateTaskParams,
  StepInfo,
  TaskResult,
  TaskSuggestion,
} from './task-types.js';
import { ironclawStore } from './ironclaw-store.js';
import { getAgentRegistry } from '../agents/registry.js';
import { getMessageBus } from '../messaging/message-bus.js';
import type { StepProgressData, SuggestionPayload } from './ironclaw-types.js';
import { ironclawClient } from './ironclaw-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const SERVICE_DID = 'did:system:ironclaw-service';

/** Strict pattern for channel names — prevents path traversal and injection. */
const CHANNEL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

async function publishToChannel(
  problemSetId: string,
  messageType: string,
  payload: unknown,
): Promise<void> {
  try {
    if (!CHANNEL_NAME_PATTERN.test(problemSetId)) {
      throw new Error(`Invalid problemSetId for channel: "${problemSetId}"`);
    }
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: SERVICE_DID,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: `ironclaw.${problemSetId}`,
      messageType,
      payload,
    });
  } catch (err) {
    console.error(`[task-orchestrator] WebSocket publish error (${messageType}):`, err);
  }
}

// ---------------------------------------------------------------------------
// TaskOrchestrator
// ---------------------------------------------------------------------------

export class TaskOrchestrator {
  private taskStore: TaskStore;

  constructor() {
    this.taskStore = getTaskStore();
  }

  /**
   * Create a new task from Ironclaw chat detection.
   * Builds steps from targetFields, selects agents, persists task.
   */
  async createTask(params: CreateTaskParams): Promise<IronclawTask> {
    const taskId = generateId('task');

    // Build steps: one per target field + final synthesis step
    const fieldEntries = Object.entries(params.targetFields);
    const steps: StepInfo[] = [
      ...fieldEntries.map((entry, i) => ({
        index: i,
        label: `Analyze: ${entry[1]}`,
        status: 'pending' as const,
      })),
      {
        index: fieldEntries.length,
        label: 'Synthesize Results',
        status: 'pending' as const,
      },
    ];

    // Select agents: use team members if team specified, hints, or registry
    let assignedAgents = params.agentHints ?? [];
    let assignedTeam: string | null = params.teamId ?? null;

    if (assignedTeam) {
      // Team assignment: pull team members as assigned agents
      try {
        const { getTeamStore } = await import('../agents/team-store.js');
        const teamStore = getTeamStore();
        const team = await teamStore.getTeam(assignedTeam);
        if (team && Array.isArray(team.members)) {
          assignedAgents = team.members.map((m: { agentId: string }) => m.agentId);
          console.log(`[task-orchestrator] Team ${assignedTeam} assigned with ${assignedAgents.length} members`);
        } else {
          console.warn(`[task-orchestrator] Team ${assignedTeam} not found or has no members`);
          assignedTeam = null;
        }
      } catch (err) {
        console.warn('[task-orchestrator] Team lookup failed:', err);
        assignedTeam = null;
      }
    }

    if (assignedAgents.length === 0) {
      try {
        const registry = getAgentRegistry();
        const allAgents = registry.listAgents();
        // Pick up to 3 registered agents
        const selected = allAgents.slice(0, 3);
        assignedAgents = selected.map((a) => a.agentId);
      } catch {
        // Registry not available — proceed without agents
        console.warn('[task-orchestrator] Could not query agent registry for task assignment');
      }
    }

    const task: IronclawTask = {
      taskId,
      problemSetId: params.problemSetId,
      userDid: params.userDid,
      title: params.title,
      description: params.description ?? null,
      status: 'created',
      assignedAgents,
      assignedTeam,
      threadId: null,
      steps,
      currentStep: 0,
      results: [],
      suggestions: [],
      targetFields: params.targetFields,
      userFeedback: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };

    return this.taskStore.createTask(task);
  }

  /**
   * Dispatch a task for agent execution.
   * Non-blocking: returns immediately, work proceeds in background.
   */
  async dispatchTask(taskId: string): Promise<void> {
    const task = await this.taskStore.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    await this.taskStore.updateTaskStatus(taskId, 'dispatched');

    const threadId = generateId('thread');
    await this.taskStore.updateThreadId(taskId, threadId);

    // Transition to agent_working
    await this.taskStore.updateTaskStatus(taskId, 'agent_working');

    // Execute steps sequentially in background
    setImmediate(async () => {
      try {
        for (let i = 0; i < task.steps.length; i++) {
          await this.taskStore.updateTaskStep(taskId, i, {
            status: 'running',
            startedAt: new Date().toISOString(),
          });

          // Publish step progress
          const updatedTask = await this.taskStore.getTask(taskId);
          if (updatedTask) {
            await this.publishStepProgress(updatedTask);
          }

          // Simulate agent work — in production this would call BastionSupervisor
          // For now, each step produces a result based on the target field
          const step = task.steps[i];
          const result = await this.executeStep(task, step, i);

          await this.taskStore.updateTaskStep(taskId, i, {
            status: 'complete',
            completedAt: new Date().toISOString(),
            result,
          });

          if (result) {
            await this.handleStepComplete(taskId, i, result);
          }
        }

        await this.collectResults(taskId);
      } catch (err) {
        console.error(`[task-orchestrator] Task dispatch failed: ${taskId}`, err);
        try {
          await this.taskStore.updateTaskStatus(taskId, 'failed');
        } catch {
          // Status update also failed — task is in limbo, will be cleaned by init()
        }
      }
    });
  }

  /**
   * Execute a single step by delegating to Ironclaw via webhook.
   * Ironclaw has MCP tool access (graph queries, knowledge search, etc.)
   * and can perform the actual analysis work.
   */
  private async executeStep(
    task: IronclawTask,
    step: StepInfo,
    _stepIndex: number,
  ): Promise<string> {
    // The "Synthesize Results" step aggregates previous results
    if (step.label === 'Synthesize Results') {
      const currentTask = await this.taskStore.getTask(task.taskId);
      if (!currentTask) return 'Task not found during synthesis';
      const resultSummary = currentTask.results
        .map((r) => `${r.agentName}: ${r.output}`)
        .join('\n');
      return `Synthesis of ${currentTask.results.length} agent results:\n${resultSummary}`;
    }

    // Delegate to Ironclaw — it has MCP tools for graph/knowledge queries
    const agentId = task.assignedAgents[0] ?? 'ironclaw';
    // Resolve field path from task.targetFields by step index
    const fieldEntries = Object.entries(task.targetFields);
    const fieldPath = fieldEntries[_stepIndex]?.[0] ?? step.label;

    const prompt = [
      `[INTERNAL TASK — do NOT output task_request JSON, respond with analysis only]`,
      `You are acting as ${agentId} for task: "${task.title}"`,
      task.description ? `Task description: ${task.description}` : '',
      ``,
      `Produce analysis for: "${step.label}" (target field: ${fieldPath})`,
      ``,
      `Use your MCP tools (bastion_knowledge_search, bastion_graph_query, etc.) to pull relevant data from the knowledge graph.`,
      `Respond with ONLY the analysis content — structured markdown suitable for an operational briefing.`,
      `Do not include JSON, do not create sub-tasks, do not ask follow-up questions.`,
    ].filter(Boolean).join('\n');

    try {
      const client = ironclawClient;
      // Use a dedicated thread so task execution doesn't pollute user conversation
      const taskThreadId = `task-${task.taskId}-step-${_stepIndex}`;
      const result = await client.sendMessage(taskThreadId, prompt);

      if (result.response) {
        // Strip any accidental JSON wrappers from the response
        let content = result.response;
        try {
          const parsed = JSON.parse(content) as Record<string, unknown>;
          content = (parsed.content as string) ?? (parsed.text as string) ?? content;
        } catch {
          // Not JSON — use as-is
        }
        return content;
      }

      return `Agent ${agentId} did not return a response for "${step.label}"`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[task-orchestrator] Step execution failed for "${step.label}":`, msg);
      return `Analysis for "${step.label}" could not be completed: ${msg}`;
    }
  }

  /**
   * Handle completion of a task step.
   * Updates step, advances currentStep, publishes progress.
   */
  async handleStepComplete(taskId: string, stepIdx: number, result: unknown): Promise<void> {
    const task = await this.taskStore.getTask(taskId);
    if (!task) return;

    // Record result
    const agentId = task.assignedAgents[0] ?? 'ironclaw';
    const taskResult: TaskResult = {
      agentId,
      agentName: agentId,
      output: typeof result === 'string' ? result : JSON.stringify(result),
      fieldPath: Object.keys(task.targetFields)[stepIdx],
      timestamp: new Date().toISOString(),
    };
    await this.taskStore.addTaskResult(taskId, taskResult);

    // Publish updated progress
    const updatedTask = await this.taskStore.getTask(taskId);
    if (updatedTask) {
      await this.publishStepProgress(updatedTask);
    }
  }

  /**
   * Collect results from all steps and generate suggestions.
   */
  private async collectResults(taskId: string): Promise<void> {
    await this.taskStore.updateTaskStatus(taskId, 'collecting_results');

    const task = await this.taskStore.getTask(taskId);
    if (!task) return;

    // Generate a suggestion per target field from results
    for (const [fieldPath, fieldLabel] of Object.entries(task.targetFields)) {
      const fieldResult = task.results.find((r) => r.fieldPath === fieldPath);
      if (!fieldResult) continue;

      const suggestion: TaskSuggestion = {
        id: generateId('sug'),
        fieldPath,
        fieldLabel,
        content: fieldResult.output,
        agentId: fieldResult.agentId,
        status: 'pending',
      };
      await this.taskStore.addTaskSuggestion(taskId, suggestion);
    }

    await this.presentResults(taskId);
  }

  /**
   * Present task results as suggestion cards in the Ironclaw drawer.
   */
  async presentResults(taskId: string): Promise<void> {
    await this.taskStore.updateTaskStatus(taskId, 'presenting');

    const task = await this.taskStore.getTask(taskId);
    if (!task) return;

    await this.taskStore.updateTaskStatus(taskId, 'awaiting_approval');

    // Emit each suggestion as an ironclaw.response with SuggestionPayload
    for (const suggestion of task.suggestions) {
      const payload: SuggestionPayload = {
        id: suggestion.id,
        content: suggestion.content,
        agent_id: suggestion.agentId,
        agent_display_name: suggestion.agentId,
        target_field: suggestion.fieldPath,
        target_field_label: suggestion.fieldLabel,
        field_value: suggestion.content,
      };

      // Persist as a chat message with suggestion
      const chatMsg = await ironclawStore.addMessage({
        problem_set_id: task.problemSetId,
        content: `Suggestion for ${suggestion.fieldLabel}: ${suggestion.content}`,
        sender: 'specialist',
        specialist_id: suggestion.agentId,
        specialist_display_name: suggestion.agentId,
        delegated_by: 'ironclaw',
        action_card: null,
        step_progress: null,
        suggestion: payload,
      });

      await publishToChannel(task.problemSetId, 'ironclaw.response', chatMsg);
    }

    // Summary message
    const summaryMsg = await ironclawStore.addMessage({
      problem_set_id: task.problemSetId,
      content: `Task "${task.title}" complete. ${task.suggestions.length} suggestion(s) ready for review.`,
      sender: 'ironclaw',
      specialist_id: null,
      specialist_display_name: null,
      delegated_by: null,
      action_card: null,
      step_progress: null,
      suggestion: null,
    });

    await publishToChannel(task.problemSetId, 'ironclaw.response', summaryMsg);
  }

  /**
   * Handle user approval or dismissal of a suggestion.
   */
  async handleApproval(
    taskId: string,
    suggestionId: string,
    decision: 'approved' | 'dismissed',
  ): Promise<void> {
    await this.taskStore.updateSuggestionStatus(taskId, suggestionId, decision);

    const task = await this.taskStore.getTask(taskId);
    if (!task) return;

    // Check if all suggestions are resolved
    const allResolved = task.suggestions.every(
      (s) => s.status === 'approved' || s.status === 'dismissed',
    );

    if (allResolved) {
      await this.applyApproved(taskId);
    }
  }

  /**
   * Handle refinement feedback from user.
   * Records feedback and re-dispatches the task.
   */
  async handleRefinement(
    taskId: string,
    feedback: string,
    suggestionId?: string,
  ): Promise<void> {
    await this.taskStore.addFeedback(taskId, {
      timestamp: new Date().toISOString(),
      feedback,
      suggestionId,
    });

    await this.taskStore.updateTaskStatus(taskId, 'refining');

    // Re-dispatch with feedback context
    // The task's userFeedback array now includes the feedback,
    // which the dispatch step can incorporate into the agent prompt
    await this.dispatchTask(taskId);
  }

  /**
   * Apply all approved suggestions by dispatching field writes.
   */
  async applyApproved(taskId: string): Promise<void> {
    await this.taskStore.updateTaskStatus(taskId, 'applying');

    const task = await this.taskStore.getTask(taskId);
    if (!task) return;

    const approved = task.suggestions.filter((s) => s.status === 'approved');

    // Publish approval progress
    for (const suggestion of approved) {
      await publishToChannel(task.problemSetId, 'ironclaw.task-field-applied', {
        taskId,
        suggestionId: suggestion.id,
        fieldPath: suggestion.fieldPath,
        fieldLabel: suggestion.fieldLabel,
      });
    }

    await this.taskStore.updateTaskStatus(taskId, 'completed');

    // Emit completion message
    const chatMsg = await ironclawStore.addMessage({
      problem_set_id: task.problemSetId,
      content: `Task "${task.title}" completed. ${approved.length} field(s) applied.`,
      sender: 'ironclaw',
      specialist_id: null,
      specialist_display_name: null,
      delegated_by: null,
      action_card: null,
      step_progress: null,
      suggestion: null,
    });

    await publishToChannel(task.problemSetId, 'ironclaw.response', chatMsg);
  }

  /**
   * Startup recovery: mark stale tasks as failed to prevent zombie tasks.
   */
  async init(): Promise<void> {
    const staleCount = await this.taskStore.markStaleTasks();
    if (staleCount > 0) {
      console.log(`[task-orchestrator] Marked ${staleCount} stale task(s) as failed on startup`);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private async publishStepProgress(task: IronclawTask): Promise<void> {
    const progressData: StepProgressData = {
      action_id: task.taskId,
      steps: task.steps.map((s) => ({
        label: s.label,
        status: s.status,
        started_at: s.startedAt ?? null,
        completed_at: s.completedAt ?? null,
      })),
      current_step: task.currentStep,
      started_at: task.createdAt.toISOString(),
    };

    await publishToChannel(task.problemSetId, 'ironclaw.step-progress', progressData);
  }

  /**
   * Create and dispatch a task assigned to a specific team.
   * Called by the bastion.team.assign_task MCP tool handler.
   */
  async assignTaskToTeam(
    teamId: string,
    taskDescription: string,
    problemSetId: string,
    userDid: string,
  ): Promise<IronclawTask> {
    const task = await this.createTask({
      problemSetId,
      userDid,
      title: taskDescription.slice(0, 80),
      description: taskDescription,
      targetFields: { 'task.output': 'Task Output' },
      teamId,
    });

    // Fire-and-forget dispatch
    void this.dispatchTask(task.taskId).catch((err) =>
      console.error(`[task-orchestrator] Team task dispatch failed:`, err),
    );

    return task;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: TaskOrchestrator | null = null;

export function getTaskOrchestrator(): TaskOrchestrator {
  if (!_instance) _instance = new TaskOrchestrator();
  return _instance;
}
