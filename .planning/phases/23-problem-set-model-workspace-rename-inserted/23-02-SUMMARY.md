---
phase: 23-problem-set-model-workspace-rename-inserted
plan: 02
subsystem: database
tags: [postgresql, migration, schema-rename, problem-set, echelon]

# Dependency graph
requires:
  - phase: 19-workspace-membership
    provides: workspace tables and store init functions
  - phase: 20-workspace-panels
    provides: panel config, subscription, escalation, data cache tables
  - phase: 22-training-operational-mode
    provides: mode column on workspaces table
provides:
  - "Complete SQL migration for 12 workspace->problem_set table renames"
  - "Echelon column with value migration (Organization->strategic, Unit->operational, Team->tactical)"
  - "problem_statement column on problem_sets table"
  - "Updated off-chain ID prefixes (WS->PS, WM->PM, WI->PI, WA->PA, WKS->GPS)"
  - "All 10 store files updated to use new table/column names in SQL strings"
affects: [23-03, 23-04, 23-05, 23-06, 23-07, 23-08, 23-09, 23-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic PostgreSQL migration using ALTER TABLE RENAME preserving FK relationships"
    - "Off-chain ID prefix convention: PS- for problem sets, PM- for members, PI- for invites, PA- for activity, GPS- for graph problem sets"

key-files:
  created:
    - "backend/src/db/migrations/023-workspace-to-problem-set.sql"
  modified:
    - "backend/src/workspace/workspace-store.ts"
    - "backend/src/workspace/workspace-member-store.ts"
    - "backend/src/workspace/workspace-invite-store.ts"
    - "backend/src/workspace/workspace-activity-store.ts"
    - "backend/src/workspace/workspace-role-store.ts"
    - "backend/src/workspace/workspace-compartment-store.ts"
    - "backend/src/workspace/workspace-panel-config-store.ts"
    - "backend/src/workspace/workspace-subscription-store.ts"
    - "backend/src/workspace/workspace-escalation-store.ts"
    - "backend/src/graph/workspace/store.ts"

key-decisions:
  - "Used ALTER TABLE IF EXISTS for idempotent migration safety"
  - "Migrated echelon values inline: Organization->strategic, Unit->operational, Team->tactical"
  - "Updated FK references in correct order (parent IDs before child FK columns)"

patterns-established:
  - "DB migration pattern: single transaction with table renames, column renames, value migration, ID prefix updates, and index renames"

requirements-completed: [PS-DB-MIGRATION, PS-ECHELON-DB, PS-ID-PREFIX]

# Metrics
duration: 11min
completed: 2026-03-06
---

# Phase 23 Plan 02: Database Migration & Store SQL Updates Summary

**PostgreSQL migration renaming 12 workspace tables to problem_set equivalents with echelon column, value migration, and ID prefix updates across all 10 backend stores**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-06T02:20:35Z
- **Completed:** 2026-03-06T02:31:48Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Created comprehensive SQL migration covering all 12 workspace tables renamed to problem_set equivalents
- Migrated workspace_type values to echelon terminology (strategic/operational/tactical)
- Updated all 10 backend store files so CREATE TABLE IF NOT EXISTS and all SQL queries use new schema
- Updated off-chain ID prefixes (WS->PS, WM->PM, WI->PI, WA->PA, WKS->GPS)
- Added problem_statement TEXT column to problem_sets table

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration script** - `6666327` (feat)
2. **Task 2: Update all backend store init functions to use new table names** - `61f4532` (feat)

## Files Created/Modified
- `backend/src/db/migrations/023-workspace-to-problem-set.sql` - Complete migration script (86 ALTER/UPDATE operations)
- `backend/src/workspace/workspace-store.ts` - Main problem_sets table queries updated
- `backend/src/workspace/workspace-member-store.ts` - problem_set_members queries updated
- `backend/src/workspace/workspace-invite-store.ts` - problem_set_invites queries updated
- `backend/src/workspace/workspace-activity-store.ts` - problem_set_activity queries updated
- `backend/src/workspace/workspace-role-store.ts` - problem_set_roles queries updated
- `backend/src/workspace/workspace-compartment-store.ts` - problem_set_compartments and problem_set_member_compartments queries updated
- `backend/src/workspace/workspace-panel-config-store.ts` - problem_set_panel_config queries updated
- `backend/src/workspace/workspace-subscription-store.ts` - problem_set_subscriptions and problem_set_data_cache queries updated
- `backend/src/workspace/workspace-escalation-store.ts` - problem_set_escalation_rules queries updated
- `backend/src/graph/workspace/store.ts` - graph_problem_sets queries updated

## Decisions Made
- Used ALTER TABLE IF EXISTS for idempotent migration safety
- Migrated echelon values inline within the same transaction as table renames
- Updated FK references in correct order: parent problem_sets.id first, then child table FK columns
- Left osint_events.workspace_id as-is since it belongs to a separate subsystem (deferred)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Database migration script ready to execute against PostgreSQL
- All store init functions reference new table/column names
- Ready for Plan 03: backend TypeScript type renames and file renames

---
*Phase: 23-problem-set-model-workspace-rename-inserted*
*Completed: 2026-03-06*
