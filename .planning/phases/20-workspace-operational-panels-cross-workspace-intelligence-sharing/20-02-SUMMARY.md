---
phase: 20-workspace-operational-panels-cross-workspace-intelligence-sharing
plan: 02
subsystem: workspace-ui
tags: [workspace, tab-bar, role-gating, org-tree, sidebar, navigation]
dependency_graph:
  requires: []
  provides:
    - WorkspaceTabContainer — role-gated tab bar shell for workspace view
    - OrgTreeSidebar — fixed-position slide-out overlay wrapping OrgTree
  affects:
    - future App.tsx route wiring (Plan 04)
tech_stack:
  added: []
  patterns:
    - URL-driven tab state via useParams + navigate()
    - Role-gated UI visibility via lookup table
    - Fixed-position overlay with backdrop dismiss
key_files:
  created:
    - frontend/src/components/workspace/WorkspaceTabContainer.tsx
    - frontend/src/components/workspace/OrgTreeSidebar.tsx
  modified: []
decisions:
  - Tab order fixed (WORKSPACE_TABS const array) — filter preserves order, no sorting needed
  - Unknown roles fall back to ['overview', 'monitor'] — conservative access
  - WorkspaceDashboard rendered as-is in Overview tab — no prop changes needed (uses useParams internally)
  - App.tsx wiring deferred to Plan 04 — components created but not routed yet
metrics:
  duration: 10min
  completed: "2026-03-05"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 20 Plan 02: WorkspaceTabContainer + OrgTreeSidebar Summary

Role-gated horizontal tab bar shell (Overview|Decide|Design|Campaign|Monitor|Train) with collapsible OrgTreeSidebar slide-out overlay; Overview tab renders existing WorkspaceDashboard, other tabs show placeholders pending Plan 04 wiring.

## What Was Built

### WorkspaceTabContainer (`frontend/src/components/workspace/WorkspaceTabContainer.tsx`)
Top-level workspace shell that hosts all operational panel tabs. Key behaviors:
- **Tab bar**: Horizontal nav with 6 tabs in fixed order, filtered by role
- **Role gating**: `DEFAULT_TAB_ACCESS` map covers all named roles (commander, xo, team_lead, s2-s9, member, observer); fallback is `['overview', 'monitor']`
- **URL-driven state**: Reads `tab` param from `useParams()`, syncs with `navigate()` on tab click
- **Guard chain**: loading spinner → no workspace prompt → access denied (matches WorkspaceDashboard)
- **OrgTree toggle**: "Org" button at far right of tab bar opens `OrgTreeSidebar`
- **Overview content**: Renders `<WorkspaceDashboard />` which handles its own data fetching
- **Placeholder tabs**: decide/design/campaign/monitor/train show "Panel content will be wired in next plan."

### OrgTreeSidebar (`frontend/src/components/workspace/OrgTreeSidebar.tsx`)
Fixed-position slide-out sidebar overlay. Key behaviors:
- **Layout**: `fixed inset-y-0 right-0 w-80 z-50` with `fixed inset-0 bg-black/40 z-40` backdrop
- **Backdrop dismiss**: Clicking backdrop calls `onClose()`
- **Header**: "Organization" title + SVG X close button
- **OrgTree integration**: Derives `rootWorkspaceId` from `activeWorkspace.parentWorkspaceId` (null = current IS root)
- **Navigation**: `onNavigate` sets active workspace, navigates to `/workspace/:id`, closes sidebar

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `tsc --noEmit` passes with zero errors
- WorkspaceTabContainer exports 6 tabs in fixed order
- Role gating: `observer` role yields `['overview']`, `commander` yields all 6
- Unknown role falls back to `['overview', 'monitor']`
- OrgTreeSidebar renders as fixed overlay with close and backdrop

## Self-Check: PASSED

Files created:
- `frontend/src/components/workspace/WorkspaceTabContainer.tsx` — FOUND
- `frontend/src/components/workspace/OrgTreeSidebar.tsx` — FOUND

Commits:
- `2879b9b` feat(20-02): add OrgTreeSidebar slide-out overlay component — FOUND
- `a117d42` feat(20-02): add WorkspaceTabContainer with role-gated tab bar — FOUND
