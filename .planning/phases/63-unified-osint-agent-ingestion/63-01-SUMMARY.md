---
phase: 63-unified-osint-agent-ingestion
plan: "01"
subsystem: osint-pipeline
tags: [osint, doc-intelligence, graph-builder, provenance, langgraph]
dependency_graph:
  requires: []
  provides: [osint-agent-bridge, assertedVia-threading]
  affects: [backend/src/osint, backend/src/doc-intelligence]
tech_stack:
  added: []
  patterns: [graph-cache-per-problem-set, fallback-context-synthesis, assertedVia-override]
key_files:
  created:
    - backend/src/osint/osint-agent-bridge.ts
    - backend/src/osint/osint-agent-bridge.test.ts
  modified:
    - backend/src/doc-intelligence/specialists/fact-extractor.ts
    - backend/src/doc-intelligence/orchestrator-wiring.ts
decisions:
  - "Use Map<problemSetId, {graph, expiresAt}> TTL cache to avoid creating StateGraph per OSINT event"
  - "buildFallbackContext provides classificationCeiling/echelon required fields not mentioned in research spec — auto-fixed against actual ProblemSetContextSchema"
  - "assertedVia threaded via state.metadata to avoid adding new LangGraph state field"
metrics:
  duration: 4 min
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_changed: 4
---

# Phase 63 Plan 01: OSINT Agent Bridge and assertedVia Threading Summary

OSINT events can now route through the full 12-specialist doc-intelligence pipeline (trust gates, NATO ratings, fact extraction, provenance) via a new bridge module; `assertedVia: 'osint'` is threaded from bridge metadata through orchestrator wiring to FactExtractor to GraphBuilder, replacing the hardcoded `'doc_intelligence'` default.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create osint-agent-bridge module with tests | 3d2940c3 | osint-agent-bridge.ts, osint-agent-bridge.test.ts |
| 2 | Thread assertedVia through FactExtractor and orchestrator wiring | 37540cc1 | fact-extractor.ts, orchestrator-wiring.ts |

## What Was Built

**`backend/src/osint/osint-agent-bridge.ts`** — Thin adapter exporting `processOSINTEventThroughAgents(event, feed)`:
- Fetches `ProblemSetContext` via `getProblemSetContext(problemSetId)`; synthesises minimal fallback context when none exists (`coreProblem: 'General geopolitical intelligence monitoring'`, `regions: ['Global']`)
- Caches compiled `WiredDocIntelligenceGraph` instances per `problemSetId` with 30-minute TTL — prevents StateGraph and 12-specialist recreation per event
- Builds document text as `${event.title}\n\n${event.description}` and metadata including `documentType: 'OSINT_REPORT'` and `assertedVia: 'osint'`
- Calls `graph.processDocument(event.id, documentText, metadata)` and returns `{ actorsCreated, relationshipsCreated }` from the fact-extractor specialist result

**`backend/src/doc-intelligence/specialists/fact-extractor.ts`** changes:
- Added `assertedVia?: SourceMethod` to `FactExtractorInput` interface (imported from `../../graph/provenance-types.js`)
- Added `assertedVia?: SourceMethod` to `buildGraphEntities` options parameter
- Changed hardcoded `assertedVia: 'doc_intelligence'` in `GraphBuildOptions` construction to `assertedVia: options.assertedVia ?? 'doc_intelligence'`
- Destructured and forwarded `assertedVia` from `extract()` input to `buildGraphEntities()` call

**`backend/src/doc-intelligence/orchestrator-wiring.ts`** changes:
- Imported `SourceMethod` from `../graph/provenance-types.js`
- In fact-extractor node handler: extracted `assertedVia = (state.metadata?.assertedVia as SourceMethod | undefined)` and passed it to `factExtractor.extract()`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fallback context missing required ProblemSetContext fields**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** Research spec fallback used `temporalRange: { startDate: null, endDate: null }` and `actorFocus: { primaryActors: [], secondaryActors: [] }` — but the actual `ProblemSetContextSchema` defines `temporalRange.startDate/endDate` as `z.string().optional()` (not nullable), `actorFocus` has no `secondaryActors` field, and `classificationCeiling` and `echelon` are required enum fields
- **Fix:** Updated `buildFallbackContext` to use `temporalRange: {}`, `actorFocus: { primaryActors: [] }`, and added `classificationCeiling: 'UNCLASSIFIED'` and `echelon: 'strategic'`
- **Files modified:** backend/src/osint/osint-agent-bridge.ts
- **Commit:** 3d2940c3 (fixed inline before Task 1 commit after tsc caught it in Task 2)

## Verification Results

1. Bridge tests: 5/5 pass — `npx vitest run src/osint/osint-agent-bridge.test.ts`
2. TypeScript: `npx tsc --noEmit` — no errors
3. Doc-intelligence tests: 11/11 pass — `npx vitest run src/doc-intelligence/`

## Self-Check: PASSED

Files created/modified:
- backend/src/osint/osint-agent-bridge.ts — FOUND
- backend/src/osint/osint-agent-bridge.test.ts — FOUND
- backend/src/doc-intelligence/specialists/fact-extractor.ts — modified, FOUND
- backend/src/doc-intelligence/orchestrator-wiring.ts — modified, FOUND

Commits:
- 3d2940c3 — FOUND (feat(63-01): create OSINT agent bridge)
- 37540cc1 — FOUND (feat(63-01): thread assertedVia)
