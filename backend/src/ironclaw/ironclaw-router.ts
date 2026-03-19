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
// Global (no problem set) endpoints — scoped per user
// ---------------------------------------------------------------------------

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
    const { content, context } = req.body as {
      content?: string;
      context?: MessageContext;
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'content is required and must be a non-empty string' });
      return;
    }

    const userDid = getUserDid(req);

    try {
      // Fire-and-forget: response delivered via WebSocket
      ironclawService
        .handleMessage(problemSetId, userDid, content.trim(), context)
        .catch((err) => {
          console.error(
            `[ironclaw-router] handleMessage error (ps=${problemSetId}):`,
            err,
          );
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
    const limit = limitParam ? Number(limitParam as string) : undefined;

    try {
      const history = await ironclawService.getHistory(problemSetId, limit);
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

      // 5. Success
      res.json({ applied: true, field: targetField });
    } catch (err) {
      console.error('[ironclaw-router] Suggestion accept error:', err);
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
