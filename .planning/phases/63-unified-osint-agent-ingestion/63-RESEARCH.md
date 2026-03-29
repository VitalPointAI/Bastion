# Phase 63: Unified OSINT Agent Ingestion — Research

**Researched:** 2026-03-29
**Domain:** Backend pipeline refactoring — routing OSINT feed events through the Phase 40 doc-intelligence agent team
**Confidence:** HIGH (all findings based on direct code inspection)

## Summary

Two completely separate entity extraction paths exist in the codebase today. The doc-intelligence agent team (`backend/src/doc-intelligence/`) is a 12-specialist LangGraph pipeline with NATO trust gates, quality ratings, provenance tracking, and graphBuilder integration. The OSINT entity extractor (`backend/src/osint/osint-entity-extractor.ts`) is a standalone 500-line module that calls Neo4j directly via raw Cypher MERGE statements, hardcodes confidence at 0.65, assigns no NATO ratings, and runs without any trust gate. The feed poller calls `extractAndSyncToGraph()` from the standalone extractor with a 3-slot LLM concurrency queue. The gap-filler service (`ironclaw/gap-filler-service.ts`) also calls `extractAndSyncToGraph()` directly.

The integration strategy is straightforward: translate an `OSINTEvent` into the metadata format `createWiredDocIntelligenceGraph` expects, pass the event title+description as `documentText`, supply a `ProblemSetContext` derived from the feed's `problemSetId`, and invoke `graph.processDocument()`. The doc-intelligence pipeline already handles NEWS_ARTICLE and OSINT_REPORT document types — OSINT events are naturally classified as one of these. The FactExtractor specialist already calls `graphBuilder.buildFromObjective()` which handles actor MERGE, relationship creation, entity resolution, containerIds scoping, and provenance writing. No new graph operation code needs to be invented.

The key challenge is performance: the doc-intelligence pipeline creates a full LangGraph StateGraph per invocation (including 12 specialist instantiations and a checkpointer). OSINT feed polling can produce hundreds of events per cycle. The pipeline must be wrapped with the existing LLM concurrency gate (currently `LLM_CONCURRENCY = 3`) and should reuse a single compiled graph instance rather than recreating it per event. The second key challenge is that `ProblemSetContext` is required by several specialists (`fact-extractor`, `trust-agent`, `quality-assessor`, `bias-identifier`), but the OSINT path currently skips context entirely. A fallback context must be synthesised from feed metadata when no interview-based context exists.

**Primary recommendation:** Create `backend/src/osint/osint-agent-bridge.ts` — a thin adapter that translates `OSINTEvent` + `OSINTFeedConfig` into the doc-intelligence pipeline's input shape. Replace the `enqueueLLMTask(extractAndSyncToGraph)` call in `feed-poller.ts` with `enqueueLLMTask(osintAgentBridge.process)`. Retire `osint-entity-extractor.ts` after migration is verified.

---

## Standard Stack

### Core — Already Present, No New Dependencies
| Module | Version | Purpose | Why Use It |
|--------|---------|---------|------------|
| `createWiredDocIntelligenceGraph` | (project) | Full 12-specialist LangGraph pipeline | Has trust gates, NATO ratings, provenance, entity resolution |
| `getProblemSetContext` | (project) | Fetch scoping interview context from PostgreSQL | Required by TrustAgent, FactExtractor, QualityAssessor |
| `graphBuilder` | (project) | Actor MERGE, relationship, tension creation in Neo4j | Already handles containerIds, assertedVia, NATO ratings |
| `LLM_CONCURRENCY` + `enqueueLLMTask` | (project) | Throttle concurrent LLM calls to 3 | Feed poller already has this pattern |
| `FactExtractor.extract()` | (project) | The specialist that actually calls graphBuilder | Already handles `skipGraphIngestion`, `natoSourceReliability` |
| `TrustAgent.evaluate()` | (project) | NATO source reliability evaluation | Critical gate — currently bypassed by OSINT path |

