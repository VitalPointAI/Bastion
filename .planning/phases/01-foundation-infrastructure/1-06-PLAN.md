---
phase: 01-foundation-infrastructure
plan: 06
type: execute
---

<objective>
Integrate NEAR Chain Signatures for multi-chain control and NEAR Intents for transaction abstraction, completing the zero-blockchain UX layer.

Purpose: Enable single NEAR account to control assets across any blockchain while abstracting all blockchain complexity from users through intent-based transactions.
Output: Working Chain Signatures integration, intent creation API, custom verifier contract, and complete blockchain abstraction demonstrated.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
./summary.md
~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation-infrastructure/1-RESEARCH.md
@.planning/phases/01-foundation-infrastructure/1-CONTEXT.md
@.planning/phases/01-foundation-infrastructure/1-01-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-02-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-03-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-04-SUMMARY.md
@.planning/phases/01-foundation-infrastructure/1-05-SUMMARY.md

**Tech stack available:**
- NEAR smart contracts with document registry and privacy routing
- React frontend with Privy embedded wallets
- IPFS encrypted storage
- Phala TEE with attestation verification
- NEAR-Phala integration

**Established patterns:**
- Complete blockchain abstraction in UI
- Transparent privacy routing
- Client-side encryption
- Attestation verification

**From RESEARCH.md:**
- Chain Signatures: MPC network (8 nodes) for multi-chain transaction signing
- Supports Secp256k1 (Bitcoin, Ethereum) and Ed25519 (Solana)
- Deterministic key derivation from single NEAR account
- NEAR Intents: Users express WHAT they want, solvers compete for best execution
- 1Click API for intent creation
- Verifier contracts for custom intent types
- Don't hand-roll: MPC key management (Chain Signatures handles it), solver network (provided by NEAR), multi-chain transaction signing

**From CONTEXT.md:**
- Complete blockchain abstraction from Phase 1 through Phase 12
- Zero blockchain exposure for operators
- Users express desired outcomes, system handles routing
- Coalition payments, mission orders, all via intents
- Performance: $5B volume, 25+ chains, near-instant settlement
</context>

<tasks>

<task type="auto">
  <name>Task 1: Integrate Chain Signatures for multi-chain key management</name>
  <files>near-contracts/src/chain_signatures.rs, near-contracts/src/lib.rs, near-contracts/tests/integration.rs</files>
  <action>
    Implement Chain Signatures integration for decentralized multi-chain control:

    1. Create src/chain_signatures.rs module:
       - ChainSignatureManager struct with:
         * mpc_contract: AccountId (NEAR MPC contract address: v1.signer.near for mainnet, v1.signer.testnet for testnet)
         * derivation_paths: UnorderedMap<String, String> (path name → actual path)

       - derive_address method:
         * Accepts path: String (e.g., "ethereum-1", "bitcoin-1")
         * Calls MPC contract to derive address for given path
         * Returns derived address (Ethereum: 0x..., Bitcoin: bc1q...)
         * Uses deterministic derivation (same path = same address)

       - request_signature method:
         * Accepts payload: Vec<u8>, path: String, target_chain: String
         * Creates cross-contract call to MPC network
         * Returns Promise with signature shares
         * Aggregates threshold signatures across 8 MPC nodes

    2. Add to Contract in lib.rs:
       - register_chain_path method:
         * Owner-only
         * Registers derivation path for chain (e.g., "coalition-payments-eth")
         * Derives and stores address for future use
         * Emits event with derived address

       - get_derived_address view method:
         * Accepts path: String
         * Returns derived address if exists
         * Returns None if path not registered

       - sign_transaction method:
         * Accepts transaction_data: Vec<u8>, chain_path: String
         * Requests signature from MPC network
         * Returns Promise with callback
         * Callback handles signature aggregation

    3. Add integration tests:
       - Test derivation path registration
       - Test address derivation (check deterministic: same path = same address)
       - Test signature request structure
       - Mock MPC responses for testing

    Chain Signatures provides decentralized key management - no single node can sign alone, requires threshold consensus.
    Supports Secp256k1 (Bitcoin, Ethereum, BNB, Polygon, Arbitrum, etc.) and Ed25519 (Solana, Aptos, Sui).

    Don't hand-roll: MPC signature aggregation (Chain Signatures MPC network handles multi-party computation), key derivation algorithms (use NEAR's deterministic derivation), threshold signature schemes (complex cryptography, use provided infrastructure).

    Note: Chain Signatures works on NEAR testnet (v1.signer.testnet). Full multi-chain signing demonstrated, though testnet limitations may exist for some chains.
  </action>
  <verify>
    - cargo near build succeeds
    - cargo test passes Chain Signatures tests
    - Can register derivation paths
    - Derived addresses deterministic (same path → same address)
    - Signature request structure correct
  </verify>
  <done>Chain Signatures integrated, multi-chain key derivation functional, MPC signature request pattern established, deterministic address generation verified</done>
