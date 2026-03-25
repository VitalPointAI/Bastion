---
phase: 56-visual-operational-approach-editor
plan: 05
subsystem: design
tags: [map-editor, milsymbol, symbol-picker, click-to-place, operational-approach]
dependency_graph:
  requires: [56-02]
  provides: [MapSymbolPicker component, Add Symbol toolbar button, click-to-place placement flow]
  affects:
    - frontend/src/components/design/MapSymbolPicker.tsx
    - frontend/src/components/design/OperationalApproachMapEditor.tsx
    - frontend/src/components/design/OperationalApproachMapEditor.css
tech_stack:
  added: []
  patterns:
    - Module-level SIDC_DATA_URL_CACHE Map for memoizing milsymbol toDataURL() results across renders
    - PlacementClickHandler inner component using useMapEvents + useEffect for cursor management
    - ESC key listener on window for cancelling placement mode
    - Picker panel as absolute overlay on map container (position relative wrapper)
    - Debounced (300ms) live milsymbol preview for custom SIDC input
key_files:
  created:
    - frontend/src/components/design/MapSymbolPicker.tsx
  modified:
    - frontend/src/components/design/OperationalApproachMapEditor.tsx
    - frontend/src/components/design/OperationalApproachMapEditor.css
decisions:
  - "SIDC_DATA_URL_CACHE is module-level (not component state) so catalog preview images survive picker re-mounts without recomputing"
  - "PlacementClickHandler is a separate inner component (not a hook in the parent) because useMapEvents must be inside MapContainer"
  - "Picker panel rendered outside MapContainer (inside the relative-positioned container div) so it overlays correctly without z-index conflicts with Leaflet layers"
  - "MapClickClear conditionally mounted only when not in pendingSymbol mode to prevent map background click from firing both clear and place handlers"
metrics:
  duration: 5 minutes
  completed: 2026-03-25
  tasks_completed: 2
  files_modified: 3
---

# Phase 56 Plan 05: MapSymbolPicker and Click-to-Place Symbol Placement Summary

MapSymbolPicker panel with 20 categorized MIL-STD-2525D symbols (milsymbol toDataURL previews, affiliation filter, text search, custom SIDC entry) integrated into the map editor with an Add Symbol toolbar button and click-to-place placement flow with crosshair cursor, placement banner, and ESC cancel.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create MapSymbolPicker component | 709f5112 | MapSymbolPicker.tsx, OperationalApproachMapEditor.css |
| 2 | Integrate picker into map editor with click-to-place flow | 2067fb27 | OperationalApproachMapEditor.tsx, OperationalApproachMapEditor.css |

## What Was Built

### MapSymbolPicker.tsx (215 lines)

**Props:** `onSelectSymbol(sidc, designation, affiliation)`, `onClose`

**Catalog:** 20 symbols across 4 categories:
- Land - Friendly (8): Infantry, Armor, Artillery, Aviation, Reconnaissance, Engineer, Signal, Logistics
- Land - Enemy (4): Infantry, Armor, Artillery, Air Defense
- Air - Friendly (2): Fixed Wing, Rotary Wing
- Control Measures (6): Objective, Assembly Area, Checkpoint, Engagement Area, Landing Zone, Drop Zone

**Filtering:**
- Affiliation filter buttons: All / Friendly / Enemy / Neutral — filters the catalog in-place
- Text search input — matches against symbol label and category name
- Both filters composed via `useMemo` over the COMMON_SYMBOLS array

**Symbol previews:**
- `SIDC_DATA_URL_CACHE` (module-level `Map<string, string>`) stores `ms.Symbol(sidc, { size: 32 }).toDataURL()` per SIDC
- Computed lazily on first access, persists across component re-mounts
- Each symbol card: 32px `<img src={dataUrl}>` + label text, 2-column grid layout

**Custom SIDC entry:**
- Text input for raw SIDC (up to 20 chars) with optional designation field
- 300ms debounced live preview using `ms.Symbol(sidc, { size: 40 }).toDataURL()`
- "Place Custom Symbol" button calls `onSelectSymbol` with derived affiliation from SIDC[1]

**CSS (added to OperationalApproachMapEditor.css):**
- `.symbol-picker` — absolute right panel, 280px wide, z-index 1000, overflow-y auto
- `.symbol-grid` — 2-column CSS grid
- `.symbol-card` — flex row with hover bg, transparent border that shows on hover
- `.symbol-picker-filter-btn` / `--active` — affiliation filter pills
- `.placement-banner` — absolute centered top, with box-shadow, pointer-events: all

### OperationalApproachMapEditor.tsx (changes)

**New state:**
- `showPicker: boolean` — controls picker panel visibility
- `pendingSymbol: { sidc, designation, affiliation } | null` — symbol awaiting click placement

**New inner component — `PlacementClickHandler`:**
- Uses `useMapEvents({ click })` to listen for map clicks (must be inside MapContainer)
- `useEffect` on `map.getContainer()` applies/removes `cursor: crosshair` based on `pendingSymbol` prop

**ESC key handler:**
- `useEffect` on `window` `keydown` event — sets `pendingSymbol(null)` and `showPicker(false)` on ESC

**`handlePlaceSymbol`:**
- Calls `mapOverlayService.addSymbol(problemSetId, { sidc, designation, affiliation, lat, lng, createdBy: 'user' })`
- Clears `pendingSymbol` in finally block regardless of success/failure

**Toolbar:**
- `<div className="map-editor-toolbar">` above map with "+ Add Symbol" button
- Button highlights blue (`map-editor-btn--primary`) when picker is open

**Picker integration:**
- `MapSymbolPicker` rendered inside the `position: relative` map container div
- `onSelectSymbol` callback: sets `pendingSymbol`, closes picker
- `onClose` callback: clears `showPicker`

**Placement banner:**
- Rendered inside the map container div (above map via `z-index: 1001`)
- Shows "Click on the map to place [designation]" with Cancel button

## Deviations from Plan

None — plan executed exactly as written. Minor implementation choices:
- `MapClickClear` is conditionally mounted (`{!pendingSymbol && <MapClickClear ...>}`) to avoid both deselect and place handlers firing on the same click — the plan didn't specify this but it's required for correct behavior.

## Self-Check: PASSED
