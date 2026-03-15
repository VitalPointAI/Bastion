# Phase 47: JSON-LD Semantic Brain + COP Fix - Research

**Researched:** 2026-03-15
**Domain:** Semantic knowledge graphs — JSON-LD, BFO/CCO ontologies, W3C PROV-O provenance, temporal reasoning, entity resolution, COP pipeline debugging
**Confidence:** HIGH (architecture patterns) / MEDIUM (external ontology namespaces)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**JSON-LD Migration Strategy**
- Full property rewrite — all Neo4j node/edge properties rewritten to use JSON-LD-native keys with @context and @type mappings. Not a wrapper layer; storage itself is ontology-native.
- Full ontology stack — BFO as upper ontology foundation → CCO mid-level (Agent, Event, Artifact, Geospatial) → DODAF/DNDAF for architecture views → JC3IEDM for military entity catalog → APP-6 for NATO symbology SIDC codes. Every entity maps through the full chain.
- Big-bang migration — single migration pass rewrites all nodes + updates all consumers simultaneously. No dual-format code or backward-compat shims. COP is already broken and the graph is being overhauled — natural time for clean cut.
- Bundled context file + hosted URL — ship @context as a local JSON-LD file in the repo (follows existing cco-classes.json pattern) for offline/DDIL operation. Canonical @context reference points to a hosted URL for interop when connectivity allows. No external runtime dependency.

**Provenance & Confidence Model**
- W3C PROV-O aligned provenance — every assertion carries prov:wasGeneratedBy (activity/method), prov:wasAttributedTo (agent/asserter), prov:wasDerivedFrom (source documents/events). Maps naturally to JSON-LD.
- Weighted source fusion for corroboration — each source type has configurable base reliability weight (manual_entry: 0.95, sigint: 0.90, doc_intelligence: 0.75, vision_pipeline: 0.70, osint: 0.65, ai_inference: 0.60). Multi-source corroboration: conf = 1 - ∏(1 - w_i). Weights configurable per workspace.
- Inline conflict markers + contradiction queue — contradictions create :CONTRADICTS edges between assertions, add to review queue in brain viz, lower confidence of both assertions until resolved. Staff sees red pulsing edges/badges and resolves via panel (accept A, accept B, both valid, flag for intel).
- Hybrid entity resolution — extend existing string matcher with: (1) embedding similarity (text-embedding-3-large), (2) ontology-aware matching (same @type + overlapping properties). Three-signal fused score. Auto-merge above 0.85, human review queue 0.5–0.85, distinct below 0.5.

**Temporal Reasoning**
- Per-assertion temporal validity — every property/fact has its own validFrom/validTo independent of the entity. Enables point-in-time queries at property level.
- Configurable staleness decay curves — half-lives: personnel: 180d, capability: 365d, political: 90d, geographic: 1825d, economic: 365d. Decay formula: conf(t) = conf_0 * 2^(-t/half_life). Re-confirmation resets the clock.
- Timeline slider on brain visualization — temporal slider in brain toolbar, scrubbing filters graph to assertions valid at that point in time. Stale/expired facts fade out. Integrates with lenses.
- Animated playback — play button auto-advances through time at configurable speed (1x = 1 month/second). Entities fade in at validFrom, fade out at validTo, confidence badges update with decay, contradictions flash when detected. Reuses COP phase slider playback pattern.

**COP Pipeline Fix**
- Debug + upgrade existing pipeline — preserve Phase 21 architecture (coordinator → sub-agents → layer assembly → store → event bus). Diagnose and fix broken links in the current chain, then upgrade sub-agents to consume JSON-LD graph data.
- Semantic graph queries per sub-agent — each sub-agent queries the JSON-LD graph directly using ontology-aware Cypher scoped by @type. J2 queries adversary entities, J3 queries friendly forces, etc. Each sub-agent gets typed entities with provenance and confidence attached.
- Visual confidence encoding on COP — high (>0.85) = solid symbols full opacity, medium (0.5–0.85) = dashed outlines + amber badge at 70% opacity, low (<0.5) = dotted/ghost at 40% + red badge. Confidence threshold slider in COP layer controls.
- All consumers wired in this phase — all 7+ downstream consumers updated to use JSON-LD graph: COP sub-agents, brain visualization, doc-intelligence (write), OSINT pipeline (write), vision pipeline (write), design tab (read), plan tab (read), assess tab (read).

### Claude's Discretion
- Neo4j Cypher query design for ontology-native property access
- JSON-LD context file structure and namespace organization
- Migration script implementation (batch size, error handling, rollback)
- Exact decay formula constants and default thresholds
- Timeline slider UI component design and animation timing
- Contradiction detection algorithm specifics
- Entity resolution scoring weight tuning
- COP pipeline debugging approach (specific bugs)
- Consumer wiring order within the big-bang migration

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 47 is a deep graph refactoring phase that must: (1) migrate all Neo4j RAFT entities (Actor, Relationship, ActorFunction, Tension, Decision) from flat properties to JSON-LD-native keys with full ontology chain alignment, (2) layer W3C PROV-O provenance onto every assertion, (3) add per-property temporal validity + staleness decay, (4) upgrade entity resolution with embedding similarity, (5) debug and restore the broken COP pipeline end-to-end, and (6) wire all downstream consumers to query the new semantic graph.