### What Gets Retired
| Module | Action | Why |
|--------|--------|-----|
| `osint/osint-entity-extractor.ts` | Retire (delete or deprecate) | All its logic will be replaced by the agent pipeline |
| Direct Neo4j MERGE in `extractAndSyncToGraph` | Remove | graphBuilder handles this with proper provenance |
| Hardcoded `confidence = 0.65` in extractor | Remove | Replaced by `SOURCE_WEIGHTS['osint']` + NATO ratings |

---

## Architecture Patterns

### Current Flow (to replace)
```
FeedPoller.pollFeed(feed)
  → osintEventStore.createEvent(item)          # PostgreSQL
  → syncOSINTEventToGraph(event)               # Basic Neo4j sync (no LLM, keep this)
  → enqueueLLMTask(() =>
      extractAndSyncToGraph(event)             # RETIRE THIS
    )
```

### Target Flow
```
FeedPoller.pollFeed(feed)
  → osintEventStore.createEvent(item)          # PostgreSQL (unchanged)
  → syncOSINTEventToGraph(event)               # Basic Neo4j sync (keep — fast fallback)
  → enqueueLLMTask(() =>
      osintAgentBridge.process(event, feed)    # NEW: routes through doc-intelligence
    )
```

### New Module: `backend/src/osint/osint-agent-bridge.ts`

**Responsibility:** Translate OSINTEvent → doc-intelligence pipeline input and invoke the agent team.

**Key design decisions:**
1. Reuse a single compiled `WiredDocIntelligenceGraph` per `problemSetId` (cache by problemSetId, evict after 30 minutes idle). Creating the StateGraph per event is too expensive.
2. Synthesise a `ProblemSetContext` from feed metadata when `getProblemSetContext()` returns null — do not abort processing.
3. Set `assertedVia = 'osint'` so source weight is 0.65 (from `SOURCE_WEIGHTS`), not the 0.75 `doc_intelligence` weight.
4. Construct the `documentId` as the OSINT event ID so provenance links back correctly.
5. Disable progress SSE callbacks (pass `onProgress: undefined`) — OSINT ingestion is background, not user-facing.
6. Translate `OSINTEvent.sourceName` → TrustAgent `sourceName` and `sourceType: 'news_agency'` (or derive from `OSINTEvent.sourceType`).

### Synthetic ProblemSetContext Construction

When `getProblemSetContext(problemSetId)` returns null (no interview completed), construct a minimal context:

```typescript
// Source: direct code inspection of ProblemSetContextSchema in schemas.ts
const fallbackContext: ProblemSetContext = {
  problemSetId: feed.problemSetId,
  coreProblem: 'General geopolitical intelligence monitoring',
  geographicScope: { regions: ['Global'], countries: [] },
  temporalRange: { startDate: null, endDate: null },
  actorFocus: { primaryActors: [], secondaryActors: [] },
  version: 1,
  updatedAt: new Date().toISOString(),
};
```

This is sufficient for TrustAgent (needs coreProblem + regions), FactExtractor (needs regions + actors), and QualityAssessor. Without a real context the specialists skip rather than crash — verified in `orchestrator-wiring.ts` line 358-368 (trust-agent), line 407-415 (fact-extractor).

### Document Metadata Shape for OSINT Events

```typescript
// Construct metadata to pass to processDocument()
const metadata: Record<string, unknown> = {
  source: event.sourceName,
  sourceType: event.sourceType,           // maps to feed sourceType
  url: event.sourceUrl ?? '',
  date: event.publishedAt?.toISOString() ?? new Date().toISOString(),
  originalName: `OSINT: ${event.title}`,
  documentType: 'OSINT_REPORT',           // hint triage to skip format-converter
  workspaceId: event.workspaceId,
  feedId: (event.metadata as Record<string, unknown>)?.feedId,
};

const documentText = `${event.title}\n\n${event.description ?? ''}`;
const documentId = event.id;             // Use event ID for provenance linkage
```

