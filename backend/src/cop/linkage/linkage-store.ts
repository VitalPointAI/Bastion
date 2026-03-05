/**
 * Entity-Data Linkage Store
 *
 * Phase 21 Plan 05: Persistence layer for entity-data linkages between
 * RAFT graph entities and COP layer symbols.
 *
 * Linkages are bidirectional references: an entity in the RAFT graph
 * is linked to a symbol in a COP layer with confidence and discovery metadata.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../../lib/database.js';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Discovery method for how a linkage was found. */
export type DiscoveryMethod = 'graph_traversal' | 'embedding_similarity' | 'manual';

/**
 * An entity-data linkage between a RAFT graph entity and a COP symbol.
 */
export interface EntityLinkage {
  /** Unique linkage identifier */
  id: string;
  /** RAFT graph entity ID */
  entityId: string;
  /** COP symbol entity ID */
  symbolEntityId: string;
  /** COP layer ID containing the symbol */
  layerId: string;
  /** Confidence score (0-1) of the linkage */
  confidence: number;
  /** Whether the linkage was auto-committed (above threshold) */
  autoCommitted: boolean;
  /** How the linkage was discovered */
  discoveryMethod: DiscoveryMethod;
  /** Who reviewed the linkage (null if pending) */
  reviewedBy?: string;
  /** When the linkage was reviewed (null if pending) */
  reviewedAt?: string;
  /** When the linkage was created */
  createdAt: string;
}

// ─── SQL ───────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS cop_entity_linkages (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,
    symbol_entity_id TEXT NOT NULL,
    layer_id TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    auto_committed BOOLEAN NOT NULL DEFAULT false,
    discovery_method TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_confidence CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT chk_discovery_method CHECK (discovery_method IN ('graph_traversal', 'embedding_similarity', 'manual'))
  );
  CREATE INDEX IF NOT EXISTS idx_cop_linkage_entity ON cop_entity_linkages(entity_id);
  CREATE INDEX IF NOT EXISTS idx_cop_linkage_symbol ON cop_entity_linkages(symbol_entity_id, layer_id);
  CREATE INDEX IF NOT EXISTS idx_cop_linkage_pending ON cop_entity_linkages(auto_committed) WHERE auto_committed = false AND reviewed_by IS NULL;
`;

// ─── Store ─────────────────────────────────────────────────────────────────

/**
 * Persistence store for entity-data linkages.
 * Uses PostgreSQL for production; can be subclassed for in-memory testing.
 */
export class LinkageStore {
  private initialized = false;

  /**
   * Ensure the cop_entity_linkages table exists.
   */
  async ensureTable(): Promise<void> {
    if (this.initialized) return;
    const pool = getPool();
    await pool.query(CREATE_TABLE_SQL);
    this.initialized = true;
  }

  /**
   * Create a new entity-data linkage.
   */
  async createLinkage(
    input: Omit<EntityLinkage, 'id' | 'createdAt'>,
  ): Promise<EntityLinkage> {
    await this.ensureTable();
    const pool = getPool();
    const id = `LNK-${randomUUID().slice(0, 8)}`;

    const result = await pool.query(
      `INSERT INTO cop_entity_linkages (
        id, entity_id, symbol_entity_id, layer_id, confidence,
        auto_committed, discovery_method, reviewed_by, reviewed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        input.entityId,
        input.symbolEntityId,
        input.layerId,
        input.confidence,
        input.autoCommitted,
        input.discoveryMethod,
        input.reviewedBy || null,
        input.reviewedAt || null,
      ],
    );

    return this.rowToLinkage(result.rows[0]);
  }

  /**
   * Get all linkages for a given RAFT graph entity.
   */
  async getLinkagesForEntity(entityId: string): Promise<EntityLinkage[]> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM cop_entity_linkages WHERE entity_id = $1 ORDER BY created_at DESC',
      [entityId],
    );
    return result.rows.map(this.rowToLinkage);
  }

  /**
   * Get all linkages for a given COP symbol in a specific layer.
   */
  async getLinkagesForSymbol(
    symbolEntityId: string,
    layerId: string,
  ): Promise<EntityLinkage[]> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM cop_entity_linkages WHERE symbol_entity_id = $1 AND layer_id = $2 ORDER BY created_at DESC',
      [symbolEntityId, layerId],
    );
    return result.rows.map(this.rowToLinkage);
  }

  /**
   * Get linkages pending human review (autoCommitted=false, no reviewer).
   */
  async getPendingReviews(workspaceId?: string): Promise<EntityLinkage[]> {
    await this.ensureTable();
    const pool = getPool();
    // Note: workspaceId filtering would require a join to layers table;
    // for now we filter all pending reviews globally
    const result = await pool.query(
      'SELECT * FROM cop_entity_linkages WHERE auto_committed = false AND reviewed_by IS NULL ORDER BY created_at DESC',
    );
    return result.rows.map(this.rowToLinkage);
  }

  /**
   * Review a pending linkage. If approved, sets autoCommitted=true.
   */
  async reviewLinkage(
    id: string,
    reviewedBy: string,
    approved: boolean,
  ): Promise<EntityLinkage> {
    await this.ensureTable();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE cop_entity_linkages
       SET reviewed_by = $2, reviewed_at = NOW(), auto_committed = CASE WHEN $3 THEN true ELSE auto_committed END
       WHERE id = $1
       RETURNING *`,
      [id, reviewedBy, approved],
    );

    if (result.rows.length === 0) {
      throw new Error(`Linkage ${id} not found`);
    }

    return this.rowToLinkage(result.rows[0]);
  }

  /**
   * Map a database row to an EntityLinkage interface.
   */
  protected rowToLinkage(row: Record<string, unknown>): EntityLinkage {
    return {
      id: row.id as string,
      entityId: row.entity_id as string,
      symbolEntityId: row.symbol_entity_id as string,
      layerId: row.layer_id as string,
      confidence: row.confidence as number,
      autoCommitted: row.auto_committed as boolean,
      discoveryMethod: row.discovery_method as EntityLinkage['discoveryMethod'],
      reviewedBy: (row.reviewed_by as string) || undefined,
      reviewedAt: row.reviewed_at
        ? (row.reviewed_at as Date).toISOString?.() || (row.reviewed_at as string)
        : undefined,
      createdAt: (row.created_at as Date).toISOString?.() || (row.created_at as string),
    };
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

/** Global linkage store singleton. */
export const linkageStore = new LinkageStore();
