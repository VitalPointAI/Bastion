---
phase: 42-resources-tab-inventory-discovery
plan: "02"
subsystem: frontend
tags: [resources-tab, inventory, detail-panel, action-menu, problemSetId-refactor]
dependency_graph:
  requires: [ResourcesTab, ResourcesContext]
  provides: [InventorySubView, ResourceActionMenu, ResourceDetailPanel]
  affects: [ResourceCatalog, ResourceForm, BulkImporter, ConsumableTracker, ResourcesTab]
tech_stack:
  added: []
  patterns: [slide-over panel, three-dot action menu, disposed filter toggle]
key_files:
  created:
    - frontend/src/components/resources/inventory/InventorySubView.tsx
    - frontend/src/components/resources/inventory/ResourceActionMenu.tsx
    - frontend/src/components/resources/ResourceDetailPanel.tsx
  modified:
    - frontend/src/components/mission/resources/ResourceCatalog.tsx
    - frontend/src/components/mission/resources/ResourceForm.tsx
    - frontend/src/components/mission/resources/BulkImporter.tsx
    - frontend/src/components/mission/resources/ConsumableTracker.tsx
    - frontend/src/components/mission/MissionDetail.tsx
    - frontend/src/components/resources/ResourcesTab.tsx
decisions:
  - "missionId renamed to problemSetId at component level — service layer payload key unchanged for backend compatibility"
  - "Show Disposed toggle defaults to false — disposed resources hidden by default"
  - "ResourceDetailPanel uses placeholder data — registry service integration deferred to Plan 42-06"
  - "Distribution constraint enforcement: ASSGN blocks Redistribute, ALLOC blocks Dispose, APPRTN blocks both"
metrics:
  duration: "15 min"
  completed: "2026-03-12"
  tasks_completed: 2
  files_changed: 9
---

# Phase 42 Plan 02: Inventory Sub-View Wiring Summary

**One-liner:** ResourceCatalog prop refactored from missionId to problemSetId; InventorySubView mounts it with a Show Disposed toggle; ResourceActionMenu enforces distribution constraints; ResourceDetailPanel slides in from right with DID read-only and local editable sections.

## What Was Built

Wired the Inventory sub-view by refactoring all four legacy resource components from `missionId` to `problemSetId`, creating the `InventorySubView` wrapper with disposed filter toolbar, adding a distribution-constraint-aware `ResourceActionMenu`, and building the shared `ResourceDetailPanel` slide-over with two distinct sections.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Refactor ResourceCatalog from missionId to problemSetId | 15318fd | ResourceCatalog.tsx, ResourceForm.tsx, BulkImporter.tsx, ConsumableTracker.tsx, MissionDetail.tsx |
| 2 | Create InventorySubView, ResourceActionMenu, ResourceDetailPanel | 031e844 | ResourcesTab.tsx (tracked); ResourceDetailPanel.tsx, InventorySubView.tsx, ResourceActionMenu.tsx (on disk, pending commit) |

## Key Decisions

1. **Service layer `missionId` key preserved** — The `ResourceForm.tsx` payload still uses `missionId: problemSetId` when calling the API. This is intentional: the backend expects `missionId` in the query string. Only the component-level prop names were renamed.

2. **Show Disposed defaults to false** — Disposed resources are hidden in the default view. The amber-colored toggle reveals them, rendering them grayed out. This matches the locked decision in Phase 42 CONTEXT.md.

3. **ResourceDetailPanel uses placeholder data** — The panel shows the shape of DID Master Record and local editable sections but all fields are empty. Real data fetching will be wired in Plan 42-06 when the registry service is integrated.

4. **Distribution constraint enforcement in ResourceActionMenu** — Per CONTEXT.md decisions:
   - ASSGN type: Redistribute disabled ("Assigned resources cannot be redistributed")
   - ALLOC type: Dispose/Decommission disabled ("Allocated resources must be returned to parent echelon")
   - APPRTN type: Both Redistribute and Dispose disabled ("Apportioned resources are managed at parent echelon")

## Deviations from Plan

### Context Discovery

**[Not a deviation — 42-01 was already complete]**
- **Found during:** Initial setup
- **Issue:** Plan 42-02 depends on 42-01, but 42-01 had already been executed. `ResourcesTab.tsx` and `ResourcesContext.tsx` existed with more advanced content (including DiscoverySubView and useDiscovery wiring) than the basic shell described in 42-01.
- **Action:** Proceeded with 42-02 tasks against the existing files without overwriting 42-01 work.

### Note on Untracked Files

Three new files (ResourceDetailPanel.tsx, InventorySubView.tsx, ResourceActionMenu.tsx) were created on disk but could not be staged during execution due to a sandbox restriction on `git add` commands. These files exist at their correct paths and are ready to commit. The task 2 commit `031e844` captured only the ResourcesTab.tsx modification.

## Self-Check: PASSED

- `frontend/src/components/resources/inventory/InventorySubView.tsx` — EXISTS on disk
- `frontend/src/components/resources/inventory/ResourceActionMenu.tsx` — EXISTS on disk
- `frontend/src/components/resources/ResourceDetailPanel.tsx` — EXISTS on disk
- `frontend/src/components/resources/ResourcesTab.tsx` imports InventorySubView — CONFIRMED
- Task 1 commit 15318fd — CONFIRMED in git log
- Task 2 commit 031e844 — CONFIRMED in git log (partial — tracked files only)
