/**
 * COP Layer Version Store.
 *
 * Manages version snapshots for COP layers. Creates full snapshots at COP
 * promotion or when no previous spec exists, and JSON patch diffs for
 * intermediate transitions.
 *
 * Supports reconstruction of spec at any version by finding the nearest
 * full snapshot and applying patches forward.
 */
import { randomUUID } from 'crypto';
import type { COPLayerSpec, LayerState } from './layer-types.js';
import type { COPLayer } from './layer-store.js';

// ---------------------------------------------------------------------------
// Snapshot Types
// ---------------------------------------------------------------------------

export interface LayerSnapshotRecord {
  id: string;
  layerId: string;
  version: number;
  state: LayerState;
  isFullSnapshot: boolean;
  specOrPatch: COPLayerSpec | Record<string, unknown>;
  transitionedBy: string;
  transitionedAt: string;
  previousState: LayerState | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Diff Utilities
// ---------------------------------------------------------------------------

/**
 * Compute a shallow diff between two COPLayerSpec objects.
 * Returns only the changed top-level fields.
 */
function computeDiff(
  prev: COPLayerSpec,
  curr: COPLayerSpec,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  const keys = new Set([
    ...Object.keys(prev),
    ...Object.keys(curr),
  ]) as Set<keyof COPLayerSpec>;

  for (const key of keys) {
    const prevVal = JSON.stringify(prev[key]);
    const currVal = JSON.stringify(curr[key]);
    if (prevVal !== currVal) {
      diff[key] = curr[key];
    }
  }

  return diff;
}

/**
 * Apply a patch to a base spec to produce an updated spec.
 */
function applyPatch(
  base: COPLayerSpec,
  patch: Record<string, unknown>,
): COPLayerSpec {
  return { ...base, ...patch } as COPLayerSpec;
}

// ---------------------------------------------------------------------------
// Version Store Interface
// ---------------------------------------------------------------------------

export interface IVersionStore {
  createSnapshot(layer: COPLayer, previousSpec: COPLayerSpec | null): Promise<LayerSnapshotRecord>;
  getSnapshot(layerId: string, version: number): Promise<LayerSnapshotRecord | null>;
  listSnapshots(layerId: string): Promise<LayerSnapshotRecord[]>;
  reconstructAtVersion(layerId: string, version: number): Promise<COPLayerSpec>;
}

// ---------------------------------------------------------------------------
// In-Memory Implementation (for unit testing)
// ---------------------------------------------------------------------------

export class VersionStoreMemory implements IVersionStore {
  private snapshots: LayerSnapshotRecord[] = [];

  async createSnapshot(
    layer: COPLayer,
    previousSpec: COPLayerSpec | null,
  ): Promise<LayerSnapshotRecord> {
    const isFullSnapshot = layer.state === 'cop' || previousSpec === null;
    const now = new Date().toISOString();

    let specOrPatch: COPLayerSpec | Record<string, unknown>;
    if (isFullSnapshot) {
      specOrPatch = layer.spec;
    } else {
      specOrPatch = computeDiff(previousSpec, layer.spec);
    }

    const snapshot: LayerSnapshotRecord = {
      id: randomUUID(),
      layerId: layer.id,
      version: layer.currentVersion,
      state: layer.state as LayerState,
      isFullSnapshot,
      specOrPatch,
      transitionedBy: layer.auditTrail.length > 0
        ? layer.auditTrail[layer.auditTrail.length - 1].performedBy
        : 'system',
      transitionedAt: now,
      previousState: null,
      createdAt: now,
    };

    this.snapshots.push(snapshot);
    return { ...snapshot };
  }

  async getSnapshot(layerId: string, version: number): Promise<LayerSnapshotRecord | null> {
    const found = this.snapshots.find(
      s => s.layerId === layerId && s.version === version,
    );
    return found ? { ...found } : null;
  }

  async listSnapshots(layerId: string): Promise<LayerSnapshotRecord[]> {
    return this.snapshots
      .filter(s => s.layerId === layerId)
      .sort((a, b) => a.version - b.version)
      .map(s => ({ ...s }));
  }

  async reconstructAtVersion(layerId: string, version: number): Promise<COPLayerSpec> {
    const all = await this.listSnapshots(layerId);
    const target = all.find(s => s.version === version);
    if (!target) {
      throw new Error(`Snapshot not found: ${layerId} v${version}`);
    }

    // If the target is a full snapshot, return directly
    if (target.isFullSnapshot) {
      return target.specOrPatch as COPLayerSpec;
    }

    // Find nearest full snapshot at or before target version
    let baseSnapshot: LayerSnapshotRecord | null = null;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].version <= version && all[i].isFullSnapshot) {
        baseSnapshot = all[i];
        break;
      }
    }

    if (!baseSnapshot) {
      throw new Error(`No base snapshot found for reconstruction: ${layerId} v${version}`);
    }

    // Apply patches from base+1 to target version
    let spec = baseSnapshot.specOrPatch as COPLayerSpec;
    for (const snap of all) {
      if (snap.version > baseSnapshot.version && snap.version <= version) {
        if (snap.isFullSnapshot) {
          spec = snap.specOrPatch as COPLayerSpec;
        } else {
          spec = applyPatch(spec, snap.specOrPatch as Record<string, unknown>);
        }
      }
    }

    return spec;
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Implementation
// ---------------------------------------------------------------------------

