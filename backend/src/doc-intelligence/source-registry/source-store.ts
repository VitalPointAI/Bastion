/**
 * Source Store
 *
 * PostgreSQL persistence layer for the source trust registry. Tracks
 * information sources, their default reliability ratings, blocklist
 * status, and trust history for audit trail purposes.
 *
 * The source_registry table stores per-source trust metadata. The
 * strategic_documents table tracks per-document trust status (trusted,
 * pending, flagged, revoked) set by the Trust Agent.
 */

import { getPool } from '../../lib/database.js';
import type { SourceReliability } from './nato-ratings.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A source entry from the source_registry table.
 */
export interface SourceEntry {
  id: string;
  sourceName: string;
  sourceType: string;
  defaultReliability: SourceReliability | null;
  trustNotes: string | null;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating or updating a source entry.
 */
export interface UpsertSourceInput {
  sourceName: string;
  sourceType: string;
  defaultReliability?: SourceReliability;
  trustNotes?: string;
  isBlocked?: boolean;
}

/**
 * Trust status for a document in the strategic_documents table.
 */
export type DocumentTrustStatus = 'trusted' | 'pending' | 'flagged' | 'revoked';

// ============================================================================
// Source Store
// ============================================================================

/**
 * Persistence layer for source trust registry. Provides CRUD operations
 * on the source_registry table and trust status updates on strategic_documents.
 */
export class SourceStore {
  // --------------------------------------------------------------------------
  // Source Registry CRUD
  // --------------------------------------------------------------------------

  /**
   * Look up a source by name in the source_registry table.
   *
   * @param name - Source name to look up
   * @returns SourceEntry if found, null otherwise
   */
  async getSourceByName(name: string): Promise<SourceEntry | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, source_name, source_type, default_reliability,
              trust_notes, is_blocked, created_at, updated_at
       FROM source_registry
       WHERE source_name = $1`,
      [name],
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Create or update a source entry. UPSERT on source_name.
   *
   * @param source - Source data to upsert
   * @returns The created or updated SourceEntry
   */
  async upsertSource(source: UpsertSourceInput): Promise<SourceEntry> {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO source_registry (source_name, source_type, default_reliability, trust_notes, is_blocked)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_name) DO UPDATE SET
         source_type = COALESCE(EXCLUDED.source_type, source_registry.source_type),
         default_reliability = COALESCE(EXCLUDED.default_reliability, source_registry.default_reliability),
         trust_notes = COALESCE(EXCLUDED.trust_notes, source_registry.trust_notes),
         is_blocked = COALESCE(EXCLUDED.is_blocked, source_registry.is_blocked),
         updated_at = NOW()
       RETURNING id, source_name, source_type, default_reliability,
                 trust_notes, is_blocked, created_at, updated_at`,
      [
        source.sourceName,
        source.sourceType,
        source.defaultReliability ?? null,
        source.trustNotes ?? null,
        source.isBlocked ?? false,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Check if a source is on the blocklist.
   *
   * @param name - Source name to check
   * @returns true if the source is blocked
   */
  async isSourceBlocked(name: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT is_blocked FROM source_registry WHERE source_name = $1`,
      [name],
    );

    if (result.rows.length === 0) return false;
    return result.rows[0].is_blocked === true;
  }

  /**
   * Get the trust history for a source (audit trail).
   * Returns all versions of the source entry ordered by update time.
   *
   * Note: For full audit trail, this queries the source_registry_audit table
   * if it exists, falling back to the current entry.
   *
   * @param name - Source name to look up
   * @returns Array of SourceEntry records (current + historical)
   */
  async getSourceTrustHistory(name: string): Promise<SourceEntry[]> {
    const pool = getPool();

    // Try audit table first
    try {
      const auditResult = await pool.query(
        `SELECT id, source_name, source_type, default_reliability,
                trust_notes, is_blocked, created_at, updated_at
         FROM source_registry_audit
         WHERE source_name = $1
         ORDER BY updated_at DESC`,
        [name],
      );

      if (auditResult.rows.length > 0) {
        return auditResult.rows.map(this.mapRow);
      }
    } catch {
      // Audit table may not exist yet -- fall back to current entry
    }

    // Fall back to current entry
    const current = await this.getSourceByName(name);
    return current ? [current] : [];
  }

  // --------------------------------------------------------------------------
  // Document Trust Status
  // --------------------------------------------------------------------------

  /**
   * Update the trust status of a document in strategic_documents.
   * Called by the Trust Agent after source evaluation.
   *
   * @param documentId - Document ID to update
   * @param status - New trust status
   * @param assessedBy - Who assessed (specialist ID or human username)
   */
  async updateDocumentTrustStatus(
    documentId: string,
    status: DocumentTrustStatus,
    assessedBy: string,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE strategic_documents
       SET trust_status = $1,
           trust_assessed_by = $2,
           trust_assessed_at = NOW()
       WHERE id = $3`,
      [status, assessedBy, documentId],
    );
  }

  // --------------------------------------------------------------------------
  // Row Mapping
  // --------------------------------------------------------------------------

  /**
   * Map a database row to a SourceEntry object.
   */
  private mapRow(row: Record<string, unknown>): SourceEntry {
    return {
      id: row.id as string,
      sourceName: row.source_name as string,
      sourceType: row.source_type as string,
      defaultReliability: (row.default_reliability as SourceReliability) ?? null,
      trustNotes: (row.trust_notes as string) ?? null,
      isBlocked: row.is_blocked === true,
      createdAt: (row.created_at as Date)?.toISOString?.() ?? String(row.created_at),
      updatedAt: (row.updated_at as Date)?.toISOString?.() ?? String(row.updated_at),
    };
  }
}

/** Singleton instance for use across the application */
export const sourceStore = new SourceStore();
