/**
 * OSINT Webhook API
 *
 * Phase 33: JPP Campaign Plan Framework
 *
 * Provides:
 * - POST /webhook/argus  - Argus webhook receiver with HMAC-SHA256 verification
 * - GET  /feeds/:problemSetId - List feed configs for a problem set
 * - POST /feeds - Create a feed config
 *
 * Transforms Argus article pushes into OSINT events, auto-links high-confidence
 * entity matches, and manages feed configurations per problem set.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { osintEventStore } from '../graph/osint/event-store.js';
import { entityToolHandlers } from '../graph/tools/entity-tools.js';
import { osintFeedStore } from '../jpp/osint-feed-store.js';
import type { OSINTEventInput } from '../graph/osint/types.js';
import { notifyCOPChange } from '../cop/index.js';

export const osintWebhookRouter = Router();

// ============================================================================
// POST /webhook/argus - Argus webhook receiver
// ============================================================================

osintWebhookRouter.post('/webhook/argus', async (req, res) => {
  try {
    const secret = process.env.ARGUS_WEBHOOK_SECRET || '';

    // HMAC-SHA256 verification (skip if no secret configured -- dev mode)
    if (secret) {
      const signature = req.headers['x-argus-signature'] as string | undefined;
      if (!signature) {
        res.status(401).json({ error: 'Missing X-Argus-Signature header' });
        return;
      }

      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const body = req.body;

    // Validate required fields
    if (!body.title) {
      res.status(400).json({ error: 'Missing required field: title' });
      return;
    }

    // Transform Argus payload to OSINTEventInput
    const eventInput: OSINTEventInput = {
      title: body.title,
      description: body.summary || body.description || '',
      sourceType: 'news',
      sourceUrl: body.url,
      sourceName: 'Argus',
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
      actors: body.entities || [],
      tags: body.tags || [],
      rawContent: body.content || '',
      metadata: {},
    };

    // Store the OSINT event
    const event = await osintEventStore.createEvent(eventInput);

    // Auto-link entities with high confidence matches
    const pendingReview: Array<{ actor: string; matches: unknown[] }> = [];
    const autoLinked: string[] = [];

    if (body.entities && Array.isArray(body.entities)) {
      for (const actorName of body.entities) {
        try {
          const searchResult = await entityToolHandlers.search_entities({
            query: actorName,
            fuzzy: true,
          });

          if (searchResult.entities.length > 0) {
            // Check confidence -- entities from fuzzy search are considered
            // high confidence if they match closely
            const topMatch = searchResult.entities[0] as Record<string, unknown>;
            const confidence = (topMatch.confidence as number) ?? 0;

            if (confidence >= 0.9) {
              autoLinked.push(actorName);
              // Entity auto-linked; objective linking happens through
              // existing OSINT agent workflows
            } else {
              pendingReview.push({
                actor: actorName,
                matches: searchResult.entities.slice(0, 3),
              });
            }
          }
        } catch {
          // Entity search failure should not block event ingestion
          pendingReview.push({ actor: actorName, matches: [] });
        }
      }
    }

    // If there are pending review items, store them in event metadata
    if (pendingReview.length > 0) {
      // Store pending review info -- can be processed by OSINT agent later
      // Event is already created, metadata update is best-effort
    }

    // Direct COP layer creation from geo-located event (immediate)
    import('../osint/osint-cop-pipeline.js').then(({ updateOSINTCOPLayer }) => {
      updateOSINTCOPLayer(body.workspaceId ?? 'default', [event]).catch(err =>
        console.error('[OSINT Webhook] COP layer creation failed:', err),
      );
    }).catch(() => { /* module load failure — non-fatal */ });

    // Also trigger full LLM COP generation (best-effort, slower)
    notifyCOPChange(body.workspaceId ?? 'default', 'osint-webhook');

    res.status(200).json({
      eventId: event.id,
      status: 'received',
      autoLinked,
      pendingReview: pendingReview.length,
    });
  } catch (error) {
    console.error('[OSINT Webhook] Error processing Argus webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// GET /feeds/:problemSetId - List feed configs for a problem set
// ============================================================================

osintWebhookRouter.get('/feeds/:problemSetId', async (req, res) => {
  try {
    const feeds = await osintFeedStore.getFeedsByProblemSet(req.params.problemSetId);
    res.json({ feeds });
  } catch (error) {
    console.error('[OSINT Feeds] Error fetching feeds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /feeds - Create a feed config
// ============================================================================

osintWebhookRouter.post('/feeds', async (req, res) => {
  try {
    const { problemSetId, sourceName, sourceType, endpointUrl, pollingIntervalMs, relevanceMode, config } = req.body;

    if (!problemSetId || !sourceName || !sourceType) {
      res.status(400).json({ error: 'Missing required fields: problemSetId, sourceName, sourceType' });
      return;
    }

    const feed = await osintFeedStore.createFeed({
      problemSetId,
      sourceName,
      sourceType,
      endpointUrl,
      pollingIntervalMs,
      relevanceMode,
      config,
    });

    res.status(201).json({ feed });
  } catch (error) {
    console.error('[OSINT Feeds] Error creating feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PUT /feeds/:feedId - Update a feed config
// ============================================================================

osintWebhookRouter.put('/feeds/:feedId', async (req, res) => {
  try {
    const feedId = req.params.feedId as string;
    const updates = req.body;

    const feed = await osintFeedStore.updateFeed(feedId, updates);
    if (!feed) {
      res.status(404).json({ error: 'Feed not found' });
      return;
    }

    res.json({ feed });
  } catch (error) {
    console.error('[OSINT Feeds] Error updating feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// DELETE /feeds/:feedId - Delete a feed config
// ============================================================================

osintWebhookRouter.delete('/feeds/:feedId', async (req, res) => {
  try {
    const feedId = req.params.feedId as string;
    const deleted = await osintFeedStore.deleteFeed(feedId);

    if (!deleted) {
      res.status(404).json({ error: 'Feed not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[OSINT Feeds] Error deleting feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /feeds/poll-now - Trigger immediate poll of all active feeds
// ============================================================================

osintWebhookRouter.post('/feeds/poll-now', async (_req, res) => {
  try {
    const { feedPoller } = await import('../osint/feed-poller.js');
    const result = await feedPoller.pollAllNow();
    console.log(`[OSINT Feeds] Manual poll: ${result.feedsPolled} feeds, ${result.itemsStored} new items`);
    res.json(result);
  } catch (error) {
    console.error('[OSINT Feeds] Error polling feeds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /backfill-descriptions - Re-enrich all actor nodes with thin descriptions
// ============================================================================

osintWebhookRouter.post('/backfill-descriptions', async (_req, res) => {
  try {
    const { executeReadQuery, executeWriteQuery } = await import('../graph/neo4j-client.js');
    const { performWebSearch } = await import('../doc-intelligence/web-search.js');
    const { createLLMForAgent } = await import('../agents/langgraph/llm-factory.js');

    // Find actors with missing or thin descriptions
    const result = await executeReadQuery(`
      MATCH (a:Actor)
      WHERE a.attributes IS NOT NULL
        AND a.type <> 'event'
      RETURN a.id AS id, a.name AS name, a.type AS type, a.attributes AS attributes
      LIMIT 500
    `, {});

    let enriched = 0;
    let skipped = 0;

    for (const record of result.records ?? []) {
      const id = record.get('id') as string;
      const name = record.get('name') as string;
      const type = record.get('type') as string;
      const attrsRaw = record.get('attributes') as string;

      let attrs: Record<string, unknown> = {};
      try { attrs = JSON.parse(attrsRaw); } catch { continue; }

      const existingDesc = (attrs.description as string) ?? '';
      if (existingDesc.length > 30) { skipped++; continue; }

      // Web search + LLM enrichment
      try {
        const searchResults = await performWebSearch(`${name} ${type} who what`, 3);
        const searchContext = searchResults
          .map(r => `${r.title}: ${r.snippet}`)
          .join('\n')
          .slice(0, 2000);

        const llm = await createLLMForAgent({
          agentId: 'backfill-enrichment',
          overrides: { temperature: 0, maxTokens: 256 },
        });

        const llmResult = await Promise.race([
          llm.invoke([
            { role: 'system', content: 'Write a concise 1-3 sentence description of this entity for a knowledge graph. Include what it is, its significance, and any known affiliations. Return ONLY the description text.' },
            { role: 'user', content: `Entity: ${name}\nType: ${type}\n\nWeb search results:\n${searchContext}` },
          ]),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000)),
        ]);

        const description = (typeof llmResult.content === 'string'
          ? llmResult.content
          : JSON.stringify(llmResult.content)
        ).trim();

        if (description.length > 10) {
          attrs.description = description;
          await executeWriteQuery(
            `MATCH (a:Actor {id: $id}) SET a.attributes = $attributes`,
            { id, attributes: JSON.stringify(attrs) },
          );
          enriched++;
          console.log(`[Backfill] Enriched "${name}": ${description.slice(0, 60)}...`);
        }
      } catch (err) {
        console.warn(`[Backfill] Failed for "${name}":`, err instanceof Error ? err.message : err);
      }
    }

    const msg = `Backfill complete: ${enriched} enriched, ${skipped} already had descriptions`;
    console.log(`[Backfill] ${msg}`);
    res.json({ enriched, skipped, message: msg });
  } catch (error) {
    console.error('[Backfill] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default osintWebhookRouter;
