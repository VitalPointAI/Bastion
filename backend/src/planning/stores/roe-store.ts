/**
 * Rules of Engagement (ROE) Store
 *
 * Phase 05 Plan 01: ROE rule management and override tracking
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import type {
  ROERule,
  ROEOverride,
  CreateROERuleInput,
  UpdateROERuleInput,
  CreateROEOverrideInput
} from '../types.js';

/**
 * Initialize ROE tables
 */
async function initROETables(): Promise<void> {
  const pool = getPool();

  // ROE rules table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roe_rules (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      conditions JSONB NOT NULL,
      event JSONB NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_roe_mission ON roe_rules(mission_id);
    CREATE INDEX IF NOT EXISTS idx_roe_category ON roe_rules(category);
    CREATE INDEX IF NOT EXISTS idx_roe_active ON roe_rules(mission_id, active);
  `);

  // ROE overrides table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roe_overrides (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      action_context JSONB NOT NULL,
      violations TEXT[] NOT NULL,
      justification TEXT NOT NULL,
      commander_did TEXT NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL,
      blockchain_tx_hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_overrides_plan ON roe_overrides(plan_id);
    CREATE INDEX IF NOT EXISTS idx_overrides_rule ON roe_overrides(rule_id);
    CREATE INDEX IF NOT EXISTS idx_overrides_commander ON roe_overrides(commander_did);
    CREATE INDEX IF NOT EXISTS idx_overrides_approved ON roe_overrides(approved_at DESC);
  `);
}

/**
 * Helper to convert database row to ROERule
 */
function rowToRule(row: any): ROERule {
  return {
    id: row.id,
    missionId: row.mission_id,
    name: row.name,
    description: row.description,
    category: row.category,
    conditions: row.conditions,
    event: row.event,
    active: row.active,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/**
 * Helper to convert database row to ROEOverride
 */
function rowToOverride(row: any): ROEOverride {
  return {
    id: row.id,
    planId: row.plan_id,
    ruleId: row.rule_id,
    actionContext: row.action_context,
    violations: row.violations,
    justification: row.justification,
    commanderDID: row.commander_did,
    approvedAt: new Date(row.approved_at),
    blockchainTxHash: row.blockchain_tx_hash
  };
}

/**
 * ROE Store singleton
 */
class ROEStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initROETables();
    this.initialized = true;
  }

  /**
   * Create a new ROE rule
   */
  async createRule(input: CreateROERuleInput, createdBy: string): Promise<ROERule> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `ROE-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `
      INSERT INTO roe_rules (
        id, mission_id, name, description, category, conditions, event,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        id,
        input.missionId,
        input.name,
        input.description,
        input.category,
        JSON.stringify(input.conditions),
        JSON.stringify(input.event),
        createdBy,
        now,
        now
      ]
    );

    const result = await pool.query('SELECT * FROM roe_rules WHERE id = $1', [id]);
    return rowToRule(result.rows[0]);
  }

  /**
   * Find ROE rule by ID
   */
  async findRuleById(id: string): Promise<ROERule | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM roe_rules WHERE id = $1', [id]);
    return result.rows[0] ? rowToRule(result.rows[0]) : null;
  }

  /**
   * Find all ROE rules for a mission
   */
  async findRulesByMission(missionId: string): Promise<ROERule[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM roe_rules WHERE mission_id = $1 ORDER BY created_at DESC',
      [missionId]
    );
    return result.rows.map(rowToRule);
  }

  /**
   * Find active ROE rules for a mission
   */
  async findActiveRulesByMission(missionId: string): Promise<ROERule[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM roe_rules WHERE mission_id = $1 AND active = TRUE ORDER BY created_at DESC',
      [missionId]
    );
    return result.rows.map(rowToRule);
  }

  /**
   * Update ROE rule
   */
  async updateRule(id: string, updates: UpdateROERuleInput): Promise<ROERule> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    const setClauses: string[] = ['updated_at = $1'];
    const values: any[] = [now];
    let paramIndex = 2;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.conditions !== undefined) {
      setClauses.push(`conditions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.conditions));
    }
    if (updates.event !== undefined) {
      setClauses.push(`event = $${paramIndex++}`);
      values.push(JSON.stringify(updates.event));
    }
    if (updates.active !== undefined) {
      setClauses.push(`active = $${paramIndex++}`);
      values.push(updates.active);
    }

    values.push(id);

    await pool.query(
      `UPDATE roe_rules SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const result = await pool.query('SELECT * FROM roe_rules WHERE id = $1', [id]);
    return rowToRule(result.rows[0]);
  }

  /**
   * Deactivate ROE rule
   */
  async deactivateRule(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      'UPDATE roe_rules SET active = FALSE, updated_at = $1 WHERE id = $2',
      [now, id]
    );
  }

  /**
   * Delete ROE rule
   */
  async deleteRule(id: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();
    await pool.query('DELETE FROM roe_rules WHERE id = $1', [id]);
  }

  /**
   * Create ROE override
   */
  async createOverride(input: CreateROEOverrideInput): Promise<ROEOverride> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `OVR-${randomUUID()}`;

    // Validate justification is not empty or whitespace-only
    if (!input.justification || input.justification.trim().length === 0) {
      throw new Error('ROE override justification cannot be empty');
    }

    // Validate DID format (basic check for did:near: prefix)
    if (!input.commanderDID.startsWith('did:near:')) {
      throw new Error('Invalid commander DID format - must start with did:near:');
    }

    await pool.query(
      `
      INSERT INTO roe_overrides (
        id, plan_id, rule_id, action_context, violations,
        justification, commander_did, approved_at, blockchain_tx_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        id,
        input.planId,
        input.ruleId,
        JSON.stringify(input.actionContext),
        input.violations,
        input.justification,
        input.commanderDID,
        new Date(),
        input.blockchainTxHash
      ]
    );

    const result = await pool.query('SELECT * FROM roe_overrides WHERE id = $1', [id]);
    return rowToOverride(result.rows[0]);
  }

  /**
   * Find all overrides for a plan
   */
  async findOverridesByPlan(planId: string): Promise<ROEOverride[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM roe_overrides WHERE plan_id = $1 ORDER BY approved_at DESC',
      [planId]
    );
    return result.rows.map(rowToOverride);
  }

  /**
   * Find all overrides for a specific rule
   */
  async findOverridesByRule(ruleId: string): Promise<ROEOverride[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM roe_overrides WHERE rule_id = $1 ORDER BY approved_at DESC',
      [ruleId]
    );
    return result.rows.map(rowToOverride);
  }
}

export const roeStore = new ROEStore();
