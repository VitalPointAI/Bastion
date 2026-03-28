/**
 * Agent Config REST API
 *
 * Phase 60 Plan 03: GET/PUT /api/agent-config/:userId
 *
 * Provides per-user Ironclaw identity configuration. Each user can read and
 * update their own AgentConfig, which drives USER.md/SOUL.md/HEARTBEAT.md/
 * AGENTS.md generation (Blueprint Section 3.1–3.5).
 *
 * Authentication: requests must be made as the user's own DID.
 * `:userId` is the NEAR account ID — resolved to `did:near:{userId}`.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { agentConfigStore } from '../ironclaw/agent-config-store.js';
import { ironclawService } from '../ironclaw/ironclaw-service.js';
import { ironclawClient } from '../ironclaw/ironclaw-client.js';
import type { AgentConfig } from '../ironclaw/ironclaw-types.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the requesting user's DID from the request.
 * Checks zeroTrust middleware first, then req.user, then X-DID header.
 */
function getRequestingDid(req: Request): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  if (anyReq.zeroTrust?.did) return anyReq.zeroTrust.did as string;
  if (anyReq.user?.did) return anyReq.user.did as string;
  const headerDid = req.headers['x-did'];
  if (typeof headerDid === 'string' && headerDid.startsWith('did:')) return headerDid;
  return null;
}

/**
 * Convert a NEAR account ID to a DID.
 * e.g. "alice.near" → "did:near:alice.near"
 */
function nearAccountToDid(nearAccount: string): string {
  return `did:near:${nearAccount}`;
}

// ---------------------------------------------------------------------------
// GET /api/agent-config/:userId
// ---------------------------------------------------------------------------

/**
 * Get AgentConfig for a user.
 * If no config exists, creates and returns a default configuration.
 *
 * Auth: requesting user must be the same as :userId.
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const targetDid = nearAccountToDid(userId);
    const requestingDid = getRequestingDid(req);

    // Auth check — user can only read their own config
    if (requestingDid && requestingDid !== targetDid) {
      return res.status(403).json({ error: 'Forbidden: you may only read your own agent config' });
    }

    // Attempt lookup
    let config = await agentConfigStore.getByDid(targetDid);

    // Create default on first access
    if (!config) {
      config = await agentConfigStore.createDefault(targetDid, userId);
    }

    return res.status(200).json(config);
  } catch (err) {
    console.error('[agent-config] GET error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/agent-config/:userId
// ---------------------------------------------------------------------------

/**
 * Update AgentConfig for a user.
 * Validates required fields and pushes updated identity files to Ironclaw.
 *
 * Auth: requesting user must be the same as :userId.
 */
router.put('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const targetDid = nearAccountToDid(userId);
    const requestingDid = getRequestingDid(req);

    // Auth check — user can only update their own config
    if (requestingDid && requestingDid !== targetDid) {
      return res.status(403).json({ error: 'Forbidden: you may only update your own agent config' });
    }

    const body = req.body as Partial<AgentConfig>;

    // Validate required fields
    const requiredFields: (keyof AgentConfig)[] = [
      'displayName',
      'rank',
      'staffSection',
      'position',
      'unit',
    ];
    const missingFields = requiredFields.filter((f) => !body[f]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    // Merge with existing config (or defaults) so partial updates work
    let existing = await agentConfigStore.getByDid(targetDid);
    if (!existing) {
      existing = await agentConfigStore.createDefault(targetDid, userId);
    }

    const updated: AgentConfig = {
      ...existing,
      ...body,
      did: targetDid,           // Never override DID from body
      nearAccount: userId,       // Never override nearAccount from body
      identityLastSyncedAt: existing.identityLastSyncedAt,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    const saved = await agentConfigStore.upsert(updated);

    // Push updated identity files to Ironclaw (fire-and-forget)
    // syncUserIdentity updates identityLastSyncedAt internally
    ironclawService.syncUserIdentity(saved.did, saved).catch((err) => {
      console.error('[agent-config] syncUserIdentity failed after PUT:', err);
    });

    return res.status(200).json(saved);
  } catch (err) {
    console.error('[agent-config] PUT error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agent-config/:userId/telegram-pair
// ---------------------------------------------------------------------------

/**
 * Initiate Telegram pairing for a user.
 *
 * Sends `/telegram pair` to Ironclaw via webhook on behalf of the user's DID.
 * Ironclaw then sends a 6-digit pairing code to the user's Telegram via the
 * configured bot.
 *
 * Auth: requesting user must be the same as :userId.
 */
router.post('/:userId/telegram-pair', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const targetDid = nearAccountToDid(userId);
    const requestingDid = getRequestingDid(req);

    if (requestingDid && requestingDid !== targetDid) {
      return res.status(403).json({ error: 'Forbidden: you may only initiate pairing for your own account' });
    }

    await ironclawClient.sendMessage(targetDid, '/telegram pair', userId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[agent-config] telegram-pair error:', err);
    return res.status(500).json({ error: 'Failed to initiate Telegram pairing' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agent-config/:userId/telegram-confirm
// ---------------------------------------------------------------------------

/**
 * Confirm Telegram pairing with a 6-digit code.
 *
 * Sends `/telegram confirm {code}` to Ironclaw via webhook. If the code is
 * valid, Ironclaw responds with the chat ID which is returned to the client
 * for storage in AgentConfig.
 *
 * Auth: requesting user must be the same as :userId.
 */
router.post('/:userId/telegram-confirm', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const targetDid = nearAccountToDid(userId);
    const requestingDid = getRequestingDid(req);

    if (requestingDid && requestingDid !== targetDid) {
      return res.status(403).json({ error: 'Forbidden: you may only confirm pairing for your own account' });
    }

    const { code } = req.body as { code?: string };
    if (!code) {
      return res.status(400).json({ error: 'Missing required field: code' });
    }

    // Send confirmation command to Ironclaw
    const response = await ironclawClient.sendMessage(targetDid, `/telegram confirm ${code}`, userId);

    // Ironclaw returns the chat ID in the response message if pairing succeeded
    // Parse chat ID from the response content (format: "PAIRED:chatId" or plain text)
    const content = typeof response === 'object' && 'content' in response
      ? String((response as { content: unknown }).content)
      : '';

    const chatIdMatch = content.match(/PAIRED:(\d+)/) ?? content.match(/chat_id[:\s]+(\d+)/i);
    const chatId = chatIdMatch ? chatIdMatch[1] : null;

    if (!chatId) {
      // Pairing may have failed (wrong code, bot not started, etc.)
      // Return the raw message so the frontend can display it
      return res.status(400).json({
        error: content || 'Pairing failed. Check the code and try again.',
      });
    }

    // Persist chat ID to AgentConfig
    const existing = await agentConfigStore.getByDid(targetDid);
    if (existing) {
      await agentConfigStore.upsert({
        ...existing,
        telegramEnabled: true,
        telegramChatId: chatId,
        updatedAt: new Date(),
      });
    }

    return res.status(200).json({ ok: true, chatId });
  } catch (err) {
    console.error('[agent-config] telegram-confirm error:', err);
    return res.status(500).json({ error: 'Failed to confirm Telegram pairing' });
  }
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const agentConfigRouter = router;
