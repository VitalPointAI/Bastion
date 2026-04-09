/**
 * Ironclaw REST API Router
 *
 * Phase 30 Plan 02: Express router mounted at /api/ironclaw behind requireAuth.
 * Provides endpoints for chat messaging, history retrieval, and health checks.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { ironclawService } from './ironclaw-service.js';
import type { MessageContext } from './ironclaw-service.js';
import { actionPipeline } from './action-pipeline.js';
import { ironclawStore } from './ironclaw-store.js';
import { SENSITIVE_FIELDS } from './ironclaw-types.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { getPool } from '../lib/database.js';
import { problemSetMemberStore } from '../problem-set/problem-set-member-store.js';
import { problemSetStore } from '../problem-set/problem-set-store.js';
import { designStore } from '../design/design-store.js';
import type { TrustDecision } from './ironclaw-types.js';
import { getTaskStore } from './task-store.js';
import { getTaskOrchestrator } from './task-orchestrator.js';
import { selfUpdateService } from './self-update-service.js';
import { memoryRetrievalService } from './ironclaw-memory-service.js';
import { ironclawUserMemoryStore } from './ironclaw-memory-store.js';
import { autonomousActivityStore } from './autonomous-activity-store.js';
import { conceptExtractionService } from './concept-extraction.js';
import { conceptRouter } from './concept-router.js';
import { handleSSEStream } from './ironclaw-sse.js';
import { ironclawEventStore } from './ironclaw-event-store.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Extract user DID from request.
 * Checks zeroTrust middleware first, then falls back to X-DID header.
 */
function getUserDid(req: Request): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  if (anyReq.zeroTrust?.did) return anyReq.zeroTrust.did as string;
  if (anyReq.user?.did) return anyReq.user.did as string;

  return (req.headers['x-did'] as string) || 'did:near:anonymous';
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const ironclawRouter = Router();

// Mount concept CRUD sub-router (Phase 66)
ironclawRouter.use('/', conceptRouter);

/**
 * GET /health
 * Check if the Ironclaw sidecar is reachable and healthy.
 */
ironclawRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const healthy = await ironclawService.isHealthy();
    res.json({ healthy });
  } catch (err) {
    console.error('[ironclaw-router] Health check error:', err);
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * GET /status
 * Returns Ironclaw self-update service status including the current version.
 */
ironclawRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await selfUpdateService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// ---------------------------------------------------------------------------
// Greeting — "spring to attention" when the drawer opens
// ---------------------------------------------------------------------------

/**
 * GET /greeting
 *
 * Returns a quick, template-based military greeting for the current user.
 * Uses stored honorific preference (Sir/Ma'am) or infers from display name.
 * No LLM call — instant response for drawer-open UX.
 *
 * Query: ?problemSetName=<name>  (optional, for context-aware greeting)
 *
 * Returns: { greeting: string, honorific: 'Sir' | 'Ma\'am' | null }
 *   - honorific null means we couldn't determine — frontend should ask user
 */
ironclawRouter.get('/greeting', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  const problemSetName = (req.query.problemSetName as string) || null;

  try {
    // Check stored honorific preference
    const stored = await ironclawUserMemoryStore.getUserMemory(userDid, 'honorific_preference');
    let honorific: string | null = stored?.memory_value?.honorific as string | null ?? null;

    let displayName: string | null = null;

    if (!honorific) {
      // Try to infer from display name in agent_config (user profile)
      try {
        const pool = getPool();
        const profileResult = await pool.query(
          `SELECT display_name FROM agent_config
           WHERE user_did = $1 AND display_name IS NOT NULL
           LIMIT 1`,
          [userDid],
        );
        if (profileResult.rows.length > 0) {
          displayName = (profileResult.rows[0].display_name as string) ?? null;
          if (displayName) {
            honorific = inferHonorific(displayName);
          }
        }
      } catch {
        // Profile lookup failed — not critical
      }

      // Also try the DID itself (e.g., did:near:aaron.near)
      if (!honorific) {
        const nameFromDid = userDid.replace('did:near:', '').split('.')[0];
        honorific = inferHonorific(nameFromDid);
        if (!displayName) displayName = nameFromDid;
      }
    }

    // Build greeting — make an educated guess, seek confirmation only if truly ambiguous
    let greeting: string;
    if (honorific) {
      const greetings = [
        `${honorific}, Ironclaw standing by. How can I assist?`,
        `${honorific}, ready to support. What do you need?`,
        `${honorific}, Ironclaw here. Standing by for your direction.`,
      ];
      greeting = greetings[Math.floor(Math.random() * greetings.length)];
    } else if (displayName) {
      // We have a name but can't determine gender — default to Sir (military convention) and let them correct
      honorific = 'Sir';
      greeting = `${honorific}, Ironclaw standing by. How can I assist?`;
      // Auto-store the default so we don't keep guessing
      ironclawUserMemoryStore.setUserMemory(userDid, 'honorific_preference', { honorific }, 'inferred', 0.6).catch(() => {});
    } else {
      // No name at all — default to Sir (military convention)
      honorific = 'Sir';
      greeting = `${honorific}, Ironclaw standing by. How can I assist?`;
      ironclawUserMemoryStore.setUserMemory(userDid, 'honorific_preference', { honorific }, 'inferred', 0.6).catch(() => {});
    }

    // Add context awareness if we know the problem set
    if (problemSetName) {
      greeting += ` Current focus: ${problemSetName}.`;
    }

    res.json({ greeting, honorific });
  } catch (err) {
    console.error('[ironclaw-router] Greeting error:', err);
    res.json({ greeting: 'Ironclaw standing by. Ready to assist.', honorific: null });
  }
});

