---
phase: 19-workspace-membership-and-invite-system
plan: "02"
subsystem: backend/workspace
tags: [workspace, membership, invites, activity-log, postgresql, singleton-stores]
dependency_graph:
  requires: [19-01]
  provides: [workspace-member-store, workspace-invite-store, workspace-activity-store]
  affects: [19-03-api-layer, frontend-workspace-context]
tech_stack:
  added: []
  patterns:
    - ensureInitialized lazy-init singleton store
    - SHA-256 token hashing (raw token returned, hash stored)
    - transactional setPrimary for race-condition safety
    - partial unique index for one-primary-per-user DB invariant
    - single CASE/WHEN query for cross-workspace unread counts
key_files:
  created:
    - backend/src/workspace/workspace-member-store.ts
    - backend/src/workspace/workspace-invite-store.ts
    - backend/src/workspace/workspace-activity-store.ts
  modified: []
decisions:
  - Agent DIDs accepted identically to human DIDs in member store; API layer enforces max_agent_tier limits
  - setPrimary uses explicit transaction (BEGIN/COMMIT) not a single-query UPDATE to avoid race conditions
  - getUnreadCountsForUser uses single CASE/WHEN query for efficiency across N workspaces
  - dao_role column added to workspace_invites table (not in original research schema) to carry DAO role assignment through invite acceptance
metrics:
  duration: "8 min"
  completed: "2026-03-04"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 19 Plan 02: Workspace Member, Invite, and Activity Stores Summary

**One-liner:** Three singleton stores for workspace membership CRUD with transactional primary management, SHA-256 token invite lifecycle, and off-chain activity logging with cross-workspace unread counts.

## What Was Built

### workspace-member-store.ts

`WorkspaceMemberStore` provides full member CRUD for the `workspace_members` PostgreSQL table:

- `addMember` — inserts member, auto-sets `is_primary = true` if this is the user's first workspace
- `getMember` / `getMemberById` / `listMembers` / `listMemberships` — standard read operations
- `updateRole` — updates both military label and DAO role name atomically
- `setPrimary` — transactional: clears old primary, sets new one (no race condition)
- `suspendMember` / `unsuspendMember` — preserves membership while revoking/restoring access
- `removeMember` — hard delete
- `getMemberCount` — total count for a workspace

Schema enforcements:
- `UNIQUE(workspace_id, user_did)` — no duplicate members
- `CREATE UNIQUE INDEX ... WHERE is_primary = true` — DB-level one-primary-per-user invariant

### workspace-invite-store.ts

`WorkspaceInviteStore` provides token-based invite lifecycle for the `workspace_invites` table:

- Token generation: `randomBytes(32).toString('base64url')` (raw) + `createHash('sha256').digest('hex')` (stored)
- `createInvite` — returns `{ invite, rawToken }` where raw token is for the invite link, hash is stored
- `getInviteByToken` — hashes raw token for lookup; only returns non-expired, non-accepted invites
- `listInvitesForWorkspace` / `listPendingInvites` — listing with appropriate filters
- `markAccepted` / `markApproved` — lifecycle state transitions
- `cancelInvite` — hard delete
- `cleanupExpired` — batch cleanup returning count deleted

Note: `dao_role` column added to `workspace_invites` table to carry the DAO role through invite acceptance (not in research schema but required for `addMember` call).

### workspace-activity-store.ts

`WorkspaceActivityStore` provides the off-chain activity log for the `workspace_activity` table:

- `log` — insert any activity type with actor, subject, metadata, optional tx hash
- `listActivities` — paginated list with optional type filter, newest first
- `listActivitiesForUser` — cross-workspace activities where user is actor or subject
- `getUnreadCount` — count activities since a timestamp for one workspace
- `getUnreadCountsForUser` — single `CASE/WHEN` query for N workspaces (efficient badge polling)

12 activity types documented in module comment:
`workspace_created`, `member_joined`, `member_removed`, `member_suspended`, `member_unsuspended`, `role_changed`, `invite_sent`, `invite_accepted`, `invite_cancelled`, `mission_created`, `exercise_created`, `workspace_updated`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | e05ffb7 | feat(19-02): implement WorkspaceMemberStore with primary workspace management |
| Task 2 | 443abf5 | feat(19-02): implement WorkspaceInviteStore and WorkspaceActivityStore |

## Verification

- `npx tsc --noEmit` passes for all three files (clean compile, no errors)
- Token hashing uses SHA-256; raw tokens never stored
- Primary workspace uses partial unique index + transactional update
- Cross-workspace unread count uses single CASE/WHEN query

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added dao_role to workspace_invites table**
- **Found during:** Task 2
- **Issue:** The research schema for `workspace_invites` did not include a `dao_role` column, but the `createInvite` method signature in the plan required `daoRole` parameter, and `addMember` requires both `role` and `daoRole`. Without persisting `dao_role` on the invite, the API layer cannot call `addMember` on invite acceptance without losing the DAO role assignment.
- **Fix:** Added `dao_role TEXT NOT NULL` column to `workspace_invites` CREATE TABLE statement and included it in all INSERT/SELECT mappings.
- **Files modified:** `backend/src/workspace/workspace-invite-store.ts`
- **Commit:** 443abf5

## Self-Check: PASSED