### Graph Operation Integration Path

The path from OSINTEvent text to Neo4j graph nodes goes:

```
osintAgentBridge.process(event, feed)
  → createWiredDocIntelligenceGraph({ problemSetId, problemSetContext })
  → graph.processDocument(event.id, documentText, metadata)
    → triage node: classifies as OSINT_REPORT, selects fact-extractor, trust-agent, bias-identifier
    → trust-agent node: evaluates event.sourceName via source_registry + LLM
      → if flagged: sets skipGraphIngestion = true
    → fact-extractor node:
        → calls graphBuilder.buildFromObjective(event.id, documentText, {
              workspaceId: event.workspaceId,
              sourceDocumentId: event.id,
              assertedVia: 'osint',            // override default
              natoSourceReliability: trustRating.sourceReliability,
              natoInformationCredibility: trustRating.informationCredibility,
              containerIds: [event.workspaceId],
            })
          → actorStore.createActor() with JSON-LD provenance
          → relationship/tension edges via relationshipStore/tensionStore
          → entity_provenance records written
    → quality-assessor node: assigns final NATO rating
    → report assembled with qualityRating, facts, trustStatus
```

**Critical insight:** `assertedVia` must be set to `'osint'` (not `'doc_intelligence'`) when calling `graphBuilder.buildFromObjective()`. The GraphBuildOptions interface has `assertedVia?: SourceMethod`. In the FactExtractor's `buildGraphEntities()` method, the override must be applied or it defaults to `'ai_inference'` (line 251 of graph-builder.ts). The bridge should either:
- Pass `assertedVia: 'osint'` in the processDocument metadata, OR
- Override in the FactExtractor input (requires adding `assertedVia` to `FactExtractorInput`)

### Recommended: Add `assertedVia` to FactExtractorInput

```typescript
// In FactExtractorInput (fact-extractor.ts)
assertedVia?: SourceMethod;  // ADD THIS — defaults to 'ai_inference' if absent

// In FactExtractor.extract(), pass through to buildGraphEntities():
graphResult = await this.buildGraphEntities(deduplicatedFacts, {
  sourceDocumentId: documentId,
  workspaceId,
  assertedVia: this.assertedVia ?? 'ai_inference',  // NEW: use injected value
  ...
});
```

And in orchestrator-wiring.ts, extract `assertedVia` from state.metadata and pass to FactExtractor.

### Graph Scope: containerIds

The current extractor sets `containerIds = [$workspaceId]` (line 373 of osint-entity-extractor.ts). The graphBuilder does the same via `options.containerIds`. The bridge must pass `containerIds: [event.workspaceId]` to `GraphBuildOptions`. This is already supported in the graphBuilder interface.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Actor MERGE with deduplication | Custom Neo4j Cypher | `graphBuilder.buildFromObjective()` via FactExtractor | Already handles name normalization, alias tracking, entity resolution |
| NATO source reliability evaluation | New LLM prompt | `TrustAgent.evaluate()` | Full source registry integration, blocking, flagging logic |
| Confidence scoring | Hardcoded 0.65 | `SOURCE_WEIGHTS['osint']` from confidence-calculator.ts | Consistent across all entity types, configurable per workspace |
| Provenance records | Manual inserts | `graphBuilder` + FactExtractor | Writes entity_provenance records automatically |
| Entity resolution (dedup) | New similarity check | Phase 62 `runPostSyncResolution()` | Already called per-cycle in feed poller, handles merge |
| JSON parsing with think-tag stripping | Custom parser | Pipeline already handles `<think>` tags | Verified in osint-entity-extractor.ts `parseJsonResponse()` |

**Key insight:** The doc-intelligence pipeline's FactExtractor+GraphBuilder already contains all the graph operation logic. The extractor's `buildGraphEntities()` method (lines 186-201 of fact-extractor.ts) is the correct integration point — all custom MERGE logic in `osint-entity-extractor.ts` duplicates what's already there with less rigor.

