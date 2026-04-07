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
      used_by TEXT NULL,
      label TEXT NULL,
      device_type TEXT NULL DEFAULT 'bridge',
      classification TEXT NULL DEFAULT 'UNCLASSIFIED',
      authority_level TEXT NULL DEFAULT 'observer',
      capabilities TEXT[] NULL DEFAULT '{}',
      metadata JSONB NULL DEFAULT '{}'
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

/** Properties embedded in a registration token — applied to the device on first connect */
export interface TokenDeviceProperties {
  label?: string;
  deviceType?: 'bridge' | 'drone' | 'ugv' | 'sensor' | 'relay';
  classification?: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET' | 'TS_SCI';
  authorityLevel?: 'observer' | 'operator' | 'autonomous' | 'command';
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

class BridgeTokenStore {
  /**
   * Generate a new one-time registration token with optional device properties.
   * Properties are stored with the token and returned when consumed, so the
   * registering handler can apply them to the resource DID.
   *
   * @param expiresInMin Minutes until the token expires (default: 15)
   * @param props Optional device properties to embed in the token
   * @returns The generated token string
   */
  async create(expiresInMin = 15, props?: TokenDeviceProperties): Promise<string> {
    await ensureBridgeTokensTable();

    const pool = getPool();
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + expiresInMin * 60 * 1000);

    await pool.query(
      `INSERT INTO bridge_tokens (token, expires_at, label, device_type, classification, authority_level, capabilities, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        token,
        expiresAt,
        props?.label ?? null,
        props?.deviceType ?? 'bridge',
        props?.classification ?? 'UNCLASSIFIED',
        props?.authorityLevel ?? 'observer',
        props?.capabilities ?? [],
        JSON.stringify(props?.metadata ?? {}),
      ],
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
  async consume(token: string): Promise<{ valid: boolean; bridge_id?: string; props?: TokenDeviceProperties }> {
    await ensureBridgeTokensTable();

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT id, label, device_type, classification, authority_level, capabilities, metadata
         FROM bridge_tokens
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

      const row = result.rows[0];
      return {
        valid: true,
        props: {
          label: row.label,
          deviceType: row.device_type,
          classification: row.classification,
          authorityLevel: row.authority_level,
          capabilities: row.capabilities ?? [],
          metadata: row.metadata ?? {},
        },
      };
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
