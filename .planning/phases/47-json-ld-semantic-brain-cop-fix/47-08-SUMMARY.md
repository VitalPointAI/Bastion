---
phase: 47-json-ld-semantic-brain-cop-fix
plan: 08
subsystem: brain-visualization
tags: [brain, json-ld, temporal, timeline, provenance, playback]
dependency_graph:
  requires: [47-01, 47-03]
  provides: [brain-temporal-timeline, brain-jsonld-fields, brain-playback]
  affects: [frontend/brain, backend/api/brain]
tech_stack:
  added: []
  patterns: [temporal-filtering, staleness-decay, confidence-tier-opacity, playback-interval]
key_files:
  created: []
  modified:
    - frontend/src/components/brain/types.ts
    - frontend/src/components/brain/hooks/useBrainData.ts
    - frontend/src/components/brain/hooks/useBrainTimeline.ts
    - frontend/src/components/brain/BrainTimeline.tsx
    - backend/src/api/brain.ts
decisions:
  - "Export filterByTemporalValidity and getStalenessOpacity as named exports for direct testability"
  - "atTime param preferred over at (legacy) on graph-snapshot endpoint — both supported for backward compat"
  - "Contradiction detection is non-fatal: batch Cypher query failure does not block graph-snapshot response"
  - "confidenceTier computed both client-side (useBrainData) and server-side (brain.ts) for consistency"
metrics:
  duration: 8 min
  completed_date: "2026-03-16"
  tasks_completed: 3
  files_modified: 5
---

# Phase 47 Plan 08: Brain JSON-LD Temporal Timeline + Playback Summary

Brain visualization upgraded with JSON-LD provenance fields, per-assertion temporal filtering, animated timeline playback, and a backend graph-snapshot endpoint that serves enriched data with atTime support and isContradicted flags.

## What Was Built

### Task 1: BrainNode Types + useBrainData JSON-LD mapping

- `BrainNode` interface extended with 8 new fields: `validFrom`, `validTo`, `assertedVia`, `assertedBy`, `isContradicted`, `confidenceTier`, `jsonldType`, `halfLifeDays`
- `BrainEdge` interface extended with `isContradiction` and `confidence`
- `useBrainData` hook accepts optional `atTime` parameter; when set, fetches from `/api/brain/graph-snapshot?atTime=...` instead of live endpoints
- `computeConfidenceTier` helper added: >0.85 = high, 0.5-0.85 = medium, <0.5 = low
- `confidenceTier` computed on all node types in the live-fetch path

### Task 2: Temporal timeline + animated playback

- `filterByTemporalValidity(nodes, atTime)` exported from `useBrainTimeline.ts`: filters by `validFrom <= atTime AND (validTo == null OR validTo > atTime)`, computes staleness decay opacity
- `getStalenessOpacity(confidence)` exported: maps confidence to 1.0/0.7/0.4 opacity tiers
- `PlaybackState` interface added: `isPlaying`, `speed`, `currentTime`
- `startPlayback(speed?)`, `stopPlayback()`, `setPlaybackSpeed(speed)`, `setCurrentTime(time)` added to hook return
- Default playback: 1x = 1 month per second advance
- Speeds: 0.5x, 1x, 2x, 5x
- `BrainTimeline.tsx` updated with play/pause button, speed selector buttons, and playback props
- All 13 pre-existing `useBrainTimeline.test.ts` tests pass

### Task 3: Backend graph-snapshot endpoint upgrade

- `GET /api/brain/graph-snapshot` accepts `atTime` (preferred) or `at` (legacy alias)
- Timestamp is now optional — defaults to current time when omitted (returns latest graph)
- `getConfidenceTier` imported from `graph/provenance-types.ts` and applied server-side
- Response nodes enriched with: `validFrom`, `validTo`, `assertedVia`, `assertedBy`, `jsonldType`, `confidence`, `confidenceTier`, `sourceWeight`, `halfLifeDays`, `isContradicted`
- Batch Cypher `:CONTRADICTS` query to detect and flag contradicted nodes
- Non-fatal: contradiction detection errors are caught and do not block the response

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Out-of-Scope Pre-existing Issues

Deferred: `backend/src/cop/agents/layer-sub-agents/logistics-overlay.ts` has pre-existing TypeScript errors (`matchesEntityType` undefined, `COPSymbolSpec` missing `confidenceTier`). These were present before this plan and are unrelated to brain visualization. Logged for future fix.

## Self-Check: PASSED

Files created/modified:
- FOUND: frontend/src/components/brain/types.ts
- FOUND: frontend/src/components/brain/hooks/useBrainData.ts
- FOUND: frontend/src/components/brain/hooks/useBrainTimeline.ts
- FOUND: frontend/src/components/brain/BrainTimeline.tsx
- FOUND: backend/src/api/brain.ts

Commits:
- FOUND: 65e4b7b3 — Task 1: BrainNode types + useBrainData
- FOUND: ebd9521e — Task 2: temporal timeline + playback
- FOUND: 35b25464 — Task 3: backend graph-snapshot endpoint
