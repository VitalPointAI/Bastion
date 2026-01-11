---
phase: 01-foundation-infrastructure
plan: 04
type: execute
---

<objective>
Set up Phala Network TEE (Trusted Execution Environment) with local development environment, ink! smart contracts, and remote attestation verification.

Purpose: Establish confidential computing infrastructure for privacy-preserving backend operations, proving classified workloads can run securely in hardware-isolated enclaves.
Output: Working Phala TEE development environment with verified remote attestation and basic Phat Contract deployment capability.
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

**Tech stack available:**
- NEAR smart contracts with state versioning and document registry
- React frontend with Privy authentication
- IPFS decentralized storage with client-side encryption

**Established patterns:**
- State versioning with enums
- Client-side encryption before storage
- Content addressing with IPFS
- Complete blockchain abstraction in UI

**From RESEARCH.md:**
- Use ink! 5.x-6.x for Phala Phat Contracts (Rust-based, compiled to WASM)
- cargo-contract for building and deploying ink! contracts
- DevPHAse for local TEE development environment
- Phala Cloud SDK for production deployment
- Remote attestation verification pattern (verify before trusting TEE results)
- Don't hand-roll: attestation verification (use Phala infrastructure), TEE key management (Phala deterministic keys), privacy primitives (TEE hardware handles isolation)

**From CONTEXT.md:**
- Privacy-preserving backend execution is equally critical foundational element
- Phala TEE must actually protect sensitive data in confidential computing environment
- Proving classified workloads can run securely
- Transparent privacy layer - complexity abstracted based on data classification
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Phala development tools and initialize DevPHAse environment</name>
  <files>phala-backend/package.json, phala-backend/devphase.config.json, phala-backend/.gitignore</files>
  <action>
    Set up Phala local TEE development environment with ink! tooling:

    1. Install ink! tooling:
       - cargo install cargo-contract --version ~5.0 (latest stable)
       - Verify: cargo contract --version

    2. Create phala-backend directory: mkdir -p phala-backend && cd phala-backend

    3. Initialize DevPHAse (local Phala testnet):
       - npm init -y (or pnpm init)
       - pnpm add -D devphase
       - npx devphase init (creates config and project structure)

    4. Configure devphase.config.json:
       - Set local node URL (http://localhost:8000)
       - Configure contract compilation settings
       - Enable stack size configuration (needed for some contracts)

    5. Create .gitignore:
       - node_modules/
       - target/
       - artifacts/
       - .devphase/

    6. Start local Phala node:
       - npx devphase stack setup (downloads Phala node components)
       - npx devphase stack start (starts local TEE-enabled node)
       - Verify node running at http://localhost:8000

    Use DevPHAse instead of connecting to public testnet for development (faster, isolated, reproducible, no external dependencies).
    Use cargo-contract v5.0+ for latest ink! v5-v6 support and chain snapshot testing.

    Don't hand-roll: local Phala node setup (DevPHAse handles complex TEE simulation), contract deployment infrastructure (DevPHAse provides deployment scripts).
  </action>
  <verify>
    - cargo contract --version succeeds
    - npx devphase --version succeeds
    - npx devphase stack start runs without errors
    - Can access http://localhost:8000/health (returns 200)
    - DevPHAse dashboard accessible (if enabled)
  </verify>
  <done>ink! tooling installed, DevPHAse local TEE environment operational, Phala node running on localhost:8000, development infrastructure ready</done>
</task>

<task type="auto">
  <name>Task 2: Create basic Phat Contract with confidential data handling</name>
  <files>phala-backend/contracts/lib.rs, phala-backend/contracts/Cargo.toml</files>
  <action>
    Implement basic Phat Contract demonstrating confidential computation in TEE:

    1. Create ink! contract project:
       - cd phala-backend
       - cargo contract new contracts --name confidential_processor

    2. Modify contracts/Cargo.toml:
       - ink = "5.0" (or latest stable v5/v6)
       - scale = { package = "parity-scale-codec", version = "3", features = ["derive"] }
       - scale-info = { version = "2", features = ["derive"] }

    3. Implement in contracts/lib.rs:
       - ConfidentialProcessor contract with storage:
         * processed_count: u64 (number of confidential operations)
         * owner: AccountId

       - #[ink(constructor)] new() initializes contract

       - #[ink(message)] process_confidential(data: Vec<u8>) -> Vec<u8>:
         * Simulates confidential processing in TEE
         * Increments processed_count
         * Returns hash of input (demonstrates TEE can see plaintext)
         * Logs operation (visible in TEE logs, not on public chain)

       - #[ink(message)] get_processed_count() -> u64 (view method)

    4. Build contract:
       - cargo contract build --release
       - Verify artifacts created in target/ink/

    5. Deploy to local DevPHAse:
       - Create deployment script in scripts/deploy.ts
       - Use DevPHAse API to deploy contract
       - Get contract address

    Use ink! instead of Solidity (designed for Substrate/Polkadot ecosystem, Phala uses Substrate).
    TEE isolation means contract can process sensitive data that never leaves hardware enclave.

    Don't hand-roll: ink! storage macros (use #[ink(storage)]), message encoding (ink! handles it), deployment workflow (use DevPHAse scripts).
  </action>
  <verify>
    - cargo contract build succeeds without errors
    - Contract WASM file created: target/ink/confidential_processor.wasm
    - Contract metadata created: target/ink/metadata.json
    - Deployment to DevPHAse succeeds
    - Can call process_confidential method
    - get_processed_count returns incremented value
  </verify>
  <done>Phat Contract compiled to WASM successfully, deployed to local DevPHAse environment, confidential processing methods functional, TEE execution verified</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Phala TEE local environment with confidential contract</what-built>
  <how-to-verify>
    Verify that Phala TEE is actually running and processing data confidentially:

    1. Ensure DevPHAse stack is running:
       - cd phala-backend
       - npx devphase stack start (if not already running)
       - Verify node health: curl http://localhost:8000/health

    2. Check contract deployment:
       - Verify contract deployed successfully
       - Note contract address from deployment logs

    3. Test confidential processing:
       - Call process_confidential with test data via DevPHAse scripts or API
       - Verify method returns hash of input
       - Call get_processed_count
       - Verify count incremented

    4. Inspect TEE characteristics:
       - Check DevPHAse logs for TEE simulation messages
       - Verify contract runs in isolated environment (DevPHAse simulates TEE)
       - Confirm data processing happens within enclave

    5. Critical validation:
       - Contract compiles to WASM and deploys successfully
       - Methods callable and return expected results
       - TEE environment operational (even if simulated locally)
       - Ready for remote attestation integration

    Expected behavior: Phat Contract running in DevPHAse TEE environment, processing data confidentially, methods callable via API.

    Note: DevPHAse simulates TEE locally - full hardware attestation requires Phala Cloud deployment (future phase).
  </how-to-verify>
  <resume-signal>Type "approved" if Phala TEE environment is operational and contract is processing data, or describe any issues</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] cargo contract build succeeds for Phat Contract
