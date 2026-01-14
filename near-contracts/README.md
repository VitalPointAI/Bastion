# BASTION NEAR Smart Contracts

Rust smart contracts for the BASTION platform, handling document registry, privacy routing, and TEE attestation verification.

**Role in the System:** The smart contracts provide the immutable verification layer—every document, decision, and action gets an on-chain audit trail. They also enforce privacy routing (classified data → Phala TEE, public data → on-chain) and enable multi-chain control via Chain Signatures. This is the source of truth for provenance and governance.

## Contract Features

- **Document Registry**: Store and verify document metadata with CID references
- **Privacy Routing**: Automatic classification-based routing (Public → on-chain, Secret → Phala TEE)
- **Attestation Verification**: Validate TEE execution results
- **State Versioning**: Safe contract upgrades with migration support
- **Chain Signatures Integration**: MPC key management for multi-chain control
- **Intents Support**: Transaction abstraction for zero-blockchain UX

## Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install NEAR tools
cargo install cargo-near near-cli-rs
```

## Building

```bash
# Standard build
cargo near build

# Release build (optimized)
cargo near build --release

# Using build script
./build.sh
```

The compiled WASM will be in `target/near/`.

## Testing

```bash
# Run all unit tests
cargo test

# Run specific module tests
cargo test document::tests
cargo test privacy::tests
cargo test attestation::tests

# Run with output
cargo test -- --nocapture

# Run integration tests (requires workspaces sandbox)
cargo test --test integration
```

### Test Coverage

| Module | Tests | Description |
|--------|-------|-------------|
| `document` | 7 | Document CRUD, access control |
| `privacy` | 3 | Classification routing, TEE routing |
| `attestation` | 4 | App hash, hardware, expiry verification |
| `lib` | 4 | Contract initialization, owner methods |

## Deployment

### Testnet

```bash
# Create testnet account (if needed)
near account create-account fund-later use-auto-generation save-to-folder ~/.near-credentials/testnet

# Deploy with initialization
near contract deploy <account-id>.testnet \
  use-file ./target/near/near_contracts.wasm \
  with-init-call new json-args '{"owner":"<account-id>.testnet"}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet

# Upgrade existing deployment
near contract deploy <account-id>.testnet \
  use-file ./target/near/near_contracts.wasm \
  with-init-call migrate json-args '{}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config testnet
```

### Mainnet

```bash
near contract deploy <account-id>.near \
  use-file ./target/near/near_contracts.wasm \
  with-init-call new json-args '{"owner":"<account-id>.near"}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config mainnet
```

## Contract Methods

### Document Registry

```bash
# Store document
near contract call-function as-transaction <contract> store_document \
  json-args '{"cid":"bafybeig...","classification":"Public","metadata":{}}' \
  prepaid-gas '30 Tgas' attached-deposit '0.1 NEAR'

# Get document
near contract call-function as-read-only <contract> get_document \
  json-args '{"cid":"bafybeig..."}'
```

### Privacy Routing

```bash
# Process data (auto-routes based on classification)
near contract call-function as-transaction <contract> process_data \
  json-args '{"data":"...","classification":"Secret"}' \
  prepaid-gas '50 Tgas' attached-deposit '0 NEAR'

# Configure Phala backend (owner only)
near contract call-function as-transaction <contract> set_phala_backend \
  json-args '{"account_id":"phala-tee.testnet"}' \
  prepaid-gas '10 Tgas' attached-deposit '0 NEAR'
```

### Attestation

```bash
# Set trusted app hash (owner only)
near contract call-function as-transaction <contract> set_trusted_app_hash \
  json-args '{"app_hash":"0x123..."}' \
  prepaid-gas '10 Tgas' attached-deposit '0 NEAR'
```

## Project Structure

```
near-contracts/
├── src/
│   ├── lib.rs           # Contract entry point, main state
│   ├── document.rs      # Document registry module
│   ├── privacy.rs       # Privacy routing module
│   ├── attestation.rs   # TEE attestation verification
│   ├── chain_signatures.rs  # MPC key integration
│   └── intents.rs       # Transaction abstraction
├── tests/
│   └── integration.rs   # Workspaces sandbox tests
├── Cargo.toml           # Dependencies
├── rust-toolchain.toml  # Rust version pinning
└── build.sh             # Build helper script
```

## State Migration

When upgrading the contract, call the `migrate` method:

```rust
#[init(ignore_state)]
pub fn migrate() -> Self {
    let old_state: OldContract = env::state_read().expect("state");
    Self {
        // ... migrate fields
        state_version: 2,
    }
}
```

The contract uses inline `state_version` field for tracking (borsh-compatible).

## Gas Costs

| Operation | Estimated Gas |
|-----------|---------------|
| `store_document` | ~10 Tgas |
| `get_document` | ~5 Tgas |
| `process_data` (public) | ~5 Tgas |
| `process_data` (secret) | ~50 Tgas |
| Cross-contract call | ~50 Tgas |

## Links

- [NEAR Rust SDK](https://docs.near.org/sdk/rust/introduction)
- [cargo-near](https://github.com/near/cargo-near)
- [near-cli-rs](https://github.com/near/near-cli-rs)
- [NEAR Documentation](https://docs.near.org)
