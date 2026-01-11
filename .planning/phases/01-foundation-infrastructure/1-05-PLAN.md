---
phase: 01-foundation-infrastructure
plan: 05
type: execute
---

<objective>
Integrate NEAR smart contracts with Phala TEE backend, implementing transparent privacy routing based on data classification and AI context security patterns.

Purpose: Create seamless communication between blockchain and confidential computing layers with automatic classification-based routing and secure AI context handling.
Output: Working NEAR-Phala integration with transparent privacy routing, attestation verification, and ephemeral AI context management.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
./summary.md
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

**Tech stack available:**
- NEAR smart contracts with document registry
- React frontend with Privy authentication
- IPFS encrypted storage with on-chain CIDs
- Phala TEE with Phat Contracts deployed

**Established patterns:**
- State versioning with enums
- Client-side encryption before storage
- Content addressing with IPFS
- Confidential processing in TEE

**From RESEARCH.md:**
- Transparent privacy routing pattern (automatic TEE routing based on classification)
- Attestation verification before trusting TEE results
- Cross-contract calls with Promise returns
- Ephemeral AI context (client-side only for highly sensitive data)
- TEE-encrypted context for less sensitive data
- Don't hand-roll: attestation verification (use Phala infrastructure), cross-chain communication protocols, key management in TEE

**From CONTEXT.md:**
- End-to-end communication flow is equally critical foundational element
- Data must flow smoothly from frontend through blockchain to TEE backend
- Transparent privacy layer - complexity abstracted based on data classification
- AI context and training data protected through client-side or TEE encryption
- Ephemeral handling for highly sensitive data
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement transparent privacy routing in NEAR contract</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/privacy.rs, near-contracts/tests/integration.rs</files>
  <action>
    Create classification-based automatic routing to Phala TEE for sensitive data:

    1. Create src/privacy.rs module:
       - Classification enum:
         * Public (processed on-chain)
         * Secret (routed to TEE)
         * TopSecret (routed to TEE)

       - PrivacyRouter struct with:
         * phala_backend_account: AccountId (Phala contract address)
         * classification_policies: HashMap<Classification, ProcessingPolicy>

       - ProcessingPolicy enum:
         * OnChain (process directly)
         * OffChainTEE (route to Phala)

    2. Add to Contract in lib.rs:
       - set_phala_backend method:
         * Owner-only (validate with require!)
         * Sets phala_backend_account for TEE routing
         * Emits configuration event

       - process_data method:
         * Accepts data: Vec<u8>, classification: Classification
         * Routes based on classification:
           - Public: process_on_chain(data) → immediate result
           - Secret/TopSecret: route_to_tee(data, classification) → Promise
         * Returns Promise for async TEE processing

       - route_to_tee private method:
         * Creates cross-contract call to Phala backend
         * Attaches sufficient gas (50 Tgas recommended)
         * Returns Promise with callback
         * Callback verifies result (attestation check placeholder)

    3. Add integration tests:
       - Test public data processed on-chain immediately
       - Test secret data creates Promise for TEE routing
       - Test phala_backend configuration
       - Test unauthorized access blocked

    Use Promise returns for cross-contract calls (enables proper callback handling).
    Early validation with require! (fail fast before expensive operations).
    Transparent to caller - classification determines routing automatically.

    Don't hand-roll: Promise chaining (use ext_contract pattern), gas estimation (start high at 50 Tgas, optimize later based on measurement), callback verification logic (placeholder for now, full attestation in next task).
  </action>
  <verify>
    - cargo near build succeeds
    - cargo test passes privacy routing tests
    - Public classification processes on-chain
    - Secret/TopSecret classification creates Promise
    - phala_backend configuration works
    - Unauthorized calls fail with clear error
  </verify>
  <done>Privacy routing implemented in NEAR contract, classification-based automatic routing functional, cross-contract call structure established, integration tests passing</done>
</task>

<task type="auto">
  <name>Task 2: Add attestation verification to NEAR-Phala communication</name>
  <files>near-contracts/src/attestation.rs, near-contracts/src/lib.rs, near-contracts/tests/integration.rs</files>
  <action>
    Implement remote attestation verification to ensure TEE results are trustworthy:

    1. Create src/attestation.rs module:
       - AttestationReport struct with fields:
         * hw_identity: String (hardware fingerprint)
         * app_hash: String (expected Phat Contract code hash)
         * report_data: String (hash of TEE result)
         * signature: Vec<u8> (cryptographic signature)
         * timestamp: u64

       - AttestationVerifier struct with:
         * expected_app_hash: String (whitelisted Phat Contract hash)
         * trusted_hw_identities: Vec<String> (allowed TEE hardware)

       - verify_attestation method:
         * Validates signature (placeholder - full crypto verification requires additional libraries)
         * Checks app_hash matches expected
         * Verifies hw_identity in trusted list
         * Validates report_data matches result hash
         * Returns Result<(), AttestationError>

    2. Add to Contract in lib.rs:
       - set_trusted_app_hash method (owner-only):
         * Sets expected Phat Contract code hash
         * Used to verify TEE is running approved code

       - on_tee_result callback (private):
         * Receives result from Phala TEE
         * Receives AttestationReport
         * Calls verify_attestation before trusting result
         * If verification passes: stores result
         * If verification fails: logs error, rejects result

       - Modified route_to_tee:
         * Requires AttestationReport in callback
         * Chains to on_tee_result for verification

    3. Add integration tests:
       - Test attestation with valid app_hash passes
       - Test attestation with wrong app_hash fails
       - Test attestation with untrusted hardware fails
       - Test result only accepted after attestation verification

    Follow Phala attestation pattern: verify signature, validate certificate chain, check hardware identity, verify application measurement.

    Don't hand-roll: full cryptographic signature verification (placeholder acceptable for v1, production requires proper crypto library), attestation report generation (Phala TEE provides this), hardware identity validation (trust list for now, full chain-of-trust in production).

    Note: This is foundational structure - full remote attestation with Intel SGX/AMD SEV verification requires Phala Cloud deployment (not DevPHAse simulation).
  </action>
  <verify>
    - cargo near build succeeds
    - cargo test passes attestation tests
    - Valid attestation allows result acceptance
    - Invalid attestation blocks result acceptance
    - Attestation verification integrated into TEE callback
  </verify>
  <done>Attestation verification implemented, TEE results only accepted after verification, code hash and hardware identity validation functional, callback pattern established</done>
