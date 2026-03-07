/**
 * Decision Gate PostgreSQL Store
 *
 * Phase 28 Plan 01: CRUD operations for decision gates.
 * Uses getPool() pattern consistent with other stores in the project.
 *
 * Migration SQL (run via ensureTable() at startup):
 *
 *   CREATE TABLE IF NOT EXISTS decision_gates (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     problem_set_id UUID NOT NULL,
 *     gate_type TEXT NOT NULL,
 *     tab TEXT NOT NULL,
 *     target_item_id TEXT NOT NULL,
 *     target_item_type TEXT NOT NULL,
 *     target_item_title TEXT NOT NULL DEFAULT '',
 *     enforcement TEXT NOT NULL DEFAULT 'hard_block',
 *     status TEXT NOT NULL DEFAULT 'pending',
 *     proposal_id TEXT,
 *     deadline_at TIMESTAMPTZ,
 *     timeout_behavior TEXT NOT NULL DEFAULT 'auto_escalate',
 *     submitted_by TEXT,
 *     submitted_at TIMESTAMPTZ,
 *     decided_by TEXT,
 *     decided_at TIMESTAMPTZ,
 *     decision_context JSONB NOT NULL DEFAULT '{}',
 *     mode TEXT NOT NULL DEFAULT 'operational',
 *     training_config JSONB,
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *
 *   CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set
 *     ON decision_gates (problem_set_id);
 *   CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set_tab
 *     ON decision_gates (problem_set_id, tab);
 *   CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set_status
 *     ON decision_gates (problem_set_id, status);
 */

import { getPool } from '../lib/database.js';
import type {
  DecisionGate,
  CreateGateParams,
  UpdateGateParams,
  GateFilter,
} from './gate-types.js';
import { GateEnforcement, GateStatus, TimeoutBehavior, GATE_DEFAULTS } from './gate-types.js';

// ---------------------------------------------------------------------------
// Helper: map a DB row to DecisionGate
// ---------------------------------------------------------------------------

