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
import { processOSINTEventThroughAgents } from '../osint/osint-agent-bridge.js';
import type { OSINTFeedConfig } from '../jpp/osint-feed-store.js';
import { osintEventStore } from '../graph/osint/event-store.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { pirStore } from '../design/pir-store.js';
import { createPIRAlertDecision } from '../decisions/pir-alert-handler.js';
import type { OSINTEvent } from '../graph/osint/types.js';
import type { PIR } from '../design/pir-store.js';

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

/**
 * @deprecated Phase 65: Intelligence gap detection now handled by Ironclaw autonomous heartbeat
 * via MCP tools (bastion.intel.get_intelligence_gaps, bastion.intel.web_search,
 * bastion.intel.create_research_event). This service is disabled.
 * Preserved for reference only — do not call start().
 */
class IronclawGapFillerService {
  /** Track recently researched gaps to avoid thrashing */
  private cooldowns = new Map<string, number>();

  /** Active interval timer */
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Problem sets being monitored */
  private monitoredProblemSets = new Set<string>();

  /**
   * @deprecated Phase 65: Gap filler retired — Ironclaw handles gap detection
   * autonomously via MCP tools. This method is a no-op.
   */
  start(_problemSetId: string): void {
    console.log(
      '[GapFiller] DEPRECATED: Intelligence gap detection now handled by Ironclaw autonomous heartbeat. This service is disabled.',
    );
  }

  /** Timestamp of the last completed cycle per problem set */
  private lastRunTimestamps = new Map<string, number>();

  /** Count of gaps processed per problem set in the last cycle */
  private lastCycleGapsProcessed = new Map<string, number>();

  /**
   * Get the current status of the gap filler service for a problem set.
   */
  getStatus(problemSetId: string): {
    isMonitored: boolean;
    isRunning: boolean;
    lastRunAt: string | null;
    gapsProcessedLastCycle: number;
    activeCooldowns: Array<{ gapId: string; expiresAt: string }>;
    monitoredProblemSets: string[];
    intervalMs: number;
    nextScheduledRun: string | null;
  } {
    const now = Date.now();
    const isMonitored = this.monitoredProblemSets.has(problemSetId);
    const lastRun = this.lastRunTimestamps.get(problemSetId);

    const activeCooldowns: Array<{ gapId: string; expiresAt: string }> = [];
    for (const [gapId, cooldownStart] of this.cooldowns.entries()) {
      const expiresAt = cooldownStart + GAP_COOLDOWN_MS;
      if (expiresAt > now) {
        activeCooldowns.push({
          gapId,
          expiresAt: new Date(expiresAt).toISOString(),
        });
      }
    }

    let nextScheduledRun: string | null = null;
    if (isMonitored && this.timer && lastRun) {
      nextScheduledRun = new Date(lastRun + GAP_CHECK_INTERVAL_MS).toISOString();
    } else if (isMonitored && this.timer) {
      // First run pending
      nextScheduledRun = 'pending (initial cycle)';
    }

    return {
      isMonitored,
      isRunning: this.timer !== null,
      lastRunAt: lastRun ? new Date(lastRun).toISOString() : null,
      gapsProcessedLastCycle: this.lastCycleGapsProcessed.get(problemSetId) ?? 0,
      activeCooldowns,
      monitoredProblemSets: [...this.monitoredProblemSets],
      intervalMs: GAP_CHECK_INTERVAL_MS,
      nextScheduledRun,
    };
  }

