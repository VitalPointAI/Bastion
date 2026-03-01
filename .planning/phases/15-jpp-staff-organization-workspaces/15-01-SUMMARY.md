---
phase: 15-jpp-staff-organization-workspaces
plan: 01
subsystem: exercise-backend
tags: [database, api, staff-workspaces, notifications, strategic-import]
dependency_graph:
  requires: []
  provides:
    - staff_products table (CRUD via StaffProductStore)
    - staff_notifications table (publish-to-notify via StaffNotificationService)
    - agent_team_config table (per-role agent team overrides)
    - enabled_roles column on exercise_scenarios
    - REST API at /api/exercise/scenarios/:id/staff-products/*
    - REST API at /api/exercise/scenarios/:id/staff-notifications/*
    - REST API at /api/exercise/scenarios/:id/import-strategic-direction
    - REST API at /api/exercise/scenarios/:id/enabled-roles
    - REST API at /api/exercise/scenarios/:id/agent-team-config
  affects:
    - backend/src/api/exercise.ts (new routes added)
    - backend/src/exercise/scenario-store.ts (enabledRoles field)
tech_stack:
  added:
    - StaffProductStore (PostgreSQL CRUD)
    - StaffNotificationService (publish pipeline + MessageBus)
    - StrategicImportService (direct store import pattern)
  patterns:
    - randomUUID() for ID generation
    - Pool-based store pattern (consistent with existing stores)
    - MessageBus channel publish for real-time events
    - Direct store import instead of HTTP calls for Design tab data
key_files:
  created:
    - backend/database/016-staff-workspaces.sql
    - backend/src/exercise/staff-product-store.ts
    - backend/src/exercise/staff-notification-service.ts
    - backend/src/exercise/strategic-import-service.ts
  modified:
    - backend/src/exercise/types.ts (StaffProduct, StaffNotification, AgentTeamConfig, STAFF_ROLE_CONFIG, STAFF_PRESET_TEMPLATES, PRODUCT_TYPE_REGISTRY, enabledRoles on ExerciseScenario)
    - backend/src/exercise/scenario-store.ts (enabledRoles field in CRUD)
    - backend/src/api/exercise.ts (15 new routes + updated POST /scenarios)
decisions:
  - Used direct store imports in StrategicImportService (not HTTP) per research pitfall #6
  - enabledRoles defaults to core_staff preset on scenario creation (not full_joint_staff)
  - STAFF_ROLE_CONFIG is the single source of truth for 31 roles — no enums/strings duplicated
  - Publish pipeline fans out notifications to all enabled roles in a single batch INSERT
  - MessageBus events are advisory (try/catch, non-blocking) — notifications persist in DB regardless
  - DiffSnapshot computed at publish time vs previous version (not stored separately)
metrics:
  duration: 13 minutes
  completed: 2026-03-01
  tasks_completed: 2
  files_created: 4
  files_modified: 3
---

# Phase 15 Plan 01: Staff Workspace Backend Foundation Summary

PostgreSQL schema + TypeScript types + StaffProductStore/StaffNotificationService/StrategicImportService + 15 REST routes providing full CRUD for JPP staff workspace products, publish-to-notify pipeline, and Design tab strategic import.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Database migration (016-staff-workspaces.sql) + TypeScript types | 4733ffd |
| 2 | Backend stores, services, and REST routes | efb2c47 |

## What Was Built

### Database Layer (Task 1)

**`backend/database/016-staff-workspaces.sql`** creates:

- `staff_products` — 15 columns including structured JSONB, content TEXT, status, version, and published_at/published_by. Indexes on (scenario_id, role_key), (scenario_id, role_key, product_type), and (scenario_id, status).
- `staff_notifications` — Cross-role notifications with diff_snapshot JSONB, is_read, is_integrated flags. Index on (scenario_id, target_role, is_read) for badge count queries.
- `agent_team_config` — Per-role (and per-product-type override) agent team assignments. UNIQUE on (scenario_id, role_key, product_type) enabling upsert.
- `ALTER TABLE exercise_scenarios ADD COLUMN IF NOT EXISTS enabled_roles TEXT[]` — defaults to all 31 roles.

### TypeScript Types (Task 1)

Added to `backend/src/exercise/types.ts`:
- `StaffProduct`, `StaffNotification`, `AgentTeamConfig` interfaces
- `CreateStaffProductInput`, `UpdateStaffProductInput`, `DiffSnapshot` interfaces
- `STAFF_ROLE_CONFIG` — 31 roles organized into 6 categories (Command 2, J-Staff 11, Special Staff 4, Supporting Elements 7, Component Commands 4, Additional Elements 3)
- `STAFF_PRESET_TEMPLATES` — full_joint_staff (31), core_staff (9), intel_focus (6)
- `PRODUCT_TYPE_REGISTRY` — all doctrinal product types with structured field definitions

### Backend Services (Task 2)

**`StaffProductStore`** — 9 methods:
- `create()`, `findByRole()`, `findById()`, `findOne()`, `findByScenario()`
- `update()`, `publish()` (increments version), `findPublishedForScenario()`, `delete()`

**`StaffNotificationService`** — 7 methods:
- `publishProduct()` — publishes product → computes diff → batch INSERTs notifications for all enabled roles → publishes MessageBus event on `exercise.staff.{scenarioId}` channel
- `getNotifications()`, `getUnreadCount()`, `markRead()`, `markIntegrated()`, `getAllNotifications()`

**`StrategicImportService`** — 1 method:
- `importToCommanderWorkspace()` — queries approved objectives from ObjectiveStore + latest intent from IntentStore → builds structured JSON and markdown narrative → upserts Commander strategic_guidance product

### REST Routes (Task 2)

15 new routes added to `backend/src/api/exercise.ts`:

**Staff Products:**
- `GET /scenarios/:id/staff-products` (roleKey filter optional)
- `GET /scenarios/:id/staff-products/:productId`
- `POST /scenarios/:id/staff-products`
- `PUT /scenarios/:id/staff-products/:productId`
- `POST /scenarios/:id/staff-products/:productId/publish`
- `DELETE /scenarios/:id/staff-products/:productId`

**Staff Notifications:**
- `GET /scenarios/:id/staff-notifications` (roleKey + unreadOnly filters)
- `GET /scenarios/:id/staff-notifications/count` (roleKey required)
- `PUT /scenarios/:id/staff-notifications/:notificationId/read`
- `PUT /scenarios/:id/staff-notifications/:notificationId/integrate`

**Strategic Import + Config:**
- `POST /scenarios/:id/import-strategic-direction`
- `PUT /scenarios/:id/enabled-roles`
- `GET /scenarios/:id/agent-team-config` (roleKey filter optional)
- `PUT /scenarios/:id/agent-team-config` (upsert)
- `DELETE /scenarios/:id/agent-team-config/:configId`

Also updated `POST /scenarios` to accept `enabledRoles` (defaults to `core_staff` preset).

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- Database migration ran cleanly against coalition_ops
- All 3 tables verified with `\d` in psql
- `enabled_roles` column confirmed on `exercise_scenarios`
- DB-level test: INSERT product, publish (version increments to 2), create notification, COUNT unread — all passed

## Deviations from Plan

**1. [Rule 2 - Missing Field] Added `findPreviousVersion()` to StaffProductStore**
- Found during: Task 2 (StaffNotificationService.computeDiff implementation)
- Issue: The diff computation needs to query the previous version of a product, which wasn't in the original StaffProductStore method list
- Fix: Added `findPreviousVersion(scenarioId, roleKey, productType, currentVersion)` that queries the DB for the highest version below current
- Files modified: `backend/src/exercise/staff-product-store.ts`

**2. [Rule 2 - Missing Functionality] Added `findByScenario()` to StaffProductStore**
- Found during: Task 2 (GET /staff-products route needs to return all products when no roleKey filter)
- Issue: The route handler needed a method to return all products across roles for a scenario
- Fix: Added `findByScenario(scenarioId)` ordered by role_key and created_at
- Files modified: `backend/src/exercise/staff-product-store.ts`

**3. [Rule 1 - Bug] Made `enabledRoles` optional in `CreateExerciseScenario` type**
- Found during: Task 1 (TypeScript compilation)
- Issue: Adding `enabledRoles` as required on `ExerciseScenario` caused a TS error in the existing POST /scenarios handler which didn't include it
- Fix: Changed `CreateExerciseScenario` to make `enabledRoles` optional (`enabledRoles?: string[]`); DB column has a default of all 31 roles
- Files modified: `backend/src/exercise/types.ts`

## Self-Check: PASSED

All files created and commits verified:

| Item | Status |
|------|--------|
| `backend/database/016-staff-workspaces.sql` | FOUND |
| `backend/src/exercise/staff-product-store.ts` | FOUND |
| `backend/src/exercise/staff-notification-service.ts` | FOUND |
| `backend/src/exercise/strategic-import-service.ts` | FOUND |
| `.planning/phases/15-.../15-01-SUMMARY.md` | FOUND |
| Commit 4733ffd (Task 1) | FOUND |
| Commit efb2c47 (Task 2) | FOUND |
