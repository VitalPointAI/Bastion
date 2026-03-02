---
phase: 16-ai-assigned-staff-workspaces
plan: "03"
subsystem: ai-execution-engine
tags: [langgraph, pg-boss, sse, interrupt, checkpoint-postgres, trigger-router, api-routes]

# Dependency graph
requires:
  - phase: 16-ai-assigned-staff-workspaces
    provides: "16-02 AI workspace data stores (AIRunStore, AIChannelStore, ProductVersionStore, AIContextStore, AICoordinationStore)"

provides:
  - "AgentRunner interface + LangGraphAgentRunner: abstraction layer for future runner replacement"
  - "createAIRoleGraph: LangGraph StateGraph with parallel fan-out, PostgreSQL checkpointing, and interrupt-based human review"
  - "awaitReviewNode: fires system notification via MessageBus before calling interrupt()"
  - "TriggerRouter: 2s debounce merge window, pg-boss singletonKey deduplication"
  - "registerAIRoleWorker: pg-boss worker for ai-role-execution queue"
  - "10 new API routes: role-assignments, runs, pause/resume/review, channel SSE, agents, product versions, commander directives"
  - "Auto-trigger wiring for all 4 event types: opord_upload, phase_change, upstream_publish, commander_directive"

affects:
  - 16-04-frontend-ai-workspace
  - 16-05-frontend-role-dashboard

# Tech tracking
tech-stack:
  added:
    - "@langchain/langgraph-checkpoint-postgres: PostgresSaver for graph state checkpointing"
  patterns:
    - "LangGraph Annotation.Root with reducer functions for each state field"
    - "interrupt() called in awaitReviewNode after pre-interrupt side effects (notify + status update)"
    - "MessageBus.publish to exercise.staff.{scenarioId} channel for notification tray delivery"
    - "pg-boss singletonKey: ${scenarioId}:${roleKey} for job deduplication"
    - "setImmediate() for non-blocking auto-trigger wiring in API handlers"
    - "Lazy initialization pattern for AI workspace singletons in exercise.ts"
    - "SSE with pg pool.connect() + LISTEN/UNLISTEN per client connection"

key-files:
  created:
    - backend/src/exercise/ai-role-runner.ts
    - backend/src/exercise/ai-role-graph.ts
    - backend/src/exercise/trigger-router.ts
  modified:
    - backend/src/api/exercise.ts
    - backend/src/exercise/index.ts

key-decisions:
  - "LangGraphAgentRunner accepts PostgresSaver via constructor (not singleton) for testability"
  - "awaitReviewNode dispatches via MessageBus.publish (not direct pg_notify) to reuse existing notification delivery infrastructure"
  - "Auto-trigger hooks use setImmediate() so HTTP response is sent before trigger processing begins"
  - "AI workspace singletons in exercise.ts use lazy init pattern with getAIWorkspace() to avoid pool-not-ready errors at module load"
  - "pg-boss work() uses localConcurrency: 3 (replaces deprecated teamSize from older pg-boss API)"
  - "Commander directive route added as new POST endpoint (no existing dedicated commander product creation route found)"

requirements-completed: [AIWS-03, AIWS-04, AIWS-05]

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 16 Plan 03: AI Agent Execution Engine Summary

**LangGraph StateGraph with PostgreSQL checkpointing, interrupt-based human review with notification dispatch, 2s debounce trigger router with pg-boss singletonKey deduplication, and 10 new backend API routes wiring all 4 auto-trigger event types**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T19:58:21Z
- **Completed:** 2026-03-02T20:05:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `ai-role-runner.ts` with AgentRunner interface + LangGraphAgentRunner implementation providing pause/resume/status abstraction
- Created `ai-role-graph.ts` with full LangGraph StateGraph: parallel agent fan-out via Promise.all, PostgresSaver checkpointing, interrupt()-based human review, and MAX_ITERATIONS guard at 3
- awaitReviewNode fires system notification via existing MessageBus (`staff.ai.review_required`) before calling interrupt() — surfaces in notification tray AND product panel badge
- Created `trigger-router.ts` with 2s MERGE_WINDOW_MS debounce, pg-boss singletonKey deduplication per (scenario, role) pair, and worker registration
- Added 10 new routes to exercise.ts: role-assignments (GET/PUT), runs (POST/GET), pause/resume/review (PATCH/POST), channel SSE (GET), agents (GET), product version history (GET), commander directives (POST)
- Wired all 4 auto-trigger event types: opord_upload in upload handler, phase_change in advance-phase, upstream_publish in staff-products publish, commander_directive in new commander directives route
- Updated exercise/index.ts with complete exports for all new stores, runner, graph, and trigger router

