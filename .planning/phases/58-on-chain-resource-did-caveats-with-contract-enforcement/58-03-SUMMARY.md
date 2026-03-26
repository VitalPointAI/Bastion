---
phase: 58-on-chain-resource-did-caveats-with-contract-enforcement
plan: "03"
subsystem: frontend, contracts
tags: [near-contract, react, typescript, wasm, resource-caveats, near-testnet, testnet-deploy, wasm-opt, mvp-wasm]
dependency_graph:
  requires:
    - phase: 58-on-chain-resource-did-caveats-with-contract-enforcement/58-01
      provides: [ResourceCaveats contract extension, check_employment_authorized, WASM artifact]
    - phase: 58-on-chain-resource-did-caveats-with-contract-enforcement/58-02
      provides: [PATCH /api/resources/:id/caveats, GET /api/resources/:id/employment-check, ResourceCaveats types]
  provides:
    - SecurityCaveatsSection in ResourceDetailPanel with classification/releasability/ROE tier/time windows/geo bounds/employment constraints
    - updateResourceCaveats and checkEmploymentAuth API helpers in resource-service.ts
    - did.bastion.testnet contract deployed to NEAR testnet (fallback path due to Borsh state mismatch)
    - scripts/test-caveat-enforcement.sh smoke test (4 tests all passing)
    - contracts/did-registry/build.sh wasm-opt build helper for MVP-compatible WASM
  affects: [ResourceDetailPanel callers, backend deployment, Phase 58 demo story]
tech_stack:
  added: [wasm-opt/binaryen (npm install -g binaryen)]
  patterns:
    - "Permission-gated editor: canEditCaveats prop controls edit vs read-only mode for commander/XO"
    - "On-chain sync badge: green verified / yellow pending based on onChainSyncedAt field"
    - "Inline success/error state feedback (no toast library, uses useState pattern)"
    - "wasm-opt --mvp-features --signext-lowering post-processing required for NEAR testnet WASM compatibility"
    - "NEAR testnet rejects call_indirect with multi-byte LEB128 reserved byte (emitted by LLVM >= 14)"
key_files:
  created:
    - contracts/did-registry/build.sh
    - contracts/did-registry/.cargo/config.toml
    - contracts/did-registry/target/wasm32-unknown-unknown/release/did_registry_near_compat.wasm
    - scripts/test-caveat-enforcement.sh
  modified:
    - frontend/src/lib/resource-service.ts
    - frontend/src/components/resources/ResourceDetailPanel.tsx
    - contracts/did-registry/src/lib.rs
    - contracts/did-registry/Cargo.toml
key_decisions:
  - "Used wasm-opt --mvp-features --signext-lowering to produce NEAR-compatible WASM: NEAR testnet (wasmer) rejects binaries where call_indirect has multi-byte LEB128 reserved byte (emitted by LLVM >= 14 via Rust toolchain)"
  - "Removed schemars dependency from contract: schemars internally uses f64 code paths which introduce floating point into WASM binary, rejected by NEAR testnet"
  - "Fallback deployment path (delete/recreate account): migrate() failed with Borsh Deserialization error because old testnet state schema was incompatible with OldDIDRegistry struct"
  - "Frontend inline state for save feedback (no toast library installed, matches project pattern)"
  - "GeoBounds displayed as degrees in UI, converted to/from degrees*1_000_000 on API boundary"
requirements_completed:
  - REQ-58-04
  - REQ-58-05
duration: 45min
completed: "2026-03-26"
---

# Phase 58 Plan 03: Frontend Caveat Editor + Testnet Deploy Summary

**SecurityCaveatsSection in ResourceDetailPanel with commander/XO permission gating, on-chain sync badge, plus did.bastion.testnet redeployed with MVP-compatible WASM via wasm-opt post-processing and 4/4 smoke tests passing.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-26T13:00:00Z
- **Completed:** 2026-03-26
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 8

## Accomplishments

- Added CaveatClassification, GeoBounds, TimeWindow, ResourceCaveats, EmploymentAuthResult types to resource-service.ts with updateResourceCaveats() and checkEmploymentAuth() API helpers
- Built SecurityCaveatsSection React component with all 6 caveat fields, permission gating (canEditCaveats prop), on-chain sync badge, and inline save/error feedback
- Resolved NEAR testnet WASM incompatibility: wasm-opt with --mvp-features and --signext-lowering produces LLVM-compatible WASM that NEAR's wasmer validates
- Deployed to did.bastion.testnet via fallback (delete/recreate account) with clean state
- All 4 smoke tests pass: check_employment_authorized returns authorized=false for missing DID, get_caveats returns null, is_paused returns false, get_admin returns bastion.testnet

## Task Commits

1. **Task 1: Frontend caveat editor + resource-service API helpers** - `e28445e2` (feat)
2. **Task 2: Deploy updated contract + smoke test script** - `2e399e47` (feat)

## Files Created/Modified

