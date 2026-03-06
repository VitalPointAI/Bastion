---
phase: 23-problem-set-model-workspace-rename-inserted
plan: 08
subsystem: frontend
tags: [rename, routing, cleanup, problem-set]
dependency_graph:
  requires: [23-06, 23-07]
  provides: [complete-frontend-rename, problem-set-routing, backward-compat-redirect]
  affects: [frontend-routing, frontend-context, frontend-services]
tech_stack:
  added: []
  patterns: [backward-compat-redirect, wire-format-mapping]
key_files:
  created:
    - frontend/src/components/problem-set/ProblemSetSwitcher.tsx
    - frontend/src/components/problem-set/ProblemSetBreadcrumb.tsx
    - frontend/src/components/problem-set/ProblemSetDashboard.tsx
    - frontend/src/components/problem-set/ProblemSetInviteModal.tsx
    - frontend/src/components/problem-set/ProblemSetMemberManager.tsx
    - frontend/src/components/problem-set/ProblemSetTabContainer.tsx
    - frontend/src/components/problem-set/CreateProblemSetWizard.tsx
    - frontend/src/components/problem-set/CreateProblemSetWizard.css
    - frontend/src/components/problem-set/ProblemSetSwitcher.css
    - frontend/src/components/problem-set/CrossProblemSetLayerToggle.tsx
    - frontend/src/components/problem-set/OrgTree.tsx
    - frontend/src/components/problem-set/OrgTreeSidebar.tsx
    - frontend/src/components/problem-set/ActivityFeed.tsx
    - frontend/src/components/problem-set/CommanderPanel.tsx
    - frontend/src/components/problem-set/CompartmentManager.tsx
    - frontend/src/components/problem-set/EscalationPanel.tsx
    - frontend/src/components/problem-set/InviteAcceptPage.tsx
    - frontend/src/components/problem-set/MemberDirectory.tsx
    - frontend/src/components/problem-set/NotificationBadge.tsx
    - frontend/src/components/problem-set/ObserverPanel.tsx
    - frontend/src/components/problem-set/StaffPanel.tsx
    - frontend/src/components/problem-set/SubscriptionManager.tsx
    - frontend/src/components/problem-set/TabNotificationDropdown.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/cop/COPTab.tsx
    - frontend/src/components/cop/COPMapView.tsx
    - frontend/src/components/cop/COPAgentActivity.tsx
    - frontend/src/components/tabs/DecideTab.tsx
    - frontend/src/components/tabs/DesignTab.tsx
    - frontend/src/components/tabs/CampaignTab.tsx
    - frontend/src/components/tabs/MonitorTab.tsx
    - frontend/src/components/tabs/TrainTab.tsx
    - frontend/src/components/strategic/StrategicDashboard.tsx
    - frontend/src/components/strategic/DocumentList.tsx
    - frontend/src/components/strategic/DocumentUpload.tsx
    - frontend/src/components/validity/StrategicValidityDashboard.tsx
    - frontend/src/components/validity/ValidityMap.tsx
    - frontend/src/components/graph/GraphExplorer.tsx
    - frontend/src/components/mission/wizard/MissionWizard.tsx
    - frontend/src/components/mission/wizard/steps/NameStep.tsx
    - frontend/src/components/mission/wizard/steps/ReviewStep.tsx
    - frontend/src/lib/cop-service.ts
    - frontend/src/lib/strategic-service.ts
    - frontend/src/lib/mission-service.ts
    - frontend/src/types/cop.ts
    - frontend/src/context/ModeContext.tsx
  deleted:
    - frontend/src/lib/workspace-service.ts
    - frontend/src/context/WorkspaceContext.tsx
decisions:
  - Wire-format fields (types matching backend JSON) kept as workspaceId with comments noting future rename
  - Service methods accept problemSetId params but map to workspaceId in query strings/bodies for backend compat
  - CreateProblemSetWizard manually rewritten with echelon model instead of automated rename
metrics:
  duration: 19 min
  completed: "2026-03-06T03:15:00Z"
---

# Phase 23 Plan 08: Frontend Routing, Cross-Cutting Rename & Cleanup Summary

