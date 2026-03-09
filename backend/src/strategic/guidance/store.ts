/**
 * Strategic Guidance Store
 *
 * Phase 36 Plan 01: PostgreSQL CRUD for strategic guidance instances,
 * step products, directive versions, and force allocations.
 *
 * Follows jpp-store.ts pattern: singleton + ensureInitialized().
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';
import { SG_STEPS } from './types.js';
import type {
  StrategicGuidanceInstance,
  SGStepId,
  SGStatus,
  StepStatus,
  ForceAllocation,
  DirectiveVersion,
  ForceAllocationPriority,
} from './types.js';

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToInstance(row: Record<string, any>): StrategicGuidanceInstance {
  return {
    id: row.id,
    problemSetId: row.problem_set_id,
    stepStatuses: row.step_statuses as Record<SGStepId, StepStatus>,
    currentDirectiveVersion: row.current_directive_version ?? 0,
    status: row.status as SGStatus,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToStepProduct(row: Record<string, any>): {
  id: string;
  instanceId: string;
  step: SGStepId;
  content: Record<string, unknown>;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: row.id,
    instanceId: row.instance_id,
    step: row.step as SGStepId,
    content: row.content ?? {},
    updatedBy: row.updated_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToForceAllocation(row: Record<string, any>): ForceAllocation {
  return {
    id: row.id,
    forceId: row.force_id ?? '',
    forceName: row.force_name,
    forceType: row.force_type,
    isRegistered: row.is_registered ?? false,
    lineOfEffortId: row.line_of_effort_id,
    priority: row.priority as ForceAllocationPriority,
    allocationPct: row.allocation_pct ?? 0,
    notes: row.notes ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDirectiveVersion(row: Record<string, any>): DirectiveVersion {
  return {
    id: row.id,
    instanceId: row.instance_id,
    version: row.version,
    content: row.content ?? {},
    constraints: row.constraints ?? [],
    assumptions: row.assumptions ?? [],
    forceApportionment: row.force_apportionment ?? [],
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    changelog: row.changelog ?? '',
  };
}

// ---------------------------------------------------------------------------
// Default step statuses
// ---------------------------------------------------------------------------

function defaultStepStatuses(): Record<SGStepId, StepStatus> {
  const statuses = {} as Record<SGStepId, StepStatus>;
  for (const step of SG_STEPS) {
    statuses[step] = 'not_started';
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// Strategic Guidance Store
// ---------------------------------------------------------------------------

class StrategicGuidanceStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS strategic_guidance_instances (
        id TEXT PRIMARY KEY,
        problem_set_id TEXT NOT NULL UNIQUE,
        step_statuses JSONB NOT NULL DEFAULT '{}',
        current_directive_version INT DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sg_instances_problem_set
        ON strategic_guidance_instances(problem_set_id);

      CREATE TABLE IF NOT EXISTS strategic_guidance_step_products (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL REFERENCES strategic_guidance_instances(id),
        step TEXT NOT NULL,
        content JSONB DEFAULT '{}',
        updated_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(instance_id, step)
      );

      CREATE INDEX IF NOT EXISTS idx_sg_step_products_instance
        ON strategic_guidance_step_products(instance_id);

      CREATE TABLE IF NOT EXISTS strategic_directive_versions (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL REFERENCES strategic_guidance_instances(id),
        version INT NOT NULL,
        content JSONB,
        constraints JSONB DEFAULT '[]',
        assumptions JSONB DEFAULT '[]',
        force_apportionment JSONB DEFAULT '[]',
        changelog TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(instance_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_sg_directive_versions_instance
        ON strategic_directive_versions(instance_id);

      CREATE TABLE IF NOT EXISTS strategic_force_allocations (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL REFERENCES strategic_guidance_instances(id),
        force_id TEXT,
        force_name TEXT NOT NULL,
        force_type TEXT NOT NULL,
        is_registered BOOLEAN DEFAULT false,
        line_of_effort_id TEXT NOT NULL,
        priority TEXT NOT NULL,
        allocation_pct INT DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sg_force_allocations_instance
        ON strategic_force_allocations(instance_id);
    `);
    this.initialized = true;
  }

  // -------------------------------------------------------------------------
  // Instance CRUD
  // -------------------------------------------------------------------------

  async createInstance(data: {
    problemSetId: string;
    createdBy: string;
  }): Promise<StrategicGuidanceInstance> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `SG-${randomUUID()}`;
    const now = new Date();
    const stepStatuses = defaultStepStatuses();

    await pool.query(
      `INSERT INTO strategic_guidance_instances
         (id, problem_set_id, step_statuses, current_directive_version, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (problem_set_id) DO NOTHING`,
      [
        id,
        data.problemSetId,
        JSON.stringify(stepStatuses),
        0,
        'active',
        data.createdBy,
        now,
        now,
      ],
    );

    // Return existing or newly created
    const result = await pool.query(
      'SELECT * FROM strategic_guidance_instances WHERE problem_set_id = $1',
      [data.problemSetId],
    );
    return rowToInstance(result.rows[0]);
  }

  async getInstanceByProblemSetId(
    problemSetId: string,
  ): Promise<StrategicGuidanceInstance | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_guidance_instances WHERE problem_set_id = $1',
      [problemSetId],
    );
    return result.rows[0] ? rowToInstance(result.rows[0]) : null;
  }

  async getInstanceById(id: string): Promise<StrategicGuidanceInstance | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_guidance_instances WHERE id = $1',
      [id],
    );
    return result.rows[0] ? rowToInstance(result.rows[0]) : null;
  }

  async updateStepStatus(
    instanceId: string,
    step: SGStepId,
    status: StepStatus,
  ): Promise<StrategicGuidanceInstance | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const now = new Date();

    await pool.query(
      `UPDATE strategic_guidance_instances
       SET step_statuses = jsonb_set(step_statuses, $1, $2),
           updated_at = $3
       WHERE id = $4`,
      [`{${step}}`, JSON.stringify(status), now, instanceId],
    );

    return this.getInstanceById(instanceId);
  }

  // -------------------------------------------------------------------------
  // Step Products
  // -------------------------------------------------------------------------

  async getStepProduct(
    instanceId: string,
    step: SGStepId,
  ): Promise<{ id: string; instanceId: string; step: SGStepId; content: Record<string, unknown>; updatedBy: string; createdAt: Date; updatedAt: Date } | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_guidance_step_products WHERE instance_id = $1 AND step = $2',
      [instanceId, step],
    );
    return result.rows[0] ? rowToStepProduct(result.rows[0]) : null;
  }

  async upsertStepProduct(data: {
    instanceId: string;
    step: SGStepId;
    content: Record<string, unknown>;
    updatedBy: string;
  }): Promise<{ id: string; instanceId: string; step: SGStepId; content: Record<string, unknown>; updatedBy: string; createdAt: Date; updatedAt: Date }> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `SGSP-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO strategic_guidance_step_products
         (id, instance_id, step, content, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (instance_id, step) DO UPDATE SET
         content = EXCLUDED.content,
         updated_by = EXCLUDED.updated_by,
         updated_at = EXCLUDED.updated_at`,
      [id, data.instanceId, data.step, JSON.stringify(data.content), data.updatedBy, now, now],
    );

    const result = await pool.query(
      'SELECT * FROM strategic_guidance_step_products WHERE instance_id = $1 AND step = $2',
      [data.instanceId, data.step],
    );
    return rowToStepProduct(result.rows[0]);
  }

  // -------------------------------------------------------------------------
  // Force Allocations
  // -------------------------------------------------------------------------

  async getForceAllocations(instanceId: string): Promise<ForceAllocation[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_force_allocations WHERE instance_id = $1 ORDER BY created_at ASC',
      [instanceId],
    );
    return result.rows.map(rowToForceAllocation);
  }

  async upsertForceAllocation(
    instanceId: string,
    data: Partial<ForceAllocation> & { forceName: string; forceType: string; lineOfEffortId: string; priority: ForceAllocationPriority },
  ): Promise<ForceAllocation> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = data.id ?? `SGFA-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO strategic_force_allocations
         (id, instance_id, force_id, force_name, force_type, is_registered, line_of_effort_id, priority, allocation_pct, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         force_id = EXCLUDED.force_id,
         force_name = EXCLUDED.force_name,
         force_type = EXCLUDED.force_type,
         is_registered = EXCLUDED.is_registered,
         line_of_effort_id = EXCLUDED.line_of_effort_id,
         priority = EXCLUDED.priority,
         allocation_pct = EXCLUDED.allocation_pct,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at`,
      [
        id,
        instanceId,
        data.forceId ?? '',
        data.forceName,
        data.forceType,
        data.isRegistered ?? false,
        data.lineOfEffortId,
        data.priority,
        data.allocationPct ?? 0,
        data.notes ?? '',
        now,
        now,
      ],
    );

    const result = await pool.query(
      'SELECT * FROM strategic_force_allocations WHERE id = $1',
      [id],
    );
    return rowToForceAllocation(result.rows[0]);
  }

  async deleteForceAllocation(instanceId: string, allocationId: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM strategic_force_allocations WHERE id = $1 AND instance_id = $2',
      [allocationId, instanceId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // -------------------------------------------------------------------------
  // Directive Versions
  // -------------------------------------------------------------------------

  async createDirectiveVersion(data: {
    instanceId: string;
    version: number;
    content: Record<string, unknown>;
    constraints?: unknown[];
    assumptions?: unknown[];
    forceApportionment?: unknown[];
    changelog: string;
    createdBy: string;
  }): Promise<DirectiveVersion> {
    await this.ensureInitialized();
    const pool = getPool();
    const id = `SGDV-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      `INSERT INTO strategic_directive_versions
         (id, instance_id, version, content, constraints, assumptions, force_apportionment, changelog, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (instance_id, version) DO UPDATE SET
         content = EXCLUDED.content,
         constraints = EXCLUDED.constraints,
         assumptions = EXCLUDED.assumptions,
         force_apportionment = EXCLUDED.force_apportionment,
         changelog = EXCLUDED.changelog`,
      [
        id,
        data.instanceId,
        data.version,
        JSON.stringify(data.content),
        JSON.stringify(data.constraints ?? []),
        JSON.stringify(data.assumptions ?? []),
        JSON.stringify(data.forceApportionment ?? []),
        data.changelog,
        data.createdBy,
        now,
      ],
    );

    // Update instance directive version counter
    await pool.query(
      `UPDATE strategic_guidance_instances
       SET current_directive_version = $1, updated_at = $2
       WHERE id = $3`,
      [data.version, now, data.instanceId],
    );

    const result = await pool.query(
      'SELECT * FROM strategic_directive_versions WHERE id = $1',
      [id],
    );
    return rowToDirectiveVersion(result.rows[0]);
  }

  async getDirectiveVersions(instanceId: string): Promise<DirectiveVersion[]> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_directive_versions WHERE instance_id = $1 ORDER BY version ASC',
      [instanceId],
    );
    return result.rows.map(rowToDirectiveVersion);
  }

  async getLatestDirectiveVersion(instanceId: string): Promise<DirectiveVersion | null> {
    await this.ensureInitialized();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM strategic_directive_versions WHERE instance_id = $1 ORDER BY version DESC LIMIT 1',
      [instanceId],
    );
    return result.rows[0] ? rowToDirectiveVersion(result.rows[0]) : null;
  }
}

export const strategicGuidanceStore = new StrategicGuidanceStore();
