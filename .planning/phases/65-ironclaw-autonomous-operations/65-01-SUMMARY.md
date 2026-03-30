---
phase: 65-ironclaw-autonomous-operations
plan: "01"
subsystem: ironclaw-callback
tags: [ironclaw, autonomous-operations, webhook, mcp, hmac, circuit-breaker]
dependency_graph:
  requires:
    - backend/src/ironclaw/hmac-auth.ts
    - backend/src/messaging/message-bus.ts
    - backend/src/decisions/decision-service.ts
    - backend/src/decisions/pir-alert-handler.ts
    - backend/src/ironclaw/telegram-bot-service.ts
    - backend/src/lib/database.ts
  provides:
    - POST /api/ironclaw/callback endpoint on bastion-mcp (port 3334)
    - ironclaw_autonomous_activity PostgreSQL table
    - AutonomousActivityStore CRUD layer
  affects:
    - backend/src/mcp/index.ts
tech_stack:
  added: []
  patterns:
    - Express Router with HMAC middleware
    - Idempotent CREATE TABLE IF NOT EXISTS (same as existing stores)
    - Dynamic imports with try/catch for non-critical service calls
    - setImmediate for non-blocking WebSocket publish
key_files:
  created:
    - backend/src/ironclaw/autonomous-activity-store.ts
    - backend/src/mcp/ironclaw-callback-router.ts
  modified:
    - backend/src/mcp/index.ts
decisions:
  - Used dynamic imports (not static) for decision-service, pir-alert-handler, and telegram-bot-service in the callback router — these services may not be fully initialized at MCP container startup, dynamic imports defer resolution
  - Circuit breaker errors are non-fatal (allow-through) to prevent a DB hiccup from blocking legitimate callback processing
  - WebSocket publish done in setImmediate to not block the HTTP response
  - HMAC verification failures return 401; missing/invalid body fields return 400; circuit breaker exceeded returns 429 with retryAfter seconds
metrics:
  duration: "~8 min"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_changed: 3
---

# Phase 65 Plan 01: Ironclaw Callback Webhook and Autonomous Activity Store Summary

**One-liner:** Bidirectional Ironclaw-to-Bastion callback webhook on bastion-mcp with HMAC auth, circuit breakers, type-based routing to decision gates, and PostgreSQL activity persistence.

## Objective

Build the missing bidirectional communication link: Ironclaw can now POST autonomous findings to Bastion via `POST /api/ironclaw/callback` on the bastion-mcp container (port 3334), which sits on `ironclaw-network` and is the only container Ironclaw can reach.

## What Was Built

### Task 1: Autonomous Activity Store (`backend/src/ironclaw/autonomous-activity-store.ts`)

PostgreSQL CRUD layer for the `ironclaw_autonomous_activity` table:

- `ensureTable()` — idempotent CREATE TABLE IF NOT EXISTS with index on `(problem_set_id, created_at DESC)`
- `log(entry)` — insert row, return created ActivityEntry with server-generated UUID and timestamp
- `getRecent(problemSetId, limit)` — fetch recent activity DESC, default limit 50
- `getCountSince(problemSetId, since)` — count entries since a given Date (used for rolling-window circuit breaker)
- `getDailyCount(problemSetId)` — count today's entries (UTC midnight boundary, daily circuit breaker)

The `ActivityEntry` type uses a severity union: `'critical' | 'urgent' | 'routine' | 'informational'`.

Exported singleton: `autonomousActivityStore`.

### Task 2: Callback Router (`backend/src/mcp/ironclaw-callback-router.ts`) + mount in `index.ts`

Express Router mounted at `app.use('/api/ironclaw', callbackRouter)` in `mcp/index.ts`. Full URL: `http://bastion-mcp:3334/api/ironclaw/callback`.

**Security:** `verifyRequest()` from `hmac-auth.ts` — validates HMAC-SHA256 signature and timestamp (5-minute replay window). Returns 401 on failure.

**Validation:** Requires `type` (string), `problemSetId` (string), `payload` (object), `severity` (valid union value). Returns 400 on failure.

**Circuit breakers (checked before processing):**
- Max 10 callbacks per problem set in the last 30 minutes → 429 with `retryAfter: 1800`
- Max 100 callbacks per problem set per day (UTC) → 429 with `retryAfter: secondsUntilMidnightUTC()`

**Type-based routing:**

| type | Handler |
|------|---------|
| `intelligence_gap_detected` | `createPIRAlertDecision()` — creates PIR/CCIR/FFIR/EEFI alert decision |
| `conflict_detected` | `decisionService.createDecision({ decision_type: 'conflict_resolution' })` |
| `situation_assessment` | Log only (no decision gate) |
| `skill_creation_request` | `decisionService.createDecision({ decision_type: 'skill_creation' })` |
| `alert` | Telegram notification for urgent/critical severity via `telegramBotService.sendNotification()` |
| default | Log only |

**Always after routing:**
1. `autonomousActivityStore.log()` with `decisionId` if a decision was created
2. `getMessageBus().publish()` to channel `ironclaw.{problemSetId}` with messageType `ironclaw.autonomous-activity` (non-blocking via `setImmediate`)
3. Return `{ status: 'ok', activityId: entry.id }`

## Verification

- `tsc --noEmit` passes for all three modified files
- Callback endpoint mounted on bastion-mcp index.ts (port 3334) at `/api/ironclaw/callback`
- HMAC auth middleware applied via `verifyRequest()`
- Circuit breaker constants: `CIRCUIT_WINDOW_MAX = 10`, `CIRCUIT_WINDOW_MINUTES = 30`, `CIRCUIT_DAILY_MAX = 100`
- `ironclaw_autonomous_activity` table creation is idempotent via `CREATE TABLE IF NOT EXISTS`

## Commits

- `db55dde2` — feat(65-01): create autonomous activity store and DB migration
- `0cc45493` — feat(65-01): add Ironclaw callback webhook endpoint on bastion-mcp

## Deviations from Plan

None — plan executed exactly as written.

The only TypeScript warning observed (`format-converter.ts: Cannot find module 'tesseract.js'`) is a pre-existing issue unrelated to this plan's changes.

## Self-Check: PASSED
