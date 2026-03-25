---
phase: 56-visual-operational-approach-editor
plan: 01
subsystem: design
tags: [map-overlay, types, db-migration, api, frontend-service]
dependency_graph:
  requires: []
  provides: [MapOverlay types, map_overlay DB column, CRUD store methods, REST API endpoints, frontend API client]
  affects: [backend/src/design/types.ts, frontend/src/lib/design-service.ts, backend/src/design/design-store.ts, backend/src/api/design.ts]
tech_stack:
  added: []
  patterns: [JSONB PATCH operations, optional typed extension of existing interfaces]
key_files:
  created:
    - backend/src/db/migrations/043-design-map-overlay.sql
    - frontend/src/lib/map-overlay-service.ts
  modified:
    - backend/src/design/types.ts
    - frontend/src/lib/design-service.ts
    - backend/src/design/design-store.ts
    - backend/src/api/design.ts
decisions:
  - "Use read-modify-write pattern for move/remove/update operations rather than pure SQL JSONB update — simpler and correctness over micro-optimization for small overlays"
  - "Use unknown intermediate cast for request body type conversions in API endpoint — avoids TS2352 while keeping intent clear"
  - "getMapOverlay returns empty overlay struct when row has NULL map_overlay — consistent empty-state contract for consumers"
metrics:
  duration: 4 minutes
  completed: 2026-03-25
  tasks_completed: 2
  files_modified: 6
---

# Phase 56 Plan 01: MapOverlay Data Model and API Foundation Summary

MapSymbol/ControlMeasure/MapOverlay types with DB migration, 8 CRUD store methods, REST PATCH+GET endpoints, and 7-function frontend API client for the visual operational approach editor.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Define MapOverlay types and DB migration | edcff93d | types.ts (backend+frontend), 043-design-map-overlay.sql |
| 2 | Store methods, API endpoint, and frontend service | c84e78c4 | design-store.ts, design.ts (api), map-overlay-service.ts |

## What Was Built

### Types (backend/src/design/types.ts + frontend/src/lib/design-service.ts)
- `MapSymbol` interface: id, sidc, designation, affiliation, lat/lng, echelon, label, additionalInfo, createdBy, createdAt
- `ControlMeasure` interface: id, type (9 variants including phase_line/boundary/axis_of_advance/nai/fscm), label, affiliation, geometry (line/polygon/point with coordinates array), createdBy, createdAt
- `MapOverlay` interface: symbols array, controlMeasures array, optional aoBounds, lastUpdatedBy, lastUpdatedAt
- `OperationalApproach` extended with `mapOverlay?: MapOverlay` field

### DB Migration (backend/src/db/migrations/043-design-map-overlay.sql)
- `ALTER TABLE operational_designs ADD COLUMN IF NOT EXISTS map_overlay JSONB DEFAULT '{"symbols":[],"controlMeasures":[]}'::jsonb`
- Idempotent — safe to run multiple times

### Store Methods (backend/src/design/design-store.ts — 8 new methods)
- `getMapOverlay(problemSetId)` — read map_overlay JSONB, returns empty overlay if null
- `setMapOverlay(problemSetId, overlay)` — full replacement with timestamp update
- `addMapSymbol(problemSetId, symbol)` — JSONB array append via SQL concatenation operator
- `moveMapSymbol(problemSetId, symbolId, lat, lng)` — read-modify-write pattern
- `removeMapSymbol(problemSetId, symbolId)` — read-filter-write pattern
- `updateMapSymbol(problemSetId, symbolId, updates)` — read-merge-write pattern
- `addControlMeasure(problemSetId, measure)` — JSONB array append via SQL concatenation
- `removeControlMeasure(problemSetId, measureId)` — read-filter-write pattern

### API Endpoints (backend/src/api/design.ts)
- `GET /api/design/:problemSetId/map-overlay` — returns current MapOverlay JSON
- `PATCH /api/design/:problemSetId/map-overlay` — action dispatcher with 7 actions: add_symbol, move_symbol, remove_symbol, update_symbol, add_control_measure, remove_control_measure, set_overlay; returns updated MapOverlay

### Frontend Service (frontend/src/lib/map-overlay-service.ts — 7 functions)
- `getMapOverlay(problemSetId)` — GET fetch
- `addSymbol(problemSetId, symbol)` — Omit id/createdAt from input type
- `moveSymbol(problemSetId, symbolId, lat, lng)`
- `removeSymbol(problemSetId, symbolId)`
- `updateSymbol(problemSetId, symbolId, updates)`
- `addControlMeasure(problemSetId, measure)` — Omit id/createdAt from input type
- `removeControlMeasure(problemSetId, measureId)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type cast errors in API endpoint**
- **Found during:** Task 2 verification
- **Issue:** `data as MapSymbol` fails TS2352 — Record<string,unknown> doesn't overlap with MapSymbol
- **Fix:** Used `data as unknown as MapSymbol` (and same for ControlMeasure/MapOverlay) — standard TypeScript pattern for runtime-typed request bodies
- **Files modified:** backend/src/api/design.ts
- **Commit:** c84e78c4

**2. [Rule 1 - Bug] Unnecessary dynamic import in set_overlay case**
- **Found during:** Task 2 implementation
- **Issue:** Initial draft had `const { setMapOverlay } = await import('../design/design-store.js')` inside the switch case — redundant since designStore is already imported
- **Fix:** Removed dynamic import, called `designStore.setMapOverlay()` directly
- **Files modified:** backend/src/api/design.ts
- **Commit:** c84e78c4 (caught before commit)

## Self-Check: PASSED

All 6 files present. Both commits exist (edcff93d, c84e78c4). Backend TypeScript: 0. Frontend TypeScript: 0.
