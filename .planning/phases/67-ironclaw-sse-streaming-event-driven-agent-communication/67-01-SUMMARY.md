---
phase: 67-ironclaw-sse-streaming-event-driven-agent-communication
plan: "01"
subsystem: ironclaw-sse
tags: [sse, streaming, event-store, postgresql, real-time]
dependency_graph:
  requires: []
  provides:
    - ironclawEventStore singleton (append, getEventsSince, registerClient, removeClient)
    - ironclaw_events PostgreSQL table
    - GET /:problemSetId/stream SSE endpoint
    - GET /global/stream SSE endpoint
  affects:
    - backend/src/ironclaw/ironclaw-router.ts
tech_stack:
  added: []
  patterns:
    - SSE with Last-Event-ID replay (PostgreSQL-backed)
    - In-memory SSE client registry (Map<scopeId, Set<Response>>)
    - Heartbeat interval keepalive (30s)
    - Per-scope connection limit DoS protection
key_files:
  created:
    - backend/src/ironclaw/ironclaw-event-types.ts
    - backend/src/ironclaw/ironclaw-event-store.ts
    - backend/src/ironclaw/ironclaw-sse.ts
    - backend/src/ironclaw/__tests__/ironclaw-event-store.test.ts
  modified:
    - backend/src/ironclaw/ironclaw-router.ts
decisions:
  - "Used getPool() from lib/database.js (main Bastion DB) per RESEARCH.md A3 — events in Bastion DB, not Ironclaw DB"
  - "Placed /global/stream before /:problemSetId/stream in router to prevent Express matching 'global' as a param"
  - "Test file placed in __tests__/ subdirectory per plan spec (other tests use flat placement — consistent with plan)"
  - "Mock path in test uses ../../lib/database.js (relative to __tests__/ subfolder)"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-09"
  tasks_completed: 2
  files_changed: 5
---

# Phase 67 Plan 01: SSE Backend Foundation Summary

**One-liner:** PostgreSQL-backed SSE event store with 7 typed event types, Last-Event-ID replay, per-scope connection limits, and Express streaming endpoints at `/:problemSetId/stream` and `/global/stream`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Event type definitions and event store with persistence | 46ec1e8b | ironclaw-event-types.ts, ironclaw-event-store.ts, __tests__/ironclaw-event-store.test.ts |
| 2 | SSE streaming endpoint with Last-Event-ID replay and router integration | 1c3a6325 | ironclaw-sse.ts, ironclaw-router.ts |

## What Was Built

### ironclaw-event-types.ts
Defines the SSE event taxonomy with 7 typed event payloads:
- `ack` — message receipt confirmation
- `tool_call` — tool invocation lifecycle (pending/running/complete/failed)
- `tool_result` — completed tool output
- `delegation` — specialist agent delegation status
- `progress` — generic multi-step progress indicator
- `response` — Ironclaw's response (supports streaming delta chunks)
- `error` — client-facing error notification

Also exports `IronclawEvent<T>` envelope matching the DB row shape and `IronclawPayloadMap` for typed generics.

### ironclaw-event-store.ts
`IronclawEventStore` class with:
- `ensureTable()`: creates `ironclaw_events` table + 2 indexes idempotently
- `append(scopeId, userDid, eventType, payload, threadId?)`: INSERT returning id, then emits SSE to connected clients
- `emit()` (private): writes `id: N\nevent: type\ndata: JSON\n\n` chunks; dead clients removed automatically
- `registerClient()` / `removeClient()`: in-memory `Map<string, Set<Response>>` registry
- `getClientCount()`: for connection limit enforcement
- `getEventsSince(scopeId, lastId, threadId?)`: parameterized SELECT for replay; filters by thread if provided

Singleton `ironclawEventStore` exported.

### ironclaw-sse.ts
`handleSSEStream(req, res)` handler:
1. Scope determination: `_global_{userDid}` for global routes, `problemSetId` for scoped
2. Auth guard: anonymous users rejected with 403 from global stream (T-67-01)
3. Connection limit: 429 returned if scope has >= 5 active connections (T-67-03)
4. SSE headers: `text/event-stream`, `no-cache`, `keep-alive`, `X-Accel-Buffering: no`
5. `flushHeaders()` to start streaming
6. Last-Event-ID replay: reads `last-event-id` header and `lastEventId` query param; `parseInt` with NaN guard (T-67-04)
7. `registerClient()` called after replay
8. 30-second heartbeat interval
9. `req.on('close')`: clears interval, removes client, ends response

### ironclaw-router.ts modifications
- Imports `handleSSEStream` and `ironclawEventStore`
- Registers `GET /global/stream` BEFORE `GET /:problemSetId/stream`
- Calls `ironclawEventStore.ensureTable()` on startup

## Tests

16 unit tests, all passing. Covers:
- `append()` inserts and returns id
- `getEventsSince()` filters by scope and lastId
- `getEventsSince()` with threadId adds thread filter
- `ensureTable()` runs CREATE TABLE IF NOT EXISTS
- `emit()` writes correct SSE format to registered clients
- `emit()` removes dead clients that throw on write
- All 7 event types exported with correct values
- Singleton export, `removeClient()` behavior
- All 7 payload interface shapes validated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vi.mock path for __tests__ subdirectory**
- **Found during:** Task 1 test run (GREEN phase)
- **Issue:** Test file placed in `__tests__/` subdirectory uses `../../lib/database.js` to mock the database module, but initial mock used `../lib/database.js` (wrong — that path doesn't exist from `__tests__/`)
- **Fix:** Changed mock path to `../../lib/database.js`
- **Files modified:** `backend/src/ironclaw/__tests__/ironclaw-event-store.test.ts`
- **Commit:** 46ec1e8b

**2. [Rule 3 - Blocking] Files written to main project, copied to worktree**
- **Found during:** Task 1 commit preparation
- **Issue:** Write tool defaulted to main project paths; worktree had no node_modules so tests and tsc run against the main project
- **Fix:** Copied files from main project to worktree paths; verified tests pass from worktree; TypeScript check run from main project (shares the same source structure)
- **Files modified:** All 5 new/modified files

## Threat Surface Scan

No new network surface introduced beyond what is in the plan's threat model. The two new GET endpoints (`/global/stream`, `/:problemSetId/stream`) are listed in the plan's threat register with dispositions `mitigate` — all mitigations implemented:
- T-67-01: Global scope auth guard (anonymous users rejected with 403)
- T-67-02: event_type validated via IronclawEventType const; payload stored as JSONB
- T-67-03: Connection limit enforced (429 on excess)
- T-67-04: Last-Event-ID parsed with parseInt; NaN ignored; parameterized query

## Known Stubs

None. The event store and SSE endpoint are fully wired. Plan 02 will wire the service layer to call `ironclawEventStore.append()`.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| backend/src/ironclaw/ironclaw-event-types.ts | FOUND |
| backend/src/ironclaw/ironclaw-event-store.ts | FOUND |
| backend/src/ironclaw/ironclaw-sse.ts | FOUND |
| backend/src/ironclaw/__tests__/ironclaw-event-store.test.ts | FOUND |
| commit 46ec1e8b (Task 1) | FOUND |
| commit 1c3a6325 (Task 2) | FOUND |
| 16 vitest tests passing | PASSED |
| TypeScript compilation | PASSED (exit 0) |
