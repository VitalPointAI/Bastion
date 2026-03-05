/**
 * COP Layer Store with Lifecycle State Machine.
 *
 * Provides CRUD operations and lifecycle state transitions for COP layers.
 * The LayerStore class uses PostgreSQL (same pool/query pattern as workspace store).
 * The LayerStoreMemory class provides an in-memory implementation for unit testing.
 *
 * Lifecycle: Draft -> Review -> Published -> COP
 * Valid transitions:
 *   draft -> review
 *   review -> published
 *   review -> draft (revision)
 *   published -> cop (promote)
 *   cop -> review (recall, requires reason)
 */
import { randomUUID } from 'crypto';
import type {
  COPLayerSpec,
  CreateLayerInput,
  LayerQueryFilters,
  LayerState,
  LayerTransitionInput,
  ReviewFeedback,
} from './layer-types.js';

// Re-use shared types from layer-types for AuditEntry and COPLayer
export interface AuditEntry {
  id: string;
  action: string;
  performedBy: string;
  performedAt: string;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface COPLayer {
  id: string;
  workspaceId: string;
  sectionId: string;
  layerType: string;
  state: LayerState;
  currentVersion: number;
  spec: COPLayerSpec;
  reviewFeedback?: ReviewFeedback[];
  promotedBy?: string;
  promotedAt?: string;
  recalledBy?: string;
  recalledAt?: string;
  recallReason?: string;
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Valid state transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<LayerState, LayerState[]> = {
  draft: ['review'],
  review: ['published', 'draft'],
  published: ['cop'],
  cop: ['review'],
};

// ---------------------------------------------------------------------------
// Layer Store Interface
// ---------------------------------------------------------------------------

export interface ILayerStore {
  createLayer(input: CreateLayerInput): Promise<COPLayer>;
  getLayer(id: string): Promise<COPLayer | null>;
  queryLayers(filters: LayerQueryFilters): Promise<COPLayer[]>;
  transitionLayer(input: LayerTransitionInput): Promise<COPLayer>;
  updateLayerSpec(layerId: string, spec: COPLayerSpec): Promise<COPLayer>;
  addReviewFeedback(layerId: string, feedback: ReviewFeedback): Promise<COPLayer>;
}

// ---------------------------------------------------------------------------
// In-Memory Implementation (for unit testing)
// ---------------------------------------------------------------------------

export class LayerStoreMemory implements ILayerStore {
  private layers = new Map<string, COPLayer>();

  async createLayer(input: CreateLayerInput): Promise<COPLayer> {
    const id = `LYR-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const layer: COPLayer = {
      id,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      layerType: input.layerType,
      state: 'draft',
      currentVersion: 1,
      spec: input.spec,
      reviewFeedback: [],
      auditTrail: [
        {
          id: randomUUID(),
          action: 'created',
          performedBy: 'system',
          performedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.layers.set(id, layer);
    return { ...layer };
  }

  async getLayer(id: string): Promise<COPLayer | null> {
    const layer = this.layers.get(id);
    return layer ? { ...layer } : null;
  }

  async queryLayers(filters: LayerQueryFilters): Promise<COPLayer[]> {
    let results = Array.from(this.layers.values());

    if (filters.workspaceId) {
      results = results.filter(l => l.workspaceId === filters.workspaceId);
    }
    if (filters.sectionId) {
      results = results.filter(l => l.sectionId === filters.sectionId);
    }
    if (filters.state) {
      results = results.filter(l => l.state === filters.state);
    }
    if (filters.layerType) {
      results = results.filter(l => l.layerType === filters.layerType);
    }
    if (filters.beforeDate) {
      const before = new Date(filters.beforeDate).getTime();
      results = results.filter(l => new Date(l.createdAt).getTime() < before);
    }
    if (filters.afterDate) {
      const after = new Date(filters.afterDate).getTime();
      results = results.filter(l => new Date(l.createdAt).getTime() > after);
    }

    return results.map(l => ({ ...l }));
  }

  async transitionLayer(input: LayerTransitionInput): Promise<COPLayer> {
    const layer = this.layers.get(input.layerId);
    if (!layer) {
      throw new Error(`Layer not found: ${input.layerId}`);
    }

    const currentState = layer.state;
    const targetState = input.targetState;

    // Validate transition
    const validTargets = VALID_TRANSITIONS[currentState];
    if (!validTargets || !validTargets.includes(targetState)) {
      throw new Error(
        `Invalid transition from '${currentState}' to '${targetState}'. ` +
        `Valid targets from '${currentState}': ${validTargets?.join(', ') || 'none'}`
      );
    }

    // Recall from COP requires reason
    if (currentState === 'cop' && targetState === 'review') {
      if (!input.reason) {
        throw new Error('Reason is required for recall (cop -> review transition)');
      }
      layer.recalledBy = input.performedBy;
      layer.recalledAt = new Date().toISOString();
      layer.recallReason = input.reason;
    }

    // Promote to COP
    if (targetState === 'cop') {
      layer.promotedBy = input.performedBy;
      layer.promotedAt = new Date().toISOString();
    }

    // Update state
    layer.state = targetState;
    layer.updatedAt = new Date().toISOString();

    // Add audit entry
    const auditEntry: AuditEntry = {
      id: randomUUID(),
      action: `transition:${currentState}->${targetState}`,
      performedBy: input.performedBy,
      performedAt: new Date().toISOString(),
      reason: input.reason,
    };
    layer.auditTrail.push(auditEntry);

    return { ...layer };
  }

  async updateLayerSpec(layerId: string, spec: COPLayerSpec): Promise<COPLayer> {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Layer not found: ${layerId}`);
    }

    layer.spec = spec;
    layer.currentVersion += 1;
    layer.updatedAt = new Date().toISOString();

    return { ...layer };
  }