function rowToGate(row: Record<string, unknown>): DecisionGate {
  return {
    id: row.id as string,
    problem_set_id: row.problem_set_id as string,
    gate_type: row.gate_type as DecisionGate['gate_type'],
    tab: row.tab as DecisionGate['tab'],
    target_item_id: row.target_item_id as string,
    target_item_type: row.target_item_type as string,
    target_item_title: row.target_item_title as string,
    enforcement: row.enforcement as DecisionGate['enforcement'],
    status: row.status as DecisionGate['status'],
    proposal_id: (row.proposal_id as string) ?? null,
    deadline_at: row.deadline_at ? (row.deadline_at as Date).toISOString() : null,
    timeout_behavior: row.timeout_behavior as DecisionGate['timeout_behavior'],
    submitted_by: (row.submitted_by as string) ?? null,
    submitted_at: row.submitted_at ? (row.submitted_at as Date).toISOString() : null,
    decided_by: (row.decided_by as string) ?? null,
    decided_at: row.decided_at ? (row.decided_at as Date).toISOString() : null,
    decision_context: (row.decision_context as Record<string, unknown>) ?? {},
    mode: row.mode as 'training' | 'operational',
    training_config: (row.training_config as Record<string, unknown>) ?? null,
    created_at: (row.created_at as Date).toISOString(),
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GateStore
// ---------------------------------------------------------------------------

export class GateStore {
  /**
   * Ensure the decision_gates table and indexes exist.
   * Safe to call multiple times (idempotent).
   */
  async ensureTable(): Promise<void> {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS decision_gates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        problem_set_id UUID NOT NULL,
        gate_type TEXT NOT NULL,
        tab TEXT NOT NULL,
        target_item_id TEXT NOT NULL,
        target_item_type TEXT NOT NULL,
        target_item_title TEXT NOT NULL DEFAULT '',
        enforcement TEXT NOT NULL DEFAULT 'hard_block',
        status TEXT NOT NULL DEFAULT 'pending',
        proposal_id TEXT,
        deadline_at TIMESTAMPTZ,
        timeout_behavior TEXT NOT NULL DEFAULT 'auto_escalate',
        submitted_by TEXT,
        submitted_at TIMESTAMPTZ,
        decided_by TEXT,
        decided_at TIMESTAMPTZ,
        decision_context JSONB NOT NULL DEFAULT '{}',
        mode TEXT NOT NULL DEFAULT 'operational',
        training_config JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set
        ON decision_gates (problem_set_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set_tab
        ON decision_gates (problem_set_id, tab)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set_status
        ON decision_gates (problem_set_id, status)
    `);
  }

  /**
   * Create a new decision gate.
   */
  async create(params: CreateGateParams): Promise<DecisionGate> {
    const pool = getPool();
    const defaults = GATE_DEFAULTS[params.gate_type];
    const tab = params.tab ?? defaults?.tab ?? 'understand';
    const enforcement = params.enforcement ?? defaults?.enforcement ?? GateEnforcement.hard_block;
    const timeoutBehavior = params.timeout_behavior ?? TimeoutBehavior.auto_escalate;
    const mode = params.mode ?? 'operational';

    const result = await pool.query(
      `INSERT INTO decision_gates
        (problem_set_id, gate_type, tab, target_item_id, target_item_type, target_item_title,
         enforcement, status, timeout_behavior, deadline_at, mode, training_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        params.problem_set_id,
        params.gate_type,
        tab,
        params.target_item_id,
        params.target_item_type,
        params.target_item_title,
        enforcement,
        GateStatus.pending,
        timeoutBehavior,
        params.deadline_at ?? null,
        mode,
        params.training_config ? JSON.stringify(params.training_config) : null,
      ],
    );

    return rowToGate(result.rows[0]);
  }

  /**
   * Find a gate by ID.
   */
  async findById(id: string): Promise<DecisionGate | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM decision_gates WHERE id = $1', [id]);
    return result.rows.length > 0 ? rowToGate(result.rows[0]) : null;
  }

  /**
   * Find gates matching a filter.
   */
  async findByFilter(filter: GateFilter): Promise<DecisionGate[]> {
    const pool = getPool();
    const conditions: string[] = ['problem_set_id = $1'];
    const values: unknown[] = [filter.problem_set_id];
    let paramIndex = 2;

    if (filter.tab) {
      conditions.push(`tab = $${paramIndex}`);
      values.push(filter.tab);
      paramIndex++;
    }
    if (filter.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filter.status);
      paramIndex++;
    }
    if (filter.gate_type) {
      conditions.push(`gate_type = $${paramIndex}`);
      values.push(filter.gate_type);
      paramIndex++;
    }

    const sql = `SELECT * FROM decision_gates WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const result = await pool.query(sql, values);
    return result.rows.map(rowToGate);
  }

  /**
   * Find all gates for a problem set.
   */
  async findByProblemSet(problemSetId: string): Promise<DecisionGate[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM decision_gates WHERE problem_set_id = $1 ORDER BY created_at DESC',
      [problemSetId],
    );
    return result.rows.map(rowToGate);
  }

  /**
   * Update gate fields.
   */
  async update(id: string, params: UpdateGateParams): Promise<DecisionGate> {
    const pool = getPool();
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fields: Array<[keyof UpdateGateParams, unknown]> = [
      ['enforcement', params.enforcement],
      ['status', params.status],
      ['deadline_at', params.deadline_at],
      ['timeout_behavior', params.timeout_behavior],
      ['submitted_by', params.submitted_by],
      ['submitted_at', params.submitted_at],
      ['decided_by', params.decided_by],
      ['decided_at', params.decided_at],
      ['proposal_id', params.proposal_id],
    ];

    for (const [key, value] of fields) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    // decision_context needs JSON serialization
    if (params.decision_context !== undefined) {
      setClauses.push(`decision_context = $${paramIndex}`);
      values.push(JSON.stringify(params.decision_context));
      paramIndex++;
    }

    values.push(id);
    const sql = `UPDATE decision_gates SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(sql, values);

    if (result.rows.length === 0) {
      throw new Error(`Gate not found: ${id}`);
    }
    return rowToGate(result.rows[0]);
  }

  /**
   * Update gate status with decided_by and decided_at fields.
   */
  async updateStatus(id: string, status: string, decidedBy?: string): Promise<DecisionGate> {
    const pool = getPool();
    const params: UpdateGateParams = { status: status as DecisionGate['status'] };
    if (decidedBy) {
      params.decided_by = decidedBy;
      params.decided_at = new Date().toISOString();
    }
    return this.update(id, params);
  }

  /**
   * Find gates that are pending and past their deadline (for timeout processing).
   */
  async findPendingByDeadline(before: Date): Promise<DecisionGate[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM decision_gates
       WHERE status IN ('pending', 'submitted')
         AND deadline_at IS NOT NULL
         AND deadline_at < $1
       ORDER BY deadline_at ASC`,
      [before.toISOString()],
    );
    return result.rows.map(rowToGate);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gateStore = new GateStore();