The codebase has strong existing foundations: a working CCO schema loader (`cco-schema-loader.ts`) with a bundled JSON file, a working Neo4j client singleton, an entity resolution service with string matching, a timeline component (`BrainTimeline.tsx`) and hook (`useBrainTimeline.ts`), and a complete COP agent architecture (coordinator, 6 sub-agents, event bus, trigger handler). The migration is surgical — it rewrites property storage but preserves all class structures and call signatures.

The COP pipeline bug is most likely in the coordinator-to-sub-agent data flow or the sub-agent entity query path, since `SubAgentInput.graphEntities` is populated from a RAFT graph query that currently returns flat properties. Upgrading that query to JSON-LD typed entities is part of the fix.

**Primary recommendation:** Execute in five sequential waves: (1) ontology context file + migration, (2) provenance + temporal validity on RAFT stores, (3) entity resolution upgrade + contradiction detection, (4) COP pipeline debug + semantic sub-agent queries, (5) consumer wiring (brain viz, design/plan/assess tabs, ingestion pipelines).

---

## Standard Stack

### Core (existing — extend, do not replace)
| Library / Module | Version | Purpose | Status |
|-----------------|---------|---------|--------|
| `neo4j-driver` | (existing) | Neo4j Bolt protocol client — all graph I/O | In use, singleton in `neo4j-client.ts` |
| `backend/src/cop/cco/` | custom | CCO schema loader + bundled JSON classes | In use, extend with BFO/DODAF/JC3IEDM |
| `backend/src/graph/raft/` | custom | RAFT entity stores (Actor, Relationship, Function, Tension, Decision) | In use, all need property rewrite |
| `backend/src/graph/resolution/` | custom | String-based entity resolution service | In use, extend with embedding + ontology matching |
| `frontend/src/components/brain/` | custom | Brain visualization, hooks (useBrainTimeline, useBrainData, etc.) | In use, extend timeline + add confidence overlay |
| `@langchain/openai` | (existing) | OpenAI embeddings via `text-embedding-3-large` for entity resolution | Available via existing LLM factory |
| W3C PROV-O | standard | Provenance ontology — `prov:` namespace | New addition to context file |
| BFO 2020 | ISO 21838-2 | Upper ontology foundation — `BFO_` class URIs | New addition to context file (bundled) |
| CCO | 2.0 (2024) | Mid-level ontology — agent/event/artifact/geospatial | Existing partial, extend to full suite |

### Supporting (new)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsonld` (npm) | ^5.x | JSON-LD document processing (compaction, expansion) for testing | Test utilities only — not in hot path |
| neosemantics (n10s) | optional | Neo4j RDF/JSON-LD import/export plugin | Only if full RDF interop endpoint needed; not required for core work |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bundled JSON-LD context file | External `@context` URL at runtime | External URL breaks DDIL operation — locked decision against this |
| Custom property keys (`jsonldType`, `jsonldContext`) | Full namespace URIs as property keys | Full URIs break Cypher readability; use short aliases in property keys with `@type` as a single property storing the CCO/BFO URI |
| Embedding similarity only for entity resolution | LLM-only verification | Embedding is fast O(1) lookup; LLM for edge cases only — hybrid is correct |
| n10s/neosemantics for RDF storage | Custom JSON-LD properties on Neo4j nodes | n10s requires Neo4j plugin installation; bundled JSON approach has no ops dependency |

**Installation (new packages, if needed):**
```bash
npm install jsonld         # test utilities only
```

---

## Architecture Patterns

### Existing Code Map (critical for planning)

```
backend/src/
├── cop/
│   ├── index.ts                         # COP module init + barrel exports
│   ├── api/cop-routes.ts               # Express COP router
│   ├── agents/
│   │   ├── cop-coordinator.ts          # Orchestrates sub-agents (DIAGNOSE + FIX)
│   │   ├── agent-definitions.ts        # COP agent registry
│   │   └── layer-sub-agents/
│   │       ├── sub-agent-types.ts      # SubAgentInput interface (UPDATE graphEntities)
│   │       ├── intel-overlay.ts        # J2 — queries hostile/unknown entities (UPGRADE)
│   │       ├── force-disposition.ts    # J3 — friendly forces (UPGRADE)
│   │       ├── objectives-overlay.ts   # J5 — objectives (UPGRADE)
│   │       ├── c2-overlay.ts           # C2 — command structure (UPGRADE)
│   │       ├── control-measures.ts     # Control measures (UPGRADE)
│   │       └── logistics-overlay.ts    # Logistics (UPGRADE)
│   ├── cco/
│   │   ├── cco-classes.json            # Bundled CCO classes (EXTEND with BFO/DODAF/JC3IEDM)
│   │   ├── cco-schema-loader.ts        # Startup loader → Map (EXTEND)
│   │   ├── cco-types.ts                # CCOClassMapping, RAFT_TO_CCO_MAP (EXTEND)
│   │   └── cco-validator.ts            # suggestCCOClass() (EXTEND)
│   ├── layers/layer-types.ts           # COPSymbolSpec — add confidence visual fields
│   └── messaging/
│       ├── event-bus.ts                # Typed EventEmitter — add contradiction events
│       └── trigger-handler.ts          # Triple trigger model — preserve as-is
├── graph/
│   ├── neo4j-client.ts                 # Driver singleton — no changes
│   ├── raft/
│   │   ├── types.ts                    # Actor/Relationship/Tension/Decision (REWRITE props)
│   │   ├── actor-store.ts              # CRUD + merge (REWRITE Cypher, add provenance)
│   │   ├── relationship-store.ts       # (REWRITE)
│   │   ├── tension-store.ts            # (REWRITE)
│   │   ├── decision-store.ts           # (REWRITE)
│   │   └── schema-init.ts              # Index definitions (ADD validFrom/validTo indexes)
│   ├── resolution/
│   │   ├── resolution-service.ts       # EntityResolutionService (EXTEND with embeddings)
│   │   ├── string-matcher.ts           # String similarity (PRESERVE)
│   │   └── blocking.ts                 # Candidate blocking (PRESERVE)
│   └── construction/graph-builder.ts  # LLM entity extraction (UPDATE to write JSON-LD)
├── doc-intelligence/specialists/
│   └── fact-extractor.ts              # Writes to graph via graphBuilder (UPDATE)
├── osint/
│   └── osint-graph-sync.ts            # Creates Actor nodes from OSINT (UPDATE)
└── robot/
    └── vision-cop-pipeline.ts         # Creates hostile Actor nodes from vision (UPDATE)

frontend/src/components/brain/
├── types.ts                           # BrainNode — add provenance fields, validFrom/validTo
├── BrainTimeline.tsx                  # Timeline scrubber (UPGRADE for per-assertion validity)
├── hooks/useBrainTimeline.ts          # Timeline hook (UPGRADE)
└── hooks/useBrainData.ts             # Data fetching hook (UPDATE for JSON-LD graph API)
```

