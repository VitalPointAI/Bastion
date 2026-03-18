---
phase: 50-universal-intelligence-input
plan: 06
status: complete
started: 2026-03-18
completed: 2026-03-18
gap_closure: true
---

## Summary

Bridged the gap between doc-intelligence geocoded locations and COP layer creation. Documents processed through the intelligence pipeline now automatically generate COP intel layers with uniquely descriptive names.

## What Was Built

### doc-cop-pipeline.ts (CREATE)
- `updateDocIntelCOPLayer(problemSetId, report, locations, metadata)` — creates COP intel layers from geocoded document locations
- Cross-references geocoded locations against extracted facts to associate entities with map positions
- Infers affiliation (friendly/hostile/neutral/unknown) from keyword analysis of related facts
- Infers symbol set (ground/naval/air/cyber) from fact content
- Generates MIL-STD-2525D SIDC codes for each location-entity pair
- Locations without associated entities produce annotation-only markers (no SIDC symbol)
- Descriptive layer naming: `"INTEL_ESTIMATE: Pacific Strategy Assessment (Mar 2026)"`
- Broadcasts `cop:layer_updated` via message bus after layer creation

### universal-ingest-router.ts (EDIT)
- After doc-intelligence processing completes, calls `geocodingService.extractLocations()` on document text
- Routes locations + report to `updateDocIntelCOPLayer()`
- Gated by: trust status (skip if `graphIngestionBlocked`), location availability
- Wrapped in try/catch — COP layer creation is best-effort, never fails the main pipeline
- Broadcasts `cop:doc_layer_updated` SSE event on success

### osint-cop-pipeline.ts (EDIT)
- Added descriptive `displayName` in layer metadata derived from source feed names
- e.g. `"OSINT Feeds: Reuters, AP News, Janes +2 more"`

## Key Decisions

- **One layer per document** (vs OSINT pattern of one layer per workspace) — each intelligence document gets its own named COP layer so analysts can toggle visibility per source
- **Annotation fallback** — locations without entity associations still appear as map annotations, just without SIDC military symbology
- **Best-effort gate** — COP layer creation never blocks or fails the main processing pipeline

## Key Files

| File | Action |
|------|--------|
| backend/src/doc-intelligence/doc-cop-pipeline.ts | CREATE |
| backend/src/doc-intelligence/doc-cop-pipeline.test.ts | CREATE |
| backend/src/ingest/universal-ingest-router.ts | EDIT |
| backend/src/osint/osint-cop-pipeline.ts | EDIT |

## Test Results

11/11 tests passing:
- COP symbols created with correct SIDC from location+fact pairs
- Annotation-only markers for locations without facts
- Empty locations → no layer created
- Invalid coordinates (0,0) filtered out
- Friendly/hostile affiliation inference from keywords
- Naval symbol set inference from ship/fleet keywords
- Message bus broadcast verification
- Descriptive section IDs from document metadata
- Display name formatting with/without metadata

## Self-Check: PASSED