---

## Common Pitfalls

### Pitfall 1: Creating StateGraph Per Event
**What goes wrong:** `createWiredDocIntelligenceGraph()` creates a new StateGraph, compiles it, and instantiates 12 specialists on every call. 100 events/poll cycle = 100 graph compilations and 1200 specialist instantiations.
**Why it happens:** The current document pipeline creates a graph per upload request (which is fine for low volume). OSINT events arrive in batches.
**How to avoid:** Cache compiled graph instances by `problemSetId` with an LRU/TTL strategy. One compiled graph per active problem set, reused across all events in a polling cycle.
**Warning signs:** CPU spike on poll cycles; LangGraph checkpointer table growing rapidly.

### Pitfall 2: Missing ProblemSetContext Aborts Processing
**What goes wrong:** Specialists check `if (!state.problemSetContext) return { status: 'skipped' }`. If every specialist skips, the report is empty.
**Why it happens:** OSINT feeds can start before any user completes the scoping interview for that problem set.
**How to avoid:** Always provide a synthetic fallback context (see Architecture Patterns above). The specialists accept a minimal context — they use it for prompt scoping, not hard validation.
**Warning signs:** All specialist results showing `status: 'skipped'`; no graph entities created.

### Pitfall 3: assertedVia Defaults to 'ai_inference' (0.60 weight)
**What goes wrong:** Graph entities get `assertedVia = 'ai_inference'` confidence weight (0.60) instead of `'osint'` (0.65), and more critically, the source method annotation on Neo4j nodes is wrong for audit/provenance purposes.
**Why it happens:** `FactExtractor.extract()` currently passes `assertedBy` but hardcodes `assertedVia` to the default in `GraphBuildOptions`.
**How to avoid:** Add `assertedVia?: SourceMethod` to `FactExtractorInput` and thread it through to `buildGraphEntities()`. The bridge passes `assertedVia: 'osint'`.

### Pitfall 4: Duplicate documentId Conflicts
**What goes wrong:** `strategic_documents` table has a content_hash deduplication check in `routeToDocIntelligence()`. OSINT event IDs won't conflict, but if the bridge uses `routeToDocIntelligence()` it will also try to persist to `strategic_documents`.
**Why it happens:** The existing universal-ingest-router stores docs in PostgreSQL before LangGraph processing.
**How to avoid:** The bridge should NOT call `routeToDocIntelligence()`. Instead, call `createWiredDocIntelligenceGraph()` and `graph.processDocument()` directly, skipping the `strategic_documents` insert step. OSINT events already have their own store in `osint_events`.

### Pitfall 5: Trust Agent Blocks All RSS Feed Sources
**What goes wrong:** RSS feed sources like "Reuters", "BBC", "Al Jazeera" may be unknown to the source registry. TrustAgent defaults unknown sources to `F6` (Cannot Be Judged) and may flag them, blocking graph ingestion.
**Why it happens:** The source_registry is initially empty; feeds all look new.
**How to avoid:** Pre-seed the source_registry with standard news agency ratings (Reuters=B, BBC=B, AP=B, etc.) in a migration/seed script. Alternatively, add logic to the bridge that pre-registers the feed's `sourceName` with a default reliability of `'C'` (Fairly Reliable) before invoking the pipeline.

### Pitfall 6: Gap-Filler Service Also Calls extractAndSyncToGraph
**What goes wrong:** After retiring `osint-entity-extractor.ts`, `ironclaw/gap-filler-service.ts` will break at line 16 (direct import).
**Why it happens:** The gap-filler service creates synthetic OSINTEvents and then calls `extractAndSyncToGraph()` directly.
**How to avoid:** Update `gap-filler-service.ts` to call `osintAgentBridge.process(event, syntheticFeedConfig)` after migration. A synthetic feed config with the gap's problemSetId is sufficient.

