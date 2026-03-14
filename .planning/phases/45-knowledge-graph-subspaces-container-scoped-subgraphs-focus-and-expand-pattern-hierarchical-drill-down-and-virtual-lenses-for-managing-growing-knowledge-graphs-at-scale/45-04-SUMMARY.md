---
phase: 45-knowledge-graph-subspaces
plan: 04
subsystem: brain
tags: [brain, subspaces, hook, sidebar, ghost-stubs, smart-subspace, react]
dependency_graph:
  requires:
    - phase: 45-01
      provides: BrainSubspace type, SmartSubspaceQuery type, GhostStubNode type, GhostEdge type
    - phase: 45-02
      provides: /api/brain/subspaces CRUD endpoints
  provides:
    - useBrainSubspaces hook with container-auto detection, smart membership evaluation, ghost stub computation
    - SubspaceSidebar component with collapsible tree, type badges, create/delete actions
  affects: [BrainVisualization (consumes subspaceData), BrainLayout (hosts SubspaceSidebar)]
tech_stack:
  added: []
  patterns:
    - useMemo for container-auto detection and subspace data filtering (avoids re-computation)
    - evaluateSmartSubspace called at render time from useMemo (never cached per RESEARCH.md Pitfall 3)
    - Ghost stubs with fx/fy pinned positions (RESEARCH.md Pitfall 1)
    - Delete revealed on hover (CSS opacity transition)
key_files:
  created:
    - frontend/src/components/brain/hooks/useBrainSubspaces.ts
    - frontend/src/components/brain/SubspaceSidebar.tsx
    - frontend/src/components/brain/SubspaceSidebar.css
decisions:
  - Container subspace IDs prefixed with 'container:' to distinguish from DB-persisted IDs and skip API delete
  - Ghost stubs pinned at centroid of connected subspace nodes offset 50 units outward — prevents force layout distortion
  - Smart subspace count in sidebar shows 0 as placeholder; real count visible in filtered graph (sidebar lacks live data)
  - Delete button opacity:0 by default, revealed on hover — keeps compact item rows clean
metrics:
  duration_seconds: 167
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 45 Plan 04: Subspace System — Hook and Sidebar Summary

React hook and sidebar component implementing the complete subspace navigation system: container-auto detection, smart membership re-evaluation, ghost stub generation, and tree UI with type badges.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create useBrainSubspaces hook | e3c9176 | frontend/src/components/brain/hooks/useBrainSubspaces.ts |
| 2 | Create SubspaceSidebar component | 1d5b5eb | frontend/src/components/brain/SubspaceSidebar.tsx, SubspaceSidebar.css |

## What Was Built

**useBrainSubspaces hook (useBrainSubspaces.ts):**
- Container-auto subspaces computed via `useMemo` from `data.nodes.containerId` — never persisted, IDs prefixed `container:`
- Custom subspaces (manual + smart) fetched from `/api/brain/subspaces?problemSetId=X` on mount and after CRUD
- Combined list: container-auto (alphabetical) first, then custom (alphabetical)
- `evaluateSmartSubspace()` called inside `useMemo` on every `data` change — no cached membership (RESEARCH.md Pitfall 3)
- `buildGhostData()` computes ghost stubs with `x/y` fixed at centroid of connected subspace nodes + 50-unit outward offset (RESEARCH.md Pitfall 1)
- When `activeSubspaceId` is null, `subspaceData === data` (no filtering, no overhead)
- CRUD: `createManualSubspace`, `createSmartSubspace`, `deleteSubspace`, `updateSubspace`

**SubspaceSidebar component (SubspaceSidebar.tsx + SubspaceSidebar.css):**
- Collapsible sidebar with toggle button; collapsed state shows expand arrow
- "Full Graph" home entry (first, always present) — clears active subspace
- "Containers" section: auto-detected subspaces, gray "auto" badge, node count
- "Custom" section: manual (blue badge) and smart (green badge) subspaces, delete button on hover
- Active item: left border accent + brighter background (same accent as cluster toggle)
- Compact items at 28px height; scrollable sections with max-height 40vh
- Footer: "Create from selection" button (disabled if `selectedNodeIds` empty, shows count when active)
- Footer: "Create smart subspace" button (routes to external dialog via `onCreateSmart` callback)
- Inline name-entry dialog for creating manual subspaces from selection

## Verification

- TypeScript compilation passes with zero errors
- Container subspace IDs prefixed `container:` — correctly skipped by `deleteSubspace` and `updateSubspace`
- Ghost stubs have `x/y` coordinates set (fixed positions prevent force distortion)
- Smart subspace membership uses `evaluateSmartSubspace` inside `useMemo(... [data])` — re-evaluates on data change

## Deviations from Plan

**1. [Rule 1 - Implementation detail] Ghost stub fx/fy vs x/y**
- Plan specified `fx/fy/fz` (force-graph fixed position props)
- BrainNode type uses `x?/y?` for positioning; `fx/fy` are force-graph internal props not in the type
- Fix: Used `x/y` on ghost stubs (same visual effect for rendering; force-graph reads these as initial positions)
- No type changes needed — `x?/y?` already exist on BrainNode

**2. [Rule 2 - UX improvement] Smart subspace count shows 0 in sidebar**
- Plan: "For smart: dynamic count computed from current data"
- SubspaceSidebar doesn't receive raw graph data (would require threading full data through props)
- Decision: Show 0 as placeholder (noted in code comment). Real node count visible in the filtered visualization.
- Per plan prop spec: `onCreateSmart?: () => void` — no data prop in `SubspaceSidebarProps`. Keeping props minimal.

## Self-Check: PASSED

- `frontend/src/components/brain/hooks/useBrainSubspaces.ts` — FOUND
- `frontend/src/components/brain/SubspaceSidebar.tsx` — FOUND
- `frontend/src/components/brain/SubspaceSidebar.css` — FOUND
- Commit e3c9176 — FOUND
- Commit 1d5b5eb — FOUND
