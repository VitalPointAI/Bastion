---
phase: 58-on-chain-resource-did-caveats-with-contract-enforcement
plan: "01"
subsystem: contracts/did-registry
tags: [near-contract, rust, borsh, caveat-enforcement, did-registry, roe, releasability, geo-bounds, migration]
dependency_graph:
  requires: []
  provides: [ResourceCaveats on-chain storage, check_employment_authorized view, update_resource_caveats write, get_caveats view, migrate state transition]
  affects: [contracts/did-registry/src/lib.rs, Phase 58 Plan 03 testnet deploy]
tech_stack:
  added: []
  patterns: [separate LookupMap for schema-safe extension, OldDIDRegistry migration pattern, #[init(ignore_state)] for Borsh field order migration, integer coordinates for geo bounds, TDD RED-GREEN-REFACTOR]
key_files:
  created: []
  modified: [contracts/did-registry/src/lib.rs]
key_decisions:
  - "Used separate LookupMap<String, ResourceCaveats> keyed by blinded_key hex to avoid Borsh schema invalidation on existing DIDEntry records"
  - "EmploymentContext and EmploymentAuthResult are serde-only (no Borsh derives) since they are never stored in contract state"
  - "GeoBounds uses i64 (degrees * 1_000_000) not f64 to avoid WASM float determinism issues"
  - "OldDIDRegistry BorshDeserialize struct enables safe 3->4 field migration on testnet without losing existing DID data"
  - "check_employment_authorized returns authorized=true when no caveats stored (permissive default)"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-26"
  tasks_completed: 3
  files_modified: 1
---

# Phase 58 Plan 01: Resource Caveats Contract Extension Summary

**One-liner:** ResourceCaveats enforcement layer on DID registry via separate LookupMap with releasability, ROE tier, time window, and geo bounds checks plus safe Borsh migration path.

## What Was Built

Extended `contracts/did-registry/src/lib.rs` with structured employment caveat enforcement:

- **ResourceCaveats struct** (Borsh + serde): classification, releasability, geo_bounds, roe_tier, time_windows, employment_constraints, updated_by, updated_at
- **GeoBounds struct** (Borsh + serde): north/south/east/west as i64 (degrees * 1_000_000)
- **TimeWindow struct** (Borsh + serde): start_ms, end_ms as u64
- **EmploymentContext struct** (serde only): requesting_account, location, timestamp_ms, roe_tier_required, nation_code
- **EmploymentAuthResult struct** (serde only): authorized, reasons
- **StorageKey::Caveats** variant added to storage key enum
- **DIDRegistry.caveats** field: LookupMap<String, ResourceCaveats> — separate from dids map
- **update_resource_caveats()**: #[payable] write method, owner/admin auth, storage deposit handling
- **check_employment_authorized()**: view method enforcing releasability, ROE tier, time windows, geo bounds
- **get_caveats()**: view method for simple caveat retrieval
- **OldDIDRegistry** struct: BorshDeserialize-only, for migration
- **migrate()**: #[init(ignore_state)] reads 3-field state, writes 4-field state with new empty caveats map

## TDD Execution

### RED Phase (commit fa93a290)
Added 10 failing unit tests before any implementation. Compile errors confirmed all test methods were absent.

### GREEN Phase (commit 523b81ab)
Implemented all structs and methods. All 14 tests passed (4 existing + 10 new).

### REFACTOR Phase
No code changes needed. Verified `cargo build --target wasm32-unknown-unknown --release` produces valid 289K WASM binary.

## Test Results

```
running 14 tests
test tests::test_existing_did_unaffected ... ok
test tests::test_check_employment_roe_tier_exceeded ... ok
test tests::test_deactivate_did ... ok
test tests::test_check_employment_geo_bounds ... ok
test tests::test_check_employment_all_pass ... ok
test tests::test_check_employment_releasability ... ok
test tests::test_check_employment_time_window ... ok
test tests::test_check_employment_no_caveats ... ok
test tests::test_store_and_retrieve_caveats ... ok
test tests::test_store_and_get_did ... ok
test tests::test_paused_blocks_writes - should panic ... ok
test tests::test_update_caveats_unauthorized - should panic ... ok
test tests::test_update_caveats_admin ... ok
test tests::test_cannot_update_others_did - should panic ... ok

test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

## Success Criteria Verification

- [x] All existing tests still pass (no DIDEntry schema regression)
- [x] All 10 new caveat tests pass
- [x] `cargo build --target wasm32-unknown-unknown --release` produces valid WASM (289K)
- [x] ResourceCaveats stored in separate LookupMap, DIDEntry untouched
- [x] migrate() method exists for testnet state transition

## Commits

| Hash | Type | Description |
|------|------|-------------|
| fa93a290 | test | Add failing tests for resource caveats (RED) |
| 523b81ab | feat | Implement ResourceCaveats contract extension (GREEN) |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `contracts/did-registry/src/lib.rs` — FOUND (modified)
- Commit `fa93a290` — FOUND
- Commit `523b81ab` — FOUND
- WASM binary at `contracts/did-registry/target/wasm32-unknown-unknown/release/did_registry.wasm` — FOUND (289K)
