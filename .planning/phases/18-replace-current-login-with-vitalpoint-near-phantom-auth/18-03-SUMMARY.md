---
phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
plan: 03
subsystem: auth
tags: [near, phantom-auth, webauthn, passkey, react, react-context, hooks, cookie-session]

# Dependency graph
requires:
  - phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
    provides: "@vitalpoint/near-phantom-auth@0.4.2 installed in frontend; AnonAuthProvider and useAnonAuth available at @vitalpoint/near-phantom-auth/client"
provides:
  - "useAuth.tsx re-exported as thin adapter over useAnonAuth() with nearAccountId mapped to accountId"
  - "AnonAuthProvider re-exported as AuthProvider from useAuth.tsx"
  - "AuthWrapper uses package auth state; MigrationFlow and prfAvailable removed; credentials: include on DID init"
  - "App.tsx wraps all routes in AnonAuthProvider; /auth/verify and /auth/recover routes removed"
  - "LoginPage.tsx rewritten to call useAnonAuth().login() — passkey-only"
  - "RegisterPage.tsx rewritten to call useAnonAuth().register() — passkey-only, no email input"
affects:
  - "18-04 — backend requireAuth middleware replacement; req.anonUser.nearAccountId available"
  - "18-05 — frontend service layer credentials: include migration"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnonAuthProvider at App.tsx root level — single provider shared by auth pages and AuthWrapper"
    - "useAuth adapter: nearAccountId -> accountId field mapping for all downstream consumers"
    - "AuthWrapper: content-only component (no provider); redirect + DID init + UserContext population"
    - "credentials: include on all authenticated fetch calls from AuthWrapper"
    - "LoginPage/RegisterPage call useAnonAuth() directly — works because AnonAuthProvider is above them in App.tsx"

key-files:
  modified:
    - frontend/src/hooks/useAuth.tsx
    - frontend/src/components/AuthWrapper.tsx
    - frontend/src/App.tsx
    - frontend/src/components/LoginPage.tsx
    - frontend/src/components/RegisterPage.tsx

key-decisions:
  - "AnonAuthProvider placed at App.tsx root (not inside AuthWrapper) so LoginPage and RegisterPage can call useAnonAuth() without requiring a separate provider"
  - "useAuth.tsx kept as adapter layer (not deleted) — nearAccountId mapped to accountId for StrategicDashboard and other consumers that call useAuth()"
  - "prfAvailable removed from AuthWrapper DID init condition — package handles PRF internally; DID always created on authentication"
  - "MigrationFlow removed completely — clean break; legacy auth tables already dropped by 18-01"
  - "/auth/verify and /auth/recover routes removed — magic link feature dropped; passkey-only auth"
  - "LoginPage and RegisterPage rewritten (not deleted) using useAnonAuth() hooks"

patterns-established:
  - "Package auth adapter: re-export package provider + hook wrapper from useAuth.tsx for backward compatibility"
  - "DID initialization: always attempt on authentication, credentials: include for cookie-based backend call"

requirements-completed: []

# Metrics
duration: 20min
completed: 2026-03-03
---

# Phase 18 Plan 03: Replace Frontend Auth Provider Summary

**Custom AuthProvider/useAuth replaced with AnonAuthProvider/useAnonAuth adapter; AuthWrapper rewired without MigrationFlow; App.tsx routes updated; LoginPage and RegisterPage rewritten for passkey-only flow.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-03T03:30:00Z
- **Completed:** 2026-03-03T04:00:00Z
- **Tasks:** 2 of 2
- **Files modified:** 5 files modified

## Accomplishments

