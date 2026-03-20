/**
 * Cost Store
 *
 * Persistent storage for cost ledger entries with aggregation queries.
 * Records LLM token costs and NEAR blockchain costs with full attribution.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CostType = 'llm' | 'near_gas' | 'near_storage';

export interface CostEntry {
  id: string;
  created_at: string;
  cost_type: CostType;
  actor_did: string | null;
  agent_id: string | null;
  problem_set_id: string | null;
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  near_gas_burned: string | null;
  near_deposit: string | null;
  cost_usd: number;
  operation: string | null;
  metadata: Record<string, unknown>;
}

export interface RecordLLMCostInput {
  actorDid?: string;
  agentId?: string;
  problemSetId?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordNEARCostInput {
  costType: 'near_gas' | 'near_storage';
  actorDid?: string;
  agentId?: string;
  problemSetId?: string;
  gasBurned?: bigint;
  deposit?: bigint;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface CostSummary {
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEntries: number;
  byType: Array<{ costType: string; costUsd: number; count: number }>;
  byAgent: Array<{ agentId: string; costUsd: number; count: number }>;
  byModel: Array<{ modelId: string; costUsd: number; inputTokens: number; outputTokens: number }>;
  byDay: Array<{ date: string; costUsd: number; count: number }>;
}

export interface CostQueryFilter {
  startDate?: string;
  endDate?: string;
  costType?: CostType;
  agentId?: string;
  actorDid?: string;
  problemSetId?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

class CostStore {
  /**
   * Record an LLM token usage cost entry.
   * Looks up model pricing to compute USD cost.
   */
  async recordLLMCost(input: RecordLLMCostInput): Promise<CostEntry> {
    const pool = getPool();
    const id = randomUUID();

    // Look up model pricing
    let costUsd = 0;
    try {
      const pricing = await pool.query(
        'SELECT input_price_per_million, output_price_per_million FROM model_pricing WHERE model_id = $1',
        [input.modelId],
      );
      if (pricing.rows[0]) {
        const { input_price_per_million, output_price_per_million } = pricing.rows[0];
        costUsd =
          (input.inputTokens / 1_000_000) * parseFloat(input_price_per_million) +
          (input.outputTokens / 1_000_000) * parseFloat(output_price_per_million);
      }
    } catch {
      // Pricing lookup failed — record with $0 cost
    }

    const result = await pool.query(
      `INSERT INTO cost_ledger (id, cost_type, actor_did, agent_id, problem_set_id, model_id, input_tokens, output_tokens, cost_usd, operation, metadata)
       VALUES ($1, 'llm', $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, input.actorDid ?? null, input.agentId ?? null, input.problemSetId ?? null,
       input.modelId, input.inputTokens, input.outputTokens, costUsd,
       input.operation ?? null, JSON.stringify(input.metadata ?? {})],
    );

    return result.rows[0];
  }

  /**
   * Record a NEAR blockchain cost entry.
   */
  async recordNEARCost(input: RecordNEARCostInput): Promise<CostEntry> {
    const pool = getPool();
    const id = randomUUID();

    // Approximate NEAR cost in USD (use a rough exchange rate)
    // In production, this would fetch from an oracle or price feed
    const NEAR_USD_RATE = 4.5; // approximate
    const nearAmount = input.deposit
      ? Number(input.deposit) / 1e24 // yoctoNEAR to NEAR
      : 0;
    const costUsd = nearAmount * NEAR_USD_RATE;

    const result = await pool.query(
      `INSERT INTO cost_ledger (id, cost_type, actor_did, agent_id, problem_set_id, near_gas_burned, near_deposit, cost_usd, operation, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, input.costType, input.actorDid ?? null, input.agentId ?? null,
       input.problemSetId ?? null,
       input.gasBurned?.toString() ?? null, input.deposit?.toString() ?? null,
       costUsd, input.operation ?? null, JSON.stringify(input.metadata ?? {})],
    );

    return result.rows[0];
  }

  /**
   * Query cost ledger entries with filters.
   */
  async query(filter: CostQueryFilter): Promise<{ entries: CostEntry[]; total: number }> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter.startDate) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`created_at <= $${paramIdx++}`);
      params.push(filter.endDate);
    }
    if (filter.costType) {
      conditions.push(`cost_type = $${paramIdx++}`);
      params.push(filter.costType);
    }
    if (filter.agentId) {
      conditions.push(`agent_id = $${paramIdx++}`);
      params.push(filter.agentId);
    }
    if (filter.actorDid) {
      conditions.push(`actor_did = $${paramIdx++}`);
      params.push(filter.actorDid);
    }
    if (filter.problemSetId) {
      conditions.push(`problem_set_id = $${paramIdx++}`);
      params.push(filter.problemSetId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    const [entries, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM cost_ledger ${where} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
        [...params, limit, offset],
      ),
      pool.query(`SELECT COUNT(*) as count FROM cost_ledger ${where}`, params),
    ]);

    return {
      entries: entries.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get aggregated cost summary.
   */
  async getSummary(filter?: { startDate?: string; endDate?: string; problemSetId?: string }): Promise<CostSummary> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter?.startDate) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(filter.startDate);
    }
    if (filter?.endDate) {
      conditions.push(`created_at <= $${paramIdx++}`);
      params.push(filter.endDate);
    }
    if (filter?.problemSetId) {
      conditions.push(`problem_set_id = $${paramIdx}`);
      params.push(filter.problemSetId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [totals, byType, byAgent, byModel, byDay] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(cost_usd), 0) as total_cost, COALESCE(SUM(input_tokens), 0) as total_input, COALESCE(SUM(output_tokens), 0) as total_output, COUNT(*) as total_entries FROM cost_ledger ${where}`,
        params,
      ),
      pool.query(
        `SELECT cost_type, COALESCE(SUM(cost_usd), 0) as cost_usd, COUNT(*) as count FROM cost_ledger ${where} GROUP BY cost_type ORDER BY cost_usd DESC`,
        params,
      ),
      pool.query(
        `SELECT COALESCE(agent_id, 'user') as agent_id, COALESCE(SUM(cost_usd), 0) as cost_usd, COUNT(*) as count FROM cost_ledger ${where} GROUP BY agent_id ORDER BY cost_usd DESC LIMIT 20`,
        params,
      ),
      pool.query(
        `SELECT COALESCE(model_id, 'unknown') as model_id, COALESCE(SUM(cost_usd), 0) as cost_usd, COALESCE(SUM(input_tokens), 0) as input_tokens, COALESCE(SUM(output_tokens), 0) as output_tokens FROM cost_ledger ${where} AND cost_type = 'llm' GROUP BY model_id ORDER BY cost_usd DESC`,
        params,
      ).catch(() => ({ rows: [] })), // May fail if no LLM entries
      pool.query(
        `SELECT DATE(created_at) as date, COALESCE(SUM(cost_usd), 0) as cost_usd, COUNT(*) as count FROM cost_ledger ${where} GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
        params,
      ),
    ]);

    const t = totals.rows[0];
    return {
      totalCostUsd: parseFloat(t.total_cost),
      totalInputTokens: parseInt(t.total_input, 10),
      totalOutputTokens: parseInt(t.total_output, 10),
      totalEntries: parseInt(t.total_entries, 10),
      byType: byType.rows.map((r) => ({
        costType: r.cost_type,
        costUsd: parseFloat(r.cost_usd),
        count: parseInt(r.count, 10),
      })),
      byAgent: byAgent.rows.map((r) => ({
        agentId: r.agent_id,
        costUsd: parseFloat(r.cost_usd),
        count: parseInt(r.count, 10),
      })),
      byModel: byModel.rows.map((r) => ({
        modelId: r.model_id,
        costUsd: parseFloat(r.cost_usd),
        inputTokens: parseInt(r.input_tokens, 10),
        outputTokens: parseInt(r.output_tokens, 10),
      })),
      byDay: byDay.rows.map((r) => ({
        date: r.date,
        costUsd: parseFloat(r.cost_usd),
        count: parseInt(r.count, 10),
      })),
    };
  }
}

export const costStore = new CostStore();
