---
phase: 57-ironclaw-persistent-memory-and-adaptive-relationship
plan: "04"
subsystem: ironclaw
tags: [memory, lifecycle, pg-boss, cleanup, startup, outcomes]
dependency_graph:
  requires: [57-03]
  provides: [ironclaw-memory-lifecycle]
  affects: [backend/src/ironclaw, backend/src/index.ts]
tech_stack:
  added: []
  patterns: [pg-boss-recurring-job, fire-and-forget-outcome-recording, startup-ensureTable]
key_files:
  created:
    - backend/src/ironclaw/ironclaw-memory-cleanup.ts
  modified:
    - backend/src/ironclaw/index.ts
    - backend/src/ironclaw/ironclaw-router.ts
    - backend/src/index.ts
decisions:
  - initIronclawMemory() exported from ironclaw/index.ts (not inlined in startup) for testability and separation
  - Suggestion reject endpoint not added (no explicit reject route exists; reject is implicit when user ignores a suggestion)
  - outcome recording on /suggestions/:id/accept uses suggestion_type=targetField (field being written) as context
metrics:
  duration: "4 min"
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 4
---

# Phase 57 Plan 04: Memory Lifecycle Management Summary

Daily pg-boss cleanup job for expired memories, startup ensureTable initialization for all three memory tables, and outcome recording wired into the suggestion accept endpoint.

## What Was Built

### Task 1: Memory cleanup job and startup wiring

**`backend/src/ironclaw/ironclaw-memory-cleanup.ts`** (new file):
- `registerMemoryCleanupJob()` — follows the `getSharedBoss()` pattern used in `osint-cleanup-scheduler.ts` and `validation-scheduler.ts`
- Daily cron schedule: `0 3 * * *` (3am UTC)
- Deletes expired rows from `ironclaw_user_memory` and `ironclaw_context_memory` via `expires_at < NOW()`
- Deletes rows from `ironclaw_interaction_outcomes` older than 90 days (raw data retention policy)
- Uses `Promise.allSettled` so a failure in one table doesn't block the others
- Logs a summary line per table with row counts or error messages

**`backend/src/ironclaw/index.ts`** (updated):
- Added `initIronclawMemory()` export — calls `ensureTable()` on all three stores, then `registerMemoryCleanupJob()`
- Import added for `registerMemoryCleanupJob` from the new file

**`backend/src/index.ts`** (updated):
- Import updated to include `initIronclawMemory` from `./ironclaw/index.js`
- Startup sequence extended: `await initIronclawMemory()` called after `registerOSINTCleanupJob()`, wrapped in try/catch to not block server startup

### Task 2: Wire outcome recording into suggestion accept endpoint

**`backend/src/ironclaw/ironclaw-router.ts`** (updated):
- `POST /suggestions/:id/accept` — added fire-and-forget `memoryRetrievalService.recordOutcome()` call after successful field write
- Records `suggestion_accepted` with `{ suggestion_type: targetField }` context
- `memoryRetrievalService` was already imported from Plan 03
- The `/confirm` endpoint already had outcome recording from Plan 02 — no duplication

## Verification

- `npx tsc --noEmit` — clean compile (0 errors)
- `npx vitest run src/ironclaw/` — 38 tests, all passing

## Deviations from Plan

None - plan executed exactly as written.

The `/suggestions/:id/accept` endpoint had no explicit reject counterpart (the plan noted this was implicit). No reject endpoint was added — consistent with plan instructions.

## Self-Check: PASSED

Files created/modified:
- FOUND: backend/src/ironclaw/ironclaw-memory-cleanup.ts
- FOUND: backend/src/ironclaw/index.ts (modified)
- FOUND: backend/src/ironclaw/ironclaw-router.ts (modified)
- FOUND: backend/src/index.ts (modified)

Commits:
- 8c3b1ef2: feat(57-04): memory cleanup job and startup wiring
- daa03953: feat(57-04): wire outcome recording into suggestion accept endpoint
