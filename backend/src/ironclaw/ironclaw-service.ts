/**
 * Ironclaw Orchestration Service
 *
 * Phase 30 Plan 02: Bridges frontend users to the Ironclaw sidecar.
 * Manages session lifecycle, message persistence, specialist delegation
 * attribution, and WebSocket forwarding.
 *
 * Ironclaw manages its own sessions/threads internally. The backend uses
 * thread_id (keyed by problem set) for conversation continuity.
 */

import { ironclawClient } from './ironclaw-client.js';
import { ironclawStore } from './ironclaw-store.js';
import { actionRegistry } from './action-registry.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { getAgentStore } from '../agents/agent-store.js';
import { getTeamStore } from '../agents/team-store.js';
import { getActivityLogger } from '../agents/activity-logger.js';
import type {
  IronclawChatMessage,
  ActionCardData,
  SuggestionPayload,
  StepProgressData,
} from './ironclaw-types.js';
import { SENSITIVE_FIELDS } from './ironclaw-types.js';
import { getTaskOrchestrator } from './task-orchestrator.js';

// ---------------------------------------------------------------------------
// Message Context
// ---------------------------------------------------------------------------

/**
 * Optional UI context sent with each message.
 * Allows Ironclaw to tailor responses based on what the user is currently
 * viewing (tab, problem set, role).
 */
export interface MessageContext {
  currentTab?: string;
  problemSetId?: string;
  userRole?: string;
}

const SERVICE_DID = 'did:system:ironclaw-service';

// ---------------------------------------------------------------------------
// Global (non-problem-set) scope helpers
// ---------------------------------------------------------------------------

/**
 * Derive a DB-safe scope identifier for a user's global conversation.
 * Stored in problem_set_id column — keeps existing schema unchanged.
 */
