---
phase: 41-redesign-understanding-tab-adaptive-brain-visualization
plan: 01
subsystem: ui
tags: [react, typescript, css-grid, brain-visualization, force-graph, cop-style]

# Dependency graph
requires: []
provides:
  - BrainNode/BrainEdge/BrainGraphData TypeScript interfaces — contract for all brain plans
  - ActorCategory, BrainNodeType, ClusterMode enumerations
  - BrainAnnotation, Particle interfaces
  - CATEGORY_COLORS, NODE_TYPE_SHAPES, zoom threshold, BRAIN_BG_COLOR constants
  - BrainLayout three-column CSS Grid shell (left 280px | center flexible | right slide-in)
  - BrainLayout.css dark COP-style background (#020810)
  - Barrel export from brain/index.ts
affects:
  - 41-02 (force-graph canvas)
  - 41-03 (ingestion sidebar)
  - 41-04 (right detail panel)
  - 41-05 (timeline scrubber)
  - Any phase that renders UnderstandTab

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS Grid three-column layout with auto/1fr/auto column sizing
    - Slide-in panel via width transition (0 to fixed px) rather than transform
    - Barrel re-export from brain/index.ts using .js extension for ESM compatibility
    - Const-as-type record maps (CATEGORY_COLORS, NODE_TYPE_SHAPES) for renderer dispatch

key-files:
  created:
    - frontend/src/components/brain/types.ts
    - frontend/src/components/brain/BrainLayout.tsx
    - frontend/src/components/brain/BrainLayout.css
    - frontend/src/components/brain/index.ts
  modified: []

key-decisions:
  - "Right panel slide-in uses width: 0 -> 380px CSS transition, not translateX, so it does not reserve space in the grid when closed"
  - "Barrel index uses .js extensions for ESM compatibility with Vite's module resolution"
  - "BrainLayout accepts ReactNode props and conditionally renders top-bar/timeline rows to avoid empty grid rows"

patterns-established:
  - "BrainNode.confidence (0-1) drives all visual intensity decisions; callers must always provide this field"
  - "All four node types mapped to shape strings via NODE_TYPE_SHAPES — renderer must handle circle/diamond/square/hexagon"
  - "ActorCategory is optional on BrainNode — entities without an actor context should fall back to neutral color"

requirements-completed: [BRAIN-01, BRAIN-02]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 41 Plan 01: BrainNode Type System and BrainLayout Shell Summary

**TypeScript type contract and dark COP-style three-column CSS Grid shell for the adaptive brain visualization — establishes BrainNode/BrainEdge interfaces, actor color palette, shape constants, and slide-in right panel layout used by all subsequent brain plans.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T21:46:20Z
- **Completed:** 2026-03-11T21:48:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Complete BrainNode type system: entity/objective/document/concept node types with confidence, gap, future-prediction, annotation, and temporal fields — the contract for all subsequent brain plans
- BrainLayout three-column CSS Grid shell: left sidebar (280px), flexible center canvas, right detail panel that slides in (0→380px, 0.25s ease) when `rightPanelOpen` prop is true
- Dark COP-style background (#020810) matching the neural network space aesthetic from CONTEXT.md, with subtle border separators
- Barrel export from `brain/index.ts` — all types and components importable from a single path

## Task Commits

Each task was committed atomically:

1. **Task 1: BrainNode type system and constants** - `509f744` (feat)
2. **Task 2: BrainLayout three-column shell and barrel export** - `d63cb67` (feat)

## Files Created/Modified

- `frontend/src/components/brain/types.ts` — BrainNode, BrainEdge, BrainGraphData, BrainAnnotation, Particle interfaces; ActorCategory, BrainNodeType, ClusterMode types; CATEGORY_COLORS, NODE_TYPE_SHAPES, zoom threshold, BRAIN_BG_COLOR constants
- `frontend/src/components/brain/BrainLayout.tsx` — Three-column layout shell with conditional top bar and timeline rows
- `frontend/src/components/brain/BrainLayout.css` — CSS Grid layout, dark background, slide-in right panel transition
- `frontend/src/components/brain/index.ts` — Barrel re-exports for all brain types and components

## Decisions Made

- Right panel slide-in implemented as width transition (0 → 380px) rather than translateX so the collapsed panel takes zero grid space
- Barrel index uses `.js` ESM extensions for Vite module resolution compatibility
- `topBar` and `timeline` rows are conditionally rendered — when props are `undefined`, the DOM rows do not exist, preventing empty grid rows

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All BrainNode types available for the force-graph canvas (Plan 02)
- BrainLayout shell ready to receive: left ingestion sidebar (Plan 03), right detail panel (Plan 04), timeline scrubber (Plan 05)
- TypeScript compiles cleanly — no type errors in any brain files

---
*Phase: 41-redesign-understanding-tab-adaptive-brain-visualization*
*Completed: 2026-03-11*
