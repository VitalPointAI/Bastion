# Phase 47: JSON-LD Semantic Brain + COP Fix - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Refactor the knowledge graph to JSON-LD with formal ontology alignment (BFO, CCO, DODAF/DNDAF), provenance tracking (W3C PROV-O), temporal reasoning, entity resolution, and confidence scoring. Fix COP layer generation pipeline end-to-end. Wire the upgraded graph into all downstream consumers (COP sub-agents, brain visualization, design tab, plan tab, assess tab, doc-intelligence, OSINT pipeline, vision pipeline).

</domain>

<decisions>
## Implementation Decisions

### JSON-LD Migration Strategy
- **Full property rewrite** — all Neo4j node/edge properties rewritten to use JSON-LD-native keys with @context and @type mappings. Not a wrapper layer; storage itself is ontology-native
- **Full ontology stack** — BFO as upper ontology foundation → CCO mid-level (Agent, Event, Artifact, Geospatial) → DODAF/DNDAF for architecture views → JC3IEDM for military entity catalog → APP-6 for NATO symbology SIDC codes. Every entity maps through the full chain
- **Big-bang migration** — single migration pass rewrites all nodes + updates all consumers simultaneously. No dual-format code or backward-compat shims. COP is already broken and the graph is being overhauled — natural time for clean cut
- **Bundled context file + hosted URL** — ship @context as a local JSON-LD file in the repo (follows existing cco-classes.json pattern) for offline/DDIL operation. Canonical @context reference points to a hosted URL for interop when connectivity allows. No external runtime dependency

### Provenance & Confidence Model
- **W3C PROV-O aligned provenance** — every assertion carries prov:wasGeneratedBy (activity/method), prov:wasAttributedTo (agent/asserter), prov:wasDerivedFrom (source documents/events). Maps naturally to JSON-LD
- **Weighted source fusion for corroboration** — each source type has configurable base reliability weight (manual_entry: 0.95, sigint: 0.90, doc_intelligence: 0.75, vision_pipeline: 0.70, osint: 0.65, ai_inference: 0.60). Multi-source corroboration: conf = 1 - ∏(1 - w_i). Weights configurable per workspace
- **Inline conflict markers + contradiction queue** — contradictions create :CONTRADICTS edges between assertions, add to review queue in brain viz, lower confidence of both assertions until resolved. Staff sees red pulsing edges/badges and resolves via panel (accept A, accept B, both valid, flag for intel)
- **Hybrid entity resolution** — extend existing string matcher with: (1) embedding similarity (text-embedding-3-large), (2) ontology-aware matching (same @type + overlapping properties). Three-signal fused score. Auto-merge above 0.85, human review queue 0.5-0.85, distinct below 0.5

### Temporal Reasoning
- **Per-assertion temporal validity** — every property/fact has its own validFrom/validTo independent of the entity. Enables point-in-time queries at property level (e.g., "PLA Navy commander at date X")
- **Configurable staleness decay curves** — each fact type has a configurable half-life (personnel: 180d, capability: 365d, political: 90d, geographic: 1825d, economic: 365d). Confidence decays exponentially: conf(t) = conf_0 * 2^(-t/half_life). Re-confirmation resets the clock
- **Timeline slider on brain visualization** — temporal slider in brain toolbar, scrubbing filters graph to assertions valid at that point in time. Stale/expired facts fade out. Integrates with lenses — lens config includes temporal window
- **Animated playback** — play button auto-advances through time at configurable speed (1x = 1 month/second). Entities fade in at validFrom, fade out at validTo, confidence badges update with decay, contradictions flash when detected. Reuses COP phase slider playback pattern

### COP Pipeline Fix
- **Debug + upgrade existing pipeline** — preserve Phase 21 architecture (coordinator → sub-agents → layer assembly → store → event bus). Diagnose and fix broken links in the current chain, then upgrade sub-agents to consume JSON-LD graph data
- **Semantic graph queries per sub-agent** — each sub-agent queries the JSON-LD graph directly using ontology-aware Cypher scoped by @type. J2 queries adversary entities, J3 queries friendly forces, etc. Each sub-agent gets typed entities with provenance and confidence attached
- **Visual confidence encoding on COP** — confidence maps to visual properties: high (>0.85) = solid symbols full opacity, medium (0.5-0.85) = dashed outlines + amber badge at 70% opacity, low (<0.5) = dotted/ghost at 40% + red badge. Confidence threshold slider in COP layer controls
- **All consumers wired in this phase** — all 7+ downstream consumers updated to use JSON-LD graph: COP sub-agents, brain visualization, doc-intelligence (write), OSINT pipeline (write), vision pipeline (write), design tab (read), plan tab (read), assess tab (read)

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

</decisions>

<specifics>
## Specific Ideas

- Full property rewrite means committing to ontology-native storage — no half measures. Every Cypher query in the codebase updates
- W3C PROV-O provenance aligns with the broader vision of interoperability with NATO/coalition systems
- Confidence visualization on COP gives commanders at-a-glance reliability assessment — solid symbols = confirmed, ghosted = unconfirmed
- Timeline slider with animated playback enables "watching the situation evolve" for briefings and pattern recognition
- Bundled context file + hosted URL follows DDIL principle — works offline, interoperable when connected
- Source reliability weights mirror military intelligence reliability ratings (A-F / 1-6 system)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/cop/` — Full COP module: coordinator, 6 sub-agents, layer store, version store, event bus, trigger handler, activity bridge, SVG sanitizer. Architecture sound, needs debugging + JSON-LD upgrade
- `backend/src/cop/cco/` — CCO schema loader with curated JSON classes. Extend with BFO/DODAF/JC3IEDM mappings
- `backend/src/graph/raft/` — RAFT entity stores (actor, relationship, function, tension, decision). All need property rewrite to JSON-LD native keys
- `backend/src/graph/resolution/` — Entity resolution module with string matching and blocking. Extend with embedding + ontology matching
- `frontend/src/types/cop.ts` — Full COP type definitions (layers, symbols, specs, lifecycle). Update for confidence encoding
- `frontend/src/components/brain/` — Brain visualization with hooks (useBrainData, useBrainClustering, useBrainTimeline). Add timeline slider
- `backend/src/graph/neo4j-client.ts` — Neo4j driver singleton. All graph queries route through here

### Established Patterns
- CCO schema loaded from bundled JSON at startup (cco-schema-loader.ts) — extend for full ontology stack
- Workspace-scoped graph isolation via workspaceId on all queries
- Container-scoped subgraphs via containerId tagging (Phase 25.2/25.3)
- COP event bus pattern: document:committed → trigger handler → layer:generation:start → coordinator
- Phase slider with animated playback (COPPhaseSpec) — reuse pattern for brain timeline
- d3-force custom force factories in useBrainClustering — layout system already pluggable

### Integration Points
- All RAFT stores (actor-store, relationship-store, decision-store, tension-store) — property rewrite
- COP coordinator (cop-coordinator.ts) — data flow upgrade from flat arrays to semantic queries
- Doc-intelligence fact extractor (specialists/fact-extractor.ts) — write JSON-LD on extraction
- OSINT feed poller (osint/feed-poller.ts) — write JSON-LD on ingestion
- Vision COP pipeline (robot/vision-cop-pipeline.ts) — write JSON-LD on detection
- Brain visualization hooks — consume JSON-LD entities, add timeline slider
- Graph API endpoints — return JSON-LD formatted responses

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-json-ld-semantic-brain-cop-fix*
*Context gathered: 2026-03-15*
