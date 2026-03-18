/**
 * Activity Store
 *
 * Persistent PostgreSQL store for agent activity audit trail.
 * Captures every LLM invocation, tool call, message, action card,
 * delegation, and team dispatch across the entire system.
 *
 * Design notes:
 * - All writes are fire-and-forget via setImmediate to avoid blocking hot paths
 * - Query supports rich filtering and pagination
 * - Stats aggregation for admin dashboard
 */

import { getPool } from '../lib/database.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ============================================================================
// Types
// ============================================================================

export type ActivityActionType =
  | 'llm_invocation'
  | 'tool_call'
  | 'delegation'
  | 'message_received'
  | 'message_sent'
  | 'action_card'
  | 'checkpoint'
  | 'error'
  | 'team_dispatch'
  | 'specialist_handoff';

export type ActivityStatus = 'success' | 'error' | 'pending' | 'cancelled';

/**
 * An activity log entry as returned from the database.
 */
export interface ActivityEntry {
  id: number;
  activityId: string;
  agentId: string;
  agentName?: string;
  teamId?: string;
  teamName?: string;
  problemSetId?: string;
  actionType: ActivityActionType;
  actionDetail?: string;
  inputSummary?: string;
  outputSummary?: string;
  durationMs?: number;
  status: ActivityStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Input for inserting a new activity entry.
 */
export type ActivityEntryInput = Omit<ActivityEntry, 'id' | 'activityId' | 'createdAt'>;

/**
 * Filter criteria for querying activity entries.
 */
export interface ActivityFilter {
  agentId?: string;
  teamId?: string;
  actionType?: string;
  problemSetId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Per-agent stats breakdown.
 */
export interface AgentActivityStats {
  agentId: string;
  agentName?: string;
  count: number;
  successCount: number;
  errorCount: number;
  avgDurationMs?: number;
}

/**
 * Per-team stats breakdown.
 */
export interface TeamActivityStats {
  teamId: string;
  teamName?: string;
  count: number;
}

/**
 * Aggregated activity statistics.
 */
export interface ActivityStats {
  total: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
  byAgent: AgentActivityStats[];
  byTeam: TeamActivityStats[];
  byActionType: Record<string, number>;
}

// ============================================================================
// ActivityStore
// ============================================================================

class ActivityStore {
  private initialized = false;

  /**
   * Run the migration DDL to ensure the table exists.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const migrationPath = join(__dirname, '../db/migrations/036-agent-activity-log.sql');
      const sql = readFileSync(migrationPath, 'utf-8');
      await pool.query(sql);
      this.initialized = true;
    } catch (error) {
      console.error('[ActivityStore] Migration failed:', error);
      // Non-fatal — log but don't crash the process
    }
  }

  /**
   * Insert a new activity entry.
   * Returns the inserted entry including generated id and activityId.
   */
  async insert(entry: ActivityEntryInput): Promise<ActivityEntry> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query<{
      id: number;
      activity_id: string;
      agent_id: string;
      agent_name: string | null;
      team_id: string | null;
      team_name: string | null;
      problem_set_id: string | null;
      action_type: string;
      action_detail: string | null;
      input_summary: string | null;
      output_summary: string | null;
      duration_ms: number | null;
      status: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `INSERT INTO agent_activity_log (
        agent_id, agent_name, team_id, team_name, problem_set_id,
        action_type, action_detail, input_summary, output_summary,
        duration_ms, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        entry.agentId,
        entry.agentName ?? null,
        entry.teamId ?? null,
        entry.teamName ?? null,
        entry.problemSetId ?? null,
        entry.actionType,
        entry.actionDetail ?? null,
        entry.inputSummary ?? null,
        entry.outputSummary ?? null,
        entry.durationMs ?? null,
        entry.status,
        JSON.stringify(entry.metadata ?? {}),
      ]
    );

    return this.rowToEntry(result.rows[0]);
  }

  /**
   * Query activity entries with optional filters and pagination.
   */
  async query(filter: ActivityFilter): Promise<{ entries: ActivityEntry[]; total: number }> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.agentId) {
      conditions.push(`agent_id = $${paramIdx++}`);
      params.push(filter.agentId);
    }
    if (filter.teamId) {
      conditions.push(`team_id = $${paramIdx++}`);
      params.push(filter.teamId);
    }
    if (filter.actionType) {
      conditions.push(`action_type = $${paramIdx++}`);
      params.push(filter.actionType);
    }
    if (filter.problemSetId) {
      conditions.push(`problem_set_id = $${paramIdx++}`);
      params.push(filter.problemSetId);
    }
    if (filter.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(filter.status);
    }
    if (filter.startDate) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`created_at <= $${paramIdx++}`);
      params.push(filter.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    // Count query
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM agent_activity_log ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data query
    const dataResult = await pool.query(
      `SELECT * FROM agent_activity_log ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    );

