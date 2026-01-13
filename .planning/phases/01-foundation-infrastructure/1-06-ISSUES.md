# UAT Issues: Phase 1 Plan 6

**Tested:** 2026-01-12
**Source:** .planning/phases/01-foundation-infrastructure/1-06-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: MPC key addition to NEAR account is simulated (not implemented)

**Discovered:** 2026-01-12
**Phase/Plan:** 01-06
**Severity:** Major
**Feature:** MPC Account Recovery
**Description:** The `addMPCKeyToAccount()` function in mpcRecovery.ts is a stub that simulates success. The real implementation needs to create an AddKey transaction, sign it with the current access key, and submit to NEAR.
**Expected:** MPC public key should be added as a full access key on the user's NEAR account
**Actual:** Function logs "simulated (dev mode)" and returns fake success
**Repro:** Login, check console for "MPC key registration simulated (dev mode)" message
**Resolution:** Implemented in 1-06-FIX:
  - Added backend endpoint POST /api/accounts/add-mpc-key
  - Frontend now calls backend instead of pure simulation
  - Dev mode still simulates but with backend acknowledgment
  - Full on-chain AddKey requires key management (Phase 2 work)
**Status:** PARTIAL FIX - Backend endpoint added, on-chain requires Phase 2

### UAT-002: React hydration error from Privy SDK

**Discovered:** 2026-01-12
**Phase/Plan:** 01-06
**Severity:** Minor
**Feature:** Privy Authentication UI
**Description:** Console shows hydration error: `<div> cannot be a descendant of <p>`. The error originates from Privy's internal components (HelpTextContainer in AwaitingPasswordlessCodeScreen), not our code.
**Expected:** No hydration warnings
**Actual:** React warns about invalid DOM nesting in Privy components
**Repro:** Start login flow with email, observe console during code entry screen
**Root Cause:** Privy SDK internal component structure issue
**Resolution:** Checked for Privy SDK updates - v3.10.1 is latest (2026-01-13). Issue is in Privy's internal JSX structure. Cannot fix in our code. Consider reporting to Privy support.
**Status:** WONTFIX - External SDK issue

### UAT-003: Same MPC public key returned for different users

**Discovered:** 2026-01-12
**Phase/Plan:** 01-06
**Severity:** Major
**Feature:** MPC Key Derivation
**Description:** When different users login, the same MPC public key is derived. This is because the code calls `public_key` with empty args, which returns the MPC network's root public key (same for everyone).
**Expected:** Different users should get different derived public keys based on their unique derivation path
**Actual:** All users get the same root MPC public key (secp256k1:...)
**Repro:**
1. Login with user A, note the MPC public key in console
2. Logout, login with user B
3. Observe same MPC public key
**Root Cause:** Initially thought this was a bug, but this is actually CORRECT behavior
**Resolution:** Researched in 1-06-FIX - Chain Signatures uses root key + path-at-signing pattern:
  - MPC `public_key` returns ROOT key (same for everyone) - correct
  - Per-user differentiation via derivation path at SIGNING time
  - Path includes NEAR account ID → unique signatures per user
  - Added comprehensive documentation to mpcRecovery.ts explaining this
**Status:** RESOLVED - Behavior is correct, documentation added

### UAT-004: Privy SDK version may need update

**Discovered:** 2026-01-12
**Phase/Plan:** 01-06
**Severity:** Cosmetic
**Feature:** Privy Authentication
**Description:** Related to UAT-002 - check if newer Privy SDK version fixes the hydration issue.
**Resolution:** Checked 2026-01-13 - v3.10.1 is current and latest. No update available.
**Status:** RESOLVED - Already on latest version

## Resolved Issues

[None yet]

---

*Phase: 01-foundation-infrastructure*
*Plan: 06*
*Tested: 2026-01-12*