### Pattern 1: JSON-LD Context File Structure

The bundled context file follows the existing `cco-classes.json` pattern. One file covers all ontology namespaces.

**File:** `backend/src/cop/cco/bastion-context.jsonld`

```json
{
  "@context": {
    "@version": 1.1,
    "bfo":  "http://purl.obolibrary.org/obo/BFO_",
    "cco":  "http://www.ontologyrepository.com/CommonCoreOntologies/",
    "prov": "http://www.w3.org/ns/prov#",
    "jc3":  "http://www.mip.saic.com/jc3iedm/",
    "dodaf": "https://dodcio.defense.gov/ontology/dodaf/",
    "bastion": "https://bastion.vitalpoint.ai/ontology/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "xsd":  "http://www.w3.org/2001/XMLSchema#",

    "jsonldType":    "@type",
    "jsonldId":      "@id",

    "validFrom":     { "@id": "bastion:validFrom",     "@type": "xsd:dateTime" },
    "validTo":       { "@id": "bastion:validTo",       "@type": "xsd:dateTime" },
    "confidence":    { "@id": "bastion:confidence",    "@type": "xsd:decimal" },
    "assertedBy":    { "@id": "prov:wasAttributedTo" },
    "assertedVia":   { "@id": "prov:wasGeneratedBy" },
    "derivedFrom":   { "@id": "prov:wasDerivedFrom" },
    "sourceWeight":  { "@id": "bastion:sourceWeight",  "@type": "xsd:decimal" },
    "halfLifeDays":  { "@id": "bastion:halfLifeDays",  "@type": "xsd:integer" }
  }
}
```

Source: W3C PROV-O specification (`http://www.w3.org/ns/prov#`) — HIGH confidence.
BFO namespace `http://purl.obolibrary.org/obo/BFO_` — HIGH confidence (ISO 21838-2).
CCO namespace from `https://github.com/CommonCoreOntology/CommonCoreOntologies` — MEDIUM confidence (confirm exact IRI in CCO 2.0 release).

### Pattern 2: JSON-LD-Native Neo4j Node Properties

Neo4j stores properties on nodes. The "JSON-LD native" approach stores `jsonldType` (the CCO/BFO URI) and `jsonldContext` as Neo4j node properties alongside domain properties. No external plugin required.

```typescript
// Source: inferred from existing actor-store.ts pattern + W3C JSON-LD spec

// Neo4j node properties after JSON-LD migration (Actor example)
const actorProperties = {
  id: 'ACT-uuid',
  jsonldType: 'cco:MilitaryOrganization',   // CCO class URI
  jsonldContext: 'https://bastion.vitalpoint.ai/ontology/context.jsonld',

  name: 'PLA 82nd Group Army',
  aliases: ['82nd GA', 'PLAN 82'],
  workspaceId: 'ws-123',
  containerIds: ['con-456'],

  // Provenance (PROV-O aligned)
  assertedBy: 'user:did:near:alice.near',
  assertedVia: 'manual_entry',
  derivedFrom: JSON.stringify(['doc-789']),
  confidence: 0.95,
  sourceWeight: 0.95,   // manual_entry base weight

  // Temporal validity
  validFrom: '2026-01-01T00:00:00Z',
  validTo: null,         // null = currently valid
  halfLifeDays: 180,     // personnel half-life

  createdAt: '2026-03-15T00:00:00Z',
  updatedAt: '2026-03-15T00:00:00Z',
};
```

### Pattern 3: Temporal Point-in-Time Cypher Query

Neo4j natively supports `datetime()` comparisons in Cypher. The `validFrom`/`validTo` pattern is straightforward.