    return {
      entries: dataResult.rows.map((r) => this.rowToEntry(r)),
      total,
    };
  }

  /**
   * Get aggregated activity statistics.
   */
  async getStats(filter?: Partial<ActivityFilter>): Promise<ActivityStats> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter?.agentId) {
      conditions.push(`agent_id = $${paramIdx++}`);
      params.push(filter.agentId);
    }
    if (filter?.teamId) {
      conditions.push(`team_id = $${paramIdx++}`);
      params.push(filter.teamId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Overall stats
    const overallResult = await pool.query<{
      total: string;
      success_count: string;
      error_count: string;
      avg_duration: string | null;
    }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'error') as error_count,
        AVG(duration_ms) as avg_duration
       FROM agent_activity_log ${whereClause}`,
      params
    );

    const overall = overallResult.rows[0];
    const total = parseInt(overall.total, 10);
    const successCount = parseInt(overall.success_count, 10);
    const errorCount = parseInt(overall.error_count, 10);
    const avgDurationMs = overall.avg_duration ? parseFloat(overall.avg_duration) : 0;

    // Per-agent stats
    const agentResult = await pool.query<{
      agent_id: string;
      agent_name: string | null;
      count: string;
      success_count: string;
      error_count: string;
      avg_duration: string | null;
    }>(
      `SELECT
        agent_id,
        agent_name,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'error') as error_count,
        AVG(duration_ms) as avg_duration
       FROM agent_activity_log ${whereClause}
       GROUP BY agent_id, agent_name
       ORDER BY count DESC
       LIMIT 20`,
      params
    );

    const byAgent: AgentActivityStats[] = agentResult.rows.map((r) => ({
      agentId: r.agent_id,
      agentName: r.agent_name ?? undefined,
      count: parseInt(r.count, 10),
      successCount: parseInt(r.success_count, 10),
      errorCount: parseInt(r.error_count, 10),
      avgDurationMs: r.avg_duration ? parseFloat(r.avg_duration) : undefined,
    }));

    // Per-team stats
    const teamResult = await pool.query<{
      team_id: string | null;
      team_name: string | null;
      count: string;
    }>(
      `SELECT
        team_id,
        team_name,
        COUNT(*) as count
       FROM agent_activity_log
       ${whereClause ? whereClause + ' AND team_id IS NOT NULL' : 'WHERE team_id IS NOT NULL'}
       GROUP BY team_id, team_name
       ORDER BY count DESC
       LIMIT 10`,
      params
    );

    const byTeam: TeamActivityStats[] = teamResult.rows
      .filter((r) => r.team_id)
      .map((r) => ({
        teamId: r.team_id!,
        teamName: r.team_name ?? undefined,
        count: parseInt(r.count, 10),
      }));

    // Per-action-type stats
    const typeResult = await pool.query<{
      action_type: string;
      count: string;
    }>(
      `SELECT action_type, COUNT(*) as count
       FROM agent_activity_log ${whereClause}
       GROUP BY action_type
       ORDER BY count DESC`,
      params
    );

    const byActionType: Record<string, number> = {};
    for (const r of typeResult.rows) {
      byActionType[r.action_type] = parseInt(r.count, 10);
    }

    return {
      total,
      successCount,
      errorCount,
      successRate: total > 0 ? successCount / total : 0,
      avgDurationMs,
      byAgent,
      byTeam,
      byActionType,
    };
  }

  /**
   * Delete activity entries older than the given date.
   * Returns the number of deleted rows.
   */
  async cleanup(olderThan: Date): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query<{ count: string }>(
      `WITH deleted AS (
        DELETE FROM agent_activity_log WHERE created_at < $1 RETURNING 1
       ) SELECT COUNT(*) as count FROM deleted`,
      [olderThan]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Convert a database row to an ActivityEntry.
   */
  private rowToEntry(row: Record<string, unknown>): ActivityEntry {
    return {
      id: row.id as number,
      activityId: row.activity_id as string,
      agentId: row.agent_id as string,
      agentName: (row.agent_name as string | null) ?? undefined,
      teamId: (row.team_id as string | null) ?? undefined,
      teamName: (row.team_name as string | null) ?? undefined,
      problemSetId: (row.problem_set_id as string | null) ?? undefined,
      actionType: row.action_type as ActivityActionType,
      actionDetail: (row.action_detail as string | null) ?? undefined,
      inputSummary: (row.input_summary as string | null) ?? undefined,
      outputSummary: (row.output_summary as string | null) ?? undefined,
      durationMs: (row.duration_ms as number | null) ?? undefined,
      status: row.status as ActivityStatus,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : (row.created_at as string),
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _activityStore: ActivityStore | null = null;

export function getActivityStore(): ActivityStore {
  if (!_activityStore) {
    _activityStore = new ActivityStore();
  }
  return _activityStore;
}
