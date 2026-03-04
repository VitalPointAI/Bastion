---
phase: 19-workspace-membership-and-invite-system
plan: 01
subsystem: database
tags: [workspace, dao, near, postgres, typescript, military-roles, hierarchy]

# Dependency graph
requires:
  - phase: 4-mission-management
    provides: singleton store pattern (invite-store.ts, participant-store.ts)
  - phase: 10-dao-governance
    provides: DAO types (Classification, AutonomyLevel, Role) and tx-signer infrastructure
provides:
  - Workspace type system with military hierarchy (Organization/Unit/Team)
  - WorkspaceStore with CRUD, hierarchy CTE query, and exercise_scenarios FK migration
  - WorkspaceRoleStore with military template auto-init and custom role management
  - Foundation for all subsequent workspace plans (members, invites, API routes)
affects:
  - 19-02 (workspace member store depends on workspace types and workspaces table)
  - 19-03 (invite store depends on workspaces table and WorkspaceClassification type)
  - 19-04 (API routes import workspaceStore, workspaceRoleStore)
  - exercise-system (exercise_scenarios.workspace_id FK now exists)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Singleton store class with ensureInitialized() lazy table creation
    - snake_case DB columns mapped to camelCase TypeScript via private mapRow helper
    - Recursive CTE for workspace hierarchy traversal
    - Military label to DAO role name separation (presentation vs authority layer)

key-files:
  created:
    - backend/src/workspace/types.ts
    - backend/src/workspace/workspace-store.ts
    - backend/src/workspace/workspace-role-store.ts
  modified: []

key-decisions:
  - "Workspace = DAO is the core invariant — workspaceStore.createWorkspace() does NOT trigger on-chain creation; API routes are responsible"
  - "DAO ID includes UUID suffix (ws-org-{uuid}) to prevent naming collisions on-chain"
  - "Military labels are presentation layer; DAO role names (council/member/agent) are the authority layer stored separately"
  - "MILITARY_ROLE_TEMPLATES covers Organization (11 roles), Unit (5 roles), Team (3 roles)"
  - "exercise_scenarios.workspace_id FK added in workspace table init migration (nullable — existing exercises unaffected)"

patterns-established:
  - "WorkspaceStore singleton pattern: class with private initialized flag, ensureInitialized() creates table on first use, export const workspaceStore = new WorkspaceStore()"
  - "Row mapping pattern: private mapRow(row: XRow): X helper converts snake_case to camelCase"
  - "Hierarchy query: recursive CTE WITH RECURSIVE workspace_tree AS (...) for full descendant traversal"

requirements-completed: [WS-MODEL, WS-HIERARCHY, WS-ROLES]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 19 Plan 01: Workspace Type System and Store Foundation Summary

**PostgreSQL workspace tables with military hierarchy types, MILITARY_ROLE_TEMPLATES for Organization/Unit/Team, and singleton stores for CRUD and role template initialization**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T15:08:15Z
- **Completed:** 2026-03-04T15:12:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created complete workspace type system covering all entities: Workspace, WorkspaceMember, WorkspaceInvite, WorkspaceActivity, WorkspaceCompartment, WorkspaceRole, CreateWorkspaceInput
- Implemented MILITARY_ROLE_TEMPLATES with 19 total roles across Organization (11), Unit (5), and Team (3) workspace types
- Built WorkspaceStore with workspaces table DDL, full CRUD, and recursive CTE hierarchy query; migration adds workspace_id FK to exercise_scenarios
- Built WorkspaceRoleStore with workspace_roles table DDL and initRolesForWorkspace() that auto-creates military templates on workspace setup
- Full backend TypeScript compilation passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workspace type definitions and constants** - `7d3d85b` (feat)
2. **Task 2: Create workspace store with DAO on-chain integration and role store** - `39904cd` (feat)

**Plan metadata:** `426d466` (docs: complete plan)

## Files Created/Modified
- `backend/src/workspace/types.ts` - All workspace type definitions, MILITARY_ROLE_TEMPLATES constant, CLEARANCE_LEVELS, and clearanceSufficient() utility
- `backend/src/workspace/workspace-store.ts` - WorkspaceStore singleton with workspaces table creation and CRUD (createWorkspace, getWorkspace, getWorkspaceByDaoId, listChildWorkspaces, listWorkspacesByType, updateWorkspace, getHierarchy)
- `backend/src/workspace/workspace-role-store.ts` - WorkspaceRoleStore singleton with workspace_roles table creation (initRolesForWorkspace, getRolesForWorkspace, getRoleByLabel, addCustomRole, removeRole)

## Decisions Made
- `createWorkspace()` does NOT trigger on-chain DAO creation — per plan spec, the API route handles on-chain calling; the store only manages the off-chain PostgreSQL record. This keeps store concerns separated from network I/O.
- DAO ID generated as `ws-${workspaceType.toLowerCase()}-${randomUUID()}` to prevent naming collisions (Pitfall 6 from RESEARCH.md)
- `ON CONFLICT (workspace_id, military_label) DO NOTHING` in `initRolesForWorkspace()` makes the method idempotent — safe to call multiple times without errors
- `exercise_scenarios.workspace_id` FK migration uses `ADD COLUMN IF NOT EXISTS` so it is safe to re-run after the table already exists

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Node 12 (system) cannot run TypeScript 5.9 (`node --version` returned v12.22.9 in shell context); resolved by using `~/.nvm/versions/node/v20.18.0/bin/node` to invoke tsc directly

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `backend/src/workspace/types.ts` exports are ready for import by all subsequent workspace stores
- `workspaces` table DDL is ready — plan 19-02 (workspace-member-store) can reference workspaces(id) FK immediately
- `workspace_roles` table is ready — role assignment in plan 19-03+ can query roles for validation
- `exercise_scenarios.workspace_id` FK exists — exercises can be scoped to workspaces without further migration

---
*Phase: 19-workspace-membership-and-invite-system*
*Completed: 2026-03-04*