```cypher
// Query actors valid at a specific point in time
MATCH (a:Actor {workspaceId: $workspaceId})
WHERE a.validFrom <= datetime($atTime)
  AND (a.validTo IS NULL OR a.validTo > datetime($atTime))
RETURN a

// Query with staleness-adjusted confidence
MATCH (a:Actor {workspaceId: $workspaceId})
WHERE a.validFrom <= datetime($atTime)
  AND (a.validTo IS NULL OR a.validTo > datetime($atTime))
WITH a,
  duration.between(datetime(a.updatedAt), datetime($atTime)).days AS agedays,
  a.confidence AS baseConf,
  a.halfLifeDays AS halfLife
RETURN a,
  baseConf * (0.5 ^ (toFloat(agedays) / halfLife)) AS decayedConf
ORDER BY decayedConf DESC
```

Source: Neo4j Cypher Manual temporal functions (official docs) — HIGH confidence.

### Pattern 4: W3C PROV-O Provenance Inline on Node

Every node/edge gets three PROV-O properties stored inline. Not a separate provenance subgraph — inline for query efficiency.

```typescript
// On every RAFT store write:
interface ProvenanceProps {
  assertedBy: string;     // prov:wasAttributedTo — DID of the agent/user
  assertedVia: string;    // prov:wasGeneratedBy — method: 'manual_entry' | 'doc_intelligence' | 'osint' | 'vision_pipeline' | 'ai_inference' | 'sigint'
  derivedFrom: string;    // prov:wasDerivedFrom — JSON.stringify(string[]) — source doc/event IDs
  confidence: number;     // 0-1, initial confidence from source weight
  sourceWeight: number;   // base reliability of assertedVia method
}
```

### Pattern 5: Multi-Source Confidence Corroboration

When the same assertion arrives from multiple sources, fuse confidence using the locked formula. Implemented in a shared `confidence-calculator.ts` utility.

```typescript
// conf = 1 - ∏(1 - w_i)
// Source weights (configurable per workspace — defaults):
const SOURCE_WEIGHTS: Record<string, number> = {
  manual_entry:      0.95,
  sigint:            0.90,
  doc_intelligence:  0.75,
  vision_pipeline:   0.70,
  osint:             0.65,
  ai_inference:      0.60,
};

function fuseConfidence(weights: number[]): number {
  const complement = weights.reduce((acc, w) => acc * (1 - w), 1);
  return 1 - complement;
}

// Example: manual_entry (0.95) + OSINT (0.65)
// conf = 1 - (1-0.95)(1-0.65) = 1 - 0.05 * 0.35 = 1 - 0.0175 = 0.9825
```

### Pattern 6: Contradiction Detection

When a new assertion conflicts with an existing one (same entity + same property + incompatible values), create a `:CONTRADICTS` relationship in Neo4j and emit to review queue.

```typescript
// New :CONTRADICTS relationship type
// assertionA :CONTRADICTS assertionB
// - lowers confidence on both by 20% (configurable)
// - emits 'contradiction:detected' on event bus
// - adds to review queue in brain viz (red pulsing edge)

interface ContradictionRecord {
  id: string;
  entityId: string;
  propertyKey: string;
  assertionAId: string;
  assertionBId: string;
  detectedAt: string;
  resolvedAt?: string;
  resolution?: 'accept_a' | 'accept_b' | 'both_valid' | 'flagged_for_intel';
}
```

### Pattern 7: Hybrid Entity Resolution (Three-Signal Fusion)

Extend `EntityResolutionService` with two new signals. Keep existing string matcher as signal 1.

```typescript
// Signal 1: string similarity (existing — string-matcher.ts, weight: 0.4)
// Signal 2: embedding cosine similarity (new — text-embedding-3-large, weight: 0.4)
// Signal 3: ontology-type match (new — same jsonldType, weight: 0.2)

// Fused score = 0.4 * stringSim + 0.4 * embeddingSim + 0.2 * typeSim

// Thresholds (locked decisions):
// >= 0.85: auto-merge
// 0.5 - 0.85: human review queue
// < 0.5: distinct entities

// Embedding similarity via existing LLM factory:
// createLLMForAgent({ agentId: 'entity-resolver' }) already available
// Use OpenAI embeddings endpoint directly: text-embedding-3-large
```

### Pattern 8: Semantic Sub-Agent Query (COP Fix)

Replace flat `graphEntities` array passed to `SubAgentInput` with ontology-typed entities queried directly from the semantic graph.

```typescript
// Before: flat Actor objects from actorStore.listActors()
// After: ontology-typed entities filtered by @type

// J2 Intel sub-agent query (hostile/unknown entities):
// MATCH (a:Actor {workspaceId: $workspaceId})
// WHERE a.jsonldType IN ['cco:MilitaryOrganization', 'jc3:Unit', 'jc3:Facility']
//   AND a.attributes_affiliation IN ['hostile', 'suspect', 'unknown']
//   AND (a.validTo IS NULL OR a.validTo > datetime())
// RETURN a, a.confidence, a.assertedVia
// ORDER BY a.confidence DESC

// SubAgentInput.graphEntities now typed:
interface SemanticEntity {
  id: string;
  name: string;
  jsonldType: string;           // CCO/BFO URI
  confidence: number;           // current decayed confidence
  provenance: ProvenanceProps;
  temporalValid: boolean;
  properties: Record<string, unknown>;
}
```

### Pattern 9: COP Confidence Visual Encoding

Add confidence visual properties to `COPSymbolSpec` and render them in the COP layer.

