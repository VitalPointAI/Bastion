# Phase 1 Plan 5 FIX Summary

**Fixed NEAR contract WASM bulk memory build error by downgrading Rust toolchain and disabling bulk memory codegen**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-12T01:00:00Z
- **Completed:** 2026-01-12T01:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Issues Fixed

### UAT-001: NEAR contract fails to build with WASM bulk memory errors

**Severity:** Blocker
**Status:** Resolved

**Root Cause:** Rust 1.88.0 generates WASM bulk memory operations (memory.fill, memory.copy) by default, but NEAR's WASM validator doesn't support the bulk memory proposal.

**Fix Applied:**
1. Downgraded Rust toolchain from 1.88.0 to 1.85.0 in `rust-toolchain.toml`
2. Created `.cargo/config.toml` with RUSTFLAGS to disable bulk memory feature
3. Downgraded `home` crate to 0.5.9 for Rust 1.85 compatibility

**Why not Rust 1.82.0?**
near-sdk 5.9 depends on `near-schema-checker-core` which requires edition2024 features not available in Rust 1.82.0.

## Files Created/Modified

- `near-contracts/rust-toolchain.toml` - Changed Rust version from 1.88.0 to 1.85.0
- `near-contracts/.cargo/config.toml` - Created with RUSTFLAGS to disable bulk memory
- `near-contracts/Cargo.lock` - Updated `home` crate to 0.5.9

## Verification Results

- `cargo near build non-reproducible-wasm` - SUCCESS
- `cargo test` - 33 passed, 0 failed, 14 ignored (integration tests)
- Contract WASM produced at `target/near/near_contracts.wasm`

## Next Steps

Re-run `/gsd:verify-work 1-05` to confirm all tests pass with the fixed build.

---

*Phase: 01-foundation-infrastructure*
*Plan: 05-FIX*
*Completed: 2026-01-12*
