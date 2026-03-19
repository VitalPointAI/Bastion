/**
 * Inheritance Service
 *
 * Phase 26: Strategic Environment Inheritance
 *
 * Business logic for auto-inheritance chain creation, ancestor traversal,
 * push invalidation, and context assembly. Orchestrates between
 * InheritanceStore and ProblemSetSubscriptionStore.
 */

import { getPool } from '../lib/database.js';
import { inheritanceStore } from './inheritance-store.js';
import { problemSetSubscriptionStore } from '../problem-set/problem-set-subscription-store.js';
import { problemSetActivityStore } from '../problem-set/problem-set-activity-store.js';
import type {
  InheritedContextResponse,
  InterpretationAcknowledgment,
  InheritanceRFI,
} from './inheritance-types.js';
// ============================================================================
// Change Severity Classification
// ============================================================================

const SIGNIFICANT_CHANGE_TYPES = [
  'document_added',
  'document_removed',
  'graph_major_update',
] as const;

/**
 * Classify a change type as significant or minor per RESEARCH.md.
 */
function classifyChangeSeverity(changeType: string): 'significant' | 'minor' {
  if ((SIGNIFICANT_CHANGE_TYPES as readonly string[]).includes(changeType)) {
    return 'significant';
  }
  return 'minor';
}

// ============================================================================
// Inheritance Service
// ============================================================================

export class InheritanceService {

