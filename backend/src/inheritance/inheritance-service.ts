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
import type { InheritedContextResponse } from './inheritance-types.js';
import type { Echelon } from '../problem-set/types.js';

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
}

// Singleton export
export const inheritanceService = new InheritanceService();
