/**
 * Magic Link Store
 *
 * Phase 1.2 Plan 01: Magic link token generation and verification
 *
 * ARCHITECTURE:
 * - Email-based authentication fallback
 * - Used when PRF extension unavailable
 * - Account recovery flow
 * - Initial email verification
 *
 * SECURITY:
 * - 64-char hex tokens (32 random bytes) - cryptographically secure
 * - 15-minute expiration window
 * - One-time use enforcement
 * - Invalidate all previous tokens on new generation
 */

import { randomBytes } from 'crypto';
import { getPool } from '../lib/database.js';
import type { MagicLinkToken } from './types.js';

/**
 * Initialize magic link tokens table
 */
async function initMagicLinkTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS magic_link_tokens (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      token TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      used_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email);
    CREATE INDEX IF NOT EXISTS idx_magic_link_expires ON magic_link_tokens(expires_at);
  `);
}

/**
 * Magic Link Store
 * Singleton pattern with lazy table initialization
 */
export class MagicLinkStore {
  private initialized = false;
  private readonly EXPIRY_MINUTES = 15;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initMagicLinkTable();
      this.initialized = true;
    }
  }

  /**
   * Create magic link token
   * Invalidates all previous unused tokens for this email
   *
   * @param email - Email address to send magic link to
   * @returns Token string (64 hex chars)
   */
  async createToken(email: string): Promise<string> {
    await this.ensureInitialized();
    const pool = getPool();

    // Generate cryptographically secure random token
    const token = randomBytes(32).toString('hex'); // 64 hex chars

    // Calculate expiration
    const expiresAt = new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000);

    // Invalidate existing unused tokens for this email
    await pool.query(
      `
      UPDATE magic_link_tokens
      SET used = true
      WHERE email = $1 AND used = false
    `,
      [email]
    );

    // Store new token
    await pool.query(
      `
      INSERT INTO magic_link_tokens (token, email, expires_at)
      VALUES ($1, $2, $3)
    `,
      [token, email, expiresAt]
    );

    return token;
  }

  /**
   * Verify magic link token
   * Returns email if valid and not used, null otherwise
   * Marks token as used immediately to prevent replay
   *
   * @param token - Magic link token to verify
   * @returns Email address if valid, null if invalid/expired/used
   */
  async verifyToken(token: string): Promise<string | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT id, email, expires_at, used
      FROM magic_link_tokens
      WHERE token = $1
    `,
      [token]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    // Check if already used
    if (row.used) return null;

    // Check if expired
    if (new Date(row.expires_at) < new Date()) return null;

    // Mark as used immediately (prevent replay)
    await pool.query(
      `
      UPDATE magic_link_tokens
      SET used = true, used_at = NOW()
      WHERE id = $1
    `,
      [row.id]
    );

    return row.email;
  }

  /**
   * Get token details (for debugging)
   */
  async getToken(token: string): Promise<MagicLinkToken | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT id, token, email, expires_at, used, created_at, used_at
      FROM magic_link_tokens
      WHERE token = $1
    `,
      [token]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      token: row.token,
      email: row.email,
      expiresAt: row.expires_at,
      used: row.used,
      createdAt: row.created_at,
      usedAt: row.used_at,
    };
  }

  /**
   * Clean up expired and used tokens
   * Should be run periodically (e.g., cron job)
   */
  async cleanupExpired(): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      DELETE FROM magic_link_tokens
      WHERE expires_at < NOW() OR used = true
    `
    );

    return result.rowCount ?? 0;
  }

  /**
   * Get all tokens for email (debugging/admin)
   */
  async getTokensForEmail(email: string): Promise<MagicLinkToken[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT id, token, email, expires_at, used, created_at, used_at
      FROM magic_link_tokens
      WHERE email = $1
      ORDER BY created_at DESC
    `,
      [email]
    );

    return result.rows.map((row) => ({
      id: row.id,
      token: row.token,
      email: row.email,
      expiresAt: row.expires_at,
      used: row.used,
      createdAt: row.created_at,
      usedAt: row.used_at,
    }));
  }

  /**
   * Invalidate all tokens for email
   * Used during account deletion or security incident
   */
  async invalidateAllForEmail(email: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE magic_link_tokens
      SET used = true
      WHERE email = $1
    `,
      [email]
    );
  }

  /**
   * Check if token is valid (without marking as used)
   * Used for preview/validation before actual use
   */
  async isTokenValid(token: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT 1 FROM magic_link_tokens
      WHERE token = $1 AND used = false AND expires_at > NOW()
      LIMIT 1
    `,
      [token]
    );

    return result.rows.length > 0;
  }
}

// Singleton instance
let magicLinkStoreInstance: MagicLinkStore | null = null;

export function getMagicLinkStore(): MagicLinkStore {
  if (!magicLinkStoreInstance) {
    magicLinkStoreInstance = new MagicLinkStore();
  }
  return magicLinkStoreInstance;
}