- Replaced 107-line custom `useAuth.tsx` with 52-line adapter wrapping `useAnonAuth()` from the package
- Rewired `AuthWrapper` to remove `MigrationFlow`, migration state/effects, and `prfAvailable` checks — DID init now unconditional on auth
- Added `credentials: 'include'` to the `/api/identity/register` fetch call (cookie-based auth)
- Updated `App.tsx` to place `AnonAuthProvider` at root, remove `/auth/verify` and `/auth/recover` routes
- Rewrote `LoginPage` and `RegisterPage` to use `useAnonAuth()` directly — passkey-only, no magic link, no email input at registration
- TypeScript compiles cleanly with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace useAuth hook with package useAnonAuth** - `3bf59ed` (feat)
2. **Task 2: Rewire AuthWrapper and update App.tsx routes** - `a31229b` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified

- `frontend/src/hooks/useAuth.tsx` — Replaced: thin adapter wrapping `useAnonAuth()`; maps `nearAccountId` -> `accountId`; re-exports `AnonAuthProvider as AuthProvider`
- `frontend/src/components/AuthWrapper.tsx` — Replaced: removed `MigrationFlow`, migration state/effect, `prfAvailable`; added `credentials: 'include'`; simplified to content-only (no provider wrapper)
- `frontend/src/App.tsx` — Updated: `AnonAuthProvider` at root; removed `MagicLinkVerify` import and `/auth/verify`, `/auth/recover` routes; kept `LoginPage` and `RegisterPage`
- `frontend/src/components/LoginPage.tsx` — Rewritten: uses `useAnonAuth().login()` for passkey sign-in; no magic link
- `frontend/src/components/RegisterPage.tsx` — Rewritten: uses `useAnonAuth().register()` for passkey registration; no email field

## Decisions Made

- **AnonAuthProvider at App root:** Placing the provider at `App.tsx` top level (not inside `AuthWrapper`) means both `LoginPage` and protected-route `AuthWrapper` share the same session context. This avoids duplicate providers and correctly reflects the single session state across all routes.
- **Keep useAuth.tsx as adapter:** `StrategicDashboard` and other components call `useAuth()`. Rather than updating them in this plan, the adapter maps `nearAccountId -> accountId` for backward compatibility. Those components will be cleaned up in 18-05.
- **nearAccountId field mapping:** Package `AnonAuthState` uses `nearAccountId` (not `accountId`). The adapter in `useAuth.tsx` translates this for all downstream consumers including `UserContext`, DID initialization, and `StrategicDashboard`.
- **prfAvailable removed:** The old DID init only created a DID if `prfAvailable` was true. Since the package handles PRF internally, DID is now always created on authentication — matching the intended behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] AnonAuthProvider moved to App.tsx root for LoginPage access**
- **Found during:** Task 2 (AuthWrapper + App.tsx update)
- **Issue:** Plan showed `AuthProvider` wrapping `AuthContent` inside `AuthWrapper`, but `LoginPage` and `RegisterPage` outside `AuthWrapper` also need to call `useAnonAuth()`. Without a provider above them, the hook would throw an error.
- **Fix:** Placed `AnonAuthProvider` at App.tsx root level (above all routes). `AuthWrapper` simplified to content-only — no longer wraps in `AuthProvider`.
- **Files modified:** `frontend/src/App.tsx`, `frontend/src/components/AuthWrapper.tsx`
- **Verification:** TypeScript compiles; `useAnonAuth()` available to all route components
- **Committed in:** `a31229b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (architectural clarification)
**Impact on plan:** Required for correctness — login/register pages must be able to call `useAnonAuth()`. No scope creep.

## Issues Encountered

- `npx tsc` failed due to old node (v12) in PATH — used `pnpm exec tsc` with nvm node 20. TypeScript compiled cleanly once correct node version was activated.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- Frontend auth layer now uses package-provided `AnonAuthProvider` and `useAnonAuth()`
- `useAuth()` backward-compatible adapter available for all existing component consumers
- `AuthWrapper` populates `UserContext` from package auth state with DID init preserved
- `LoginPage` and `RegisterPage` functional with package passkey auth
- Plan 18-04 can proceed: replace `requireAuth` Bearer token middleware in backend API routes
- Plan 18-05 can proceed: update frontend service layer (`credentials: 'include'`, remove `setAuthToken()`)

---
*Phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth*
*Completed: 2026-03-03*
