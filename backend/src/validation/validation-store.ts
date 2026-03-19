/**
 * Validation Framework PostgreSQL Store
 *
 * Phase 31 Plan 01: CRUD operations for all 6 validation tables.
 * Uses getPool() pattern consistent with ai-staff-store.ts.
 */

import { getPool } from '../lib/database.js';
import type {
  TestRunRow,
  TestResultRow,
  ValidationAgentScoreRow,
  CircuitBreakerEventRow,
  ThresholdConfigRow,
  EvaluatorDriftRow,
  ValidationDashboardSummary,
  ValidationStatus,
} from './validation-types.js';

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function rowToTestRun(row: Record<string, unknown>): TestRunRow {
  return {
    id: row.id as string,
    triggered_by: row.triggered_by as string,
    started_at: (row.started_at as Date).toISOString(),
    completed_at: row.completed_at
      ? (row.completed_at as Date).toISOString()
      : null,
    total_agents: Number(row.total_agents),
    total_scenarios: Number(row.total_scenarios),
    status: row.status as TestRunRow['status'],
  };
}

function rowToTestResult(row: Record<string, unknown>): TestResultRow {
  return {
    id: row.id as string,
    run_id: row.run_id as string,
    agent_id: row.agent_id as string,
    scenario_id: row.scenario_id as string,
    category: row.category as string,
    functional_score: row.functional_score != null ? Number(row.functional_score) : null,
    llm_judge_score: row.llm_judge_score != null ? Number(row.llm_judge_score) : null,
    combined_score: row.combined_score != null ? Number(row.combined_score) : null,
    disagreement: row.disagreement as boolean,
    input_snapshot: row.input_snapshot as Record<string, unknown>,
    output_snapshot: row.output_snapshot as Record<string, unknown>,
    expected_snapshot: row.expected_snapshot as Record<string, unknown>,
    details: (row.details as Record<string, unknown>) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function rowToAgentScore(
  row: Record<string, unknown>,
): ValidationAgentScoreRow {
  return {
    id: row.id as string,
    run_id: row.run_id as string,
    agent_id: row.agent_id as string,
    category: row.category as string,
    avg_score: Number(row.avg_score),
    min_score: Number(row.min_score),
    max_score: Number(row.max_score),
    scenario_count: Number(row.scenario_count),
    status: row.status as ValidationStatus,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function rowToCircuitEvent(
  row: Record<string, unknown>,
): CircuitBreakerEventRow {
  return {
    id: row.id as string,
    agent_id: row.agent_id as string,
    category: row.category as string,
    event_type: row.event_type as CircuitBreakerEventRow['event_type'],
    previous_state: row.previous_state as string,
    new_state: row.new_state as string,
    triggered_by: row.triggered_by as string,
    justification: (row.justification as string) ?? null,
    run_id: (row.run_id as string) ?? null,
    details: (row.details as Record<string, unknown>) ?? null,
    created_at: (row.created_at as Date).toISOString(),
  };
}

function rowToThreshold(row: Record<string, unknown>): ThresholdConfigRow {
  return {
    id: row.id as string,
    scope_type: row.scope_type as ThresholdConfigRow['scope_type'],
    scope_id: (row.scope_id as string) ?? null,
    category: row.category as string,
    warning_threshold: Number(row.warning_threshold),
    critical_threshold: Number(row.critical_threshold),
    grace_period_runs: Number(row.grace_period_runs),
    immediate_disable: row.immediate_disable as boolean,
    updated_by: row.updated_by as string,
    updated_at: (row.updated_at as Date).toISOString(),
  };
}

function _rowToEvaluatorDrift(row: Record<string, unknown>): EvaluatorDriftRow {
  return {
    id: row.id as string,
    run_id: row.run_id as string,
    calibration_scenario_id: row.calibration_scenario_id as string,
    expected_score: Number(row.expected_score),
    actual_score: Number(row.actual_score),
    drift_magnitude: Number(row.drift_magnitude),
    created_at: (row.created_at as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ValidationStore
// ---------------------------------------------------------------------------

export class ValidationStore {
  private initialized = false;

  /**
   * Create all 6 validation tables and indexes (idempotent).
   * Safe to call multiple times at startup.
   */
  async ensureTable(): Promise<void> {
    if (this.initialized) return;
    const pool = getPool();

    // validation_runs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        triggered_by TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        total_agents INTEGER NOT NULL DEFAULT 0,
        total_scenarios INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'running'
      )
    `);

    // validation_results
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES validation_runs(id),
        agent_id TEXT NOT NULL,
        scenario_id TEXT NOT NULL,
        category TEXT NOT NULL,
        functional_score NUMERIC(4,3),
        llm_judge_score NUMERIC(4,3),
        combined_score NUMERIC(4,3),
        disagreement BOOLEAN NOT NULL DEFAULT FALSE,
        input_snapshot JSONB NOT NULL,
        output_snapshot JSONB NOT NULL,
        expected_snapshot JSONB NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vr_agent_cat_time
        ON validation_results (agent_id, category, created_at DESC)
    `);

    // validation_agent_scores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_agent_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES validation_runs(id),
        agent_id TEXT NOT NULL,
        category TEXT NOT NULL,
        avg_score NUMERIC(4,3) NOT NULL,
        min_score NUMERIC(4,3) NOT NULL,
        max_score NUMERIC(4,3) NOT NULL,
        scenario_count INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vas_agent_time
        ON validation_agent_scores (agent_id, created_at DESC)
    `);

    // validation_circuit_events
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_circuit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id TEXT NOT NULL,
        category TEXT NOT NULL,
        event_type TEXT NOT NULL,
        previous_state TEXT NOT NULL,
        new_state TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        justification TEXT,
        run_id UUID REFERENCES validation_runs(id),
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // validation_thresholds
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_thresholds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scope_type TEXT NOT NULL,
        scope_id TEXT,
        category TEXT NOT NULL,
        warning_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.700,
        critical_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.500,
        grace_period_runs INTEGER NOT NULL DEFAULT 3,
        immediate_disable BOOLEAN NOT NULL DEFAULT FALSE,
        updated_by TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(scope_type, scope_id, category)
      )
    `);

    // validation_evaluator_drift
    await pool.query(`
      CREATE TABLE IF NOT EXISTS validation_evaluator_drift (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES validation_runs(id),
        calibration_scenario_id TEXT NOT NULL,
        expected_score NUMERIC(4,3) NOT NULL,
        actual_score NUMERIC(4,3) NOT NULL,
        drift_magnitude NUMERIC(4,3) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    this.initialized = true;
  }

  // -------------------------------------------------------------------------
  // Runs
  // -------------------------------------------------------------------------

  async createRun(triggeredBy: string): Promise<TestRunRow> {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO validation_runs (triggered_by)
       VALUES ($1)
       RETURNING *`,
      [triggeredBy],
    );
    return rowToTestRun(rows[0] as Record<string, unknown>);
  }

  async completeRun(
    runId: string,
    status: 'completed' | 'failed',
    totalAgents: number,
    totalScenarios: number,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE validation_runs
       SET completed_at = NOW(), status = $2, total_agents = $3, total_scenarios = $4
       WHERE id = $1`,
      [runId, status, totalAgents, totalScenarios],
    );
  }

  async getRecentRuns(limit = 20): Promise<TestRunRow[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM validation_runs ORDER BY started_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => rowToTestRun(r as Record<string, unknown>));
  }

  // -------------------------------------------------------------------------
  // Results
  // -------------------------------------------------------------------------

  async insertResult(
    result: Omit<TestResultRow, 'id' | 'created_at'>,
  ): Promise<TestResultRow> {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO validation_results
         (run_id, agent_id, scenario_id, category,
          functional_score, llm_judge_score, combined_score, disagreement,
          input_snapshot, output_snapshot, expected_snapshot, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        result.run_id,
        result.agent_id,
        result.scenario_id,
        result.category,
        result.functional_score,
        result.llm_judge_score,
        result.combined_score,
        result.disagreement,
        JSON.stringify(result.input_snapshot),
        JSON.stringify(result.output_snapshot),
        JSON.stringify(result.expected_snapshot),
        result.details ? JSON.stringify(result.details) : null,
      ],
    );
    return rowToTestResult(rows[0] as Record<string, unknown>);
  }

  async getRunResults(runId: string): Promise<TestResultRow[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM validation_results WHERE run_id = $1 ORDER BY created_at`,
      [runId],
    );
    return rows.map((r) => rowToTestResult(r as Record<string, unknown>));
  }

  // -------------------------------------------------------------------------
  // Agent scores
  // -------------------------------------------------------------------------

  async insertAgentScore(
    score: Omit<ValidationAgentScoreRow, 'id' | 'created_at'>,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO validation_agent_scores
         (run_id, agent_id, category, avg_score, min_score, max_score, scenario_count, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        score.run_id,
        score.agent_id,
        score.category,
        score.avg_score,
        score.min_score,
        score.max_score,
        score.scenario_count,
        score.status,
      ],
    );
  }

  async getAgentScoreHistory(
    agentId: string,
    category: string,
    limit = 20,
  ): Promise<ValidationAgentScoreRow[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM validation_agent_scores
       WHERE agent_id = $1 AND category = $2
       ORDER BY created_at DESC LIMIT $3`,
      [agentId, category, limit],
    );
    return rows.map((r) => rowToAgentScore(r as Record<string, unknown>));
  }

  async getLatestAgentScores(
    agentId: string,
  ): Promise<ValidationAgentScoreRow[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (category) *
       FROM validation_agent_scores
       WHERE agent_id = $1
       ORDER BY category, created_at DESC`,
      [agentId],
    );
    return rows.map((r) => rowToAgentScore(r as Record<string, unknown>));
  }

  async getAllLatestScores(): Promise<ValidationAgentScoreRow[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (agent_id, category) *
       FROM validation_agent_scores
       ORDER BY agent_id, category, created_at DESC`,
    );
    return rows.map((r) => rowToAgentScore(r as Record<string, unknown>));
  }

  // -------------------------------------------------------------------------
  // Circuit breaker events
  // -------------------------------------------------------------------------

  async insertCircuitEvent(
    event: Omit<CircuitBreakerEventRow, 'id' | 'created_at'>,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO validation_circuit_events
         (agent_id, category, event_type, previous_state, new_state,
          triggered_by, justification, run_id, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        event.agent_id,
        event.category,
        event.event_type,
        event.previous_state,
        event.new_state,
        event.triggered_by,
        event.justification,
        event.run_id,
        event.details ? JSON.stringify(event.details) : null,
      ],
    );
  }

  async getCircuitEvents(
    agentId: string,
    limit = 20,
  ): Promise<CircuitBreakerEventRow[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM validation_circuit_events
       WHERE agent_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [agentId, limit],
    );
    return rows.map((r) => rowToCircuitEvent(r as Record<string, unknown>));
  }

  // -------------------------------------------------------------------------
  // Thresholds
  // -------------------------------------------------------------------------

  async getThresholds(
    scopeType?: string,
    scopeId?: string,
  ): Promise<ThresholdConfigRow[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (scopeType) {
      params.push(scopeType);
      conditions.push(`scope_type = $${params.length}`);
    }
    if (scopeId) {
      params.push(scopeId);
      conditions.push(`scope_id = $${params.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM validation_thresholds ${where} ORDER BY updated_at DESC`,
      params,
    );
    return rows.map((r) => rowToThreshold(r as Record<string, unknown>));
  }

  async upsertThreshold(
    threshold: Omit<ThresholdConfigRow, 'id' | 'updated_at'>,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO validation_thresholds
         (scope_type, scope_id, category, warning_threshold,
          critical_threshold, grace_period_runs, immediate_disable, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (scope_type, scope_id, category)
       DO UPDATE SET
         warning_threshold = EXCLUDED.warning_threshold,
         critical_threshold = EXCLUDED.critical_threshold,
         grace_period_runs = EXCLUDED.grace_period_runs,
         immediate_disable = EXCLUDED.immediate_disable,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        threshold.scope_type,
        threshold.scope_id,
        threshold.category,
        threshold.warning_threshold,
        threshold.critical_threshold,
        threshold.grace_period_runs,
        threshold.immediate_disable,
        threshold.updated_by,
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Evaluator drift
  // -------------------------------------------------------------------------

  async insertEvaluatorDrift(
    drift: Omit<EvaluatorDriftRow, 'id' | 'created_at'>,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO validation_evaluator_drift
         (run_id, calibration_scenario_id, expected_score, actual_score, drift_magnitude)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        drift.run_id,
        drift.calibration_scenario_id,
        drift.expected_score,
        drift.actual_score,
        drift.drift_magnitude,
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Dashboard aggregate
  // -------------------------------------------------------------------------

  async getDashboardSummaries(): Promise<ValidationDashboardSummary[]> {
    const pool = getPool();

    // Get latest scores per agent per category with last 20 trend points
    const { rows: scoreRows } = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (agent_id, category)
          agent_id, category, avg_score, status, created_at
        FROM validation_agent_scores
        ORDER BY agent_id, category, created_at DESC
      ),
      trends AS (
        SELECT agent_id, category,
          array_agg(avg_score ORDER BY created_at DESC) AS trend_scores
        FROM (
          SELECT agent_id, category, avg_score, created_at,
            ROW_NUMBER() OVER (PARTITION BY agent_id, category ORDER BY created_at DESC) AS rn
          FROM validation_agent_scores
        ) sub
        WHERE rn <= 20
        GROUP BY agent_id, category
      ),
      last_run AS (
        SELECT DISTINCT ON (vr.agent_id) vr.agent_id, r.started_at, r.total_scenarios
        FROM validation_results vr
        JOIN validation_runs r ON r.id = vr.run_id
        ORDER BY vr.agent_id, r.started_at DESC
      )
      SELECT
        l.agent_id,
        l.category,
        l.avg_score,
        l.status,
        COALESCE(t.trend_scores, ARRAY[]::numeric[]) AS trend_scores,
        lr.started_at AS last_run_at,
        COALESCE(lr.total_scenarios, 0) AS scenario_count
      FROM latest l
      -- Only include agents that still exist in agents_v2
      INNER JOIN agents_v2 a ON a.agent_id = l.agent_id
      LEFT JOIN trends t ON t.agent_id = l.agent_id AND t.category = l.category
      LEFT JOIN last_run lr ON lr.agent_id = l.agent_id
      ORDER BY l.agent_id, l.category
    `);

    // Group by agent
    const agentMap = new Map<
      string,
      {
        categories: Record<
          string,
          { avgScore: number; status: string; trend: number[] }
        >;
        lastRunAt: string | null;
        scenarioCount: number;
      }
    >();

    for (const row of scoreRows) {
      const r = row as Record<string, unknown>;
      const agentId = r.agent_id as string;
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          categories: {},
          lastRunAt: r.last_run_at
            ? (r.last_run_at as Date).toISOString()
            : null,
          scenarioCount: Number(r.scenario_count),
        });
      }
      const entry = agentMap.get(agentId)!;
      const category = r.category as string;
      const trendScores = r.trend_scores as number[];
      entry.categories[category] = {
        avgScore: Number(r.avg_score),
        status: r.status as string,
        trend: trendScores.map(Number),
      };
    }

    // Build summaries (agent name/role resolved by caller or populated with IDs)
    const summaries: ValidationDashboardSummary[] = [];
    const agentEntries = Array.from(agentMap.entries());
    for (const [agentId, data] of agentEntries) {
      // Determine overall status: worst of all categories
      const catValues = Object.values(data.categories) as Array<{ avgScore: number; status: string; trend: number[] }>;
      const statuses = catValues.map((c) => c.status);
      const overallStatus = deriveOverallStatus(statuses);

      summaries.push({
        agentId,
        agentName: agentId, // Caller enriches with agent registry data
        agentRole: '',
        overallStatus,
        categories: data.categories as ValidationDashboardSummary['categories'],
        lastRunAt: data.lastRunAt,
        scenarioCount: data.scenarioCount,
      });
    }

    // Include agents registered in agents_v2 but without any validation scores
    const { rows: unvalidatedRows } = await pool.query(`
      SELECT a.agent_id
      FROM agents_v2 a
      LEFT JOIN (SELECT DISTINCT agent_id FROM validation_agent_scores) v
        ON a.agent_id = v.agent_id
      WHERE v.agent_id IS NULL
      ORDER BY a.agent_id
    `);

    for (const row of unvalidatedRows) {
      summaries.push({
        agentId: (row as Record<string, unknown>).agent_id as string,
        agentName: (row as Record<string, unknown>).agent_id as string,
        agentRole: '',
        overallStatus: 'not_validated',
        categories: {} as ValidationDashboardSummary['categories'],
        lastRunAt: null,
        scenarioCount: 0,
      });
    }

    return summaries;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_SEVERITY: Record<string, number> = {
  disabled: 4,
  critical: 3,
  warning: 2,
  unknown: 1,
  passing: 0,
};

function deriveOverallStatus(statuses: string[]): ValidationStatus {
  if (statuses.length === 0) return 'unknown' as ValidationStatus;
  let worst = 'passing';
  for (const s of statuses) {
    if ((STATUS_SEVERITY[s] ?? 0) > (STATUS_SEVERITY[worst] ?? 0)) {
      worst = s;
    }
  }
  return worst as ValidationStatus;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const validationStore = new ValidationStore();
