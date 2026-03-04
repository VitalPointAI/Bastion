---
phase: 19-workspace-membership-and-invite-system
plan: 03
subsystem: api
tags: [express, typescript, workspace, rest-api, zod, near, dao, membership, invites, roles]

# Dependency graph
requires:
  - phase: 19-workspace-membership-and-invite-system
    plan: 01
    provides: WorkspaceStore, WorkspaceRoleStore with military templates
  - phase: 19-workspace-membership-and-invite-system
    plan: 02
    provides: WorkspaceMemberStore, WorkspaceInviteStore, WorkspaceActivityStore

provides:
  - Complete REST API for workspace operations at /api/workspaces
  - 19 endpoints for workspace CRUD, membership, invites, roles, and activity
  - On-chain DAO creation and member management via signAndSubmitFunctionCall
  - Clearance-gated invite acceptance with gated workspace pending approval flow
  - Zod validation on all mutation endpoints

affects: [frontend-workspace-ui, workspace-membership, workspace-roles, workspace-invites]

# Tech tracking
tech-stack:
  added: [zod (already present, applied to workspace schemas)]
  patterns:
    - Permission helper pattern (checkPermission async function with role store lookup)
    - Gated invite flow (202 Accepted for pending-approval gated workspaces)
    - Route ordering: static routes before parametric routes (/me, /invite/accept, /notifications/counts before /:id)

key-files:
  created:
    - backend/src/api/workspaces.ts
  modified:
    - backend/src/index.ts

key-decisions:
  - "Static routes (GET /me, POST /invite/accept, PUT /me/primary, POST /notifications/counts) registered before parametric /:id routes to prevent route shadowing"
  - "deriveUserSecret is a simple HKDF-like derivation from DID_SECRET_SEED + accountId since the plan spec used signAndSubmitFunctionCall(userSecret, ...) pattern"
  - "AI agent membership handled identically to human DIDs at the API layer per locked decision; max_agent_tier from dao/types Role interface available for future tier enforcement"
  - "DAO_CONTRACT_ID env var used for all on-chain DAO calls (create_dao, set_dao_parent, add_member, remove_member, assign_role)"

patterns-established:
  - "Permission pattern: checkPermission(workspaceId, userDid, permission) throws 403 via err.code; routes catch and return 403"
  - "ZodError.issues (not .errors) for validation error details in TypeScript strict mode"
  - "On-chain + off-chain dual write: sign DAO tx first, then write PostgreSQL record"

requirements-completed: [WS-MODEL, WS-MEMBERSHIP, WS-INVITES, WS-HIERARCHY, WS-ROLES, WS-ACTIVITY-LOG, WS-CLEARANCE]

# Metrics
duration: 10min
completed: 2026-03-04
---

# Phase 19 Plan 03: Workspace REST API Summary

**Express Router with 19 endpoints wiring all workspace stores to HTTP — CRUD, membership, invites, roles, activity, and on-chain DAO operations**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-04T15:15:00Z
- **Completed:** 2026-03-04T15:25:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `backend/src/api/workspaces.ts` with 19 REST endpoints for the complete workspace API surface
- All endpoints protected by requireAuth middleware and wrapped in try/catch with proper HTTP status codes
- On-chain DAO operations triggered for workspace create (`create_dao`, `set_dao_parent`), member add (`add_member`), member remove (`remove_member`), and role change (`assign_role`)
- Activity logged to `workspace_activity` for all mutations (workspace_created, member_joined, role_changed, member_suspended, member_unsuspended, invite_sent, invite_approved, invite_cancelled, member_removed, workspace_updated)
- Clearance gating in invite accept handler; gated workspace 202 pending approval flow
- Registered router at `/api/workspaces` in `backend/src/index.ts` adjacent to missionRouter
- Full TypeScript compilation passes with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workspace REST API router with all endpoints** - `5d46ad3` (feat)
2. **Task 2: Register workspace routes in Express app** - `68f1843` (feat)

## Files Created/Modified
- `backend/src/api/workspaces.ts` - Complete Express Router with 19 workspace API endpoints
- `backend/src/index.ts` - Added workspacesRouter import and app.use('/api/workspaces') registration

## Decisions Made
- Static routes (`/me`, `/invite/accept`, `/me/primary`, `/notifications/counts`) registered before the parametric `/:id` routes to prevent Express route shadowing — this is correct Express ordering
- `deriveUserSecret` derives from `DID_SECRET_SEED` env var + accountId since `signAndSubmitFunctionCall` takes a `Uint8Array` user secret; aligns with how existing code in tx-signer.ts works
- `ZodError.issues` used instead of `.errors` — the `.errors` accessor does not exist directly on `ZodError<unknown>` in TypeScript strict mode; `.issues` is the correct property
- User clearance cast via `(req.anonUser as unknown as Record<string, unknown>)?.clearance` to satisfy TypeScript since `AnonUser` type does not expose a string index signature

## Deviations from Plan

None - plan executed exactly as written. Minor TypeScript type fixes applied inline (ZodError.issues, AnonUser cast) to satisfy strict mode — these are not behavioral deviations.

## Issues Encountered
- TypeScript strict mode: `ZodError` does not expose `.errors` property directly (only `.issues`). Fixed inline in all three validation handlers.
- TypeScript strict mode: `req.anonUser` typed as `AnonUser` without string index signature, requiring double cast through `unknown` for clearance field lookup. Fixed inline.

## Next Phase Readiness
- `/api/workspaces` is fully operational — all 19 endpoints wired to Phase 19-01 and 19-02 stores
- Frontend workspace UI (Phase 19-04 or later) can consume this API surface
- Clearance enforcement currently assumes `UNCLASSIFIED` for users without an explicit clearance field on `AnonUser`; a future user-profile integration can populate `req.anonUser.clearance`

---
*Phase: 19-workspace-membership-and-invite-system*
*Completed: 2026-03-04*
