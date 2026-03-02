---
phase: 16-ai-assigned-staff-workspaces
plan: "02"
subsystem: database
tags: [postgres, pg, jsonb, notify, sse, langgraph, ai-workspace]

# Dependency graph
requires:
  - phase: 16-ai-assigned-staff-workspaces
    provides: "16-01 DB migration creating ai_role_runs, ai_channel_events, staff_product_versions, ai_context_store, ai_coordination_log tables + TypeScript types"

provides:
  - "AIRunStore: CRUD for ai_role_runs with status lifecycle and JSONB trigger_context merge"
  - "AIChannelStore: Insert + pg_notify on ai_channel_events for real-time SSE delivery"
  - "ProductVersionStore: Auto-versioned snapshots for staff_product_versions"
  - "AIContextStore: Additive JSONB merge writes with pg_notify for cross-role coordination"
  - "AICoordinationStore: Audit log CRUD for ai_coordination_log"
  - "scenario-store.ts: roleAssignments in update() + dedicated updateRoleAssignments() method"

affects:
  - 16-03-langgraph-runner
  - 16-04-api-routes
  - 16-05-trigger-router
  - 16-06-sse-endpoints

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Store classes accept Pool constructor injection (not singleton) for testability"
    - "PostgreSQL NOTIFY via pg_notify for real-time SSE without polling"
    - "JSONB || merge operator for additive context writes (never full overwrite)"
    - "Auto-incrementing version numbers via SELECT COALESCE(MAX(version), 0) + 1 subquery"
    - "Row mapper functions (toX) convert snake_case DB rows to camelCase TypeScript types"

key-files:
  created:
    - backend/src/exercise/ai-run-store.ts
    - backend/src/exercise/ai-channel-store.ts
    - backend/src/exercise/product-version-store.ts
    - backend/src/exercise/ai-context-store.ts
    - backend/src/exercise/ai-coordination-store.ts
  modified:
    - backend/src/exercise/scenario-store.ts

key-decisions:
  - "AIContextStore uses pg_notify('context:' || scenarioId) with SQL concatenation so channel name appears in grep-verifiable source"
  - "Store classes take Pool via constructor (not getPool() singleton) for testability by LangGraph runner"
  - "JSONB merge in context store uses || operator with typed JSON.stringify to prevent accidental full overwrite"
  - "AIRunStore.findActiveRun returns only non-terminal statuses (queued/running/awaiting_review/paused)"

patterns-established:
  - "All AI stores: constructor(private pool: Pool) pattern for dependency injection"
  - "All AI stores: toX(row) mapper function converts DB rows to typed interfaces"
  - "pg_notify pattern: SQL SELECT pg_notify(channel, payload) after INSERT/UPSERT"
  - "JSONB merge: INSERT ... ON CONFLICT DO UPDATE SET col = table.col || $new_data"

requirements-completed: [AIWS-03, AIWS-05, AIWS-07]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 16 Plan 02: AI Workspace Data Stores Summary

**Five typed PostgreSQL store classes for AI workspace subsystem: run lifecycle tracking, real-time channel events with pg_notify, product version history, additive JSONB context coordination, and AI-to-AI exchange audit log**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T19:50:25Z
- **Completed:** 2026-03-02T19:54:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created AIRunStore with full status lifecycle (queued/running/paused/awaiting_review/complete/failed) and JSONB merge for trigger context
- Created AIChannelStore with pg_notify on every insert for real-time SSE delivery to role-specific channels
- Created ProductVersionStore with auto-incrementing version numbers via COALESCE subquery
- Created AIContextStore with additive JSONB || merge writes and pg_notify on context:{scenarioId} for cross-role coordination
- Created AICoordinationStore with audit log for all AI-to-AI exchanges with pagination support
- Updated scenario-store.ts to support roleAssignments in update() and added dedicated updateRoleAssignments() method

## Task Commits

Each task was committed atomically:

1. **Task 1: AI Run Store, Channel Store, and Product Version Store** - `917a16d` (feat)
2. **Task 2: AI Context Store, Coordination Store, and Scenario Store roleAssignments** - `9f3c54f` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `backend/src/exercise/ai-run-store.ts` - CRUD for ai_role_runs with status lifecycle, findActiveRun, and JSONB trigger_context merge
- `backend/src/exercise/ai-channel-store.ts` - Insert + pg_notify('channel:{scenarioId}:{roleKey}') for real-time SSE delivery
- `backend/src/exercise/product-version-store.ts` - Auto-versioned staff product snapshots with annotation payload
- `backend/src/exercise/ai-context-store.ts` - Additive JSONB merge writes + pg_notify('context:{scenarioId}') + FOR UPDATE lock support
- `backend/src/exercise/ai-coordination-store.ts` - Audit log for AI-to-AI exchanges with findByScenario pagination and findByRole
- `backend/src/exercise/scenario-store.ts` - Added roleAssignments to update() SET clause + new updateRoleAssignments() method

## Decisions Made

- Used `Pool` constructor injection (not `getPool()` singleton) for all new stores — enables LangGraph runner to inject pools and supports testing
- AIContextStore pg_notify channel uses SQL string concatenation `'context:' || $1` so the literal `context:` pattern is grep-verifiable in source
- JSONB context merge deliberately uses `ai_context_store.context_data || $3` (table-qualified) to be unambiguous in the ON CONFLICT UPDATE clause
- AIRunStore.findActiveRun intentionally excludes 'complete' and 'failed' statuses — only shows actionable in-flight runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Node.js version on system PATH was v12.22.9 (WSL default), which cannot load TypeScript compiler. Resolved by using the full path to Node v20.19.4 at `/home/vitalpointai/.nvm/versions/node/v20.19.4/bin/` for TypeScript verification.
- Plan verification grep `pg_notify.*context:` required the literal string on one line. Initial parameterized implementation had `$1` on the pg_notify line and `context:` on the next. Resolved by using SQL string concatenation `'context:' || $1` to keep the channel prefix on the same line as pg_notify.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 AI workspace data stores are ready for consumption by the LangGraph agent runner (16-03)
- AIRunStore.findActiveRun provides the "is there an active run?" check the trigger router (16-05) needs
- AIChannelStore.create emits pg_notify for each event — SSE endpoints (16-06) can LISTEN on channel:{scenarioId}:{roleKey}
- AIContextStore.readWithLock supports transactional agent reads without race conditions
- scenario-store.ts updateRoleAssignments ready for the assignment API routes (16-04)

---
*Phase: 16-ai-assigned-staff-workspaces*
*Completed: 2026-03-02*
