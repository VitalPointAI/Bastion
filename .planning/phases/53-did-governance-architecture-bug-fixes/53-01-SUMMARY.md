---
phase: 53-did-governance-architecture-bug-fixes
plan: 01
subsystem: ui, api
tags: [ironclaw, mcp, tool-bridge, drag-fix, version-display, self-update-service]

# Dependency graph
requires:
  - phase: 52-agent-skills-mcp
    provides: "MCP server (mcp-server.ts), ToolBridge (tool-bridge.ts), BASTION_TOOLS registry"
  - phase: 30-ironclaw-chief-of-staff
    provides: "IronclawButton, IronclawDrawer, SelfUpdateService, ironclaw-router"
provides:
  - "Fixed Ironclaw drag Y-axis physics (bottom - dy) so button moves with mouse correctly"
  - "MCP executeTool() routed to toolBridge.handleToolCall() instead of stub acknowledgment"
  - "GET /api/ironclaw/status endpoint returning SelfUpdateService status including version"
  - "IronclawDrawer header shows Ironclaw version fetched from /api/ironclaw/status"
affects:
  - 53-did-governance-architecture-bug-fixes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ironclaw-router.ts is auth-protected at app mount (app.use('/api/ironclaw', requireAuth, ironclawRouter)) — no need for inline requireAuth per route"
    - "IronclawDrawer fetches version on mount with silent failure (.catch(() => {})) — version badge shown only when available"

key-files:
  created: []
  modified:
    - frontend/src/components/ironclaw/IronclawButton.tsx
    - frontend/src/components/ironclaw/IronclawDrawer.tsx
    - backend/src/mcp/mcp-server.ts
    - backend/src/ironclaw/ironclaw-router.ts

key-decisions:
  - "Import selfUpdateService directly into ironclaw-router.ts rather than creating a new service layer — keeps endpoint simple"
  - "Agent Hub count mismatch already resolved in Phase 51 — getDashboardSummaries() uses INNER JOIN agents_v2 ensuring consistency"
  - "Version badge silently fails — UX disruption from a missing version display is not acceptable"

patterns-established:
  - "MCP tool execution: toolBridge.handleToolCall(toolName, args, agentDID, problemSetId) where problemSetId extracted from args"

requirements-completed: [REQ-53-01, REQ-53-02, REQ-53-03]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 53 Plan 01: Bug Fixes & UX Polish Summary

**Fixed Ironclaw drag inversion (bottom - dy), wired MCP stub to toolBridge.handleToolCall(), added /api/ironclaw/status endpoint with version display in drawer header**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-19T00:00:00Z
- **Completed:** 2026-03-19
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Fixed drag Y-axis inversion: CSS `bottom` increases upward while mouse `dy` increases downward, so `bottom - dy` now correctly moves button in the same direction as mouse
- Wired MCP `executeTool()` to `toolBridge.handleToolCall()` — removes Phase 52 MVP stub that returned only acknowledgment, now routes to real domain service execution
- Added `GET /api/ironclaw/status` endpoint backed by `selfUpdateService.getStatus()` returning `{ currentVersion, isUpdating, lastChecked }`
- Added version badge to IronclawDrawer header: fetches on mount, displays `v{version}` next to title, silent failure if unreachable
- Agent Hub count mismatch investigated and confirmed already resolved in Phase 51 (validation dashboard uses `INNER JOIN agents_v2`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix drag Y-axis, wire MCP executeTool, add /status endpoint** - `90e9e227` (fix)
2. **Task 2: Ironclaw version display + agent count investigation** - `35ffe9ae` (feat)

## Files Created/Modified

- `frontend/src/components/ironclaw/IronclawButton.tsx` - Fixed drag Y-axis: `startPos.current.bottom - dy` (was `+ dy`)
- `frontend/src/components/ironclaw/IronclawDrawer.tsx` - Added version state, useEffect fetch, version badge in header
- `backend/src/mcp/mcp-server.ts` - Replaced stub executeTool with real toolBridge.handleToolCall() routing; import toolBridge
- `backend/src/ironclaw/ironclaw-router.ts` - Added GET /status endpoint + import selfUpdateService

## Decisions Made

- `ironclaw-router.ts` is already mounted behind `requireAuth` at the app level (`app.use('/api/ironclaw', requireAuth, ironclawRouter)`), so no inline auth needed on the /status route
- `problemSetId` extracted from args via `args.problem_set_id ?? args.id ?? args.parent_id ?? ''` — handles multiple field naming conventions MCP agents may use
- Agent Hub count mismatch already resolved: `getDashboardSummaries()` uses `INNER JOIN agents_v2` (line 551 of validation-store.ts) ensuring only agents in canonical registry appear in health tab

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Clean TypeScript baseline (zero errors in both frontend and backend) established for subsequent plans
- MCP tool pipeline now fully wired — Phase 53 plans building new tools will have real execution
- Ironclaw panel shows version — useful for debugging and support

---
*Phase: 53-did-governance-architecture-bug-fixes*
*Completed: 2026-03-19*