</task>

<task type="auto">
  <name>Task 2: Implement NEAR Intents creation and verification</name>
  <files>frontend/src/lib/intents.ts, near-contracts/src/intents.rs, near-contracts/src/lib.rs</files>
  <action>
    Create intent-based transaction system with custom verifier contract:

    1. Install intents SDK in frontend:
       - Check for NEAR Intents SDK availability (may be integrated via NEAR API JS)
       - If dedicated SDK exists: pnpm add @near/intents-sdk
       - Otherwise: implement custom intent creation via NEAR API JS

    2. Create frontend/src/lib/intents.ts:
       - IntentClient class with:
         * createIntent(type, params) method:
           - Accepts intent type (e.g., "transfer", "mission_order", "document_verification")
           - Accepts parameters object
           - Creates intent data structure
           - Broadcasts to solver network (or mock for testnet)
           - Returns quotes from solvers

         * executeIntent(intent, quote) method:
           - User approves best quote
           - Submits to verifier contract on NEAR
           - Returns result promise

       - Intent types for coalition operations:
         * TransferIntent (cross-chain payments)
         * MissionOrderIntent (tactical execution)
         * DocumentVerificationIntent (intelligence products)

    3. Create near-contracts/src/intents.rs:
       - Intent struct with:
         * intent_type: String
         * creator: AccountId
         * params: serde_json::Value
         * status: IntentStatus (Pending, Verified, Rejected)
         * created_at: u64

       - IntentVerifier contract:
         * verify_transfer_intent method:
           - Validates transfer parameters
           - Checks user authorization
           - Returns verification result

         * verify_mission_order_intent method (placeholder):
           - Structure for future tactical execution
           - Validates commander authorization
           - Returns verification result

         * verify_document_intent method:
           - Checks document exists in registry
           - Validates access permissions
           - Returns verification result

    4. Add to Contract in lib.rs:
       - submit_intent method:
         * Accepts Intent
         * Routes to appropriate verifier based on type
         * Stores intent with Pending status
         * Emits intent created event

       - settle_intent method:
         * Called after solver execution
         * Updates intent status to Verified
         * Emits settlement event

    Use intent abstraction: users express desired outcomes, not implementation details.
    Solver network finds optimal execution path across chains.
    Verifier contract ensures intent validity before execution.

    Don't hand-roll: solver network infrastructure (NEAR provides this, may need mock for testnet), quote aggregation (built into solver protocol), cross-chain routing optimization (solvers compete to find best path).

    Note: NEAR Intents may be mainnet-only currently. Implement intent creation structure and verifier contract; mock solver responses for testnet demo if needed.
  </action>
  <verify>
    - TypeScript compilation succeeds
    - cargo near build succeeds
    - Can create intent in frontend
    - Verifier contract validates intent parameters
    - Intent submission and settlement flow works
    - Different intent types handled appropriately
  </verify>
  <done>Intent creation API functional in frontend, custom verifier contract operational on NEAR, intent submission and settlement flow established, ready for solver integration</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Complete blockchain abstraction via Privy + Chain Signatures + Intents</what-built>
  <how-to-verify>
    Verify the complete zero-blockchain UX stack is working end-to-end:

    1. Start all services:
       - Frontend: cd frontend && pnpm dev
       - NEAR contracts deployed (from previous plans)
       - Phala DevPHAse running (background)

    2. Test complete flow:
       - Visit http://localhost:5173
       - Login with email (Privy) - NO wallet installation
       - Verify logged in (UI shows user account, NOT "wallet address")

    3. Test Chain Signatures (if UI exists):
       - Trigger chain path derivation
       - Verify derived address shown (e.g., Ethereum address from NEAR account)
       - Confirm: user never entered private keys, no seed phrases

    4. Test Intent creation (basic):
       - Create simple intent (e.g., document verification)
       - Verify intent submitted to verifier contract
       - Confirm: user saw simple action ("Verify Document"), NOT transaction details
       - No gas fees shown, no chain selection, no transaction hash

    5. Critical validation - Zero blockchain exposure:
       - Scan ALL UI text visible to user
       - Must NOT contain: "wallet", "gas", "transaction", "blockchain", "MetaMask", "seed phrase", "private key", "wei", "gwei", "confirmation", "nonce"
       - Must use: "login", "account", "approve", "transfer", "process", "verify"
       - Experience should feel like email or social media, NOT crypto app

    6. Test multi-chain capability (if implemented):
       - Verify same NEAR account controls Ethereum address
       - Verify same account can control Bitcoin address (or other chains)
       - User never manages multiple wallets

    Expected behavior: Complete blockchain abstraction. User logs in with email, performs actions with simple approvals, never sees crypto terminology or wallet management.

    This is the foundational UX for ALL subsequent phases. If blockchain terminology leaks through, it must be fixed.
  </how-to-verify>
  <resume-signal>Type "approved" if complete blockchain abstraction is verified across all interactions, or describe any blockchain terminology still visible</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Chain Signatures integrated with MPC contract
