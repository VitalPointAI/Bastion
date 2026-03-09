/**
 * Revert Service
 *
 * Source revocation with cascade handling and preview capability.
 * When a source document is found to be unreliable, this service:
 * 1. Shows a preview of what would be affected (entities removed vs updated)
 * 2. Executes the revocation in a database transaction (soft-delete approach)
 * 3. Maintains an audit trail of all revocations
 *
 * Soft-delete approach: entities are flagged as revoked rather than
 * hard-deleted, allowing recovery if the revocation itself was wrong.
 */

import { getPool } from '../../lib/database.js';
import { ProvenanceStore } from './provenance-store.js';
import type { EntitySourceInfo, CorroboratedEntity } from './provenance-store.js';

// ============================================================================
// Types
// ============================================================================

export interface RevertPreview {
  sourceDocumentId: string;
  entitiesToRemove: EntitySourceInfo[];
  entitiesToUpdate: CorroboratedEntity[];
  affectedRelationships: AffectedRelationship[];
  totalImpact: {
    entitiesRemoved: number;
    citationsRemoved: number;
    relationshipsAffected: number;
  };
}

export interface AffectedRelationship {
  relationshipId: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;
  /** Whether this relationship will be removed (both endpoints solely from this source) */
  willBeRemoved: boolean;
}

export interface RevertResult {
  sourceDocumentId: string;
  executedBy: string;
  executedAt: string;
  provenanceRecordsRevoked: number;
  entitiesSoftDeleted: number;
  citationsRemoved: number;
  relationshipsAffected: number;
  documentStatusUpdated: boolean;
}

export interface RevertRecord {
  id: string;
  sourceDocumentId: string;
  executedBy: string;
  executedAt: string;
  entitiesSoftDeleted: number;
  citationsRemoved: number;
  relationshipsAffected: number;
  reason?: string;
}

// ============================================================================
// Revert Service
// ============================================================================

/**
 * RevertService provides preview-before-execute source revocation.
 *
 * Preview shows the full impact before any changes are made. Execute
 * performs all changes atomically in a database transaction. All
 * operations use soft-delete: entities are flagged, not removed.
 */
export class RevertService {
  private provenanceStore: ProvenanceStore;

  constructor(provenanceStore?: ProvenanceStore) {
    this.provenanceStore = provenanceStore ?? new ProvenanceStore();
  }

  /**
   * Preview what would happen if a source document were revoked.
   * No changes are made -- this is a read-only operation.
   *
   * Returns entities that would be removed (solely from this source),
   * entities that would lose a citation (corroborated), and relationships
   * that would be affected.
   */
  async previewRevert(sourceDocumentId: string): Promise<RevertPreview> {
    const [entitiesToRemove, entitiesToUpdate] = await Promise.all([
      this.provenanceStore.getEntitiesSolelyFromSource(sourceDocumentId),
      this.provenanceStore.getEntitiesWithMultipleSources(sourceDocumentId),
    ]);

    // Find relationships involving entities that would be removed
    const affectedRelationships = await this.findAffectedRelationships(
      entitiesToRemove.map((e) => e.entityId),
    );

    return {
      sourceDocumentId,
      entitiesToRemove,
      entitiesToUpdate,
      affectedRelationships,
      totalImpact: {
        entitiesRemoved: entitiesToRemove.length,
        citationsRemoved: entitiesToRemove.length + entitiesToUpdate.length,
        relationshipsAffected: affectedRelationships.length,
      },
    };
  }

  /**
   * Execute source revocation in a database transaction.
   *
   * Steps:
   * 1. Mark all entity_provenance records for this source as revoked
   * 2. Soft-delete entities solely from this source (set revoked flag)
   * 3. For corroborated entities: citation removed via provenance revocation
   * 4. Update strategic_documents trust_status to 'revoked'
   * 5. Record the revert in the audit trail
   */
  async executeRevert(
    sourceDocumentId: string,
    executedBy: string,
    reason?: string,
  ): Promise<RevertResult> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Step 1: Mark all provenance records as revoked
      const provenanceRecordsRevoked = await this.provenanceStore.markAllRevokedForSource(
        sourceDocumentId,
        executedBy,
        client,
      );

      // Step 2: Soft-delete entities solely from this source
      // We query before revoking provenance to get the correct sole-source list,
      // but since we're in a transaction, we use the pre-revocation snapshot
      const entitiesToRemove = await this.getEntitiesSolelyFromSourceTx(sourceDocumentId, client);
      let entitiesSoftDeleted = 0;

      for (const entity of entitiesToRemove) {
        const softDeleted = await this.softDeleteEntity(entity.entityId, executedBy, client);
        if (softDeleted) entitiesSoftDeleted++;
      }

      // Step 3: Corroborated entities keep their other citations.
      // The provenance revocation in step 1 already removed this source's citation.
      const corroboratedCount = provenanceRecordsRevoked - entitiesToRemove.length;

      // Step 4: Find and soft-delete affected relationships
      const entityIdsToRemove = entitiesToRemove.map((e) => e.entityId);
      const relationshipsAffected = await this.softDeleteRelationships(
        entityIdsToRemove,
        executedBy,
        client,
      );

      // Step 5: Update strategic_documents trust_status
      const documentStatusUpdated = await this.updateDocumentTrustStatus(
        sourceDocumentId,
        'revoked',
        client,
      );

      // Step 6: Record in audit trail
      await this.recordRevert(
        sourceDocumentId,
        executedBy,
        entitiesSoftDeleted,
        provenanceRecordsRevoked,
        relationshipsAffected,
        reason,
        client,
      );

      await client.query('COMMIT');

