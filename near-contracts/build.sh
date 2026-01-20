#!/bin/bash
set -e

# Build script using cargo-near
# This handles WASM compilation, optimization, and ABI generation automatically

echo "Building NEAR smart contract..."
# Use non-reproducible-wasm for development and --no-wasmopt to avoid bulk memory errors
# For production builds, use the reproducible Docker-based build
cargo near build non-reproducible-wasm --no-wasmopt

echo ""
echo "Build complete!"
echo "WASM binary location: target/near/near_contracts.wasm"