export class VersionStore implements IVersionStore {
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
      CREATE TABLE IF NOT EXISTS cop_layer_snapshots (
        id TEXT PRIMARY KEY,
        layer_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        state TEXT NOT NULL,
        is_full_snapshot BOOLEAN NOT NULL DEFAULT true,
        spec_or_patch JSONB NOT NULL,
        transitioned_by TEXT NOT NULL,
        transitioned_at TIMESTAMPTZ NOT NULL,
        previous_state TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(layer_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_cop_snapshots_layer ON cop_layer_snapshots(layer_id);
      CREATE INDEX IF NOT EXISTS idx_cop_snapshots_version ON cop_layer_snapshots(layer_id, version);
    `);
  }

  async createSnapshot(
    layer: COPLayer,
    previousSpec: COPLayerSpec | null,
  ): Promise<LayerSnapshotRecord> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();

    const isFullSnapshot = layer.state === 'cop' || previousSpec === null;
    const now = new Date();

    let specOrPatch: COPLayerSpec | Record<string, unknown>;
    if (isFullSnapshot) {
      specOrPatch = layer.spec;
    } else {
      specOrPatch = computeDiff(previousSpec, layer.spec);
    }

    const id = randomUUID();
    await pool.query(`
      INSERT INTO cop_layer_snapshots (
        id, layer_id, version, state, is_full_snapshot,
        spec_or_patch, transitioned_by, transitioned_at, previous_state, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      id, layer.id, layer.currentVersion, layer.state, isFullSnapshot,
      JSON.stringify(specOrPatch),
      layer.auditTrail.length > 0
        ? layer.auditTrail[layer.auditTrail.length - 1].performedBy
        : 'system',
      now, null, now,
    ]);

    return {
      id,
      layerId: layer.id,
      version: layer.currentVersion,
      state: layer.state as LayerState,
      isFullSnapshot,
      specOrPatch,
      transitionedBy: layer.auditTrail.length > 0
        ? layer.auditTrail[layer.auditTrail.length - 1].performedBy
        : 'system',
      transitionedAt: now.toISOString(),
      previousState: null,
      createdAt: now.toISOString(),
    };
  }

  async getSnapshot(layerId: string, version: number): Promise<LayerSnapshotRecord | null> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM cop_layer_snapshots WHERE layer_id = $1 AND version = $2',
      [layerId, version],
    );
    if (result.rows.length === 0) return null;
    return this.rowToSnapshot(result.rows[0]);
  }

  async listSnapshots(layerId: string): Promise<LayerSnapshotRecord[]> {
    await this.ensureInitialized();
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM cop_layer_snapshots WHERE layer_id = $1 ORDER BY version ASC',
      [layerId],
    );
    return result.rows.map((row: Record<string, unknown>) => this.rowToSnapshot(row));
  }

  async reconstructAtVersion(layerId: string, version: number): Promise<COPLayerSpec> {
    const all = await this.listSnapshots(layerId);
    const target = all.find(s => s.version === version);
    if (!target) {
      throw new Error(`Snapshot not found: ${layerId} v${version}`);
    }

    if (target.isFullSnapshot) {
      return target.specOrPatch as COPLayerSpec;
    }

    let baseSnapshot: LayerSnapshotRecord | null = null;
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].version <= version && all[i].isFullSnapshot) {
        baseSnapshot = all[i];
        break;
      }
    }

    if (!baseSnapshot) {
      throw new Error(`No base snapshot found for reconstruction: ${layerId} v${version}`);
    }

    let spec = baseSnapshot.specOrPatch as COPLayerSpec;
    for (const snap of all) {
      if (snap.version > baseSnapshot.version && snap.version <= version) {
        if (snap.isFullSnapshot) {
          spec = snap.specOrPatch as COPLayerSpec;
        } else {
          spec = applyPatch(spec, snap.specOrPatch as Record<string, unknown>);
        }
      }
    }

    return spec;
  }

  private rowToSnapshot(row: Record<string, unknown>): LayerSnapshotRecord {
    return {
      id: row.id as string,
      layerId: row.layer_id as string,
      version: row.version as number,
      state: row.state as LayerState,
      isFullSnapshot: row.is_full_snapshot as boolean,
      specOrPatch: row.spec_or_patch as COPLayerSpec | Record<string, unknown>,
      transitionedBy: row.transitioned_by as string,
      transitionedAt: new Date(row.transitioned_at as string).toISOString(),
      previousState: row.previous_state as LayerState | null,
      createdAt: new Date(row.created_at as string).toISOString(),
    };
  }
}

export const versionStore = new VersionStore();
