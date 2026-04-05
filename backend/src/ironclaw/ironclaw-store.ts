/**
 * Ironclaw PostgreSQL Store
 *
 * Phase 30 Plan 01: CRUD operations for sessions, chat messages, trust
 * preferences, action log, and audit anchors. Uses getPool() pattern
 * consistent with ai-staff-store.ts and other stores in the project.
 */

import { getPool } from '../lib/database.js';
import { conceptStore } from './concept-store.js';
import { sidecarSyncService } from './sidecar-sync.js';
import type {
  IronclawChatMessage,
  IronclawSession,
  TrustPreference,
  ActionLogEntry,
  AuditAnchor,
  ActionCardData,
  StepProgressData,
  SuggestionPayload,
} from './ironclaw-types.js';
import { TRUST_TTL_DAYS } from './ironclaw-types.js';
import type { ActionRiskLevel } from './ironclaw-types.js';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToSession(row: Record<string, unknown>): IronclawSession {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    user_did: row.user_did as string,
    ironclaw_session_id: (row.ironclaw_session_id as string) ?? null,
    created_at: (row.created_at as Date).toISOString(),
    last_active_at: (row.last_active_at as Date).toISOString(),
  };
}

function rowToChatMessage(row: Record<string, unknown>): IronclawChatMessage {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    content: row.content as string,
    sender: row.sender as IronclawChatMessage['sender'],
    specialist_id: (row.specialist_id as string) ?? null,
    specialist_display_name: (row.specialist_display_name as string) ?? null,
    delegated_by: (row.delegated_by as string) ?? null,
    action_card: (row.action_card as ActionCardData) ?? null,
    step_progress: (row.step_progress as StepProgressData) ?? null,
    suggestion: (row.suggestion as SuggestionPayload) ?? null,
    thread_id: (row.thread_id as string) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function rowToTrustPreference(row: Record<string, unknown>): TrustPreference {
  return {
    id: row.id as string,
    user_did: row.user_did as string,
    problem_set_id: row.problem_set_id as string,
    action_type: row.action_type as string,
    granted_at: (row.granted_at as Date).toISOString(),
    expires_at: (row.expires_at as Date).toISOString(),
  };
}

function rowToActionLogEntry(row: Record<string, unknown>): ActionLogEntry {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    user_did: row.user_did as string,
    action_type: row.action_type as string,
    action_payload: row.action_payload as Record<string, unknown>,
    risk_level: row.risk_level as ActionRiskLevel,
    decision: row.decision as ActionLogEntry['decision'],
    gate_id: (row.gate_id as string) ?? null,
    result: (row.result as Record<string, unknown>) ?? null,
    error: (row.error as string) ?? null,
    emergency: row.emergency as boolean,
    justification: (row.justification as string) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function rowToAuditAnchor(row: Record<string, unknown>): AuditAnchor {
  return {
    id: row.id as string,
    batch_start: (row.batch_start as Date).toISOString(),
    batch_end: (row.batch_end as Date).toISOString(),
    action_count: row.action_count as number,
    merkle_root: row.merkle_root as string,
    tx_hash: (row.tx_hash as string) ?? null,
    anchored_at: row.anchored_at ? (row.anchored_at as Date).toISOString() : null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// IronclawStore
// ---------------------------------------------------------------------------

export class IronclawStore {
  /**
   * Ensure all Ironclaw tables and indexes exist (idempotent).
   * Safe to call multiple times at startup.
   */
  async ensureTable(): Promise<void> {
    const pool = getPool();

    // Sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        user_did TEXT NOT NULL,
        ironclaw_session_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (problem_set_id, user_did)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_sessions_ps_user
        ON ironclaw_sessions (problem_set_id, user_did)
    `);

    // Chat messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_chat (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        content TEXT NOT NULL,
        sender TEXT NOT NULL DEFAULT 'user',
        specialist_id TEXT,
        specialist_display_name TEXT,
        delegated_by TEXT,
        action_card JSONB,
        step_progress JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_chat_problem_set
        ON ironclaw_chat (problem_set_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_chat_ps_created
        ON ironclaw_chat (problem_set_id, created_at)
    `);

    // Threads table — allows users to compartmentalize conversations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        user_did TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'General',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_threads_ps_user
        ON ironclaw_threads (problem_set_id, user_did)
    `);

    // Add thread_id column to chat messages (nullable for backward compat)
    await pool.query(`
      ALTER TABLE ironclaw_chat ADD COLUMN IF NOT EXISTS thread_id UUID
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_chat_thread
        ON ironclaw_chat (thread_id)
    `);

    // Add suggestion column if missing
    await pool.query(`
      ALTER TABLE ironclaw_chat ADD COLUMN IF NOT EXISTS suggestion JSONB
    `);

    // Trust preferences table (with TTL expiration)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_trust_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_did TEXT NOT NULL,
        problem_set_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
        UNIQUE (user_did, problem_set_id, action_type)
      )
    `);

    // Add expires_at column if table already exists without it (migration)
    await pool.query(`
      ALTER TABLE ironclaw_trust_preferences
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
    `);

    // Action log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_action_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        user_did TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_payload JSONB NOT NULL,
        risk_level TEXT NOT NULL DEFAULT 'medium',
        decision TEXT NOT NULL,
        gate_id UUID,
        result JSONB,
        error TEXT,
        emergency BOOLEAN NOT NULL DEFAULT FALSE,
        justification TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_action_log_problem_set
        ON ironclaw_action_log (problem_set_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_action_log_user
        ON ironclaw_action_log (user_did)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ironclaw_action_log_created
        ON ironclaw_action_log (created_at)
    `);

    // Audit anchors table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_audit_anchors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_start TIMESTAMPTZ NOT NULL,
        batch_end TIMESTAMPTZ NOT NULL,
        action_count INTEGER NOT NULL,
        merkle_root TEXT NOT NULL,
        tx_hash TEXT,
        anchored_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  // =========================================================================
  // Session CRUD
  // =========================================================================

  async getOrCreateSession(problemSetId: string, userDid: string): Promise<IronclawSession> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_sessions (problem_set_id, user_did)
       VALUES ($1, $2)
       ON CONFLICT (problem_set_id, user_did)
       DO UPDATE SET last_active_at = NOW()
       RETURNING *`,
      [problemSetId, userDid],
    );
    return rowToSession(result.rows[0]);
  }

  async getSession(problemSetId: string, userDid: string): Promise<IronclawSession | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM ironclaw_sessions WHERE problem_set_id = $1 AND user_did = $2',
      [problemSetId, userDid],
    );
    return result.rows.length > 0 ? rowToSession(result.rows[0]) : null;
  }

  // =========================================================================
  // Chat CRUD
  // =========================================================================

  async addMessage(
    msg: Omit<IronclawChatMessage, 'id' | 'created_at'>,
    threadId?: string,
  ): Promise<IronclawChatMessage> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_chat
        (problem_set_id, content, sender, specialist_id, specialist_display_name,
         delegated_by, action_card, step_progress, suggestion, thread_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        msg.problem_set_id,
        msg.content,
        msg.sender,
        msg.specialist_id ?? null,
        msg.specialist_display_name ?? null,
        msg.delegated_by ?? null,
        msg.action_card ? JSON.stringify(msg.action_card) : null,
        msg.step_progress ? JSON.stringify(msg.step_progress) : null,
        msg.suggestion ? JSON.stringify(msg.suggestion) : null,
        threadId ?? null,
      ],
    );
    return rowToChatMessage(result.rows[0]);
  }

  async getHistory(problemSetId: string, limit = 100, threadId?: string): Promise<IronclawChatMessage[]> {
    const pool = getPool();
    if (threadId) {
      const result = await pool.query(
        `SELECT * FROM ironclaw_chat
         WHERE problem_set_id = $1 AND thread_id = $2
         ORDER BY created_at ASC
         LIMIT $3`,
        [problemSetId, threadId, limit],
      );
      return result.rows.map(rowToChatMessage);
    }
    const result = await pool.query(
      `SELECT * FROM ironclaw_chat
       WHERE problem_set_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [problemSetId, limit],
    );
    return result.rows.map(rowToChatMessage);
  }

  // =========================================================================
  // Thread CRUD
  // =========================================================================

  async createThread(problemSetId: string, userDid: string, name = 'General'): Promise<{ id: string; name: string; created_at: string }> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_threads (problem_set_id, user_did, name)
       VALUES ($1, $2, $3) RETURNING id, name, created_at`,
      [problemSetId, userDid, name],
    );
    return result.rows[0] as { id: string; name: string; created_at: string };
  }

  async listThreads(problemSetId: string, userDid: string): Promise<Array<{ id: string; name: string; message_count: number; last_message_at: string | null; created_at: string }>> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT t.id, t.name, t.created_at,
              COUNT(c.id)::int AS message_count,
              MAX(c.created_at) AS last_message_at
       FROM ironclaw_threads t
       LEFT JOIN ironclaw_chat c ON c.thread_id = t.id
       WHERE t.problem_set_id = $1 AND t.user_did = $2
       GROUP BY t.id
       ORDER BY COALESCE(MAX(c.created_at), t.created_at) DESC`,
      [problemSetId, userDid],
    );
    return result.rows as Array<{ id: string; name: string; message_count: number; last_message_at: string | null; created_at: string }>;
  }

  async renameThread(threadId: string, name: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE ironclaw_threads SET name = $1, updated_at = NOW() WHERE id = $2`,
      [name, threadId],
    );
  }

  async deleteThread(threadId: string): Promise<void> {
    const pool = getPool();

    // Retract concepts sourced from this thread (Phase 66)
    try {
      await conceptStore.retractByThread(threadId);
    } catch (err) {
      console.error('[ironclaw] concept retraction on thread delete failed:', err);
      // Non-blocking — proceed with thread deletion
    }

    // Sync thread forget to sidecar (Phase 66 — best-effort, fire-and-forget)
    sidecarSyncService.forgetThread(threadId).catch((err) =>
      console.error('[ironclaw] sidecar thread forget failed:', err),
    );

    await pool.query('DELETE FROM ironclaw_chat WHERE thread_id = $1', [threadId]);
    await pool.query('DELETE FROM ironclaw_threads WHERE id = $1', [threadId]);
  }

  async getOrCreateDefaultThread(problemSetId: string, userDid: string): Promise<{ id: string; name: string }> {
    const pool = getPool();
    const existing = await pool.query(
      `SELECT id, name FROM ironclaw_threads
       WHERE problem_set_id = $1 AND user_did = $2
       ORDER BY created_at ASC LIMIT 1`,
      [problemSetId, userDid],
    );
    if (existing.rows.length > 0) return existing.rows[0] as { id: string; name: string };
    return this.createThread(problemSetId, userDid, 'General');
  }

  /**
   * Get or create a thread scoped to a specific tab within a problem set.
   * Tab threads use a deterministic naming convention: "tab:{tabName}"
   * so they can be found by tab name without UUID lookups.
   */
  async getOrCreateTabThread(
    problemSetId: string,
    userDid: string,
    tabName: string,
  ): Promise<{ id: string; name: string }> {
    const pool = getPool();
    const threadName = `tab:${tabName}`;
    const existing = await pool.query(
      `SELECT id, name FROM ironclaw_threads
       WHERE problem_set_id = $1 AND user_did = $2 AND name = $3
       LIMIT 1`,
      [problemSetId, userDid, threadName],
    );
    if (existing.rows.length > 0) return existing.rows[0] as { id: string; name: string };
    return this.createThread(problemSetId, userDid, threadName);
  }

  // =========================================================================
  // Trust Preferences
  // =========================================================================

  async grantTrust(
    userDid: string,
    problemSetId: string,
    actionType: string,
  ): Promise<TrustPreference> {
    const pool = getPool();
    const ttlInterval = `${TRUST_TTL_DAYS} days`;
    const result = await pool.query(
      `INSERT INTO ironclaw_trust_preferences (user_did, problem_set_id, action_type, expires_at)
       VALUES ($1, $2, $3, NOW() + $4::interval)
       ON CONFLICT (user_did, problem_set_id, action_type)
       DO UPDATE SET granted_at = NOW(), expires_at = NOW() + $4::interval
       RETURNING *`,
      [userDid, problemSetId, actionType, ttlInterval],
    );
    return rowToTrustPreference(result.rows[0]);
  }

  async revokeTrust(
    userDid: string,
    problemSetId: string,
    actionType: string,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      'DELETE FROM ironclaw_trust_preferences WHERE user_did = $1 AND problem_set_id = $2 AND action_type = $3',
      [userDid, problemSetId, actionType],
    );
  }

  async getTrustPreference(
    userDid: string,
    problemSetId: string,
    actionType: string,
  ): Promise<TrustPreference | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM ironclaw_trust_preferences WHERE user_did = $1 AND problem_set_id = $2 AND action_type = $3 AND expires_at > NOW()',
      [userDid, problemSetId, actionType],
    );
    return result.rows.length > 0 ? rowToTrustPreference(result.rows[0]) : null;
  }

  async getAllTrustPreferences(
    userDid: string,
    problemSetId: string,
  ): Promise<TrustPreference[]> {
    const pool = getPool();
    // Use LIKE for problemSetId to support '%' wildcard (used by DELETE route)
    const result = await pool.query(
      'SELECT * FROM ironclaw_trust_preferences WHERE user_did = $1 AND problem_set_id LIKE $2 AND expires_at > NOW()',
      [userDid, problemSetId],
    );
    return result.rows.map(rowToTrustPreference);
  }

  // =========================================================================
  // Action Log
  // =========================================================================

  async logAction(
    entry: Omit<ActionLogEntry, 'id' | 'created_at'>,
  ): Promise<ActionLogEntry> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_action_log
        (problem_set_id, user_did, action_type, action_payload, risk_level,
         decision, gate_id, result, error, emergency, justification)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        entry.problem_set_id,
        entry.user_did,
        entry.action_type,
        JSON.stringify(entry.action_payload),
        entry.risk_level,
        entry.decision,
        entry.gate_id ?? null,
        entry.result ? JSON.stringify(entry.result) : null,
        entry.error ?? null,
        entry.emergency,
        entry.justification ?? null,
      ],
    );
    return rowToActionLogEntry(result.rows[0]);
  }

  async getUnanchoredActions(since: string): Promise<ActionLogEntry[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM ironclaw_action_log
       WHERE created_at > $1
       ORDER BY created_at ASC`,
      [since],
    );
    return result.rows.map(rowToActionLogEntry);
  }

  // =========================================================================
  // Audit Anchors
  // =========================================================================

  async createAnchor(
    anchor: Omit<AuditAnchor, 'id' | 'created_at'>,
  ): Promise<AuditAnchor> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ironclaw_audit_anchors
        (batch_start, batch_end, action_count, merkle_root, tx_hash, anchored_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        anchor.batch_start,
        anchor.batch_end,
        anchor.action_count,
        anchor.merkle_root,
        anchor.tx_hash ?? null,
        anchor.anchored_at ?? null,
      ],
    );
    return rowToAuditAnchor(result.rows[0]);
  }

  async getLatestAnchor(): Promise<AuditAnchor | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM ironclaw_audit_anchors ORDER BY batch_end DESC LIMIT 1',
    );
    return result.rows.length > 0 ? rowToAuditAnchor(result.rows[0]) : null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const ironclawStore = new IronclawStore();
