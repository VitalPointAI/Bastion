---
phase: 01-foundation-infrastructure
plan: 06-FIX
subsystem: blockchain, auth
tags: [chain-signatures, mpc, near, privy, key-derivation]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure/1-06
    provides: Chain Signatures integration, MPC recovery service
provides:
  - Chain Signatures key derivation architecture documentation
  - Backend endpoint for MPC key addition
  - Clarified MPC root key vs derived key pattern
affects: [phase-2-identity, mpc-signing-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns: [MPC root-key-plus-path-at-signing pattern documented]

key-files:
  created: []
  modified:
    - frontend/src/lib/mpcRecovery.ts
    - backend/src/api/accounts.ts
    - .planning/phases/01-foundation-infrastructure/1-06-ISSUES.md

key-decisions:
  - "Chain Signatures uses root key + path-at-signing derivation (not per-user keys upfront)"
  - "MPC root key stored per user to track key version at registration time"
  - "Privy hydration error is external SDK issue - WONTFIX"

patterns-established:
  - "MPC key derivation: root key same for all, path differentiates at signing"

issues-created: []

# Metrics
duration: 35min
completed: 2026-01-13
---

# Phase 1 Plan 6-FIX: UAT Issue Fixes Summary

**Chain Signatures key derivation documented, MPC key addition endpoint implemented, Privy SDK verified**

## Performance

- **Duration:** ~35 min (active work, excluding overnight pause)
- **Started:** 2026-01-13T00:33:22Z
- **Completed:** 2026-01-13T11:24:25Z
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 3

## Accomplishments

- **UAT-003 RESOLVED**: Documented that same MPC root key for all users is correct Chain Signatures behavior
- **UAT-001 PARTIAL**: Added backend endpoint `/api/accounts/add-mpc-key` for MPC key registration
- **UAT-002 WONTFIX**: Verified Privy hydration error is external SDK issue
- **UAT-004 RESOLVED**: Confirmed already on latest Privy v3.10.1

## Task Commits

Each task was committed atomically:

1. **Task 1: Research Chain Signatures key derivation** - `c7657b6`
   - Documented root key + path-at-signing pattern
   - Split getMPCRootPublicKey() from deriveMPCPublicKey()

2. **Task 2: Implement addMPCKeyToAccount** - `186665e`
   - Frontend calls backend instead of pure simulation
   - Backend endpoint with key existence check

3. **Task 3: Update ISSUES.md** - `9275cfa`
   - Documented resolution status for all 4 issues

4. **Task 4: DB fix** - `58fd904`
   - Handle missing mpc_key_status column gracefully

## Files Modified

- `frontend/src/lib/mpcRecovery.ts` - Comprehensive Chain Signatures documentation, split key retrieval methods
- `backend/src/api/accounts.ts` - New POST /api/accounts/add-mpc-key endpoint
- `.planning/phases/01-foundation-infrastructure/1-06-ISSUES.md` - Resolution documentation

## Decisions Made

1. **Chain Signatures key model**: Same root public key for all users is CORRECT - differentiation happens at signing time via derivation path
2. **Store root key per user**: Keeps track of which MPC key version user registered with (in case of MPC rotation)
3. **Privy hydration**: External SDK issue, cannot fix in our code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing mpc_key_status column**
- **Found during:** Task 4 (checkpoint verification)
- **Issue:** Backend tried to update non-existent column
- **Fix:** Removed column reference, wrapped in try/catch for dev mode
- **Committed in:** 58fd904

---

**Total deviations:** 1 auto-fixed (blocking DB issue)
**Impact on plan:** Minor - DB schema not critical for dev mode simulation

## Issues Encountered

- Database schema didn't have mpc_key_status column - handled gracefully in dev mode

## Test Results

### UAT Issue Resolution

| Issue | Severity | Status | Resolution |
|-------|----------|--------|------------|
| UAT-001 | Major | PARTIAL | Backend endpoint added, on-chain needs Phase 2 |
| UAT-002 | Minor | WONTFIX | Privy SDK internal issue |
| UAT-003 | Major | RESOLVED | Correct behavior documented |
| UAT-004 | Cosmetic | RESOLVED | Already on latest v3.10.1 |

## Next Steps

- Plan 1-07: Containerization & Dev Environment (original roadmap)
- Phase 2: Full on-chain MPC key addition (requires key management)

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-01-13*
