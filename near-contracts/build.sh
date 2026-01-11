#!/bin/bash
set -e

# Build script using cargo-near
# This handles WASM compilation, optimization, and ABI generation automatically

echo "Building NEAR smart contract..."
cargo near build

echo ""
echo "Build complete!"
echo "WASM binary location: target/near/near_contracts.wasm"
