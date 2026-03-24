/**
 * Ironclaw Gap Filler Service
 *
 * Proactively detects intelligence gaps in the knowledge graph and
 * fills them using SearxNG web search + LLM entity extraction.
 *
 * Flow: detect gap → build search query → search → create synthetic
 * OSINT event → extract entities → sync to Neo4j → notify UI
 *
 * Runs periodically (every 10 minutes) and processes up to 3 gaps
 * per cycle. Uses a cooldown to avoid re-researching the same gap.
 */

import { brainStore } from '../brain/brain-store.js';
import { performWebSearch } from '../doc-intelligence/web-search.js';
import { extractAndSyncToGraph } from '../osint/osint-entity-extractor.js';
import { osintEventStore } from '../graph/osint/event-store.js';
import { getMessageBus } from '../messaging/message-bus.js';
import type { OSINTEvent } from '../graph/osint/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often to check for gaps (10 minutes) */
const GAP_CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** Max gaps to fill per cycle */
const MAX_GAPS_PER_CYCLE = 3;

/** Cooldown per gap to avoid re-researching (2 hours) */
const GAP_COOLDOWN_MS = 2 * 60 * 60 * 1000;

/** Max search results per gap */
const SEARCH_MAX_RESULTS = 5;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

interface GapFillResult {
  gapId: string;
  actorName: string;
  searchQuery: string;
  searchResultCount: number;
  actorsCreated: number;
  relationshipsCreated: number;
  tensionsCreated: number;
}

class IronclawGapFillerService {
  /** Track recently researched gaps to avoid thrashing */
  private cooldowns = new Map<string, number>();

  /** Active interval timer */
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Problem sets being monitored */
  private monitoredProblemSets = new Set<string>();

