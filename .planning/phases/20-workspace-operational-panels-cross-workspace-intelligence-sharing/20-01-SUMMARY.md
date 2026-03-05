---
phase: 20-workspace-operational-panels-cross-workspace-intelligence-sharing
plan: "01"
subsystem: frontend-routing
tags: [routing, navigation, workspace-first, components]
dependency_graph:
  requires: []
  provides: [workspace-selector-landing, workspace-breadcrumb-header, workspace-first-routing]
  affects: [frontend/src/App.tsx, header-navigation, post-login-flow]
tech_stack:
  added: []
  patterns: [workspace-first-navigation, two-column-selector-layout, conditional-header-component]
key_files:
  created:
    - frontend/src/components/workspace/WorkspaceSelector.tsx
    - frontend/src/components/workspace/WorkspaceBreadcrumb.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/workspace/InviteAcceptPage.tsx
key_decisions:
  - "Root route / renders WorkspaceSelector (not redirect to /monitor)"
  - "Old panel routes redirect to / via Navigate component"
  - "WorkspaceBreadcrumb conditionally renders null when not on /workspace/* routes"
  - "InviteAcceptPage navigate('/monitor') calls updated to navigate('/')"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-05"
  tasks_completed: 2
  files_changed: 4
---

# Phase 20 Plan 01: Workspace-First Routing Foundation Summary

Workspace-first routing established: WorkspaceSelector landing page with OrgTree hierarchy + detail card panel, WorkspaceBreadcrumb header identity, App.tsx restructured to eliminate top-level panel tab navigation.

## What Was Built

**WorkspaceSelector** — Post-login landing page replacing the old monitor tab as the default view. Two-column layout: OrgTree hierarchy on left, workspace detail card (name, type badge, classification badge, member count, role, "Enter Workspace" button) on right. Handles loading, no-memberships (CTA to CreateWorkspaceWizard), and multi-membership cases.

**WorkspaceBreadcrumb** — Compact header component showing active workspace type prefix, name (truncated to 20 chars), and classification badge. Renders only when activeWorkspace is non-null and pathname starts with /workspace/. Returns null otherwise.

**App.tsx restructuring** — Removed MAIN_TABS constant, activeTab derivation, and all top-level nav buttons. Header now shows: BASTION logo + WorkspaceBreadcrumb + WorkspaceSwitcher + Admin. Root route / renders WorkspaceSelector. Old panel routes redirect to /. Removed imports for DecideTab, DesignTab, CampaignTab, MonitorTab, ExerciseDashboard.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8038463 | feat(20-01): add WorkspaceSelector landing page and WorkspaceBreadcrumb |
| 2 | 5d5d1cf | feat(20-01): restructure App.tsx routing to workspace-first navigation |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated navigate('/monitor') in InviteAcceptPage.tsx**
- **Found during:** Task 2 (routing audit)
- **Issue:** InviteAcceptPage had 6 navigate('/monitor') calls that would break under new routing
- **Fix:** Updated all InviteAcceptPage navigate calls from /monitor to /
- **Files modified:** frontend/src/components/workspace/InviteAcceptPage.tsx
- **Commit:** 5d5d1cf

## Self-Check: PASSED