- [ ] DevPHAse local TEE node running without errors
- [ ] Contract deployed to local environment
- [ ] Confidential processing methods callable
- [ ] TEE execution verified (checkpoint confirms)
- [ ] Ready for attestation verification and NEAR integration
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from build or runtime
- Phala TEE development environment fully operational
- Phat Contract deployed and functional
- Confidential data processing demonstrated
- DevPHAse local testnet stable
- Ready for NEAR-Phala integration in subsequent plans
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-04-SUMMARY.md`:

# Phase 1 Plan 4: Phala TEE Environment Summary

**Confidential computing infrastructure with Phala TEE enables privacy-preserving backend operations in hardware-isolated enclaves**

## Accomplishments

- ink! smart contract tooling installed (cargo-contract v5.0+)
- DevPHAse local TEE environment operational on localhost:8000
- Basic Phat Contract implemented with confidential processing
- Contract compiled to WASM and deployed successfully
- Confidential data processing methods functional
- TEE execution verified in isolated environment
- Foundation established for remote attestation integration

## Files Created/Modified

- `phala-backend/package.json` - DevPHAse dependencies
- `phala-backend/devphase.config.json` - Local TEE configuration
- `phala-backend/contracts/lib.rs` - Phat Contract implementation
- `phala-backend/contracts/Cargo.toml` - ink! dependencies
- `phala-backend/scripts/deploy.ts` - Deployment automation

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Ready for [1-05-PLAN.md](1-05-PLAN.md): NEAR-Phala Integration
</output>