  /**
   * Start monitoring a problem set for intelligence gaps.
   */
  start(problemSetId: string): void {
    if (this.monitoredProblemSets.has(problemSetId)) return;
    this.monitoredProblemSets.add(problemSetId);

    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.runCycle();
      }, GAP_CHECK_INTERVAL_MS);

      // Run first cycle after 30 seconds (let other services initialize)
      setTimeout(() => void this.runCycle(), 30_000);

      console.log(
        `[GapFiller] Started — checking every ${GAP_CHECK_INTERVAL_MS / 60_000} min`,
      );
    }

    console.log(`[GapFiller] Monitoring problem set: ${problemSetId}`);
  }

  /**
   * Stop the gap filler service entirely.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.monitoredProblemSets.clear();
    console.log('[GapFiller] Stopped');
  }

  /**
   * Run one cycle: check all monitored problem sets for gaps.
   */
  private async runCycle(): Promise<void> {
    for (const psId of this.monitoredProblemSets) {
      try {
        const results = await this.fillGapsForProblemSet(psId);
        if (results.length > 0) {
          console.log(
            `[GapFiller] Filled ${results.length} gap(s) for ${psId}: ${results.map((r) => r.actorName).join(', ')}`,
          );
        }
      } catch (err) {
        console.error(`[GapFiller] Cycle failed for ${psId}:`, err);
      }
    }
  }

  /**
   * Detect and fill intelligence gaps for a single problem set.
   */
  async fillGapsForProblemSet(problemSetId: string): Promise<GapFillResult[]> {
    // 1. Detect gaps
    const { gaps } = await brainStore.getIntelligenceGaps(problemSetId);
    if (gaps.length === 0) return [];

    // 2. Filter out recently researched gaps
    const now = Date.now();
    const eligible = gaps.filter((g: { nodeId: string }) => {
      const lastResearched = this.cooldowns.get(g.nodeId);
      return !lastResearched || now - lastResearched > GAP_COOLDOWN_MS;
    });

    if (eligible.length === 0) return [];

    // 3. Prioritize: most under-connected first
    eligible.sort((a: { actualConnections: number }, b: { actualConnections: number }) => a.actualConnections - b.actualConnections);

    // 4. Fill top gaps
    const results: GapFillResult[] = [];
    for (const gap of eligible.slice(0, MAX_GAPS_PER_CYCLE)) {
      try {
        const result = await this.fillSingleGap(problemSetId, gap);
        if (result) results.push(result);
      } catch (err) {
        console.warn(`[GapFiller] Failed to fill gap for ${gap.nodeLabel}:`, err);
      }
    }

    return results;
  }

  /**
   * Fill a single intelligence gap by searching and ingesting.
   */
  private async fillSingleGap(
    problemSetId: string,
    gap: { nodeId: string; nodeLabel: string; nodeType: string; missingConnectionTypes: string[]; actualConnections: number },
  ): Promise<GapFillResult | null> {
    // Build contextual search queries based on gap type
    const searchQueries = gap.missingConnectionTypes.slice(0, 2).map((connType) => {
      switch (connType) {
        case 'alliance':
          return `${gap.nodeLabel} alliances partnerships agreements`;
        case 'conflict':
          return `${gap.nodeLabel} conflicts disputes tensions`;
        case 'trade':
          return `${gap.nodeLabel} trade economic relations`;
        case 'diplomatic':
          return `${gap.nodeLabel} diplomatic relations foreign policy`;
        case 'member':
        case 'affiliated':
          return `${gap.nodeLabel} members affiliated organizations`;
        case 'opposes':
          return `${gap.nodeLabel} opposition adversaries`;
        case 'supports':
          return `${gap.nodeLabel} supporters allies backing`;
        case 'member_of':
          return `${gap.nodeLabel} organization membership role`;
        case 'commands':
        case 'reports_to':
          return `${gap.nodeLabel} chain of command leadership`;
        case 'controls':
          return `${gap.nodeLabel} territory control operations`;
        default:
          return `${gap.nodeLabel} ${connType} relations`;
      }
    });

    // Search for all queries
    let allResults: Array<{ url: string; title: string; snippet: string }> = [];
    for (const query of searchQueries) {
      const results = await performWebSearch(query, SEARCH_MAX_RESULTS);
      allResults.push(...results);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    allResults = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (allResults.length === 0) {
      this.cooldowns.set(gap.nodeId, Date.now());
      return null;
    }

    // Create synthetic OSINT event from search results
    const description = allResults
      .slice(0, 5)
      .map((r) => `**${r.title}**\n${r.snippet}`)
      .join('\n\n');

    const event = await osintEventStore.createEvent({
      title: `Intelligence Gap Research: ${gap.nodeLabel} — ${gap.missingConnectionTypes.join(', ')}`,
      description,
      sourceName: 'Ironclaw Gap Filler',
      sourceType: 'research',
      sourceUrl: allResults[0].url,
      publishedAt: new Date(),
      tags: ['ironclaw', 'gap-fill', gap.nodeId, ...gap.missingConnectionTypes],
      workspaceId: problemSetId,
    } as unknown as Parameters<typeof osintEventStore.createEvent>[0]);

    // Extract entities and sync to graph
    const stats = await extractAndSyncToGraph(event as unknown as OSINTEvent);

    // Mark as researched
    this.cooldowns.set(gap.nodeId, Date.now());

    // Notify via message bus
    try {
      const bus = getMessageBus();
      await bus.publish({
        sourceDid: 'did:bastion:ironclaw-gap-filler',
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: `brain.${problemSetId}`,
        messageType: 'brain.gap_filled',
        payload: {
          gapId: gap.nodeId,
          actorName: gap.nodeLabel,
          previousConnections: gap.actualConnections,
          actorsCreated: stats.actorsCreated,
          relationshipsCreated: stats.relationshipsCreated,
          tensionsCreated: stats.tensionsCreated,
          searchResultCount: allResults.length,
        },
      });
    } catch { /* notification is non-fatal */ }

    return {
      gapId: gap.nodeId,
      actorName: gap.nodeLabel,
      searchQuery: searchQueries[0],
      searchResultCount: allResults.length,
      ...stats,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gapFillerService = new IronclawGapFillerService();
