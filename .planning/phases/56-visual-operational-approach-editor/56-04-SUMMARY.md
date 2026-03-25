---
phase: 56-visual-operational-approach-editor
plan: 04
subsystem: design-ui
tags: [yjs, collaborative, real-time, map-overlay, mil-std-2525, websocket-bridge]

requires:
  - phase: 56-02
    provides: OperationalApproachMapEditor component, MapOverlay/MapSymbol/ControlMeasure types, map-overlay-service
  - phase: 56-03
    provides: Ironclaw map tool handlers publishing design.map_updated WebSocket events
  - phase: 55-06
    provides: useDesignInterview hook with Yjs design-interview-{problemSetId} document

provides:
  - Y.Map('mapSymbols') and Y.Map('controlMeasures') on existing design-interview Yjs document
  - Real-time map overlay sync for all connected clients via Yjs CRDT merge semantics
  - getMap exposed from useDesignInterview for consumers to access Yjs doc maps
  - Ironclaw WebSocket event bridge into Yjs via design:map_updated window CustomEvent
  - Optimistic Yjs writes with API revert on failure for all map mutations

affects: [operational-approach-map, design-tab, ironclaw-integration, yjs-collab]

tech-stack:
  added: []
  patterns:
    - "Map overlay mutations: write to Yjs Y.Map first (real-time), then API (persistence)"
    - "Y.Map.observe callbacks update React state arrays for rendering"
    - "Seed Y.Maps from initial mapOverlay prop only when empty (first client from DB)"
    - "Bridge Ironclaw WebSocket events into Yjs via window.addEventListener('design:map_updated')"
    - "useDesignInterview reused in map editor with same problemSetId to share Yjs doc"
    - "Optimistic Yjs writes reverted on API failure (set original value back)"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useDesignInterview.ts
    - frontend/src/components/design/OperationalApproachMapEditor.tsx

key-decisions:
  - "Reuse existing design-interview Yjs document via useDesignInterview hook — no new WebSocket connection"
  - "Y.Map keyed by symbol/measure ID (not Y.Array) for conflict-free concurrent edits"
  - "API-first for addSymbol/addControlMeasure (server generates authoritative ID) then sync into Yjs; Yjs-first for move/update/delete (no ID generation needed)"
  - "Ironclaw bridge uses window CustomEvent 'design:map_updated' — decoupled from useIronclaw hook"
  - "prevSymbolsRef/prevMeasuresRef guard prevents infinite onOverlayChange loops"

requirements-completed: [MAP-05]

duration: 8min
completed: 2026-03-25
---

# Phase 56 Plan 04: Yjs Collaborative Map Sync Summary

**Yjs Y.Map sync wired into OperationalApproachMapEditor — map overlay changes from Ironclaw AI tools and direct manipulation propagate in real-time to all connected clients via the existing design-interview Yjs document**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T13:24:00Z
- **Completed:** 2026-03-25T13:32:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Exposed `getMap` in `useDesignInterview` return value so consumers can access additional Y.Maps on the shared design-interview document
- Created `Y.Map<MapSymbol>('mapSymbols')` and `Y.Map<ControlMeasure>('controlMeasures')` on the existing Yjs document — no new WebSocket connections
- Seeded Y.Maps from `mapOverlay` prop on first connect (when empty)
- Wired `Y.Map.observe` callbacks to update React `symbols` and `controlMeasures` state for real-time rendering
- Updated all mutation callbacks to write to Yjs first, then persist via API:
  - `handleSymbolDragEnd` — Yjs set then API moveSymbol
  - `handlePlaceSymbol` — API addSymbol then sync authoritative IDs into Yjs
  - `handleDrawFormSubmit` — API addControlMeasure then sync into Yjs
  - `SymbolEditPanel.handleSave` — Yjs optimistic set then API updateSymbol
  - `SymbolEditPanel.handleDelete` — Yjs optimistic delete then API removeSymbol
- All Yjs optimistic writes reverted on API failure
- Bridged Ironclaw `design:map_updated` window CustomEvents into Yjs for real-time display of AI staff officer map edits
- Render uses `symbols`/`controlMeasures` Yjs-backed state instead of `mapOverlay` prop directly
- Parent `onOverlayChange` kept in sync via `prevSymbolsRef`/`prevMeasuresRef` guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Yjs Y.Map sync to the map editor for real-time collaborative editing** - `f95b127b` (feat)

## Files Created/Modified

- `frontend/src/hooks/useDesignInterview.ts` — Added `getMap` to `UseDesignInterviewResult` interface and exposed in return value
- `frontend/src/components/design/OperationalApproachMapEditor.tsx` — Full Yjs sync wiring: Y.Map creation, seeding, observers, Ironclaw event bridge, mutation rewrites, Yjs-aware SymbolEditPanel

## Decisions Made

- Reuse existing design-interview Yjs document via `useDesignInterview` hook — calling the hook with the same `problemSetId` attaches to the same Yjs WebSocket document without opening a new connection
- Y.Map keyed by symbol/measure ID (not Y.Array) for conflict-free concurrent edits per RESEARCH.md Pitfall 6
- API-first for `addSymbol`/`addControlMeasure` because server generates the authoritative UUID; Yjs-first for `move`/`update`/`delete` because no ID generation is needed
- Ironclaw bridge decoupled via window CustomEvent `design:map_updated` — clean separation from `useIronclaw` hook internals

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Added optimistic revert on API failure**
- **Found during:** Task 1
- **Issue:** Plan showed optimistic Yjs writes but did not mention reverting them on API failure
- **Fix:** Added revert (re-set or re-delete) for all optimistic Yjs writes when the API call throws
- **Files modified:** `OperationalApproachMapEditor.tsx`, `SymbolEditPanel`
- **Commit:** f95b127b

**2. [Rule 2 - Missing Critical Functionality] Added prevRef guard for onOverlayChange**
- **Found during:** Task 1
- **Issue:** Naive `useEffect([symbols, controlMeasures])` calling `onOverlayChange` would fire on every render and could cause infinite update loops
- **Fix:** Added `prevSymbolsRef`/`prevMeasuresRef` to only call `onOverlayChange` when arrays genuinely change identity
- **Files modified:** `OperationalApproachMapEditor.tsx`
- **Commit:** f95b127b

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three building blocks of the dual-mode editing experience are now complete:
  1. Plan 56-01: DB schema, API endpoints, frontend types and service layer
  2. Plan 56-02: Interactive map editor component (Plan 05 added symbol picker)
  3. Plan 56-03: Ironclaw MCP tools with WebSocket push
  4. Plan 56-04: Yjs real-time collaborative sync
- Multiple users can now edit the operational approach map simultaneously with conflict-free CRDT merging
- Ironclaw AI staff officer map edits appear instantly for all viewers without polling or page refresh

---
*Phase: 56-visual-operational-approach-editor*
*Completed: 2026-03-25*
