---
phase: 19-workspace-membership-and-invite-system
plan: "06"
subsystem: frontend-workspace-ui
tags: [workspace, invites, members, react, typescript, tailwind]
dependency_graph:
  requires: [19-05, 19-04]
  provides: [WorkspaceInviteModal, InviteAcceptPage, WorkspaceMemberManager]
  affects: [frontend/src/App.tsx, frontend/src/lib/workspace-service.ts]
tech_stack:
  added: []
  patterns: [react-hooks, tailwind-css, modal-overlay, confirmation-dialogs, permission-gating]
key_files:
  created:
    - frontend/src/components/workspace/WorkspaceInviteModal.tsx
    - frontend/src/components/workspace/InviteAcceptPage.tsx
    - frontend/src/components/workspace/WorkspaceMemberManager.tsx
  modified:
    - frontend/src/App.tsx
decisions:
  - "Approve button in pending invites only shown when invite has rawToken (indicates claimed-but-not-approved state)"
  - "AI agent badge detection uses heuristic DID pattern matching (includes 'agent', 'bot', 'ai.', ends with '.agent.near', includes ':agent:')"
  - "Assignable roles filtered to current user's level and below to prevent privilege escalation in UI"
  - "manage_members permission check looks up current user's role from workspace roles list and checks permissions array"
metrics:
  duration: "7 minutes"
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 19 Plan 06: Workspace Invite Modal, Accept Page, and Member Manager Summary

**One-liner:** Full workspace invite lifecycle UI with WorkspaceInviteModal (role/target/expiry), InviteAcceptPage (all accept states including clearance and register-then-join), and WorkspaceMemberManager (member table with permission-gated role change, suspend, and remove actions).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WorkspaceInviteModal and InviteAcceptPage | c598d70 | WorkspaceInviteModal.tsx, InviteAcceptPage.tsx, App.tsx |
| 2 | Create WorkspaceMemberManager | dd46691 | WorkspaceMemberManager.tsx |

## What Was Built

### WorkspaceInviteModal (`frontend/src/components/workspace/WorkspaceInviteModal.tsx`)

A modal component for workspace admins to create and manage invitations:

- **Role selection:** Dropdown populated from `workspaceService.listRoles()` showing `militaryLabel (daoRoleName)` format
- **Target type:** Radio buttons for "Anyone with link" / "Specific DID" / "Specific Email"
- **Expiration:** Dropdown with 24h, 72h (3 days), 7 days, 30 days options
- **On submit:** Calls `workspaceService.createInvite()` with all options; displays generated link with copy-to-clipboard button
- **Pending invites list:** Fetched on mount and after each invite creation; shows Cancel button for all, Approve button for claimed-but-pending invites (identified via rawToken presence)
- **Props:** `{ workspaceId, workspaceName, onClose }`
- **Pattern:** Generalized from `frontend/src/components/mission/InviteModal.tsx` — same UX flow but using Tailwind instead of CSS modules, workspace roles instead of hardcoded roles

### InviteAcceptPage (`frontend/src/components/workspace/InviteAcceptPage.tsx`)

A standalone full-page component for the `/workspace/invite/:token` route:

- **Unauthenticated users:** Saves token to `sessionStorage` under `workspace-invite-token`, shows "Register / Login to join" button that redirects to `/login?redirect=/workspace/invite/{token}`
- **Authenticated users:** Immediately calls `workspaceService.acceptInvite(token, userDID)`
- **State machine with 8 states:** loading, unauthenticated, joined, pending (202 response), clearance_error, invalid/expired, already_member, error
- **After successful join:** Calls `refreshMemberships()` from WorkspaceContext to update sidebar notification badges and workspace list
- **Full-page centered card layout** with Tailwind CSS
- **Route registered** in `App.tsx` inside the `/workspace/*` Routes block, before `/:workspaceId` to avoid conflict

### WorkspaceMemberManager (`frontend/src/components/workspace/WorkspaceMemberManager.tsx`)

A member management table component for workspace admins:

- **Data fetch:** `listMembers()` and `listRoles()` loaded in parallel on mount
- **Table columns:** Member (DID + badges), Role (military label), DAO Role, Status, Joined date, Actions
- **Sort order:** Commander roles first, then alphabetical by DID
- **Badges:** "You" badge for own row, "AI Agent" badge for agent DIDs (heuristic pattern matching), "Suspended" badge
- **Permission gate:** Actions only shown when current user's role has `manage_members` in `permissions` array (looked up from roles list)
- **Actions:**
  - **Change Role:** Dropdown (filtered to roles at-or-below current user's level), confirmation dialog
  - **Suspend:** For active members, confirmation dialog
  - **Unsuspend:** For suspended members, confirmation dialog
  - **Remove:** Red styling, confirmation dialog with "This action cannot be undone" warning
- **Cannot act on own row** — action column hidden for self
- **Search/filter:** Input filters by DID or role (case insensitive)
- **Member count:** "X members (Y active, Z suspended)" header
- **ConfirmDialog sub-component:** Reusable confirmation overlay used for all destructive actions

## Verification

- TypeScript compilation: passed (`tsc --noEmit` with no errors)
- Frontend build: passed (1569 modules transformed, `built in 8.05s`)
- `/workspace/invite/:token` route registered in App.tsx before `/:workspaceId`
- All service methods used match the signature in `workspace-service.ts` (with `userDID` as required param)

## Deviations from Plan

None — plan executed exactly as written.

The plan's context showed workspace-service methods as `workspaceService.createInvite(workspaceId, role, daoRole, options?)` but the actual service signature includes `userDID` as a required 4th parameter. This is consistent with all other workspace-service methods and was followed correctly.

## Self-Check: PASSED

Files created:
- FOUND: frontend/src/components/workspace/WorkspaceInviteModal.tsx
- FOUND: frontend/src/components/workspace/InviteAcceptPage.tsx
- FOUND: frontend/src/components/workspace/WorkspaceMemberManager.tsx

Commits:
- FOUND: c598d70 (feat(19-06): create WorkspaceInviteModal and InviteAcceptPage)
- FOUND: dd46691 (feat(19-06): create WorkspaceMemberManager)
