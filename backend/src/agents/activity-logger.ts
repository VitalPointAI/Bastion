/**
 * Agent Activity Logger
 *
 * Convenience singleton wrapper over ActivityStore.
 * Provides typed methods for every action type in the system.
 *
 * Design principles:
 * - All log calls are fire-and-forget (setImmediate) — never block the hot path
 * - Errors are swallowed silently after logging to console
 * - Truncates input/output to 500 chars to keep storage reasonable
 */

import { getActivityStore } from './activity-store.js';
import type { ActivityEntryInput, ActivityActionType } from './activity-store.js';

const MAX_SUMMARY_LENGTH = 500;

function truncate(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > MAX_SUMMARY_LENGTH ? str.slice(0, MAX_SUMMARY_LENGTH) + '...' : str;
}

function logAsync(entry: ActivityEntryInput): void {
  setImmediate(() => {
    getActivityStore()
      .insert(entry)
      .catch((err) => {
        console.error('[ActivityLogger] Failed to persist activity entry:', err);
      });
  });
}

// ============================================================================
// AgentActivityLogger
// ============================================================================

class AgentActivityLogger {
  /**
   * Log an LLM invocation by a LangGraph agent.
   */
  logAgentExecution(
    agentId: string,
    agentName: string | undefined,
    input: unknown,
    output: unknown,
    durationMs: number,
    status: 'success' | 'error',
    metadata?: Record<string, unknown>,
    context?: { teamId?: string; teamName?: string; problemSetId?: string }
  ): void {
    logAsync({
      agentId,
      agentName,
      teamId: context?.teamId,
      teamName: context?.teamName,
      problemSetId: context?.problemSetId,
      actionType: 'llm_invocation' as ActivityActionType,
      actionDetail: `${agentName ?? agentId} executed LLM invocation`,
      inputSummary: truncate(input),
      outputSummary: truncate(output),
      durationMs,
      status,
      metadata: metadata ?? {},
    });
  }

  /**
   * Log an MCP tool call by an agent.
   */
  logToolCall(
    agentId: string,
    agentName: string | undefined,
    toolName: string,
    input: unknown,
    output: unknown,
    durationMs: number,
    status: 'success' | 'error',
    context?: { teamId?: string; problemSetId?: string }
  ): void {
    logAsync({
      agentId,
      agentName,
      teamId: context?.teamId,
      problemSetId: context?.problemSetId,
      actionType: 'tool_call' as ActivityActionType,
      actionDetail: `Tool: ${toolName}`,
      inputSummary: truncate(input),
      outputSummary: truncate(output),
      durationMs,
      status,
      metadata: { toolName },
    });
  }

  /**
   * Log an Ironclaw message — either inbound from user or outbound from agent.
   */
  logIronclawMessage(
    direction: 'inbound' | 'outbound',
    agentId: string,
    content: string,
    problemSetId: string | undefined,
    metadata?: Record<string, unknown>
  ): void {
    const actionType: ActivityActionType = direction === 'inbound'
      ? 'message_received'
      : 'message_sent';

    logAsync({
      agentId,
      agentName: direction === 'inbound' ? 'user' : agentId,
      problemSetId,
      actionType,
      actionDetail: direction === 'inbound' ? 'User message received' : 'Agent response sent',
      inputSummary: direction === 'inbound' ? truncate(content) : undefined,
      outputSummary: direction === 'outbound' ? truncate(content) : undefined,
      status: 'success',
      metadata: metadata ?? {},
    });
  }

  /**
   * Log an Ironclaw action card presentation or decision.
   */
  logActionCard(
    agentId: string,
    actionType: string,
    riskLevel: string,
    decision: string,
    problemSetId: string | undefined
  ): void {
    logAsync({
      agentId,
      problemSetId,
      actionType: 'action_card' as ActivityActionType,
      actionDetail: `Action card: ${actionType} (${riskLevel}) — ${decision}`,
      status: 'success',
      metadata: { actionType, riskLevel, decision },
    });
  }

  /**
   * Log agent-to-agent delegation.
   */
  logDelegation(
    agentId: string,
    targetAgentId: string,
    taskDescription: string,
    problemSetId: string | undefined
  ): void {
    logAsync({
      agentId,
      problemSetId,
      actionType: 'delegation' as ActivityActionType,
      actionDetail: `Delegated to ${targetAgentId}: ${taskDescription.slice(0, 100)}`,
      status: 'success',
      metadata: { targetAgentId, taskDescription: taskDescription.slice(0, 200) },
    });
  }

  /**
   * Log supervisor routing a task to a specific agent.
   */
  logSupervisorDispatch(
    supervisorId: string,
    targetAgentId: string,
    teamId: string | undefined,
    reason: string | undefined
  ): void {
    logAsync({
      agentId: supervisorId,
      teamId,
      actionType: 'team_dispatch' as ActivityActionType,
      actionDetail: `Dispatched to ${targetAgentId}${reason ? ': ' + reason : ''}`,
      status: 'success',
      metadata: { targetAgentId, reason },
    });
  }

  /**
   * Log a doc-intel specialist handoff.
   */
  logSpecialistHandoff(
    fromAgentId: string,
    toAgentId: string,
    teamId: string | undefined,
    stage: string
  ): void {
    logAsync({
      agentId: fromAgentId,
      teamId,
      actionType: 'specialist_handoff' as ActivityActionType,
      actionDetail: `Handoff to ${toAgentId} at stage: ${stage}`,
      status: 'success',
      metadata: { toAgentId, stage },
    });
  }

  /**
   * Log a human checkpoint trigger.
   */
  logCheckpoint(
    agentId: string,
    checkpointType: string,
    threadId: string | undefined
  ): void {
    logAsync({
      agentId,
      actionType: 'checkpoint' as ActivityActionType,
      actionDetail: `Checkpoint triggered: ${checkpointType}`,
      status: 'pending',
      metadata: { checkpointType, threadId },
    });
  }

  /**
   * Log an agent execution error.
   */
  logError(
    agentId: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    logAsync({
      agentId,
      actionType: 'error' as ActivityActionType,
      actionDetail: `Error: ${errorMessage.slice(0, 200)}`,
      status: 'error',
      metadata: {
        error: errorMessage,
        stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
        ...context,
      },
    });
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _activityLogger: AgentActivityLogger | null = null;

export function getActivityLogger(): AgentActivityLogger {
  if (!_activityLogger) {
    _activityLogger = new AgentActivityLogger();
  }
  return _activityLogger;
}

export { AgentActivityLogger };
