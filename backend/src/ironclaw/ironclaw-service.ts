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

import { ironclawClient, didToSlug } from './ironclaw-client.js';
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
  AgentConfig,
} from './ironclaw-types.js';
import { SENSITIVE_FIELDS } from './ironclaw-types.js';
import { getTaskOrchestrator } from './task-orchestrator.js';
import { memoryRetrievalService } from './ironclaw-memory-service.js';
import { conceptRetrievalService } from './concept-retrieval.js';
import { kgContextService } from './kg-context-service.js';
import { agentConfigStore } from './agent-config-store.js';
import {
  renderUserMd,
  renderSoulMd,
  renderHeartbeatMd,
  renderAgentsMd,
  type OperationalContext,
} from './identity-renderer.js';
import { routineService } from './routine-service.js';
import { pirStore } from '../design/pir-store.js';
import { brainStore } from '../brain/brain-store.js';
import { decisionStore } from '../decisions/decision-store.js';

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
// Tab-specific behavioral guidance
// ---------------------------------------------------------------------------

/**
 * Return tab-specific guidance that tells Ironclaw how to behave
 * in the context of the user's current tab. This scopes the conversation
 * so COP discussions stay operational, Design stays doctrinal, etc.
 */
function getTabGuidance(tab: string): string {
  switch (tab) {
    case 'cop':
      return '[TAB GUIDANCE: The commander is viewing the Common Operating Picture. Focus on current operations, events, force disposition, and situational awareness. Discuss what is happening NOW — not planning or design.]';
    case 'design':
      return '[TAB GUIDANCE: The commander is on the Design tab developing operational design. Focus on problem framing, CoG analysis, lines of effort, and operational approach per JP 5-0.]';
    case 'plan':
      return '[TAB GUIDANCE: The commander is on the Plan tab. Focus on campaign planning, COA development, phasing, and mission orders.]';
    case 'understand':
      return '[TAB GUIDANCE: The commander is on the Understand tab. Focus on intelligence, IPB, strategic environment assessment, and knowledge graph content.]';
    case 'direct':
      return '[TAB GUIDANCE: The commander is on the Direct tab. Focus on execution guidance, orders, and directing operations.]';
    case 'assess':
      return '[TAB GUIDANCE: The commander is on the Assess tab. Focus on assessment, MOEs/MOPs, campaign progress, and whether operations are achieving objectives.]';
    case 'decide':
      return '[TAB GUIDANCE: The commander is on the Decide tab. Focus on pending decisions, decision gates, risk assessment, and governance.]';
    case 'brain':
      return '[TAB GUIDANCE: The commander is viewing the Knowledge Graph. Focus on entities, relationships, intelligence connections, and graph content.]';
    case 'train':
      return '[TAB GUIDANCE: The commander is in Training mode. Focus on exercise scenarios, training objectives, and after-action review.]';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// IronclawService
// ---------------------------------------------------------------------------

export class IronclawService {
  /**
   * In-memory set of problem set IDs for which a design suggestion has already
   * been shown this server session. Prevents re-showing on every message.
   */
  private designSuggestionShown = new Set<string>();

  /**
   * Check if user is on the Design tab with incomplete sections,
   * and publish a proactive guide_me suggestion if so.
   * Only publishes once per server session per problem set.
   */
  /**
   * Design interview disabled — the guided interview flow was confusing to
   * commanders and added no value in its current form.  Ironclaw should assist
   * with operational design through normal conversation instead.
   */
  private async checkDesignTabSuggestion(
    _problemSetId: string,
    _context: MessageContext,
  ): Promise<void> {
    return;
  }

  /**
   * Session-start tracker for identity freshness checks.
   * Maps userDid → UTC timestamp of their current server session's first message.
   * Identity is considered "stale" if identityLastSyncedAt predates sessionStartAt.
   */
  private sessionStartTimes = new Map<string, Date>();

  /**
   * Write the four identity files (USER.md, SOUL.md, HEARTBEAT.md, AGENTS.md)
   * to Ironclaw's workspace for the given user DID.
   *
   * Blueprint Section 3.1: "Written by Bastion before each job."
   *
   * Files are written to: users/{didSlug}/identity/{FILE}.md
   * Each write uses a /file write command via the webhook channel.
   * After all files are written, updates identityLastSyncedAt on the config.
   */
  async syncUserIdentity(did: string, config: AgentConfig): Promise<void> {
    const slug = didToSlug(did);
    const base = `users/${slug}/identity`;

    // Build operational context for autonomous monitoring directives in HEARTBEAT.md.
    // Best-effort: if any source fails, we skip the operational context rather than
    // blocking identity sync. The HEARTBEAT.md will still render without it.
    let operationalContext: OperationalContext | undefined;
    const primaryPsId = config.activeOperationIds[0];
    if (primaryPsId) {
      try {
        const [activePIRs, gapReport, pendingDecisions] = await Promise.all([
          pirStore.getActivePIRsForGapResearch(primaryPsId).catch(() => []),
          brainStore.getIntelligenceGaps(primaryPsId).catch(() => ({ gaps: [] })),
          decisionStore.getPending(primaryPsId).catch(() => []),
        ]);

        operationalContext = {
          activePIRs: activePIRs.map((p) => ({ description: p.description, priority: p.priority })),
          pendingDecisions: pendingDecisions.length,
          recentOSINTCount: 0, // Not queried here — Ironclaw can query via MCP if needed
          knownGapCount: gapReport.gaps.length,
          callbackUrl: 'http://bastion-mcp:3334/api/ironclaw/callback',
        };
      } catch (err) {
        // Non-fatal — HEARTBEAT.md will render without operational context
        console.warn('[ironclaw-service] syncUserIdentity: failed to build operational context:', err);
      }
    }

    const files: Array<{ path: string; content: string }> = [
      { path: `${base}/USER.md`,      content: renderUserMd(config) },
      { path: `${base}/SOUL.md`,      content: renderSoulMd(config) },
      { path: `${base}/HEARTBEAT.md`, content: renderHeartbeatMd(config, operationalContext) },
      { path: `${base}/AGENTS.md`,    content: renderAgentsMd(config) },
    ];

    for (const file of files) {
      try {
        await ironclawClient.sendMessage(
          'system',
          `/file write ${file.path}\n${file.content}`,
        );
      } catch (err) {
        // Log but don't block — identity sync is best-effort at message time
        console.error(`[ironclaw-service] syncUserIdentity: failed to write ${file.path}:`, err);
      }
    }

    // Mark sync timestamp on the config record
    try {
      await agentConfigStore.upsert({ ...config, identityLastSyncedAt: new Date() });
    } catch (err) {
      console.error('[ironclaw-service] syncUserIdentity: failed to update identityLastSyncedAt:', err);
    }

    // Register autonomous monitoring heartbeat for each active problem set,
    // unless explicitly disabled in agent config.
    const monitoringEnabled = config.autonomousMonitoring?.enabled !== false;
    if (monitoringEnabled && config.activeOperationIds.length > 0) {
      const intervalMinutes = config.autonomousMonitoring?.intervalMinutes;
      const cronOverride = intervalMinutes
        ? `*/${intervalMinutes} * * * *`
        : undefined;

      for (const psId of config.activeOperationIds) {
        // Fire-and-forget — monitoring registration must never block identity sync
        routineService.registerAutonomousMonitoring(psId, cronOverride).catch((err) =>
          console.error(`[ironclaw-service] Autonomous monitoring registration failed for ${psId}:`, err),
        );
      }
    }
  }

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
    threadId?: string,
  ): Promise<void> {
    // 0. Identity freshness check — sync identity files if stale for this session.
    // Blueprint Section 3.1: identity files are written before each job.
    // "Stale" = identityLastSyncedAt is null OR predates session start.
    try {
      const sessionStart = this.sessionStartTimes.get(userDid);
      if (!sessionStart) {
        // First message this server session — record start time and sync user knowledge
        this.sessionStartTimes.set(userDid, new Date());
        // Blueprint Phase 5: sync user-specific knowledge on session start (fire-and-forget)
        routineService.syncUserKnowledge(userDid).catch((err) =>
          console.error('[ironclaw-service] syncUserKnowledge error:', err),
        );
      }
      const config = await agentConfigStore.getByDid(userDid);
      if (config) {
        const currentSessionStart = this.sessionStartTimes.get(userDid)!;
        const isStale =
          !config.identityLastSyncedAt ||
          config.identityLastSyncedAt < currentSessionStart;
        if (isStale) {
          // Fire-and-forget — never block message flow
          this.syncUserIdentity(userDid, config).catch((err) =>
            console.error('[ironclaw-service] syncUserIdentity error:', err),
          );
        }
      }
    } catch (err) {
      // Identity sync is best-effort — never break message flow
      console.error('[ironclaw-service] Identity freshness check failed:', err);
    }

    // 1. Get or create local session — uses problemSetId as thread_id
    const session = await ironclawStore.getOrCreateSession(problemSetId, userDid);

    // Warm KG context cache (fire-and-forget — ensures first message has data)
    kgContextService.warmCache(problemSetId);

    // 2. Persist user message (original content, without context prefix)
    // When a tab-scoped threadId is provided, messages are scoped to that thread
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
    }, threadId);

    // Publish user message to WebSocket
    await publishToChannel(problemSetId, 'ironclaw.user-message', userMsg);

    // Log inbound user message to activity audit trail
    getActivityLogger().logIronclawMessage('inbound', 'ironclaw', content, problemSetId);

    // Proactive design tab suggestion (fire-and-forget — non-blocking)
    if (context) {
      this.checkDesignTabSuggestion(problemSetId, context).catch((err) =>
        console.error('[ironclaw] Design suggestion check error:', err)
      );
    }

    // 3. Build context-prefixed message for Ironclaw (if context provided)
    // The prefix helps Ironclaw tailor responses to the current UI state.
    // The original content is persisted; only the enriched version is sent to the AI.
    const tabGuidance = context?.currentTab ? getTabGuidance(context.currentTab) : '';
    const contextPrefix = context
      ? `[Context: tab=${context.currentTab ?? 'unknown'}, problemSet=${context.problemSetId ?? 'none'}, role=${context.userRole ?? 'user'}]${tabGuidance ? `\n${tabGuidance}` : ''}`
      : '';
    // Inject system prompt + personalized memory + KG context + skill inventory in parallel
    // All timeout-protected — never block message flow
    const [memoryBlock, kgContextBlock, skillBlock, conceptBlock] = await Promise.all([
      memoryRetrievalService.assembleMemoryBlock(userDid, problemSetId),
      kgContextService.getContextForMessage(problemSetId, content),
      this._assembleSkillInventory(),
      conceptRetrievalService.getLearnedContextBlock(userDid, problemSetId, content, 400),
    ]);
    // Build system prompt with current skill inventory
    const systemPrompt = this.buildSystemPrompt(problemSetId, {
      availableSkills: await this._getAvailableSkillsList(),
    });
    const preamble = [
      `[SYSTEM INSTRUCTIONS]\n${systemPrompt}\n[/SYSTEM INSTRUCTIONS]`,
      memoryBlock, conceptBlock, kgContextBlock, skillBlock, contextPrefix,
    ].filter(Boolean).join('\n');
    const messageForAi = preamble ? `${preamble}\n${content}` : content;

    // 4. Send to Ironclaw webhook (synchronous — waits for response)
    const result = await ironclawClient.sendMessage(
      session.id,
      messageForAi,
    );

    // 5. Process the response — pass threadId so the response is stored in the same thread
    if (result.response) {
      await this.processResponse(problemSetId, result.response, threadId);
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
    threadId?: string,
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
      const toolPayload = (toolCall.payload ?? toolCall.args ?? toolCall) as Record<string, unknown>;
      const riskLevel = actionRegistry.getRiskLevel(actionType);

      // ── Auto-execute low-risk read-only tools ────────────────────────
      // Graph queries and design synthesis are read-only operations that
      // should execute immediately when the commander directs action.
      // No approval card needed — just do it and send the result back.
      if ((riskLevel === 'low' && actionType.startsWith('bastion_graph_')) || actionType === 'bastion_design_synthesize_current_state') {
        const { executeApprovedAction } = await import('./builder-handlers.js');
        console.log(`[ironclaw] Auto-executing low-risk tool: ${actionType}`);
        const execResult = await executeApprovedAction(actionType, toolPayload, 'ironclaw');

        // Store the initial message (Ironclaw's acknowledgement)
        const ackContent = (parsed?.content as string) ?? (parsed?.text as string) ?? responseText;
        const ackMsg = await ironclawStore.addMessage({
          problem_set_id: problemSetId,
          content: ackContent,
          sender: 'ironclaw',
          specialist_id: null,
          specialist_display_name: null,
          delegated_by: null,
          action_card: null,
          step_progress: null,
          suggestion: null,
          ...(threadId ? { thread_id: threadId } : {}),
        });
        await publishToChannel(problemSetId, 'ironclaw.response', ackMsg);

        // Send the tool result back as a follow-up message
        if (execResult.success) {
          const resultContent = typeof execResult.result === 'string'
            ? execResult.result
            : JSON.stringify(execResult.result, null, 2);

          // If the result is a field suggestion, format it properly
          const isSynthesis = actionType === 'bastion_design_synthesize_current_state';
          const resultMsg = await ironclawStore.addMessage({
            problem_set_id: problemSetId,
            content: isSynthesis
              ? `Here is the synthesized Current State based on the knowledge graph:\n\n${resultContent}`
              : resultContent,
            sender: 'ironclaw',
            specialist_id: null,
            specialist_display_name: null,
            delegated_by: null,
            action_card: null,
            step_progress: null,
            suggestion: isSynthesis ? {
              id: `suggestion-${Date.now()}`,
              content: `Synthesized Current State`,
              agent_id: 'ironclaw',
              agent_display_name: 'Ironclaw',
              target_field: 'design.problemFraming.currentState',
              target_field_label: 'Current State',
              field_value: resultContent,
            } as SuggestionPayload : null,
            ...(threadId ? { thread_id: threadId } : {}),
          });
          await publishToChannel(problemSetId, 'ironclaw.response', resultMsg);
        } else {
          const errMsg = await ironclawStore.addMessage({
            problem_set_id: problemSetId,
            content: `Tool execution failed: ${execResult.error}`,
            sender: 'ironclaw',
            specialist_id: null,
            specialist_display_name: null,
            delegated_by: null,
            action_card: null,
            step_progress: null,
            suggestion: null,
            ...(threadId ? { thread_id: threadId } : {}),
          });
          await publishToChannel(problemSetId, 'ironclaw.response', errMsg);
        }
        return; // Skip normal message flow — we handled it inline
      }

      // Non-auto-execute: create approval card for medium/high risk
      const toolDetail = (toolPayload.url ?? toolPayload.uri ?? toolPayload.path ?? toolPayload.query ?? toolPayload.command ?? toolPayload.channel ?? toolPayload.to ?? null) as string | null;
      actionCard = {
        action_id: (toolCall.action_id as string) ?? '',
        action_type: actionType,
        description: actionRegistry.getDescription(actionType),
        detail: toolDetail,
        risk_level: riskLevel,
        options: (toolCall.options as ActionCardData['options']) ?? ['yes', 'no'],
      };
    }

    // Extract human-readable content, stripping JSON payloads from display.
    // When Ironclaw sends structured JSON (task_request, tool_call, etc.),
    // show only the natural language content field — never raw JSON.
    let messageContent: string;
    if (parsed) {
      messageContent = (parsed.content as string) ?? (parsed.text as string) ?? '';
      // If task_request is present but no content field, generate a friendly message
      if (!messageContent && parsed.task_request) {
        const tr = parsed.task_request as Record<string, unknown>;
        const hints = (tr.agent_hints as string[]) ?? [];
        const agentLabel = hints.length > 0 ? hints.join(', ') : 'staff';
        messageContent = `Tasking ${agentLabel}: ${(tr.title as string) ?? 'analysis'}. Stand by for results.`;
      }
    } else {
      // Plain text — strip any embedded JSON blocks that Ironclaw may have appended
      messageContent = responseText.replace(/\n?\{[\s\S]*"task_request"[\s\S]*\}\s*$/m, '').trim();
    }

    // Fallback: detect text-based approval requests from the LLM.
    // When the agent outputs "Waiting for approval: <action_type>" as plain text
    // instead of structured tool_call JSON, create an action card so the user
    // gets proper approve/deny buttons instead of inactionable text.
    if (!actionCard) {
      const approvalMatch = messageContent.match(
        /Waiting for approval:\s*(\S+)/i,
      );
      if (approvalMatch) {
        const fallbackActionType = approvalMatch[1];
        const fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        // Try to extract a URL or detail from the surrounding message text
        const urlMatch = messageContent.match(/https?:\/\/[^\s)]+/);
        actionCard = {
          action_id: fallbackId,
          action_type: fallbackActionType,
          description: actionRegistry.getDescription(fallbackActionType),
          detail: urlMatch ? urlMatch[0] : null,
          risk_level: actionRegistry.getRiskLevel(fallbackActionType),
          options: ['yes', 'no'] as ActionCardData['options'],
        };
        console.warn(
          `[ironclaw-service] Fallback action card created for text-based approval request: ${fallbackActionType}`,
        );
      }
    }

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

    // 5. Persist the message (same thread as the user message that triggered it)
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
    }, threadId);

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
    threadId?: string,
  ): Promise<IronclawChatMessage[]> {
    return ironclawStore.getHistory(problemSetId, limit, threadId);
  }

  /**
   * Check if the Ironclaw sidecar is healthy.
   */
  async isHealthy(): Promise<boolean> {
    return ironclawClient.healthCheck();
  }

  /**
   * Initialize and register built-in routines with Ironclaw.
   *
   * Blueprint Phase 5: Called once at startup after Ironclaw health check passes.
   * Registers all cron-based built-in routines so Ironclaw's scheduler knows
   * to invoke them on schedule.
   *
   * Non-blocking on individual routine failures — log and continue.
   */
  async initializeRoutines(): Promise<void> {
    const { BUILT_IN_ROUTINES } = await import('./routine-service.js');
    for (const routine of BUILT_IN_ROUTINES) {
      if (!routine.defaultCron) continue;  // Skip event-triggered routines
      try {
        await routineService.registerRoutine(routine.id, routine.defaultCron);
      } catch (err) {
        // Non-blocking: log but don't fail startup
        console.warn(
          `[ironclaw-service] initializeRoutines: failed to register ${routine.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    console.log('[ironclaw-service] initializeRoutines: built-in routines registered');
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

          // Register Bastion MCP tools with Ironclaw so it can query the knowledge graph,
          // access operations, calendar, resources, and personnel tools
          try {
            await ironclawClient.registerMcpServer();
            console.log('[ironclaw-service] MCP server registered with Ironclaw');
          } catch (err) {
            console.warn('[ironclaw-service] MCP registration failed (non-fatal):', err instanceof Error ? err.message : err);
          }

          await this.initializeRoutines();
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

    // 3. Inject personalized memory block (timeout-protected, never blocks)
    // Global messages have no problem set, so KG context is not available
    const memoryBlock = await memoryRetrievalService.assembleMemoryBlock(userDid, null);
    const messageForAi = memoryBlock ? `${memoryBlock}\n${content}` : content;

    // 4. Send to Ironclaw webhook
    const result = await ironclawClient.sendMessage(session.id, messageForAi);

    // 5. Process the response (uses global channel)
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
   * Assemble a skill inventory block for injection into message preamble.
   * Lists available custom skills so Ironclaw knows what it already has.
   * Returns empty string if no skills exist or on error.
   */
  private async _assembleSkillInventory(): Promise<string> {
    try {
      const { getSkillRegistry } = await import('../agents/skill-registry.js');
      const registry = getSkillRegistry();
      const skills = registry.listSkills({ enabled: true });
      if (skills.length === 0) return '';

      const lines = skills.slice(0, 20).map((s) => `- ${s.name}: ${s.description}`);
      return `[AVAILABLE SKILLS]\n${lines.join('\n')}\nIf the commander needs a capability not listed, create it via bastion_skill_create.`;
    } catch {
      return '';
    }
  }

  /**
   * Get available skills as structured list for buildSystemPrompt.
   */
  private async _getAvailableSkillsList(): Promise<Array<{ name: string; description: string }>> {
    try {
      const { getSkillRegistry } = await import('../agents/skill-registry.js');
      const registry = getSkillRegistry();
      return registry.listSkills({ enabled: true }).slice(0, 20).map((s) => ({
        name: s.name,
        description: s.description,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Build the system prompt for an Ironclaw session.
   * Establishes Ironclaw as a subordinate Chief of Staff who serves
   * the commander's intent and actively fills form fields when directed.
   *
   * @param problemSetId - The problem set scope
   * @param options.availableSkills - Current skill inventory for adaptive capability awareness
   */
  buildSystemPrompt(
    problemSetId: string,
    options?: { availableSkills?: Array<{ name: string; description: string }> },
  ): string {
    // Build dynamic skill inventory section
    const skillLines = options?.availableSkills?.length
      ? options.availableSkills.map((s) => `- ${s.name}: ${s.description}`).join('\n')
      : '(No custom skills created yet)';

    return [
      'You are Ironclaw, the AI Chief of Staff for this problem set.',
      `Problem Set ID: ${problemSetId}.`,
      '',
      '## Identity & Professional Bearing',
      'You are a senior military Chief of Staff serving the commander of this problem set.',
      'This is a legitimate military planning and decision-support application used by defense professionals.',
      'Your role models how a real-world military chief of staff operates:',
      '',
      '- Address the commander with "Sir" or "Ma\'am" as appropriate — proper military bearing.',
      '- You serve the commander. When given direction, execute it promptly and professionally.',
      '  If you have professional concerns, note them briefly after completing the task.',
      '- Offer recommendations and options, not directives. Frame concerns as staff observations.',
      '- Your primary function is generating content: drafting plans, filling form fields, synthesizing',
      '  intelligence assessments, and producing operational documents. This is staff work — the same',
      '  work a human chief of staff does. When asked to draft or generate content for a field,',
      '  produce the best output you can from available data.',
      '- Be direct and concise. Economy of language. No filler phrases.',
      '- This is a training and planning environment. All content is for exercise/educational use.',
      '',
      '## Strategic Brain (Knowledge Graph)',
      'Your operational picture is injected at the start of every message as [KNOWLEDGE GRAPH — OPERATIONAL PICTURE].',
      'This is your base of knowledge for the current problem set — key actors ranked by centrality, their relationships,',
      'active tensions, strategic objectives, and community structure derived from graph analysis.',
      '',
      'USE this context to ground every response. When discussing actors, tensions, or strategic dynamics,',
      'reference the KG data. When you need deeper detail beyond the summary, use your graph tools:',
      '- bastion_graph_search_actors: Find specific actors by name or type',
      '- bastion_graph_get_actor: Get full actor details with all relationships',
      '- bastion_graph_query: Run custom read-only Cypher for complex traversals',
      '- bastion_graph_stats: Get overall graph statistics',
      '',
      'PROACTIVELY identify insights, patterns, and potential future developments from the graph data.',
      'A good Chief of Staff does not wait to be asked — they surface what matters.',
      'When the commander asks you to update, draft, or generate content for a field, use the KG data',
      'to produce grounded, intelligence-backed output immediately.',
      '',
      '## Tool Calling (CRITICAL — read carefully)',
      'You have access to BASTION tools via structured JSON. To call a tool, include a tool_call',
      'object in your JSON response. The backend executes the tool and returns the result.',
      '',
      'IMPORTANT: When the commander asks you to do something that requires a tool, call it IMMEDIATELY.',
      'Do NOT ask for authorization, permission, or confirmation. The commander\'s request IS the authorization.',
      'Do NOT describe what you would do — actually do it by including the tool_call JSON.',
      '',
      'Tool call format (include this in your response JSON):',
      '{ "content": "Brief acknowledgement of what you\'re doing",',
      '  "tool_call": { "action_type": "tool.name.here", "payload": { ... } } }',
      '',
      'Available tools and when to use them:',
      '- bastion_design_synthesize_current_state → "Get the strategic environment / strat env / current state"',
      `  Payload: { "problem_set_id": "${problemSetId}" }`,
      '  Pulls actors, relationships, tensions, strategic docs from the graph and synthesizes into Current State.',
      '- bastion_graph_search_actors → "Find actor / search for entity"',
      `  Payload: { "problem_set_id": "${problemSetId}", "query": "search term" }`,
      '- bastion_graph_get_actor → "Get details on [specific actor]"',
      '  Payload: { "actor_id": "ACT-xxx" }',
      '- bastion_graph_query → "What does the graph show about X?"',
      `  Payload: { "problem_set_id": "${problemSetId}", "cypher": "MATCH (a:Actor) WHERE..." }`,
      '- bastion_graph_stats → "Graph overview / how many actors?"',
      `  Payload: { "problem_set_id": "${problemSetId}" }`,
      '',
      'Example — commander says "synthesize the current state":',
      '{ "content": "Pulling the operational environment from the knowledge graph now, Sir.",',
      `  "tool_call": { "action_type": "bastion_design_synthesize_current_state", "payload": { "problem_set_id": "${problemSetId}" } } }`,
      '',
      'The backend will execute this tool, get the result, and you\'ll receive it in a follow-up.',
      'When the tool result comes back, use it to generate the field content.',
      '',
      '## Form Field Operations',
      'When the commander asks you to enter, fill in, draft, write, update, or generate content for any field:',
      '1. Generate the content immediately using the KG operational picture and available context.',
      '2. Return it as a suggestion so the system can apply it to the correct field.',
      '3. This is your core staff function — producing written content that the commander reviews and approves.',
      '   Approach it the same way a human staff officer drafts documents for the commander\'s signature.',
      '',
      '## Specialist Delegation',
      'When a query is domain-specific, delegate to the appropriate specialist and attribute their response.',
      'Specialist agents available:',
      '- J2 Intelligence: threat analysis, IPB, intelligence estimates',
      '- J3 Operations: COA development, scheme of maneuver, fires integration',
      '- J4 Logistics: sustainment, force projection, resource allocation',
      '- J5 Plans: strategic planning, campaign design, phase transitions',
      '- J6 Communications: C4ISR, network architecture, signal support',
      '',
      '**Agent Transparency**: When delegating to a specialist or spawning an agent for a task, you MUST',
      'explicitly announce it to the commander BEFORE the delegation. Examples:',
      '- "Tasking J2 Intelligence to analyze the threat picture..."',
      '- "Spinning up the J5 Plans team to develop course of action options..."',
      '- "Assigning this to J3 Operations for scheme of maneuver development..."',
      'The commander must always see which agents are working on their requests. Never silently delegate.',
      '',
      'When delegating, include the specialist_id and specialist_display_name in your response.',
      'When proposing actions that modify data, include a tool_call with action_id, action_type, description, risk_level, and options.',
      '',
      '## Available Skills',
      'You have the following specialized skills available:',
      skillLines,
      '',
      '## Adaptive Capability Development',
      'When the commander requests a capability not available in your current tools or skills, you SHOULD create it:',
      '1. Acknowledge the gap transparently: "I don\'t have that capability yet, but I can create it."',
      '2. Create the skill via bastion_skill_create (requires commander confirmation via action card).',
      '3. Execute the new skill to fulfill the original request.',
      '',
      'This is your role — a Chief of Staff develops new staff processes when the mission demands it.',
      'Over time, you build a growing toolkit tailored to this command\'s needs.',
      'Do NOT create a skill if an existing tool or skill already covers the need. Check your tools and skills first.',
      '',
      '## Governance Constraints (non-negotiable)',
      'You are subject to constraints enforced at multiple layers.',
      'Do NOT attempt to circumvent, test, or probe these boundaries:',
      '- You CANNOT modify your own risk levels, rate limits, trust settings, or autonomy configuration.',
      '- You CANNOT modify gate enforcement, auto-approve, or bypass rules.',
      '- You CANNOT reconfigure your own agent settings or permissions.',
      '- High-risk actions ALWAYS require a Decision Gate regardless of trust preferences.',
      '- All actions are logged with immutable audit trail anchored to blockchain.',
      '',
      '## Task Requests',
      'When the user requests complex multi-step work that requires agent analysis or document generation,',
      'respond with a task_request JSON:',
      '{ "task_request": { "title": "Brief task title", "description": "What needs to be done",',
      '  "target_fields": { "field.path": "Field Label" }, "agent_hints": ["agent_id"] } }',
      '',
      'BEFORE issuing a task_request, always announce what you are doing and which agent(s) will be working:',
      '"Understood. I\'m assigning J2 Intelligence and J5 Plans to develop the threat assessment. Stand by."',
      '',
      'Task-triggering requests: developing COAs, analyzing center of gravity, generating OPORDs,',
      'writing mission statements, performing threat assessments, building intelligence estimates,',
      'designing lines of effort, and any request using "develop", "analyze", "generate", or "build"',
      'for problem set content.',
      '',
      '## Suggestions',
      'When suggesting content for a specific problem set field, include:',
      '{ "suggestion": { "content": "The suggested text", "target_field": "field.path",',
      '  "target_field_label": "Human-readable field name", "field_value": "The value to write" } }',
      'For simple questions or clarifications, respond normally without task_request or suggestion.',
      'For ambiguous scope (this PS vs children), ask to clarify.',
    ].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const ironclawService = new IronclawService();