## Task Commits

Each task was committed atomically:

1. **Task 1: AI Role Runner, Graph, and Trigger Router** - `1aefd73` (feat)
2. **Task 2: Backend API Routes for AI Workspace** - `775d17b` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `backend/src/exercise/ai-role-runner.ts` - AgentRunner interface + LangGraphAgentRunner with PostgresSaver, pause/resume/status methods
- `backend/src/exercise/ai-role-graph.ts` - LangGraph StateGraph with 7 nodes (assemble_context, run_agents, merge_drafts, await_review, handle_approved, handle_revision, handle_rejected) + PostgreSQL checkpointing
- `backend/src/exercise/trigger-router.ts` - 2s debounce merge, pg-boss singletonKey deduplication, worker registration with localConcurrency:3
- `backend/src/api/exercise.ts` - 10 new routes + auto-trigger wiring for 4 event types + lazy AI workspace initialization
- `backend/src/exercise/index.ts` - Exports for all new AI workspace classes

## Decisions Made

- LangGraphAgentRunner accepts PostgresSaver via constructor injection — enables testing without global database state
- awaitReviewNode uses MessageBus.publish (channel `exercise.staff.${scenarioId}`) to reuse the existing notification delivery infrastructure rather than raw pg_notify
- Auto-trigger hooks use `setImmediate()` so HTTP response returns before trigger processing — prevents timeouts on upload handler
- Lazy initialization (`getAIWorkspace()`) for AI workspace singletons prevents pool-not-ready errors at module load
- pg-boss `localConcurrency: 3` replaces deprecated `teamSize` from older API (pg-boss v12 uses `localConcurrency`)
- Added new POST `/scenarios/:id/roles/commander/directives` route (no existing dedicated commander product creation route found)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pg-boss default import not available**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `import PgBoss from 'pg-boss'` fails — PgBoss is a named export in pg-boss v12
- **Fix:** Changed to `import { PgBoss } from 'pg-boss'`
- **Files modified:** backend/src/exercise/trigger-router.ts
- **Commit:** 1aefd73

**2. [Rule 1 - Bug] pg-boss work() handler type inference**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `jobs` parameter in work() handler had implicit `any` type
- **Fix:** Added explicit generic type parameter `Job<{ ... }>[]` to work() callback
- **Files modified:** backend/src/exercise/trigger-router.ts
- **Commit:** 1aefd73

**3. [Rule 2 - Missing] pg-boss `teamSize` not in v12 API**
- **Found during:** Task 1 (API research)
- **Issue:** Plan specified `teamSize: 3` but pg-boss v12 uses `localConcurrency`
- **Fix:** Used `localConcurrency: 3` which is the correct v12 API
- **Files modified:** backend/src/exercise/trigger-router.ts

## Issues Encountered

- pg-boss v12 changed API: `teamSize` was removed, `localConcurrency` is the replacement. WorkHandler now receives `Job<T>[]` array.
- LangGraph v1.1.0 `Annotation.Root` requires explicit `reducer` functions for each field — used inline reducer lambdas (`(_a, b) => b` for last-write-wins, `(a, b) => ({ ...a, ...b })` for merge).

## Self-Check

---
## Self-Check: PASSED

Files verified:
- FOUND: backend/src/exercise/ai-role-runner.ts
- FOUND: backend/src/exercise/ai-role-graph.ts
- FOUND: backend/src/exercise/trigger-router.ts

Commits verified:
- FOUND: 1aefd73 (feat(16-03): AI role runner, LangGraph graph, and trigger router)
- FOUND: 775d17b (feat(16-03): backend API routes for AI workspace)

TypeScript: PASS (zero errors)
