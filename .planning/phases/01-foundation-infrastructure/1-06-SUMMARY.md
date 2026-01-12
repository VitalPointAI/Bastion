---
phase: 01-foundation-infrastructure
plan: 06
subsystem: blockchain, auth
tags: [chain-signatures, mpc, intents, near, privy, multi-chain]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure/1-05
    provides: NEAR-Phala integration, privacy routing
  - phase: 01-foundation-infrastructure/1-02
    provides: Privy authentication, frontend foundation
provides:
  - Chain Signatures MPC integration for multi-chain key management
  - Intent-based transaction system with custom verifier
  - MPC account recovery via deterministic key derivation
  - Complete blockchain abstraction (zero crypto terminology in UI)
affects: [phase-2-identity, phase-7-tactical-execution, coalition-payments]

# Tech tracking
tech-stack:
  added: [v2.multichain-mpc.testnet, secp256k1]
  patterns: [MPC key derivation, intent verification, promise-based cross-contract calls]

key-files:
  created:
    - near-contracts/src/chain_signatures.rs
    - near-contracts/src/intents.rs
    - frontend/src/lib/intents.ts
    - frontend/src/lib/mpcRecovery.ts
  modified:
    - near-contracts/src/lib.rs
    - near-contracts/tests/integration.rs
    - frontend/src/components/AuthWrapper.tsx

key-decisions:
  - "MPC contract: v2.multichain-mpc.testnet (not v1.signer-dev)"
  - "Intent types: transfer, mission_order, document_verification"
  - "MPC recovery: deterministic derivation from Privy user ID"

patterns-established:
  - "Intent submission → verification → settlement lifecycle"
  - "MPC public key derivation with fallback for dev mode"
  - "Cross-contract Promise pattern for MPC signing"

issues-created: []

# Metrics
duration: 25min
completed: 2026-01-12
---

# Phase 1 Plan 6: Chain Signatures & Intents Summary

**Multi-chain MPC key management with intent-based transactions and deterministic account recovery**

## Performance

- **Duration:** ~25 min (includes prior session + checkpoint fix)
- **Started:** 2026-01-12T00:29:17Z
- **Completed:** 2026-01-12T00:54:13Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 8

## Accomplishments

- **Chain Signatures Integration**: Implemented MPC key management module supporting Secp256k1 (Ethereum, Bitcoin) and Ed25519 (Solana) chains
- **Multi-Chain Address Derivation**: Deterministic address generation from single NEAR account - same derivation path always produces same address
- **Intent Verifier Contract**: Custom verifier for coalition-specific intent types (transfer, mission_order, document_verification)
- **MPC Account Recovery**: Users can recover access via Privy re-authentication - same user ID produces same derivation path produces same MPC key
- **Frontend Intent Client**: TypeScript client for creating and executing intents with solver network abstraction
- **Complete Blockchain Abstraction**: Zero crypto terminology in user-facing UI - users see "login", "account", "approve" not "wallet", "gas", "transaction"

## Task Commits

Each task was committed atomically:

1. **Task 1: Chain Signatures Integration**
   - `8f34968` fix(1-06): implement Privy embedded wallet creation and NEAR account derivation
   - `be8bda8` feat(1-06): implement NEAR Chain Signatures MPC account management
   - `6acd64a` feat(1-06): implement MPC key backup and account recovery

2. **Task 2: NEAR Intents Creation and Verification**
   - Included in above commits (intents.rs, intents.ts)

3. **Task 3: Checkpoint - Human Verification**
   - `931d8cb` fix(1-06): use correct MPC contract address and fix response parsing

## Files Created/Modified

### NEAR Contract
- `near-contracts/src/chain_signatures.rs` - MPC key management module (250+ lines)
  - ChainSignatureManager with derivation paths
  - derive_address, request_signature methods
  - Support for Secp256k1 and Ed25519 curves
  - Unit tests for path registration, address derivation, signature requests

- `near-contracts/src/intents.rs` - Intent verification module (600 lines)
  - Intent struct with lifecycle status (Pending, Verified, Rejected)
  - IntentVerifier with submit_intent, verify_*, settle_intent methods
  - Transfer, mission order, and document verification types
  - 10 unit tests covering all intent flows

