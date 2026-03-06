/**
 * User Mode API
 *
 * Phase 22: Training/Operational Global Mode
 *
 * GET /api/user-mode - Returns current user's app mode (defaults to 'operational')
 * PUT /api/user-mode - Sets user's app mode to 'training' or 'operational'
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth-instance.js';
import { getPool } from '../lib/database.js';

const router = Router();

const ModeSchema = z.object({
  mode: z.enum(['training', 'operational']),
});

/**
 * GET /api/user-mode - Get current user's application mode
 *
 * Returns { mode: 'training' | 'operational' }
 * Defaults to 'operational' if not set or user profile not found.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const nearAccountId = (req as unknown as { anonUser: { nearAccountId: string } }).anonUser.nearAccountId;
    const pool = getPool();

    const result = await pool.query(
      'SELECT app_mode FROM user_profiles WHERE near_account_id = $1',
      [nearAccountId],
    );

    const mode = result.rows[0]?.app_mode ?? 'operational';
    res.json({ mode });
  } catch (error) {
    console.error('[user-mode] GET error:', error);
    res.status(500).json({ error: 'Failed to get user mode' });
  }
});

/**
 * PUT /api/user-mode - Set current user's application mode
 *
 * Body: { mode: 'training' | 'operational' }
 * Returns { mode: 'training' | 'operational' }
 */
router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const nearAccountId = (req as unknown as { anonUser: { nearAccountId: string } }).anonUser.nearAccountId;
    const parsed = ModeSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid mode. Must be "training" or "operational".' });
      return;
    }

    const { mode } = parsed.data;
    const pool = getPool();

    await pool.query(
      'UPDATE user_profiles SET app_mode = $1, updated_at = NOW() WHERE near_account_id = $2',
      [mode, nearAccountId],
    );

    console.log(`[user-mode] User ${nearAccountId} switched to ${mode} mode`);
    res.json({ mode });
  } catch (error) {
    console.error('[user-mode] PUT error:', error);
    res.status(500).json({ error: 'Failed to set user mode' });
  }
});

export default router;