```typescript
// Additions to COPSymbolSpec:
interface COPSymbolSpec {
  // ... existing fields ...
  confidence: number;           // already present — now actively used
  confidenceTier: 'high' | 'medium' | 'low';  // computed from confidence
  // high  > 0.85: solid symbol, full opacity
  // medium 0.5–0.85: dashed outline, amber badge, 70% opacity
  // low   < 0.5: dotted/ghost, red badge, 40% opacity
}
```

### Anti-Patterns to Avoid

- **Storing full JSON-LD @context on every node:** Store just `jsonldType` (URI string) and `jsonldContext` (URL string) — not the full expanded context object. The full context is bundled separately.
- **Using RDF subject URIs as Neo4j node IDs:** Keep internal IDs (`ACT-uuid`) as Neo4j node IDs. Map to RDF subject URIs only when exporting for interop.
- **Dual-format code (old + new properties):** The locked decision is big-bang. No fallback properties. All Cypher queries update in lockstep with the migration.
- **LLM for every entity resolution candidate:** Embeddings filter candidates; LLM only for the 0.5–0.85 review band to avoid rate limits and latency.
- **Per-session Neo4j connections:** The existing `executeWriteQuery` / `executeReadQuery` helpers already handle session lifecycle correctly. All new queries use these helpers, never raw session management.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-LD compaction/expansion | Custom JSON-LD processor | `jsonld` npm package (test/export only) | 50+ edge cases in scoped contexts, aliasing, coercion rules |
| RDF triple storage in Neo4j | Custom RDF property serializer | Inline `jsonldType` + `jsonldContext` properties (no plugin) | n10s/neosemantics requires a Neo4j plugin install — ops overhead |
| Embedding generation | Custom OpenAI HTTP client | Existing `createLLMForAgent` + `embeddings.create()` | LLM factory already handles retry, rate-limit, model config |
| SIDC code generation | Custom symbology encoder | Existing `buildSIDCFromEntity()` in `cop/svg/sidc-builder.ts` | APP-6D 20-digit code has complex encoding rules already solved |
| Confidence decay timers | Cron jobs recalculating stored confidence | On-read calculation using stored `confidence`, `halfLifeDays`, `updatedAt` | No storage update needed; decayed value is `conf_0 * 2^(-days/halfLife)` computed at query time |
| Event bus scaling | Custom message broker | Existing in-process `COPEventBus` (Node.js EventEmitter) | Sufficient for current architecture; CONTEXT says preserve Phase 21 design |

**Key insight:** The biggest time sinks in this domain are ontology namespace management, JSON-LD context scoping, and RDF serialization edge cases. All three are solved by committing to the bundled-context + inline-property approach — keep JSON-LD as a semantic labeling system, not a runtime RDF processor.

---

## Common Pitfalls

### Pitfall 1: Cypher Property Key Collisions with Reserved Words
**What goes wrong:** `@type`, `@id`, `@context` are valid JSON-LD keywords but invalid as bare Neo4j property keys. Queries using `n.@type` throw syntax errors.
**Why it happens:** JSON-LD uses `@` prefix for keywords; Neo4j property keys cannot start with `@`.
**How to avoid:** Store as `jsonldType`, `jsonldId`, `jsonldContext` — the `@context` file maps these aliases to the real JSON-LD terms. All existing Cypher queries remain valid.
**Warning signs:** `SyntaxException` on any query touching `@`-prefixed properties.

### Pitfall 2: Big-Bang Migration Partial Failure
**What goes wrong:** Migration script fails mid-run; half the nodes are in new format, half in old.
**Why it happens:** Neo4j transaction size limits or network timeout on large batch.
**How to avoid:** Batch in transactions of 500 nodes. Wrap each batch in `CALL apoc.periodic.iterate` or manual session.beginTransaction(). Before migration, export all nodes as backup. Add a `migrationVersion` property after each batch to track progress.
**Warning signs:** Mix of nodes with/without `jsonldType` after migration.

### Pitfall 3: `validTo: null` vs `validTo: undefined` in Cypher
**What goes wrong:** `WHERE a.validTo > datetime()` excludes nodes where `validTo` is null (currently valid), silently dropping most of the graph.
**Why it happens:** Null comparison in Cypher follows three-valued logic — null comparisons return null (not true/false).
**How to avoid:** Always write: `WHERE (a.validTo IS NULL OR a.validTo > datetime($atTime))`.
**Warning signs:** COP layers or brain visualization rendering zero or near-zero entities.

### Pitfall 4: Embedding API Latency Blocking Entity Resolution
**What goes wrong:** Entity resolution during document ingestion becomes synchronous and blocks the request for 10+ seconds when computing embeddings for all candidate pairs.
**Why it happens:** `text-embedding-3-large` calls are ~200-500ms each; large documents create dozens of candidate pairs.
**How to avoid:** Run embedding-based resolution asynchronously after initial graph write. Cache embeddings on the Actor node (`embeddingVector` property as JSON string). Only recompute on name change.
**Warning signs:** Doc-intelligence ingestion timeouts, request queue buildup.

