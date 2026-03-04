/**
 * User Profile API
 *
 * CRUD for user display name + org email, linked by near_account_id.
 * Public email validation endpoint for pre-registration checks.
 */

import { Router, type Request, type Response } from 'express';
import { getPool } from '../lib/database.js';
import { requireAuth } from '../auth/auth-instance.js';
import { getPlatformSettingsStore } from '../auth/platform-settings-store.js';

const router = Router();

// ============================================================================
// Table initialization (idempotent — same pattern as platform-settings-store)
// ============================================================================

let tableInitialized = false;

async function ensureTable(): Promise<void> {
  if (tableInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      near_account_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      org_email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  tableInitialized = true;
}

// ============================================================================
// Public Endpoints (no auth required)
// ============================================================================

/**
 * POST /validate-email — Check if an email is allowed for registration.
 * Checks domain whitelist + email blacklist.
 * Returns { allowed: boolean, reason?: string }
 */
router.post('/validate-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    // Basic email format check
    if (!emailLower.includes('@') || emailLower.length < 3) {
      res.status(400).json({ allowed: false, reason: 'Invalid email format' });
      return;
    }

    const settings = getPlatformSettingsStore();

    // Check domain whitelist
    const domainAllowed = await settings.isEmailDomainAllowed(emailLower);
    if (!domainAllowed) {
      res.json({ allowed: false, reason: 'This email domain is not permitted for registration' });
      return;
    }

    // Check email blacklist
    const emailBlocked = await settings.isEmailBlocked(emailLower);
    if (emailBlocked) {
      res.json({ allowed: false, reason: 'This email address is not permitted for registration' });
      return;
    }

    res.json({ allowed: true });
  } catch (error) {
    console.error('[user-profile] validate-email error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

/**
 * GET /registration-requirements — Check if email is required for registration.
 * Returns { emailRequired: boolean }
 */
router.get('/registration-requirements', async (_req: Request, res: Response) => {
  try {
    const settings = getPlatformSettingsStore();
    const domains = await settings.getAllowedEmailDomains();
    res.json({ emailRequired: domains.length > 0 });
  } catch (error) {
    console.error('[user-profile] registration-requirements error:', error);
    res.status(500).json({ error: 'Failed to check requirements' });
  }
});

// ============================================================================
// Authenticated Endpoints
// ============================================================================

/**
 * GET / — Get current user's profile.
 * Returns { displayName, orgEmail } or 404.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const nearAccountId = (req as unknown as { anonUser: { nearAccountId: string } }).anonUser.nearAccountId;
    const pool = getPool();

    const result = await pool.query(
      'SELECT display_name, org_email FROM user_profiles WHERE near_account_id = $1',
      [nearAccountId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      displayName: row.display_name,
      orgEmail: row.org_email,
    });
  } catch (error) {
    console.error('[user-profile] GET error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/**
 * POST / — Create or update user profile (upsert).
 * Body: { displayName: string, orgEmail?: string }
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const nearAccountId = (req as unknown as { anonUser: { nearAccountId: string } }).anonUser.nearAccountId;
    const { displayName, orgEmail } = req.body;

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      res.status(400).json({ error: 'displayName is required' });
      return;
    }

    const pool = getPool();

    await pool.query(
      `INSERT INTO user_profiles (near_account_id, display_name, org_email, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (near_account_id)
       DO UPDATE SET display_name = $2, org_email = $3, updated_at = NOW()`,
      [nearAccountId, displayName.trim(), orgEmail?.trim() || null]
    );

    res.json({
      displayName: displayName.trim(),
      orgEmail: orgEmail?.trim() || null,
    });
  } catch (error) {
    console.error('[user-profile] POST error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

export default router;