Complete frontend rename from workspace to problem set terminology: App.tsx routing with /problem-set/* routes, backward-compat /workspace/* redirect, 24 problem-set components created, 21 cross-cutting files updated, old workspace files deleted, frontend compiles cleanly.

## Tasks Completed

### Task 1: Update App.tsx routing and provider (1f7be8b)
- Rewrote App.tsx with /problem-set/* routes and ProblemSetProvider
- Created WorkspaceRedirect component for backward-compat /workspace/* -> /problem-set/* redirect
- Created 24 problem-set components (deviation from plan - see below)
- CreateProblemSetWizard manually rewritten with echelon (strategic/operational/tactical) instead of workspace type

### Task 2: Update all remaining frontend files and clean up old files (5b14e34)
- Updated 3 COP components to use problemSetId props and ProblemSetContext
- Updated 5 tab components (Decide, Design, Campaign, Monitor, Train)
- Updated 3 strategic components and strategic-service
- Updated validity components (StrategicValidityDashboard, ValidityMap) with renamed variables
- Updated GraphExplorer, MissionWizard, and mission-service
- Updated cop-service with problemSetId params mapped to workspaceId in API calls
- Deleted workspace-service.ts and WorkspaceContext.tsx
- Frontend compiles with zero errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created problem-set components inline (Plan 07 dependency)**
- **Found during:** Task 1
- **Issue:** Plan 07 (component rename) was listed as completed but only ProblemSetSelector.tsx existed. The other 23 components were missing.
- **Fix:** Created all 24 problem-set component files using automated rename script + manual fixes for broken identifiers + manual rewrite of CreateProblemSetWizard
- **Files created:** 24 files in frontend/src/components/problem-set/
- **Commit:** 1f7be8b

**2. [Rule 1 - Bug] Fixed broken identifiers from aggressive string replacement**
- **Found during:** Task 1
- **Issue:** Automated workspace->problem-set rename created broken identifiers (e.g., "problem setService", "Problem SetType", "problem set_created")
- **Fix:** Created fix-problem-set-renames.cjs script to fix ~60 broken identifier patterns across all files
- **Files modified:** All 24 problem-set component files
- **Commit:** 1f7be8b

**3. [Rule 2 - Missing Critical] Wire-format mapping for backend compatibility**
- **Found during:** Task 2
- **Issue:** Service files (cop-service, strategic-service, mission-service) needed to keep workspaceId in API query strings/bodies since backend COP/strategic/mission endpoints haven't been renamed
- **Fix:** Service methods accept problemSetId params but explicitly map to workspaceId: `{ workspaceId: problemSetId }` in all API calls
- **Files modified:** cop-service.ts, strategic-service.ts, mission-service.ts
- **Commit:** 5b14e34

## Verification Results

- Zero files reference WorkspaceContext, useWorkspace, workspace-service, or components/workspace
- workspace-service.ts: DELETED
- WorkspaceContext.tsx: DELETED
- components/workspace/: DELETED (in prior commit dcbefe1)
- Frontend TypeScript compilation: CLEAN (zero errors)
- App.tsx routes: /problem-set/* with backward-compat /workspace/* redirect

## Decisions Made

1. **Wire-format preservation**: Backend response types (COPLayer.workspaceId, AgentActivity.workspaceId, Mission.workspaceId) kept as workspaceId with comments. These are wire types matching backend JSON. Frontend-facing props/methods use problemSetId.

2. **Echelon model in wizard**: CreateProblemSetWizard uses echelon (strategic/operational/tactical) instead of the old workspace type (Organization/Unit/Team), matching the JP 5-0 terminology from Phase 23.

3. **Exercise components not modified**: Exercise components (StaffWorkspace, AIRoleWorkspace, etc.) use "workspace" in the UI domain sense (staff working area), not the renamed entity. No changes needed.

## Self-Check: PASSED

- App.tsx: FOUND
- ProblemSetTabContainer.tsx: FOUND
- CreateProblemSetWizard.tsx: FOUND
- workspace-service.ts: DELETED (confirmed)
- WorkspaceContext.tsx: DELETED (confirmed)
- Commit 1f7be8b: FOUND
- Commit 5b14e34: FOUND
