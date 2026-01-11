---
phase: 01-foundation-infrastructure
plan: 01
type: execute
---

<objective>
Establish NEAR smart contract development environment with Rust tooling, basic contract infrastructure, and testing framework.

Purpose: Create the foundation for all on-chain smart contract development throughout the project, establishing patterns for state management, testing, and deployment.
Output: Working NEAR Rust development environment with validated contract deployment capability and testing infrastructure.
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

**Tech stack available:** None yet (greenfield project)
**Established patterns:** None yet (first phase)

**From RESEARCH.md:**
- Use Rust for NEAR smart contracts (primary language, best tooling)
- cargo-near + near-cli-rs workflow for build and deployment
- workspaces-rs for sandbox testing (fast, isolated, reproducible)
- State versioning with enums from day one (critical for upgrades)
- Validation with require! at method start (fail fast pattern)
- Don't hand-roll: state migration, serialization (use borsh/serde), gas estimation

**From CONTEXT.md:**
- All foundational elements equally critical and non-negotiable
- Follow NEAR ecosystem standards and recommended patterns
- Don't reinvent solutions - leverage proven patterns
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Rust and NEAR development tooling</name>
  <files>None (system-level installation)</files>
  <action>
    Install Rust toolchain with WASM target and NEAR development tools:
    1. Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    2. Add WASM target: rustup target add wasm32-unknown-unknown
    3. Install cargo-near: cargo install cargo-near
    4. Install near-cli-rs: cargo install near-cli-rs
    5. Verify installations: cargo --version, cargo near --version, near --version

    Use cargo-near instead of manual WASM builds (handles optimization and ABI generation automatically).
    Use near-cli-rs instead of legacy near-cli (official recommended tool, faster, better maintained).
  </action>
  <verify>
    All commands return version numbers without errors:
    - cargo --version
    - rustup target list | grep wasm32-unknown-unknown (shows "installed")
    - cargo near --version
    - near --version
  </verify>
  <done>Rust toolchain with WASM target installed, cargo-near and near-cli-rs available, all version commands succeed</done>
</task>

<task type="auto">
  <name>Task 2: Create initial NEAR smart contract with state versioning</name>
  <files>near-contracts/src/lib.rs, near-contracts/src/state.rs, near-contracts/Cargo.toml, near-contracts/build.sh</files>
  <action>
    Create NEAR smart contract project structure with state versioning pattern from day one:

    1. Create project: cargo near new near-contracts --contract-name ssr-foundation
    2. Modify Cargo.toml to include:
       - near-sdk = "5.x" (latest stable)
       - near-contract-tools = "latest" (helper macros, reduces boilerplate)
       - overflow-checks = true in [profile.release] (prevent integer overflow bugs)

    3. Implement state versioning structure in src/state.rs:
       - VersionedState enum with V1 variant
       - StateV1 struct with basic fields (owner: AccountId, initialized: bool)
       - Use BorshSerialize + BorshDeserialize
       - Add #[init(ignore_state)] migrate() method for future upgrades

    4. Create src/lib.rs with:
       - Contract struct wrapping VersionedState
       - #[init] new() method
       - Basic public method with require! validation pattern
       - Private internal methods separate from public interface

    5. Create build.sh script using cargo-near build (not manual wasm compilation)

    Follow NEAR best practices: validate with require! at method start (fail fast), update state before external calls (checks-effects-interactions), use UnorderedMap/Vector for collections (gas efficient).

    Don't hand-roll: state migration logic (enum versioning handles it), serialization (borsh built-in), manual WASM optimization (cargo-near handles it).
  </action>
  <verify>
    - cargo near build succeeds without errors
    - target/wasm32-unknown-unknown/release/*.wasm file exists
    - cargo test runs without errors
    - State versioning enum present in code
  </verify>
  <done>Smart contract compiles to WASM successfully, state versioning pattern implemented, basic validation and initialization methods present, build script functional</done>
</task>

<task type="auto">
  <name>Task 3: Set up testing framework with workspaces-rs</name>
  <files>near-contracts/tests/integration.rs, near-contracts/Cargo.toml</files>
  <action>
    Create workspaces-rs testing infrastructure for fast, isolated contract testing:

    1. Add to Cargo.toml [dev-dependencies]:
       - near-workspaces = "latest"
       - tokio = { version = "1", features = ["full"] }
       - serde_json = "1"

    2. Create tests/integration.rs with:
       - Async test using #[tokio::test]
       - Sandbox worker initialization (local NEAR runtime)
       - Contract deployment from WASM bytes using include_bytes!()
       - Test account creation via worker.dev_create_account()
       - Contract initialization test
       - Basic method call test with attached deposit
       - View method query test
       - Gas usage measurement test

    3. Test contract upgrade pattern:
       - Deploy V1
       - Call migrate() method
       - Verify state preserved after migration

    Use workspaces-rs instead of testnet deployment for tests (much faster, isolated, reproducible, no testnet latency).
    Measure gas usage to establish baselines for optimization later.
    Test with attached deposits to verify storage deposit patterns work correctly.
  </action>
  <verify>
    - cargo test runs all integration tests successfully
    - Tests complete in under 10 seconds (sandbox is fast)
    - Contract deployment, initialization, method calls, and view queries all pass
    - No warnings about gas limits or storage issues
  </verify>
  <done>Integration test suite operational using workspaces-rs sandbox, contract lifecycle verified (deploy, init, call, query), gas measurement working, upgrade pattern tested</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] cargo near build produces WASM without errors
- [ ] cargo test passes all integration tests
- [ ] near-cli-rs and cargo-near installed and functional
- [ ] State versioning pattern present and tested
- [ ] Basic contract methods validated with require! pattern
</verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings from build or tests
- NEAR Rust development environment fully operational
- State versioning and testing patterns established
- Ready for smart contract feature development in subsequent plans
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-infrastructure/1-01-SUMMARY.md`:

# Phase 1 Plan 1: NEAR Smart Contract Foundation Summary

**NEAR Rust development environment established with contract, testing, and deployment infrastructure**

## Accomplishments

- Rust toolchain with WASM target installed and verified
- NEAR development tools (cargo-near, near-cli-rs) operational
- Basic smart contract with state versioning pattern implemented
- workspaces-rs integration testing framework functional
- Contract lifecycle validated (build, deploy, test, upgrade)

## Files Created/Modified

- `near-contracts/Cargo.toml` - Project dependencies and configuration
- `near-contracts/src/lib.rs` - Main contract with validation patterns
- `near-contracts/src/state.rs` - Versioned state structures
- `near-contracts/build.sh` - Build script using cargo-near
- `near-contracts/tests/integration.rs` - Integration tests with workspaces-rs

## Decisions Made

[Key decisions and rationale, or "None"]

## Issues Encountered

[Problems and resolutions, or "None"]

## Next Step

Ready for [1-02-PLAN.md](1-02-PLAN.md): Frontend Foundation & Authentication
</output>
