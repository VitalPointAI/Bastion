---
phase: 02-identity-security-framework
plan: 02
subsystem: identity
tags: [near-sdk, credentials, privacy, revocation, hkdf, chacha20]

# Dependency graph
requires:
  - phase: 2-01
    provides: Encrypted DID Registry pattern (blinded keys, LookupMap)
provides:
  - Encrypted credential anchoring with dual-key system
  - Privacy-preserving revocation checks without revealing credential ID
  - Credential lifecycle management (active, suspended, revoked)
affects: [2-03-vcs, 2-04-authorization, backend-credential-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual-key credential system (blinded_credential_id + blinded_revocation_key)
    - Status codes as u8 for gas efficiency (0=Active, 1=Revoked, 2=Suspended)
    - Separate revocation index to prevent correlation attacks

key-files:
  created:
    - near-contracts/src/credential_registry.rs
  modified:
    - near-contracts/src/lib.rs

key-decisions:
  - "Dual-key system: separate blinded_credential_id for lookup and blinded_revocation_key for status checks"
  - "Status codes as u8 (0/1/2) instead of enum for gas efficiency"
  - "No subject_credentials or credential_type indexes to prevent relationship inference"
  - "Revocation is irreversible; suspension is reversible"

patterns-established:
  - "Credential validation via revocation key preserves credential ID privacy"
  - "Owner-only credential list using AccountId → Vec<blinded_id> mapping"

issues-created: []

# Metrics
duration: 7min
completed: 2026-01-15
---

# Phase 2 Plan 2: Encrypted Credential Registry Summary

**Dual-key encrypted credential anchoring with privacy-preserving revocation checks and lifecycle management**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-15T10:55:10Z
- **Completed:** 2026-01-15T11:02:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Encrypted credential registry with dual-key system (credential_id vs revocation_key)
- Privacy-preserving revocation checks that don't reveal credential identity
- Complete lifecycle management: Active → Suspended ↔ Active, Active → Revoked (irreversible)
- No relationship-revealing indexes (no subject/issuer/type indexes)
- 28 unit tests + 10 integration tests validating privacy guarantees

## Task Commits

Each task was committed atomically:

1. **Task 1: Create encrypted Credential Registry module** - `ab0ff47` (feat)
2. **Task 2: Integrate credential registry with unit tests** - `c32d69a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `near-contracts/src/credential_registry.rs` - New encrypted credential registry module (986 lines)
- `near-contracts/src/lib.rs` - Integration with Contract struct, public methods, unit tests

## Decisions Made
- **Dual-key system**: blinded_credential_id for anchor lookup, blinded_revocation_key for status checks. This prevents correlation between credential retrieval and revocation verification.
- **Status codes as u8**: 0=Active, 1=Revoked, 2=Suspended. Simple numeric values for gas efficiency.
- **No relationship indexes**: Deliberately omit subject_credentials, issuer_credentials, and credential_type indexes. These would reveal who holds what credentials and organizational structure.
- **Revocation irreversibility**: Once revoked (status=1), cannot be reinstated. Suspension (status=2) is reversible.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Fixed test timestamp issue where block_timestamp (nanoseconds) vs block_timestamp_ms (milliseconds) mismatch caused expiration test to fail. Adjusted test values to account for nanosecond-to-millisecond conversion.

## Next Phase Readiness
- Encrypted credential registry ready for integration with Verifiable Credentials (Plan 2-03)
- Dual-key system enables privacy-preserving credential verification
- Ready for frontend/backend integration with HKDF key derivation

---
*Phase: 02-identity-security-framework*
*Completed: 2026-01-15*
