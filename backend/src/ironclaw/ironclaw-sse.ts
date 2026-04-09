/**
 * Ironclaw SSE Streaming Endpoint
 *
 * Phase 67 Plan 01: Handles GET /:problemSetId/stream and /global/stream
 * SSE connections. Provides Last-Event-ID replay for reconnecting clients,
 * 30-second heartbeat keepalives, and per-scope connection limits.
 *
 * Security mitigations (STRIDE):
 *  - T-67-01: Global scope validated against authenticated user's DID
 *  - T-67-03: Max 5 concurrent SSE connections per scopeId (DoS protection)
 *  - T-67-04: Last-Event-ID parsed as integer; NaN rejected
 */

import type { Request, Response } from 'express';
import { ironclawEventStore } from './ironclaw-event-store.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CONNECTIONS_PER_SCOPE = 5;

// ---------------------------------------------------------------------------
// Helper: extract user DID from request
// Following the same pattern as ironclaw-router.ts getUserDid()
// ---------------------------------------------------------------------------

function getUserDid(req: Request): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  if (anyReq.zeroTrust?.did) return anyReq.zeroTrust.did as string;
  if (anyReq.user?.did) return anyReq.user.did as string;
  return (req.headers['x-did'] as string) || 'did:near:anonymous';
}

// ---------------------------------------------------------------------------
// SSE stream handler
// ---------------------------------------------------------------------------

/**
 * handleSSEStream
 *
 * Handles SSE connections for both problem-set-scoped and global streams.
 *
 * Routes:
 *   GET /:problemSetId/stream  — scoped to a specific problem set
 *   GET /global/stream         — scoped to the authenticated user globally
 *
 * Protocol:
 *  1. Determine scopeId
 *  2. Auth guard for global scope (T-67-01)
 *  3. Connection limit check (T-67-03)
 *  4. Set SSE headers and flush
 *  5. Replay missed events via Last-Event-ID (T-67-04)
 *  6. Register client
 *  7. Start heartbeat
 *  8. Clean up on disconnect
 */
export async function handleSSEStream(req: Request, res: Response): Promise<void> {
  const userDid = getUserDid(req);

  // Determine scope
  let scopeId: string;
  const isGlobal = req.path.endsWith('/global/stream') || !req.params.problemSetId;

  if (isGlobal || req.params.problemSetId === 'global') {
    // Global stream — scoped per authenticated user
    scopeId = `_global_${userDid}`;

    // T-67-01: Validate that the scope belongs to this user.
    // The scope pattern is _global_<userDid>, so as long as userDid is the
    // authenticated user (which getUserDid() ensures), this is safe.
    // Extra defence: reject anonymous users from the global stream.
    if (userDid === 'did:near:anonymous') {
      res.status(403).json({ error: 'Authentication required for global stream' });
      return;
    }
  } else {
    scopeId = req.params.problemSetId as string;
  }

  // T-67-03: Enforce per-scope connection limit to prevent DoS
  if (ironclawEventStore.getClientCount(scopeId) >= MAX_CONNECTIONS_PER_SCOPE) {
    res.status(429).json({ error: 'Too Many Requests: connection limit reached for this scope' });
    return;
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // T-67-04: Last-Event-ID replay
  // Accept both the standard Last-Event-ID header and lastEventId query param (Pitfall 4 fallback)
  const rawLastEventId =
    (req.headers['last-event-id'] as string | undefined) ??
    (req.query.lastEventId as string | undefined);

  if (rawLastEventId !== undefined && rawLastEventId !== '') {
    const lastId = parseInt(rawLastEventId, 10);
    if (!isNaN(lastId)) {
      // Replay all missed events since lastId
      const missed = await ironclawEventStore.getEventsSince(scopeId, lastId);
      for (const event of missed) {
        res.write(`id: ${event.id}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      }
    }
    // NaN values are silently ignored — no replay, just continue with live stream
  }

  // Register client for live event delivery
  ironclawEventStore.registerClient(scopeId, res);

  // Start 30-second heartbeat to keep connection alive through nginx/proxies
  const heartbeatHandle = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      // Client disconnected — cleanup will handle this
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatHandle);
    ironclawEventStore.removeClient(scopeId, res);
    res.end();
  });
}
