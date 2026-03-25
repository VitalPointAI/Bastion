/**
 * OSINT Feed Poller
 *
 * Periodically fetches RSS/API feeds based on their configured polling interval.
 * New items are stored as OSINT events, ingested into the knowledge graph,
 * and trigger COP layer regeneration.
 *
 * Tracks last-fetched timestamp per feed to only fetch what's changed.
 */

import RSSParser from 'rss-parser';
import { osintFeedStore } from '../jpp/osint-feed-store.js';
import { osintEventStore } from '../graph/osint/event-store.js';
import { notifyCOPChange } from '../cop/index.js';
import { extractLocation, syncOSINTEventToGraph } from './osint-graph-sync.js';
import { extractAndSyncToGraph } from './osint-entity-extractor.js';
import { updateOSINTCOPLayer } from './osint-cop-pipeline.js';
// geocodingService removed — using keyword lookup + feed source name fallback (no external API calls)
import { getPool } from '../lib/database.js';
import type { OSINTEventInput, OSINTEvent } from '../graph/osint/types.js';

// ─── Translation ────────────────────────────────────────────────────────────

/** Quick heuristic: text is likely non-English if >30% of chars are non-ASCII-letter */
function looksNonEnglish(text: string): boolean {
  if (!text || text.length < 20) return false;
  // Non-ASCII characters (Chinese, Arabic, Cyrillic, etc.)
  const nonAscii = text.replace(/[\x20-\x7E]/g, '').length;
  if (nonAscii / text.length > 0.15) return true;
  // Latin-script languages (Spanish, French, Portuguese, etc.)
  // detected by accented characters or common non-English patterns
  if (/[àáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ]/i.test(text)) return true;
  // Common non-English word patterns
  if (/\b(las|los|del|una|des|les|der|die|das|und|que|por|para|como|con|más|también|según|está)\b/i.test(text)) return true;
  return false;
}

/** Translate non-English text to English via LLM. Returns original on failure. */
async function translateToEnglish(title: string, description: string): Promise<{ title: string; description: string }> {
  try {
    const { createLLMForAgent } = await import('../agents/langgraph/llm-factory.js');
    const llm = await createLLMForAgent({
      agentId: 'osint-translator',
      overrides: { temperature: 0, maxTokens: 512 },
    });

    const result = await Promise.race([
      llm.invoke([
        { role: 'system', content: 'Translate the following news headline and summary to English. Return ONLY a JSON object: {"title": "...", "description": "..."}. Keep it concise.' },
        { role: 'user', content: `Title: ${title}\nDescription: ${description.slice(0, 500)}` },
      ]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]);

    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { title?: string; description?: string };
      return {
        title: parsed.title ?? title,
        description: parsed.description ?? description,
      };
    }
  } catch {
    // Non-fatal — use original
  }
  return { title, description };
}
import type { OSINTFeedConfig } from '../jpp/osint-feed-store.js';

const rssParser = new RSSParser();

// ─── LLM concurrency limiter ────────────────────────────────────────────────
// Prevent 2500 concurrent LLM calls from saturating the server CPU.
// Queue LLM enrichment tasks and run at most N at a time.
const LLM_CONCURRENCY = 3;
let llmActiveCount = 0;
const llmQueue: Array<() => Promise<void>> = [];

function enqueueLLMTask(task: () => Promise<void>): void {
  llmQueue.push(task);
  drainLLMQueue();
}

function drainLLMQueue(): void {
  while (llmActiveCount < LLM_CONCURRENCY && llmQueue.length > 0) {
    const task = llmQueue.shift()!;
    llmActiveCount++;
    task().finally(() => {
      llmActiveCount--;
      drainLLMQueue();
    });
  }
}

// ─── Feed poll state tracking ────────────────────────────────────────────────

async function ensurePollStateTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS osint_feed_poll_state (
      feed_id TEXT PRIMARY KEY,
      last_fetched_at TIMESTAMPTZ,
      last_item_guid TEXT,
      items_fetched INTEGER DEFAULT 0,
      last_error TEXT,
      consecutive_failures INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add column if table already exists without it
  await pool.query(`
    ALTER TABLE osint_feed_poll_state ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0
  `).catch(() => { /* column may already exist */ });
}

async function getLastFetchedAt(feedId: string): Promise<Date | null> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT last_fetched_at FROM osint_feed_poll_state WHERE feed_id = $1',
    [feedId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].last_fetched_at ? new Date(result.rows[0].last_fetched_at as string) : null;
}