- `near-contracts/src/lib.rs` - Contract integration
  - Added chain_signature_manager and intent_verifier to state
  - register_chain_path, get_derived_address, sign_transaction methods
  - submit_intent, settle_intent methods
  - Owner-only access control for chain path registration

### Frontend
- `frontend/src/lib/intents.ts` - Intent client (200+ lines)
  - IntentClient class for intent creation and execution
  - TransferIntent, MissionOrderIntent, DocumentVerificationIntent types
  - Solver quote simulation (mocked for testnet)

- `frontend/src/lib/mpcRecovery.ts` - MPC recovery service (310 lines)
  - MPCRecoveryManager for MPC registration and recovery
  - deriveMPCPublicKey using v2.multichain-mpc.testnet
  - Deterministic key derivation from Privy user ID
  - Development fallback for mock key generation

## Decisions Made

1. **MPC Contract Address**: Used `v2.multichain-mpc.testnet` instead of `v1.signer-dev.testnet` - the former is the current active Chain Signatures MPC network.

2. **Intent Verification Pattern**: Intents go through Pending → Verified/Rejected lifecycle, with type-specific verification methods.

3. **MPC Recovery Architecture**: Recovery works by deterministic derivation - same Privy user ID → same derivation path → same MPC key, restoring account access.

4. **Development Fallback**: Mock MPC keys generated in dev mode when live MPC call fails, allowing flow testing without network dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MPC contract address incorrect**
- **Found during:** Checkpoint verification (Task 3)
- **Issue:** `v1.signer-dev.testnet` contract has state deserialization issues
- **Fix:** Updated to `v2.multichain-mpc.testnet` - the active MPC network
- **Files modified:** frontend/src/lib/mpcRecovery.ts
- **Verification:** MPC public key now derives correctly
- **Committed in:** 931d8cb

**2. [Rule 1 - Bug] MPC response parsing**
- **Found during:** Checkpoint verification (Task 3)
- **Issue:** Response is JSON string with quotes, not raw string
- **Fix:** Added JSON.parse to decode the response properly
- **Files modified:** frontend/src/lib/mpcRecovery.ts
- **Verification:** Public key extracted correctly as `secp256k1:4NfTiv3Us...`
- **Committed in:** 931d8cb

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 0 deferred
**Impact on plan:** Both fixes necessary for MPC integration to function. No scope creep.

## Issues Encountered

- **Integration tests fail**: near-workspaces sandbox has WASM compatibility issues (documented in prior plans). Unit tests pass (33/33).
- **pg-boss timing**: Required lazy initialization fix (committed separately as `b17190a`).

## Test Results

### Unit Tests (NEAR Contract)
```
running 33 tests
✓ chain_signatures::tests::test_register_path
✓ chain_signatures::tests::test_derive_address_deterministic
✓ chain_signatures::tests::test_signature_request
✓ chain_signatures::tests::test_get_all_paths
✓ intents::tests::test_submit_intent
✓ intents::tests::test_verify_transfer_intent
✓ intents::tests::test_verify_mission_order_intent
✓ intents::tests::test_verify_document_intent
✓ intents::tests::test_settle_intent
... (33 total)

test result: ok. 33 passed; 0 failed
```

### Frontend Build
```
✓ TypeScript compilation successful
✓ Vite build completed in 17.39s
✓ No type errors
```

## Verification Checklist

- [x] Chain Signatures integrated with MPC contract (v2.multichain-mpc.testnet)
- [x] Multi-chain address derivation works deterministically
- [x] Intent creation API functional in frontend
- [x] Verifier contract validates intents correctly (3 types)
- [x] Complete blockchain abstraction verified (checkpoint approved)
- [x] Zero blockchain terminology in user-facing UI
- [x] MPC key recovery flow operational
- [x] All unit tests passing (33/33)

## Next Steps

Ready for [1-07-PLAN.md](1-07-PLAN.md): Containerization & Dev Environment

The Chain Signatures + Intents integration completes the zero-blockchain UX layer:
- Users login with email (Privy)
- Single NEAR account controls assets across Bitcoin, Ethereum, Solana, etc.
- Intent-based transactions hide all blockchain complexity
- Account recovery via same email re-authentication

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-01-12*