- `frontend/src/lib/resource-service.ts` - Added caveat types and updateResourceCaveats/checkEmploymentAuth API helpers
- `frontend/src/components/resources/ResourceDetailPanel.tsx` - Added SecurityCaveatsSection component with all caveat fields
- `contracts/did-registry/src/lib.rs` - Removed schemars/JsonSchema derives (eliminated f64 in WASM)
- `contracts/did-registry/Cargo.toml` - Removed schemars dependency
- `contracts/did-registry/.cargo/config.toml` - Added restricted WASM target features
- `contracts/did-registry/build.sh` - wasm-opt post-processing build helper
- `contracts/did-registry/target/wasm32-unknown-unknown/release/did_registry_near_compat.wasm` - MVP-compatible WASM artifact
- `scripts/test-caveat-enforcement.sh` - Smoke test script for on-chain caveat enforcement

## Decisions Made

- **wasm-opt required**: NEAR testnet's wasmer uses a strict MVP WASM validator that rejects `call_indirect` where the reserved byte is encoded as multi-byte LEB128. Rust LLVM >= 14 emits this encoding when the `reference-types` target feature is active. wasm-opt with `--mvp-features --signext-lowering` fixes both the call_indirect encoding and sign-ext opcodes.
- **Fallback deployment**: The migrate() function failed because OldDIDRegistry's Borsh schema didn't match what was actually stored on testnet. Clean redeploy (delete account + recreate with new()) was safer.
- **Removed schemars**: The schemars crate was pulling f64 code paths into the WASM binary, causing NEAR's prepare error. Since ABI schema generation is not required for basic testnet deployment, the dependency was removed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed schemars dependency causing f64 in WASM binary**
- **Found during:** Task 2 (testnet deployment)
- **Issue:** schemars crate introduces f64 code via JsonSchema derive, NEAR testnet rejects WASM with floats via PrepareError(Deserialization)
- **Fix:** Removed `schemars = "0.8"` from Cargo.toml, removed JsonSchema and `#[schemars(with = "String")]` derives from all structs
- **Files modified:** contracts/did-registry/src/lib.rs, contracts/did-registry/Cargo.toml
- **Verification:** wasm2wat shows no f64/f32 types after removal
- **Committed in:** 2e399e47 (Task 2 commit)

**2. [Rule 1 - Bug] Added wasm-opt post-processing to fix call_indirect MVP compatibility**
- **Found during:** Task 2 (testnet deployment)
- **Issue:** NEAR testnet's wasmer validator rejects WASM where call_indirect uses multi-byte LEB128 encoding for the reserved zero byte. All Rust LLVM >= 14 toolchains emit this encoding.
- **Fix:** Added wasm-opt --mvp-features --signext-lowering post-processing step. Created build.sh with this workflow. Added .cargo/config.toml with restricted WASM target features.
- **Files modified:** contracts/did-registry/build.sh, contracts/did-registry/.cargo/config.toml
- **Verification:** wabt readWasm with MVP settings validates clean, NEAR testnet call succeeds
- **Committed in:** 2e399e47 (Task 2 commit)

**3. [Rule 1 - Bug] Fallback deployment (delete/recreate account) instead of migrate path**
- **Found during:** Task 2 (testnet deployment)
- **Issue:** migrate() failed with CompilationError(PrepareError(Deserialization)) — the contract wouldn't execute at all due to WASM incompatibility. Even after fixing the WASM, the testnet state schema from the old deployment was incompatible with OldDIDRegistry Borsh struct.
- **Fix:** Deleted did.bastion.testnet, recreated with 3 NEAR from bastion.testnet, deployed MVP-compatible WASM, called new(admin=bastion.testnet)
- **Verification:** is_paused=false, get_admin="bastion.testnet", all smoke tests pass
- **Committed in:** 2e399e47 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs)
**Impact on plan:** All fixes were necessary for the testnet deployment to work. The schemars and wasm-opt issues are systematic NEAR SDK compatibility issues. The fallback deployment was triggered by the migrate path being broken. No scope creep.

## Issues Encountered

- NEAR CLI version 0.22.1 syntax differs from plan examples: `with-init-call` combined with WASM deploy fails for large WASM; must deploy then call init separately
- NEAR testnet account balance was 4.72 NEAR, insufficient for 5 NEAR funding; used 3 NEAR instead

## Next Phase Readiness

- Frontend: SecurityCaveatsSection is in ResourceDetailPanel but receives placeholder canEditCaveats prop — wiring to actual user role in problem set pending Plan 42-06 integration
- Backend: PATCH /api/resources/:id/caveats and GET /api/resources/:id/employment-check ready
- Contract: did.bastion.testnet live, all view methods callable, admin=bastion.testnet
- Smoke test: scripts/test-caveat-enforcement.sh passes all 4 tests

---
*Phase: 58-on-chain-resource-did-caveats-with-contract-enforcement*
*Completed: 2026-03-26*
