/**
 * Mode Context Middleware
 *
 * Phase 22: Training/Operational Global Mode
 *
 * Extracts the authenticated user's app_mode from user_profiles and attaches
 * it to the request as req.userMode. Downstream handlers can use this to
 * filter data by the user's current mode context.
 *
 * Usage: app.use('/api/some-route', modeMiddleware, handler)
 * After middleware: (req as any).userMode === 'training' | 'operational'
 */

import type { Request, Response, NextFunction } from 'express';
import { getPool } from '../lib/database.js';
import type { AppMode } from '../problem-set/types.js';

/**
 * Middleware that reads the authenticated user's app_mode from user_profiles
 * and attaches it to req.userMode.
 *
 * - If user is not authenticated (no req.anonUser), defaults to 'operational'
 * - If user has no profile row, defaults to 'operational'
 * - Non-blocking: errors default to 'operational' rather than failing the request
 */
export async function modeMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const anonUser = (req as unknown as { anonUser?: { nearAccountId: string } }).anonUser;
    if (anonUser?.nearAccountId) {
      const pool = getPool();
      const result = await pool.query(
        'SELECT app_mode FROM user_profiles WHERE near_account_id = $1',
        [anonUser.nearAccountId],
      );
      (req as unknown as Record<string, unknown>).userMode =
        (result.rows[0]?.app_mode as AppMode) ?? 'operational';
    } else {
      (req as unknown as Record<string, unknown>).userMode = 'operational';
    }
  } catch (error) {
    console.error('[mode-context] Error reading user mode, defaulting to operational:', error);
    (req as unknown as Record<string, unknown>).userMode = 'operational';
  }
  next();
}
