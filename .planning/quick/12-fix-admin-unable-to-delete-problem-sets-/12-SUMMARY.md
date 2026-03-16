---
phase: quick-12
plan: 12
subsystem: backend-api
tags: [bug-fix, permissions, admin, problem-sets]
dependency_graph:
  requires: []
  provides: [admin-delete-problem-set]
  affects: [DELETE /api/problem-sets/:id]
tech_stack:
  added: []
  patterns: [ADMIN_DIDS env-var allowlist, inline DID check]
key_files:
  created: []
  modified:
    - backend/src/api/problem-sets.ts
decisions:
  - "Reused the existing ADMIN_DIDS env-var pattern from admin.ts rather than introducing a new abstraction"
metrics:
  duration: "5m"
  completed: "2026-03-16"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Quick Task 12: Fix Admin Unable to Delete Problem Sets — Summary

**One-liner:** Added ADMIN_DIDS env-var bypass to the problem-set DELETE handler so platform admins receive 204 instead of 403.

## What Was Done

The DELETE `/api/problem-sets/:id` handler only tested whether the requesting user was the problem-set creator or held the `commander` member role. Platform admins (DIDs listed in the `ADMIN_DIDS` env var) were therefore blocked with a 403 despite having global privileges.

The fix mirrors the pattern already used in `backend/src/api/admin.ts`:

1. Derive `adminDids` from `process.env.ADMIN_DIDS` (split on comma, trim, filter empty).
2. Set `isAdmin = adminDids.includes(userDid)`.
3. Extend the guard from `!isCreator && !isCommander` to `!isCreator && !isCommander && !isAdmin`.
4. Update the 403 error message and the in-line comment to mention "platform admin".

The child-problem-set guard (lines 1036-1040) is untouched — admins still cannot delete a parent that has active children.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add admin bypass to problem-set DELETE permission check | 0290337a | backend/src/api/problem-sets.ts |

## Verification

- TypeScript compiles clean (`tsc --noEmit`) with zero errors.
- `git diff` confirms exactly four additions (comment update, adminDids derivation, isAdmin assignment, updated guard + message) and two deletions (old comment, old guard lines).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `backend/src/api/problem-sets.ts` modified and contains `isAdmin` check
- [x] Commit `0290337a` exists in git log
- [x] TypeScript compile: no errors
