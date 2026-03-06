/**
 * Problem Set Escalation Store
 *
 * Phase 23: Problem Set Model & Workspace Rename
 *
 * Manages per-problem-set escalation rules — configurable triggers that determine when
 * and how decisions are automatically routed to parent problem sets (DAO proposals).
 * Rules define: which proposal kinds trigger escalation, threshold conditions, and
 * whether to use autocratic (single commander) or democratic (multi-vote) resolution.
 *
 * Table: problem_set_escalation_rules
 * ID format: PER-{uuid}
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initProblemSetEscalationTable(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_escalation_rules (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      rule_type TEXT NOT NULL,
      proposal_kind TEXT NOT NULL,
      threshold_config JSONB,
      voting_mechanism TEXT NOT NULL DEFAULT 'democratic',
      auto_route_to TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_per_problem_set ON problem_set_escalation_rules(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_per_kind ON problem_set_escalation_rules(problem_set_id, proposal_kind);
    CREATE INDEX IF NOT EXISTS idx_per_active ON problem_set_escalation_rules(problem_set_id, is_active);
  `);
}

// ============================================================================
// Types
// ============================================================================

export interface EscalationRule {
  id: string;
  problemSetId: string;
  /** Rule category, e.g. 'threshold', 'manual', 'resource', 'roe' */
  ruleType: string;
  /** The proposal kind this rule applies to, e.g. 'fire_mission', 'resource_request', 'roe_change' */
  proposalKind: string;
  /**
   * Optional JSON threshold conditions, e.g.:
   * { "min_resource_value": 50000 } or { "auto_escalate_after_hours": 2 }
   */
  thresholdConfig: Record<string, unknown> | null;
  /** 'autocratic' = routes to single commander; 'democratic' = requires multi-vote */
  votingMechanism: 'autocratic' | 'democratic';
  /** Optional: ID of the problem set or DAO to auto-route escalated decisions to */
  autoRouteTo: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateEscalationRuleInput {
  problemSetId: string;
  ruleType: string;
  proposalKind: string;
  thresholdConfig?: Record<string, unknown> | null;
  votingMechanism?: 'autocratic' | 'democratic';
  autoRouteTo?: string | null;
}

export interface UpdateEscalationRuleInput {
  ruleType?: string;
  proposalKind?: string;
  thresholdConfig?: Record<string, unknown> | null;
  votingMechanism?: 'autocratic' | 'democratic';
  autoRouteTo?: string | null;
  isActive?: boolean;
}

interface EscalationRuleRow {
  id: string;
  problem_set_id: string;
  rule_type: string;
  proposal_kind: string;
  threshold_config: Record<string, unknown> | null;
  voting_mechanism: string;
  auto_route_to: string | null;
  is_active: boolean;
  created_at: Date;
}

// ============================================================================
// Problem Set Escalation Store
// ============================================================================

export class ProblemSetEscalationStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initProblemSetEscalationTable();
      this.initialized = true;
    }
  }

  private mapRow(row: EscalationRuleRow): EscalationRule {
    return {
      id: row.id,
      problemSetId: row.problem_set_id,
      ruleType: row.rule_type,
      proposalKind: row.proposal_kind,
      thresholdConfig: row.threshold_config,
      votingMechanism: row.voting_mechanism as EscalationRule['votingMechanism'],
      autoRouteTo: row.auto_route_to,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Create a new escalation rule for a problem set.
   */
  async createRule(input: CreateEscalationRuleInput): Promise<EscalationRule> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `PER-${randomUUID()}`;

    const result = await pool.query(
      `
      INSERT INTO problem_set_escalation_rules (
        id, problem_set_id, rule_type, proposal_kind,
        threshold_config, voting_mechanism, auto_route_to, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
      RETURNING *
      `,
      [
        id,
        input.problemSetId,
        input.ruleType,
        input.proposalKind,
        input.thresholdConfig ? JSON.stringify(input.thresholdConfig) : null,
        input.votingMechanism ?? 'democratic',
        input.autoRouteTo ?? null,
      ],
    );

    return this.mapRow(result.rows[0] as EscalationRuleRow);
  }

  /**
   * List all escalation rules for a problem set (active and inactive).
   */
  async listRulesForProblemSet(problemSetId: string): Promise<EscalationRule[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM problem_set_escalation_rules WHERE problem_set_id = $1 ORDER BY created_at ASC',
      [problemSetId],
    );

    return result.rows.map((row) => this.mapRow(row as EscalationRuleRow));
  }

  /**
   * Get active escalation rules for a specific proposal kind within a problem set.
   * Used at decision-submit time to determine if auto-escalation should trigger.
   */
  async getRulesForKind(problemSetId: string, proposalKind: string): Promise<EscalationRule[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT * FROM problem_set_escalation_rules
      WHERE problem_set_id = $1 AND proposal_kind = $2 AND is_active = true
      ORDER BY created_at ASC
      `,
      [problemSetId, proposalKind],
    );

    return result.rows.map((row) => this.mapRow(row as EscalationRuleRow));
  }

  /**
   * Update an escalation rule's configuration. Only provided fields are changed.
   */
  async updateRule(id: string, updates: UpdateEscalationRuleInput): Promise<EscalationRule> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.ruleType !== undefined) {
      setClauses.push(`rule_type = $${paramIndex++}`);
      values.push(updates.ruleType);
    }
    if (updates.proposalKind !== undefined) {
      setClauses.push(`proposal_kind = $${paramIndex++}`);
      values.push(updates.proposalKind);
    }
    if (updates.thresholdConfig !== undefined) {
      setClauses.push(`threshold_config = $${paramIndex++}`);
      values.push(updates.thresholdConfig ? JSON.stringify(updates.thresholdConfig) : null);
    }
    if (updates.votingMechanism !== undefined) {
      setClauses.push(`voting_mechanism = $${paramIndex++}`);
      values.push(updates.votingMechanism);
    }
    if (updates.autoRouteTo !== undefined) {
      setClauses.push(`auto_route_to = $${paramIndex++}`);
      values.push(updates.autoRouteTo);
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (setClauses.length === 0) {
      const rules = await this.listRulesForProblemSet('');
      const existing = rules.find((r) => r.id === id);
      if (!existing) throw new Error(`Escalation rule not found: ${id}`);
      return existing;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE problem_set_escalation_rules SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new Error(`Escalation rule not found: ${id}`);
    }

    return this.mapRow(result.rows[0] as EscalationRuleRow);
  }

  /**
   * Delete an escalation rule. No-op if rule does not exist.
   */
  async deleteRule(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query('DELETE FROM problem_set_escalation_rules WHERE id = $1', [id]);
  }
}

// Singleton export
export const problemSetEscalationStore = new ProblemSetEscalationStore();