  async addReviewFeedback(layerId: string, feedback: ReviewFeedback): Promise<COPLayer> {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`Layer not found: ${layerId}`);
    }

    if (!layer.reviewFeedback) {
      layer.reviewFeedback = [];
    }
    layer.reviewFeedback.push(feedback);
    layer.updatedAt = new Date().toISOString();

    return { ...layer };
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Implementation
// ---------------------------------------------------------------------------

export class LayerStore implements ILayerStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.ensureTable();
      this.initialized = true;
    }
  }

  async ensureTable(): Promise<void> {
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cop_layers (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        layer_type TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'draft',
        current_version INTEGER NOT NULL DEFAULT 1,
        spec JSONB NOT NULL DEFAULT '{}',
        review_feedback JSONB NOT NULL DEFAULT '[]',
        promoted_by TEXT,
        promoted_at TIMESTAMPTZ,
        recalled_by TEXT,
        recalled_at TIMESTAMPTZ,
        recall_reason TEXT,
        audit_trail JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cop_layers_workspace ON cop_layers(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_cop_layers_section ON cop_layers(section_id);
      CREATE INDEX IF NOT EXISTS idx_cop_layers_state ON cop_layers(state);
      CREATE INDEX IF NOT EXISTS idx_cop_layers_type ON cop_layers(layer_type);
    `);
  }

  async createLayer(input: CreateLayerInput): Promise<COPLayer> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();
    const id = `LYR-${randomUUID().slice(0, 8)}`;
    const now = new Date();
    const auditTrail: AuditEntry[] = [
      {
        id: randomUUID(),
        action: 'created',
        performedBy: 'system',
        performedAt: now.toISOString(),
      },
    ];

    await pool.query(`
      INSERT INTO cop_layers (
        id, workspace_id, section_id, layer_type, state, current_version,
        spec, review_feedback, audit_trail, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'draft', 1, $5, '[]', $6, $7, $8)
    `, [
      id, input.workspaceId, input.sectionId, input.layerType,
      JSON.stringify(input.spec), JSON.stringify(auditTrail),
      now, now,
    ]);

    return {
      id,
      workspaceId: input.workspaceId,
      sectionId: input.sectionId,
      layerType: input.layerType,
      state: 'draft',
      currentVersion: 1,
      spec: input.spec,
      reviewFeedback: [],
      auditTrail,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  async getLayer(id: string): Promise<COPLayer | null> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();
    const result = await pool.query('SELECT * FROM cop_layers WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToLayer(result.rows[0]);
  }

  async queryLayers(filters: LayerQueryFilters): Promise<COPLayer[]> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.workspaceId) {
      conditions.push(`workspace_id = $${idx++}`);
      params.push(filters.workspaceId);
    }
    if (filters.sectionId) {
      conditions.push(`section_id = $${idx++}`);
      params.push(filters.sectionId);
    }
    if (filters.state) {
      conditions.push(`state = $${idx++}`);
      params.push(filters.state);
    }
    if (filters.layerType) {
      conditions.push(`layer_type = $${idx++}`);
      params.push(filters.layerType);
    }
    if (filters.beforeDate) {
      conditions.push(`created_at < $${idx++}`);
      params.push(filters.beforeDate);
    }
    if (filters.afterDate) {
      conditions.push(`created_at > $${idx++}`);
      params.push(filters.afterDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM cop_layers ${where} ORDER BY created_at DESC`,
      params
    );

    return result.rows.map((row: Record<string, unknown>) => this.rowToLayer(row));
  }

  async transitionLayer(input: LayerTransitionInput): Promise<COPLayer> {
    await this.ensureInitialized();
    const layer = await this.getLayer(input.layerId);
    if (!layer) {
      throw new Error(`Layer not found: ${input.layerId}`);
    }

    const currentState = layer.state;
    const targetState = input.targetState;

    const validTargets = VALID_TRANSITIONS[currentState];
    if (!validTargets || !validTargets.includes(targetState)) {
      throw new Error(
        `Invalid transition from '${currentState}' to '${targetState}'. ` +
        `Valid targets from '${currentState}': ${validTargets?.join(', ') || 'none'}`
      );
    }

    if (currentState === 'cop' && targetState === 'review') {
      if (!input.reason) {
        throw new Error('Reason is required for recall (cop -> review transition)');
      }
    }

    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();
    const now = new Date();

    const auditEntry: AuditEntry = {
      id: randomUUID(),
      action: `transition:${currentState}->${targetState}`,
      performedBy: input.performedBy,
      performedAt: now.toISOString(),
      reason: input.reason,
    };

    const newAuditTrail = [...layer.auditTrail, auditEntry];

    const setClauses = [
      `state = $1`,
      `audit_trail = $2`,
      `updated_at = $3`,
    ];
    const params: unknown[] = [targetState, JSON.stringify(newAuditTrail), now];
    let idx = 4;

    if (targetState === 'cop') {
      setClauses.push(`promoted_by = $${idx++}`);
      params.push(input.performedBy);
      setClauses.push(`promoted_at = $${idx++}`);
      params.push(now);
    }

    if (currentState === 'cop' && targetState === 'review') {
      setClauses.push(`recalled_by = $${idx++}`);
      params.push(input.performedBy);
      setClauses.push(`recalled_at = $${idx++}`);
      params.push(now);
      setClauses.push(`recall_reason = $${idx++}`);
      params.push(input.reason);
    }

    params.push(input.layerId);
    await pool.query(
      `UPDATE cop_layers SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params
    );

    return (await this.getLayer(input.layerId))!;
  }

  async updateLayerSpec(layerId: string, spec: COPLayerSpec): Promise<COPLayer> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();

    await pool.query(
      `UPDATE cop_layers SET spec = $1, current_version = current_version + 1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(spec), layerId]
    );

    const layer = await this.getLayer(layerId);
    if (!layer) throw new Error(`Layer not found: ${layerId}`);
    return layer;
  }

  async addReviewFeedback(layerId: string, feedback: ReviewFeedback): Promise<COPLayer> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();

    await pool.query(
      `UPDATE cop_layers SET review_feedback = review_feedback || $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify([feedback]), layerId]
    );

    const layer = await this.getLayer(layerId);
    if (!layer) throw new Error(`Layer not found: ${layerId}`);
    return layer;
  }

  private rowToLayer(row: Record<string, unknown>): COPLayer {
    return {
      id: row.id as string,
      workspaceId: row.workspace_id as string,
      sectionId: row.section_id as string,
      layerType: row.layer_type as string,
      state: row.state as LayerState,
      currentVersion: row.current_version as number,
      spec: row.spec as COPLayerSpec,
      reviewFeedback: row.review_feedback as ReviewFeedback[] | undefined,
      promotedBy: row.promoted_by as string | undefined,
      promotedAt: row.promoted_at ? new Date(row.promoted_at as string).toISOString() : undefined,
      recalledBy: row.recalled_by as string | undefined,
      recalledAt: row.recalled_at ? new Date(row.recalled_at as string).toISOString() : undefined,
      recallReason: row.recall_reason as string | undefined,
      auditTrail: row.audit_trail as AuditEntry[],
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
    };
  }
}

export const layerStore = new LayerStore();
