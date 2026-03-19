---
phase: 53-did-governance-architecture-bug-fixes
plan: "05"
subsystem: frontend-decide-tab
tags: [decide-tab, decision-dashboard, raci, ironclaw, governance, frontend]
dependency_graph:
  requires: ["53-04"]
  provides: ["Decide tab UI", "DecisionDashboard", "RACIMatrixView", "PendingDecisionModal", "useDecisions hook", "Ironclaw pending decision surfacing"]
  affects: ["ProblemSetTabContainer", "IronclawContext", "IronclawDrawer"]
tech_stack:
  added: []
  patterns: ["decision service client with fetch/credentials:include", "polling useEffect with cancel token", "inline action buttons on cards", "expandable sections with chevron toggle"]
key_files:
  created:
    - frontend/src/components/tabs/DecideTab.tsx
    - frontend/src/components/decide/DecisionDashboard.tsx
    - frontend/src/components/decide/RACIMatrixView.tsx
    - frontend/src/components/decide/PendingDecisionModal.tsx
    - frontend/src/hooks/useDecisions.ts
    - frontend/src/lib/decision-service.ts
  modified:
    - frontend/src/components/problem-set/ProblemSetTabContainer.tsx
    - frontend/src/context/IronclawContext.tsx
    - frontend/src/components/ironclaw/IronclawDrawer.tsx
  deleted:
    - frontend/src/components/tabs/DirectTab.tsx
    - frontend/src/components/direct/RobotMissionTrigger.tsx
decisions:
  - "DecideTab is full-width (no sidebar/TabLayout) — all sidebar items collapsed to main content"
  - "Robot Missions removed — covered by ResourcesTab"
  - "Escalation integrated as per-decision action via modal, not a separate view"
  - "Order Release gate kept inline in DecideTab header area"
  - "Ironclaw polls /api/decisions/:psId/pending/:pos every 60s for proactive surfacing"
  - "OLD_TAB_REDIRECTS: direct→decide (backward URL compat)"
metrics:
  duration: 12 min
  completed: "2026-03-19"
  tasks: 2
  files_changed: 11
---

# Phase 53 Plan 05: Decide Tab UI, Decision Dashboard, Ironclaw Decision Surfacing Summary

**One-liner:** Renamed Direct tab to Decide with full-width decision dashboard (RACI-filtered, filterable, inline actions) and Ironclaw proactive pending decision surfacing via 60s polling.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Rename Direct→Decide + decision service + useDecisions hook | 454ef6f8 | ProblemSetTabContainer.tsx, decision-service.ts, useDecisions.ts |
| 2 | DecideTab UI + DecisionDashboard + RACI + PendingDecisionModal + Ironclaw surfacing | f6a2a2ed | DecideTab.tsx, decide/*, IronclawContext.tsx, IronclawDrawer.tsx |

## What Was Built

### Tab Rename (ProblemSetTabContainer)
- `PROBLEM_SET_TABS`: `'direct'` → `'decide'`
- `TAB_LABELS`: `direct: 'Direct'` → `decide: 'Decide'`
- `ALL_TABS_LIST`: updated
- `OLD_TAB_REDIRECTS`: added `direct: 'decide'` for backward URL compat
- Renders `DecideTab` instead of `DirectTab`

### Decision API Client (`frontend/src/lib/decision-service.ts`)
Full typed API client wrapping all 7 decision endpoints with `fetch()` + `credentials: 'include'`. Methods: `getDecisions`, `getPendingForPosition`, `getSummary`, `createDecision`, `actOnDecision`, `getRACIMatrix`, `updateRACIAssignment`.

### useDecisions Hook (`frontend/src/hooks/useDecisions.ts`)
- Fetches decisions, summary, RACI matrix in parallel on mount
- Optional `position` param triggers `getPendingForPosition`
- Returns `{ decisions, summary, raciMatrix, pending, loading, error, refresh, actOnDecision, setFilters }`
- `actOnDecision` calls API then `refresh()`
- Cancel-token pattern for cleanup

### DecideTab (`frontend/src/components/tabs/DecideTab.tsx`)
Full-width panel (no sidebar, no TabLayout, no Robot Missions). Layout:
1. DecisionGateBanner (commander view)
2. Page header + description
3. Order Release gate inline
4. DecisionDashboard (summary cards + filtered decision list)
5. Expandable RACI Matrix section
6. Expandable Decision Gate History (DecisionGateTimeline)

### DecisionDashboard (`frontend/src/components/decide/DecisionDashboard.tsx`)
- Status summary cards: pending (yellow), approved (green), rejected (red), deferred (gray), info_requested (blue) — clickable to filter
- Filter bar: text search + status dropdown + decision type dropdown
- Decision list: cards with title, type badge, time-since, requestor, inline action buttons
- Opens PendingDecisionModal for confirmation

### RACIMatrixView (`frontend/src/components/decide/RACIMatrixView.tsx`)
- Table: rows = decision types, columns = positions (commander/xo/j2/j3/j4/j5/j6)
- R/A/C/I badge per cell with color coding
- Commander/XO can click cells to edit (inline select + OK/cancel)
- Calls `decisionApiService.updateRACIAssignment` on save

### PendingDecisionModal (`frontend/src/components/decide/PendingDecisionModal.tsx`)
- Modal overlay with decision title, description, context key-value pairs
- Action selector: Approve / Reject / Defer / Request More Info
- Optional comment field with contextual placeholder
- Confirm/Cancel with submitting state

### Ironclaw Proactive Decision Surfacing (`IronclawContext.tsx`)
- Polls `GET /api/decisions/:psId/pending/:position` every 60s when problem set + role available
- `pendingDecisions` state exposed in context
- `refreshPendingDecisions` method available
- IronclawButton shows notification dot when `pendingDecisions.length > 0`
- IronclawDrawer shows "Pending Decisions" section at top with inline approve/reject/defer/info buttons
- `deriveTabFromPath` updated: `/decide` recognized as primary tab (before `/direct`)

### Deleted Files
- `frontend/src/components/tabs/DirectTab.tsx` — replaced by DecideTab
- `frontend/src/components/direct/RobotMissionTrigger.tsx` — covered by ResourcesTab

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` — zero errors
- ProblemSetTabContainer uses 'decide' tab (not 'direct')
- DecideTab is full-width panel (no sidebar, no TabLayout, no Robot Missions)
- DecisionDashboard shows counts and filterable decision list
- PendingDecisionModal has approve/reject/defer/info actions
- IronclawContext surfaces pending decisions proactively via 60s polling

## Self-Check: PASSED

Files verified:
- FOUND: frontend/src/components/tabs/DecideTab.tsx
- FOUND: frontend/src/components/decide/DecisionDashboard.tsx
- FOUND: frontend/src/components/decide/PendingDecisionModal.tsx
- FOUND: frontend/src/components/decide/RACIMatrixView.tsx
- FOUND: frontend/src/hooks/useDecisions.ts
- FOUND: frontend/src/lib/decision-service.ts
- DELETED: frontend/src/components/tabs/DirectTab.tsx
- DELETED: frontend/src/components/direct/RobotMissionTrigger.tsx

Commits verified:
- 454ef6f8: feat(53-05): rename Direct to Decide tab + decision service client + useDecisions hook
- f6a2a2ed: feat(53-05): DecideTab UI, DecisionDashboard, RACI matrix, PendingDecisionModal, Ironclaw surfacing