### Pitfall 7: COP Layer Refresh Must Still Trigger
**What goes wrong:** The existing feed poller calls `updateOSINTCOPLayer()` and `runPostSyncResolution()` at the end of `pollFeed()`. These must NOT be removed — they are separate from entity extraction.
**Why it happens:** The COP pipeline and entity resolution are called after events are stored, regardless of extraction method.
**How to avoid:** Keep all COP and resolution calls in `pollFeed()` exactly as they are. Only the `enqueueLLMTask(() => extractAndSyncToGraph(...))` call is replaced.

---

## Code Examples

### Minimal Bridge Module Structure
```typescript
// backend/src/osint/osint-agent-bridge.ts
// Source: pattern derived from universal-ingest-router.ts lines 94-113
// and doc-intelligence API lines 692-703

import { createWiredDocIntelligenceGraph } from '../doc-intelligence/orchestrator-wiring.js';
import { getProblemSetContext } from '../doc-intelligence/interview/interview-store.js';
import type { OSINTEvent } from '../graph/osint/types.js';
import type { OSINTFeedConfig } from '../jpp/osint-feed-store.js';
import type { ProblemSetContext } from '../doc-intelligence/schemas.js';

// Compiled graph cache: one per problemSetId, TTL 30 minutes
const graphCache = new Map<string, { graph: Awaited<ReturnType<typeof createWiredDocIntelligenceGraph>>; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

async function getOrCreateGraph(problemSetId: string, problemSetContext: ProblemSetContext) {
  const cached = graphCache.get(problemSetId);
  if (cached && cached.expiresAt > Date.now()) return cached.graph;

  const graph = await createWiredDocIntelligenceGraph({
    problemSetId,
    problemSetContext,
    onProgress: undefined,   // No SSE for background OSINT ingestion
  });
  graphCache.set(problemSetId, { graph, expiresAt: Date.now() + CACHE_TTL_MS });
  return graph;
}

export async function processOSINTEventThroughAgents(
  event: OSINTEvent,
  feed: OSINTFeedConfig,
): Promise<{ actorsCreated: number; relationshipsCreated: number }> {
  const problemSetId = feed.problemSetId;

  // Fetch or synthesise problem set context
  let problemSetContext = await getProblemSetContext(problemSetId);
  if (!problemSetContext) {
    problemSetContext = buildFallbackContext(problemSetId, feed);
  }

  const graph = await getOrCreateGraph(problemSetId, problemSetContext);

  const documentText = `${event.title}\n\n${event.description ?? ''}`;
  const metadata: Record<string, unknown> = {
    source: event.sourceName,
    sourceType: event.sourceType,
    url: event.sourceUrl ?? '',
    date: event.publishedAt?.toISOString() ?? new Date().toISOString(),
    originalName: `OSINT: ${event.title}`,
    documentType: 'OSINT_REPORT',
    workspaceId: event.workspaceId,
    assertedVia: 'osint',   // Thread through to FactExtractor
  };

  const report = await graph.processDocument(event.id, documentText, metadata);

  return {
    actorsCreated: report.facts.filter(f => f.type === 'entity').length,
    relationshipsCreated: 0,  // report does not expose relationship count directly
  };
}

function buildFallbackContext(problemSetId: string, feed: OSINTFeedConfig): ProblemSetContext {
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
```

### Feed Poller Change (the callsite)
```typescript
// backend/src/osint/feed-poller.ts — replace lines 395-399
// BEFORE:
enqueueLLMTask(async () => {
  await extractAndSyncToGraph(storedEvent).catch(() => {});
});

// AFTER:
enqueueLLMTask(async () => {
  await processOSINTEventThroughAgents(storedEvent, feed).catch(err => {
    console.warn(`[FeedPoller] Agent pipeline failed for "${item.title}":`, err);
    // Non-fatal — basic syncOSINTEventToGraph already created the node
  });
});
```

