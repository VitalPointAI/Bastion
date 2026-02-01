/**
 * TOTP Store
 *
 * Phase 1.2 Plan 01: TOTP secret management with encryption
 *
 * CRITICAL SECURITY:
 * - TOTP secrets encrypted at rest using AES-256-GCM
 * - Encryption key from environment variable (TOTP_ENCRYPTION_KEY)
 * - 12-byte nonce for GCM (unique per secret)
 * - Backup codes for emergency recovery
 */

import { randomBytes } from 'crypto';
import { gcm } from '@noble/ciphers/aes';
import { utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';
import { authenticator } from 'otplib';
import { getPool } from '../lib/database.js';
import type { TotpCredential } from './types.js';

/**
 * Get encryption key from environment
 * Key should be 32 bytes (64 hex chars) for AES-256
 */
function getEncryptionKey(): Uint8Array {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TOTP_ENCRYPTION_KEY environment variable not set');
  }
  if (key.length !== 64) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt TOTP secret using AES-256-GCM
 */
function encryptSecret(secret: string): { encrypted: Buffer; nonce: Buffer } {
  const key = getEncryptionKey();
  const nonce = randomBytes(12); // 12-byte nonce for GCM

  const cipher = gcm(key, nonce);
  const plaintext = utf8ToBytes(secret);
  const encrypted = cipher.encrypt(plaintext);

  return {
    encrypted: Buffer.from(encrypted),
    nonce: Buffer.from(nonce),
  };
}

/**
 * Decrypt TOTP secret using AES-256-GCM
 */
function decryptSecret(encrypted: Buffer, nonce: Buffer): string {
  const key = getEncryptionKey();

  const cipher = gcm(key, new Uint8Array(nonce));
  const decrypted = cipher.decrypt(new Uint8Array(encrypted));

  return bytesToUtf8(decrypted);
}

/**
 * Generate random backup codes
 * Format: XXXX-XXXX-XXXX (12 chars, 3 groups of 4)
 */
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(6); // 6 bytes = 48 bits
    const hex = bytes.toString('hex').toUpperCase();
    const formatted = `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
    codes.push(formatted);
  }
  return codes;
}

/**
 * Initialize TOTP credentials table
 */
async function initTotpTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS totp_credentials (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      user_id TEXT UNIQUE NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      secret_encrypted BYTEA NOT NULL,
      encryption_nonce BYTEA NOT NULL,
      backup_codes JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_totp_user ON totp_credentials(user_id);
  `);
}

/**
 * TOTP Store
 * Singleton pattern with lazy table initialization
 */
