---
phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
plan: 02
subsystem: auth
tags: [near, phantom-auth, requireAuth, middleware, bearer-token-removal, near-funding]

# Dependency graph
requires:
  - phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
    plan: 01
    provides: "createAnonAuth instance with auth.requireAuth; req.anonUser type"
provides:
  - "All 5 backend API files use requireAuth middleware instead of manual getUserDID"
  - "auth-instance.ts module exports requireAuth for route file imports"
  - "Admin DID check derives from req.anonUser.nearAccountId via buildDID()"
  - "NEAR funding triggered async on /register/finish success via res.json intercept"
affects:
  - "18-03 through 18-05 — frontend and remaining backend plans"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "auth-instance.ts singleton pattern — setAuthInstance() called once in index.ts; getRequireAuth() used by route files"
    - "requireAuth wrapper middleware delegates to the live auth instance at call time"
    - "buildDID() helper: nearAccountId -> did:near:${nearAccountId} for DID-format values"
    - "NEAR funding hook: res.json interceptor on POST /register/finish — async, non-blocking"
    - "router.use(requireAuth, requireSystemAdmin) chain for admin routes"

key-files:
  created:
    - backend/src/auth/auth-instance.ts
  modified:
    - backend/src/api/strategic.ts
    - backend/src/api/strategic-agents.ts
    - backend/src/api/strategic-tools.ts
    - backend/src/api/missions.ts
    - backend/src/api/admin.ts
    - backend/src/index.ts

key-decisions:
  - "auth-instance.ts singleton pattern chosen over re-exporting auth directly — avoids circular dependency between index.ts and route files"
  - "requireAuth is a wrapper middleware that calls getRequireAuth() at request time — ensures auth instance is always initialized before any request arrives"
  - "buildDID(nearAccountId) local helper in each file — keeps DID format consistent (did:near:${accountId}) without importing frontend utility"
  - "NEAR funding uses res.json intercept (Option B) because package has no onRegistration callback — async fire-and-forget so registration never fails due to funding issues"
  - "strategic-tools.ts routes use req.anonUser.nearAccountId directly (not buildDID) because userDID was only used as a variable name, never passed to external systems needing DID format"

requirements-completed: []

# Metrics
duration: 13min
completed: 2026-03-03
---

# Phase 18 Plan 02: Migrate All Backend Routes to requireAuth Middleware Summary

**All 5 backend API files migrated from manual Bearer token extraction (getUserDID) to package requireAuth middleware with req.anonUser session-based auth; NEAR funding wired to registration completion.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-03-03T19:20:13Z
- **Completed:** 2026-03-03T19:33:00Z
- **Tasks:** 2 of 2
- **Files modified:** 6 files modified, 1 file created

## Accomplishments

- Created `auth-instance.ts` to share the `requireAuth` middleware from the `createAnonAuth` instance to route files without circular dependencies
- Removed all 5 `getUserDID()` functions from: strategic.ts, strategic-agents.ts, strategic-tools.ts, missions.ts, admin.ts
- Added `requireAuth` middleware to every protected route across all 5 API files (~35+ routes total)
- Replaced all `getUserDID(req)` call sites with `buildDID(req.anonUser!.nearAccountId)` or direct `req.anonUser!.nearAccountId`
- Updated `requireSystemAdmin` in admin.ts to derive DID from `req.anonUser.nearAccountId` (requireAuth runs first via `router.use(requireAuth, requireSystemAdmin)`)
- Wired NEAR account funding to package registration completion via `res.json` interceptor on `/register/finish`
- Backend compiles cleanly with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace getUserDID in 4 API files + create auth-instance.ts** - `5747501` (feat)
2. **Task 2: Update admin.ts auth + wire NEAR funding** - `1a20a82` (feat)

## Files Created/Modified

