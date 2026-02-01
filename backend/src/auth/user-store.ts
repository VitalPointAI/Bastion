/**
 * User Store
 *
 * Phase 1.2 Plan 01: User management with UUID as stable identifier
 *
 * CRITICAL ARCHITECTURE:
 * - User UUID is the stable anchor for MPC derivation path
 * - UUID never changes (email can change, passkeys can change)
 * - MPC derivation path format: bastion,{uuid}
 * - NEAR account signing keys derived via Chain Signatures MPC
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { AuthUser, RegistrationInput } from './types.js';

/**
 * Initialize users table with UUID as primary key
 */
async function initUsersTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      alternate_email TEXT,
      near_account_id TEXT,
      mpc_derivation_path TEXT NOT NULL,
      totp_enabled BOOLEAN NOT NULL DEFAULT false,
      passkey_registered BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
    CREATE INDEX IF NOT EXISTS idx_auth_users_alternate_email ON auth_users(alternate_email);
    CREATE INDEX IF NOT EXISTS idx_auth_users_near_account ON auth_users(near_account_id);
  `);
}

/**
 * User Store
 * Singleton pattern with lazy table initialization
 */
export class UserStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initUsersTable();
      this.initialized = true;
    }
  }

  /**
   * Create new user with stable UUID
   * UUID serves as anchor for MPC derivation path
   *
   * @param email - User email address
   * @param alternateEmail - Optional alternate email for recovery
   * @returns Created user with UUID and MPC path
   */
  async createUser(email: string, alternateEmail?: string): Promise<AuthUser> {
    await this.ensureInitialized();
    const pool = getPool();

    // Generate stable UUID - this NEVER changes
    const userId = randomUUID();

    // MPC derivation path based on UUID
    const mpcDerivationPath = `bastion,${userId}`;

    const now = new Date();

    await pool.query(
      `
      INSERT INTO auth_users (
        id, email, alternate_email, mpc_derivation_path,
        totp_enabled, passkey_registered, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        userId,
        email,
        alternateEmail ?? null,
        mpcDerivationPath,
        false, // TOTP not enabled yet
        false, // Passkey not registered yet
        now,
        now,
      ]
    );

    return {
      id: userId,
      email,
      alternateEmail,
      mpcDerivationPath,
      totpEnabled: false,
      passkeyRegistered: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get user by ID (UUID)
   */
  async findById(userId: string): Promise<AuthUser | null> {
    return this.getUserById(userId);
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT
        id, email, alternate_email, near_account_id, mpc_derivation_path,
        totp_enabled, passkey_registered, created_at, updated_at
      FROM auth_users
      WHERE id = $1
    `,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      alternateEmail: row.alternate_email,
      nearAccountId: row.near_account_id,
      mpcDerivationPath: row.mpc_derivation_path,
      totpEnabled: row.totp_enabled,
      passkeyRegistered: row.passkey_registered,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get user by email (primary or alternate)
   * Used during login and recovery
   */
  async findByEmail(email: string): Promise<AuthUser | null> {
    return this.getUserByEmail(email);
  }

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT
        id, email, alternate_email, near_account_id, mpc_derivation_path,
        totp_enabled, passkey_registered, created_at, updated_at
      FROM auth_users
      WHERE email = $1 OR alternate_email = $1
    `,
      [email]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      alternateEmail: row.alternate_email,
      nearAccountId: row.near_account_id,
      mpcDerivationPath: row.mpc_derivation_path,
      totpEnabled: row.totp_enabled,
      passkeyRegistered: row.passkey_registered,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get user by NEAR account ID
   */
  async getUserByNearAccount(nearAccountId: string): Promise<AuthUser | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT
        id, email, alternate_email, near_account_id, mpc_derivation_path,
        totp_enabled, passkey_registered, created_at, updated_at
      FROM auth_users
      WHERE near_account_id = $1
    `,
      [nearAccountId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      alternateEmail: row.alternate_email,
      nearAccountId: row.near_account_id,
      mpcDerivationPath: row.mpc_derivation_path,
      totpEnabled: row.totp_enabled,
      passkeyRegistered: row.passkey_registered,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update NEAR account ID after MPC account creation
   * Called after backend creates NEAR account via Chain Signatures
   */
  async updateNearAccountId(userId: string, nearAccountId: string): Promise<void> {
    return this.setNearAccountId(userId, nearAccountId);
  }

  async setNearAccountId(userId: string, nearAccountId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE auth_users
      SET near_account_id = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [nearAccountId, userId]
    );
  }

  /**
   * Update MPC derivation path (should rarely be needed as UUID is stable)
   */
  async updateMPCDerivationPath(userId: string, derivationPath: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE auth_users
      SET mpc_derivation_path = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [derivationPath, userId]
    );
  }

  /**
   * Mark passkey as registered
   * Called after first passkey credential stored
   */
  async setPasskeyRegistered(userId: string, registered: boolean): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE auth_users
      SET passkey_registered = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [registered, userId]
    );
  }

  /**
   * Mark TOTP as enabled
   * Called after TOTP secret stored and verified
   */
  async setTotpEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE auth_users
      SET totp_enabled = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [enabled, userId]
    );
  }

  /**
   * Update email address
   * Note: UUID and MPC derivation path remain unchanged
   */
  async updateEmail(userId: string, email: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE auth_users
      SET email = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [email, userId]
    );
  }

  /**
   * Update alternate email
   */
  async updateAlternateEmail(
    userId: string,
    alternateEmail: string | null
  ): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE auth_users
      SET alternate_email = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [alternateEmail, userId]
    );
  }

  /**
   * Check if email is already registered
   */
  async emailExists(email: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT 1 FROM auth_users
      WHERE email = $1 OR alternate_email = $1
      LIMIT 1
    `,
      [email]
    );

    return result.rows.length > 0;
  }
}

// Singleton instance
let userStoreInstance: UserStore | null = null;

export function getUserStore(): UserStore {
  if (!userStoreInstance) {
    userStoreInstance = new UserStore();
  }
  return userStoreInstance;
}
