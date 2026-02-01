/**
 * Session Store
 *
 * Phase 1.2 Plan 01: Session management without Privy
 *
 * ARCHITECTURE:
 * - Replaces Privy JWT tokens with custom session management
 * - HttpOnly cookies for session ID (XSS protection)
 * - 7-day expiration with sliding window
 * - Tracks PRF availability for DID operations
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type { UserSession, SessionResult, AuthUser, CreateSessionInput } from './types.js';

/**
 * Initialize sessions table
 */
async function initSessionsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      account_id TEXT,
      prf_available BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_session_user ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_session_expires ON user_sessions(expires_at);
  `);
}

/**
 * Session Store
 * Singleton pattern with lazy table initialization
 */
export class SessionStore {
  private initialized = false;
  private readonly DEFAULT_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initSessionsTable();
      this.initialized = true;
    }
  }

  /**
   * Create new session
   *
   * @param input - CreateSessionInput with userId, nearAccountId, prfAvailable, etc.
   * @returns UserSession object
   */
  async createSession(input: CreateSessionInput): Promise<UserSession> {
    await this.ensureInitialized();
    const pool = getPool();

    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.DEFAULT_SESSION_DURATION_MS);

    await pool.query(
      `
      INSERT INTO user_sessions (
        id, user_id, account_id, prf_available,
        expires_at, last_activity_at, ip_address, user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
      [
        sessionId,
        input.userId,
        input.nearAccountId ?? null,
        input.prfAvailable,
        expiresAt,
        now,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ]
    );

    return {
      id: sessionId,
      userId: input.userId,
      email: input.email,
      accountId: input.nearAccountId,
      prfAvailable: input.prfAvailable,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    };
  }

  /**
   * Get session by ID
   * Returns null if session doesn't exist or is expired
   */
  async getSession(sessionId: string): Promise<UserSession | null> {
    await this.ensureInitialized();
    const pool = getPool();

    // Join with auth_users to get email for display
    const result = await pool.query(
      `
      SELECT
        s.id, s.user_id, s.account_id, s.prf_available,
        s.created_at, s.expires_at, s.last_activity_at, s.ip_address, s.user_agent,
        u.email
      FROM user_sessions s
      LEFT JOIN auth_users u ON s.user_id = u.id
      WHERE s.id = $1 AND s.expires_at > NOW()
    `,
      [sessionId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      accountId: row.account_id,
      prfAvailable: row.prf_available,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastActivityAt: row.last_activity_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    };
  }

  /**
   * Update session activity timestamp
   * Extends expiration if session is >50% through lifetime (sliding window)
   */
  async updateActivity(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    const now = new Date();

    // Get current session to check if we should extend
    const session = await this.getSession(sessionId);
    if (!session) return;

    const lifetime = session.expiresAt.getTime() - session.createdAt.getTime();
    const elapsed = now.getTime() - session.createdAt.getTime();

    // If >50% through lifetime, extend expiration
    if (elapsed > lifetime * 0.5) {
      const newExpiresAt = new Date(now.getTime() + this.DEFAULT_SESSION_DURATION_MS);

      await pool.query(
        `
        UPDATE user_sessions
        SET last_activity_at = $1, expires_at = $2
        WHERE id = $3
      `,
        [now, newExpiresAt, sessionId]
      );
    } else {
      // Just update activity timestamp
      await pool.query(
        `
        UPDATE user_sessions
        SET last_activity_at = $1
        WHERE id = $2
      `,
        [now, sessionId]
      );
    }
  }

  /**
   * Invalidate session (logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      DELETE FROM user_sessions
      WHERE id = $1
    `,
      [sessionId]
    );
  }

  /**
   * Delete all sessions for user (logout all devices)
   */
  async deleteUserSessions(userId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      DELETE FROM user_sessions
      WHERE user_id = $1
    `,
      [userId]
    );
  }

  /**
   * Clean up expired sessions
   * Should be run periodically (e.g., cron job)
   */
  async cleanupExpired(): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
    `
    );

    return result.rowCount ?? 0;
  }

  /**
   * Get all active sessions for user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT
        id, user_id, account_id, prf_available,
        created_at, expires_at, last_activity_at, ip_address, user_agent
      FROM user_sessions
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_activity_at DESC
    `,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      prfAvailable: row.prf_available,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      lastActivityAt: row.last_activity_at,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    }));
  }

  /**
   * Get session count for user
   */
  async getSessionCount(userId: string): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE user_id = $1 AND expires_at > NOW()
    `,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }
}

// Singleton instance
let sessionStoreInstance: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new SessionStore();
  }
  return sessionStoreInstance;
}