export class TotpStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initTotpTable();
      this.initialized = true;
    }
  }

  /**
   * Create TOTP credential for user
   * Generates new secret, encrypts it, and generates backup codes
   *
   * @returns Object with secret (for QR code) and backup codes (to show user once)
   */
  async createCredential(userId: string): Promise<{
    secret: string;
    backupCodes: string[];
  }> {
    await this.ensureInitialized();
    const pool = getPool();

    // Generate TOTP secret (base32 encoded)
    const secret = authenticator.generateSecret();

    // Encrypt secret
    const { encrypted, nonce } = encryptSecret(secret);

    // Generate backup codes
    const backupCodes = generateBackupCodes(8);

    // Encrypt backup codes as JSON
    const backupCodesJson = JSON.stringify(backupCodes);
    const { encrypted: backupCodesEncrypted } = encryptSecret(backupCodesJson);

    await pool.query(
      `
      INSERT INTO totp_credentials (
        user_id, secret_encrypted, encryption_nonce, backup_codes
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE
      SET secret_encrypted = EXCLUDED.secret_encrypted,
          encryption_nonce = EXCLUDED.encryption_nonce,
          backup_codes = EXCLUDED.backup_codes
    `,
      [userId, encrypted, nonce, JSON.stringify([backupCodesEncrypted.toString('hex')])]
    );

    return { secret, backupCodes };
  }

  /**
   * Verify TOTP code for user
   *
   * @param userId - User UUID
   * @param token - 6-digit TOTP code from authenticator app
   * @returns true if valid, false otherwise
   */
  async verifyToken(userId: string, token: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT secret_encrypted, encryption_nonce
      FROM totp_credentials
      WHERE user_id = $1
    `,
      [userId]
    );

    if (result.rows.length === 0) {
      return false; // No TOTP credential
    }

    const row = result.rows[0];
    const secret = decryptSecret(
      Buffer.from(row.secret_encrypted),
      Buffer.from(row.encryption_nonce)
    );

    // Verify token with 30-second window
    const isValid = authenticator.verify({ token, secret });

    if (isValid) {
      // Update last_used_at
      await pool.query(
        `
        UPDATE totp_credentials
        SET last_used_at = NOW()
        WHERE user_id = $1
      `,
        [userId]
      );
    }

    return isValid;
  }

  /**
   * Verify backup code
   * Backup codes are one-time use and removed after verification
   *
   * @param userId - User UUID
   * @param code - Backup code (format: XXXX-XXXX-XXXX)
   * @returns true if valid and not used, false otherwise
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT backup_codes, encryption_nonce
      FROM totp_credentials
      WHERE user_id = $1
    `,
      [userId]
    );

    if (result.rows.length === 0) {
      return false; // No TOTP credential
    }

    const row = result.rows[0];
    const backupCodesEncryptedList: string[] = JSON.parse(row.backup_codes);

    if (backupCodesEncryptedList.length === 0) {
      return false; // No backup codes available
    }

    // Decrypt backup codes
    const backupCodesEncrypted = Buffer.from(backupCodesEncryptedList[0], 'hex');
    const backupCodesJson = decryptSecret(
      backupCodesEncrypted,
      Buffer.from(row.encryption_nonce)
    );
    const backupCodes: string[] = JSON.parse(backupCodesJson);

    // Check if code exists
    const codeIndex = backupCodes.indexOf(code.toUpperCase());
    if (codeIndex === -1) {
      return false; // Code not found or already used
    }

    // Remove used code
    backupCodes.splice(codeIndex, 1);

    // Re-encrypt remaining codes
    const newBackupCodesJson = JSON.stringify(backupCodes);
    const { encrypted: newBackupCodesEncrypted } = encryptSecret(newBackupCodesJson);

    // Update database
    await pool.query(
      `
      UPDATE totp_credentials
      SET backup_codes = $1, last_used_at = NOW()
      WHERE user_id = $2
    `,
      [JSON.stringify([newBackupCodesEncrypted.toString('hex')]), userId]
    );

    return true;
  }

  /**
   * Get TOTP credential for user
   * Returns decrypted secret (use with caution - only for migration)
   */
  async getCredential(userId: string): Promise<TotpCredential | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT id, user_id, secret_encrypted, encryption_nonce, backup_codes, created_at, last_used_at
      FROM totp_credentials
      WHERE user_id = $1
    `,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    // Decrypt backup codes for return
    const backupCodesEncryptedList: string[] = JSON.parse(row.backup_codes);
    let backupCodes: string[] = [];
    if (backupCodesEncryptedList.length > 0) {
      const backupCodesEncrypted = Buffer.from(backupCodesEncryptedList[0], 'hex');
      const backupCodesJson = decryptSecret(
        backupCodesEncrypted,
        Buffer.from(row.encryption_nonce)
      );
      backupCodes = JSON.parse(backupCodesJson);
    }

    return {
      id: row.id,
      userId: row.user_id,
      secretEncrypted: Buffer.from(row.secret_encrypted),
      encryptionNonce: Buffer.from(row.encryption_nonce),
      backupCodes,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    };
  }

  /**
   * Delete TOTP credential for user
   */
  async deleteCredential(userId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      DELETE FROM totp_credentials
      WHERE user_id = $1
    `,
      [userId]
    );
  }

  /**
   * Check if user has TOTP enabled
   */
  async hasCredential(userId: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT 1 FROM totp_credentials
      WHERE user_id = $1
      LIMIT 1
    `,
      [userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get remaining backup code count
   */
  async getBackupCodeCount(userId: string): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT backup_codes, encryption_nonce
      FROM totp_credentials
      WHERE user_id = $1
    `,
      [userId]
    );

    if (result.rows.length === 0) return 0;

    const row = result.rows[0];
    const backupCodesEncryptedList: string[] = JSON.parse(row.backup_codes);

    if (backupCodesEncryptedList.length === 0) return 0;

    const backupCodesEncrypted = Buffer.from(backupCodesEncryptedList[0], 'hex');
    const backupCodesJson = decryptSecret(
      backupCodesEncrypted,
      Buffer.from(row.encryption_nonce)
    );
    const backupCodes: string[] = JSON.parse(backupCodesJson);

    return backupCodes.length;
  }
}

// Singleton instance
let totpStoreInstance: TotpStore | null = null;

export function getTotpStore(): TotpStore {
  if (!totpStoreInstance) {
    totpStoreInstance = new TotpStore();
  }
  return totpStoreInstance;
}

// Export utilities for testing and external use
export { generateBackupCodes, encryptSecret, decryptSecret };
