---
phase: 14-friendly-adversary-ipb-complete-cycle
plan: "04"
subsystem: exercise-orders
tags: [exercise, orders, warnord, opord, frago, planning-board, llm, message-bus, information-barrier]
dependency_graph:
  requires:
    - phase: 14-friendly-adversary-ipb-complete-cycle
      plan: "01"
      provides: "exercise data model — ExerciseOrder, PlanningTask, stores, types"
  provides:
    - backend/src/exercise/order-generator.ts
    - backend/src/exercise/planning-board-service.ts
  affects:
    - 14-05 (COA selection and order routing API)
    - 14-06 (Exercise control dashboard)
tech-stack:
  added: []
  patterns:
    - "Order generation: LLM synthesizes team-visible documents + IPB into doctrinal WARNORD/OPORD/FRAGO JSON"
    - "Team perspective enforcement: separate LLM prompts for Blue (CJTF WestPAC/INDOPACOM) vs Red (PRC/TCC)"
    - "FRAGO delta model: only changed paragraphs generated, references base order ID"
    - "MessageBus channel events: publish to exercise.{scenarioId} channel for fan-out notifications"
    - "Board summary: N+1 avoided via batch phase lookup query (loadPhaseByOrderId)"
key-files:
  created:
    - backend/src/exercise/order-generator.ts
    - backend/src/exercise/planning-board-service.ts
  modified:
    - backend/src/exercise/task-store.ts
    - backend/src/exercise/index.ts
key-decisions:
  - "MessageBus publish uses channel destination (exercise.{scenarioId}) rather than broadcast — allows per-exercise subscription without leaking events across scenarios"
  - "PlanningBoardService catches MessageBus publish errors and logs them rather than failing — notifications are advisory, not transactional"
  - "ExerciseOrderGenerator accepts LLMProvider directly or ProviderConfig — allows injection in tests, avoids singleton coupling"
  - "TaskStore.updateAssignedRole() added as direct SQL update — no full row reload needed for reassign path"
  - "LLM JSON extraction uses JSON.parse(JSON.stringify()) round-trip to strip TypeScript type constraints before persisting as Record<string,unknown>"
patterns-established:
  - "Order generator pattern: buildTeamPrompt → callLLM → parseJSON (strip fences) → orderStore.create"
  - "Task extraction helpers (extractTasksFromWARNORD/OPORD/FRAGO) separate from PlanningBoardService for testability"
  - "mapRoleString normalizes arbitrary role strings to PlanningTask['assignedRole'] union"
requirements-completed:
  - EX-08
  - EX-09
  - EX-10
duration: 6min
completed: 2026-02-28
---

# Phase 14 Plan 04: Order Generation and Planning Board Summary

**LLM-backed WARNORD/OPORD/FRAGO generation with team-isolated prompts, plus planning board service that converts published orders into tracked PlanningTask records with MessageBus fan-out notifications.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T19:59:54Z
- **Completed:** 2026-02-28T20:05:54Z
- **Tasks:** 2
- **Files created:** 2 (order-generator.ts, planning-board-service.ts)
- **Files modified:** 2 (task-store.ts, index.ts)

## Accomplishments

- `ExerciseOrderGenerator` (720 lines) generates all three doctrinal order types using LLM synthesis of team-visible documents and IPB assessments
- `PlanningBoardService` (403 lines) handles the complete order publication lifecycle: validate → extract tasks → create records → mark published → notify
- `BoardSummary` aggregates task completion percentages by status, role, and exercise phase with N+1-safe batch phase lookup
- Task reassignment with MessageBus `exercise.task.reassigned` event
- Full information barrier enforcement: `visibleTeams` parameter gates both document loading and order visibility in every method

## Task Commits

1. **Task 1: Exercise Order Generator** - `13e1d13` (feat)
2. **Task 2: Planning Board Service** - `d859d74` (feat)

## Files Created/Modified

- `backend/src/exercise/order-generator.ts` (720 lines) — ExerciseOrderGenerator class with WARNORD/OPORD/FRAGO generation, manual draft creation, and content update
- `backend/src/exercise/planning-board-service.ts` (403 lines) — PlanningBoardService with publishOrder, updateTaskStatus, getBoardSummary, reassignTask; BoardSummary type export
- `backend/src/exercise/task-store.ts` — Added `updateAssignedRole(id, newRole)` method
- `backend/src/exercise/index.ts` — Added barrel exports for ExerciseOrderGenerator, PlanningBoardService, OrderGeneratorLLMConfig, BoardSummary

## Decisions Made

- **MessageBus channel routing:** Used `destinationType: 'channel'` with `exercise.{scenarioId}` as target rather than broadcast — allows per-exercise subscriptions and prevents cross-scenario event leakage
- **MessageBus error handling:** Publish errors are caught and logged, not re-thrown — order publication and task status updates are transactional; notifications are advisory
- **LLMProvider injection:** Constructor accepts `{ provider: LLMProvider }` or `{ config: ProviderConfig }` — decouples from singleton and enables testing with mock providers
- **TaskStore.updateAssignedRole:** Added as a minimal SQL update (no full reload) — keeps the store's method surface minimal while supporting reassignment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added TaskStore.updateAssignedRole() method**
- **Found during:** Task 2 (PlanningBoardService — reassignTask implementation)
- **Issue:** Plan specified `taskStore.updateAssignedRole` but TaskStore had no such method — only `updateStatus` existed
- **Fix:** Added `updateAssignedRole(id: string, newRole: string): Promise<void>` SQL UPDATE to task-store.ts
- **Files modified:** `backend/src/exercise/task-store.ts`
- **Verification:** TypeScript compiles, method used in planning-board-service.ts reassignTask()
- **Committed in:** d859d74 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix was necessary for plan correctness — reassignTask cannot work without a store method to update the role column.

## Issues Encountered

None — TypeScript compiled cleanly on first pass for both new files. The `extraction-service.ts` TypeScript error (from plan 02) was already fixed in its committed version; a local filesystem state anomaly caused it to appear during verification but resolved without intervention.

## Next Phase Readiness

- Order generator and planning board are ready for API route wiring (plan 05 or 06)
- `ExerciseOrderGenerator` and `PlanningBoardService` both available via `backend/src/exercise/index.ts` barrel export
- MessageBus channel events `exercise.order.published`, `exercise.task.completed`, `exercise.task.reassigned` are defined and firing
- No blockers

---
*Phase: 14-friendly-adversary-ipb-complete-cycle*
*Completed: 2026-02-28*

## Self-Check: PASSED

- FOUND: backend/src/exercise/order-generator.ts
- FOUND: backend/src/exercise/planning-board-service.ts
- FOUND: .planning/phases/14-friendly-adversary-ipb-complete-cycle/14-04-SUMMARY.md
- FOUND: commit 13e1d13 (Task 1)
- FOUND: commit d859d74 (Task 2)
