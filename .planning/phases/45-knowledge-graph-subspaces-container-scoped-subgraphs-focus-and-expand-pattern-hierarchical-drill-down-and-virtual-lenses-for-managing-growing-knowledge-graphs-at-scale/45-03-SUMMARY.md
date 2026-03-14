---
phase: 45-knowledge-graph-subspaces
plan: 03
subsystem: brain
tags: [lens, virtual-lens, brain-visualization, hooks, react, ui, dropdown]
dependency_graph:
  requires: ["45-01"]
  provides: [useBrainLens hook, LensSelector component, built-in lens presets (J2/J3/J5/Overview)]
  affects: [BrainController, BrainToolbar, brain visualization filtering, cluster mode]
tech_stack:
  added: []
  patterns: [controlled component, hook-in-hook avoidance, clusterMode change detection via ref]
key_files:
  created:
    - frontend/src/components/brain/hooks/useBrainLens.ts
    - frontend/src/components/brain/LensSelector.tsx
    - frontend/src/components/brain/LensSelector.css
  modified: []
decisions:
  - useBrainLens does NOT call useBrainClustering internally — exposes activeLens.clusterMode for the controller to pass to useBrainClustering (avoids hook-in-hook dependency)
  - clusterModeChanged boolean flag exposed on hook return so controller can conditionally call d3ReheatSimulation() only when clusterMode changes between lens switches
  - LensSelector is fully controlled — no internal lens state, all state comes via props
  - Role badge color-coding: J2=red (adversary focus), J3=blue (allied focus), J5=green (plans/objectives), Overview=gray
metrics:
  duration_seconds: 138
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 45 Plan 03: Virtual Lens System — Hook and UI Summary

useBrainLens hook with 4 built-in role-based presets (J2 Intel, J3 Ops, J5 Plans, Overview) and LensSelector dropdown replacing the cluster mode toggle buttons in BrainToolbar.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create useBrainLens hook with built-in lens presets and node filtering | d80caef | frontend/src/components/brain/hooks/useBrainLens.ts |
| 2 | Create LensSelector dropdown UI component and CSS | 01dc154 | frontend/src/components/brain/LensSelector.tsx, LensSelector.css |

## What Was Built

**useBrainLens hook (hooks/useBrainLens.ts):**
- 4 built-in lenses defined at module level as constants (never persisted):
  - `builtin:overview` — Overview, container clustering, all nodes visible, gap nodes on
  - `builtin:j2` — J2 Intel, container clustering, entity nodes only, adversary+neutral actors, confidence overlay on
  - `builtin:j3` — J3 Ops, container clustering, entity nodes only, ally+partner actors
  - `builtin:j5` — J5 Plans, DIME clustering, objective+concept nodes only
- `activeLens` defaults to Overview on mount
- `allLenses` = BUILTIN_LENSES + fetched custom lenses from `/api/brain/lenses?problemSetId=X`
- `applyLensFilters(nodes)` — filters by nodeTypeFilters, actorCategoryFilters, showGapNodes; empty arrays = show all
- `saveLens` / `deleteLens` / `cloneLens` — call backend API and refetch the lens list
- `clusterModeChanged` boolean flag for controller to trigger d3 reheat only when mode actually changes (per RESEARCH.md Pitfall 5)
- Does NOT call useBrainClustering internally — exposes `activeLens.clusterMode` for the controller

**LensSelector component (LensSelector.tsx + LensSelector.css):**
- Controlled component: all lens state via props from BrainController
- Dropdown trigger button: lens icon + active lens name + role badge (J2/J3/J5/ALL) + caret
- Trigger shows open state with blue accent color matching cluster-toggle-btn.active
- Built-in section: 4 role lenses, each with color-coded role badge
- Custom section: user-owned lenses with hover-revealed clone (⎘) and delete (✕) action buttons
- Footer: "Save current as lens" and "Clone active lens" actions
- CSS: dark theme matching BrainToolbar.css conventions (rgba(2,8,16) backgrounds, rgba(74,158,255) accent)
- Keyboard accessible: Enter/Space toggles open, Escape closes
- Closes on outside click via document mousedown listener

## Verification

- TypeScript compilation passes with zero errors (npx tsc --noEmit) — both tasks verified
- useBrainLens exports hook with correct return shape (activeLens, allLenses, setActiveLensId, saveLens, deleteLens, cloneLens, applyLensFilters, clusterModeChanged)
- LensSelector is a controlled component — no internal lens state
- All 4 built-in lenses present: Overview (ALL), J2 Intel (J2), J3 Ops (J3), J5 Plans (J5)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `frontend/src/components/brain/hooks/useBrainLens.ts` — FOUND
- `frontend/src/components/brain/LensSelector.tsx` — FOUND
- `frontend/src/components/brain/LensSelector.css` — FOUND
- Commit d80caef — FOUND (feat(45-03): create useBrainLens hook)
- Commit 01dc154 — FOUND (feat(45-03): create LensSelector dropdown UI component)