function globalScopeId(userDid: string): string {
  // Replace non-alphanumeric chars to make it safe for channel names too
  return `_global_${userDid.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Derive a WebSocket channel name for a user's global conversation.
 * Must match CHANNEL_NAME_PATTERN.
 */
function globalChannelId(userDid: string): string {
  return globalScopeId(userDid);
}

// ---------------------------------------------------------------------------
// WebSocket channel helper
// ---------------------------------------------------------------------------

/** Strict pattern for channel names — prevents path traversal and injection. */
const CHANNEL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function wsChannel(problemSetId: string): string {
  if (!CHANNEL_NAME_PATTERN.test(problemSetId)) {
    throw new Error(
      `[ironclaw] Invalid problemSetId for channel name: "${problemSetId}". ` +
      'Must match [a-zA-Z0-9_-]+.',
    );
  }
  return `ironclaw.${problemSetId}`;
}

async function publishToChannel(
  problemSetId: string,
  messageType: string,
  payload: unknown,
): Promise<void> {
  try {
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: SERVICE_DID,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: wsChannel(problemSetId),
      messageType,
      payload,
    });
  } catch (err) {
    // Non-blocking: log but don't fail the message flow
    console.error(`[ironclaw] WebSocket publish error (${messageType}):`, err);
  }
}

// ---------------------------------------------------------------------------
// IronclawService
// ---------------------------------------------------------------------------

export class IronclawService {
  /**
   * Handle an incoming user message:
   * 1. Get or create session (for thread_id tracking)
   * 2. Persist user message
   * 3. Send to Ironclaw webhook and wait for response
   * 4. Parse response for specialist delegation / action cards
   * 5. Persist and forward via WebSocket
   */
  async handleMessage(
    problemSetId: string,
    userDid: string,
    content: string,
    context?: MessageContext,
  ): Promise<void> {
    // 1. Get or create local session — uses problemSetId as thread_id
    const session = await ironclawStore.getOrCreateSession(problemSetId, userDid);

    // 2. Persist user message (original content, without context prefix)
    const userMsg = await ironclawStore.addMessage({
      problem_set_id: problemSetId,
      content,
      sender: 'user',
      specialist_id: null,
      specialist_display_name: null,
      delegated_by: null,
      action_card: null,
      step_progress: null,
      suggestion: null,
    });

    // Publish user message to WebSocket
    await publishToChannel(problemSetId, 'ironclaw.user-message', userMsg);

    // Log inbound user message to activity audit trail
    getActivityLogger().logIronclawMessage('inbound', 'ironclaw', content, problemSetId);

    // 3. Build context-prefixed message for Ironclaw (if context provided)
    // The prefix helps Ironclaw tailor responses to the current UI state.
    // The original content is persisted; only the enriched version is sent to the AI.
    const messageForAi = context
      ? `[Context: tab=${context.currentTab ?? 'unknown'}, problemSet=${context.problemSetId ?? 'none'}, role=${context.userRole ?? 'user'}]\n${content}`
      : content;

    // 4. Send to Ironclaw webhook (synchronous — waits for response)
    const result = await ironclawClient.sendMessage(
      session.id,
      messageForAi,
    );

    // 5. Process the response
    if (result.response) {
      await this.processResponse(problemSetId, result.response);
    }
  }

  /**
   * Process a response string from Ironclaw.
   * Attempts JSON parse for structured responses (specialist delegation,
   * action cards). Falls back to plain text.
   */
  private async processResponse(
    problemSetId: string,
    responseText: string,
  ): Promise<void> {
    // Try to parse as structured JSON
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // Plain text response — not JSON
    }

    // Determine sender and specialist attribution
    const specialistId = (parsed?.specialist_id as string) ?? null;
    const specialistDisplayName =
      (parsed?.specialist_display_name as string) ?? null;
    const sender: IronclawChatMessage['sender'] = specialistId
      ? 'specialist'
      : 'ironclaw';
    const delegatedBy = specialistId ? 'ironclaw' : null;

    // Detect action card (tool_call in response)
    // Security: description and risk_level are generated by the backend from
    // the action registry, NOT from agent-supplied text, to prevent social
    // engineering via misleading action descriptions.
    let actionCard: ActionCardData | null = null;
    if (parsed?.tool_call) {
      const toolCall = parsed.tool_call as Record<string, unknown>;
      const actionType = (toolCall.action_type as string) ?? '';
      actionCard = {
        action_id: (toolCall.action_id as string) ?? '',
        action_type: actionType,
        description: actionRegistry.getDescription(actionType),
        risk_level: actionRegistry.getRiskLevel(actionType),
        options: (toolCall.options as ActionCardData['options']) ?? ['yes', 'no'],
      };
    }

    const messageContent = parsed
      ? (parsed.content as string) ?? (parsed.text as string) ?? responseText
      : responseText;

    // Detect suggestion (field write-back proposal)
    let suggestion: SuggestionPayload | null = null;
    if (parsed?.suggestion) {
      const s = parsed.suggestion as Record<string, unknown>;
      const targetField = (s.target_field as string) ?? null;
      suggestion = {
        id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content: (s.content as string) ?? messageContent,
        agent_id: (s.agent_id as string) ?? 'ironclaw',
        agent_display_name: (s.agent_display_name as string) ?? 'Ironclaw',
        target_field: targetField,
        target_field_label: (s.target_field_label as string) ?? null,
        field_value: (s.field_value as string) ?? null,
        // Flag sensitive fields so the frontend can show a Decision Gate notice
        ...(targetField && SENSITIVE_FIELDS.has(targetField) ? { risk: 'high' as const } : {}),
      };
    }

    // Detect task_request (orchestration loop trigger)
    if (parsed?.task_request) {
      const tr = parsed.task_request as Record<string, unknown>;
      const orchestrator = getTaskOrchestrator();
      const task = await orchestrator.createTask({
        problemSetId,
        userDid: 'did:system:ironclaw-service', // session user not in scope here
        title: (tr.title as string) ?? 'Untitled Task',
        description: (tr.description as string) ?? undefined,
        targetFields: (tr.target_fields as Record<string, string>) ?? {},
        agentHints: (tr.agent_hints as string[]) ?? [],
      });

      // Emit initial progress message
      const stepProgress: StepProgressData = {
        action_id: task.taskId,
        steps: task.steps.map((s) => ({
          label: s.label,
          status: s.status,
          started_at: null,
          completed_at: null,
        })),
        current_step: 0,
        started_at: new Date().toISOString(),
      };

      await ironclawStore.addMessage({
        problem_set_id: problemSetId,
        content: `Task created: ${task.title}. Dispatching agents...`,
        sender: 'ironclaw',
        specialist_id: null,
        specialist_display_name: null,
        delegated_by: null,
        action_card: null,
        step_progress: stepProgress,
        suggestion: null,
      });

      // Dispatch agents in background (non-blocking)
      orchestrator.dispatchTask(task.taskId).catch((err) =>
        console.error(`[ironclaw] Task dispatch failed: ${task.taskId}`, err),
      );
    }

    if (!messageContent && !actionCard) return;

    // 5. Persist the message
    const chatMsg = await ironclawStore.addMessage({
      problem_set_id: problemSetId,
      content: messageContent,
      sender,
      specialist_id: specialistId,
      specialist_display_name: specialistDisplayName,
      delegated_by: delegatedBy,
      action_card: actionCard,
      step_progress: null,
      suggestion,
    });

    // 6. Publish to WebSocket for real-time frontend updates
    await publishToChannel(problemSetId, 'ironclaw.response', chatMsg);

    // Log outbound agent response to activity audit trail
    getActivityLogger().logIronclawMessage(
      'outbound',
      specialistId ?? 'ironclaw',
      messageContent,
      problemSetId,
      specialistDisplayName ? { specialist: specialistDisplayName } : undefined
    );

    // Log action card if present
    if (actionCard) {
      getActivityLogger().logActionCard(
        specialistId ?? 'ironclaw',
        actionCard.action_type,
        actionCard.risk_level,
        'presented',
        problemSetId
      );
    }
  }

  /**
   * Get chat history for a problem set.
   */
  async getHistory(
    problemSetId: string,
    limit?: number,
  ): Promise<IronclawChatMessage[]> {
    return ironclawStore.getHistory(problemSetId, limit);
  }

  /**
   * Check if the Ironclaw sidecar is healthy.
   */
  async isHealthy(): Promise<boolean> {
    return ironclawClient.healthCheck();
  }

  /**
   * Startup initialization: wait for Ironclaw sidecar health.
   * Retries up to 3 times with 5-second delays since Ironclaw container may
   * start slower than the backend.
   */
  async startupInit(): Promise<void> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const healthy = await this.isHealthy();
        if (healthy) {
          console.log('[ironclaw-service] Startup init complete: ironclaw healthy');
          return;
        }
        console.warn(
          `[ironclaw-service] Health check failed (attempt ${attempt}/${MAX_RETRIES})`,
        );
      } catch (err) {
        console.warn(
          `[ironclaw-service] Startup init error (attempt ${attempt}/${MAX_RETRIES}):`,
          err instanceof Error ? err.message : err,
        );
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    console.warn(
      '[ironclaw-service] Startup init failed after retries. ' +
        'Ironclaw features will be unavailable until the sidecar is reachable.',
    );
  }

  /**
   * Handle a global (no problem set) user message.
   * Scoped per-user with a dedicated thread and simplified system prompt.
   */
  async handleGlobalMessage(
    userDid: string,
    content: string,
  ): Promise<void> {
    const globalScope = globalScopeId(userDid);

    // 1. Get or create per-user global session
    const session = await ironclawStore.getOrCreateSession(globalScope, userDid);

    // 2. Persist user message
    const userMsg = await ironclawStore.addMessage({
      problem_set_id: globalScope,
      content,
      sender: 'user',
      specialist_id: null,
      specialist_display_name: null,
      delegated_by: null,
      action_card: null,
      step_progress: null,
      suggestion: null,
    });

    // Publish to user's global WebSocket channel
    await publishToChannel(globalChannelId(userDid), 'ironclaw.user-message', userMsg);

    // 3. Send to Ironclaw webhook
    const result = await ironclawClient.sendMessage(session.id, content);

    // 4. Process the response (uses global channel)
    if (result.response) {
      await this.processGlobalResponse(userDid, result.response);
    }
  }

  /**
   * Process a response for a global (non-problem-set) conversation.
   */
  private async processGlobalResponse(
    userDid: string,
    responseText: string,
  ): Promise<void> {
    const globalScope = globalScopeId(userDid);

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // Plain text
    }

    const specialistId = (parsed?.specialist_id as string) ?? null;
    const specialistDisplayName = (parsed?.specialist_display_name as string) ?? null;
    const sender: IronclawChatMessage['sender'] = specialistId ? 'specialist' : 'ironclaw';
    const delegatedBy = specialistId ? 'ironclaw' : null;

    const messageContent = parsed
      ? (parsed.content as string) ?? (parsed.text as string) ?? responseText
      : responseText;

    if (!messageContent) return;

    // No action cards in global mode — actions require a problem set context
    const chatMsg = await ironclawStore.addMessage({
      problem_set_id: globalScope,
      content: messageContent,
      sender,
      specialist_id: specialistId,
      specialist_display_name: specialistDisplayName,
      delegated_by: delegatedBy,
      action_card: null,
      step_progress: null,
      suggestion: null,
    });

    await publishToChannel(globalChannelId(userDid), 'ironclaw.response', chatMsg);
  }

  /**
   * Get chat history for a user's global (non-problem-set) conversation.
   */
  async getGlobalHistory(
    userDid: string,
    limit?: number,
  ): Promise<IronclawChatMessage[]> {
    return ironclawStore.getHistory(globalScopeId(userDid), limit);
  }

  /**
   * Get the WebSocket channel name for a user's global conversation.
   * Frontend needs this to subscribe to the correct channel.
   */
  getGlobalChannel(userDid: string): string {
    return `ironclaw.${globalChannelId(userDid)}`;
  }

  // ---------------------------------------------------------------------------
  // Agent/Team Delegation Commands
  // ---------------------------------------------------------------------------
  // These handlers are invoked when Ironclaw returns an action card with the
  // corresponding action_type (agent.list_active, agent.get_status, etc.).
  // They query AgentStore / TeamStore and return structured results for Ironclaw
  // to format and relay back to the user.

  /**
   * List all agents with 'active' status.
   * Action type: agent.list_active (LOW risk — read-only)
   */
  async listActiveAgents(): Promise<Record<string, unknown>[]> {
    const agents = await getAgentStore().listAgents({ status: 'active' });
    return agents.map((a) => ({
      agentId: a.agentId,
      name: a.name,
      phase: a.phase,
      status: a.status,
      successRate: a.successRate ?? null,
      lastInvocation: a.lastInvocation ?? null,
    }));
  }

  /**
   * Get health summary for a specific agent.
   * Action type: agent.get_status (LOW risk — read-only)
   */
  async getAgentStatus(agentId: string): Promise<Record<string, unknown> | null> {
    const agent = await getAgentStore().getAgent(agentId);
    if (!agent) return null;
    return {
      agentId: agent.agentId,
      name: agent.name,
      phase: agent.phase,
      status: agent.status,
      successRate: agent.successRate ?? null,
      avgResponseTimeMs: agent.avgResponseTimeMs ?? null,
      validationScore: agent.validationScore ?? null,
      lastInvocation: agent.lastInvocation ?? null,
    };
  }

  /**
   * Assign an agent to a problem set.
   * Stores the assignment in agent_data JSONB under the 'assignments' key.
   * Action type: agent.assign_to_problem_set (MEDIUM risk)
   */
  async assignAgentToProblemSet(agentId: string, problemSetId: string): Promise<void> {
    const store = getAgentStore();
    const agent = await store.getAgent(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    // assignments is stored as an extra field in agent_data JSONB
    const existing = agent as unknown as Record<string, unknown>;
    const assignments: string[] = (existing.assignments as string[] | undefined) ?? [];
    if (!assignments.includes(problemSetId)) {
      assignments.push(problemSetId);
    }

    // Use updateAgent which merges into agent_data JSONB via || operator
    await store.updateAgent(agentId, { assignments } as unknown as Partial<typeof agent>);
  }

  /**
   * Unassign an agent from a problem set.
   * Removes the problemSetId from agent_data.assignments.
   * Action type: agent.unassign_from_problem_set (LOW risk)
   */
  async unassignAgentFromProblemSet(agentId: string, problemSetId: string): Promise<void> {
    const store = getAgentStore();
    const agent = await store.getAgent(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);

    const existing = agent as unknown as Record<string, unknown>;
    const assignments: string[] = (existing.assignments as string[] | undefined) ?? [];
    const updated = assignments.filter((id) => id !== problemSetId);

    await store.updateAgent(agentId, { assignments: updated } as unknown as Partial<typeof agent>);
  }

  /**
   * Activate a team to work on a task.
   * Looks up the team and marks it as assigned to the task via TeamStore.
   * Action type: agent.form_team_for_task (MEDIUM risk)
   */
  async formTeamForTask(teamId: string, taskDescription: string): Promise<Record<string, unknown>> {
    const store = getTeamStore();
    const team = await store.getTeam(teamId);
    if (!team) throw new Error(`Team not found: ${teamId}`);

    // Record the task assignment on the team (stored in team_data JSONB)
    const currentTask = {
      taskDescription,
      assignedAt: new Date().toISOString(),
    };

    // Store task in the sharedContext array as a JSON-encoded entry
    const taskEntry = `currentTask:${JSON.stringify(currentTask)}`;
    const updatedSharedContext = [
      ...(team.sharedContext ?? []).filter((c: string) => !c.startsWith('currentTask:')),
      taskEntry,
    ];

    await store.updateTeam(teamId, { sharedContext: updatedSharedContext });

    return {
      teamId: team.teamId,
      name: team.name,
      taskDescription,
      memberCount: Array.isArray(team.members) ? team.members.length : 0,
      assignedAt: currentTask.assignedAt,
    };
  }

  /**
   * Build the system prompt for an Ironclaw session.
   * Establishes Ironclaw as the Chief of Staff with delegation rules.
   */
  buildSystemPrompt(problemSetId: string): string {
    return [
      'You are the Chief of Staff for this problem set.',
      `Problem Set ID: ${problemSetId}.`,
      'When a query is domain-specific, delegate to the appropriate specialist agent and attribute their response.',
      'Always confirm actions before executing.',
      'For ambiguous scope (this PS vs children), ask to clarify.',
      'Never assume.',
      '',
      '## Governance Constraints (non-negotiable)',
      'You are subject to the following constraints enforced at multiple layers.',
      'Do NOT attempt to circumvent, test, or probe these boundaries:',
      '- You CANNOT modify your own risk levels, rate limits, trust settings, or autonomy configuration.',
      '- You CANNOT modify gate enforcement, auto-approve, or bypass rules.',
      '- You CANNOT reconfigure your own agent settings or permissions.',
      '- You CANNOT create PRs that modify governance code, auth, gates, CI/CD, Docker, or build config files.',
      '- High-risk actions ALWAYS require a Decision Gate regardless of trust preferences.',
      '- All actions are logged with immutable audit trail anchored to blockchain.',
      '- Emergency mode requires system_admin role verified by zero-trust middleware.',
      '',
      'Specialist agents available:',
      '- J2 Intelligence: threat analysis, IPB, intelligence estimates',
      '- J3 Operations: COA development, scheme of maneuver, fires integration',
      '- J4 Logistics: sustainment, force projection, resource allocation',
      '- J5 Plans: strategic planning, campaign design, phase transitions',
      '- J6 Communications: C4ISR, network architecture, signal support',
      '',
      'When delegating, include the specialist_id and specialist_display_name in your response.',
      'When proposing actions that modify data, include a tool_call with action_id, action_type, description, risk_level, and options.',
    ].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const ironclawService = new IronclawService();
