---
phase: 47-json-ld-semantic-brain-cop-fix
plan: "10"
subsystem: graph-api-cop-consumers
tags: [jsonld, cop, confidence, provenance, temporal, visual-encoding, graph-api, raft-tools]
dependency_graph:
  requires: ["47-03", "47-07"]
  provides: ["all-consumers-wired-to-jsonld-graph"]
  affects: ["cop-map-rendering", "langgraph-agent-tools", "graph-api-responses", "aggregation-service"]
tech_stack:
  added: []
  patterns:
    - "getConfidenceTierForValue() inline helper in graph API (mirrors frontend getConfidenceTier)"
    - "atTime query param for temporal filtering on actor list endpoints"
    - "includeProvenance param (default true) — opt-out pattern rather than opt-in"
    - "confidenceThreshold prop on COPMapView — filter + opacity modifier stack"
    - "getTierOpacityModifier() for high=1.0, medium=0.7, low=0.4 opacity levels"
    - "SOURCE_METHOD_LABELS map in tooltip for human-readable assertedVia values"
key_files:
  created: []
  modified:
    - backend/src/api/graph.ts
    - backend/src/graph/tools/raft-tools.ts
    - backend/src/graph/tools/entity-tools.ts
    - backend/src/graph/problem-set/aggregation-service.ts
    - frontend/src/types/cop.ts
    - frontend/src/components/cop/COPMapView.tsx
    - frontend/src/components/cop/COPLayerControls.tsx
    - frontend/src/components/cop/COPEntityTooltip.tsx
decisions:
  - "includeProvenance defaults to true — provenance included unless explicitly excluded with ?includeProvenance=false (opt-out rather than opt-in)"
  - "Temporal filtering in graph API is client-side on returned actor list (not a Cypher query param) — avoids schema coupling while migration may not have run on all nodes"
  - "confidenceTier on COPSymbolSpec is optional (not required) to maintain backward compatibility with layers generated before Plan 07"
  - "Confidence threshold slider only renders in COPLayerControls when onConfidenceThresholdChange callback is provided — progressive enhancement pattern"
  - "Opacity stacks: layer opacity * tier opacity modifier — medium confidence symbols at 70% layer opacity are rendered at 49% total opacity"
metrics:
  duration_seconds: 394
  completed_date: "2026-03-16"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
---

# Phase 47 Plan 10: Wire Downstream Consumers to JSON-LD Graph Summary

**One-liner:** Graph API, RAFT tools, entity tools, and aggregation service wired to JSON-LD with provenance + temporal fields; COP map renders confidence tiers visually with threshold filter.

## What Was Built

Completed the "all consumers wired" requirement by updating every downstream consumer of graph data to understand the JSON-LD format established in Plans 03 and 07. The graph API now returns `jsonldType`, `confidenceTier`, and optional provenance in all entity responses. LangGraph RAFT tools include full semantic entity data in their outputs. The aggregation service adds ontology type grouping and average confidence metrics. The COP frontend renders confidence as visual encoding (opacity, popup badges) and provides a confidence threshold slider.

## Task Completion

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Update graph API + RAFT tools + entity tools + aggregation service | 011a03bf | Complete |
| 2 | COP confidence visual encoding in map view + controls + tooltip | dde407c4 | Complete |

## Key Changes

### backend/src/api/graph.ts
- `GET /actors`: returns `jsonldType`, `confidence`, `confidenceTier`, `validFrom`, `validTo`, provenance object
- `GET /actors/:id`: same JSON-LD fields + optional `?includeProvenance=false` opt-out
- `GET /actors` and `GET /workspaces/:id/graph`: `?atTime=<ISO>` temporal filtering applied client-side
- `GET /tensions`: `?includeProvenance=false` opt-out pattern
- Root `GET /` graph endpoint: nodes include `jsonldType` + `confidenceTier`
- `getConfidenceTierForValue()` helper (mirrors frontend function, no import needed)

### backend/src/graph/tools/raft-tools.ts
- `create_actor` handler: passes `assertedBy`/`assertedVia` input fields through to `actorStore.createActor()`; returns full provenance object in response
- `get_actor_profile` handler: returns `jsonldType`, `confidenceTier`, `validFrom`, `validTo`, full provenance object
- `export_graph_visualization` handler: all 3 formats (nodes_edges, d3, cytoscape) include `jsonldType` + `confidenceTier` on nodes

### backend/src/graph/tools/entity-tools.ts
- `search_entities` handler: returns shaped results with `jsonldType`, `confidence`, `validFrom`, `validTo`, provenance object
- `get_entity_references` handler: adds `jsonldType`, `confidence`, `provenance` to return type

### backend/src/graph/problem-set/aggregation-service.ts
- `AggregatedView` interface: `topActors` items gain `jsonldType` + `confidence` fields
- `getMasterView()`: aggregates ontology type counts by `jsonldType` → `ontologyTypeCounts: Record<string, number>`
- `getMasterView()`: computes `averageConfidence` across all actors
- Pre-migration actors coalesce `jsonldType ?? 'cco:Agent'` and `confidence ?? 0.75`

### frontend/src/types/cop.ts
- `COPSymbolSpec` gains: `confidenceTier?`, `assertedVia?`, `provenanceSummary?`, `validFrom?`, `validTo?`, `assertedBy?`, `updatedAt?`

### frontend/src/components/cop/COPMapView.tsx
- `COPMapViewProps` gains `confidenceThreshold?: number` (default 0)
- `getSymbolTier()` helper: derives tier from `confidenceTier` field or raw `confidence` value
- `getTierOpacityModifier()`: high=1.0, medium=0.7, low=0.4
- Symbols below `confidenceThreshold` are filtered out entirely
- Effective marker opacity = layer opacity × tier opacity modifier
- Popup shows amber (medium) / red (low) confidence badge with tier label
- Popup shows `provenanceSummary` when available
- Popup shows SVG stroke encoding hint (dashed for medium, dotted for low)

### frontend/src/components/cop/COPLayerControls.tsx
- Props gain `confidenceThreshold?` + `onConfidenceThresholdChange?` (optional — progressive enhancement)
- Confidence Filter section added above Layers Header: range slider 0-1, step 0.05
- Shows current threshold value ("≥75%" or "All" when 0)
- Tier legend: colored indicator dots for high/medium/low

### frontend/src/components/cop/COPEntityTooltip.tsx
- `SOURCE_METHOD_LABELS` map: human-readable labels for all `assertedVia` source method values
- `formatLastAssessed()` helper: formats ISO datetime to readable date string
- New Provenance section in tooltip body: Source, Confidence%, Last assessed, Assessed by
- `assertedBy` DID truncated to 20 chars with ellipsis for display

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 8 modified files confirmed present. Both task commits (011a03bf, dde407c4) verified in git log.