/**
 * POST /honorific
 *
 * Store the user's preferred honorific (Sir/Ma'am).
 * Body: { honorific: 'Sir' | "Ma'am" }
 */
ironclawRouter.post('/honorific', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  const { honorific } = req.body as { honorific?: string };

  if (!honorific || (honorific !== 'Sir' && honorific !== "Ma'am")) {
    res.status(400).json({ error: "honorific must be 'Sir' or \"Ma'am\"" });
    return;
  }

  try {
    await ironclawUserMemoryStore.setUserMemory(
      userDid,
      'honorific_preference',
      { honorific },
      'explicit',
      1.0,
    );
    res.json({ ok: true, honorific });
  } catch (err) {
    console.error('[ironclaw-router] Honorific save error:', err);
    res.status(500).json({ error: 'Failed to save preference' });
  }
});

/**
 * Infer honorific from a display name using common first-name gender heuristics.
 * Returns 'Sir', "Ma'am", or null if uncertain.
 */
function inferHonorific(name: string): string | null {
  const first = name.trim().split(/[\s._-]/)[0]?.toLowerCase();
  if (!first) return null;

  // Common feminine names (military context)
  const feminine = new Set([
    'sarah', 'jennifer', 'jessica', 'ashley', 'amanda', 'stephanie', 'nicole',
    'elizabeth', 'melissa', 'michelle', 'laura', 'emily', 'rachel', 'rebecca',
    'catherine', 'natalie', 'heather', 'christina', 'megan', 'anna', 'maria',
    'karen', 'patricia', 'linda', 'lisa', 'susan', 'margaret', 'dorothy',
    'nancy', 'betty', 'helen', 'sandra', 'donna', 'carol', 'ruth', 'sharon',
    'diane', 'janet', 'frances', 'alice', 'julie', 'deborah', 'grace',
    'victoria', 'theresa', 'martha', 'andrea', 'ann', 'marie', 'jane',
    'kelly', 'samantha', 'tiffany', 'allison', 'claire', 'emma', 'olivia',
    'sophia', 'isabella', 'ava', 'mia', 'charlotte', 'amelia', 'harper',
    'evelyn', 'abigail', 'ella', 'scarlett', 'chloe', 'lily', 'hannah',
  ]);

  // Common masculine names (military context)
  const masculine = new Set([
    'james', 'john', 'robert', 'michael', 'william', 'david', 'richard',
    'joseph', 'thomas', 'charles', 'christopher', 'daniel', 'matthew',
    'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
    'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward',
    'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric',
    'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin',
    'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack',
    'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'adam', 'nathan', 'henry',
    'peter', 'zachary', 'douglas', 'harold', 'carl', 'arthur', 'gerald',
    'roger', 'keith', 'jeremy', 'terry', 'lawrence', 'sean', 'christian',
    'albert', 'joe', 'ethan', 'austin', 'jesse', 'oscar', 'willie', 'ralph',
    'eugene', 'roy', 'louis', 'russell', 'bobby', 'philip', 'harry', 'vincent',
    'noah', 'liam', 'mason', 'logan', 'lucas', 'oliver', 'elijah', 'aiden',
  ]);

  if (feminine.has(first)) return "Ma'am";
  if (masculine.has(first)) return 'Sir';
  return null;
}

// ---------------------------------------------------------------------------
// Global (no problem set) endpoints — scoped per user
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SSE stream endpoints (Phase 67)
// NOTE: /global/stream MUST be registered before /:problemSetId/stream to
// prevent Express from matching "global" as a problemSetId parameter.
// ---------------------------------------------------------------------------

/**
 * GET /global/stream
 * SSE stream for the authenticated user's global conversation (no problem set).
 * Scope is derived from the user's DID: _global_<userDid>
 */
ironclawRouter.get('/global/stream', handleSSEStream);

/**
 * GET /:problemSetId/stream
 * SSE stream for a specific problem set conversation.
 */
ironclawRouter.get('/:problemSetId/stream', handleSSEStream);

/**
 * POST /global/message
 * Send a chat message to Ironclaw without a problem set context.
 * Conversation is scoped to the authenticated user.
 *
 * Body: { content: string }
 * Returns: 202 Accepted (response delivered via WebSocket channel ironclaw._global_<did>)
 */
