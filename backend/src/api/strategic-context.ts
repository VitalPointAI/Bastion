/**
 * Strategic Context API Router
 *
 * Phase 25.3: AI Strategic Context & Knowledge Graph Integration
 *
 * Provides endpoints for managing the subscription cache that materializes
 * strategic documents from subscribed problem sets. Used by AI agents to
 * access strategic environment data without cross-problem-set queries at runtime.
 *
 * Endpoints:
 *   POST /cache/refresh     - On-demand cache refresh for a subscriber
 *   POST /cache/invalidate  - Queue async refresh when publisher docs change
 *   GET  /cache/:problemSetId - Query cached docs for a subscriber
 */

import { Router } from 'express';
import { problemSetSubscriptionStore } from '../problem-set/problem-set-subscription-store.js';
import { containerStore } from '../strategic/containers/index.js';
import { graphSummaryService } from '../exercise/graph-summary-service.js';
import { StrategicContextService } from '../exercise/strategic-context-service.js';
import { getSharedBoss } from '../lib/database.js';

export const strategicContextRouter = Router();

/**
 * POST /cache/refresh
 * Synchronously materialize cache for a subscriber problem set.
 * Called on-demand when a user wants to refresh their AI agents' strategic context.
 */
strategicContextRouter.post('/cache/refresh', async (req, res) => {
  try {
    const { problemSetId } = req.body as { problemSetId: string };
    if (!problemSetId) {
      return res.status(400).json({ error: 'problemSetId is required' });
    }

    await problemSetSubscriptionStore.materializeCache(problemSetId);
    return res.json({ status: 'refreshed' });
  } catch (error) {
    console.error('[strategic-context] Cache refresh failed:', error);
    return res.status(500).json({ error: 'Cache refresh failed' });
  }
});

/**
 * POST /cache/invalidate
 * Queue an async cache refresh via pg-boss when publisher documents change.
 * Uses singletonKey to prevent cache stampede (multiple simultaneous refreshes
 * for the same publisher are deduplicated).
 */
strategicContextRouter.post('/cache/invalidate', async (req, res) => {
  try {
    const { publisherProblemSetId } = req.body as { publisherProblemSetId: string };
    if (!publisherProblemSetId) {
      return res.status(400).json({ error: 'publisherProblemSetId is required' });
    }

    const boss = await getSharedBoss();
    await boss.send('strategic-cache-refresh', { publisherProblemSetId }, {
      singletonKey: publisherProblemSetId,
    });

    return res.json({ status: 'queued' });
  } catch (error) {
    console.error('[strategic-context] Cache invalidation failed:', error);
    return res.status(500).json({ error: 'Cache invalidation failed' });
  }
});

/**
 * GET /preview/:problemSetId
 * Assemble and return the full strategic context for a problem set.
 * Used by the frontend preview panel so users can inspect what AI agents know.
 * Optional query param: ?scenarioPhase=Competition
 */
strategicContextRouter.get('/preview/:problemSetId', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const scenarioPhase = req.query.scenarioPhase as string | undefined;

    const service = new StrategicContextService(
      problemSetSubscriptionStore,
      containerStore,
      graphSummaryService,
    );

    const context = await service.assembleContext(problemSetId, scenarioPhase);

    // Return null if completely empty (no subscriptions, no containers)
    const isEmpty =
      Object.keys(context.graphSummaries).length === 0 &&
      context.documentSummaries.length === 0;

    return res.json({ context: isEmpty ? null : context });
  } catch (error) {
    console.error('[strategic-context] Preview assembly failed:', error);
    return res.status(500).json({ error: 'Preview assembly failed' });
  }
});

/**
 * GET /cache/:problemSetId
 * Retrieve cached strategic documents for a subscriber problem set.
 */
strategicContextRouter.get('/cache/:problemSetId', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const docs = await problemSetSubscriptionStore.getCachedDocs(problemSetId);
    return res.json({ docs });
  } catch (error) {
    console.error('[strategic-context] Cache query failed:', error);
    return res.status(500).json({ error: 'Cache query failed' });
  }
});