### Pitfall 5: COP Coordinator Not Consuming New Graph API
**What goes wrong:** After JSON-LD migration, sub-agents still receive old flat `Actor` objects because the coordinator's data-fetch call was not updated.
**Why it happens:** `cop-coordinator.ts` fetches graph entities (currently via `actorStore.listActors()`) and passes them into `SubAgentInput.graphEntities`. If only the store is rewritten but not the coordinator's fetch call, sub-agents get `undefined` for all new properties.
**How to avoid:** The coordinator fetch is a priority fix item. Introduce a new `semanticEntityQuery.ts` module that coordinator uses — all sub-agents receive `SemanticEntity[]` with `jsonldType` and `confidence`.
**Warning signs:** COP layers generating empty symbols list after migration.

### Pitfall 6: JSON-LD @context URL Unavailable in DDIL
**What goes wrong:** Code that loads `@context` from the canonical hosted URL at runtime fails in disconnected environments, breaking all graph operations.
**Why it happens:** Canonical hosted URL referenced in `jsonldContext` property of nodes is unreachable offline.
**How to avoid:** The bundled file (`bastion-context.jsonld`) is loaded at startup into memory (same pattern as `cco-schema-loader.ts`). All code uses the local bundle. The canonical URL is only in node metadata for interop signaling — never fetched at runtime.
**Warning signs:** Import/export operations failing in test environments without internet access.

### Pitfall 7: Contradiction Detection False Positives on Temporal Range Transitions
**What goes wrong:** Two facts about the same property at different time periods (e.g., different commanders at different dates) are flagged as contradictions.
**Why it happens:** Contradiction detection compares property values without checking whether `validFrom`/`validTo` ranges overlap.
**How to avoid:** Contradiction check MUST include temporal overlap test: two assertions contradict only if their `validFrom`/`validTo` ranges overlap AND their values conflict. Non-overlapping temporal ranges for the same property are normal (historical succession).
**Warning signs:** Review queue flooded with false contradiction flags on historical data.

---

## Code Examples

### Migration Script Pattern

```typescript
// Source: derived from existing actor-store.ts Cypher patterns + Neo4j batch docs

async function migrateActorBatch(offset: number, batchSize: number): Promise<number> {
  const session = getNeo4jDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.run(`
      MATCH (a:Actor)
      WHERE a.migrationVersion IS NULL
      WITH a SKIP $offset LIMIT $batchSize
      SET a.jsonldType = CASE a.type
            WHEN 'nation'          THEN 'cco:GovernmentOrganization'
            WHEN 'organization'    THEN 'cco:Organization'
            WHEN 'individual'      THEN 'cco:Person'
            WHEN 'non_state_actor' THEN 'cco:Organization'
            ELSE 'cco:Agent'
          END,
          a.jsonldContext = 'https://bastion.vitalpoint.ai/ontology/context.jsonld',
          a.assertedBy     = coalesce(a.assertedBy, 'system:migration'),
          a.assertedVia    = coalesce(a.assertedVia, 'manual_entry'),
          a.derivedFrom    = coalesce(a.derivedFrom, '[]'),
          a.confidence     = coalesce(a.confidence, 0.75),
          a.sourceWeight   = 0.75,
          a.validFrom      = coalesce(a.validFrom, a.createdAt),
          a.validTo        = null,
          a.halfLifeDays   = 180,
          a.migrationVersion = 47
      RETURN count(a) as migrated
    `, { offset: neo4j.int(offset), batchSize: neo4j.int(batchSize) });
    return result.records[0]?.get('migrated').toNumber() ?? 0;
  } finally {
    await session.close();
  }
}
```

### Temporal Point-in-Time Brain Snapshot

```typescript
// Source: derived from useBrainTimeline.ts pattern — the /api/brain/graph-snapshot
// endpoint already exists; it needs to use temporal Cypher after migration

// backend endpoint query (update existing graph-snapshot handler):
async function getGraphSnapshot(problemSetId: string, atTime: Date): Promise<BrainGraphData> {
  const result = await executeReadQuery(`
    MATCH (a:Actor {workspaceId: $problemSetId})
    WHERE a.validFrom <= datetime($atTime)
      AND (a.validTo IS NULL OR a.validTo > datetime($atTime))
    WITH a,
      duration.between(datetime(a.updatedAt), datetime($atTime)).days AS ageDays,
      a.confidence AS baseConf,
      a.halfLifeDays AS halfLife
    RETURN a,
      baseConf * (0.5 ^ (toFloat(ageDays) / halfLife)) AS currentConfidence
    ORDER BY currentConfidence DESC
  `, { problemSetId, atTime: atTime.toISOString() });
  // ... map to BrainGraphData
}
```

### Confidence Decay Calculation

```typescript
// Source: locked decision formula conf(t) = conf_0 * 2^(-t/half_life)
// Pure function — no storage, computed on read

function computeDecayedConfidence(
  baseConfidence: number,
  lastAssertedAt: Date,
  halfLifeDays: number,
  atTime: Date = new Date()
): number {
  const ageMs = atTime.getTime() - lastAssertedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return baseConfidence * Math.pow(0.5, ageDays / halfLifeDays);
}

// Half-life defaults (configurable per workspace):
const HALF_LIFE_DEFAULTS: Record<string, number> = {
  personnel:   180,
  capability:  365,
  political:    90,
  geographic: 1825,
  economic:    365,
};
```

### Semantic Sub-Agent Query (Replacing Flat actorStore)