</task>

<task type="auto">
  <name>Task 3: Implement AI context security in frontend</name>
  <files>frontend/src/lib/aiContext.ts, frontend/src/lib/teeClient.ts, frontend/package.json</files>
  <action>
    Create AI context management with classification-based persistence and ephemeral handling:

    1. Create src/lib/aiContext.ts:
       - AIContextManager class with:
         * ephemeralContext: Map<string, any> (in-memory only)
         * encryptedContext: Map<string, EncryptedContext> (session-based)
         * classification levels: TS, SECRET, CONFIDENTIAL, UNCLASS

       - addContext(sessionId, context, classification) method:
         * TS/SECRET: store in ephemeralContext (memory only)
         * CONFIDENTIAL: encrypt and store in encryptedContext
         * UNCLASS: can persist normally (not implemented yet)
         * Optionally sends to TEE for processing

       - getContext(sessionId, classification) method:
         * Retrieves from appropriate storage based on classification
         * Returns null if not found or access denied

       - clearSession(sessionId) method:
         * Explicitly clears ephemeral data from memory
         * Clears encrypted session data
         * Notifies TEE to clear session (future enhancement)

    2. Create src/lib/teeClient.ts:
       - TEEClient class for frontend-to-Phala communication:
         * sendToTEEMemory(sessionId, context) method:
           - Sends sensitive context to Phala TEE for in-memory processing
           - Context stays in TEE secure enclave, never persists
           - Returns promise with session handle

         * clearTEESession(sessionId) method:
           - Signals Phala to clear ephemeral context
           - Ensures no sensitive data persists in TEE

       - Integration with NEAR contract via Privy wallet:
         * Use embedded NEAR wallet for signing
         * Call NEAR contract process_data with classification
         * Contract routes to Phala based on classification

    3. Add TypeScript types:
       - Classification type
       - ContextEntry interface
       - EncryptedContext interface

    Follow ephemeral context pattern: highly sensitive data (TS/SECRET) never persisted, kept in memory only or TEE memory.
    Less sensitive (CONFIDENTIAL) encrypted before any storage.
    Clear separation between classification levels.

    Don't hand-roll: session management (use simple Map for v1, enhance in future phases), TEE communication protocol (build on NEAR contract integration), complex key derivation (use encryption.ts utilities).
  </action>
  <verify>
    - TypeScript compilation succeeds
    - addContext stores data based on classification correctly
    - TS/SECRET data only in ephemeralContext
    - CONFIDENTIAL data encrypted before storage
    - clearSession removes all context data
    - getContext retrieves appropriate data
  </verify>
  <done>AI context security implemented, classification-based persistence working, ephemeral handling for TS/SECRET data functional, TEE client integration structure established</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] NEAR contract routes data based on classification
- [ ] Cross-contract calls to Phala return Promises
- [ ] Attestation verification integrated into callbacks
- [ ] AI context manager handles classification-based storage
- [ ] Ephemeral context cleared properly
- [ ] End-to-end flow: frontend → NEAR → Phala → attestation → result
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from build or tests
- Transparent privacy routing operational
- Attestation verification integrated
- AI context security patterns established
- NEAR-Phala communication functional
- Ready for Chain Signatures integration in subsequent plans
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-05-SUMMARY.md`:

# Phase 1 Plan 5: NEAR-Phala Integration Summary

**Seamless blockchain-TEE integration with transparent privacy routing and AI context security**

## Accomplishments

- Transparent privacy routing based on data classification
- Automatic TEE routing for SECRET/TS data
- Cross-contract call pattern with Promise returns
- Attestation verification integrated into TEE callbacks
- Code hash and hardware identity validation
- AI context manager with classification-based persistence
- Ephemeral context handling for highly sensitive data
- TEE client for frontend-to-Phala communication
- End-to-end data flow validated

## Files Created/Modified

- `near-contracts/src/privacy.rs` - Privacy routing module
- `near-contracts/src/attestation.rs` - Attestation verification
- `near-contracts/src/lib.rs` - Integration methods
- `near-contracts/tests/integration.rs` - NEAR-Phala integration tests
- `frontend/src/lib/aiContext.ts` - AI context security
- `frontend/src/lib/teeClient.ts` - TEE communication client

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Ready for [1-06-PLAN.md](1-06-PLAN.md): Chain Signatures & Intents
</output>
