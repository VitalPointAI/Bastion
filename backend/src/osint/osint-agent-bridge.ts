/**
 * OSINT Agent Bridge
 *
 * Translates an OSINTEvent + OSINTFeedConfig into the doc-intelligence
 * pipeline input shape and invokes the full 12-specialist agent team.
 *
 * Key responsibilities:
 *   1. Build document text from event title + description
 *   2. Synthesise ProblemSetContext fallback when no interview context exists
 *   3. Cache compiled LangGraph instances per problemSetId (30-min TTL)
 *   4. Pass assertedVia: 'osint' in document metadata so provenance is correct
 *
 * This module is called by the feed poller (Plan 02) to replace the retired
 * extractAndSyncToGraph() standalone extractor.
 */

import type { OSINTEvent } from '../graph/osint/types.js';
import type { OSINTFeedConfig } from '../jpp/osint-feed-store.js';
import { createWiredDocIntelligenceGraph } from '../doc-intelligence/orchestrator-wiring.js';
import { getProblemSetContext } from '../doc-intelligence/interview/interview-store.js';
import type { ProblemSetContext } from '../doc-intelligence/schemas.js';
import type { DocumentIntelligenceReport } from '../doc-intelligence/types.js';

// ============================================================================
// Constants
// ============================================================================

/** Cache TTL in milliseconds — 30 minutes */
const GRAPH_CACHE_TTL_MS = 30 * 60 * 1000;

// ============================================================================
// Graph cache
// ============================================================================

interface CachedGraph {
  graph: { processDocument(documentId: string, text: string, metadata: Record<string, unknown>): Promise<DocumentIntelligenceReport> };
  expiresAt: number;
}

/**
 * Per-problemSetId compiled graph cache.
 * Creating a LangGraph StateGraph + 12 specialists per event is expensive;
 * reuse a single compiled instance for the lifetime of the cache entry.
 */
const graphCache = new Map<string, CachedGraph>();

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Build a minimal fallback ProblemSetContext when no interview has been
 * completed for the given problem set. Sufficient for TrustAgent, FactExtractor,
 * and QualityAssessor scoping without aborting those specialist runs.
 */
function buildFallbackContext(problemSetId: string, _feed: OSINTFeedConfig): ProblemSetContext {
  return {
    problemSetId,
    coreProblem: 'General geopolitical intelligence monitoring',
    geographicScope: { regions: ['Global'], countries: [] },
    temporalRange: { startDate: null, endDate: null },
    actorFocus: { primaryActors: [], secondaryActors: [] },
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Return a cached compiled graph for the given problemSetId, or create and
 * cache a new one if the cache is empty or expired.
 */
async function getOrCreateGraph(
  problemSetId: string,
  problemSetContext: ProblemSetContext,
): Promise<CachedGraph['graph']> {
  const cached = graphCache.get(problemSetId);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.graph;
  }

  const graph = await createWiredDocIntelligenceGraph({
    problemSetId,
    problemSetContext,
    // No SSE progress callbacks — OSINT ingestion is background, not user-facing
    onProgress: undefined,
  });

  graphCache.set(problemSetId, {
    graph,
    expiresAt: Date.now() + GRAPH_CACHE_TTL_MS,
  });

  return graph;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Process an OSINT event through the full doc-intelligence agent pipeline.
 *
 * Translates the event into a doc-intelligence input, resolves (or synthesises)
 * ProblemSetContext, and calls the compiled graph's processDocument method.
 *
 * @returns Summary of graph entities created from this event
 */
export async function processOSINTEventThroughAgents(
  event: OSINTEvent,
  feed: OSINTFeedConfig,
): Promise<{ actorsCreated: number; relationshipsCreated: number }> {
  const problemSetId = feed.problemSetId;

  // Resolve ProblemSetContext — fall back to minimal synthetic context if none exists
  let problemSetContext = await getProblemSetContext(problemSetId);
  if (!problemSetContext) {
    problemSetContext = buildFallbackContext(problemSetId, feed);
  }

  // Get or create a cached compiled graph for this problem set
  const graph = await getOrCreateGraph(problemSetId, problemSetContext);

  // Build document text from event content
  const documentText = `${event.title}\n\n${event.description ?? ''}`;

  // Build metadata — assertedVia: 'osint' is the critical field that flows
  // through the orchestrator to FactExtractor to GraphBuilder for correct
  // source method annotation on all created graph entities
  const metadata: Record<string, unknown> = {
    source: event.sourceName,
    sourceType: event.sourceType,
    url: event.sourceUrl ?? '',
    date: event.publishedAt?.toISOString() ?? new Date().toISOString(),
    originalName: `OSINT: ${event.title}`,
    documentType: 'OSINT_REPORT',
    workspaceId: event.workspaceId,
    assertedVia: 'osint',
    feedId: (event.metadata as Record<string, unknown>)?.feedId,
  };

  const report = await graph.processDocument(event.id, documentText, metadata);

  // Extract graph creation counts from the fact-extractor specialist result
  const factExtractorResult = (report as { specialistResults?: Record<string, { output?: { graphResult?: { actorsCreated?: number; relationshipsCreated?: number } } }> })
    ?.specialistResults?.['fact-extractor'];
  const graphResult = factExtractorResult?.output?.graphResult;

  return {
    actorsCreated: graphResult?.actorsCreated ?? 0,
    relationshipsCreated: graphResult?.relationshipsCreated ?? 0,
  };
}
