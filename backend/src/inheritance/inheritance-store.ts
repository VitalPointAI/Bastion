/**
 * Inheritance Store
 *
 * Phase 26: Strategic Environment Inheritance
 * Phase 38: Inheritance Deepening — extended store for FRAGO drafts,
 *           interpretation acks, mission status snapshots, and RFI subtypes.
 *
 * Database CRUD for inheritance tables: acknowledgments, annotations, RFIs,
 * RFI messages, changelog, interpretation acknowledgments, FRAGO drafts,
 * and mission status snapshots. Also handles ancestor/descendant chain traversal
 * and cache staleness marking.
 *
 * Tables: inheritance_acknowledgments, inheritance_annotations, inheritance_rfis,
 *         inheritance_rfi_messages, inheritance_changelog, interpretation_acknowledgments,
 *         frago_drafts, mission_status_snapshots
 * Also ALTERs: problem_set_subscriptions (adds subscription_type column),
 *              inheritance_rfis (adds rfi_subtype, resolution columns)
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
  InterpretationAcknowledgment,
  FRAGODraft,
  FRAGOStatus,
  MissionStatusSnapshot,
  RFISubtype,
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

  // Phase 38: Add new columns to existing tables
  await pool.query(`
    ALTER TABLE inheritance_rfis
      ADD COLUMN IF NOT EXISTS rfi_subtype TEXT NOT NULL DEFAULT 'clarification';
    ALTER TABLE inheritance_rfis
      ADD COLUMN IF NOT EXISTS resolution TEXT;
  `);

  // Phase 38: Create new tables for interpretation acks, FRAGO drafts, mission status
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interpretation_acknowledgments (
      id TEXT PRIMARY KEY,
      annotation_id TEXT NOT NULL REFERENCES inheritance_annotations(id) ON DELETE CASCADE,
      parent_problem_set_id TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      rfi_id TEXT,
      acted_by TEXT NOT NULL,
      acted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_iack_interp_annotation ON interpretation_acknowledgments(annotation_id);
    CREATE INDEX IF NOT EXISTS idx_iack_interp_parent ON interpretation_acknowledgments(parent_problem_set_id);

    CREATE TABLE IF NOT EXISTS frago_drafts (
      id TEXT PRIMARY KEY,
      parent_problem_set_id TEXT NOT NULL,
      child_problem_set_id TEXT NOT NULL,
      source_opord_version TEXT NOT NULL,
      previous_opord_version TEXT NOT NULL,
      changed_paragraphs INTEGER[] NOT NULL,
      ai_draft_content TEXT NOT NULL,
      edited_content TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_by TEXT,
      distributed_at TIMESTAMPTZ,
      acknowledged_by TEXT,
      acknowledged_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_frago_parent ON frago_drafts(parent_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_frago_child ON frago_drafts(child_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_frago_status ON frago_drafts(status);

    CREATE TABLE IF NOT EXISTS mission_status_snapshots (
      id TEXT PRIMARY KEY,
      child_problem_set_id TEXT NOT NULL UNIQUE,
      child_problem_set_name TEXT NOT NULL,
      parent_problem_set_id TEXT NOT NULL,
      mission_state TEXT NOT NULL,
      mdmp_phase TEXT,
      percent_complete INTEGER DEFAULT 0,
      key_events JSONB DEFAULT '[]',
      resource_status JSONB DEFAULT '{}',
      objective_progress JSONB DEFAULT '[]',
      last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mstat_parent ON mission_status_snapshots(parent_problem_set_id);
    CREATE INDEX IF NOT EXISTS idx_mstat_child ON mission_status_snapshots(child_problem_set_id);
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

  // ==========================================================================
  // Phase 38: RFI Subtype Methods
  // ==========================================================================

  /**
   * Create a new RFI with subtype classification.
   */
  async createRFIWithSubtype(input: {
    requestingProblemSetId: string;
    targetProblemSetId: string;
    targetItemId: string;
    targetItemType: string;
    subject: string;
    rfiSubtype: RFISubtype;
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
        rfi_subtype, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, NOW())
      RETURNING *
      `,
      [
        id, input.requestingProblemSetId, input.targetProblemSetId,
        input.targetItemId, input.targetItemType, input.subject,
        input.rfiSubtype, input.createdBy,
      ],
    );

    return this.mapRFIRow(result.rows[0]);
  }

  /**
   * Get RFIs filtered by subtype for a problem set.
   */
  async getRFIsBySubtype(problemSetId: string, subtype: RFISubtype): Promise<InheritanceRFI[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT * FROM inheritance_rfis
      WHERE (requesting_problem_set_id = $1 OR target_problem_set_id = $1)
        AND rfi_subtype = $2
      ORDER BY created_at DESC
      `,
      [problemSetId, subtype],
    );

    return result.rows.map((row) => this.mapRFIRow(row));
  }

  /**
   * Resolve a modification request RFI with approval or denial.
   */
  async resolveModificationRequest(
    rfiId: string,
    resolution: 'approved' | 'denied',
  ): Promise<InheritanceRFI> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      UPDATE inheritance_rfis
      SET resolution = $1, status = 'closed', closed_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [resolution, rfiId],
    );

    if (result.rows.length === 0) {
      throw new Error(`RFI not found: ${rfiId}`);
    }

    return this.mapRFIRow(result.rows[0]);
  }

  // ==========================================================================
  // Phase 38: Interpretation Acknowledgment Methods
  // ==========================================================================

  /**
   * Create an interpretation acknowledgment from a parent PS.
   */
  async createInterpretationAck(
    data: Omit<InterpretationAcknowledgment, 'actedAt'>,
  ): Promise<InterpretationAcknowledgment> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      INSERT INTO interpretation_acknowledgments (
        id, annotation_id, parent_problem_set_id, action,
        comment, rfi_id, acted_by, acted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
      `,
      [
        data.id, data.annotationId, data.parentProblemSetId,
        data.action, data.comment, data.rfiId, data.actedBy,
      ],
    );

    return this.mapInterpretationAckRow(result.rows[0]);
  }

  /**
   * Get all interpretation acks for a parent problem set, joined with annotation details.
   */
  async getInterpretationAcksForParent(
    parentProblemSetId: string,
  ): Promise<InterpretationAcknowledgment[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT ia.* FROM interpretation_acknowledgments ia
      WHERE ia.parent_problem_set_id = $1
      ORDER BY ia.acted_at DESC
      `,
      [parentProblemSetId],
    );

    return result.rows.map((row) => this.mapInterpretationAckRow(row));
  }

  /**
   * Get the interpretation ack status for a specific annotation.
   */
  async getInterpretationAckForAnnotation(
    annotationId: string,
  ): Promise<InterpretationAcknowledgment | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT * FROM interpretation_acknowledgments
      WHERE annotation_id = $1
      ORDER BY acted_at DESC
      LIMIT 1
      `,
      [annotationId],
    );

    if (result.rows.length === 0) return null;
    return this.mapInterpretationAckRow(result.rows[0]);
  }

  private mapInterpretationAckRow(row: unknown): InterpretationAcknowledgment {
    const r = row as {
      id: string; annotation_id: string; parent_problem_set_id: string;
      action: string; comment: string | null; rfi_id: string | null;
      acted_by: string; acted_at: Date;
    };
    return {
      id: r.id,
      annotationId: r.annotation_id,
      parentProblemSetId: r.parent_problem_set_id,
      action: r.action as InterpretationAcknowledgment['action'],
      comment: r.comment,
      rfiId: r.rfi_id,
      actedBy: r.acted_by,
      actedAt: new Date(r.acted_at),
    };
  }

  // ==========================================================================
  // Phase 38: FRAGO Draft Methods
  // ==========================================================================

  /**
   * Create a new FRAGO draft.
   */
  async createFRAGODraft(
    data: Omit<FRAGODraft, 'createdAt'>,
  ): Promise<FRAGODraft> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      INSERT INTO frago_drafts (
        id, parent_problem_set_id, child_problem_set_id,
        source_opord_version, previous_opord_version,
        changed_paragraphs, ai_draft_content, edited_content,
        status, approved_by, distributed_at, acknowledged_by,
        acknowledged_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
      `,
      [
        data.id, data.parentProblemSetId, data.childProblemSetId,
        data.sourceOpordVersion, data.previousOpordVersion,
        data.changedParagraphs, data.aiDraftContent, data.editedContent,
        data.status, data.approvedBy, data.distributedAt,
        data.acknowledgedBy, data.acknowledgedAt,
      ],
    );

    return this.mapFRAGORow(result.rows[0]);
  }

  /**
   * Get a FRAGO draft by ID.
   */
  async getFRAGODraft(id: string): Promise<FRAGODraft | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM frago_drafts WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) return null;
    return this.mapFRAGORow(result.rows[0]);
  }

  /**
   * Get all FRAGO drafts for a parent problem set.
   */
  async getFRAGODraftsForParent(parentProblemSetId: string): Promise<FRAGODraft[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM frago_drafts WHERE parent_problem_set_id = $1 ORDER BY created_at DESC',
      [parentProblemSetId],
    );

    return result.rows.map((row) => this.mapFRAGORow(row));
  }

  /**
   * Get all FRAGO drafts for a child problem set.
   */
  async getFRAGODraftsForChild(childProblemSetId: string): Promise<FRAGODraft[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM frago_drafts WHERE child_problem_set_id = $1 ORDER BY created_at DESC',
      [childProblemSetId],
    );

    return result.rows.map((row) => this.mapFRAGORow(row));
  }

  /**
   * Update FRAGO status and associated fields.
   */
  async updateFRAGOStatus(
    id: string,
    status: FRAGOStatus,
    updates: {
      approvedBy?: string;
      distributedAt?: Date;
      acknowledgedBy?: string;
      acknowledgedAt?: Date;
    } = {},
  ): Promise<FRAGODraft> {
    await this.ensureInitialized();
    const pool = getPool();

    const setClauses: string[] = ['status = $1'];
    const params: unknown[] = [status, id];
    let paramIndex = 3;

    if (updates.approvedBy !== undefined) {
      setClauses.push(`approved_by = $${paramIndex}`);
      params.push(updates.approvedBy);
      paramIndex++;
    }
    if (updates.distributedAt !== undefined) {
      setClauses.push(`distributed_at = $${paramIndex}`);
      params.push(updates.distributedAt);
      paramIndex++;
    }
    if (updates.acknowledgedBy !== undefined) {
      setClauses.push(`acknowledged_by = $${paramIndex}`);
      params.push(updates.acknowledgedBy);
      paramIndex++;
    }
    if (updates.acknowledgedAt !== undefined) {
      setClauses.push(`acknowledged_at = $${paramIndex}`);
      params.push(updates.acknowledgedAt);
    }

    const result = await pool.query(
      `UPDATE frago_drafts SET ${setClauses.join(', ')} WHERE id = $2 RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      throw new Error(`FRAGO draft not found: ${id}`);
    }

    return this.mapFRAGORow(result.rows[0]);
  }

  /**
   * Update FRAGO edited content (commander edits before approval).
   */
  async updateFRAGOContent(id: string, editedContent: string): Promise<FRAGODraft> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `UPDATE frago_drafts SET edited_content = $1 WHERE id = $2 RETURNING *`,
      [editedContent, id],
    );

    if (result.rows.length === 0) {
      throw new Error(`FRAGO draft not found: ${id}`);
    }

    return this.mapFRAGORow(result.rows[0]);
  }

  private mapFRAGORow(row: unknown): FRAGODraft {
    const r = row as {
      id: string; parent_problem_set_id: string; child_problem_set_id: string;
      source_opord_version: string; previous_opord_version: string;
      changed_paragraphs: number[]; ai_draft_content: string;
      edited_content: string | null; status: string; approved_by: string | null;
      distributed_at: Date | null; acknowledged_by: string | null;
      acknowledged_at: Date | null; created_at: Date;
    };
    return {
      id: r.id,
      parentProblemSetId: r.parent_problem_set_id,
      childProblemSetId: r.child_problem_set_id,
      sourceOpordVersion: r.source_opord_version,
      previousOpordVersion: r.previous_opord_version,
      changedParagraphs: r.changed_paragraphs,
      aiDraftContent: r.ai_draft_content,
      editedContent: r.edited_content,
      status: r.status as FRAGODraft['status'],
      approvedBy: r.approved_by,
      distributedAt: r.distributed_at ? new Date(r.distributed_at) : null,
      acknowledgedBy: r.acknowledged_by,
      acknowledgedAt: r.acknowledged_at ? new Date(r.acknowledged_at) : null,
      createdAt: new Date(r.created_at),
    };
  }

  // ==========================================================================
  // Phase 38: Mission Status Snapshot Methods
  // ==========================================================================

  /**
   * Upsert a mission status snapshot for a child problem set.
   * Uses child_problem_set_id as conflict key for idempotent updates.
   */
  async upsertMissionStatus(data: MissionStatusSnapshot): Promise<MissionStatusSnapshot> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      INSERT INTO mission_status_snapshots (
        id, child_problem_set_id, child_problem_set_name,
        parent_problem_set_id, mission_state, mdmp_phase,
        percent_complete, key_events, resource_status,
        objective_progress, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (child_problem_set_id) DO UPDATE SET
        child_problem_set_name = EXCLUDED.child_problem_set_name,
        parent_problem_set_id = EXCLUDED.parent_problem_set_id,
        mission_state = EXCLUDED.mission_state,
        mdmp_phase = EXCLUDED.mdmp_phase,
        percent_complete = EXCLUDED.percent_complete,
        key_events = EXCLUDED.key_events,
        resource_status = EXCLUDED.resource_status,
        objective_progress = EXCLUDED.objective_progress,
        last_updated = NOW()
      RETURNING *
      `,
      [
        data.id, data.childProblemSetId, data.childProblemSetName,
        data.parentProblemSetId, data.missionState, data.mdmpPhase,
        data.percentComplete, JSON.stringify(data.keyEvents),
        JSON.stringify(data.resourceStatus), JSON.stringify(data.objectiveProgress),
      ],
    );

    return this.mapMissionStatusRow(result.rows[0]);
  }

  /**
   * Get all child mission statuses for a parent problem set.
   */
  async getMissionStatusForParent(parentProblemSetId: string): Promise<MissionStatusSnapshot[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT * FROM mission_status_snapshots
      WHERE parent_problem_set_id = $1
      ORDER BY last_updated DESC
      `,
      [parentProblemSetId],
    );

    return result.rows.map((row) => this.mapMissionStatusRow(row));
  }

  /**
   * Get the mission status for a specific child problem set.
   */
  async getMissionStatusForChild(childProblemSetId: string): Promise<MissionStatusSnapshot | null> {
    await this.ensureInitialized();
    const pool = getPool();

    const result = await pool.query(
      'SELECT * FROM mission_status_snapshots WHERE child_problem_set_id = $1',
      [childProblemSetId],
    );

    if (result.rows.length === 0) return null;
    return this.mapMissionStatusRow(result.rows[0]);
  }

  private mapMissionStatusRow(row: unknown): MissionStatusSnapshot {
    const r = row as {
      id: string; child_problem_set_id: string; child_problem_set_name: string;
      parent_problem_set_id: string; mission_state: string; mdmp_phase: string;
      percent_complete: number; key_events: unknown; resource_status: unknown;
      objective_progress: unknown; last_updated: Date;
    };
    return {
      id: r.id,
      childProblemSetId: r.child_problem_set_id,
      childProblemSetName: r.child_problem_set_name,
      parentProblemSetId: r.parent_problem_set_id,
      missionState: r.mission_state as MissionStatusSnapshot['missionState'],
      mdmpPhase: r.mdmp_phase,
      percentComplete: r.percent_complete,
      keyEvents: (r.key_events || []) as MissionStatusSnapshot['keyEvents'],
      resourceStatus: (r.resource_status || {}) as MissionStatusSnapshot['resourceStatus'],
      objectiveProgress: (r.objective_progress || []) as MissionStatusSnapshot['objectiveProgress'],
      lastUpdated: new Date(r.last_updated),
    };
  }

  // ==========================================================================
  // Phase 38: Read-Only Enforcement Helper
  // ==========================================================================

  /**
   * Check if an item belongs to an ancestor's content (inherited via subscription).
   * Returns true if the item is inherited and should be read-only.
   */
  async isInheritedContent(problemSetId: string, itemId: string): Promise<boolean> {
    await this.ensureInitialized();
    const pool = getPool();

    // Check if itemId exists in any ancestor's content that this PS subscribes to
    const result = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM problem_set_subscriptions pss
        WHERE pss.subscriber_problem_set_id = $1
          AND pss.subscription_type = 'inheritance'
          AND pss.approval_status = 'approved'
          AND EXISTS (
            SELECT 1 FROM problem_set_data_cache pdc
            WHERE pdc.consumer_problem_set_id = $1
              AND pdc.source_problem_set_id = pss.publisher_problem_set_id
              AND pdc.cached_data::text LIKE '%' || $2 || '%'
          )
      ) AS is_inherited
      `,
      [problemSetId, itemId],
    );

    return (result.rows[0] as { is_inherited: boolean }).is_inherited;
  }
}

// Singleton export
export const inheritanceStore = new InheritanceStore();