```typescript
// Source: derived from intel-overlay.ts pattern + JSON-LD migration pattern

// New shared semantic entity fetcher for all sub-agents:
async function fetchSemanticEntities(
  workspaceId: string,
  typeFilters: string[],  // CCO/BFO URIs
  affiliationFilters?: string[],
): Promise<SemanticEntity[]> {
  const result = await executeReadQuery(`
    MATCH (a:Actor {workspaceId: $workspaceId})
    WHERE a.jsonldType IN $typeFilters
      AND (a.validTo IS NULL OR a.validTo > datetime())
      ${affiliationFilters ? "AND a.attributes_affiliation IN $affiliations" : ""}
    WITH a,
      duration.between(datetime(a.updatedAt), datetime()).days AS ageDays
    RETURN a,
      a.confidence * (0.5 ^ (toFloat(ageDays) / a.halfLifeDays)) AS currentConf
    ORDER BY currentConf DESC
  `, { workspaceId, typeFilters, affiliations: affiliationFilters ?? [] });

  return result.records.map(r => ({
    id: r.get('a').properties.id,
    name: r.get('a').properties.name,
    jsonldType: r.get('a').properties.jsonldType,
    confidence: r.get('currentConf'),
    provenance: {
      assertedBy: r.get('a').properties.assertedBy,
      assertedVia: r.get('a').properties.assertedVia,
      derivedFrom: JSON.parse(r.get('a').properties.derivedFrom || '[]'),
      confidence: r.get('a').properties.confidence,
      sourceWeight: r.get('a').properties.sourceWeight,
    },
    temporalValid: true,
    properties: r.get('a').properties,
  }));
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes | Impact |
|--------------|------------------|-------|--------|
| Flat Actor properties (`type: 'nation'`) | `jsonldType: 'cco:GovernmentOrganization'` with full provenance | Big-bang migration in this phase | Machine-readable entity typing for all consumers |
| String-only entity resolution | Three-signal fusion (string + embedding + type) | `text-embedding-3-large` cosine sim added | Significantly reduces false-negative merges across ingestion paths |
| COP sub-agents querying flat RAFT stores | Sub-agents query semantic graph with `jsonldType` filters | Fixes existing broken pipeline | Typed entities with provenance flow through to COP symbols |
| `createdAt` as sole temporal anchor | Per-assertion `validFrom`/`validTo` + decay half-life | Property-level temporal validity | Point-in-time graph queries, historical briefings |
| Confidence as fixed scalar | Confidence decays exponentially over time by fact type | Computed on read, not stored | Commanders see reliability-adjusted intelligence |
| No contradiction tracking | `:CONTRADICTS` edges + review queue + confidence penalty | Contradiction detection on write | Surfaced conflicting intelligence before it influences decisions |

**Deprecated/outdated in this codebase:**
- `Actor.attributes` as a JSON blob: After migration, key attributes are promoted to top-level node properties (`attributes_affiliation`, `attributes_echelon`, etc.) for Cypher queryability. The generic blob approach prevents ontology-native filtering.
- `entityResolutionService.autoMergeThreshold = 0.95`: Replaced with 0.85 per locked decision (was string-only; higher bar needed because embedding similarity adds precision).

---

## Open Questions

1. **CCO 2.0 exact namespace IRI**
   - What we know: CCO 2.0 changed to opaque local identifiers (`http://www.ontologyrepository.com/CommonCoreOntologies/`). GitHub repo is `CommonCoreOntology/CommonCoreOntologies`.
   - What's unclear: Whether the exact namespace base URL changed in the 2024 CCO release vs earlier versions.
   - Recommendation: During Wave 0, verify namespace by reading the CCO 2.0 OWL header directly from `https://raw.githubusercontent.com/CommonCoreOntology/CommonCoreOntologies/master/cco-merged/MergedAllCoreOntology.ttl`. Pin the exact IRI in the bundled context file.

2. **COP coordinator root bug location**
   - What we know: COP pipeline is currently broken. `cop-coordinator.ts` and all 6 sub-agents exist. Event bus and trigger handler are intact. Sub-agents call `actorStore.listActors()` indirectly via `SubAgentInput.graphEntities`.
   - What's unclear: The exact break point — likely the coordinator's entity fetch query, but could also be in layer store write, event bus listener, or API route handler.
   - Recommendation: Phase 47's first plan should be a dedicated COP pipeline diagnosis task that traces `layer:generation:start` event → coordinator → sub-agents → `layerStore.upsertLayer()` → API response, adding structured logging at each step.

3. **Attributes blob vs top-level properties for `affiliation`, `echelon`, etc.**
   - What we know: Current `Actor.attributes` is a JSON blob (`JSON.stringify(attributes)`). Sub-agents extract `e.properties.affiliation` which means the blob was parsed back into an object when building `SubAgentInput.graphEntities`. After migration, these need to be queryable in Cypher.
   - What's unclear: Whether to promote all attributes to top-level with `attributes_` prefix, or to use a separate `:HAS_ATTRIBUTE` relationship pattern.
   - Recommendation: Promote high-value queryable attributes (`attributes_affiliation`, `attributes_echelon`, `attributes_unitType`, `attributes_lat`, `attributes_lng`) to top-level properties. Keep raw blob as `attributesJson` for backward compat reads during migration. Remove blob after all queries updated.

