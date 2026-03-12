/**
 * Bridge Token Store
 *
 * Phase 43 Plan 02: DB-backed one-time token store for bridge registration.
 * Tokens are single-use, expire after 15 minutes, and are persisted in
 * the bridge_tokens table with full audit trail (used_at, used_by).
 *
 * Pattern follows robot-store.ts: getPool() for DB access, auto-creates
 * table on first use, exported as singleton bridgeTokenStore.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ---------------------------------------------------------------------------
// Table initialization
// ---------------------------------------------------------------------------

let tablesInitialized = false;

async function ensureBridgeTokensTable(): Promise<void> {
  if (tablesInitialized) return;

  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bridge_tokens (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      used_by TEXT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bridge_tokens_token
      ON bridge_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_bridge_tokens_expires
      ON bridge_tokens(expires_at);
  `);

  tablesInitialized = true;
}

// ---------------------------------------------------------------------------
// Token store class
// ---------------------------------------------------------------------------

class BridgeTokenStore {
  /**
   * Generate a new one-time registration token.
   * @param expiresInMin Minutes until the token expires (default: 15)
   * @returns The generated token string
   */
  async create(expiresInMin = 15): Promise<string> {
    await ensureBridgeTokensTable();

    const pool = getPool();
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + expiresInMin * 60 * 1000);

    await pool.query(
      `INSERT INTO bridge_tokens (token, expires_at) VALUES ($1, $2)`,
      [token, expiresAt],
    );

    return token;
  }

  /**
   * Consume a token — mark it as used and validate it.
   * Single-use: once consumed, the token cannot be used again.
   *
   * @param token The token to consume
   * @returns { valid: true } if token was valid and unused; { valid: false } otherwise
   */
  async consume(token: string): Promise<{ valid: boolean; bridge_id?: string }> {
    await ensureBridgeTokensTable();

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT id FROM bridge_tokens
         WHERE token = $1
           AND used_at IS NULL
           AND expires_at > NOW()
         FOR UPDATE`,
        [token],
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { valid: false };
      }

      await client.query(
        `UPDATE bridge_tokens SET used_at = NOW() WHERE token = $1`,
        [token],
      );

      await client.query('COMMIT');
      return { valid: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired tokens older than 1 hour past their expiry.
   * Called periodically to prevent unbounded table growth.
   */
  async cleanup(): Promise<void> {
    await ensureBridgeTokensTable();

    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM bridge_tokens WHERE expires_at < NOW() - INTERVAL '1 hour'`,
    );

    if (result.rowCount && result.rowCount > 0) {
      console.log(`[BridgeTokenStore] Cleaned up ${result.rowCount} expired token(s)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const bridgeTokenStore = new BridgeTokenStore();
