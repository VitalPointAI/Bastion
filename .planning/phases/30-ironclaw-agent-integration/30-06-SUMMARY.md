---
phase: 30-ironclaw-agent-integration
plan: 06
subsystem: ui, api
tags: [react, websocket, ironclaw, context, chat, typescript]

requires:
  - phase: 30-ironclaw-agent-integration
    provides: Ironclaw UI components (Plan 05)
  - phase: 30-ironclaw-agent-integration
    provides: MCP tool bridge and confirmation endpoints (Plan 04)
provides:
  - Ironclaw REST API service client (6 endpoints)
  - WebSocket hook with real-time message streaming
  - IronclawContext replacing AIStaffContext as primary AI surface
  - Global floating button and drawer accessible from any tab
affects: [30-ironclaw-agent-integration]

tech-stack:
  added: []
  patterns: [ironclaw-context-provider, optimistic-message-send, ws-channel-subscription]

key-files:
  created:
    - frontend/src/lib/ironclaw-service.ts
    - frontend/src/hooks/useIronclaw.ts
    - frontend/src/context/IronclawContext.tsx
  modified:
    - frontend/src/App.tsx

key-decisions:
  - "IronclawProvider placed inside ProblemSetProvider to access activeProblemSetId via useProblemSet"
  - "AIStaffContext preserved for backward compatibility -- both coexist during transition"
  - "Optimistic user message append with isLoading cleared on WebSocket response from Ironclaw"
  - "Action card disabled by clearing options array on confirm decision (optimistic)"

patterns-established:
  - "Ironclaw context pattern: useIronclaw hook encapsulates WS + API, context exposes to tree"
  - "WebSocket channel: ironclaw.{problemSetId} with subscribe/unsubscribe protocol"
  - "Snake-to-camel transformation in API service layer for DB row consumption"

requirements-completed: [IC-16, IC-17, IC-18]

duration: 5min
completed: 2026-03-07
---

# Phase 30 Plan 06: Ironclaw Frontend Service, Hook & Context Wiring Summary

**REST API service, WebSocket chat hook, and React context provider wiring Ironclaw drawer globally into App.tsx**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T13:40:25Z
- **Completed:** 2026-03-07T13:45:24Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments
- IronclawApi service class with sendMessage, getHistory, confirmAction, trust preferences, and health endpoints
- useIronclaw hook managing WebSocket connection, message state, optimistic sends, action confirmations, and drawer open/close
- IronclawContext providing global access to chat state and drawer controls
- IronclawProvider wired into AuthenticatedShell in App.tsx, rendering floating button and drawer on every authenticated page

## Task Commits

Each task was committed atomically:

1. **Task 1: Ironclaw API service and WebSocket hook** - `ad22f57` (feat)
2. **Task 2: IronclawContext and App.tsx wiring** - `fe8e71d` (feat)

## Files Created/Modified
- `frontend/src/lib/ironclaw-service.ts` - REST API client with 6 endpoints, snake-to-camel transform, singleton export
- `frontend/src/hooks/useIronclaw.ts` - WebSocket hook with exponential backoff reconnect, optimistic message send, action confirmations
- `frontend/src/context/IronclawContext.tsx` - React context wrapping useIronclaw, renders IronclawButton and IronclawDrawer globally
- `frontend/src/App.tsx` - Added IronclawProvider inside ProblemSetProvider wrapping AppContent

## Decisions Made
- IronclawProvider placed inside ProblemSetProvider (needs activeProblemSetId) but above AppContent (global access)
- AIStaffContext kept at ProblemSetTabContainer level for backward compatibility; comment documents transition plan
- Optimistic message append for user messages; isLoading cleared when non-user WebSocket message arrives
- Action card disabled by clearing options array (empty array = no buttons rendered)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- System default Node v12.22.9 incompatible with TypeScript 5.9.3; used NVM Node v22.18.0 binary directly for tsc verification (same workaround as Plan 05)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full Ironclaw frontend stack complete: types, components, service, hook, context, app wiring
- Ready for end-to-end integration testing with backend Ironclaw sidecar
- AIStaffContext still active for existing tab components; can be removed once all consumers migrate

---
*Phase: 30-ironclaw-agent-integration*
*Completed: 2026-03-07*