4. **BrainNode type additions for provenance display**
   - What we know: `BrainNode.sourceDocumentIds` and `BrainNode.validityScore` already exist in `types.ts`. `BrainEdge.isConflict` exists.
   - What's unclear: Exact new fields needed on `BrainNode` for `validFrom`, `validTo`, `assertedVia`, `assertedBy` for the timeline slider and contradiction display.
   - Recommendation: Add `validFrom?: string`, `validTo?: string`, `assertedVia?: string`, `isContradicted?: boolean` to `BrainNode`. The timeline hook already handles `createdAt`-based filtering and can be extended to use `validFrom`/`validTo`.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (TypeScript, existing backend test suite) |
| Config file | `backend/jest.config.ts` or `package.json` jest config |
| Quick run command | `npm test -- --testPathPattern="cop|raft|resolution" --no-coverage` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| JSON-LD context file loads without error | unit | `npm test -- --testPathPattern="cco-schema-loader"` | ❌ Wave 0 — extend existing test |
| Actor migration sets `jsonldType`, `validFrom`, `confidence` | unit (mock Neo4j) | `npm test -- --testPathPattern="actor-store"` | ❌ Wave 0 |
| Temporal query returns only valid-at-time entities | unit (mock Neo4j) | `npm test -- --testPathPattern="temporal"` | ❌ Wave 0 |
| Confidence decay formula produces correct values | unit | `npm test -- --testPathPattern="confidence"` | ❌ Wave 0 |
| Multi-source confidence fusion: 0.95 + 0.65 = 0.9825 | unit | included in confidence test | ❌ Wave 0 |
| Contradiction detection creates :CONTRADICTS edge | unit (mock Neo4j) | `npm test -- --testPathPattern="contradiction"` | ❌ Wave 0 |
| Entity resolution hybrid score ≥ 0.85 auto-merges | unit | `npm test -- --testPathPattern="resolution-service"` | ❌ Wave 0 — extend existing |
| COP layer generation produces non-empty symbols list | integration | `npm test -- --testPathPattern="cop-coordinator"` | existing (`cop-coordinator.test.ts`) — update |
| Sub-agent semantic query filters by jsonldType | unit | `npm test -- --testPathPattern="sub-agents"` | existing (`sub-agents.test.ts`) — update |
| Brain timeline `useBrainTimeline` snapshot fetch | unit (mock fetch) | `npm test -- --testPathPattern="useBrainTimeline"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="cop|raft|resolution" --no-coverage`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/cop/cco/cco-schema-loader.test.ts` extended — covers JSON-LD context loading (file exists, test scope narrow)
- [ ] `backend/src/graph/raft/actor-store.test.ts` — covers JSON-LD property migration + temporal queries
- [ ] `backend/src/graph/confidence-calculator.test.ts` — covers decay formula + fusion formula
- [ ] `backend/src/graph/contradiction-detector.test.ts` — covers :CONTRADICTS creation + temporal overlap check
- [ ] `backend/src/graph/resolution/resolution-service.test.ts` extended — covers hybrid three-signal scoring
- [ ] `frontend/src/components/brain/hooks/useBrainTimeline.test.ts` — covers `validFrom`/`validTo` filter logic

---

## Sources

### Primary (HIGH confidence)
- W3C PROV-O specification — `https://www.w3.org/TR/prov-o/` — core classes, properties, namespace
- PROV-JSONLD 2024 W3C submission — `https://www.w3.org/submissions/2024/SUBM-prov-jsonld-20240825/` — JSON-LD serialization patterns, `@context` URL
- Neo4j Cypher Manual — temporal functions — `https://neo4j.com/docs/cypher-manual/current/values-and-types/temporal/` — validFrom/validTo query patterns
- BFO 2020 GitHub — `https://github.com/BFO-ontology/BFO-2020` — ISO 21838-2 namespace `http://purl.obolibrary.org/obo/BFO_`
- CommonCoreOntologies GitHub — `https://github.com/CommonCoreOntology/CommonCoreOntologies` — CCO 2.0 class structure
- Codebase: `backend/src/cop/`, `backend/src/graph/`, `frontend/src/components/brain/` — direct inspection

### Secondary (MEDIUM confidence)
- Nature Scientific Data 2025 — PROV-O to BFO mapping methodology — `https://www.nature.com/articles/s41597-025-04580-1`
- Neosemantics (n10s) Neo4j Labs — `https://neo4j.com/labs/neosemantics/` — RDF/JSON-LD storage in Neo4j; confirmed plugin approach not needed for our pattern
- ACL 2024 — Confidence modeling for temporal KG — `https://aclanthology.org/2024.acl-long.580/` — temporal confidence decay research

### Tertiary (LOW confidence — not relied upon)
- Esri JMSML XML (archived 2024) — APP-6(D) structure reference — `https://github.com/Esri/joint-military-symbology-xml` — existing `buildSIDCFromEntity()` in codebase already handles this
- DoDAF formal ontology page — `https://dodcio.defense.gov/Library/DoD-Architecture-Framework/dodaf20_ontology1/` — DM2 meta-model structure; used for DODAF namespace reference only

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing in codebase; additions are minimal
- Architecture patterns: HIGH — derived from direct codebase inspection + W3C specs
- Ontology namespaces: MEDIUM — CCO 2.0 exact IRI needs verification from live repo header
- COP bug location: LOW — requires runtime diagnosis; likely in coordinator entity fetch
- Pitfalls: HIGH — derived from direct code inspection of specific patterns

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (stable standards; CCO 2.0 namespace confirm within 7 days)
