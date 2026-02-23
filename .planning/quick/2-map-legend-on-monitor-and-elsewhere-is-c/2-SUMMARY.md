---
phase: quick-2
plan: 01
subsystem: ui
tags: [css, leaflet, react-force-graph, legend, overflow, scrollbar]

# Dependency graph
requires:
  - phase: 4.3-strategic-intelligence-fusion
    provides: ValidityMap and GraphExplorer components with legends
provides:
  - Map legend (bottom-left) on /monitor fully visible without bottom clipping
  - Graph legend (top-right) fully visible in all view modes (map, graph, split)
  - Both legends scroll internally with thin styled scrollbar
affects: [monitor-tab, validity-map, graph-explorer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container-relative max-height (calc(100% - Npx)) instead of viewport-relative (vh) for absolutely-positioned overlays inside overflow:hidden containers"
    - "scrollbar-width/scrollbar-color + ::-webkit-scrollbar rules for cross-browser thin scrollbar styling"
    - "pointer-events: auto on legend overlays to allow scroll interaction (was blocking scroll with pointer-events: none)"

key-files:
  created: []
  modified:
    - frontend/src/components/validity/ValidityMap.css
    - frontend/src/components/graph/GraphExplorer.css

key-decisions:
  - "Use calc(100% - 50px) for ValidityMap legend max-height: 20px bottom offset + 30px top clearance prevents both bottom clipping and top overflow"
  - "Use calc(100% - 32px) for GraphExplorer legend max-height: accounts for 16px top position + 16px bottom clearance"
  - "Changed pointer-events from none to auto on .graph-legend so users can scroll the legend when content overflows"

patterns-established:
  - "Absolutely-positioned overlays inside overflow:hidden containers must use container-relative heights (calc(100% - N)) not viewport-relative heights (vh) to prevent clipping"

requirements-completed: [QUICK-2]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Quick Task 2: Map Legend Clipping Fix Summary

**CSS-only fix for legend clipping in ValidityMap and GraphExplorer: container-relative max-height, scrollable overflow, and thin styled scrollbars**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T12:22:11Z
- **Completed:** 2026-02-23T12:23:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Fixed ValidityMap legend (`bottom: 20px; left: 20px`) clipping by changing `max-height: calc(100% - 80px)` to `calc(100% - 50px)` — properly accounts for 20px bottom offset plus 30px top clearance
- Fixed GraphExplorer legend (`top: 16px; right: 16px`) clipping by replacing viewport-relative `max-height: 50vh` with container-relative `calc(100% - 32px)` — prevents clipping in split view (half height) and short containers
- Added thin scrollbar styling to both legends (Firefox scrollbar-width/scrollbar-color, Chromium ::-webkit-scrollbar) for usable scroll interaction when content overflows
- Changed GraphExplorer legend `pointer-events` from `none` to `auto` to allow user scroll interaction

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix ValidityMap legend clipping** - `8199677` (fix)
2. **Task 2: Fix GraphExplorer legend clipping** - `8e90da0` (fix)

## Files Created/Modified

- `frontend/src/components/validity/ValidityMap.css` - Fixed map legend max-height and added thin scrollbar rules
- `frontend/src/components/graph/GraphExplorer.css` - Fixed graph legend max-height, enabled pointer-events, added thin scrollbar rules

## Decisions Made

- **Container-relative vs viewport-relative heights:** Used `calc(100% - Npx)` relative to the container (not `vh`) so the legend stays within bounds regardless of view mode (map/graph/split) or browser size
- **pointer-events change:** Removed `pointer-events: none` from `.graph-legend` — the original value prevented mouse scroll events from reaching the legend element, making overflow inaccessible even when present
- **50px vs 40px margin for ValidityMap:** Used 50px (20px bottom position + 30px top clearance) instead of 40px to leave comfortable space at top edge, preventing the legend from butting against the container top boundary

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward CSS changes with no side effects.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Map and graph legends are now fully visible without clipping in all view modes on /monitor
- Legends gain an internal thin scrollbar when content overflows the container, preventing data from being hidden
- No build changes required — pure CSS fix, works immediately

---
*Phase: quick-2*
*Completed: 2026-02-23*