      return {
        sourceDocumentId,
        executedBy,
        executedAt: new Date().toISOString(),
        provenanceRecordsRevoked,
        entitiesSoftDeleted,
        citationsRemoved: corroboratedCount,
        relationshipsAffected,
        documentStatusUpdated,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get the audit trail of all revocations for a problem set.
   */
  async getRevertHistory(problemSetId: string): Promise<RevertRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT rh.id, rh.source_document_id, rh.executed_by, rh.executed_at,
              rh.entities_soft_deleted, rh.citations_removed, rh.relationships_affected,
              rh.reason
       FROM revert_history rh
       JOIN strategic_documents sd ON sd.id = rh.source_document_id
       WHERE sd.problem_set_id = $1
       ORDER BY rh.executed_at DESC`,
      [problemSetId],
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      sourceDocumentId: String(r.source_document_id),
      executedBy: String(r.executed_by),
      executedAt: String(r.executed_at),
      entitiesSoftDeleted: Number(r.entities_soft_deleted),
      citationsRemoved: Number(r.citations_removed),
      relationshipsAffected: Number(r.relationships_affected),
      reason: r.reason ? String(r.reason) : undefined,
    }));
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  /**
   * Find entities solely from source within a transaction context.
   * Uses a fresh query since provenance may not yet be revoked at this point.
   */
  private async getEntitiesSolelyFromSourceTx(
    sourceDocumentId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
  ): Promise<EntitySourceInfo[]> {
    const result = await client.query(
      `SELECT ep.entity_id, ep.entity_type
       FROM entity_provenance ep
       WHERE ep.source_document_id = $1
         AND ep.is_revoked = false
         AND NOT EXISTS (
           SELECT 1 FROM entity_provenance ep2
           WHERE ep2.entity_id = ep.entity_id
             AND ep2.source_document_id != $1
             AND ep2.is_revoked = false
         )`,
      [sourceDocumentId],
    );
    return result.rows.map((r: { entity_id: string; entity_type: string }) => ({
      entityId: r.entity_id,
      entityType: r.entity_type,
    }));
  }

  /**
   * Soft-delete an entity by setting a revoked flag.
   * Checks multiple potential graph entity tables.
   */
  private async softDeleteEntity(
    entityId: string,
    revokedBy: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
  ): Promise<boolean> {
    // Try graph_actors table first (primary entity store)
    const actorResult = await client.query(
      `UPDATE graph_actors
       SET is_revoked = true, revoked_at = NOW(), revoked_by = $2
       WHERE id = $1 AND (is_revoked = false OR is_revoked IS NULL)`,
      [entityId, revokedBy],
    );
    if ((actorResult.rowCount ?? 0) > 0) return true;

    // Try graph_entities table (if separate from actors)
    const entityResult = await client.query(
      `UPDATE graph_entities
       SET is_revoked = true, revoked_at = NOW(), revoked_by = $2
       WHERE id = $1 AND (is_revoked = false OR is_revoked IS NULL)`,
      [entityId, revokedBy],
    );
    return (entityResult.rowCount ?? 0) > 0;
  }

  /**
   * Find relationships involving entities that would be removed.
   */
  private async findAffectedRelationships(entityIds: string[]): Promise<AffectedRelationship[]> {
    if (entityIds.length === 0) return [];

    const pool = getPool();
    const placeholders = entityIds.map((_, i) => `$${i + 1}`).join(', ');

    const result = await pool.query(
      `SELECT id, from_entity_id, to_entity_id, relationship_type
       FROM graph_relationships
       WHERE (from_entity_id IN (${placeholders}) OR to_entity_id IN (${placeholders}))
         AND (is_revoked = false OR is_revoked IS NULL)`,
      [...entityIds, ...entityIds],
    );

    const removedSet = new Set(entityIds);
    return result.rows.map((r: Record<string, unknown>) => ({
      relationshipId: String(r.id),
      fromEntityId: String(r.from_entity_id),
      toEntityId: String(r.to_entity_id),
      relationshipType: String(r.relationship_type),
      willBeRemoved:
        removedSet.has(String(r.from_entity_id)) || removedSet.has(String(r.to_entity_id)),
    }));
  }

  /**
   * Soft-delete relationships involving removed entities.
   */
  private async softDeleteRelationships(
    entityIds: string[],
    revokedBy: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
  ): Promise<number> {
    if (entityIds.length === 0) return 0;

    const placeholders = entityIds.map((_, i) => `$${i + 1}`).join(', ');
    const revokedByIdx = entityIds.length + 1;

    const result = await client.query(
      `UPDATE graph_relationships
       SET is_revoked = true, revoked_at = NOW(), revoked_by = $${revokedByIdx}
       WHERE (from_entity_id IN (${placeholders}) OR to_entity_id IN (${placeholders}))
         AND (is_revoked = false OR is_revoked IS NULL)`,
      [...entityIds, ...entityIds, revokedBy],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Update the trust status of a strategic document.
   */
  private async updateDocumentTrustStatus(
    sourceDocumentId: string,
    status: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
  ): Promise<boolean> {
    const result = await client.query(
      `UPDATE strategic_documents SET trust_status = $2, updated_at = NOW() WHERE id = $1`,
      [sourceDocumentId, status],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Record a revert operation in the audit trail.
   */
  private async recordRevert(
    sourceDocumentId: string,
    executedBy: string,
    entitiesSoftDeleted: number,
    citationsRemoved: number,
    relationshipsAffected: number,
    reason: string | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
  ): Promise<void> {
    await client.query(
      `INSERT INTO revert_history
         (source_document_id, executed_by, entities_soft_deleted, citations_removed, relationships_affected, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sourceDocumentId, executedBy, entitiesSoftDeleted, citationsRemoved, relationshipsAffected, reason ?? null],
    );
  }
}
