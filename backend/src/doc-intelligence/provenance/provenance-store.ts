/**
 * Provenance Store
 *
 * PostgreSQL persistence for entity-to-source provenance tracking.
 * Every graph entity created by the document intelligence pipeline is
 * traced back to its source document(s) via entity_provenance records.
 *
 * Supports multi-source attribution: the same entity may be extracted
 * from multiple documents. When a source is revoked, entities solely
 * attributed to it are soft-deleted while corroborated entities retain
 * their other citations.
 */

import { getPool } from '../../lib/database.js';

// ============================================================================
// Types
// ============================================================================

export interface ProvenanceRecord {
  entityId: string;
  entityType: string;
  sourceDocumentId: string;
  extractedBy: string;
  extractionContext?: Record<string, unknown>;
  isRevoked: boolean;
  revokedAt?: string;
  revokedBy?: string;
  createdAt: string;
}

export interface EntitySourceInfo {
  entityId: string;
  entityType: string;
}

export interface CorroboratedEntity {
  entityId: string;
  entityType: string;
  otherSources: string[];
}

// ============================================================================
// Provenance Store
// ============================================================================

/**
 * ProvenanceStore tracks entity-to-source document relationships.
 *
 * Central to the trust management system: enables determining which
 * entities are solely from a given source (candidates for removal on
 * revocation) vs corroborated by multiple sources (retain on revocation).
 */
export class ProvenanceStore {
  /**
   * Track an entity's provenance to a source document.
   *
   * Uses ON CONFLICT DO NOTHING for idempotency: the same entity from
   * the same source is recorded once. Re-processing a document does
   * not create duplicate provenance records.
   */
  async trackEntity(
    entityId: string,
    entityType: string,
    sourceDocumentId: string,
    extractedBy: string,
    extractionContext?: Record<string, unknown>,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO entity_provenance (entity_id, entity_type, source_document_id, extracted_by, extraction_context)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entity_id, source_document_id) DO NOTHING`,
      [entityId, entityType, sourceDocumentId, extractedBy, JSON.stringify(extractionContext ?? {})],
    );
  }

  /**
   * Get all source document IDs for an entity.
   * Returns active (non-revoked) sources by default.
   */
  async getEntitySources(entityId: string, includeRevoked = false): Promise<string[]> {
    const pool = getPool();
    const whereClause = includeRevoked
      ? 'WHERE entity_id = $1'
      : 'WHERE entity_id = $1 AND is_revoked = false';

    const result = await pool.query(
      `SELECT source_document_id FROM entity_provenance ${whereClause} ORDER BY created_at ASC`,
      [entityId],
    );
    return result.rows.map((r: { source_document_id: string }) => r.source_document_id);
  }

  /**
   * Get all entities extracted from a given source document.
   */
  async getSourceEntities(sourceDocumentId: string): Promise<EntitySourceInfo[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT DISTINCT entity_id, entity_type
       FROM entity_provenance
       WHERE source_document_id = $1 AND is_revoked = false
       ORDER BY entity_id`,
      [sourceDocumentId],
    );
    return result.rows.map((r: { entity_id: string; entity_type: string }) => ({
      entityId: r.entity_id,
      entityType: r.entity_type,
    }));
  }

  /**
   * Get entities where this source is the ONLY active source.
   * These are candidates for removal during source revocation.
   */
  async getEntitiesSolelyFromSource(sourceDocumentId: string): Promise<EntitySourceInfo[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT ep.entity_id, ep.entity_type
       FROM entity_provenance ep
       WHERE ep.source_document_id = $1
         AND ep.is_revoked = false
         AND NOT EXISTS (
           SELECT 1 FROM entity_provenance ep2
           WHERE ep2.entity_id = ep.entity_id
             AND ep2.source_document_id != $1
             AND ep2.is_revoked = false
         )
       ORDER BY ep.entity_id`,
      [sourceDocumentId],
    );
    return result.rows.map((r: { entity_id: string; entity_type: string }) => ({
      entityId: r.entity_id,
      entityType: r.entity_type,
    }));
  }

  /**
   * Get entities from this source that are corroborated by other sources.
   * These entities lose this source's citation but remain active.
   */
  async getEntitiesWithMultipleSources(sourceDocumentId: string): Promise<CorroboratedEntity[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT ep.entity_id, ep.entity_type,
              array_agg(DISTINCT ep2.source_document_id) AS other_sources
       FROM entity_provenance ep
       JOIN entity_provenance ep2
         ON ep2.entity_id = ep.entity_id
         AND ep2.source_document_id != $1
         AND ep2.is_revoked = false
       WHERE ep.source_document_id = $1
         AND ep.is_revoked = false
       GROUP BY ep.entity_id, ep.entity_type
       ORDER BY ep.entity_id`,
      [sourceDocumentId],
    );
    return result.rows.map((r: { entity_id: string; entity_type: string; other_sources: string[] }) => ({
      entityId: r.entity_id,
      entityType: r.entity_type,
      otherSources: r.other_sources,
    }));
  }

  /**
   * Mark a specific provenance record as revoked.
   * Sets is_revoked=true with timestamp and actor.
   */
  async markRevoked(entityId: string, sourceDocumentId: string, revokedBy: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE entity_provenance
       SET is_revoked = true, revoked_at = NOW(), revoked_by = $3
       WHERE entity_id = $1 AND source_document_id = $2 AND is_revoked = false`,
      [entityId, sourceDocumentId, revokedBy],
    );
  }

  /**
   * Mark ALL provenance records for a source document as revoked.
   * Used during full source revocation. Operates within the caller's transaction.
   */
  async markAllRevokedForSource(
    sourceDocumentId: string,
    revokedBy: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client?: any,
  ): Promise<number> {
    const queryRunner = client ?? getPool();
    const result = await queryRunner.query(
      `UPDATE entity_provenance
       SET is_revoked = true, revoked_at = NOW(), revoked_by = $2
       WHERE source_document_id = $1 AND is_revoked = false`,
      [sourceDocumentId, revokedBy],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get the full provenance history for an entity (including revoked records).
   */
  async getEntityProvenanceHistory(entityId: string): Promise<ProvenanceRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT entity_id, entity_type, source_document_id, extracted_by,
              extraction_context, is_revoked, revoked_at, revoked_by, created_at
       FROM entity_provenance
       WHERE entity_id = $1
       ORDER BY created_at ASC`,
      [entityId],
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      entityId: r.entity_id as string,
      entityType: r.entity_type as string,
      sourceDocumentId: r.source_document_id as string,
      extractedBy: r.extracted_by as string,
      extractionContext: r.extraction_context as Record<string, unknown> | undefined,
      isRevoked: r.is_revoked as boolean,
      revokedAt: r.revoked_at ? String(r.revoked_at) : undefined,
      revokedBy: r.revoked_by as string | undefined,
      createdAt: String(r.created_at),
    }));
  }
}
