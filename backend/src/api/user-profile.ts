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
import { issueUserProfile } from '../credentials/credential-service.js';
import { deriveUserSecretFromAccount } from '../near/user-secret.js';
import { anchorCredentialOnChain } from '../near/tx-signer.js';
import { utf8ToBytes, hexToBytes } from '@noble/hashes/utils.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from 'node:crypto';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

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
      profile_credential JSONB,
      credential_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Add credential columns if table already existed without them
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_credential JSONB;
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS credential_hash TEXT;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);
  // Phase 22: Add app_mode column for training/operational global mode
  await pool.query(`
    ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS app_mode TEXT NOT NULL DEFAULT 'operational';
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
 * Returns { displayName, orgEmail, credential?, credentialHash? } or 404.
 *
 * The credential is the canonical W3C VerifiableCredential record.
 * displayName/orgEmail are convenience fields derived from the credential.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const nearAccountId = (req as unknown as { anonUser: { nearAccountId: string } }).anonUser.nearAccountId;
    const pool = getPool();

    const result = await pool.query(
      'SELECT display_name, org_email, profile_credential, credential_hash FROM user_profiles WHERE near_account_id = $1',
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
      credential: row.profile_credential || null,
      credentialHash: row.credential_hash || null,
    });
  } catch (error) {
    console.error('[user-profile] GET error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

/**
 * POST / — Create or update user profile (upsert).
 * Body: { displayName: string, orgEmail?: string }
 *
 * Issues a W3C UserProfileCredential (self-issued by user's DID) and stores
 * both the credential and flat fields. The credential is the canonical record;
 * flat columns are a convenience cache. Credential hash is ready for on-chain
 * anchoring via the CredentialRegistry contract.
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

    const trimmedName = displayName.trim();
    const trimmedEmail = orgEmail?.trim() || null;

    // Build the user's DID
    const userDid = `did:near:${nearAccountId}`;

    // Issue a UserProfileCredential — self-issued (user attests to own profile)
    const { credential, credentialHash } = await issueUserProfile(userDid, {
      id: userDid,
      displayName: trimmedName,
      ...(trimmedEmail ? { orgEmail: trimmedEmail } : {}),
    });

    const pool = getPool();

    await pool.query(
      `INSERT INTO user_profiles (near_account_id, display_name, org_email, profile_credential, credential_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (near_account_id)
       DO UPDATE SET display_name = $2, org_email = $3, profile_credential = $4, credential_hash = $5, updated_at = NOW()`,
      [nearAccountId, trimmedName, trimmedEmail, JSON.stringify(credential), credentialHash]
    );

    // Anchor credential on-chain (non-blocking — don't fail the profile save if anchoring fails)
    // The credential hash is the canonical commitment; on-chain anchor provides tamper evidence.
    let anchorTxHash: string | undefined;
    try {
      const userSecret = deriveUserSecretFromAccount(nearAccountId);
      const credentialHashBytes = hexToBytes(credentialHash);

      // Encrypt credential metadata (type + issuer + subject DID) for on-chain storage
      const metadata = JSON.stringify({
        type: 'UserProfileCredential',
        issuer: userDid,
        subject: userDid,
      });
      const metadataBytes = utf8ToBytes(metadata);
      const encNonce = randomBytes(24);
      const encKey = hkdf(sha256, userSecret, utf8ToBytes('credential-encryption'), utf8ToBytes('metadata'), 32);
      const cipher = chacha20poly1305(encKey, encNonce);
      const encryptedMetadata = cipher.encrypt(metadataBytes);

      const result = await anchorCredentialOnChain(
        userSecret,
        credentialHashBytes,
        encryptedMetadata,
        encNonce,
      );

      if (result.success) {
        anchorTxHash = result.txHash;
        console.log(`[user-profile] Credential anchored on-chain (tx: ${anchorTxHash})`);
      } else {
        console.warn(`[user-profile] On-chain anchoring failed (will retry): ${result.error}`);
      }
    } catch (anchorError) {
      console.warn('[user-profile] On-chain anchoring error (non-fatal):', anchorError);
    }

    res.json({
      displayName: trimmedName,
      orgEmail: trimmedEmail,
      credential,
      credentialHash,
      anchorTxHash: anchorTxHash || null,
    });
  } catch (error) {
    console.error('[user-profile] POST error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

export default router;