  /**
   * Prioritize a specific gap by clearing its cooldown so it is eligible
   * for immediate research on the next cycle (or via fillGapsForProblemSet).
   */
  prioritizeGap(gapNodeId: string): void {
    this.cooldowns.delete(gapNodeId);
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
        this.lastRunTimestamps.set(psId, Date.now());
        this.lastCycleGapsProcessed.set(psId, results.length);
        if (results.length > 0) {
          console.log(
            `[GapFiller] Filled ${results.length} gap(s) for ${psId}: ${results.map((r) => r.actorName).join(', ')}`,
          );
        }
      } catch (err) {
        this.lastRunTimestamps.set(psId, Date.now());
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

    // Extract entities and sync to graph via agent bridge
    const syntheticFeed = {
      problemSetId,
      sourceName: 'Ironclaw Gap Filler',
      sourceType: 'research',
      id: `gap-filler-${problemSetId}`,
    } as unknown as OSINTFeedConfig;
    const bridgeStats = await processOSINTEventThroughAgents(event as unknown as OSINTEvent, syntheticFeed);
    // Agent bridge does not return tensionsCreated (handled internally by specialist agents)
    const stats = { ...bridgeStats, tensionsCreated: 0 };

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

    // Check if new OSINT event matches any active PIRs
    await this.checkPIRMatches(problemSetId, event, description, gap.nodeLabel);

    return {
      gapId: gap.nodeId,
      actorName: gap.nodeLabel,
      searchQuery: searchQueries[0],
      searchResultCount: allResults.length,
      ...stats,
    };
  }

  /**
   * Check if a newly created OSINT event matches any active PIRs.
   * Uses keyword overlap between the PIR description and the OSINT event content.
   * Creates a PIR_ALERT decision for each match.
   */
  private async checkPIRMatches(
    problemSetId: string,
    event: { id?: string; title?: string },
    eventDescription: string,
    actorName: string,
  ): Promise<void> {
    try {
      const activePIRs = await pirStore.getActivePIRsForGapResearch(problemSetId);
      if (activePIRs.length === 0) return;

      const eventText = `${actorName} ${eventDescription}`.toLowerCase();

      for (const pir of activePIRs) {
        if (this.pirMatchesEvent(pir, eventText)) {
          try {
            await createPIRAlertDecision({
              problemSetId,
              pirId: pir.id,
              pirType: pir.type,
              pirPriority: pir.priority,
              pirDescription: pir.description,
              osintEventId: (event as Record<string, unknown>).id as string | undefined,
              matchedEntityIds: [],
              suggestedAnswer:
                `Gap filler research on "${actorName}" produced intelligence that may address ` +
                `this requirement. Key findings: ${eventDescription.slice(0, 500)}`,
              linkedAssumptionIds: pir.linkedAssumptionIds,
              linkedObjectiveIds: pir.linkedObjectiveIds,
            });

            console.log(
              `[GapFiller] PIR match found: PIR ${pir.id} (${pir.type} #${pir.priority}) ` +
              `matched by gap research on "${actorName}"`,
            );
          } catch (err) {
            console.warn(`[GapFiller] Failed to create PIR alert for ${pir.id}:`, err);
          }
        }
      }
    } catch (err) {
      // PIR matching is non-fatal to the gap fill cycle
      console.warn('[GapFiller] PIR match check failed:', err);
    }
  }

  /**
   * Simple keyword overlap check between a PIR description and event text.
   * Extracts significant words (3+ chars) from the PIR description and
   * checks if enough of them appear in the event text.
   */
  private pirMatchesEvent(pir: PIR, eventTextLower: string): boolean {
    const pirWords = pir.description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      // Filter out common stop words that would cause false positives
      .filter((w) => !PIR_MATCH_STOP_WORDS.has(w));

    if (pirWords.length === 0) return false;

    const matchCount = pirWords.filter((w) => eventTextLower.includes(w)).length;
    const matchRatio = matchCount / pirWords.length;

    // Require at least 30% keyword overlap and at least 2 matching words
    return matchRatio >= 0.3 && matchCount >= 2;
  }
}

// ---------------------------------------------------------------------------
// PIR Match Stop Words
// ---------------------------------------------------------------------------

/** Common words filtered out during PIR keyword matching to reduce false positives. */
const PIR_MATCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her',
  'was', 'one', 'our', 'out', 'this', 'that', 'with', 'have', 'from', 'they',
  'been', 'will', 'what', 'when', 'who', 'how', 'which', 'their', 'does', 'may',
  'could', 'would', 'should', 'into', 'than', 'other', 'about', 'more', 'these',
  'those', 'some', 'such', 'only', 'over', 'also', 'after', 'before', 'between',
]);

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const gapFillerService = new IronclawGapFillerService();