ironclawRouter.post('/global/message', async (req: Request, res: Response) => {
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== 'string' || !content.trim()) {
    res.status(400).json({ error: 'content is required and must be a non-empty string' });
    return;
  }

  const userDid = getUserDid(req);

  try {
    ironclawService
      .handleGlobalMessage(userDid, content.trim())
      .catch((err) => {
        console.error(`[ironclaw-router] handleGlobalMessage error (user=${userDid}):`, err);
      });

    res.status(202).json({ accepted: true });
  } catch (err) {
    console.error('[ironclaw-router] Global message endpoint error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

/**
 * GET /global/history
 * Retrieve chat history for the authenticated user's global conversation.
 *
 * Query: limit (optional, default 100)
 * Returns: { messages: IronclawChatMessage[], channel: string }
 * The `channel` field is the user's WebSocket channel for subscribing.
 */
ironclawRouter.get('/global/history', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  const limitParam = req.query.limit;
  const limit = limitParam ? Number(limitParam as string) : undefined;

  try {
    const history = await ironclawService.getGlobalHistory(userDid, limit);
    res.json({
      messages: history,
      channel: ironclawService.getGlobalChannel(userDid),
    });
  } catch (err) {
    console.error('[ironclaw-router] Global history endpoint error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// ---------------------------------------------------------------------------
// Problem-set-scoped endpoints
// ---------------------------------------------------------------------------

/**
 * POST /:problemSetId/message
 * Send a chat message to Ironclaw. Response streamed via WebSocket.
 *
 * Body: { content: string }
 * Returns: 202 Accepted (response delivered via WebSocket channel ironclaw.<psId>)
 */
ironclawRouter.post(
  '/:problemSetId/message',
  async (req: Request, res: Response) => {
    const problemSetId = req.params.problemSetId as string;
    const { content, context, threadId } = req.body as {
      content?: string;
      context?: MessageContext;
      threadId?: string;
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'content is required and must be a non-empty string' });
      return;
    }

    const userDid = getUserDid(req);

    try {
      // Fire-and-forget: response delivered via WebSocket
      ironclawService
        .handleMessage(problemSetId, userDid, content.trim(), context, threadId)
        .catch(async (err) => {
          console.error(
            `[ironclaw-router] handleMessage error (ps=${problemSetId}):`,
            err,
          );
          // Surface the error to the user so they know something went wrong
          const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.message.includes('timed out'));
          const errorContent = isTimeout
            ? 'Response timed out — the request may still be processing. Try a simpler request or check back shortly.'
            : `An error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`;
          try {
            const msg = await ironclawStore.addMessage({
              problem_set_id: problemSetId,
              content: errorContent,
              sender: 'ironclaw',
              specialist_id: null,
              specialist_display_name: null,
              delegated_by: null,
              action_card: null,
              step_progress: null,
              suggestion: null,
              ...(threadId ? { thread_id: threadId } : {}),
            });
            const { getMessageBus } = await import('../messaging/message-bus.js');
            const bus = getMessageBus();
            await bus.publish({
              sourceDid: 'did:bastion:ironclaw',
              sourceType: 'system',
              destinationType: 'channel',
              destinationTarget: `ironclaw.${problemSetId}`,
              messageType: 'ironclaw.response',
              payload: msg,
            });
          } catch { /* best-effort error notification */ }
        });

      res.status(202).json({ accepted: true });
    } catch (err) {
      console.error('[ironclaw-router] Message endpoint error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

/**
 * GET /:problemSetId/history
 * Retrieve chat history for a problem set.
 *
 * Query: limit (optional, default 100)
 * Returns: IronclawChatMessage[]
 */
ironclawRouter.get(
  '/:problemSetId/history',
  async (req: Request, res: Response) => {
    const problemSetId = req.params.problemSetId as string;
    const limitParam = req.query.limit;
    const threadId = req.query.threadId as string | undefined;
    const limit = limitParam ? Number(limitParam as string) : undefined;

    try {
      const history = await ironclawService.getHistory(problemSetId, limit, threadId);
      res.json(history);
    } catch (err) {
      console.error('[ironclaw-router] History endpoint error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Confirmation & Trust Endpoints (Plan 04)
// ---------------------------------------------------------------------------

const VALID_DECISIONS = new Set<TrustDecision>(['yes', 'no', 'always']);

/**
 * POST /:problemSetId/confirm
 * Handle user confirmation response for an inline action card.
 *
 * Body: { actionId: string, decision: 'yes' | 'no' | 'always' }
 * Returns: ActionResult
 */
ironclawRouter.post(
  '/:problemSetId/confirm',
  async (req: Request, res: Response) => {
    const problemSetId = req.params.problemSetId as string;
    const { actionId, decision } = req.body as {
      actionId?: string;
      decision?: string;
    };

    if (!actionId || typeof actionId !== 'string') {
      res.status(400).json({ error: 'actionId is required and must be a string' });
      return;
    }

    if (!decision || !VALID_DECISIONS.has(decision as TrustDecision)) {
      res.status(400).json({
        error: "decision is required and must be one of: 'yes', 'no', 'always'",
      });
      return;
    }

    const userDid = getUserDid(req);

    try {
      const result = await actionPipeline.handleConfirmation(
        actionId,
        userDid,
        problemSetId,
        decision as TrustDecision,
      );

      // Record outcome for adaptive preference learning (fire-and-forget)
      if (result.status === 'executed') {
        const actionType = result.action_card?.action_type ?? result.result?.action_type as string ?? 'unknown';
        memoryRetrievalService
          .recordOutcome(userDid, problemSetId, 'suggestion_accepted', { action_type: actionType })
          .catch((err) => console.error('[ironclaw-memory] outcome record failed:', err));
      } else if (decision === 'no') {
        const actionType = result.action_card?.action_type ?? 'unknown';
        memoryRetrievalService
          .recordOutcome(userDid, problemSetId, 'suggestion_rejected', { action_type: actionType })
          .catch((err) => console.error('[ironclaw-memory] outcome record failed:', err));
      }

      // If decision resulted in execution, publish to WebSocket
      if (result.status === 'executed') {
        try {
          const bus = getMessageBus();
          await bus.publish({
            sourceDid: 'did:system:ironclaw-service',
            sourceType: 'system',
            destinationType: 'channel',
            destinationTarget: `ironclaw.${problemSetId}`,
            messageType: 'ironclaw.action-executed',
            payload: { actionId, decision, result },
          });
        } catch (wsErr) {
          console.error('[ironclaw-router] WebSocket publish error:', wsErr);
        }
      }

      res.json(result);
    } catch (err) {
      console.error('[ironclaw-router] Confirm endpoint error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

/**
 * GET /trust-preferences
 * Retrieve a user's trust preferences for a specific problem set.
 *
 * Query: problemSetId (required)
 * Returns: TrustPreference[]
 */
ironclawRouter.get('/trust-preferences', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  const problemSetId = req.query.problemSetId as string | undefined;

  if (!problemSetId) {
    res.status(400).json({ error: 'problemSetId query parameter is required' });
    return;
  }

  try {
    const preferences = await ironclawStore.getAllTrustPreferences(
      userDid,
      problemSetId,
    );
    res.json(preferences);
  } catch (err) {
    console.error('[ironclaw-router] Trust preferences error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

/**
 * DELETE /trust-preferences/:preferenceId
 * Revoke a specific trust preference.
 *
 * Verifies the preference belongs to the requesting user before revoking.
 */
ironclawRouter.delete(
  '/trust-preferences/:preferenceId',
  async (req: Request, res: Response) => {
    const userDid = getUserDid(req);
    const preferenceId = req.params.preferenceId as string;

    try {
      // Look up the preference to verify ownership and extract revoke params
      const allPrefs = await ironclawStore.getAllTrustPreferences(userDid, '%');
      const pref = allPrefs.find(
        (p) => p.id === preferenceId && p.user_did === userDid,
      );

      if (!pref) {
        res.status(404).json({ error: 'Trust preference not found or does not belong to user' });
        return;
      }

      await ironclawStore.revokeTrust(
        userDid,
        pref.problem_set_id,
        pref.action_type,
      );

      res.status(204).end();
    } catch (err) {
      console.error('[ironclaw-router] Revoke trust error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Memory Management Endpoints (Plan 03)
// ---------------------------------------------------------------------------

/**
 * GET /memory
 * List all active memories for the authenticated user.
 */
ironclawRouter.get('/memory', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  try {
    const memories = await ironclawUserMemoryStore.getActiveMemories(userDid);
    res.json({ memories });
  } catch (err) {
    console.error('[ironclaw-router] GET /memory error:', err);
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

/**
 * DELETE /memory/all
 * Delete ALL memories for the authenticated user.
 * Registered BEFORE /memory/:key to avoid Express matching 'all' as a key param.
 */
ironclawRouter.delete('/memory/all', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  try {
    await ironclawUserMemoryStore.deleteAllUserMemories(userDid);
    res.json({ deleted: 'all' });
  } catch (err) {
    console.error('[ironclaw-router] DELETE /memory/all error:', err);
    res.status(500).json({ error: 'Failed to delete memories' });
  }
});

/**
 * DELETE /memory/:key
 * Delete a specific memory entry by key for the authenticated user.
 */
ironclawRouter.delete('/memory/:key', async (req: Request, res: Response) => {
  const userDid = getUserDid(req);
  const memoryKey = req.params.key as string;
  if (!memoryKey) {
    res.status(400).json({ error: 'memory key is required' });
    return;
  }
  try {
    await ironclawUserMemoryStore.deleteUserMemory(userDid, memoryKey);
    res.json({ deleted: memoryKey });
  } catch (err) {
    console.error('[ironclaw-router] DELETE /memory/:key error:', err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

/**
 * Extract user role from request attributes (set by zeroTrust middleware).
 */
function getUserRole(req: Request): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  return anyReq.zeroTrust?.attributes?.role || anyReq.user?.role || '';
}

/**
 * POST /:problemSetId/emergency
 * Execute an emergency action that bypasses normal confirmation flow.
 *
 * Body: { actionId: string, justification: string }
 * Requires: system_admin role + non-empty justification for audit trail.
 */
ironclawRouter.post(
  '/:problemSetId/emergency',
  async (req: Request, res: Response) => {
    // Enforce system_admin role — emergency mode is not delegatable to agents
    const role = getUserRole(req);
    if (role !== 'system_admin') {
      console.warn(
        `[ironclaw-router] Emergency endpoint access denied: role="${role}", did="${getUserDid(req)}"`,
      );
      res.status(403).json({
        error: 'Emergency actions require system_admin role',
      });
      return;
    }

    const problemSetId = req.params.problemSetId as string;
    const { actionId, justification } = req.body as {
      actionId?: string;
      justification?: string;
    };

    if (!actionId || typeof actionId !== 'string') {
      res.status(400).json({ error: 'actionId is required and must be a string' });
      return;
    }

    if (!justification || typeof justification !== 'string' || !justification.trim()) {
      res.status(400).json({
        error: 'justification is required and must be a non-empty string',
      });
      return;
    }

    const userDid = getUserDid(req);

    try {
      const result = await actionPipeline.handleEmergencyAction(
        {
          id: actionId,
          type: 'emergency',
          description: `Emergency action: ${actionId}`,
          payload: {},
          problem_set_id: problemSetId,
          requested_by: userDid,
        },
        userDid,
        justification.trim(),
      );

      res.json(result);
    } catch (err) {
      console.error('[ironclaw-router] Emergency endpoint error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Suggestion Accept Endpoint
// ---------------------------------------------------------------------------

/**
 * Role → allowed target field prefixes.
 * '*' means the role can write any field.
 * All other entries are prefix matches (startsWith).
 */
const ROLE_FIELD_PERMISSIONS: Record<string, string[] | '*'> = {
  commander:    '*',
  xo:           '*',
  j2:           ['design.problemFraming', 'design.cogAnalysis', 'intelligence'],
  j3:           ['design.operationalApproach', 'design.linesOfEffort', 'plan.coaDetails'],
  j5:           ['design', 'plan'],
  j4:           ['plan.sustainment', 'resources'],
  j6:           ['plan.c4isr', 'communications'],
};

function roleCanWriteField(role: string, targetField: string): boolean {
  const normalizedRole = role.toLowerCase();
  const perms = ROLE_FIELD_PERMISSIONS[normalizedRole];
  if (!perms) return false;
  if (perms === '*') return true;
  return perms.some((prefix) => targetField.startsWith(prefix));
}

/**
 * Dispatch a field write to the correct persistence layer.
 * Returns true on success, throws on failure.
 */
async function dispatchFieldWrite(
  problemSetId: string,
  targetField: string,
  fieldValue: string,
): Promise<void> {
  // Design section fields — route to design store
  if (targetField.startsWith('design.')) {
    const section = targetField.replace(/^design\./, '');
    // designStore.updateSection expects the section key (e.g. 'problemFraming')
    // and a value that can be a string or object
    await designStore.updateSection(problemSetId, section, fieldValue);
    return;
  }

  // Top-level problem set fields
  if (
    targetField === 'name' ||
    targetField === 'description' ||
    targetField === 'problemStatement' ||
    targetField === 'missionStatement' ||
    targetField === 'commandersIntent'
  ) {
    // Map targetField to ProblemSet update fields
    const fieldMap: Record<string, 'name' | 'description' | 'problemStatement'> = {
      name: 'name',
      description: 'description',
      problemStatement: 'problemStatement',
      // missionStatement and commandersIntent map to problemStatement for now
      missionStatement: 'problemStatement',
      commandersIntent: 'description',
    };
    const mappedField = fieldMap[targetField];
    if (mappedField) {
      await problemSetStore.updateProblemSet(problemSetId, { [mappedField]: fieldValue });
      return;
    }
  }

  // Generic fallback: attempt a raw DB update into the problem set metadata
  // This handles any unknown field paths gracefully
  console.warn(
    `[ironclaw-router] dispatchFieldWrite: unknown targetField "${targetField}" — skipping write`,
  );
}

/**
 * POST /api/ironclaw/suggestions/:id/accept
 * Body: { problemSetId, targetField, fieldValue }
 *
 * Validates the suggestion exists, checks role permissions, enforces Decision Gate
 * requirement for sensitive fields, and dispatches the field write.
 */
ironclawRouter.post(
  '/suggestions/:id/accept',
  async (req: Request, res: Response) => {
    const suggestionId = req.params.id as string;
    const { problemSetId, targetField, fieldValue } = req.body as {
      problemSetId?: string;
      targetField?: string;
      fieldValue?: string;
    };

    if (!problemSetId || typeof problemSetId !== 'string') {
      res.status(400).json({ error: 'problemSetId is required' });
      return;
    }
    if (!targetField || typeof targetField !== 'string') {
      res.status(400).json({ error: 'targetField is required' });
      return;
    }
    if (fieldValue === undefined || fieldValue === null) {
      res.status(400).json({ error: 'fieldValue is required' });
      return;
    }

    const userDid = getUserDid(req);

    try {
      // 1. Verify the suggestion exists in the message store
      const pool = getPool();
      const msgResult = await pool.query(
        `SELECT id FROM ironclaw_chat
         WHERE suggestion->>'id' = $1
         LIMIT 1`,
        [suggestionId],
      );
      if (msgResult.rows.length === 0) {
        res.status(404).json({ error: 'Suggestion not found' });
        return;
      }

      // 2. Check the user's role in this problem set
      const member = await problemSetMemberStore.getMember(problemSetId, userDid);
      if (!member) {
        res.status(403).json({ error: 'Not a member of this problem set' });
        return;
      }
      if (member.status === 'suspended') {
        res.status(403).json({ error: 'Your membership is suspended' });
        return;
      }

      if (!roleCanWriteField(member.role, targetField)) {
        res.status(403).json({
          error: `Your role (${member.role}) does not have write access to field: ${targetField}`,
        });
        return;
      }

      // 3. Sensitive fields require a Decision Gate
      if (SENSITIVE_FIELDS.has(targetField)) {
        const gateResult = await pool.query(
          `SELECT id FROM decision_gates
           WHERE problem_set_id = $1
             AND status = 'approved'
             AND metadata->>'suggestion_id' = $2
           LIMIT 1`,
          [problemSetId, suggestionId],
        );
        if (gateResult.rows.length === 0) {
          res.status(403).json({
            error: 'Requires Decision Gate approval',
            requiresGate: true,
            targetField,
          });
          return;
        }
      }

      // 4. Dispatch field write
      await dispatchFieldWrite(problemSetId, targetField, String(fieldValue));

      // 5. Record outcome for adaptive preference learning (fire-and-forget)
      memoryRetrievalService
        .recordOutcome(userDid, problemSetId, 'suggestion_accepted', {
          suggestion_type: targetField,
        })
        .catch((err) => console.error('[ironclaw-memory] outcome record failed:', err));

      // 6. Success
      res.json({ applied: true, field: targetField });
    } catch (err) {
      console.error('[ironclaw-router] Suggestion accept error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

/**
 * POST /api/ironclaw/suggestions/:id/revise
 * Request revision of a suggestion — re-dispatches to Ironclaw with user feedback.
 * Body: { problemSetId, feedback }
 */
ironclawRouter.post(
  '/suggestions/:id/revise',
  async (req: Request, res: Response) => {
    const suggestionId = req.params.id as string;
    const { problemSetId, feedback } = req.body as {
      problemSetId?: string;
      feedback?: string;
    };

    if (!problemSetId || typeof problemSetId !== 'string') {
      res.status(400).json({ error: 'problemSetId is required' });
      return;
    }
    if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
      res.status(400).json({ error: 'feedback is required' });
      return;
    }

    try {
      // Find the suggestion's associated task
      const pool = getPool();
      const msgResult = await pool.query(
        `SELECT suggestion FROM ironclaw_chat
         WHERE suggestion->>'id' = $1
         LIMIT 1`,
        [suggestionId],
      );
      if (msgResult.rows.length === 0) {
        res.status(404).json({ error: 'Suggestion not found' });
        return;
      }

      const suggestion = msgResult.rows[0].suggestion as Record<string, unknown>;
      const targetField = (suggestion.target_field as string) ?? '';
      const targetLabel = (suggestion.target_field_label as string) ?? targetField;
      const agentId = (suggestion.agent_id as string) ?? 'ironclaw';

      // Find task containing this suggestion, or create a one-off revision task
      const orchestrator = getTaskOrchestrator();
      const taskStore = getTaskStore();
      const tasks = await taskStore.getTasksForProblemSet(problemSetId);
      const ownerTask = tasks.find((t) =>
        t.suggestions.some((s) => s.id === suggestionId),
      );

      if (ownerTask) {
        // Revise through existing task
        await orchestrator.handleRefinement(ownerTask.taskId, feedback.trim(), suggestionId);
      } else {
        // No task context — create a targeted revision task
        const task = await orchestrator.createTask({
          problemSetId,
          userDid: getUserDid(req),
          title: `Revise: ${targetLabel}`,
          description: `User feedback on previous suggestion: "${feedback.trim()}"\n\nOriginal suggestion by ${agentId}. Revise the analysis for ${targetLabel} incorporating this feedback.`,
          targetFields: targetField ? { [targetField]: targetLabel } : {},
          agentHints: [agentId],
        });
        orchestrator.dispatchTask(task.taskId).catch((err) =>
          console.error(`[ironclaw] Revision task dispatch failed: ${task.taskId}`, err),
        );
      }

      // Post a chat message so the user sees the revision was requested
      await ironclawStore.addMessage({
        problem_set_id: problemSetId,
        content: `Revision requested for **${targetLabel}**: "${feedback.trim()}"\n\nRe-analyzing with your feedback. Updated suggestion will appear when ready.`,
        sender: 'ironclaw',
        specialist_id: null,
        specialist_display_name: null,
        delegated_by: null,
        action_card: null,
        step_progress: null,
        suggestion: null,
      });

      res.json({ revising: true });
    } catch (err) {
      console.error('[ironclaw-router] Suggestion revise error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Task Orchestration Endpoints (Plan 05)
// ---------------------------------------------------------------------------

/**
 * GET /tasks/:problemSetId
 * List tasks for a problem set, optionally filtered by status.
 */
ironclawRouter.get('/tasks/:problemSetId', async (req: Request, res: Response) => {
  const problemSetId = req.params.problemSetId as string;
  const status = req.query.status as string | undefined;

  try {
    const store = getTaskStore();
    const tasks = await store.getTasksForProblemSet(
      problemSetId,
      status as import('./task-types.js').TaskStatus | undefined,
    );
    res.json(tasks);
  } catch (err) {
    console.error('[ironclaw-router] List tasks error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

/**
 * GET /tasks/detail/:taskId
 * Get a single task with current step progress.
 */
ironclawRouter.get('/tasks/detail/:taskId', async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;

  try {
    const store = getTaskStore();
    const task = await store.getTask(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (err) {
    console.error('[ironclaw-router] Get task error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

/**
 * POST /tasks/:taskId/approve/:suggestionId
 * Approve a task suggestion.
 */
ironclawRouter.post(
  '/tasks/:taskId/approve/:suggestionId',
  async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const suggestionId = req.params.suggestionId as string;

    try {
      const orchestrator = getTaskOrchestrator();
      await orchestrator.handleApproval(taskId, suggestionId, 'approved');
      res.json({ approved: true });
    } catch (err) {
      console.error('[ironclaw-router] Task approve error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

/**
 * POST /tasks/:taskId/dismiss/:suggestionId
 * Dismiss a task suggestion.
 */
ironclawRouter.post(
  '/tasks/:taskId/dismiss/:suggestionId',
  async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const suggestionId = req.params.suggestionId as string;

    try {
      const orchestrator = getTaskOrchestrator();
      await orchestrator.handleApproval(taskId, suggestionId, 'dismissed');
      res.json({ dismissed: true });
    } catch (err) {
      console.error('[ironclaw-router] Task dismiss error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

/**
 * POST /tasks/:taskId/refine
 * Submit refinement feedback for a task.
 * Body: { feedback: string, suggestionId?: string }
 */
ironclawRouter.post('/tasks/:taskId/refine', async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const { feedback, suggestionId } = req.body as {
    feedback?: string;
    suggestionId?: string;
  };

  if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
    res.status(400).json({ error: 'feedback is required and must be a non-empty string' });
    return;
  }

  try {
    const orchestrator = getTaskOrchestrator();
    await orchestrator.handleRefinement(taskId, feedback.trim(), suggestionId);
    res.json({ refining: true });
  } catch (err) {
    console.error('[ironclaw-router] Task refine error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

// =========================================================================
// Thread management — compartmentalized conversations
// =========================================================================

/** GET /:problemSetId/threads/tab/:tabName — Get or create tab-scoped thread */
ironclawRouter.get('/:problemSetId/threads/tab/:tabName', async (req: Request, res: Response) => {
  try {
    const userDid = getUserDid(req);
    const thread = await ironclawStore.getOrCreateTabThread(
      req.params.problemSetId as string,
      userDid,
      req.params.tabName as string,
    );
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /:problemSetId/threads — List threads for the current user */
ironclawRouter.get('/:problemSetId/threads', async (req: Request, res: Response) => {
  try {
    const userDid = getUserDid(req);
    const threads = await ironclawStore.listThreads(req.params.problemSetId as string, userDid);
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /:problemSetId/threads — Create a new thread */
ironclawRouter.post('/:problemSetId/threads', async (req: Request, res: Response) => {
  try {
    const userDid = getUserDid(req);
    const { name } = req.body as { name?: string };
    const thread = await ironclawStore.createThread(
      req.params.problemSetId as string, userDid, name ?? 'New Thread',
    );
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /:problemSetId/threads/:threadId/rename — Rename a thread */
ironclawRouter.post('/:problemSetId/threads/:threadId/rename', async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name: string };
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    await ironclawStore.renameThread(req.params.threadId as string, name.trim());
    res.json({ renamed: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** DELETE /:problemSetId/threads/:threadId — Delete a thread and its messages */
ironclawRouter.delete('/:problemSetId/threads/:threadId', async (req: Request, res: Response) => {
  try {
    await ironclawStore.deleteThread(req.params.threadId as string);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ---------------------------------------------------------------------------
// Autonomous Activity Feed (Plan 65-05)
// ---------------------------------------------------------------------------

/**
 * GET /activity/:problemSetId
 * Retrieve autonomous activity entries for a problem set.
 *
 * Query params:
 *   limit  — number of entries to return (default 50, max 200)
 *   since  — ISO timestamp; if provided, only entries after this time are returned
 *
 * Returns: { activities: ActivityEntry[], total: number }
 */
ironclawRouter.get(
  '/activity/:problemSetId',
  async (req: Request, res: Response) => {
    const problemSetId = req.params.problemSetId as string;

    // Parse limit (default 50, max 200)
    const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : 50;
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 200);

    // Parse optional since timestamp
    const sinceParam = req.query.since as string | undefined;
    const since = sinceParam ? new Date(sinceParam) : null;

    try {
      const activities = await autonomousActivityStore.getRecent(problemSetId, limit);

      // Filter by since timestamp if provided
      const filtered = since
        ? activities.filter((a) => a.createdAt > since)
        : activities;

      res.json({ activities: filtered, total: filtered.length });
    } catch (err) {
      console.error('[ironclaw-router] GET /activity/:problemSetId error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

/**
 * PATCH /:problemSetId/activity/:activityId/rate
 * Commander rates an autonomous activity as helpful (1) or not helpful (-1).
 * Optional notes can accompany the rating.
 *
 * Body: { rating: 1 | -1, notes?: string }
 * Returns: { success: true }
 */
ironclawRouter.patch(
  '/:problemSetId/activity/:activityId/rate',
  async (req: Request, res: Response) => {
    try {
      const { rating, notes } = req.body as { rating: number; notes?: string };
      if (typeof rating !== 'number' || (rating !== 1 && rating !== -1)) {
        res.status(400).json({ error: 'rating must be 1 or -1' });
        return;
      }
      await autonomousActivityStore.updateOutcome(
        req.params.activityId as string,
        rating,
        notes ?? null,
      );
      res.json({ success: true });
    } catch (err) {
      console.error('[ironclaw] rate activity error:', err);
      res.status(500).json({ error: 'Failed to rate activity' });
    }
  },
);

// ---------------------------------------------------------------------------
// Routine Diagnostics (v0.24 upgrade)
// ---------------------------------------------------------------------------

/**
 * GET /routines/diagnostics
 * Query Ironclaw's routines table to see what's registered, whether routines
 * are advancing (next_fire_at moving forward), and their verification state.
 *
 * Returns: { routines: RoutineDiagEntry[], ironclawDbReachable: boolean }
 */
ironclawRouter.get(
  '/routines/diagnostics',
  async (_req: Request, res: Response) => {
    try {
      const pg = await import('pg');
      const url = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL;
      if (!url) {
        res.status(503).json({
          error: 'DATABASE_URL_IRONCLAW not configured — cannot query Ironclaw routines table',
          ironclawDbReachable: false,
          routines: [],
        });
        return;
      }

      const pool = new pg.default.Pool({ connectionString: url, max: 1 });
      try {
        const result = await pool.query(`
          SELECT
            name,
            description,
            user_id,
            enabled,
            trigger_type,
            trigger_config,
            action_type,
            action_config,
            cooldown_secs,
            next_fire_at,
            state,
            created_at,
            updated_at
          FROM routines
          ORDER BY updated_at DESC
          LIMIT 50
        `);

        res.json({
          ironclawDbReachable: true,
          routineCount: result.rows.length,
          routines: result.rows.map((r: Record<string, unknown>) => ({
            name: r.name,
            description: r.description,
            userId: r.user_id,
            enabled: r.enabled,
            triggerType: r.trigger_type,
            triggerConfig: r.trigger_config,
            actionType: r.action_type,
            actionConfig: r.action_config,
            cooldownSecs: r.cooldown_secs,
            nextFireAt: r.next_fire_at,
            state: r.state,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        });
      } finally {
        await pool.end();
      }
    } catch (err) {
      console.error('[ironclaw-router] GET /routines/diagnostics error:', err);
      res.status(500).json({
        ironclawDbReachable: false,
        error: err instanceof Error ? err.message : 'Internal server error',
        routines: [],
      });
    }
  },
);

/**
 * POST /routines/re-register
 * Force re-registration of all autonomous monitoring routines for active
 * problem sets. Useful after Ironclaw version upgrades or DB resets.
 *
 * Also re-registers the built-in global routines (knowledge sync, daily brief, etc.).
 */
ironclawRouter.post(
  '/routines/re-register',
  async (_req: Request, res: Response) => {
    try {
      const { routineService } = await import('./routine-service.js');
      const { BUILT_IN_ROUTINES } = await import('./routine-service.js');
      const bastionPool = getPool();

      // Clean up stale CLI-registered routines from pre-v0.24 entrypoint.sh.
      // These were registered without problem set IDs and may have wrong action_type.
      const staleNames = [
        'autonomous_monitoring',
        'bastion_knowledge_sync',
        'daily_situation_brief',
        'weekly_capability_update',
      ];
      const cleaned: string[] = [];
      try {
        const pg = await import('pg');
        const url = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL;
        if (url) {
          const ironclawPool = new pg.default.Pool({ connectionString: url, max: 1 });
          try {
            for (const name of staleNames) {
              const result = await ironclawPool.query(
                `DELETE FROM routines WHERE name = $1 AND user_id NOT IN ('system', 'default') RETURNING name`,
                [name],
              );
              if (result.rowCount && result.rowCount > 0) {
                cleaned.push(name);
              }
            }
          } finally {
            await ironclawPool.end();
          }
        }
      } catch (err) {
        console.warn('[ironclaw-router] re-register: stale cleanup failed (non-fatal):', err instanceof Error ? err.message : err);
      }

      // Re-register built-in global routines
      const registered: string[] = [];
      for (const routine of BUILT_IN_ROUTINES) {
        if (!routine.defaultCron) continue;
        try {
          await routineService.registerRoutine(routine.id, routine.defaultCron);
          registered.push(routine.id);
        } catch (err) {
          console.warn(`[ironclaw-router] re-register: failed ${routine.id}:`, err instanceof Error ? err.message : err);
        }
      }

      // Re-register per-problem-set autonomous monitoring
      const activePs = await bastionPool.query<{ id: string; name: string }>(
        `SELECT id, name FROM problem_sets WHERE status IN ('active', 'planning', 'in-progress') LIMIT 50`,
      );
      for (const row of activePs.rows) {
        try {
          await routineService.registerAutonomousMonitoring(row.id);
          registered.push(`autonomous_monitoring__${row.id}`);
        } catch (err) {
          console.warn(`[ironclaw-router] re-register: failed monitoring for ${row.id}:`, err instanceof Error ? err.message : err);
        }
      }

      res.json({
        success: true,
        staleCleaned: cleaned,
        registered,
        problemSetsFound: activePs.rows.length,
      });
    } catch (err) {
      console.error('[ironclaw-router] POST /routines/re-register error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  },
);

// ---------------------------------------------------------------------------
// Concept extraction endpoint (Phase 66 Plan 03)
// ---------------------------------------------------------------------------

/**
 * POST /:problemSetId/extract
 *
 * Trigger concept extraction from a completed conversation thread.
 * Fire-and-forget — returns immediately, extraction runs asynchronously.
 *
 * Body: { threadId: string }
 * Returns: { status: 'extraction_started' }
 */
ironclawRouter.post('/:problemSetId/extract', async (req: Request, res: Response) => {
  try {
    const userDid = getUserDid(req);
    const { threadId } = req.body as { threadId?: string };

    // Validate threadId (T-66-07)
    if (!threadId || typeof threadId !== 'string' || threadId.trim().length === 0) {
      return res.status(400).json({ error: 'threadId required' });
    }

    // Fire-and-forget — don't await extraction
    const problemSetId = req.params.problemSetId as string ?? null;
    conceptExtractionService
      .extractFromThread(threadId.trim(), userDid, problemSetId)
      .catch((err) => console.error('[ironclaw-router] extraction error:', err));

    return res.json({ status: 'extraction_started' });
  } catch (err) {
    console.error('[ironclaw-router] POST /:problemSetId/extract error:', err);
    return res.status(500).json({ error: 'Failed to start extraction' });
  }
});

// ---------------------------------------------------------------------------
// Startup: ensure ironclaw_events table exists (Phase 67)
// ---------------------------------------------------------------------------
ironclawEventStore.ensureTable().catch((err) =>
  console.error('[ironclaw-router] Failed to ensure ironclaw_events table:', err),
);
