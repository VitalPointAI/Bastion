/**
 * Inheritance Store
 *
 * Phase 26: Strategic Environment Inheritance
 *
 * Database CRUD for inheritance tables: acknowledgments, annotations, RFIs,
 * RFI messages, and changelog. Also handles ancestor/descendant chain traversal
 * and cache staleness marking.
 *
 * Tables: inheritance_acknowledgments, inheritance_annotations, inheritance_rfis,
 *         inheritance_rfi_messages, inheritance_changelog
 * Also ALTERs: problem_set_subscriptions (adds subscription_type column)
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  InheritanceAcknowledgment,
  InheritanceAnnotation,
  InheritanceRFI,
  RFIMessage,
  InheritanceChangelog,
  AncestorInfo,
  PendingAck,
} from './inheritance-types.js';
import type { Echelon } from '../problem-set/types.js';

// ============================================================================
// Table Initialization
// ============================================================================

async function initInheritanceTables(): Promise<void> {
  const pool = getPool();

  // Add subscription_type column to existing problem_set_subscriptions table
  await pool.query(`
    ALTER TABLE problem_set_subscriptions
      ADD COLUMN IF NOT EXISTS subscription_type TEXT NOT NULL DEFAULT 'subscription'
  `);

  // Create inheritance tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inheritance_acknowledgments (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      source_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      source_version TEXT NOT NULL,
      acknowledged_by TEXT NOT NULL,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(problem_set_id, source_problem_set_id, source_version)
    );
    CREATE INDEX IF NOT EXISTS idx_iack_ps ON inheritance_acknowledgments(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_iack_source ON inheritance_acknowledgments(source_problem_set_id);

    CREATE TABLE IF NOT EXISTS inheritance_annotations (
      id TEXT PRIMARY KEY,
      problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      source_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      target_item_id TEXT NOT NULL,
      target_item_type TEXT NOT NULL,
      annotation_type TEXT NOT NULL,
      content TEXT NOT NULL,
      based_on_version TEXT,
      is_stale BOOLEAN NOT NULL DEFAULT false,
      visibility TEXT NOT NULL DEFAULT 'upward',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_iann_ps ON inheritance_annotations(problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_iann_target ON inheritance_annotations(target_item_id);
    CREATE INDEX IF NOT EXISTS idx_iann_source ON inheritance_annotations(source_problem_set_id);

    CREATE TABLE IF NOT EXISTS inheritance_rfis (
      id TEXT PRIMARY KEY,
      requesting_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      target_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      target_item_id TEXT NOT NULL,
      target_item_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_irfi_requesting ON inheritance_rfis(requesting_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_irfi_target ON inheritance_rfis(target_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_irfi_status ON inheritance_rfis(status);

    CREATE TABLE IF NOT EXISTS inheritance_rfi_messages (
      id TEXT PRIMARY KEY,
      rfi_id TEXT NOT NULL REFERENCES inheritance_rfis(id) ON DELETE CASCADE,
      author_did TEXT NOT NULL,
      author_problem_set_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_irfim_rfi ON inheritance_rfi_messages(rfi_id);

    CREATE TABLE IF NOT EXISTS inheritance_changelog (
      id TEXT PRIMARY KEY,
      source_problem_set_id TEXT NOT NULL REFERENCES problem_sets(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL,
      change_severity TEXT NOT NULL DEFAULT 'minor',
      item_id TEXT NOT NULL,
      item_title TEXT,
      summary TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_iclog_source ON inheritance_changelog(source_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_iclog_created ON inheritance_changelog(created_at DESC);
  `);
}

// ============================================================================
// Inheritance Store
// ============================================================================

export class InheritanceStore {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initInheritanceTables();
      this.initialized = true;
    }
  }

  // ==========================================================================
  // Ancestor / Descendant Chain Traversal
  // ==========================================================================

  /**
   * Get the ancestor chain for a problem set using a recursive CTE.
   * Returns ancestors ordered from immediate parent (depth 1) to root.
   * Depth limited to 3 to match echelon hierarchy.
   */
  async getAncestorChain(problemSetId: string): Promise<AncestorInfo[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      WITH RECURSIVE ancestors AS (
        SELECT id, name, echelon, parent_problem_set_id, 0 AS depth
        FROM problem_sets
        WHERE id = $1
        UNION ALL
        SELECT ps.id, ps.name, ps.echelon, ps.parent_problem_set_id, a.depth + 1
        FROM problem_sets ps
        JOIN ancestors a ON ps.id = a.parent_problem_set_id
        WHERE a.depth < 3
      )
      SELECT id, name, echelon, depth FROM ancestors WHERE depth > 0 ORDER BY depth ASC
      `,
      [problemSetId],
    );

    return result.rows.map((row) => {
      const r = row as { id: string; name: string; echelon: string; depth: number };
      return {
        problemSetId: r.id,
        name: r.name,
        echelon: r.echelon as Echelon,
        depth: r.depth,
      };
    });
  }

  /**
   * Get all descendant problem set IDs walking down from a parent.
   * Depth limited to 3.
   */
  async getDescendantProblemSetIds(problemSetId: string): Promise<string[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      WITH RECURSIVE descendants AS (
        SELECT id, 0 AS depth
        FROM problem_sets
        WHERE id = $1
        UNION ALL
        SELECT ps.id, d.depth + 1
        FROM problem_sets ps
        JOIN descendants d ON ps.parent_problem_set_id = d.id
        WHERE d.depth < 3
      )
      SELECT id FROM descendants WHERE depth > 0
      `,
      [problemSetId],
    );

    return result.rows.map((row) => (row as { id: string }).id);
  }

  /**
   * Mark all descendant caches as stale for push invalidation.
   * Sets stale_at = NOW() on problem_set_data_cache for all descendants.
   */
  async markDescendantCachesStale(publisherProblemSetId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    const descendantIds = await this.getDescendantProblemSetIds(publisherProblemSetId);
    if (descendantIds.length === 0) return;

    await pool.query(
      `
      UPDATE problem_set_data_cache
      SET stale_at = NOW()
      WHERE source_problem_set_id = $1
        AND consumer_problem_set_id = ANY($2)
        AND stale_at IS NULL
      `,
      [publisherProblemSetId, descendantIds],
    );
  }

  // ==========================================================================
  // Changelog
  // ==========================================================================

  /**
   * Log a changelog entry for an inherited context change.
   */
  async logChangelog(
    sourceProblemSetId: string,
    changeType: string,
    changeSeverity: 'significant' | 'minor',
    itemId: string,
    itemTitle: string | null,
    summary: string | null = null,
  ): Promise<InheritanceChangelog> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `ICLOG-${randomUUID()}`;
    const result = await pool.query(
      `
      INSERT INTO inheritance_changelog (
        id, source_problem_set_id, change_type, change_severity,
        item_id, item_title, summary, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
      `,
      [id, sourceProblemSetId, changeType, changeSeverity, itemId, itemTitle, summary],
    );

    const row = result.rows[0] as {
      id: string; source_problem_set_id: string; change_type: string;
      change_severity: string; item_id: string; item_title: string | null;
      summary: string | null; created_at: Date;
    };
    return {
      id: row.id,
      sourceProblemSetId: row.source_problem_set_id,
      changeType: row.change_type as InheritanceChangelog['changeType'],
      changeSeverity: row.change_severity as InheritanceChangelog['changeSeverity'],
      itemId: row.item_id,
      itemTitle: row.item_title,
      summary: row.summary,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Get changelog entries for a source problem set, ordered by most recent.
   */
  async getChangelog(sourceProblemSetId: string, limit = 50): Promise<InheritanceChangelog[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT * FROM inheritance_changelog
      WHERE source_problem_set_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [sourceProblemSetId, limit],
    );

    return result.rows.map((row) => {
      const r = row as {
        id: string; source_problem_set_id: string; change_type: string;
        change_severity: string; item_id: string; item_title: string | null;
        summary: string | null; created_at: Date;
      };
      return {
        id: r.id,
        sourceProblemSetId: r.source_problem_set_id,
        changeType: r.change_type as InheritanceChangelog['changeType'],
        changeSeverity: r.change_severity as InheritanceChangelog['changeSeverity'],
        itemId: r.item_id,
        itemTitle: r.item_title,
        summary: r.summary,
        createdAt: new Date(r.created_at),
      };
    });
  }

  // ==========================================================================
  // Acknowledgments
  // ==========================================================================

  /**
   * Create a commander acknowledgment of inherited context.
   */
  async createAcknowledgment(
    problemSetId: string,
    sourceProblemSetId: string,
    sourceVersion: string,
    acknowledgedBy: string,
  ): Promise<InheritanceAcknowledgment> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `IACK-${randomUUID()}`;
    const result = await pool.query(
      `
      INSERT INTO inheritance_acknowledgments (
        id, problem_set_id, source_problem_set_id, source_version,
        acknowledged_by, acknowledged_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (problem_set_id, source_problem_set_id, source_version) DO NOTHING
      RETURNING *
      `,
      [id, problemSetId, sourceProblemSetId, sourceVersion, acknowledgedBy],
    );

    if (result.rows.length === 0) {
      // Already acknowledged this version — return existing
      const existing = await pool.query(
        `SELECT * FROM inheritance_acknowledgments
         WHERE problem_set_id = $1 AND source_problem_set_id = $2 AND source_version = $3`,
        [problemSetId, sourceProblemSetId, sourceVersion],
      );
      const row = existing.rows[0] as {
        id: string; problem_set_id: string; source_problem_set_id: string;
        source_version: string; acknowledged_by: string; acknowledged_at: Date;
      };
      return {
        id: row.id,
        problemSetId: row.problem_set_id,
        sourceProblemSetId: row.source_problem_set_id,
        sourceVersion: row.source_version,
        acknowledgedBy: row.acknowledged_by,
        acknowledgedAt: new Date(row.acknowledged_at),
      };
    }

    const row = result.rows[0] as {
      id: string; problem_set_id: string; source_problem_set_id: string;
      source_version: string; acknowledged_by: string; acknowledged_at: Date;
    };
    return {
      id: row.id,
      problemSetId: row.problem_set_id,
      sourceProblemSetId: row.source_problem_set_id,
      sourceVersion: row.source_version,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: new Date(row.acknowledged_at),
    };
  }

  /**
   * Get pending acknowledgments for a problem set.
   * Compares current cache versions with latest acknowledgment versions.
   */
  async getPendingAcknowledgments(problemSetId: string): Promise<PendingAck[]> {
    await this.ensureInitialized();
    const pool = getPool();

    // Find all inheritance subscriptions and compare cache versions with acknowledgments
    const result = await pool.query(
      `
      SELECT DISTINCT ON (pss.publisher_problem_set_id)
        pss.publisher_problem_set_id,
        ps.name AS source_name,
        ps.echelon AS source_echelon,
        pdc.source_version AS current_version,
        (
          SELECT ia.source_version
          FROM inheritance_acknowledgments ia
          WHERE ia.problem_set_id = $1
            AND ia.source_problem_set_id = pss.publisher_problem_set_id
          ORDER BY ia.acknowledged_at DESC
          LIMIT 1
        ) AS last_acknowledged_version
      FROM problem_set_subscriptions pss
      JOIN problem_sets ps ON ps.id = pss.publisher_problem_set_id
      LEFT JOIN problem_set_data_cache pdc
        ON pdc.consumer_problem_set_id = $1
        AND pdc.source_problem_set_id = pss.publisher_problem_set_id
      WHERE pss.subscriber_problem_set_id = $1
        AND pss.subscription_type = 'inheritance'
        AND pss.approval_status = 'approved'
        AND pdc.source_version IS NOT NULL
      ORDER BY pss.publisher_problem_set_id
      `,
      [problemSetId],
    );

    const pending: PendingAck[] = [];
    for (const row of result.rows) {
      const r = row as {
        publisher_problem_set_id: string;
        source_name: string;
        source_echelon: string;
        current_version: string;
        last_acknowledged_version: string | null;
      };
      // Only include if version differs from last acknowledgment
      if (r.current_version !== r.last_acknowledged_version) {
        pending.push({
          sourceProblemSetId: r.publisher_problem_set_id,
          sourceProblemSetName: r.source_name,
          sourceEchelon: r.source_echelon as Echelon,
          currentVersion: r.current_version,
          lastAcknowledgedVersion: r.last_acknowledged_version,
        });
      }
    }

    return pending;
  }

  // ==========================================================================
  // Annotations
  // ==========================================================================

  /**
   * Create an annotation on an inherited item.
   */
  async createAnnotation(input: {
    problemSetId: string;
    sourceProblemSetId: string;
    targetItemId: string;
    targetItemType: 'strategic_document' | 'graph_summary';
    annotationType: 'inline' | 'interpretation';
    content: string;
    basedOnVersion: string | null;
    visibility: 'upward' | 'local_only';
    createdBy: string;
  }): Promise<InheritanceAnnotation> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `IANN-${randomUUID()}`;
    const result = await pool.query(
      `
      INSERT INTO inheritance_annotations (
        id, problem_set_id, source_problem_set_id, target_item_id,
        target_item_type, annotation_type, content, based_on_version,
        is_stale, visibility, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10, NOW(), NOW())
      RETURNING *
      `,
      [
        id, input.problemSetId, input.sourceProblemSetId, input.targetItemId,
        input.targetItemType, input.annotationType, input.content,
        input.basedOnVersion, input.visibility, input.createdBy,
      ],
    );

    return this.mapAnnotationRow(result.rows[0]);
  }

  /**
   * Get annotations for a problem set, optionally filtered by target item.
   */
  async getAnnotations(problemSetId: string, targetItemId?: string): Promise<InheritanceAnnotation[]> {
    await this.ensureInitialized();
    const pool = getPool();

    let query = 'SELECT * FROM inheritance_annotations WHERE problem_set_id = $1';
    const params: unknown[] = [problemSetId];

    if (targetItemId) {
      query += ' AND target_item_id = $2';
      params.push(targetItemId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows.map((row) => this.mapAnnotationRow(row));
  }

  /**
   * Update annotation content and reset updated_at.
   */
  async updateAnnotation(id: string, content: string): Promise<InheritanceAnnotation> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      UPDATE inheritance_annotations
      SET content = $1, updated_at = NOW(), is_stale = false
      WHERE id = $2
      RETURNING *
      `,
      [content, id],
    );

    if (result.rows.length === 0) {
      throw new Error(`Annotation not found: ${id}`);
    }

    return this.mapAnnotationRow(result.rows[0]);
  }

  /**
   * Mark annotations as stale when source content updates.
   */
  async markAnnotationsStale(sourceProblemSetId: string, targetItemId: string): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    await pool.query(
      `
      UPDATE inheritance_annotations
      SET is_stale = true, updated_at = NOW()
      WHERE source_problem_set_id = $1
        AND target_item_id = $2
        AND is_stale = false
      `,
      [sourceProblemSetId, targetItemId],
    );
  }

  /**
   * Get annotations visible to a parent problem set (upward visibility).
   * Used when a parent PS wants to see child interpretations.
   */
  async getAnnotationsForParentView(
    sourceProblemSetId: string,
    visibility?: 'upward' | 'local_only',
  ): Promise<InheritanceAnnotation[]> {
    await this.ensureInitialized();
    const pool = getPool();

    let query = 'SELECT * FROM inheritance_annotations WHERE source_problem_set_id = $1';
    const params: unknown[] = [sourceProblemSetId];

    if (visibility) {
      query += ' AND visibility = $2';
      params.push(visibility);
    } else {
      // Default: only show upward-visible annotations to parent
      query += " AND visibility = 'upward'";
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows.map((row) => this.mapAnnotationRow(row));
  }

  private mapAnnotationRow(row: unknown): InheritanceAnnotation {
    const r = row as {
      id: string; problem_set_id: string; source_problem_set_id: string;
      target_item_id: string; target_item_type: string; annotation_type: string;
      content: string; based_on_version: string | null; is_stale: boolean;
      visibility: string; created_by: string; created_at: Date; updated_at: Date;
    };
    return {
      id: r.id,
      problemSetId: r.problem_set_id,
      sourceProblemSetId: r.source_problem_set_id,
      targetItemId: r.target_item_id,
      targetItemType: r.target_item_type as InheritanceAnnotation['targetItemType'],
      annotationType: r.annotation_type as InheritanceAnnotation['annotationType'],
      content: r.content,
      basedOnVersion: r.based_on_version,
      isStale: r.is_stale,
      visibility: r.visibility as InheritanceAnnotation['visibility'],
      createdBy: r.created_by,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }

  // ==========================================================================
  // RFIs (Request for Information)
  // ==========================================================================

  /**
   * Create a new RFI thread between problem sets.
   */
  async createRFI(input: {
    requestingProblemSetId: string;
    targetProblemSetId: string;
    targetItemId: string;
    targetItemType: string;
    subject: string;
    createdBy: string;
  }): Promise<InheritanceRFI> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `IRFI-${randomUUID()}`;
    const result = await pool.query(
      `
      INSERT INTO inheritance_rfis (
        id, requesting_problem_set_id, target_problem_set_id,
        target_item_id, target_item_type, subject, status,
        created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())
      RETURNING *
      `,
      [
        id, input.requestingProblemSetId, input.targetProblemSetId,
        input.targetItemId, input.targetItemType, input.subject,
        input.createdBy,
      ],
    );

    return this.mapRFIRow(result.rows[0]);
  }

  /**
   * Get RFIs for a problem set, filtered by direction (sent or received).
   */
  async getRFIs(problemSetId: string, direction: 'sent' | 'received'): Promise<InheritanceRFI[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const column = direction === 'sent' ? 'requesting_problem_set_id' : 'target_problem_set_id';
    const result = await pool.query(
      `SELECT * FROM inheritance_rfis WHERE ${column} = $1 ORDER BY created_at DESC`,
      [problemSetId],
    );

    return result.rows.map((row) => this.mapRFIRow(row));
  }

  /**
   * Add a message to an RFI thread.
   */
  async addRFIMessage(
    rfiId: string,
    authorDid: string,
    authorProblemSetId: string,
    content: string,
  ): Promise<RFIMessage> {
    await this.ensureInitialized();
    const pool = getPool();

    const id = `IRFIM-${randomUUID()}`;
    const result = await pool.query(
      `
      INSERT INTO inheritance_rfi_messages (
        id, rfi_id, author_did, author_problem_set_id, content, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
      `,
      [id, rfiId, authorDid, authorProblemSetId, content],
    );

    const row = result.rows[0] as {
      id: string; rfi_id: string; author_did: string;
      author_problem_set_id: string; content: string; created_at: Date;
    };
    return {
      id: row.id,
      rfiId: row.rfi_id,
      authorDid: row.author_did,
      authorProblemSetId: row.author_problem_set_id,
      content: row.content,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Get all messages for an RFI thread.
   */
  async getRFIMessages(rfiId: string): Promise<RFIMessage[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM inheritance_rfi_messages WHERE rfi_id = $1 ORDER BY created_at ASC',
      [rfiId],
    );

    return result.rows.map((row) => {
      const r = row as {
        id: string; rfi_id: string; author_did: string;
        author_problem_set_id: string; content: string; created_at: Date;
      };
      return {
        id: r.id,
        rfiId: r.rfi_id,
        authorDid: r.author_did,
        authorProblemSetId: r.author_problem_set_id,
        content: r.content,
        createdAt: new Date(r.created_at),
      };
    });
  }

  /**
   * Update RFI status (open -> responded -> closed).
   */
  async updateRFIStatus(rfiId: string, status: 'open' | 'responded' | 'closed'): Promise<InheritanceRFI> {
    await this.ensureInitialized();
    const pool = getPool();

    const closedAt = status === 'closed' ? 'NOW()' : 'NULL';
    const result = await pool.query(
      `
      UPDATE inheritance_rfis
      SET status = $1, closed_at = ${closedAt}
      WHERE id = $2
      RETURNING *
      `,
      [status, rfiId],
    );

    if (result.rows.length === 0) {
      throw new Error(`RFI not found: ${rfiId}`);
    }

    return this.mapRFIRow(result.rows[0]);
  }

  private mapRFIRow(row: unknown): InheritanceRFI {
    const r = row as {
      id: string; requesting_problem_set_id: string; target_problem_set_id: string;
      target_item_id: string; target_item_type: string; subject: string;
      status: string; created_by: string; created_at: Date; closed_at: Date | null;
      rfi_subtype?: string; resolution?: string | null;
    };
    return {
      id: r.id,
      requestingProblemSetId: r.requesting_problem_set_id,
      targetProblemSetId: r.target_problem_set_id,
      targetItemId: r.target_item_id,
      targetItemType: r.target_item_type,
      subject: r.subject,
      status: r.status as InheritanceRFI['status'],
      rfiSubtype: (r.rfi_subtype || 'clarification') as InheritanceRFI['rfiSubtype'],
      resolution: (r.resolution || null) as InheritanceRFI['resolution'],
      createdBy: r.created_by,
      createdAt: new Date(r.created_at),
      closedAt: r.closed_at ? new Date(r.closed_at) : null,
    };
  }
}

// Singleton export
export const inheritanceStore = new InheritanceStore();