### FactExtractor assertedVia Threading
```typescript
// backend/src/doc-intelligence/specialists/fact-extractor.ts
// Add to FactExtractorInput interface:
/** Optional: provenance source method override (default: 'ai_inference') */
assertedVia?: SourceMethod;

// In buildGraphEntities() call at line ~187:
graphResult = await this.buildGraphEntities(deduplicatedFacts, {
  sourceDocumentId: documentId,
  workspaceId,
  assertedVia: this.currentAssertedVia ?? 'ai_inference', // read from input
  assertedBy: uploadedBy ?? 'system:doc-intelligence',
  ...
});
```

```typescript
// backend/src/doc-intelligence/orchestrator-wiring.ts
// In fact-extractor node (line ~425), extract assertedVia from metadata:
const assertedVia = (state.metadata?.assertedVia as string) ?? 'ai_inference';
const extractOutput = await factExtractor.extract({
  ...existingInputs,
  assertedVia: assertedVia as SourceMethod,
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Hardcoded `confidence = 0.65` on all OSINT actors | NATO-rated per-source via TrustAgent + SOURCE_WEIGHTS | Entities from Reuters (B-rated) get higher confidence than anonymous blogs |
| Direct Neo4j MERGE bypassing actorStore | `graphBuilder.buildFromObjective()` → actorStore | Entity resolution, alias tracking, JSON-LD provenance |
| No trust gate on feed events | TrustAgent evaluates source per event | Known bad actors (propaganda outlets) can be blocked |
| No quality flag for human review | `requiresHumanReview` flag in report | Suspicious sources surface for analyst review |
| `assertedVia = 'osint'` hardcoded in MERGE | Dynamic per source type via SourceMethod enum | Correct source weight in confidence fusion |

**Deprecated after this phase:**
- `osint-entity-extractor.ts`: retire after all callers migrated (feed-poller, gap-filler-service)
- Hardcoded `confidence = 0.65` in the extractor (line 375): removed by retirement

---

## Callers That Must Be Updated

| File | Line | Current Call | Migration Action |
|------|------|-------------|-----------------|
| `backend/src/osint/feed-poller.ts` | 397 | `extractAndSyncToGraph(storedEvent)` | Replace with `processOSINTEventThroughAgents(storedEvent, feed)` |
| `backend/src/ironclaw/gap-filler-service.ts` | 291 | `extractAndSyncToGraph(event)` | Replace with `processOSINTEventThroughAgents(event, syntheticFeed)` |
| `backend/src/scripts/reextract-osint-actors.ts` | 105 | `extractAndSyncToGraph(event)` | Update script to use bridge OR leave as legacy one-off |

---

## Open Questions

1. **Source pre-seeding strategy**
   - What we know: TrustAgent checks `source_registry` table for known sources
   - What's unclear: Whether a seed migration for major news agencies (Reuters, BBC, AP, Al Jazeera) should be bundled with this phase or done as a separate admin task
   - Recommendation: Bundle a migration that pre-registers the most common RSS feed sources at `'C'` (Fairly Reliable) as default. Leave admin UI override capability.

2. **Graph cache invalidation when problemSetContext changes**
   - What we know: Context can change if user re-runs the scoping interview
   - What's unclear: Whether to invalidate on every processDocument call vs TTL
   - Recommendation: Use 30-minute TTL — context changes are rare, and TrustAgent dynamically re-evaluates each source anyway

3. **Report persistence for OSINT events**
   - What we know: The document pipeline normally stores reports in `doc_intelligence_reports` table after processing
   - What's unclear: Whether OSINT-sourced reports should be stored there (could create large table growth)
   - Recommendation: Skip `doc_intelligence_reports` insert for OSINT events. Store NATO rating and trust status back on the `osint_events` row instead (add `nato_reliability` + `trust_status` columns).

4. **Concurrency: 3 slots enough?**
   - What we know: `LLM_CONCURRENCY = 3` was set to avoid CPU saturation from the simple single-LLM extractor
   - What's unclear: Whether `LLM_CONCURRENCY = 3` is sufficient for the full 12-specialist pipeline which uses more LLM calls per event
   - Recommendation: Reduce to `LLM_CONCURRENCY = 2` initially and monitor. Each full pipeline invocation makes ~6-8 LLM calls vs ~1-2 for the old extractor.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (package.json: `"test": "vitest"`) |
| Config file | See `osint-graph-sync.test.ts` pattern |
| Quick run command | `bash -lc 'cd /home/vitalpointai/projects/ssr/backend && npx vitest run src/osint/'` |
| Full suite command | `bash -lc 'cd /home/vitalpointai/projects/ssr/backend && npx vitest run'` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OSINT-63-01 | `processOSINTEventThroughAgents` calls `createWiredDocIntelligenceGraph` with correct inputs | unit (mock graph) | `npx vitest run src/osint/osint-agent-bridge.test.ts` | Wave 0 |
| OSINT-63-02 | Bridge synthesises fallback ProblemSetContext when none exists | unit | same file | Wave 0 |
| OSINT-63-03 | Feed poller no longer imports `extractAndSyncToGraph` | compile check | `bash -lc 'cd backend && npx tsc --noEmit'` | N/A |
| OSINT-63-04 | `assertedVia: 'osint'` propagated to graphBuilder options | unit (spy) | `npx vitest run src/osint/osint-agent-bridge.test.ts` | Wave 0 |
| OSINT-63-05 | Compiled graph is cached (not recreated per event) | unit | same file | Wave 0 |
| OSINT-63-06 | Gap filler service uses bridge not direct extractor | compile check | `bash -lc 'cd backend && npx tsc --noEmit'` | N/A |

### Wave 0 Gaps
- [ ] `backend/src/osint/osint-agent-bridge.test.ts` — covers OSINT-63-01 through OSINT-63-05

---

## Sources

### Primary (HIGH confidence — direct code inspection)
- `/home/vitalpointai/projects/ssr/backend/src/doc-intelligence/orchestrator-wiring.ts` — full pipeline wiring, WiredGraphConfig interface
- `/home/vitalpointai/projects/ssr/backend/src/doc-intelligence/team-setup.ts` — all 12 specialist definitions
- `/home/vitalpointai/projects/ssr/backend/src/osint/osint-entity-extractor.ts` — standalone extractor to retire (550 lines)
- `/home/vitalpointai/projects/ssr/backend/src/osint/feed-poller.ts` — LLM queue, callsite for migration
- `/home/vitalpointai/projects/ssr/backend/src/graph/construction/graph-builder.ts` — graphBuilder API, GraphBuildOptions
- `/home/vitalpointai/projects/ssr/backend/src/doc-intelligence/specialists/fact-extractor.ts` — FactExtractorInput, buildGraphEntities
- `/home/vitalpointai/projects/ssr/backend/src/doc-intelligence/specialists/trust-agent.ts` — TrustAgentInput, NATO evaluation
- `/home/vitalpointai/projects/ssr/backend/src/graph/confidence-calculator.ts` — SOURCE_WEIGHTS, HALF_LIFE_DEFAULTS
- `/home/vitalpointai/projects/ssr/backend/src/graph/provenance-types.ts` — SourceMethod enum
- `/home/vitalpointai/projects/ssr/backend/src/ingest/universal-ingest-router.ts` — existing integration pattern
- `/home/vitalpointai/projects/ssr/backend/src/ironclaw/gap-filler-service.ts` — secondary caller to migrate

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all modules directly inspected, no external deps needed
- Architecture: HIGH — integration point (processDocument) is confirmed working in universal-ingest-router
- Pitfalls: HIGH — identified from direct code path tracing; graph cache pitfall inferred from StateGraph compilation cost

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable internal codebase)