async function updatePollState(feedId: string, lastGuid: string | null, itemCount: number, error?: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO osint_feed_poll_state (feed_id, last_fetched_at, last_item_guid, items_fetched, last_error, consecutive_failures, updated_at)
     VALUES ($1, NOW(), $2, $3, $4, CASE WHEN $4 IS NOT NULL THEN 1 ELSE 0 END, NOW())
     ON CONFLICT (feed_id) DO UPDATE SET
       last_fetched_at = NOW(),
       last_item_guid = COALESCE($2, osint_feed_poll_state.last_item_guid),
       items_fetched = osint_feed_poll_state.items_fetched + $3,
       last_error = $4,
       consecutive_failures = CASE WHEN $4 IS NOT NULL THEN osint_feed_poll_state.consecutive_failures + 1 ELSE 0 END,
       updated_at = NOW()`,
    [feedId, lastGuid, itemCount, error ?? null],
  );
}

// ─── RSS Parsing ─────────────────────────────────────────────────────────────

async function fetchRSSFeed(feed: OSINTFeedConfig, since: Date | null): Promise<OSINTEventInput[]> {
  if (!feed.endpointUrl) return [];

  const parsed = await rssParser.parseURL(feed.endpointUrl);
  const events: OSINTEventInput[] = [];

  for (const item of parsed.items ?? []) {
    // Robust date parsing — many feeds have malformed dates
    let pubDate = new Date();
    if (item.isoDate) {
      const d = new Date(item.isoDate);
      if (!isNaN(d.getTime())) pubDate = d;
    } else if (item.pubDate) {
      const d = new Date(item.pubDate);
      if (!isNaN(d.getTime())) pubDate = d;
    }

    // Skip items older than last fetch
    if (since && pubDate <= since) continue;

    // Extract categories as tags
    const tags: string[] = [];
    if (item.categories) {
      for (const cat of item.categories) {
        if (typeof cat === 'string') tags.push(cat);
        else if (cat && typeof cat === 'object' && 'name' in cat) tags.push((cat as { name: string }).name);
      }
    }

    // Translate non-English items
    let title = item.title ?? 'Untitled';
    let description = item.contentSnippet ?? item.content ?? item.summary ?? '';
    if (looksNonEnglish(title) || looksNonEnglish(description)) {
      const translated = await translateToEnglish(title, description);
      title = translated.title;
      description = translated.description;
    }

    // Extract geo-location from article text only — no location = no COP placement
    // The LLM entity extractor backfills locations for events it processes
    const fullText = `${title} ${description}`;
    const location = extractLocation(fullText) ?? undefined;

    events.push({
      title,
      description,
      sourceType: 'news',
      sourceUrl: item.link,
      sourceName: feed.sourceName,
      publishedAt: pubDate,
      location,
      actors: item.creator ? [item.creator] : [],
      tags,
      rawContent: item.content ?? '',
      metadata: { feedId: feed.id, guid: item.guid ?? item.link },
    });
  }

  return events;
}

// ─── API Fetching ────────────────────────────────────────────────────────────

async function fetchAPIFeed(feed: OSINTFeedConfig, since: Date | null): Promise<OSINTEventInput[]> {
  if (!feed.endpointUrl) return [];

  const headers: Record<string, string> = { 'Accept': 'application/json' };
  const configHeaders = (feed.config as Record<string, unknown>)?.headers;
  if (configHeaders && typeof configHeaders === 'object') {
    Object.assign(headers, configHeaders);
  }

  const url = new URL(feed.endpointUrl);
  if (since) url.searchParams.set('since', since.toISOString());

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`API feed ${feed.sourceName} returned ${res.status}`);

  const body = await res.json() as unknown[];
  const items = Array.isArray(body) ? body : (body as Record<string, unknown>).items as unknown[] ?? [];

  const results: OSINTEventInput[] = [];
  for (const item of items) {
    const obj = item as Record<string, unknown>;
    const title = (obj.title as string) ?? 'Untitled';
    const description = (obj.description as string) ?? (obj.summary as string) ?? '';
    const fullText = `${title} ${description}`;
    const location = extractLocation(fullText) ?? undefined;

    results.push({
      title,
      description,
      sourceType: 'news' as const,
      sourceUrl: (obj.url as string) ?? (obj.link as string),
      sourceName: feed.sourceName,
      publishedAt: (() => { const d = obj.publishedAt ? new Date(obj.publishedAt as string) : new Date(); return isNaN(d.getTime()) ? new Date() : d; })(),
      location,
      actors: Array.isArray(obj.actors) ? obj.actors as string[] : [],
      tags: Array.isArray(obj.tags) ? obj.tags as string[] : [],
      rawContent: (obj.content as string) ?? '',
      metadata: { feedId: feed.id },
    });
  }
  return results;
}

// ─── Feed Poller Service ─────────────────────────────────────────────────────

class FeedPoller {
  private timers = new Map<string, NodeJS.Timeout>();
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      await ensurePollStateTable();
    } catch (err) {
      console.warn('[FeedPoller] Failed to create poll state table:', err);
    }

    // Load all active feeds and start timers
    try {
      const feeds = await osintFeedStore.getActiveFeeds();
      console.log(`[FeedPoller] Starting polling for ${feeds.length} active feeds`);

      for (const feed of feeds) {
        this.startFeedTimer(feed);
      }
    } catch (err) {
      console.warn('[FeedPoller] Failed to load feeds:', err);
    }
  }

  stop(): void {
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
      console.log(`[FeedPoller] Stopped polling feed ${id}`);
    }
    this.timers.clear();
    this.started = false;
  }

  /** Start or restart a single feed's timer */
  startFeedTimer(feed: OSINTFeedConfig): void {
    // Clear existing timer if any
    const existing = this.timers.get(feed.id);
    if (existing) clearInterval(existing);

    const intervalMs = feed.pollingIntervalMs || 300_000; // Default 5 min
    console.log(`[FeedPoller] Polling "${feed.sourceName}" every ${intervalMs / 1000}s (${feed.sourceType})`);

    // Poll immediately on first start
    this.pollFeed(feed).catch(err =>
      console.warn(`[FeedPoller] Initial poll failed for ${feed.sourceName}:`, err),
    );

    // Then set interval
    const timer = setInterval(() => {
      this.pollFeed(feed).catch(err =>
        console.warn(`[FeedPoller] Poll failed for ${feed.sourceName}:`, err),
      );
    }, intervalMs);

    this.timers.set(feed.id, timer);
  }

  /** Stop a single feed's timer */
  stopFeedTimer(feedId: string): void {
    const timer = this.timers.get(feedId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(feedId);
    }
  }

  /** Poll all active feeds immediately. Returns count of new items stored. */
  async pollAllNow(): Promise<{ feedsPolled: number; itemsStored: number }> {
    const feeds = await osintFeedStore.getActiveFeeds();
    let totalStored = 0;
    for (const feed of feeds) {
      try {
        const count = await this.pollFeed(feed);
        totalStored += count;
      } catch (err) {
        console.warn(`[FeedPoller] Manual poll failed for "${feed.sourceName}":`, err);
      }
    }
    return { feedsPolled: feeds.length, itemsStored: totalStored };
  }

  /** Poll a single feed for new items. Returns count of items stored. */
  private async pollFeed(feed: OSINTFeedConfig): Promise<number> {
    const since = await getLastFetchedAt(feed.id);

    let items: OSINTEventInput[];
    try {
      if (feed.sourceType === 'rss') {
        items = await fetchRSSFeed(feed, since);
      } else if (feed.sourceType === 'api') {
        items = await fetchAPIFeed(feed, since);
      } else {
        // Simulated or webhook feeds don't poll
        return 0;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[FeedPoller] Fetch failed for "${feed.sourceName}": ${msg}`);
      await updatePollState(feed.id, null, 0, msg);
      return 0;
    }

    if (items.length === 0) {
      await updatePollState(feed.id, null, 0);
      return 0;
    }

    console.log(`[FeedPoller] "${feed.sourceName}" returned ${items.length} new items`);

    let stored = 0;
    let lastGuid: string | null = null;
    const storedEvents: OSINTEvent[] = [];

    for (const item of items) {
      // Dedup by source URL
      if (item.sourceUrl) {
        const pool = getPool();
        const dup = await pool.query(
          'SELECT id FROM osint_events WHERE source_url = $1 LIMIT 1',
          [item.sourceUrl],
        );
        if (dup.rows.length > 0) continue;
      }

      // Add workspace context from feed config
      item.workspaceId = feed.problemSetId;

      try {
        const storedEvent = await osintEventStore.createEvent(item);
        stored++;
        storedEvents.push(storedEvent);
        lastGuid = (item.metadata as Record<string, unknown>)?.guid as string ?? item.sourceUrl ?? null;

        // Always create basic graph node (no LLM, guaranteed to work)
        syncOSINTEventToGraph(storedEvent).catch(err =>
          console.warn(`[FeedPoller] Basic graph sync failed for "${item.title}":`, err),
        );

        // Then attempt LLM-enriched extraction (throttled to avoid CPU saturation)
        enqueueLLMTask(async () => {
          await extractAndSyncToGraph(storedEvent).catch(() => {
            // Non-fatal — basic sync already created the node above
          });
        });
      } catch (err) {
        console.error(`[FeedPoller] Failed to store event "${item.title}":`, err);
      }
    }

    await updatePollState(feed.id, lastGuid, stored);

    if (stored > 0) {
      console.log(`[FeedPoller] Stored ${stored} new events from "${feed.sourceName}"`);

      // 1. Direct COP layer creation from geo-located events (immediate, no LLM)
      updateOSINTCOPLayer(feed.problemSetId, storedEvents).catch(err =>
        console.error(`[FeedPoller] OSINT→COP layer creation failed:`, err),
      );

      // 2. Also trigger full LLM COP generation (best-effort, slower)
      notifyCOPChange(feed.problemSetId, `osint-feed-${feed.sourceName}`);
    }

    return stored;
  }
}

export const feedPoller = new FeedPoller();
