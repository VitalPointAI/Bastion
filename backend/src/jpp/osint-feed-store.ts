/**
 * OSINT Feed Configuration Store
 *
 * Phase 33: JPP Campaign Plan Framework
 *
 * Manages OSINT feed configurations per problem set. Supports multiple source
 * types (Argus webhook, RSS, API, simulated) with per-feed polling intervals
 * and relevance mode settings.
 *
 * Table: osint_feed_config
 * ID format: FEED-{uuid}
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ============================================================================
// Types
// ============================================================================

export type FeedSourceType = 'argus_webhook' | 'rss' | 'api' | 'simulated';
export type RelevanceMode = 'entity_objective' | 'ai_semantic';

export interface OSINTFeedConfig {
  id: string;
  problemSetId: string;
  sourceName: string;
  sourceType: FeedSourceType;
  endpointUrl: string | null;
  pollingIntervalMs: number;
  relevanceMode: RelevanceMode;
  active: boolean;
  config: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateFeedInput {
  problemSetId: string;
  sourceName: string;
  sourceType: FeedSourceType;
  endpointUrl?: string;
  pollingIntervalMs?: number;
  relevanceMode?: RelevanceMode;
  active?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateFeedInput {
  sourceName?: string;
  sourceType?: FeedSourceType;
  endpointUrl?: string | null;
  pollingIntervalMs?: number;
  relevanceMode?: RelevanceMode;
  active?: boolean;
  config?: Record<string, unknown>;
}

// ============================================================================
// OSINT Feed Store
// ============================================================================

class OSINTFeedStore {
  private initialized = false;

  /**
   * Ensure feed config table exists
   */
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS osint_feed_config (
        id TEXT PRIMARY KEY,
        problem_set_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        endpoint_url TEXT,
        polling_interval_ms INTEGER DEFAULT 300000,
        relevance_mode TEXT DEFAULT 'entity_objective',
        active BOOLEAN DEFAULT TRUE,
        config JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_osint_feed_problem_set ON osint_feed_config(problem_set_id);
    `);

    this.initialized = true;
  }

  /**
   * Create a new feed configuration
   */
  async createFeed(data: CreateFeedInput): Promise<OSINTFeedConfig> {
    await this.ensureTable();
    const pool = getPool();
    const id = `FEED-${randomUUID().slice(0, 8)}`;

    const result = await pool.query(
      `INSERT INTO osint_feed_config
        (id, problem_set_id, source_name, source_type, endpoint_url,
         polling_interval_ms, relevance_mode, active, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        data.problemSetId,
        data.sourceName,
        data.sourceType,
        data.endpointUrl || null,
        data.pollingIntervalMs ?? 300000,
        data.relevanceMode ?? 'entity_objective',
        data.active ?? true,
        JSON.stringify(data.config ?? {}),
      ]
    );

    return this.rowToFeedConfig(result.rows[0]);
  }

  /**
   * Get a single feed config by ID
   */
  async getFeed(id: string): Promise<OSINTFeedConfig | null> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM osint_feed_config WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToFeedConfig(result.rows[0]);
  }

  /**
   * Get all active feed configs for a problem set
   */
  async getFeedsByProblemSet(problemSetId: string): Promise<OSINTFeedConfig[]> {
    await this.ensureTable();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM osint_feed_config
       WHERE problem_set_id = $1
       ORDER BY active DESC, created_at DESC`,
      [problemSetId]
    );

    return result.rows.map(row => this.rowToFeedConfig(row));
  }

  /**
   * Update a feed configuration (partial update)
   */
  async updateFeed(id: string, updates: UpdateFeedInput): Promise<OSINTFeedConfig | null> {
    await this.ensureTable();
    const pool = getPool();

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.sourceName !== undefined) {
      setClauses.push(`source_name = $${idx++}`);
      values.push(updates.sourceName);
    }
    if (updates.sourceType !== undefined) {
      setClauses.push(`source_type = $${idx++}`);
      values.push(updates.sourceType);
    }
    if (updates.endpointUrl !== undefined) {
      setClauses.push(`endpoint_url = $${idx++}`);
      values.push(updates.endpointUrl);
    }
    if (updates.pollingIntervalMs !== undefined) {
      setClauses.push(`polling_interval_ms = $${idx++}`);
      values.push(updates.pollingIntervalMs);
    }
    if (updates.relevanceMode !== undefined) {
      setClauses.push(`relevance_mode = $${idx++}`);
      values.push(updates.relevanceMode);
    }
    if (updates.active !== undefined) {
      setClauses.push(`active = $${idx++}`);
      values.push(updates.active);
    }
    if (updates.config !== undefined) {
      setClauses.push(`config = $${idx++}`);
      values.push(JSON.stringify(updates.config));
    }

    if (setClauses.length === 0) return null;

    values.push(id);
    const result = await pool.query(
      `UPDATE osint_feed_config SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.rowToFeedConfig(result.rows[0]);
  }

  /**
   * Delete a feed configuration
   */
  async deleteFeed(id: string): Promise<boolean> {
    await this.ensureTable();
    const pool = getPool();

    const result = await pool.query(
      'DELETE FROM osint_feed_config WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all active RSS feeds (for polling scheduler)
   */
  async getActiveRSSFeeds(): Promise<OSINTFeedConfig[]> {
    await this.ensureTable();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM osint_feed_config
       WHERE source_type IN ('rss') AND active = true
       ORDER BY polling_interval_ms ASC`
    );

    return result.rows.map(row => this.rowToFeedConfig(row));
  }

  /**
   * Get all active feeds (RSS, API, webhook — for the feed poller)
   */
  async getActiveFeeds(): Promise<OSINTFeedConfig[]> {
    await this.ensureTable();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM osint_feed_config
       WHERE active = true
       ORDER BY polling_interval_ms ASC`
    );

    return result.rows.map(row => this.rowToFeedConfig(row));
  }

  /**
   * Convert database row to OSINTFeedConfig
   */
  private rowToFeedConfig(row: Record<string, unknown>): OSINTFeedConfig {
    return {
      id: row.id as string,
      problemSetId: row.problem_set_id as string,
      sourceName: row.source_name as string,
      sourceType: row.source_type as FeedSourceType,
      endpointUrl: row.endpoint_url as string | null,
      pollingIntervalMs: row.polling_interval_ms as number,
      relevanceMode: row.relevance_mode as RelevanceMode,
      active: row.active as boolean,
      config: (row.config as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Singleton instance
export const osintFeedStore = new OSINTFeedStore();
