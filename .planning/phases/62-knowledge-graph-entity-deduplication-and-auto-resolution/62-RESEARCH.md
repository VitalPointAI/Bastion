# Phase 62: Knowledge Graph Entity Deduplication & Auto-Resolution - Research

**Researched:** 2026-03-29
**Domain:** Neo4j entity resolution, name canonicalization, alias registry, pipeline integration
**Confidence:** HIGH — based entirely on direct source code inspection of the existing implementation

## Summary

The knowledge graph has accumulated 28,800+ Actor nodes with significant duplication because the two primary ingestion pathways — OSINT sync and LLM graph builder — operate independently without name normalization or automatic deduplication. A complete entity resolution service already exists (`resolution-service.ts`, `blocking.ts`, `string-matcher.ts`, `embedding-matcher.ts`, `ontology-matcher.ts`) with hybrid three-signal scoring (string + embedding + type), but it is never called automatically by OSINT sync and is only conditionally called by the graph builder when `runEntityResolution: true` is passed.

The core problem is a mismatch between how actors enter the graph and what the resolution service can find. OSINT sync uses a raw Cypher `MERGE (a:Actor {name: $name})` with the exact untrimmed actor name from the event — so "PRC" and "People's Republic of China" land as two separate nodes. The graph builder uses `findActorsByName()` which only does substring matching, not fuzzy/semantic matching. There is no pre-ingestion normalization step and no canonical alias registry to pre-wire known equivalences (US/USA/United States, PRC/China/People's Republic of China, etc.).

The resolution infrastructure is mature and well-tested. This phase is primarily an integration and wiring task: normalize names before node creation, auto-run resolution after the two main ingestion entry points, build a canonical alias registry for military/geopolitical names, batch-merge existing duplicates, and expose dedup metrics in the graph stats endpoint.

**Primary recommendation:** Wire the existing `entityResolutionService` into OSINT sync and ensure `buildFromDocument()` always runs resolution (currently gated on `runEntityResolution !== false` — the default behavior is already correct if callers don't override it). The highest-leverage additions are: (1) a pre-ingestion name normalizer that maps known aliases to canonical forms before the `MERGE` statement executes, and (2) a batch-merge endpoint that can process the existing 28,800+ duplicate nodes.

## Standard Stack

### Core (existing — do NOT replace)
| Library / File | Version/Location | Purpose | Why Standard |
|----------------|-----------------|---------|--------------|
| `resolution-service.ts` | `backend/src/graph/resolution/` | Hybrid 3-signal entity resolution | Already implemented and tested |
| `blocking.ts` | `backend/src/graph/resolution/` | Blocking-key-based candidate generation | Scales O(n) instead of O(n^2) |
| `string-matcher.ts` | `backend/src/graph/resolution/` | Jaro-Winkler + Levenshtein similarity | Already in use |
| `embedding-matcher.ts` | `backend/src/graph/resolution/` | text-embedding-3-large cosine similarity with Neo4j caching | Phase 47 |
| `ontology-matcher.ts` | `backend/src/graph/resolution/` | jsonldType exact-match scoring | Phase 47 |
| `actor-store.ts` | `backend/src/graph/raft/` | `mergeActors()`, `addAlias()`, `findActorsByName()` | Core actor persistence |
| `osint-graph-sync.ts` | `backend/src/osint/` | OSINT ingestion into graph | Entry point for OSINT duplicates |
| `graph-builder.ts` | `backend/src/graph/construction/` | LLM extraction pipeline | Entry point for doc-based duplicates |
| `vitest` | `^4.1.2` | Test framework | Project standard |
| `string-comparison` | existing dep | Jaro-Winkler, Levenshtein | Already installed |

### New Additions Needed
| File (new) | Purpose | Notes |
|------------|---------|-------|
| `backend/src/graph/resolution/canonical-aliases.ts` | Static alias registry (US, PRC, etc.) | Pure data module, no external deps |
| `backend/src/graph/resolution/name-normalizer.ts` | Pre-ingestion name normalization | Applies alias registry before node creation |

## Architecture Patterns

### Recommended Project Structure
```
backend/src/graph/resolution/
├── resolution-service.ts       # existing: hybrid scoring + merge orchestration
├── blocking.ts                 # existing: candidate blocking keys
├── string-matcher.ts           # existing: Jaro-Winkler/Levenshtein
├── embedding-matcher.ts        # existing: OpenAI embedding cosine sim
├── ontology-matcher.ts         # existing: jsonldType signal
├── canonical-aliases.ts        # NEW: static alias registry
├── name-normalizer.ts          # NEW: normalize() function
├── resolution-service.test.ts  # existing tests (continue using)
└── index.ts                    # re-export
```

### Pattern 1: Canonical Alias Registry
**What:** A static lookup table mapping known variant names to their canonical form. Applied before any `MERGE` or `createActor` call.
**When to use:** Pre-ingestion normalization — call `normalizeActorName()` before passing the name to Neo4j.
**Example:**
```typescript
// backend/src/graph/resolution/canonical-aliases.ts

/**
 * Canonical alias registry for common geopolitical name variants.
 * Maps variant → canonical form. Applied before actor node creation.
 * Keys are lowercase normalized for case-insensitive lookup.
 */
export const CANONICAL_ALIASES: Record<string, string> = {
  // United States variants
  'us': 'United States',
  'usa': 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'america': 'United States',
  'united states of america': 'United States',

  // China variants
  'prc': 'China',
  'peoples republic of china': 'China',
  "people's republic of china": 'China',
  'ccp': 'Chinese Communist Party',  // distinct entity

  // Korea variants
  'dprk': 'North Korea',
  'democratic peoples republic of korea': 'North Korea',
  "democratic people's republic of korea": 'North Korea',
  'rok': 'South Korea',
  'republic of korea': 'South Korea',

  // Military shorthand
  'nato': 'NATO',
  'north atlantic treaty organization': 'NATO',
  'pla': 'People\'s Liberation Army',
  'peoples liberation army': "People's Liberation Army",
  'indopacom': 'INDOPACOM',
  'indo-pacific command': 'INDOPACOM',
  'pacom': 'INDOPACOM',  // former name

  // Russia variants
  'rf': 'Russia',
  'russian federation': 'Russia',

  // Other common military intel actors
  'dod': 'Department of Defense',
  'department of defense': 'Department of Defense',
  'un': 'United Nations',
  'united nations': 'United Nations',
};

/**
 * Normalize an actor name to its canonical form.
 * Returns the canonical name if found, otherwise returns the original (trimmed).
 */
export function normalizeActorName(name: string): string {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
  return CANONICAL_ALIASES[key] ?? trimmed;
}
```

### Pattern 2: OSINT Sync Pre-Normalization
**What:** Apply `normalizeActorName()` to the actor name BEFORE the Cypher `MERGE` statement.
**When to use:** In `syncOSINTEventToGraph()` — single call site.
**Current code (line 329-332 in osint-graph-sync.ts):**
```typescript
// BEFORE (no normalization):
for (const actorName of event.actors) {
  const trimmed = (actorName ?? '').trim();
  if (!trimmed || trimmed.length < 2) continue;
  const actorId = `ACT-osint-${trimmed.toLowerCase().replace(/\s+/g, '-')...}`;
  await executeWriteQuery(`MERGE (a:Actor {name: $name})`, { name: trimmed, ... });
}
```
**After:**
```typescript
import { normalizeActorName } from '../graph/resolution/name-normalizer.js';

for (const actorName of event.actors) {
  const trimmed = (actorName ?? '').trim();
  if (!trimmed || trimmed.length < 2) continue;
  const canonical = normalizeActorName(trimmed);  // << apply alias registry
  const actorId = `ACT-osint-${canonical.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  await executeWriteQuery(`MERGE (a:Actor {name: $name})`, { name: canonical, ... });
}
```

### Pattern 3: Graph Builder Pre-Normalization
**What:** Apply `normalizeActorName()` before the `findActorsByName()` lookup and before `createActor()` in `buildFromObjective()`.
**Current code (lines 268-351 in graph-builder.ts):**
```typescript
// BEFORE:
const existing = await actorStore.findActorsByName(actor.name, false);
// and:
const newActor = await actorStore.createActor({ name: actor.name, ... });

// AFTER:
const canonicalName = normalizeActorName(actor.name);
const existing = await actorStore.findActorsByName(canonicalName, false);
// ...
const newActor = await actorStore.createActor({ name: canonicalName, ... });
```

### Pattern 4: Auto-Resolution After buildFromDocument()
**What:** Ensure entity resolution always runs after `buildFromDocument()`. Currently it runs only when `runEntityResolution !== false`. The logic is correct but the condition is weak — callers pass `runEntityResolution: false` explicitly in some contexts. Make it the default and document the override clearly.
**Current code (lines 479, 491-500 in graph-builder.ts):**
```typescript
// In buildFromObjective:
runEntityResolution: false, // Run once at end  <-- override exists

// In buildFromDocument:
if (options.runEntityResolution !== false) {   // weak guard
```
The fact-extractor and objective-extractor both pass `runEntityResolution: true` explicitly, so resolution IS running from doc-intelligence. The gap is OSINT sync which has no resolution call at all.

### Pattern 5: Auto-Resolution After OSINT Sync
**What:** Call `entityResolutionService.findDuplicates()` + `autoMergeDuplicates()` after each OSINT event sync, or batch after a sync cycle ends.
**When to use:** End of `syncOSINTEventToGraph()`. Since this may be called per-event, consider calling resolution at the feed-poller level after a batch completes rather than per-event to avoid O(n^2) scans on every event.

```typescript
// In feed-poller.ts or osint-graph-sync.ts:
import { entityResolutionService } from '../graph/resolution/resolution-service.js';

// After processing a batch of OSINT events:
const resolution = await entityResolutionService.findDuplicates(workspaceId);
await entityResolutionService.autoMergeDuplicates(resolution);
```

### Pattern 6: Batch-Merge Existing Duplicates
**What:** New API endpoint to batch-process all existing duplicates in the graph. This is a one-time cleanup for the existing 28,800+ nodes.

```typescript
// New endpoint in backend/src/api/graph.ts:
router.post('/resolution/batch-merge', async (req, res) => {
  const { workspaceId, dryRun = true } = req.body;
  const result = await entityResolutionService.findDuplicates(workspaceId);

  if (dryRun) {
    return res.json({
      autoMergeCandidates: result.autoMerge.length,
      reviewCandidates: result.needsReview.length,
      candidates: result.candidates.slice(0, 50),  // sample
    });
  }

  const merges = await entityResolutionService.autoMergeDuplicates(result);
  res.json({ mergedCount: merges.length, merges });
});
```

### Pattern 7: Dedup Metrics in Graph Stats Endpoint
**What:** Add a `/graph/stats` endpoint (currently does not exist as a standalone route) that includes dedup metrics: total actors, soft-deleted actors, estimated duplicate pairs, and last resolution run timestamp.

```typescript
// New endpoint in backend/src/api/graph.ts:
router.get('/stats', async (req, res) => {
  const workspaceId = getQueryString(req.query.workspaceId);
  const { executeReadQuery } = await import('../graph/neo4j-client.js');

  // Count total and soft-deleted actors
  const countResult = await executeReadQuery(`
    MATCH (a:Actor)
    WHERE a.workspaceId = $workspaceId OR $workspaceId IS NULL
    RETURN
      count(a) as total,
      count(CASE WHEN a.validTo IS NOT NULL THEN 1 END) as softDeleted,
      count(CASE WHEN a.validTo IS NULL THEN 1 END) as active
  `, { workspaceId: workspaceId ?? null });

  const counts = countResult.records[0];

  // Get duplicate candidate count (uses existing service)
  const resolution = await entityResolutionService.findDuplicates(workspaceId);

  res.json({
    totalActors: counts.get('total').toNumber(),
    activeActors: counts.get('active').toNumber(),
    softDeletedActors: counts.get('softDeleted').toNumber(),
    duplicateCandidates: resolution.candidates.length,
    autoMergeCandidates: resolution.autoMerge.length,
    humanReviewCandidates: resolution.needsReview.length,
  });
});
```

### Anti-Patterns to Avoid
- **Calling `findDuplicates()` on every single OSINT event:** The blocking algorithm is efficient but calling it once per event on 28,800+ nodes is wasteful. Call it at batch boundaries (end of poll cycle).
- **Using hard delete (`purgeActor()`) in merge:** The existing `mergeActors()` correctly uses soft delete via `deleteActor()`. Preserve this — temporal history is critical for BASTION's validity decay model.
- **Overwriting the canonical name with the variant:** Always use `normalizeActorName()` output as the stored `name`. Never store "PRC" as canonical — only as an alias.
- **Blocking the OSINT event-processing loop with LLM calls:** `verifyWithLLM()` is slow. Only call it for `needsReview` candidates (score 0.5-0.85), not for `autoMerge` candidates (score >= 0.85). The batch-merge endpoint should use auto-merge only by default.
- **Modifying the existing `mergeActors()` Neo4j Cypher:** The relationship transfer queries (lines 500-514 of actor-store.ts) lose original relationship type labels (everything becomes `RELATES_TO`). This is a pre-existing limitation — document it but do not attempt to fix it in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String similarity scoring | Custom edit-distance | `string-comparison` (already installed) via `string-matcher.ts` | Already battle-tested in the project |
| Semantic similarity | Custom embeddings | `embedding-matcher.ts` + OpenAI text-embedding-3-large | Already implemented with Neo4j caching |
| Candidate pair generation | Brute-force O(n^2) | `blocking.ts` `findCandidateMatches()` | Reduces comparison space via blocking keys |
| Actor merge logic | Custom Cypher merge | `actorStore.mergeActors()` | Handles alias consolidation, soft-delete, relationship transfer |
| Duplicate detection | Custom query | `entityResolutionService.findDuplicates()` | Full hybrid 3-signal scoring, already works |
| Name normalization | Ad-hoc regex everywhere | `normalizeActorName()` from `name-normalizer.ts` | Single source of truth |

**Key insight:** Every critical piece of entity resolution machinery already exists and is tested. This phase is 90% wiring, 10% new code (the alias registry and normalizer).

## Common Pitfalls

### Pitfall 1: OSINT Sync Node ID Mismatch After Normalization
**What goes wrong:** OSINT sync generates actor IDs deterministically from the actor name: `ACT-osint-${trimmed.toLowerCase()...}`. If "PRC" was previously ingested as `ACT-osint-prc` and we normalize to "China" which produces `ACT-osint-china`, the `MERGE (a:Actor {name: $name})` will match on name but the stored ID may conflict with an existing China node created by the graph builder (which uses UUID-based IDs).
**Why it happens:** Two different ID generation strategies for the same logical entity.
**How to avoid:** After normalization, use `findActorsByName(canonical, false)` first to check for an existing node. If found, add the OSINT source document to that node's `sourceDocumentIds`. Only `MERGE` a new node if no existing actor is found. This matches the pattern graph-builder already uses (lines 270-282 of graph-builder.ts).
**Warning signs:** Two actors with similar names but different ID prefixes (`ACT-osint-*` vs UUID format).

### Pitfall 2: `findDuplicates()` Performance on Large Actor Sets
**What goes wrong:** `entityResolutionService.findDuplicates()` calls `actorStore.listActors(workspaceId)` which loads ALL actors into memory, then applies blocking. With 28,800+ nodes this may be slow.
**Why it happens:** The blocking algorithm reduces comparison pairs but loading all actors at once is memory-intensive.
**How to avoid:** Pass a `workspaceId` filter when possible. For the batch cleanup of existing duplicates, process workspace-by-workspace rather than globally. The `listActors()` call already supports workspace filtering.
**Warning signs:** Timeout errors or OOM on the batch-merge endpoint.

### Pitfall 3: Relationship Type Loss During Merge
**What goes wrong:** `actorStore.mergeActors()` transfers all relationships via `CREATE (target)-[newRel:RELATES_TO]->(other)` — all original relationship types (e.g., `ALLIED_WITH`, `ADVERSARIAL_TOWARD`) are flattened to `RELATES_TO`. The original type is preserved in the relationship properties but the label is lost.
**Why it happens:** Cypher does not support dynamic relationship type labels without APOC procedures.
**How to avoid:** Do not attempt to fix this in Phase 62. Document the limitation. The relationship `type` property (string) is preserved even if the label is coerced to `RELATES_TO`.
**Warning signs:** Graph visualization shows all edges as generic "relates to" after a merge.

### Pitfall 4: Soft-Deleted Actors Showing Up in Duplicate Scans
**What goes wrong:** `actorStore.listActors()` does not filter out soft-deleted actors by default (actors with `validTo IS NOT NULL`). This causes soft-deleted actors (the merged-away duplicates) to appear as new candidates in subsequent resolution passes.
**Why it happens:** The `listActors()` method applies `validTo` filter only when `atTime` is provided.
**How to avoid:** When calling `findDuplicates()` for periodic auto-resolution, pass `atTime: new Date()` to the underlying `listActors()` call — or add an `activeOnly` flag to `findDuplicates()`. Check `actorStore.listActors()` signature — the `atTime` parameter already enables this filter.
**Warning signs:** Re-merging of previously merged actors; `actorsMerged` count doesn't decrease after cleanup runs.

### Pitfall 5: Alias Registry Misidentification (China vs. Republic of China)
**What goes wrong:** The entity-resolution-agent's `knowledge` array (lines 96-116 of entity-resolution-agent.ts) explicitly documents that "China" = PRC but "Republic of China" = Taiwan (ROC). Mapping both to "China" would be incorrect.
**Why it happens:** Naive string normalization conflates distinct geopolitical entities.
**How to avoid:** The alias registry MUST NOT map "Republic of China" → "China". Map "PRC" → "China" and "People's Republic of China" → "China" only. "Republic of China" is a distinct canonical entity (Taiwan).
**Warning signs:** Taiwan-related intelligence being merged into China's actor node.

### Pitfall 6: LLM Verification Cost in Auto-Mode
**What goes wrong:** `verifyAllCandidates()` calls `verifyWithLLM()` for every `needsReview` candidate. With thousands of candidates, this incurs significant LLM API cost and latency.
**Why it happens:** The batch-merge endpoint may trigger verification for hundreds of borderline candidates.
**How to avoid:** The batch-merge endpoint should only auto-merge `autoMerge` candidates (score >= 0.85) without LLM verification. Keep LLM verification behind the human-review UI workflow.

## Code Examples

### Existing: How `mergeActors()` Works (actor-store.ts:471-535)
```typescript
// Source: backend/src/graph/raft/actor-store.ts lines 471-535
async mergeActors(sourceId: string, targetId: string): Promise<Actor | null> {
  // 1. Fetch both actors
  // 2. Merge aliases (unique set), add source.name as alias of target
  // 3. Merge sourceDocumentIds
  // 4. Transfer relationships (BOTH directions) from source → target
  //    Note: all become :RELATES_TO — type preserved in properties only
  // 5. Update target with merged data
  // 6. Soft-delete source (sets validTo = now)
  // Returns: updated target actor
}
```

### Existing: Hybrid Score Formula (resolution-service.ts)
```typescript
// Source: backend/src/graph/resolution/resolution-service.ts
// Weights: 0.4 * stringSim + 0.4 * embeddingSim + 0.2 * typeSim
// Thresholds: >= 0.85 → auto_merge | 0.5-0.85 → human_review | < 0.5 → distinct
export function computeHybridScore(stringSim: number, embeddingSim: number, typeSim: number): number {
  return 0.4 * stringSim + 0.4 * embeddingSim + 0.2 * typeSim;
}
```
Note: `EntityResolutionService` uses its own internal thresholds (`autoMergeThreshold = 0.95`, `reviewThreshold = 0.85`) which are HIGHER than the exported `classifyHybridScore()` function thresholds. The `findDuplicates()` method uses `reviewThreshold = 0.85` as the candidacy cutoff and `autoMergeThreshold = 0.95` for the `autoMerge` bucket. The exported `classifyHybridScore()` uses 0.85 for auto-merge. These are inconsistent — the planner should pick one threshold and standardize (HIGH confidence this inconsistency exists, verify before coding).

### Existing: OSINT Actor ID Generation Pattern (osint-graph-sync.ts:332)
```typescript
// Source: backend/src/osint/osint-graph-sync.ts line 332
const actorId = `ACT-osint-${trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
```
After normalization, this pattern will still work — just replace `trimmed` with `canonical` (the output of `normalizeActorName(trimmed)`).

### Existing: `findActorsByName()` — What Substring Match Catches (actor-store.ts:190-210)
```typescript
// Source: backend/src/graph/raft/actor-store.ts lines 190-210
// Non-fuzzy: CONTAINS match on name and aliases (case-insensitive)
// This catches "China" ⊃ "China Sea" but NOT "PRC" ⊃ "China"
// Fuzzy: Uses Neo4j full-text index with Lucene ~ operator
//        Catches typos but NOT acronym expansion
WHERE a.name = $name OR toLower(a.name) CONTAINS toLower($name)
   OR ANY(alias IN a.aliases WHERE toLower(alias) CONTAINS toLower($name))
```

## State of the Art

| Old Approach | Current Approach | Notes |
|---|---|---|
| No resolution at OSINT sync | Auto-resolution after OSINT batch (Phase 62) | OSINT currently has no dedup |
| Resolution gated on `runEntityResolution: true` flag | Always-on with workspace-scoped batching | Flag remains for override capability |
| No pre-ingestion normalization | `normalizeActorName()` applied before MERGE | New in Phase 62 |
| No alias registry | `CANONICAL_ALIASES` static map | New in Phase 62 |
| Resolution only via manual API call | Auto after doc ingestion + periodic OSINT batch | Phase 62 closes this gap |

**Key gap confirmed:** The existing `EntityResolutionService` is a batch post-processor, never called in the OSINT ingestion hot path. Phase 62 changes this.

## Open Questions

1. **Threshold Inconsistency**
   - What we know: `EntityResolutionService.autoMergeThreshold = 0.95` but `classifyHybridScore()` uses `>= 0.85` for auto_merge
   - What's unclear: Which threshold should govern batch-merge?
   - Recommendation: Planner should standardize to 0.85 for auto-merge (matching the exported function) and document the change in a comment. The 0.95 internal threshold was likely set conservatively and is now over-cautious.

2. **Batch Merge Performance Bound**
   - What we know: 28,800+ nodes, blocking reduces pairs but number is unknown
   - What's unclear: How long will the initial cleanup take? Will it time out?
   - Recommendation: The batch-merge endpoint should support pagination (e.g., `limit` param) and return a job ID for async processing, OR accept that it runs in the background via `res.json({ status: 'started' })`.

3. **OSINT Resolution Granularity**
   - What we know: `syncOSINTEventToGraph()` is called per-event from `feed-poller.ts`
   - What's unclear: Should resolution run per-event, per-poll-cycle, or on a timer?
   - Recommendation: Run at end of each poll cycle in `feed-poller.ts`, not per-event. Check `backend/src/osint/feed-poller.ts` line structure to find the cycle boundary.

4. **Neo4j Full-Text Index Coverage for Aliases**
   - What we know: `actor_name_fulltext` index covers only `a.name`, not `a.aliases` (schema-init.ts line 122-124, comment confirms: "aliases handled at query level")
   - What's unclear: Should Phase 62 extend the index to cover aliases?
   - Recommendation: Out of scope for Phase 62 — the alias registry handles the most common cases. Deferred to a future phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.2 |
| Config file | `backend/vitest.config.ts` (inferred from package.json) |
| Quick run command | `cd backend && pnpm test -- --testPathPattern="resolution"` |
| Full suite command | `cd backend && pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 62-01 | `normalizeActorName("PRC")` returns "China" | unit | `pnpm test -- name-normalizer` | ❌ Wave 0 |
| 62-02 | `normalizeActorName("US")` returns "United States" | unit | `pnpm test -- name-normalizer` | ❌ Wave 0 |
| 62-03 | `normalizeActorName("Republic of China")` returns "Republic of China" (NOT "China") | unit | `pnpm test -- name-normalizer` | ❌ Wave 0 |
| 62-04 | OSINT sync uses normalized name in MERGE | unit (mocked Neo4j) | `pnpm test -- osint-graph-sync` | ❌ Wave 0 |
| 62-05 | `findDuplicates()` excludes soft-deleted actors | unit | `pnpm test -- resolution-service` | ❌ extend existing |
| 62-06 | Batch-merge endpoint returns dry-run candidates | integration (mocked) | `pnpm test -- batch-merge` | ❌ Wave 0 |
| 62-07 | Graph stats endpoint returns dedup metrics | unit | `pnpm test -- graph-stats` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && pnpm test -- --testPathPattern="resolution|name-normalizer"`
- **Per wave merge:** `cd backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/graph/resolution/name-normalizer.test.ts` — covers 62-01, 62-02, 62-03
- [ ] `backend/src/osint/osint-graph-sync.test.ts` — covers 62-04 (mocked Neo4j)
- [ ] `backend/src/api/graph-stats.test.ts` — covers 62-07

## Sources

### Primary (HIGH confidence)
- Direct source code read: `backend/src/graph/resolution/resolution-service.ts` — full service implementation
- Direct source code read: `backend/src/graph/resolution/blocking.ts` — blocking algorithm
- Direct source code read: `backend/src/graph/resolution/string-matcher.ts` — string scoring
- Direct source code read: `backend/src/graph/resolution/embedding-matcher.ts` — embedding + caching
- Direct source code read: `backend/src/graph/resolution/ontology-matcher.ts` — type signal
- Direct source code read: `backend/src/osint/osint-graph-sync.ts:310-370` — OSINT sync with exact-name MERGE
- Direct source code read: `backend/src/graph/construction/graph-builder.ts:268-511` — actor creation + resolution call
- Direct source code read: `backend/src/graph/raft/actor-store.ts:190-536` — findActorsByName, mergeActors
- Direct source code read: `backend/src/api/graph.ts:421-440` — existing resolution API endpoints
- Direct source code read: `backend/src/graph/agents/entity-resolution-agent.ts` — alias knowledge (geopolitical)
- Direct source code read: `backend/src/doc-intelligence/specialists/fact-extractor.ts:354` — resolution wiring in doc-intel
- Direct source code read: `backend/src/doc-intelligence/specialists/objective-extractor.ts:417` — resolution wiring in doc-intel

### Secondary (MEDIUM confidence)
- Phase description context: "28,800+ nodes with significant duplication" — not independently verified against live DB, taken as given

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files directly inspected, no guessing
- Architecture: HIGH — patterns derived from existing code and direct gaps found
- Pitfalls: HIGH — identified from actual code behavior (threshold inconsistency confirmed, ID mismatch confirmed, soft-delete filter gap confirmed)
- Alias registry contents: MEDIUM — based on entity-resolution-agent.ts knowledge array and osint-entity-extractor.ts prompt; real-world completeness depends on what names actually appear in ingested documents

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable codebase, no external API dependencies for this phase)