- [ ] Multi-chain address derivation works deterministically
- [ ] Intent creation API functional in frontend
- [ ] Verifier contract validates intents correctly
- [ ] Complete blockchain abstraction verified (checkpoint confirms)
- [ ] Zero blockchain terminology in user-facing UI
- [ ] Ready for containerization in final plan
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from build or runtime
- Chain Signatures multi-chain control operational
- Intent creation and verification functional
- Complete blockchain abstraction demonstrated and verified
- User experience matches Web2 applications, not crypto apps
- Foundation complete for all future phases
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-06-SUMMARY.md`:

# Phase 1 Plan 6: Chain Signatures & Intents Summary

**Complete blockchain abstraction layer with multi-chain control and intent-based transactions**

## Accomplishments

- Chain Signatures integrated for decentralized multi-chain key management
- MPC network (8 nodes) signing transactions across Bitcoin, Ethereum, Solana, etc.
- Deterministic address derivation from single NEAR account
- Intent creation API implemented in frontend
- Custom verifier contract for coalition-specific intent types
- Intent submission and settlement flow operational
- Complete blockchain abstraction verified across all user interactions
- Zero blockchain terminology in UI
- Web2-style UX matching email/social apps, not crypto wallets

## Files Created/Modified

- `near-contracts/src/chain_signatures.rs` - Multi-chain key management
- `near-contracts/src/intents.rs` - Intent verification logic
- `near-contracts/src/lib.rs` - Chain Signatures and Intent methods
- `near-contracts/tests/integration.rs` - Chain Signatures tests
- `frontend/src/lib/intents.ts` - Intent creation client
- Frontend UI components updated for intent-based interactions

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Ready for [1-07-PLAN.md](1-07-PLAN.md): Containerization & Dev Environment
</output>
