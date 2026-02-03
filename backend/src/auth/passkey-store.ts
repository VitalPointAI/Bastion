/**
 * Passkey Store
 *
 * Phase 1.2 Plan 01: Passkey credential storage and retrieval
 *
 * CRITICAL ARCHITECTURE:
 * - Passkeys are for AUTHENTICATION ONLY
 * - Do NOT derive NEAR account IDs from passkey public keys
 * - NEAR accounts created via MPC with stable UUID-based derivation path
 * - PRF capability flag stored per credential for DID secret derivation
 */

import { getPool } from '../lib/database.js';
import type { PasskeyCredential } from './types.js';
import type { AuthenticatorTransport } from '@simplewebauthn/server';

/**
 * Initialize passkey credentials table
 */
async function initPasskeyTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS passkey_credentials (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      credential_id BYTEA UNIQUE NOT NULL,
      public_key BYTEA NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      transports JSONB NOT NULL DEFAULT '[]',
      prf_supported BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_passkey_credential_id ON passkey_credentials(credential_id);
  `);
}

/**
 * Passkey Store
 * Singleton pattern with lazy table initialization
 */
export class PasskeyStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initPasskeyTable();
      this.initialized = true;
    }
  }

  /**
   * Store new passkey credential
   * Called after successful WebAuthn registration
   *
   * @param input - CreatePasskeyInput with all credential fields
   */
  async createCredential(input: {
    userId: string;
    credentialId: Buffer;
    publicKey: Buffer;
    counter: bigint;
    transports: AuthenticatorTransport[];
    prfSupported: boolean;
  }): Promise<PasskeyCredential> {
    const { userId, credentialId, publicKey, counter, transports, prfSupported } = input;
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      INSERT INTO passkey_credentials (
        user_id, credential_id, public_key, counter, transports, prf_supported
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `,
      [userId, credentialId, publicKey, counter, JSON.stringify(transports), prfSupported]
    );

    const row = result.rows[0];

    return {
      id: row.id,
      userId,
      credentialId,
      publicKey,
      counter,
      transports,
      prfSupported,
      createdAt: row.created_at,
    };
  }

  /**
   * Get credential by credential ID
   * Used during authentication to verify signature
   *
   * CRITICAL: Compare credential_id as hex for compatibility with all databases
   */
  async findByCredentialId(credentialId: Buffer): Promise<PasskeyCredential | null> {
    return this.getCredentialById(credentialId);
  }

  async getCredentialById(credentialId: Buffer): Promise<PasskeyCredential | null> {
    await this.ensureInitialized();
    const pool = getPool();

    // Convert to hex for comparison (PostgreSQL-compatible)
    const credIdHex = credentialId.toString('hex');

    // First try: match raw bytes directly
    let result = await pool.query(
      `
      SELECT
        id, user_id, credential_id, public_key, counter,
        transports, prf_supported, created_at, last_used_at
      FROM passkey_credentials
      WHERE encode(credential_id, 'hex') = $1
    `,
      [credIdHex]
    );

    // Fallback: old credentials may have base64url string stored as ASCII bytes
    // Convert raw bytes to base64url and check if that string (as bytes) matches
    if (result.rows.length === 0) {
      // Import isoBase64URL for encoding
      const { isoBase64URL } = await import('@simplewebauthn/server/helpers');
      const base64urlStr = isoBase64URL.fromBuffer(new Uint8Array(credentialId));
      const base64urlAsHex = Buffer.from(base64urlStr, 'utf-8').toString('hex');

      result = await pool.query(
        `
        SELECT
          id, user_id, credential_id, public_key, counter,
          transports, prf_supported, created_at, last_used_at
        FROM passkey_credentials
        WHERE encode(credential_id, 'hex') = $1
      `,
        [base64urlAsHex]
      );
    }

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      credentialId: Buffer.from(row.credential_id),
      publicKey: Buffer.from(row.public_key),
      counter: BigInt(row.counter),
      transports: row.transports,  // JSONB already parsed by pg driver
      prfSupported: row.prf_supported,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }

  /**
   * Get all credentials for a user
   * Used for credential exclusion during registration
   */
  async findByUserId(userId: string): Promise<PasskeyCredential[]> {
    return this.getUserCredentials(userId);
  }

  async getUserCredentials(userId: string): Promise<PasskeyCredential[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT
        id, user_id, credential_id, public_key, counter,
        transports, prf_supported, created_at, last_used_at
      FROM passkey_credentials
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      credentialId: Buffer.from(row.credential_id),
      publicKey: Buffer.from(row.public_key),
      counter: BigInt(row.counter),
      transports: row.transports,  // JSONB already parsed by pg driver
      prfSupported: row.prf_supported,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }));
  }

  /**
   * Update signature counter after authentication
   * Critical for replay attack prevention
   */
  async updateCounter(id: string, newCounter: bigint): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE passkey_credentials
      SET counter = $1
      WHERE id = $2
    `,
      [newCounter.toString(), id]
    );
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE passkey_credentials
      SET last_used_at = NOW()
      WHERE id = $1
    `,
      [id]
    );
  }

  /**
   * Delete credential (user removing a passkey)
   */
  async deleteCredential(credentialId: Buffer): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    const credIdHex = credentialId.toString('hex');

    await pool.query(
      `
      DELETE FROM passkey_credentials
      WHERE encode(credential_id, 'hex') = $1
    `,
      [credIdHex]
    );
  }

  /**
   * Delete all credentials for a user
   * Used during account recovery when user lost all passkeys
   */
  async deleteAllForUser(userId: string): Promise<void> {
    return this.deleteUserCredentials(userId);
  }

  async deleteUserCredentials(userId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      DELETE FROM passkey_credentials
      WHERE user_id = $1
    `,
      [userId]
    );
  }

  /**
   * Check if user has any PRF-capable credentials
   * Determines if DID operations are available
   */
  async hasPrfCapableCredential(userId: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT 1 FROM passkey_credentials
      WHERE user_id = $1 AND prf_supported = true
      LIMIT 1
    `,
      [userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get credential count for user
   * Used to enforce minimum credential requirement
   */
  async getCredentialCount(userId: string): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM passkey_credentials
      WHERE user_id = $1
    `,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }
}

// Singleton instance
let passkeyStoreInstance: PasskeyStore | null = null;

export function getPasskeyStore(): PasskeyStore {
  if (!passkeyStoreInstance) {
    passkeyStoreInstance = new PasskeyStore();
  }
  return passkeyStoreInstance;
}
