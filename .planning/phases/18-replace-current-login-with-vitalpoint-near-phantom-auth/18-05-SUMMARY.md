---
phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
plan: 05
subsystem: auth
tags: [cleanup, deletion, dead-code, passkey, privy, simplewebauthn]

# Dependency graph
requires:
  - phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth
    provides: "Plans 01-04 replaced all auth with @vitalpoint/near-phantom-auth package"
provides:
  - "Clean codebase with only package-based auth; all legacy auth files removed"
  - "Both backend and frontend compile cleanly with no legacy auth code"
  - "Unused packages (@privy-io, @simplewebauthn, otplib) removed from package.json files"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legacy code cleanup: safe to delete when no active imports remain"
    - "Package-first: all auth handled by @vitalpoint/near-phantom-auth"

key-files:
  created: []
  modified:
    - backend/package.json (removed @simplewebauthn/server and otplib)
    - frontend/package.json (removed @privy-io/react-auth, @privy-io/server-auth, @simplewebauthn/browser)

key-decisions:
  - "prf-did-integration.ts was NOT deleted — still imported by backend/src/api/identity.ts for DID operations using WebAuthn PRF extension output; this is NOT legacy auth, it is active identity infrastructure"
  - "LoginPage.tsx and RegisterPage.tsx were NOT deleted — they were already rewritten in plan 18-03 to use the new package (useAnonAuth from @vitalpoint/near-phantom-auth/client)"
  - "LoginButton.tsx deleted — not referenced by App.tsx or any active component"
  - "@privy-io/server-auth removed from frontend even though it was in dependencies (no frontend code imported it; it was a backend package accidentally in frontend deps)"

patterns-established:
  - "Before deleting: grep all remaining imports to confirm zero active references"
  - "Keep files that are active infrastructure even if they live in auth/ directory"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-03-03
---

# Phase 18 Plan 05: Delete Legacy Auth Code Summary

**Deleted 12 legacy backend auth files and 10 legacy frontend files; removed 5 unused packages; both projects compile cleanly with only @vitalpoint/near-phantom-auth package auth remaining**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-03T19:58:51Z
- **Completed:** 2026-03-03T20:07:55Z
- **Tasks:** 2
- **Files modified:** 23 deleted + 2 package.json files modified

## Accomplishments
- Deleted 12 dead legacy backend auth files: api/auth.ts, magic-link-service, magic-link-store, migration-service, passkey-service, passkey-store, recovery-service, session-store, totp-service, totp-store, types, user-store
- Deleted 10 dead legacy frontend files: LoginButton.tsx/css, PasskeySetup.tsx/css, MagicLinkVerify.tsx/css, MigrationFlow.tsx/css, auth-service.ts, passkey.ts
- Removed 5 unused packages: @simplewebauthn/server, otplib (backend); @privy-io/react-auth, @privy-io/server-auth, @simplewebauthn/browser (frontend)
- Both backend (tsc) and frontend (tsc + vite build) compile cleanly after all deletions

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete legacy backend auth files** - `b60968d` (chore)
2. **Task 2: Delete legacy frontend auth files and clean up packages** - `d1aadd7` (chore)

**Plan metadata:** (to be added)

## Files Created/Modified
- `backend/package.json` - Removed @simplewebauthn/server and otplib
- `frontend/package.json` - Removed @privy-io/react-auth, @privy-io/server-auth, @simplewebauthn/browser

## Decisions Made
- `prf-did-integration.ts` was kept because `backend/src/api/identity.ts` actively imports `createDIDFromPRF`, `resolveDIDFromPRF`, and `normalizePRFOutput` from it. This file provides PRF-to-DID bridge functionality that is NOT legacy auth — it is active identity infrastructure used for DID creation/resolution from WebAuthn PRF output.
- `LoginPage.tsx` and `RegisterPage.tsx` were kept because they were already fully rewritten in plan 18-03 to use `useAnonAuth` from `@vitalpoint/near-phantom-auth/client`. The plan's note about checking 18-03-SUMMARY.md before deletion was correct.
- The plan listed 13 backend files to delete but `prf-did-integration.ts` had an active consumer, so only 12 were deleted.
- The plan stated `@privy-io/server-auth` should be removed from frontend/package.json. This was a backend package that was accidentally listed in the frontend deps. Removed correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept prf-did-integration.ts — active import detected**
- **Found during:** Task 1 (Delete legacy backend auth files)
- **Issue:** Plan listed `prf-did-integration.ts` as one of 13 files to delete, but `backend/src/api/identity.ts` actively imports `createDIDFromPRF`, `resolveDIDFromPRF`, and `normalizePRFOutput` from it. Deleting would cause compile failure.
- **Fix:** Excluded `prf-did-integration.ts` from deletion. Only 12 of the 13 listed backend files were deleted.
- **Files modified:** N/A (file was not deleted)
- **Verification:** Backend TypeScript build passes after all other 12 deletions
- **Committed in:** b60968d (part of task commit)

**2. [Rule 1 - Bug] Kept LoginPage.tsx and RegisterPage.tsx — already rewritten**
- **Found during:** Task 2 (Delete legacy frontend auth files)
- **Issue:** Plan noted to check 18-03-SUMMARY.md first. Inspection confirmed LoginPage.tsx and RegisterPage.tsx were fully rewritten in plan 18-03 to use `useAnonAuth` from the package. Deleting would break the app.
- **Fix:** These two files (and their CSS) were excluded from deletion. The plan's own note correctly anticipated this scenario.
- **Files modified:** N/A (files not deleted)
- **Verification:** Frontend TypeScript and Vite builds pass with these files present
- **Committed in:** d1aadd7 (part of task commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug prevention)
**Impact on plan:** Both deviations were essential to prevent compile failures. prf-did-integration.ts is active identity infrastructure; LoginPage/RegisterPage are the NEW auth pages that replaced the legacy ones in an earlier plan. No scope creep — these were exactly the cases the plan warned to check for.

## Issues Encountered
- Node.js v12 in default PATH was incompatible with newer TypeScript/pnpm — resolved by using `/home/vitalpointai/.nvm/versions/node/v22.18.0/bin/node` and running tsc/vite via `bash ./node_modules/.bin/tsc` directly.
- pnpm CLI also incompatible with Node.js v12 — resolved by editing package.json directly with Python json module to remove packages, then verifying build success without running `pnpm remove`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 18 is complete. All legacy auth code deleted.
- The codebase now uses ONLY `@vitalpoint/near-phantom-auth` for authentication.
- `prf-did-integration.ts` remains as active identity infrastructure (not legacy auth).
- Both backend and frontend compile and build cleanly.

---
*Phase: 18-replace-current-login-with-vitalpoint-near-phantom-auth*
*Completed: 2026-03-03*
