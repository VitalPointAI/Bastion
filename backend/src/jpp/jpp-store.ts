/**
 * JPP Store
 *
 * Phase 33 Plan 01: PostgreSQL CRUD for JPP instances and step products.
 * Follows singleton + ensureInitialized() pattern from planStore.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import { JPP_STEPS } from './types.js';
import type {
  JPPInstance,
  JPPStepProduct,
  JPPStepId,
  JPPEchelon,
  JPPStatus,
  StepStatus,
  StepProductStatus,
} from './types.js';

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToInstance(row: Record<string, any>): JPPInstance {
  return {
    id: row.id,
    problemSetId: row.problem_set_id,
    parentJppId: row.parent_jpp_id ?? null,
    echelon: row.echelon as JPPEchelon,
    currentStep: row.current_step as JPPStepId,
    stepStatuses: row.step_statuses as Record<JPPStepId, StepStatus>,
    status: row.status as JPPStatus,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProduct(row: Record<string, any>): JPPStepProduct {
  return {
    id: row.id,
    jppInstanceId: row.jpp_instance_id,
    step: row.step as JPPStepId,
    roleId: row.role_id,
    content: row.content ?? {},
    aiDraftedBy: row.ai_drafted_by ?? null,
    reviewedBy: row.reviewed_by ?? null,
    status: row.status as StepProductStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Default step statuses (all 7 steps start not_started)
// ---------------------------------------------------------------------------

function defaultStepStatuses(): Record<JPPStepId, StepStatus> {
  const statuses = {} as Record<JPPStepId, StepStatus>;
  for (const step of JPP_STEPS) {
    statuses[step] = 'not_started';
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// JPP Store
// ---------------------------------------------------------------------------

class JPPStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS jpp_instances (
        id TEXT PRIMARY KEY,
        problem_set_id TEXT NOT NULL,
        parent_jpp_id TEXT,
        echelon TEXT NOT NULL DEFAULT 'operational',
        current_step TEXT NOT NULL DEFAULT 'planning_initiation',
        step_statuses JSONB NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_jpp_instances_problem_set
        ON jpp_instances(problem_set_id);

      CREATE TABLE IF NOT EXISTS jpp_step_products (
        id TEXT PRIMARY KEY,
        jpp_instance_id TEXT NOT NULL,
        step TEXT NOT NULL,
        role_id TEXT,
        content JSONB DEFAULT '{}',
        ai_drafted_by TEXT,
        reviewed_by TEXT,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_jpp_step_products_instance_step
        ON jpp_step_products(jpp_instance_id, step);
    `);
    this.initialized = true;
  }

  // -------------------------------------------------------------------------
  // JPP Instance CRUD
  // -------------------------------------------------------------------------

  async createInstance(data: {
    problemSetId: string;
    parentJppId?: string | null;
    echelon?: JPPEchelon;
    createdBy: string;
  }): Promise<JPPInstance> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `JPP-${randomUUID()}`;
    const now = new Date();
    const stepStatuses = defaultStepStatuses();

    await pool.query(
      `INSERT INTO jpp_instances
         (id, problem_set_id, parent_jpp_id, echelon, current_step, step_statuses, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        data.problemSetId,
        data.parentJppId ?? null,
        data.echelon ?? 'operational',
        'planning_initiation',
        JSON.stringify(stepStatuses),
        'active',
        data.createdBy,
        now,
        now,
      ],
    );

    const result = await pool.query('SELECT * FROM jpp_instances WHERE id = $1', [id]);
    return rowToInstance(result.rows[0]);
  }

  async getInstance(id: string): Promise<JPPInstance | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query('SELECT * FROM jpp_instances WHERE id = $1', [id]);
    return result.rows[0] ? rowToInstance(result.rows[0]) : null;
  }

  /**
   * Get the active JPP instance for a problem set.
   * Auto-creates one if none exists (project convention).
   */
  async getInstanceByProblemSet(
    problemSetId: string,
    createdBy = 'system',
  ): Promise<JPPInstance> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM jpp_instances
       WHERE problem_set_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [problemSetId],
    );

    if (result.rows[0]) {
      return rowToInstance(result.rows[0]);
    }

    // Auto-create
    return this.createInstance({ problemSetId, createdBy });
  }

  async updateStepStatus(
    instanceId: string,
    step: JPPStepId,
    status: StepStatus,
  ): Promise<JPPInstance | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      `UPDATE jpp_instances
       SET current_step = $1,
           step_statuses = jsonb_set(step_statuses, $2, $3),
           updated_at = $4
       WHERE id = $5`,
      [step, `{${step}}`, JSON.stringify(status), now, instanceId],
    );

    return this.getInstance(instanceId);
  }

  async getChildInstances(parentJppId: string): Promise<JPPInstance[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM jpp_instances
       WHERE parent_jpp_id = $1
       ORDER BY created_at ASC`,
      [parentJppId],
    );
    return result.rows.map(rowToInstance);
  }

  // -------------------------------------------------------------------------
  // Step Products
  // -------------------------------------------------------------------------

  async getStepProducts(instanceId: string, step: JPPStepId): Promise<JPPStepProduct[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM jpp_step_products
       WHERE jpp_instance_id = $1 AND step = $2
       ORDER BY created_at ASC`,
      [instanceId, step],
    );
    return result.rows.map(rowToProduct);
  }

  async saveStepProduct(product: {
    id?: string;
    jppInstanceId: string;
    step: JPPStepId;
    roleId: string;
    content: Record<string, unknown>;
    aiDraftedBy?: string | null;
    reviewedBy?: string | null;
    status?: StepProductStatus;
  }): Promise<JPPStepProduct> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = product.id ?? `SP-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO jpp_step_products
         (id, jpp_instance_id, step, role_id, content, ai_drafted_by, reviewed_by, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         content = EXCLUDED.content,
         ai_drafted_by = EXCLUDED.ai_drafted_by,
         reviewed_by = EXCLUDED.reviewed_by,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        id,
        product.jppInstanceId,
        product.step,
        product.roleId,
        JSON.stringify(product.content),
        product.aiDraftedBy ?? null,
        product.reviewedBy ?? null,
        product.status ?? 'draft',
        now,
        now,
      ],
    );

    const result = await pool.query('SELECT * FROM jpp_step_products WHERE id = $1', [id]);
    return rowToProduct(result.rows[0]);
  }
}

export const jppStore = new JPPStore();
