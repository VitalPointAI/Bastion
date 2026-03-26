#!/usr/bin/env bash
# Build the DID registry contract for NEAR testnet/mainnet.
#
# Handles two WASM compatibility issues with recent Rust/LLVM toolchains:
#   1. call_indirect reserved byte encoded as multi-byte LEB128 (NEAR MVP validator rejects)
#   2. sign-ext opcodes (0xC0) not supported by NEAR wasmer
#
# Requires: wasm-opt (install via: npm install -g binaryen)
# Output: target/wasm32-unknown-unknown/release/did_registry_near_compat.wasm
set -euo pipefail

cd "$(dirname "$0")"

echo "=== Building DID registry contract ==="

# 1. Compile with Rust
cargo build --target wasm32-unknown-unknown --release

RAW_WASM="target/wasm32-unknown-unknown/release/did_registry.wasm"
COMPAT_WASM="target/wasm32-unknown-unknown/release/did_registry_near_compat.wasm"

if ! command -v wasm-opt &>/dev/null; then
  echo "ERROR: wasm-opt not found. Install with: npm install -g binaryen"
  echo "Deploying raw WASM (may fail on testnet due to MVP incompatibilities)"
  cp "$RAW_WASM" "$COMPAT_WASM"
else
  echo "Running wasm-opt to produce MVP-compatible WASM..."
  wasm-opt -Oz --strip-debug --mvp-features --signext-lowering "$RAW_WASM" -o "$COMPAT_WASM"
  echo "Done. Compatible WASM: $COMPAT_WASM ($(wc -c < "$COMPAT_WASM") bytes)"
fi

echo ""
echo "Deploy with:"
echo "  near contract deploy did.bastion.testnet \\"
echo "    use-file $COMPAT_WASM \\"
echo "    without-init-call \\"
echo "    network-config testnet sign-with-keychain send"
