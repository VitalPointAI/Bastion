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
import { getMessageBus } from '../messaging/message-bus.js';
import { verifyRequest } from './hmac-auth.js';
import type { TrustDecision } from './ironclaw-types.js';

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