  /**
   * Create inheritance subscriptions from a child PS to its parent and all ancestors.
   *
   * Called after PS creation when parentProblemSetId is set. Walks the ancestor
   * chain, creates auto-approved subscriptions with subscription_type='inheritance'
   * for each ancestor, then materializes caches.
   */
  async createInheritanceChain(
    childProblemSetId: string,
    parentProblemSetId: string,
    requestedBy: string,
  ): Promise<void> {
    const pool = getPool();

    // Get the full ancestor chain starting from the parent
    const ancestors = await inheritanceStore.getAncestorChain(parentProblemSetId);
    // ancestors[0] = parent's parent (grandparent), etc.
    // We need the parent itself plus all its ancestors
    const allAncestorIds = [parentProblemSetId, ...ancestors.map(a => a.problemSetId)];

    for (const ancestorId of allAncestorIds) {
      try {
        // Create subscription (starts as 'pending')
        const sub = await problemSetSubscriptionStore.createSubscription({
          subscriberProblemSetId: childProblemSetId,
          publisherProblemSetId: ancestorId,
          dataTypes: ['*'], // all types for inheritance
          approvalMechanism: 'auto',
          requestedBy,
        });

        // Auto-approve immediately for inheritance
        await problemSetSubscriptionStore.updateApprovalStatus(
          sub.id,
          'approved',
          'system',
        );

        // Set subscription_type to 'inheritance' via direct SQL
        await pool.query(
          `UPDATE problem_set_subscriptions SET subscription_type = 'inheritance' WHERE id = $1`,
          [sub.id],
        );

        // Materialize cache for this subscription
        await problemSetSubscriptionStore.materializeCache(childProblemSetId);
      } catch (error) {
        // Skip if subscription already exists (UNIQUE constraint)
        const message = error instanceof Error ? error.message : '';
        if (message.includes('duplicate key') || message.includes('unique constraint')) {
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Handle parent context changes: mark descendant caches stale, log changelog,
   * notify descendants via activity log.
   *
   * Called when a parent PS's strategic documents or graph data change.
   */
  async onParentContextChanged(
    publisherProblemSetId: string,
    changeType: string,
    changeSeverity: 'significant' | 'minor',
    itemId: string,
    itemTitle: string,
  ): Promise<void> {
    // 1. Mark all descendant caches as stale
    await inheritanceStore.markDescendantCachesStale(publisherProblemSetId);

    // 2. Log changelog entry
    await inheritanceStore.logChangelog(
      publisherProblemSetId,
      changeType,
      changeSeverity,
      itemId,
      itemTitle,
    );

    // 3. Mark annotations on this item as stale
    await inheritanceStore.markAnnotationsStale(publisherProblemSetId, itemId);

    // 4. Log activity for notification system in each descendant
    const descendants = await inheritanceStore.getDescendantProblemSetIds(publisherProblemSetId);
    const activityType = changeSeverity === 'significant'
      ? 'strategic_context_major_update'
      : 'strategic_context_minor_update';

    for (const descendantId of descendants) {
      await problemSetActivityStore.log(
        descendantId,
        activityType,
        'system',
        null,
        { sourceProblemSetId: publisherProblemSetId, changeType, itemId, itemTitle },
      );
    }
  }

  /**
   * Build the full InheritedContextResponse for a problem set.
   * Assembles ancestors, cached documents, graph summaries, sync status,
   * pending acknowledgments, and recent changelog.
   */
  async getInheritedContext(problemSetId: string): Promise<InheritedContextResponse> {
    const pool = getPool();

    // Get ancestor chain
    const ancestors = await inheritanceStore.getAncestorChain(problemSetId);

    if (ancestors.length === 0) {
      return {
        ancestors: [],
        inheritedDocuments: [],
        inheritedGraphSummaries: [],
        syncStatus: { lastSyncAt: null, hasStaleCaches: false, pendingAcknowledgments: 0 },
        changelog: [],
      };
    }

    const ancestorIds = ancestors.map(a => a.problemSetId);

    // Build ancestor name/echelon lookup
    const ancestorLookup = new Map(
      ancestors.map(a => [a.problemSetId, { name: a.name, echelon: a.echelon }]),
    );

    // Get cached data for subscriber
    const cacheResult = await pool.query(
      `
      SELECT id, source_problem_set_id, data_type, payload, source_version, cached_at, stale_at
      FROM problem_set_data_cache
      WHERE consumer_problem_set_id = $1
        AND source_problem_set_id = ANY($2)
      ORDER BY cached_at DESC
      `,
      [problemSetId, ancestorIds],
    );

    const inheritedDocuments: InheritedContextResponse['inheritedDocuments'] = [];
    const inheritedGraphSummaries: InheritedContextResponse['inheritedGraphSummaries'] = [];
    let hasStaleCaches = false;
    let lastSyncAt: string | null = null;

    for (const row of cacheResult.rows) {
      const r = row as {
        id: string; source_problem_set_id: string; data_type: string;
        payload: { documents?: Array<{ title: string; textContent: string }> };
        source_version: string; cached_at: Date; stale_at: Date | null;
      };

      if (r.stale_at) hasStaleCaches = true;
      const cachedAtStr = new Date(r.cached_at).toISOString();
      if (!lastSyncAt || cachedAtStr > lastSyncAt) lastSyncAt = cachedAtStr;

      const sourceInfo = ancestorLookup.get(r.source_problem_set_id);
      const sourceName = sourceInfo?.name ?? 'Unknown';
      const sourceEchelon = sourceInfo?.echelon ?? 'strategic';

      if (r.data_type === 'graph_summary') {
        // Graph summary cache entry
        const payload = r.payload as unknown;
        inheritedGraphSummaries.push({
          containerName: r.data_type,
          summary: payload,
          sourceProblemSetId: r.source_problem_set_id,
          sourceProblemSetName: sourceName,
          sourceEchelon,
          lastUpdated: cachedAtStr,
        });
      } else if (r.payload?.documents) {
        // Strategic document cache entries
        for (const doc of r.payload.documents) {
          inheritedDocuments.push({
            id: `${r.source_problem_set_id}-${r.data_type}-${doc.title}`,
            title: doc.title,
            docType: r.data_type,
            summary: doc.textContent.slice(0, 500),
            sourceProblemSetId: r.source_problem_set_id,
            sourceProblemSetName: sourceName,
            sourceEchelon,
            lastUpdated: cachedAtStr,
            isNew: false,   // Will be enriched with acknowledgment comparison
            isUpdated: r.stale_at !== null,
          });
        }
      }
    }

    // Get pending acknowledgments
    const pendingAcks = await inheritanceStore.getPendingAcknowledgments(problemSetId);

    // Get recent changelog from all ancestors
    const changelogEntries: InheritedContextResponse['changelog'] = [];
    for (const ancestorId of ancestorIds) {
      const entries = await inheritanceStore.getChangelog(ancestorId, 20);
      const sourceInfo = ancestorLookup.get(ancestorId);
      for (const entry of entries) {
        changelogEntries.push({
          id: entry.id,
          changeType: entry.changeType,
          changeSeverity: entry.changeSeverity,
          itemTitle: entry.itemTitle,
          summary: entry.summary,
          createdAt: entry.createdAt.toISOString(),
          sourceProblemSetName: sourceInfo?.name ?? 'Unknown',
        });
      }
    }

    // Sort changelog by date descending
    changelogEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      ancestors,
      inheritedDocuments,
      inheritedGraphSummaries,
      syncStatus: {
        lastSyncAt,
        hasStaleCaches,
        pendingAcknowledgments: pendingAcks.length,
      },
      changelog: changelogEntries.slice(0, 50),
    };
  }

  /**
   * Acknowledge inherited context from a source problem set.
   * Gets the current cache version and creates an acknowledgment record.
   */
  async acknowledgeContext(
    problemSetId: string,
    sourceProblemSetId: string,
    acknowledgedBy: string,
  ): Promise<void> {
    const pool = getPool();

    // Get current cache version for this source
    const cacheResult = await pool.query(
      `
      SELECT source_version FROM problem_set_data_cache
      WHERE consumer_problem_set_id = $1
        AND source_problem_set_id = $2
      LIMIT 1
      `,
      [problemSetId, sourceProblemSetId],
    );

    if (cacheResult.rows.length === 0) {
      throw new Error(`No cached data found from source ${sourceProblemSetId}`);
    }

    const version = (cacheResult.rows[0] as { source_version: string }).source_version;

    await inheritanceStore.createAcknowledgment(
      problemSetId,
      sourceProblemSetId,
      version,
      acknowledgedBy,
    );
  }

  /**
   * Backfill inheritance subscriptions for all existing parent-child relationships.
   * Idempotent: skips if subscription already exists.
   */
  async backfillExistingRelationships(): Promise<{ processed: number; created: number }> {
    const pool = getPool();

    // Find all problem sets with a parent
    const result = await pool.query(
      `SELECT id, parent_problem_set_id FROM problem_sets WHERE parent_problem_set_id IS NOT NULL`,
    );

    let processed = 0;
    let created = 0;

    for (const row of result.rows) {
      const r = row as { id: string; parent_problem_set_id: string };
      processed++;

      // Check if inheritance subscription already exists
      const existing = await pool.query(
        `SELECT id FROM problem_set_subscriptions
         WHERE subscriber_problem_set_id = $1
           AND publisher_problem_set_id = $2
           AND subscription_type = 'inheritance'`,
        [r.id, r.parent_problem_set_id],
      );

      if (existing.rows.length > 0) continue;

      try {
        await this.createInheritanceChain(r.id, r.parent_problem_set_id, 'system');
        created++;
      } catch (error) {
        // Log but don't fail on individual backfill errors
        console.warn(`Backfill failed for PS ${r.id}:`, error instanceof Error ? error.message : error);
      }
    }

    return { processed, created };
  }

  /**
   * Classify change severity per RESEARCH.md rules.
   */
  classifyChangeSeverity(changeType: string): 'significant' | 'minor' {
    return classifyChangeSeverity(changeType);
  }

  // ==========================================================================
  // Phase 38: Read-Only Enforcement
  // ==========================================================================

  /**
   * Enforce read-only on inherited content. Throws HTTP 403 if itemId is
   * inherited content for the given problem set. Doctrinal constraint:
   * inherited context cannot be modified at child level.
   */
  async enforceReadOnly(problemSetId: string, itemId: string): Promise<void> {
    try {
      const isInherited = await inheritanceStore.isInheritedContent(problemSetId, itemId);
      if (isInherited) {
        const error = new Error('Inherited content is read-only. Submit a modification request instead.');
        (error as Error & { statusCode: number }).statusCode = 403;
        throw error;
      }
    } catch (error) {
      if (error instanceof Error && (error as Error & { statusCode?: number }).statusCode === 403) {
        throw error;
      }
      console.error('[inheritance] enforceReadOnly check failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // ==========================================================================
  // Phase 38: Notification Count Aggregation
  // ==========================================================================

  /**
   * Aggregate notification counts for a problem set. Used by frontend badges
   * and PS selector dot indicators.
   */
  async getNotificationCounts(problemSetId: string): Promise<{
    pendingAcks: number;
    unreadChangelog: number;
    openRFIs: number;
    pendingFRAGOs: number;
  }> {
    try {
      // Pending acknowledgments (significant changes only)
      const pendingAcks = await inheritanceStore.getPendingAcknowledgments(problemSetId);
      const pendingAckCount = pendingAcks.length;

      // Unread changelog entries since last acknowledgment
      const pool = getPool();
      const ancestors = await inheritanceStore.getAncestorChain(problemSetId);
      const ancestorIds = ancestors.map(a => a.problemSetId);
      let unreadChangelog = 0;

      for (const ancestorId of ancestorIds) {
        // Get last ack time for this ancestor
        const lastAckResult = await pool.query(
          `SELECT MAX(acknowledged_at) as last_ack FROM inheritance_acknowledgments
           WHERE problem_set_id = $1 AND source_problem_set_id = $2`,
          [problemSetId, ancestorId],
        );
        const lastAck = (lastAckResult.rows[0] as { last_ack: Date | null })?.last_ack;

        // Count changelog entries since last ack (or all if never acked)
        let changelogQuery = `SELECT COUNT(*) as cnt FROM inheritance_changelog
          WHERE source_problem_set_id = $1`;
        const params: unknown[] = [ancestorId];

        if (lastAck) {
          changelogQuery += ` AND created_at > $2`;
          params.push(lastAck);
        }

        const changelogResult = await pool.query(changelogQuery, params);
        unreadChangelog += parseInt((changelogResult.rows[0] as { cnt: string }).cnt, 10);
      }

      // Open RFIs where this PS is the target
      const openRFIResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM inheritance_rfis
         WHERE target_problem_set_id = $1 AND status != 'closed'`,
        [problemSetId],
      );
      const openRFIs = parseInt((openRFIResult.rows[0] as { cnt: string }).cnt, 10);

      // Pending FRAGO drafts for child PSes (FRAGOs targeting this PS's children)
      const pendingFRAGOResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM frago_drafts
         WHERE child_problem_set_id = $1 AND status IN ('draft', 'approved', 'distributed')`,
        [problemSetId],
      );
      const pendingFRAGOs = parseInt((pendingFRAGOResult.rows[0] as { cnt: string }).cnt, 10);

      return { pendingAcks: pendingAckCount, unreadChangelog, openRFIs, pendingFRAGOs };
    } catch (error) {
      console.error('[inheritance] getNotificationCounts failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // ==========================================================================
  // Phase 38: Interpretation Acknowledgment Loop
  // ==========================================================================

  /**
   * Parent acknowledges/clarifies/corrects a child's interpretation annotation.
   * - acknowledge: marks interpretation as correct
   * - clarify: creates an RFI with subtype 'clarification' linking to annotation
   * - correct: logs activity for child PS notification
   */
  async acknowledgeInterpretation(
    annotationId: string,
    parentProblemSetId: string,
    action: 'acknowledge' | 'clarify' | 'correct',
    comment: string | null,
    actedBy: string,
  ): Promise<InterpretationAcknowledgment> {
    try {
      // Validate annotation exists and is an upward-visible interpretation
      const pool = getPool();
      const annotationResult = await pool.query(
        `SELECT * FROM inheritance_annotations WHERE id = $1`,
        [annotationId],
      );

      if (annotationResult.rows.length === 0) {
        throw new Error(`Annotation not found: ${annotationId}`);
      }

      const annotation = annotationResult.rows[0] as {
        id: string; problem_set_id: string; source_problem_set_id: string;
        annotation_type: string; visibility: string; target_item_id: string;
        target_item_type: string;
      };

      if (annotation.annotation_type !== 'interpretation') {
        throw new Error('Only interpretation annotations can be acknowledged by parent');
      }

      if (annotation.visibility !== 'upward') {
        throw new Error('Only upward-visible annotations can be acknowledged by parent');
      }

      // Create linked RFI for 'clarify' action
      let linkedRfiId: string | null = null;
      if (action === 'clarify') {
        const rfi = await inheritanceStore.createRFIWithSubtype({
          requestingProblemSetId: parentProblemSetId,
          targetProblemSetId: annotation.problem_set_id,
          targetItemId: annotation.target_item_id,
          targetItemType: annotation.target_item_type,
          subject: `Clarification on interpretation: ${annotationId}`,
          rfiSubtype: 'clarification',
          createdBy: actedBy,
        });
        linkedRfiId = rfi.id;

        // Add the comment as initial message if provided
        if (comment) {
          await inheritanceStore.addRFIMessage(rfi.id, actedBy, parentProblemSetId, comment);
        }
      }

      // Create the interpretation ack record
      const { randomUUID } = await import('crypto');
      const ackId = `IACK-INTERP-${randomUUID()}`;
      const ack = await inheritanceStore.createInterpretationAck({
        id: ackId,
        annotationId,
        parentProblemSetId,
        action,
        comment,
        rfiId: linkedRfiId,
        actedBy,
      });

      // For 'correct' action, log activity for child PS notification
      if (action === 'correct') {
        await problemSetActivityStore.log(
          annotation.problem_set_id,
          'interpretation_corrected',
          actedBy,
          null,
          {
            annotationId,
            parentProblemSetId,
            comment,
          },
        );
      }

      return ack;
    } catch (error) {
      console.error('[inheritance] acknowledgeInterpretation failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // ==========================================================================
  // Phase 38: Modification Request Handling
  // ==========================================================================

  /**
   * Create a modification request RFI from a child PS to a parent/ancestor PS.
   * Creates RFI with subtype 'modification_request' and logs activity for target PS.
   */
  async createModificationRequest(
    requestingPsId: string,
    targetPsId: string,
    targetItemId: string,
    targetItemType: string,
    subject: string,
    description: string,
    createdBy: string,
  ): Promise<InheritanceRFI> {
    try {
      const rfi = await inheritanceStore.createRFIWithSubtype({
        requestingProblemSetId: requestingPsId,
        targetProblemSetId: targetPsId,
        targetItemId,
        targetItemType,
        subject,
        rfiSubtype: 'modification_request',
        createdBy,
      });

      // Add description as initial message
      await inheritanceStore.addRFIMessage(rfi.id, createdBy, requestingPsId, description);

      // Log activity for target PS
      await problemSetActivityStore.log(
        targetPsId,
        'modification_request_received',
        createdBy,
        null,
        {
          rfiId: rfi.id,
          requestingProblemSetId: requestingPsId,
          targetItemId,
          subject,
        },
      );

      return rfi;
    } catch (error) {
      console.error('[inheritance] createModificationRequest failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * Resolve a modification request RFI (approve or deny).
   * Updates RFI resolution, adds resolution message, closes RFI,
   * and logs activity for the requesting PS.
   */
  async resolveModificationRequest(
    rfiId: string,
    resolution: 'approved' | 'denied',
    comment: string,
    resolvedBy: string,
  ): Promise<void> {
    try {
      // Resolve in store (updates resolution + closes)
      const rfi = await inheritanceStore.resolveModificationRequest(rfiId, resolution);

      // Add resolution comment as message
      await inheritanceStore.addRFIMessage(rfi.id, resolvedBy, rfi.targetProblemSetId, comment);

      // Log activity for requesting PS
      await problemSetActivityStore.log(
        rfi.requestingProblemSetId,
        'modification_request_resolved',
        resolvedBy,
        null,
        {
          rfiId: rfi.id,
          resolution,
          comment,
        },
      );
    } catch (error) {
      console.error('[inheritance] resolveModificationRequest failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // ==========================================================================
  // Phase 38: Guidance Request
  // ==========================================================================

  /**
   * Create a guidance request RFI from a child PS to a parent/ancestor PS.
   * Child describes a situation change and requests parent guidance.
   */
  async createGuidanceRequest(
    requestingPsId: string,
    targetPsId: string,
    subject: string,
    situationDescription: string,
    createdBy: string,
  ): Promise<InheritanceRFI> {
    try {
      const rfi = await inheritanceStore.createRFIWithSubtype({
        requestingProblemSetId: requestingPsId,
        targetProblemSetId: targetPsId,
        targetItemId: 'n/a',
        targetItemType: 'guidance',
        subject,
        rfiSubtype: 'guidance_request',
        createdBy,
      });

      // Add situation description as initial message
      await inheritanceStore.addRFIMessage(rfi.id, createdBy, requestingPsId, situationDescription);

      // Log activity for target PS
      await problemSetActivityStore.log(
        targetPsId,
        'guidance_request_received',
        createdBy,
        null,
        {
          rfiId: rfi.id,
          requestingProblemSetId: requestingPsId,
          subject,
        },
      );

      return rfi;
    } catch (error) {
      console.error('[inheritance] createGuidanceRequest failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

// Singleton export
export const inheritanceService = new InheritanceService();
