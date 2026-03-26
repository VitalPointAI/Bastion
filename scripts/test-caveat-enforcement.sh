#!/usr/bin/env bash
# Smoke test: verify check_employment_authorized works on testnet
# Requires: near CLI (near-cli-rs >= 0.22.1)
# Usage: bash scripts/test-caveat-enforcement.sh [CONTRACT_ID]
set -uo pipefail

CONTRACT_ID="${1:-${DID_CONTRACT_ID:-did.bastion.testnet}}"

echo "=== Caveat Enforcement Smoke Test ==="
echo "Contract: $CONTRACT_ID"

PASS=0
FAIL=0

pass() { echo "PASS: $1"; ((PASS++)); }
fail() { echo "FAIL: $1"; ((FAIL++)); }

# ---------------------------------------------------------------------------
# Test 1: check_employment_authorized on non-existent DID returns authorized=false
# ---------------------------------------------------------------------------
echo ""
echo "Test 1: Non-existent DID returns unauthorized..."
RESULT=$(near contract call-function as-read-only "$CONTRACT_ID" check_employment_authorized \
  json-args '{"blinded_key": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "context": {"requesting_account": "test.testnet", "timestamp_ms": 1700000000000, "roe_tier_required": 1}}' \
  network-config testnet now 2>&1)
echo "$RESULT"
if echo "$RESULT" | grep -q '"authorized".*false\|authorized.*false'; then
  pass "Non-existent DID correctly returns unauthorized"
else
  fail "Expected authorized=false for non-existent DID"
fi

# ---------------------------------------------------------------------------
# Test 2: get_caveats on non-existent key returns null
# ---------------------------------------------------------------------------
echo ""
echo "Test 2: get_caveats on non-existent key returns null..."
RESULT=$(near contract call-function as-read-only "$CONTRACT_ID" get_caveats \
  json-args '{"blinded_key": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}' \
  network-config testnet now 2>&1)
echo "$RESULT"
if echo "$RESULT" | grep -q 'null'; then
  pass "Non-existent key returns null caveats"
else
  fail "Expected null for non-existent key"
fi

# ---------------------------------------------------------------------------
# Test 3: is_paused returns false
# ---------------------------------------------------------------------------
echo ""
echo "Test 3: Contract is not paused..."
RESULT=$(near contract call-function as-read-only "$CONTRACT_ID" is_paused \
  json-args '{}' network-config testnet now 2>&1)
echo "$RESULT"
if echo "$RESULT" | grep -q 'false'; then
  pass "Contract is not paused"
else
  fail "Contract appears paused or view call failed"
fi

# ---------------------------------------------------------------------------
# Test 4: get_admin returns expected admin
# ---------------------------------------------------------------------------
echo ""
echo "Test 4: get_admin returns bastion.testnet..."
RESULT=$(near contract call-function as-read-only "$CONTRACT_ID" get_admin \
  json-args '{}' network-config testnet now 2>&1)
echo "$RESULT"
if echo "$RESULT" | grep -q 'bastion.testnet'; then
  pass "Admin is bastion.testnet"
else
  fail "Expected admin bastion.testnet"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Test Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -eq 0 ]; then
  echo "All smoke tests passed."
  exit 0
else
  echo "Some tests failed."
  exit 1
fi
