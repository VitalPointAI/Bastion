# UAT Issues: Phase 1 Plan 5

**Tested:** 2026-01-12
**Source:** .planning/phases/01-foundation-infrastructure/1-05-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None]

## Resolved Issues

### UAT-001: NEAR contract fails to build with WASM bulk memory errors

**Discovered:** 2026-01-12
**Resolved:** 2026-01-12 - Fixed in 1-05-FIX.md
**Phase/Plan:** 1-05
**Severity:** Blocker
**Feature:** NEAR Contract Compilation
**Description:** `cargo near build` fails with WASM validator errors related to bulk memory operations. The error message indicates "Bulk memory operations require bulk memory [--enable-bulk-memory]" on memory.fill operations.

**Root Cause:**
- Rust 1.88.0 generates WASM bulk memory operations by default
- NEAR runtime doesn't support the bulk memory WASM proposal
- near-sdk 5.9 requires edition2024 features, preventing downgrade to Rust 1.82.0

**Resolution:**
1. Downgraded Rust toolchain from 1.88.0 to 1.85.0 (compatible with near-sdk deps)
2. Created `.cargo/config.toml` with RUSTFLAGS to disable bulk memory:
   ```toml
   [target.wasm32-unknown-unknown]
   rustflags = ["-C", "target-feature=-bulk-memory"]
   ```
3. Downgraded `home` crate to 0.5.9 for Rust 1.85 compatibility

**Verification:**
- `cargo near build non-reproducible-wasm` succeeds
- All 33 unit tests pass
- Contract WASM builds correctly

---

*Phase: 01-foundation-infrastructure*
*Plan: 05*
*Tested: 2026-01-12*
