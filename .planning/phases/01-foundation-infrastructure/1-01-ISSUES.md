# UAT Issues: Phase 1 Plan 1

**Tested:** 2026-01-12
**Source:** .planning/phases/01-foundation-infrastructure/1-01-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None]

## Resolved Issues

### UAT-001: Contract build fails due to missing derive macros on types added in later phases

**Discovered:** 2026-01-12
**Resolved:** 2026-01-12
**Phase/Plan:** 01-01 (but caused by types added in 1-03, 1-05, 1-06)
**Severity:** Blocker
**Feature:** Contract Build (./build.sh)
**Description:** Running `./build.sh` in near-contracts/ failed with compilation errors. The errors indicated that `DocumentRegistry` was missing `BorshSchema` trait and `Document` was missing `JsonSchema` trait.

**Root Cause:**
Later phases (1-03, 1-05, 1-06) added modules that introduced types returned from `#[near]` contract methods without proper NEAR SDK attribute macros for ABI generation.

**Fix Applied:**
1. Updated `Document` struct to use `#[near(serializers = [borsh, json])]` instead of manual derives
2. Updated `DocumentRegistry` struct to use `#[near_sdk::near(serializers = [borsh])]`
3. Updated `StorageKey` enum to use `#[near_sdk::near]` attribute
4. Updated `build.sh` to use `--no-wasmopt` flag (avoids bulk memory operation errors with newer Rust toolchains)

**Verification:**
- Contract builds successfully: `cargo near build non-reproducible-wasm --no-wasmopt`
- All 33 unit tests pass
- WASM binary produced at `target/near/near_contracts.wasm`

---

*Phase: 01-foundation-infrastructure*
*Plan: 01*
*Tested: 2026-01-12*
