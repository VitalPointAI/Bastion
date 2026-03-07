/**
 * Ironclaw REST API Router
 *
 * Phase 30 Plan 02: Express router mounted at /api/ironclaw behind requireAuth.
 * Provides endpoints for chat messaging, history retrieval, and health checks.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { ironclawService } from './ironclaw-service.js';

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
 * POST /:problemSetId/message
 * Send a chat message to Ironclaw. Response streamed via WebSocket.
 *
 * Body: { content: string, mentionedAgent?: string }
 * Returns: 202 Accepted (streaming happens via WebSocket channel ironclaw.<psId>)
 */
ironclawRouter.post(
  '/:problemSetId/message',
  async (req: Request, res: Response) => {
    const problemSetId = req.params.problemSetId as string;
    const { content, mentionedAgent } = req.body as {
      content?: string;
      mentionedAgent?: string;
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'content is required and must be a non-empty string' });
      return;
    }

    const userDid = getUserDid(req);

    try {
      // Fire-and-forget: response streams via WebSocket
      ironclawService
        .handleMessage(problemSetId, userDid, content.trim(), mentionedAgent)
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
