---
phase: 47-json-ld-semantic-brain-cop-fix
verified: 2026-03-16T12:00:00Z
status: passed
score: 11/11 plans verified
re_verification: false
human_verification:
  - test: "COP pipeline end-to-end — verify non-empty layer symbols"
    expected: "Triggering COP generation for a workspace with graph entities produces symbols from intel-overlay, force-disposition, and other sub-agents with non-empty arrays"
    why_human: "Requires a live Neo4j connection with migrated graph data; cannot verify symbol array contents via static analysis"
  - test: "Brain timeline animated playback"
    expected: "Clicking play button on BrainTimeline advances time, nodes appear and fade per validFrom/validTo, confidence badges update"
    why_human: "Real-time animation behavior requires browser execution"
  - test: "COP confidence visual encoding renders correctly"
    expected: "Symbols with confidence < 0.5 display dotted/ghost outlines, 0.5-0.85 display dashed with amber badge, > 0.85 display solid at full opacity"
    why_human: "Visual rendering requires browser/DOM verification"
  - test: "Entity contradiction detection in live graph"
    expected: "Writing two conflicting assertions about the same entity+property with overlapping temporal ranges creates a :CONTRADICTS edge and lowers both confidences by 20%"
    why_human: "Requires live Neo4j instance; cannot verify Neo4j writes via static analysis"
---

# Phase 47: JSON-LD Semantic Brain / COP Fix — Verification Report

**Phase Goal:** Refactor the knowledge graph to use JSON-LD with formal ontology alignment (BFO, CCO, DODAF/DNDAF), provenance tracking, temporal reasoning, entity resolution, and confidence scoring. Wire the upgraded graph into all downstream consumers and fix COP layer generation end-to-end.
**Verified:** 2026-03-16
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | JSON-LD context file loads at startup with all ontology namespaces (BFO, CCO, PROV-O, JC3IEDM, DODAF, bastion) | VERIFIED | `backend/src/cop/cco/bastion-context.jsonld` contains all 6 namespaces + property aliases; `cco-schema-loader.ts` has `loadBastionContext()` reading the file |
| 2  | Provenance types (assertedBy, assertedVia, derivedFrom, confidence, sourceWeight) are defined and exported | VERIFIED | `backend/src/graph/provenance-types.ts` exports `ProvenanceProps`, `SemanticEntity`, `ContradictionRecord`, `SourceMethod`, `ConfidenceTier`, `getConfidenceTier` |
| 3  | Confidence decay formula computes correctly: conf(t) = conf_0 * 2^(-t/half_life) | VERIFIED | `backend/src/graph/confidence-calculator.ts` line 75: `return baseConfidence * Math.pow(0.5, ageDays / halfLifeDays)` — exact formula |
| 4  | Multi-source fusion formula computes correctly: conf = 1 - prod(1 - w_i) | VERIFIED | `confidence-calculator.ts` line 98: `const complement = weights.reduce((acc, w) => acc * (1 - w), 1); return 1 - complement` |
| 5  | RAFT entity types include JSON-LD, provenance, and temporal fields | VERIFIED | `backend/src/graph/raft/types.ts` — `Actor`, `Relationship`, `Tension`, `Decision` all extend `JsonLdEntityBase extends ProvenanceProps, TemporalProps`; `ACTOR_TYPE_TO_CCO_MAP` exported |
| 6  | All RAFT store CRUD operations write jsonldType, jsonldContext, provenance, and temporal fields | VERIFIED | actor-store.ts, relationship-store.ts, tension-store.ts, decision-store.ts all write `jsonldType`, `jsonldContext`, `assertedVia`, `assertedBy`, `validFrom`, `confidence`, `sourceWeight`, `halfLifeDays` in Cypher SET clauses |
| 7  | Contradictions are detected for overlapping temporal ranges only; :CONTRADICTS edges created in Neo4j | VERIFIED | `backend/src/graph/contradiction-detector.ts` (280 lines): `temporalRangesOverlap` function, `MERGE (a)-[r:CONTRADICTS {id: $contradictionId}]->(b)`, 20% confidence penalty |
| 8  | Entity resolution uses three-signal fusion: 0.4*string + 0.4*embedding + 0.2*type | VERIFIED | `resolution-service.ts` `computeHybridScore`: `return 0.4 * stringSim + 0.4 * embeddingSim + 0.2 * typeSim`; `embedding-matcher.ts` and `ontology-matcher.ts` wired via re-exports |
| 9  | COP coordinator fetches entities via semantic query module; sub-agents receive SemanticEntity[] | VERIFIED | `cop/index.ts` uses `fetchAllSemanticEntities`; `cop-handlers.ts` uses `fetchAllSemanticEntities`; coordinator state typed as `SemanticEntity[]`; all 6 sub-agents filter by `jsonldType` and include `confidenceTier` in symbol output |
| 10 | Brain visualization displays JSON-LD provenance; timeline slider with temporal filtering | VERIFIED | `frontend/src/components/brain/types.ts` — BrainNode has `validFrom`, `validTo`, `assertedVia`, `assertedBy`, `isContradicted`, `confidenceTier`, `jsonldType`, `halfLifeDays`; `useBrainTimeline.ts` exports `filterByTemporalValidity`; `BrainTimeline.tsx` has play/pause/speed controls |
| 11 | All downstream consumers (graph API, RAFT tools, aggregation, COP map, assess tab, plan tab, design tab) wired to JSON-LD graph | VERIFIED | `backend/src/api/graph.ts` returns `jsonldType`, `confidence`, `confidenceTier`; `raft-tools.ts` passes JSON-LD fields to LangGraph agents; `aggregation-service.ts` groups by `jsonldType`; `COPMapView.tsx` applies confidence visual encoding; `COPLayerControls.tsx` has confidence threshold slider; `EntityResolutionPanel.tsx` shows confidence badges; `OperationalAssess.tsx` shows Graph Confidence Summary; `DesignAIPanel.tsx` shows confidence context |

