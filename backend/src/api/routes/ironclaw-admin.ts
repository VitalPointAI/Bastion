/**
 * Ironclaw Admin Routes
 *
 * Phase 60 Plan 07: Admin endpoints for Ironclaw container management.
 *
 * Provides:
 *   POST /api/admin/ironclaw-update     — Trigger admin-confirmed container update
 *   POST /api/admin/ironclaw-webhook/github-release — GitHub release webhook receiver
 *   GET  /api/admin/ironclaw-status     — Health, version, update availability
 *
 * All endpoints require admin auth (ADMIN_DIDS env var allowlist).
 * The webhook endpoint additionally validates X-Hub-Signature-256.
 *
 * Per blueprint: updates are ALWAYS admin-confirmed, never automatic.
 */

import { createHmac } from 'crypto';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { selfUpdateService } from '../../ironclaw/self-update-service.js';
import { requireAuth } from '../../auth/auth-instance.js';

export const ironclawAdminRouter = Router();

// ---------------------------------------------------------------------------
// Admin auth middleware
// ---------------------------------------------------------------------------

/**
 * Verify the caller is in the ADMIN_DIDS allowlist.
 * Must run after requireAuth so req.anonUser is populated.
 */
function requireIronclawAdmin(req: Request, res: Response, next: NextFunction): void {
  const nearAccountId = req.anonUser?.nearAccountId;
  if (!nearAccountId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const did = `did:near:${nearAccountId}`;
  const adminDids = (process.env.ADMIN_DIDS ?? '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  if (adminDids.length === 0) {
    res.status(403).json({ error: 'System admin access required. No admin DIDs configured.' });
    return;
  }

  if (!adminDids.includes(did)) {
    console.warn(`[ironclaw-admin] Access denied for DID: ${did}`);
    res.status(403).json({ error: 'System admin access required' });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// GET /api/admin/ironclaw-status
// ---------------------------------------------------------------------------

/**
 * Return Ironclaw health status, version info, and update availability.
 */
ironclawAdminRouter.get(
  '/ironclaw-status',
  requireAuth,
  requireIronclawAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const status = await selfUpdateService.getStatus();
      res.status(200).json(status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ironclaw-admin] getStatus error:', message);
      res.status(500).json({ error: 'Failed to retrieve Ironclaw status' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/ironclaw-update
// ---------------------------------------------------------------------------

/**
 * Trigger an admin-confirmed Ironclaw container update.
 * Returns the new version on success.
 */
ironclawAdminRouter.post(
  '/ironclaw-update',
  requireAuth,
  requireIronclawAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await selfUpdateService.triggerUpdate();
      if (result.success) {
        res.status(200).json({
          status: 'update-initiated',
          version: result.version,
        });
      } else {
        res.status(409).json({
          status: 'update-failed',
          error: result.error ?? 'Update failed',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ironclaw-admin] triggerUpdate error:', message);
      res.status(500).json({ error: 'Failed to initiate Ironclaw update' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/ironclaw-webhook/github-release
// ---------------------------------------------------------------------------

interface GitHubReleasePayload {
  action?: string;
  release?: {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    published_at?: string;
  };
  repository?: {
    full_name?: string;
  };
}

/**
 * Receive GitHub release webhook events.
 *
 * Validates X-Hub-Signature-256 using GITHUB_WEBHOOK_SECRET env var.
 * On a valid `release.published` event, stores the release info and sets
 * the updateAvailable flag. Does NOT auto-update — per blueprint, all
 * updates require admin confirmation.
 *
 * NOTE: This endpoint does not require admin auth itself — GitHub calls it
 * from outside. Security is provided by HMAC signature validation.
 */
ironclawAdminRouter.post(
  '/ironclaw-webhook/github-release',
  async (req: Request, res: Response): Promise<void> => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    // If secret is configured, validate the HMAC signature
    if (secret) {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      if (!signature) {
        res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
        return;
      }

      const rawBody = JSON.stringify(req.body);
      const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

      if (signature !== expected) {
        console.warn('[ironclaw-admin] GitHub webhook signature mismatch');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    const payload = req.body as GitHubReleasePayload;
    const event = req.headers['x-github-event'] as string | undefined;

    // Only process release.published events
    if (event === 'release' && payload.action === 'published' && payload.release) {
      const { tag_name, body, html_url, published_at } = payload.release;
      const repoName = payload.repository?.full_name ?? 'unknown';

      console.log(`[ironclaw-admin] GitHub release webhook: ${repoName} ${tag_name}`);

      selfUpdateService.handleReleaseWebhook({
        tagName: tag_name ?? 'unknown',
        releaseNotes: body ?? '',
        htmlUrl: html_url ?? '',
        publishedAt: published_at ?? new Date().toISOString(),
        repoName,
      });
    }

    // Always return 200 to GitHub regardless of action type
    res.status(200).json({ received: true });
  },
);
