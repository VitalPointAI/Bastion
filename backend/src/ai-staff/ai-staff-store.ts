/**
 * AI Staff PostgreSQL Store
 *
 * Phase 29 Plan 02: CRUD operations for feed items, annotations, chat
 * messages, and agent tab routing. Uses getPool() pattern consistent
 * with gate-store.ts and other stores in the project.
 */

import { getPool } from '../lib/database.js';
import type {
  AIFeedItemRow,
  AIAnnotationRow,
  ChatMessageRow,
  AgentTabRoutingRow,
  FeedQueryOptions,
  AnnotationQueryOptions,
} from './ai-staff-types.js';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToFeedItem(row: Record<string, unknown>): AIFeedItemRow {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    agent_id: row.agent_id as string,
    agent_display_name: row.agent_display_name as string,
    agent_role: row.agent_role as string,
    team_id: (row.team_id as string) ?? null,
    team_name: (row.team_name as string) ?? null,
    source_tab: row.source_tab as string,
    priority: row.priority as AIFeedItemRow['priority'],
    urgency: row.urgency as AIFeedItemRow['urgency'],
    content: row.content as string,
    content_type: row.content_type as string,
    confidence: row.confidence as AIFeedItemRow['confidence'],
    is_read: row.is_read as boolean,
    is_auto_applied: row.is_auto_applied as boolean,
    inline_target: (row.inline_target as Record<string, unknown>) ?? null,
    actions: (row.actions as Record<string, unknown>[]) ?? null,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

function rowToAnnotation(row: Record<string, unknown>): AIAnnotationRow {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    agent_id: row.agent_id as string,
    agent_display_name: row.agent_display_name as string,
    content: row.content as string,
    suggested_change: (row.suggested_change as string) ?? null,
    confidence: row.confidence as AIAnnotationRow['confidence'],
    is_auto_apply: row.is_auto_apply as boolean,
    target_content_id: row.target_content_id as string,
    anchor_id: row.anchor_id as string,
    status: row.status as AIAnnotationRow['status'],
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

function rowToChatMessage(row: Record<string, unknown>): ChatMessageRow {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    content: row.content as string,
    sender: row.sender as ChatMessageRow['sender'],
    agent_id: (row.agent_id as string) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function rowToTabRouting(row: Record<string, unknown>): AgentTabRoutingRow {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    tab_id: row.tab_id as string,
    agent_ids: row.agent_ids as string[],
    is_user_customized: row.is_user_customized as boolean,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// AIStaffStore
// ---------------------------------------------------------------------------

export class AIStaffStore {
  /**
   * Ensure all AI staff tables and indexes exist (idempotent).
   * Safe to call multiple times at startup.
   */
  async ensureTable(): Promise<void> {
    const pool = getPool();

    // Feed items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_staff_feed (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_display_name TEXT NOT NULL,
        agent_role TEXT NOT NULL,
        team_id TEXT,
        team_name TEXT,
        source_tab TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        urgency TEXT NOT NULL DEFAULT 'info',
        content TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'text',
        confidence TEXT NOT NULL DEFAULT 'probable',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        is_auto_applied BOOLEAN NOT NULL DEFAULT FALSE,
        inline_target JSONB,
        actions JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_staff_feed_problem_set
        ON ai_staff_feed (problem_set_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_staff_feed_problem_set_tab
        ON ai_staff_feed (problem_set_id, source_tab)
    `);

    // Annotations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_staff_annotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_display_name TEXT NOT NULL,
        content TEXT NOT NULL,
        suggested_change TEXT,
        confidence TEXT NOT NULL DEFAULT 'probable',
        is_auto_apply BOOLEAN NOT NULL DEFAULT FALSE,
        target_content_id TEXT NOT NULL,
        anchor_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_staff_annotations_problem_set
        ON ai_staff_annotations (problem_set_id)
    `);

    // Chat messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_staff_chat (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        content TEXT NOT NULL,
        sender TEXT NOT NULL DEFAULT 'user',
        agent_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_staff_chat_problem_set
        ON ai_staff_chat (problem_set_id)
    `);

    // Tab routing table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_staff_tab_routing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id TEXT NOT NULL,
        tab_id TEXT NOT NULL,
        agent_ids TEXT[] NOT NULL DEFAULT '{}',
        is_user_customized BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (problem_set_id, tab_id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_staff_tab_routing_problem_set
        ON ai_staff_tab_routing (problem_set_id)
    `);
  }

  // =========================================================================
  // Feed CRUD
  // =========================================================================

  async createFeedItem(row: Omit<AIFeedItemRow, 'id' | 'created_at' | 'updated_at' | 'is_read'>): Promise<AIFeedItemRow> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ai_staff_feed
        (problem_set_id, agent_id, agent_display_name, agent_role, team_id, team_name,
         source_tab, priority, urgency, content, content_type, confidence,
         is_auto_applied, inline_target, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        row.problem_set_id,
        row.agent_id,
        row.agent_display_name,
        row.agent_role,
        row.team_id ?? null,
        row.team_name ?? null,
        row.source_tab,
        row.priority,
        row.urgency,
        row.content,
        row.content_type,
        row.confidence,
        row.is_auto_applied ?? false,
        row.inline_target ? JSON.stringify(row.inline_target) : null,
        row.actions ? JSON.stringify(row.actions) : null,
      ],
    );
    return rowToFeedItem(result.rows[0]);
  }

  async getFeedItems(problemSetId: string, opts?: FeedQueryOptions): Promise<AIFeedItemRow[]> {
    const pool = getPool();
    const conditions: string[] = ['problem_set_id = $1'];
    const values: unknown[] = [problemSetId];
    let paramIndex = 2;

    if (opts?.tab) {
      conditions.push(`source_tab = $${paramIndex}`);
      values.push(opts.tab);
      paramIndex++;
    }

    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    const sql = `SELECT * FROM ai_staff_feed
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await pool.query(sql, values);
    return result.rows.map(rowToFeedItem);
  }

  async markRead(id: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      'UPDATE ai_staff_feed SET is_read = TRUE, updated_at = NOW() WHERE id = $1',
      [id],
    );
  }

  async markAllRead(problemSetId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      'UPDATE ai_staff_feed SET is_read = TRUE, updated_at = NOW() WHERE problem_set_id = $1 AND is_read = FALSE',
      [problemSetId],
    );
  }

  // =========================================================================
  // Annotation CRUD
  // =========================================================================

  async createAnnotation(row: Omit<AIAnnotationRow, 'id' | 'created_at' | 'updated_at'>): Promise<AIAnnotationRow> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ai_staff_annotations
        (problem_set_id, agent_id, agent_display_name, content, suggested_change,
         confidence, is_auto_apply, target_content_id, anchor_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        row.problem_set_id,
        row.agent_id,
        row.agent_display_name,
        row.content,
        row.suggested_change ?? null,
        row.confidence,
        row.is_auto_apply,
        row.target_content_id,
        row.anchor_id,
        row.status ?? 'pending',
      ],
    );
    return rowToAnnotation(result.rows[0]);
  }

  async getAnnotations(problemSetId: string, opts?: AnnotationQueryOptions): Promise<AIAnnotationRow[]> {
    const pool = getPool();
    const conditions: string[] = ['problem_set_id = $1'];
    const values: unknown[] = [problemSetId];
    let paramIndex = 2;

    if (opts?.tab) {
      // Annotations don't have a tab column, but can filter by target
      // This is a placeholder for future tab-based filtering
    }

    if (opts?.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(opts.status);
      paramIndex++;
    }

    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    const sql = `SELECT * FROM ai_staff_annotations
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await pool.query(sql, values);
    return result.rows.map(rowToAnnotation);
  }

  async updateAnnotationStatus(id: string, status: AIAnnotationRow['status']): Promise<AIAnnotationRow> {
    const pool = getPool();
    const result = await pool.query(
      `UPDATE ai_staff_annotations
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) {
      throw new Error(`Annotation not found: ${id}`);
    }
    return rowToAnnotation(result.rows[0]);
  }

  // =========================================================================
  // Chat
  // =========================================================================

  async addChatMessage(row: Omit<ChatMessageRow, 'id' | 'created_at'>): Promise<ChatMessageRow> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ai_staff_chat
        (problem_set_id, content, sender, agent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [row.problem_set_id, row.content, row.sender, row.agent_id ?? null],
    );
    return rowToChatMessage(result.rows[0]);
  }

  async getChatHistory(problemSetId: string, limit?: number): Promise<ChatMessageRow[]> {
    const pool = getPool();
    const effectiveLimit = limit ?? 100;
    const result = await pool.query(
      `SELECT * FROM ai_staff_chat
       WHERE problem_set_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [problemSetId, effectiveLimit],
    );
    return result.rows.map(rowToChatMessage);
  }

  // =========================================================================
  // Routing
  // =========================================================================

  async getTabRouting(problemSetId: string): Promise<AgentTabRoutingRow[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM ai_staff_tab_routing WHERE problem_set_id = $1 ORDER BY tab_id',
      [problemSetId],
    );
    return result.rows.map(rowToTabRouting);
  }

  async updateTabRouting(
    problemSetId: string,
    tabId: string,
    agentIds: string[],
  ): Promise<AgentTabRoutingRow> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO ai_staff_tab_routing (problem_set_id, tab_id, agent_ids, is_user_customized)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (problem_set_id, tab_id)
       DO UPDATE SET agent_ids = $3, is_user_customized = TRUE, updated_at = NOW()
       RETURNING *`,
      [problemSetId, tabId, agentIds],
    );
    return rowToTabRouting(result.rows[0]);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const aiStaffStore = new AIStaffStore();