**Score: 11/11 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/cop/cco/bastion-context.jsonld` | Bundled JSON-LD context with all ontology namespaces | VERIFIED | All 6 namespaces (bfo, cco, prov, jc3, dodaf, bastion) + property aliases (jsonldType, validFrom, confidence, assertedBy, assertedVia, derivedFrom, sourceWeight, halfLifeDays) |
| `backend/src/graph/confidence-calculator.ts` | Decay and fusion confidence utilities | VERIFIED | Exports `computeDecayedConfidence`, `fuseConfidence`, `SOURCE_WEIGHTS`, `HALF_LIFE_DEFAULTS`; 101 lines, substantive implementation |
| `backend/src/graph/provenance-types.ts` | Shared provenance + temporal + semantic entity types | VERIFIED | Exports `ProvenanceProps`, `TemporalProps`, `SemanticEntity`, `ContradictionRecord`, `SourceMethod`, `ConfidenceTier`, `getConfidenceTier` |
| `backend/src/graph/raft/types.ts` | Rewritten RAFT types with JSON-LD native fields | VERIFIED | `JsonLdEntityBase` extends `ProvenanceProps & TemporalProps`; all entity interfaces extend it; `ACTOR_TYPE_TO_CCO_MAP` exported |
| `backend/src/cop/cco/cco-schema-loader.ts` | Extended with `loadBastionContext()` / `getBastionContext()` | VERIFIED | Module-level cache, reads `bastion-context.jsonld` from same dir, exports both functions |
| `backend/src/graph/raft/actor-store.ts` | JSON-LD native actor CRUD | VERIFIED | `jsonldType` from `ACTOR_TYPE_TO_CCO_MAP`, provenance fields on every create/update, soft delete via `validTo`, temporal filter on list |
| `backend/src/graph/raft/relationship-store.ts` | JSON-LD native relationship CRUD | VERIFIED | `jsonldType = 'cco:ActOfRelating'`, provenance + temporal fields on all operations |
| `backend/src/graph/raft/tension-store.ts` | JSON-LD native tension CRUD | VERIFIED | `jsonldType = 'cco:InformationBearingEntity'`, provenance + temporal fields |
| `backend/src/graph/raft/decision-store.ts` | JSON-LD native decision CRUD | VERIFIED | `jsonldType = 'cco:ActOfDecisionMaking'`, provenance + temporal fields |
| `backend/src/graph/raft/schema-init.ts` | Neo4j indexes for temporal + semantic fields | VERIFIED | Indexes for `validFrom`, `validTo`, `jsonldType` on all entity labels; `contradiction_idx` for `:CONTRADICTS` edges |
| `backend/src/graph/migration/migrate-to-jsonld.ts` | Batch migration functions | VERIFIED | Exports `migrateActors`, `migrateRelationships`, `migrateTensions`, `migrateDecisions`; idempotent via `migrationVersion IS NULL`; batches of 500 |
| `backend/src/graph/migration/migration-runner.ts` | CLI migration orchestrator | VERIFIED | 262 lines; `--dry-run` and `--verify` flags; runs all 4 migrations in sequence |
| `backend/src/graph/contradiction-detector.ts` | Contradiction detection with temporal overlap | VERIFIED | 280 lines; exports `detectContradiction`, `resolveContradiction`; temporal overlap check prevents false positives; 4 resolution types |
| `backend/src/graph/resolution/embedding-matcher.ts` | Embedding cosine similarity | VERIFIED | `computeEmbeddingSimilarity`, `getOrComputeEmbedding`; caches embedding vectors on Neo4j nodes |
| `backend/src/graph/resolution/ontology-matcher.ts` | Ontology type matching | VERIFIED | `computeOntologyTypeSimilarity` and `computeOntologyTypeScore` alias; same type → 1.0, different → 0.0 |
| `backend/src/graph/resolution/resolution-service.ts` | Extended hybrid resolution | VERIFIED | `computeHybridScore`, `classifyHybridScore`; re-exports from `embedding-matcher` and `ontology-matcher` |
| `backend/src/cop/agents/semantic-entity-query.ts` | Semantic entity fetcher | VERIFIED | Exports `fetchSemanticEntities` (filtered) and `fetchAllSemanticEntities` (all); Cypher includes confidence decay; maps to `SemanticEntity[]` |
| `backend/src/cop/agents/cop-coordinator.ts` | Updated coordinator using semantic queries | VERIFIED | State typed as `SemanticEntity[]`; diagnostic logging at entity boundaries |
| `backend/src/cop/agents/layer-sub-agents/sub-agent-types.ts` | SubAgentInput with SemanticEntity type | VERIFIED | `graphEntities: SemanticEntity[]`; `matchesEntityType`, `getEntityAffiliation` helpers; `LegacyGraphEntity` backward compat alias |
| `backend/src/cop/agents/layer-sub-agents/intel-overlay.ts` | J2 sub-agent with semantic filtering | VERIFIED | Filters by `HOSTILE_JSONLD_TYPES`, imports `getConfidenceTier`, outputs `confidenceTier`, `assertedVia`, `provenanceSummary` |
| `backend/src/cop/agents/layer-sub-agents/force-disposition.ts` | J3 sub-agent with semantic filtering | VERIFIED | Filters by `FRIENDLY_JSONLD_TYPES`, includes confidence/provenance in symbol output |
| `backend/src/cop/agents/layer-sub-agents/objectives-overlay.ts` | J5 sub-agent updated | VERIFIED | Outputs `confidenceTier`, `assertedVia`, `provenanceSummary` |
| `backend/src/cop/agents/layer-sub-agents/c2-overlay.ts` | C2 sub-agent updated | VERIFIED | Filters by `C2_JSONLD_TYPES`, outputs confidence/provenance fields |
| `backend/src/cop/agents/layer-sub-agents/control-measures.ts` | Control measures sub-agent updated | VERIFIED | Outputs `confidenceTier`, `assertedVia`, `provenanceSummary` |
| `backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts` | Logistics sub-agent updated | VERIFIED | Outputs `confidenceTier`, `assertedVia`, `provenanceSummary` |
| `backend/src/cop/layers/layer-types.ts` | COPSymbolSpec with confidence visual fields | VERIFIED | Imports `ConfidenceTier` from `provenance-types`; `COPSymbolSpec` has `confidenceTier`, `assertedVia`, `provenanceSummary` |
| `frontend/src/components/brain/types.ts` | BrainNode with provenance and temporal fields | VERIFIED | Has `validFrom`, `validTo`, `assertedVia`, `assertedBy`, `isContradicted`, `confidenceTier`, `jsonldType`, `halfLifeDays` |
| `frontend/src/components/brain/hooks/useBrainTimeline.ts` | Timeline hook with temporal filtering | VERIFIED | Exports `filterByTemporalValidity`; `playbackState`, `startPlayback`, `stopPlayback`, `setPlaybackSpeed`; staleness decay opacity |
| `frontend/src/components/brain/BrainTimeline.tsx` | Timeline slider with animated playback | VERIFIED | Play/pause button, speed selector (0.5x/1x/2x/5x), time display, `brain-timeline-playback` section |
| `backend/src/api/brain.ts` | Graph snapshot endpoint with atTime + JSON-LD fields | VERIFIED | Accepts `atTime` (or `at` legacy alias); returns `jsonldType`, `assertedVia`, `assertedBy`, `confidence`, `isContradicted`, `confidenceTier` per node |
| `frontend/src/components/brain/hooks/useBrainData.ts` | Fetch with atTime for temporal queries | VERIFIED | Uses `/api/brain/graph-snapshot?problemSetId=X&atTime=Y`; maps `jsonldType`, `assertedVia`, `isContradicted`, `confidenceTier` from response |
| `backend/src/graph/construction/graph-builder.ts` | LLM extraction with JSON-LD provenance | VERIFIED | Imports `detectContradiction`; passes `assertedVia` (default `'ai_inference'`), `jsonldType` from `ACTOR_TYPE_TO_CCO_MAP`, calls contradiction detection on property updates |
| `backend/src/doc-intelligence/specialists/fact-extractor.ts` | Doc intelligence with provenance | VERIFIED | Passes `assertedVia: 'doc_intelligence'` when calling graph builder |
| `backend/src/osint/osint-graph-sync.ts` | OSINT sync with JSON-LD provenance | VERIFIED | Writes `jsonldType`, `assertedVia: 'osint'`, `confidence: SOURCE_WEIGHTS['osint']` on actor/relationship creation |
| `backend/src/robot/vision-cop-pipeline.ts` | Vision pipeline with JSON-LD provenance | VERIFIED | Writes `jsonldType`, `assertedVia: 'vision_pipeline'`, `confidence: SOURCE_WEIGHTS['vision_pipeline']` on entity creation |
| `backend/src/api/graph.ts` | Graph API returning JSON-LD entities | VERIFIED | Returns `jsonldType`, `confidence`, `confidenceTier` in actor/entity responses; `atTime` parameter support for temporal filtering |
| `backend/src/graph/tools/raft-tools.ts` | LangGraph tools with JSON-LD pass-through | VERIFIED | Tool responses include `jsonldType`, `confidence`, `confidenceTier`, `assertedVia` for LangGraph agent consumption |
| `backend/src/graph/problem-set/aggregation-service.ts` | Aggregation with ontology type grouping | VERIFIED | Groups entities by `jsonldType`; includes `confidence` in aggregation results; handles pre-migration nodes via `coalesce` |
| `frontend/src/components/cop/COPMapView.tsx` | COP map with confidence visual encoding | VERIFIED | `confidenceThreshold` filter; confidence tier visual encoding (solid/dashed/ghost); reads `confidenceTier` from symbol spec |
| `frontend/src/components/cop/COPLayerControls.tsx` | COP controls with confidence threshold slider | VERIFIED | `confidenceThreshold` slider, range 0-1, `cop-confidence-filter-section` rendered |
| `frontend/src/components/cop/COPEntityTooltip.tsx` | Entity tooltip with provenance info | VERIFIED | Shows `assertedVia` (via `SOURCE_METHOD_LABELS`), confidence %, `assertedBy`, `provenanceSummary` |
| `backend/src/api/jpp.ts` | JPP entity API with JSON-LD fields | VERIFIED | Returns `jsonldType`, `confidence`, `confidenceTier`, `assertedVia` for entity search results |
| `frontend/src/lib/entity-service.ts` | Entity client types with JSON-LD fields | VERIFIED | `Entity` interface has `jsonldType?`, `confidence?`, `confidenceTier?`, `assertedVia?`, `validFrom?`, `validTo?`; exports `formatSourceMethod` |
| `frontend/src/components/plan/EntityResolutionPanel.tsx` | Confidence badges and provenance | VERIFIED | `confidenceTierStyle` function; renders confidence badge, `assertedVia` source method label, `jsonldType` for each entity |
| `frontend/src/components/design/DesignAIPanel.tsx` | Design tab confidence context | VERIFIED | Renders confidence badges for referenced entities; graceful degradation when fields absent |
| `frontend/src/components/assess/OperationalAssess.tsx` | Graph Confidence Summary | VERIFIED | `Graph Confidence Summary` section renders average confidence, tier distribution (high/medium/low counts) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `cco-schema-loader.ts` | `bastion-context.jsonld` | `readFileSync` at `join(currentDir, 'bastion-context.jsonld')` | WIRED | Path join verified in source |
| `raft/types.ts` | `provenance-types.ts` | `import type { ProvenanceProps, TemporalProps }` | WIRED | Line 12 of types.ts |
| `actor-store.ts` | `raft/types.ts` | `import { ACTOR_TYPE_TO_CCO_MAP }` | WIRED | Lines 16-17 of actor-store.ts |
| `actor-store.ts` | `provenance-types.ts` | `import type { SourceMethod }` | WIRED | Line 18 of actor-store.ts |
| `migrate-to-jsonld.ts` | `raft/types.ts` | `import { ACTOR_TYPE_TO_CCO_MAP }` | WIRED | Line 16 of migrate-to-jsonld.ts |
| `resolution-service.ts` | `embedding-matcher.ts` | `export { computeEmbeddingSimilarity }` re-export | WIRED | Line 20 of resolution-service.ts |
| `resolution-service.ts` | `ontology-matcher.ts` | `export { computeOntologyTypeScore }` re-export | WIRED | Line 23 of resolution-service.ts |
| `contradiction-detector.ts` | `neo4j-client.ts` | `MERGE (a)-[r:CONTRADICTS {id: $contradictionId}]->(b)` | WIRED | Lines 133, 197, 217 of contradiction-detector.ts |
| `cop/index.ts` | `semantic-entity-query.ts` | `import { fetchAllSemanticEntities }` | WIRED | Line 33 of cop/index.ts; used at line 128 |
| `cop-handlers.ts` | `semantic-entity-query.ts` | `import { fetchAllSemanticEntities }` | WIRED | Line 18; used at line 542 |
| `cop-coordinator.ts` | sub-agent-types | `import type { SubAgentInput, SemanticEntity }` | WIRED | Line 20 of cop-coordinator.ts |
| `intel-overlay.ts` | `provenance-types.ts` | `import { getConfidenceTier }` | WIRED | Line 18 of intel-overlay.ts |
| `layer-types.ts` | `provenance-types.ts` | `import type { ConfidenceTier }` | WIRED | Line 11 of layer-types.ts |
| `useBrainData.ts` | `brain.ts` (graph-snapshot) | `fetch /api/brain/graph-snapshot?atTime=` | WIRED | Line 298 of useBrainData.ts |
| `graph-builder.ts` | `contradiction-detector.ts` | `import { detectContradiction }` | WIRED | Line 14 of graph-builder.ts |
| `entity-service.ts` | `jpp.ts` | `fetch /api/jpp/entities/search` returns JSON-LD fields | WIRED | Response mapping at jpp.ts lines 56-58 |
| `EntityResolutionPanel.tsx` | `entity-service.ts` | imports `Entity` type and `formatSourceMethod` | WIRED | Confidence badges rendered at line 383+ |
| `OperationalAssess.tsx` | graph API | Fetches actor list for confidence aggregation | WIRED | `actorsRes`, `actors.reduce` for confidence sum at line 184 |

---

## Requirements Coverage

Phase 47 requirements are phase-internal tracking IDs defined in plan frontmatter only (no central REQUIREMENTS.md exists for this project). Coverage verified against plan-level must_haves:

| Requirement ID | Defined In | Description | Status |
|---------------|-----------|-------------|--------|
| JSONLD-01 | Plans 01, 03, 04 | JSON-LD context with ontology namespaces; RAFT types with JSON-LD fields | SATISFIED — bastion-context.jsonld, types.ts, all 4 RAFT stores verified |
| JSONLD-02 | Plan 01 | CCO schema loader extended | SATISFIED — loadBastionContext/getBastionContext in cco-schema-loader.ts |
| JSONLD-03 | Plan 01 | cco-types.ts with BFO/DODAF/JC3 type maps | SATISFIED — cco-types.ts present (noted in plan 01) |
| JSONLD-04 | Plan 01 | cco-schema-loader tests cover JSON-LD loading | SATISFIED — cco-schema-loader.test.ts extended |
| JSONLD-05 | Plans 01, 04 | Migration script rewrites existing nodes to JSON-LD format | SATISFIED — migrate-to-jsonld.ts + migration-runner.ts verified |
| PROV-01 | Plans 01, 03, 04, 09 | Provenance types + RAFT stores + ingestion pipelines write assertedBy/Via/From | SATISFIED — all stores, graph-builder, fact-extractor, osint-sync, vision-pipeline verified |
| TEMP-01 | Plans 01, 03, 08 | Temporal fields (validFrom/validTo/halfLifeDays) on all nodes; temporal queries | SATISFIED — all stores write temporal fields; schema-init has temporal indexes; brain API accepts atTime |
| TEMP-02 | Plans 02, 08 | Brain timeline temporal filter; useBrainTimeline tests | SATISFIED — filterByTemporalValidity exported and tested |
| CONF-01 | Plans 01, 02, 07 | Confidence decay/fusion formulas; confidence tier visual encoding | SATISFIED — confidence-calculator.ts, confidence-calculator.test.ts, all sub-agents output confidenceTier |
| CONF-02 | Plans 02, 05 | Resolution service test + hybrid scoring | SATISFIED — resolution-service.test.ts, computeHybridScore verified |
| CONTRA-01 | Plans 02, 05, 08 | Contradiction detection with temporal overlap; :CONTRADICTS edges; tests | SATISFIED — contradiction-detector.ts (280 lines), contradiction-detector.test.ts |
| ENTRES-01 | Plans 02, 05, 09 | Entity resolution three-signal scoring; tests; ingestion triggers resolution | SATISFIED — resolution-service.ts, resolution-service.test.ts, graph-builder triggers resolution |
| COP-01 | Plan 06 | COP coordinator uses semantic entity query; not actorStore.listActors | SATISFIED — cop/index.ts and cop-handlers.ts both use fetchAllSemanticEntities |
| COP-02 | Plans 06, 07 | Sub-agents receive SemanticEntity[] with jsonldType, confidence, provenance | SATISFIED — SubAgentInput.graphEntities typed as SemanticEntity[]; all 6 sub-agents verified |
| COP-03 | Plans 07, 10 | COP symbols carry confidenceTier; COPMapView applies visual encoding | SATISFIED — COPSymbolSpec has confidenceTier; COPMapView applies solid/dashed/ghost rendering |
| WIRE-01 | Plans 09, 10, 11 | All 7+ downstream consumers wired to JSON-LD graph | SATISFIED — graph API, RAFT tools, aggregation, COP map, brain viz, plan tab, design tab, assess tab all verified |

---

## Anti-Patterns Found

No blocker or warning anti-patterns found. The one HTML `placeholder` attribute in EntityResolutionPanel.tsx (line 453) is an input field label, not a code stub.

---

## Human Verification Required

### 1. COP pipeline end-to-end symbol generation

**Test:** Trigger COP generation for a workspace containing at least one graph entity with `jsonldType`, `confidence`, and `validFrom` populated (post-migration). Inspect the generated COPLayerSpec for each sub-agent.
**Expected:** `symbols` array is non-empty; each symbol has `confidenceTier`, `assertedVia`, `provenanceSummary` populated. Intel overlay contains hostile/suspect entities. Force disposition contains friendly entities.
**Why human:** Requires live Neo4j with migrated graph data and a running COP pipeline trigger.

### 2. Brain timeline animated playback

**Test:** Open the brain visualization. Click play on the BrainTimeline slider. Observe nodes appearing and fading as time advances.
**Expected:** Nodes fade in at their `validFrom`, fade out at their `validTo`. Confidence badges update with staleness decay. Contradicted nodes show red pulsing indicator.
**Why human:** Real-time animation behavior requires browser execution.

### 3. COP confidence visual encoding

**Test:** View a published COP layer with symbols of varying confidence. Apply the confidence threshold slider in COPLayerControls.
**Expected:** Symbols below threshold are hidden. High-confidence symbols render with solid outlines. Medium-confidence render with dashed + amber. Low-confidence render as ghost/dotted.
**Why human:** Visual rendering requires browser/DOM verification.

### 4. Entity contradiction detection live

**Test:** Write two assertions to the graph about the same entity + property key with overlapping `validFrom`/`validTo` ranges but different values. Verify a `:CONTRADICTS` edge is created and both confidences are reduced by 20%.
**Expected:** Neo4j shows `:CONTRADICTS` relationship; confidence values reduced. Brain visualization shows `isContradicted: true` on the node.
**Why human:** Requires live Neo4j instance.

---

## Summary

Phase 47 achieved its goal. All 11 observable truths are verified in the codebase:

1. The JSON-LD ontology layer is complete: `bastion-context.jsonld` bundled with all 6 namespaces, loaded at startup by `cco-schema-loader.ts`, type system in `provenance-types.ts`, confidence math in `confidence-calculator.ts`.

2. The RAFT graph layer is fully upgraded: all 4 entity stores (actor, relationship, tension, decision) write JSON-LD native properties on every create/update operation. `schema-init.ts` creates temporal and semantic indexes. The migration script handles existing data in batches of 500 with idempotency.

3. The intelligence subsystems are implemented: contradiction detection checks temporal overlap before flagging (Pitfall 7 addressed), entity resolution uses three-signal hybrid scoring (0.4 string + 0.4 embedding + 0.2 type), embeddings cached on Neo4j nodes.

4. The COP pipeline is fixed: `cop/index.ts` and `cop-handlers.ts` both use `fetchAllSemanticEntities` instead of the old `actorStore.listActors`. All 6 sub-agents filter by `jsonldType` and output `confidenceTier`, `assertedVia`, `provenanceSummary`. `COPSymbolSpec` carries confidence visual fields.

5. All downstream consumers are wired: brain visualization (types, timeline hook, BrainTimeline component), backend brain endpoint, graph API, RAFT tools, aggregation service, COP map + controls + tooltip, JPP entity API, entity-service client, EntityResolutionPanel, DesignAIPanel, OperationalAssess.

Four items require human verification: COP end-to-end symbol generation, brain playback animation, COP visual encoding rendering, and live contradiction detection — all require a running application with live Neo4j data.

---

_Verified: 2026-03-16_
_Verifier: Claude (gsd-verifier)_
