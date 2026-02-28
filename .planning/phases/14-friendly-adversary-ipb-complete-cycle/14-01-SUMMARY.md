---
phase: 14-friendly-adversary-ipb-complete-cycle
plan: "01"
subsystem: exercise-data-model
tags: [exercise, ipb, information-barrier, data-model, postgresql, zod]
dependency_graph:
  requires: []
  provides:
    - backend/src/exercise/types.ts
    - backend/src/exercise/schemas.ts
    - backend/src/exercise/information-barrier.ts
    - backend/src/exercise/scenario-store.ts
    - backend/src/exercise/document-store.ts
    - backend/src/exercise/ipb-store.ts
    - backend/src/exercise/coa-store.ts
    - backend/src/exercise/order-store.ts
    - backend/src/exercise/task-store.ts
    - backend/src/exercise/gate-store.ts
    - backend/src/exercise/index.ts
    - backend/database/014-exercise-tables.sql
  affects: []
tech_stack:
  added: []
  patterns:
    - "Information barrier: getVisibleTeams(role) returns SQL-passable team array"
    - "All team-filtered queries use AND team = ANY($N) parameterized arrays"
    - "IPB version history via parentVersionId self-referential FK chain"
    - "Zod v4 API: z.record(z.string(), z.unknown()) for JSONB-mapped fields"
key_files:
  created:
    - backend/src/exercise/types.ts
    - backend/src/exercise/schemas.ts
    - backend/src/exercise/information-barrier.ts
    - backend/src/exercise/scenario-store.ts
    - backend/src/exercise/document-store.ts
    - backend/src/exercise/ipb-store.ts
    - backend/src/exercise/coa-store.ts
    - backend/src/exercise/order-store.ts
    - backend/src/exercise/task-store.ts
    - backend/src/exercise/gate-store.ts
    - backend/src/exercise/index.ts
    - backend/database/014-exercise-tables.sql
  modified: []
decisions:
  - "GateStore has no team filter — gates are visible to all participants; only exercise_control can open them via API authorization"
  - "IPBAssessment version history uses parentVersionId chain rather than separate versions table — simpler and avoids JOIN for most queries"
  - "SQL migration placed in backend/database/ (matching existing schema.sql location) rather than a migrations/ subdirectory that does not exist"
  - "Zod v4 requires z.record(keySchema, valueSchema) — updated all JSONB field schemas accordingly"
metrics:
  duration: 7 min
  completed: 2026-02-28T19:56:27Z
  tasks_completed: 2
  tasks_total: 2
  files_created: 12
  files_modified: 0
---

# Phase 14 Plan 01: Exercise Data Model Summary

**One-liner:** Dual-team (blue/red/controller) exercise data architecture with information barrier middleware, 7 PostgreSQL tables, 7 data stores, and full Zod v4 validation for the complete exercise domain model.

## What Was Built

Created the complete `backend/src/exercise/` module that forms the foundation for all Phase 14 plans:

### Task 1: Types, Schemas, Information Barrier, SQL Migration

**`backend/src/exercise/types.ts`** (348 lines) — All exercise TypeScript types:
- `ExerciseScenario` — parent entity with phase progression tracking
- `ScenarioDocument` — ingested PDFs/DOCX/PPTX with team assignment
- `IPBAssessment` — IPB with OAKOC, NAIs, force dispositions, overlay layers, and version chain
- `IPBLayer` — GeoJSON layer with MIL-STD-2525D SIDC support for ValidityMap
- `ScenarioCOA` — COA with FASDC doctrinal scores, wargame evidence, commander decision workflow
- `ExerciseOrder` — WARNORD/OPORD/FRAGO with typed content structures
- `PlanningTask` — role-assigned tasks from orders with status tracking
- `ExerciseGate` — phase transition and information release control

**`backend/src/exercise/schemas.ts`** (241 lines) — Zod v4 schemas for all create/update operations using `z.record(z.string(), z.unknown())` for JSONB-mapped fields.

**`backend/src/exercise/information-barrier.ts`** (73 lines) — Core isolation mechanism:
- `getVisibleTeams(role)`: exercise_control → ['blue', 'red', 'controller'], blue_staff → ['blue', 'controller'], red_cell → ['red', 'controller']
- `withExerciseBarrier` Express middleware: sets `req.visibleTeams` and `req.exerciseRole`
- Express global type augmentation for `Request.visibleTeams` and `Request.exerciseRole`

**`backend/database/014-exercise-tables.sql`** (213 lines) — 7 tables with:
- FK cascades from children to exercise_scenarios
- CHECK constraints on team, designation, status, order_type, gate_type
- JSONB for overlay_layers, doct_scores, wargame_evidence, content, extracted_data
- Composite `(scenario_id, team)` indexes on every team-filtered table
- Self-referential FK on ipb_assessments.parent_version_id for version history

### Task 2: Seven Data Stores and Module Index

All stores constructed with `getPool()` pattern matching existing codebase. Every method that returns team-specific data accepts `visibleTeams: string[]` and enforces `AND team = ANY($N)`.

| Store | Key Methods |
|-------|-------------|
| `ScenarioStore` | create, findById, findAll, update, advancePhase, delete |
| `ScenarioDocumentStore` | create, findByScenario, findByScenarioAndPhase, findById, updateExtraction, countByScenario |
| `IPBStore` | create, findByScenario, findByScenarioAndPerspective, findById, createNewVersion, getVersionHistory |
| `COAStore` | create, findByScenario, findById, updateScores, updateWargameEvidence, recordDecision, updateDecisionHash, updateBlockchainTx, updateNarrative |
| `OrderStore` | create, findByScenario, findById, updateContent, markPublished, findByPhase |
| `TaskStore` | create, findByScenario, findByOrder, findByRole, updateStatus, findById |
| `GateStore` | create, findByScenario, findByPhase, openGate, isPhaseReady |

**`backend/src/exercise/index.ts`** — Barrel export of all types, schemas, stores, and information barrier utilities.

## Verification

- `npx tsc --noEmit --project backend/tsconfig.json` — PASS, zero errors
- All 11 files present in `backend/src/exercise/`
- All team-filtered queries verified to include `AND team = ANY($N)` (22 occurrences)
- SQL migration creates all 7 tables with correct FKs, indexes, and constraints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 API compatibility**
- **Found during:** Task 1 initial TypeScript check
- **Issue:** Schemas used `z.record(z.unknown())` (1 arg) which is invalid in Zod v4; requires `z.record(keySchema, valueSchema)` (2 args)
- **Fix:** Updated all JSONB-mapped record fields to `z.record(z.string(), z.unknown())`
- **Files modified:** `backend/src/exercise/schemas.ts`
- **No separate commit** — fixed before first commit

**2. [Rule 3 - Blocking] SQL migration path**
- **Found during:** Task 1
- **Issue:** Plan specified `backend/db/migrations/014-exercise-tables.sql` but the existing directory is `backend/database/` (matching schema.sql location) — no `db/` or `migrations/` subdirectory exists
- **Fix:** Created migration at `backend/database/014-exercise-tables.sql` matching the actual project structure
- **Files modified:** Path only — content unchanged

## Self-Check: PASSED

All 12 created files verified present on disk.
Task commits 0c0146d and 39192d9 verified in git log.