- `backend/src/auth/auth-instance.ts` — Created: Singleton module that holds the requireAuth/middleware from createAnonAuth; setAuthInstance() called in index.ts; exported requireAuth wrapper middleware used by all route files
- `backend/src/api/strategic.ts` — Removed getUserDID(), added requireAuth to all 30+ routes, replaced userDID with buildDID(req.anonUser!.nearAccountId)
- `backend/src/api/strategic-agents.ts` — Removed getUserDID(), added requireAuth to all 12 routes, fixed pre-existing req.params typing errors
- `backend/src/api/strategic-tools.ts` — Removed getUserDID(), added requireAuth to both tool routes
- `backend/src/api/missions.ts` — Removed getUserDID(), added requireAuth to all 13 mission/participant/invite routes
- `backend/src/api/admin.ts` — Removed getUserDID(), updated requireSystemAdmin to use req.anonUser, changed router.use() to chain requireAuth + requireSystemAdmin
- `backend/src/index.ts` — Added setAuthInstance() call after createAnonAuth, added getFundingService import, added /register/finish response intercept for NEAR funding

## auth-instance.ts Pattern (for downstream plans)

Route files import `requireAuth` from `../auth/auth-instance.js`:

```typescript
import { requireAuth } from '../auth/auth-instance.js';

// Use as middleware in route definition:
router.get('/protected', requireAuth, async (req, res) => {
  const nearAccountId = req.anonUser!.nearAccountId;
  const userDID = `did:near:${nearAccountId}`;
  // ...
});
```

The auth instance is initialized in `index.ts` via `setAuthInstance(auth.requireAuth, auth.middleware)` before any routes handle requests.

## NEAR Funding Hook

Wired in `backend/src/index.ts` before `auth.router` mount:

```typescript
app.use('/api/auth', (req, res, next) => {
  if (req.method === 'POST' && req.path === '/register/finish') {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400 && body?.nearAccountId) {
        fundingService.fundAccount(body.nearAccountId).catch(console.error);
      }
      return originalJson(body);
    };
  }
  next();
}, auth.router);
```

Funding is async/fire-and-forget — registration always succeeds even if NEAR funding fails.

## Decisions Made

- Used `auth-instance.ts` singleton pattern to avoid circular imports between `index.ts` (creates auth) and route files (need requireAuth)
- `requireAuth` wrapper delegates to the live auth instance at request time, ensuring initialization order safety
- `buildDID()` local helper in each file keeps DID format consistent without importing from frontend
- NEAR funding via `res.json` interceptor (Option B) because the package has no `onRegistration` callback
- Pre-existing TypeScript errors in `strategic-agents.ts` (req.params typing) fixed as part of this plan (Rule 1 - Bug)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing req.params TypeScript type errors in strategic-agents.ts**
- **Found during:** Task 1 compilation (pnpm build)
- **Issue:** `req.params.alertId`, `req.params.id` passed to functions expecting `string` but typed as `string | string[]`
- **Fix:** Added explicit `as string` casts: `const alertId = req.params.alertId as string;`
- **Files modified:** `backend/src/api/strategic-agents.ts` (lines 176, 282, 348, 354, 430)
- **Commit:** 5747501

**2. [Rule 1 - Architecture] Created auth-instance.ts instead of exporting auth from index.ts**
- **Found during:** Task 1 planning — route files can't import from index.ts (circular dependency)
- **Solution:** Created `backend/src/auth/auth-instance.ts` as a shared module with setAuthInstance/getRequireAuth pattern
- **Commit:** 5747501

## Self-Check: PASSED

- FOUND: `backend/src/auth/auth-instance.ts`
- FOUND: `backend/src/api/strategic.ts` (with requireAuth)
- FOUND: `backend/src/api/admin.ts` (with requireAuth + requireSystemAdmin)
- FOUND: `.planning/phases/18-replace-current-login-with-vitalpoint-near-phantom-auth/18-02-SUMMARY.md`
- FOUND commit 5747501: feat(18-02): replace getUserDID with requireAuth middleware in 4 API files
- FOUND commit 1a20a82: feat(18-02): update admin.ts auth + wire NEAR funding to registration
- pnpm build: SUCCESS (no TypeScript errors)
