/**
 * Bridge REST Router
 *
 * Phase 43 Plan 02: Express router for bridge administration.
 * Mounted at /api/admin/bridge-tokens and /api/bridge/status.
 *
 * - POST /api/admin/bridge-tokens: Generate a one-time registration token (admin only)
 * - GET /api/bridge/status: List connected bridges and their status
 *
 * Pattern follows discovery-router.ts: requireAuth middleware for protected routes.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../auth/auth-instance.js';
import { bridgeTokenStore } from './bridge-token-store.js';
import { getRobotMissionService } from './robot-mission-service.js';

export const bridgeRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/admin/bridge-tokens
// Generate a one-time registration token for a new bridge device.
// Requires authentication (admin access).
// ---------------------------------------------------------------------------

bridgeRouter.post('/api/admin/bridge-tokens', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const token = await bridgeTokenStore.create(15);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    res.json({
      token,
      expires_at: expiresAt.toISOString(),
      expires_in_minutes: 15,
    });
  } catch (err) {
    console.error('[BridgeRouter] Failed to create bridge token:', err);
    res.status(500).json({ error: 'Failed to generate bridge registration token' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/bridge/status
// Returns the list of currently connected bridges.
// Requires authentication.
// ---------------------------------------------------------------------------

bridgeRouter.get('/api/bridge/status', requireAuth, (_req: Request, res: Response): void => {
  try {
    const service = getRobotMissionService();
    const bridges = service.getConnectedBridges();

    const bridgeList = bridges.map((bridge) => ({
      bridge_id: bridge.bridge_id,
      did: bridge.did,
      capabilities: bridge.capabilities,
      last_heartbeat: bridge.last_heartbeat,
      connected_robots_count: bridge.connected_robots.length,
      connected_robots: bridge.connected_robots,
    }));

    res.json({ bridges: bridgeList, count: bridgeList.length });
  } catch (err) {
    console.error('[BridgeRouter] Failed to get bridge status:', err);
    res.status(500).json({ error: 'Failed to retrieve bridge status' });
  }
});
