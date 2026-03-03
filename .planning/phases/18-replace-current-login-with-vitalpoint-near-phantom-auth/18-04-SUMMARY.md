---
phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
plan: "04"
subsystem: frontend-auth-migration
tags: [auth, cookie-auth, fetch, service-layer]
dependency_graph:
  requires: ["18-03"]
  provides: ["frontend-services-cookie-auth"]
  affects: ["frontend-service-layer", "backend-api-auth"]
tech_stack:
  added: []
  patterns: ["credentials: 'include' for HttpOnly cookie auth via fetch"]
key_files:
  created: []
  modified:
    - frontend/src/lib/strategic-service.ts
    - frontend/src/lib/admin-service.ts
    - frontend/src/lib/governance-service.ts
    - frontend/src/lib/command-service.ts
    - frontend/src/lib/resource-service.ts
decisions:
  - "Kept X-DID header in all service files — still used for DID-based route identification even with cookie auth"
  - "GovernanceService had 4 direct fetch() calls (buildVoteTx, buildVetoTx, buildHumanApprovalTx, buildCoalitionApprovalTx) bypassing private this.fetch — all updated individually with credentials: 'include'"
  - "auth-service.ts Authorization Bearer header retained — it is the passkey auth service itself, not a service client, and is out of scope"
  - "No WebSocket calls found in governance-service — research indication was inaccurate, standard fetch migration applied"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_modified: 5
---

# Phase 18 Plan 04: Frontend Service Cookie Auth Migration Summary

**One-liner:** Migrated all 5 frontend service classes from Bearer token auth to HttpOnly cookie auth via `credentials: 'include'` on all fetch calls.

## What Was Built

All 5 frontend service files now use cookie-based authentication. The migration removed the Bearer token pattern (token property + setAuthToken method + Authorization header) from every service class and replaced it with `credentials: 'include'` on all fetch calls, which causes the browser to automatically send the HttpOnly session cookie established by the backend's `requireAuth` middleware.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate strategic-service and admin-service to cookie auth | 742b2c7 | strategic-service.ts, admin-service.ts |
| 2 | Migrate governance, command, and resource services to cookie auth | daa5dd4 | governance-service.ts, command-service.ts, resource-service.ts |

## Key Changes

### Pattern Applied to All 5 Files

**Removed from each class:**
- `private token: string | null = null;` — token property
- `setAuthToken(token: string): void { ... }` — method for setting token
- `if (this.token) { headers['Authorization'] = \`Bearer ${this.token}\`; }` — Bearer header logic

**Added to each fetch call:**
```typescript
const response = await fetch(`${API_BASE}${path}`, {
  ...options,
  credentials: 'include',  // HttpOnly cookie auth
  headers,
});
```

### Special Cases

**strategic-service.ts** — Has both `fetch()` and `fetchFormData()` private methods. Both were updated. For `fetchFormData`, `credentials: 'include'` is added correctly without `Content-Type` (browser sets boundary automatically for FormData).

**governance-service.ts** — Had 4 direct `fetch()` calls in the transaction-building methods that bypass the private `this.fetch()` wrapper:
- `buildVoteTx`
- `buildVetoTx`
- `buildHumanApprovalTx`
- `buildCoalitionApprovalTx`

Each was updated individually with `credentials: 'include'` and the Authorization header removed.

**No WebSocket calls found** — Research had indicated governance-service might have WebSocket connections, but no WebSocket calls exist in the file. Standard fetch migration was applied.

## Verification Results

```
setAuthToken in service files: NONE (PASS)
Authorization: Bearer in service files: NONE (PASS)
this.token in service files: NONE (PASS)
credentials: 'include' in all 5 files: ALL 5 FOUND (PASS)
TypeScript compilation: PASS (0 errors)
```

## Deviations from Plan

None — plan executed exactly as written.

The task verification grep `grep -c "Authorization\|setAuthToken\|this\.token"` on governance-service.ts returned 3 hits for `StrikeAuthorization` (a military domain concept), which are false positives from the pattern match. No auth-related Authorization code remains in any service file.

## Auth Gates

None encountered.

## Self-Check: PASSED

Files verified to exist:
- frontend/src/lib/strategic-service.ts — FOUND
- frontend/src/lib/admin-service.ts — FOUND
- frontend/src/lib/governance-service.ts — FOUND
- frontend/src/lib/command-service.ts — FOUND
- frontend/src/lib/resource-service.ts — FOUND

Commits verified:
- 742b2c7 — feat(18-04): migrate strategic-service and admin-service to cookie auth — FOUND
- daa5dd4 — feat(18-04): migrate governance, command, and resource services to cookie auth — FOUND
