#!/usr/bin/env bash
#
# test-follower-control.sh
#
# Pre-mission smoke test: confirms alpha can dispatch commands to bravo and
# charlie via the BLE relay path.  Run this AFTER all three robots are powered
# on and connected to Bastion.
#
# Usage:
#   ./scripts/test-follower-control.sh              # defaults: localhost:3001
#   ./scripts/test-follower-control.sh 192.168.1.5  # custom host
#   API_PORT=3002 ./scripts/test-follower-control.sh
#
set -euo pipefail

HOST="${1:-localhost}"
PORT="${API_PORT:-3001}"
BASE="http://${HOST}:${PORT}/api/robot"

cyan='\033[0;36m'
green='\033[0;32m'
yellow='\033[1;33m'
red='\033[0;31m'
nc='\033[0m'

echo -e "${cyan}═══════════════════════════════════════════════════${nc}"
echo -e "${cyan}  BASTION — Follower Control Pre-Flight Test${nc}"
echo -e "${cyan}═══════════════════════════════════════════════════${nc}"
echo ""

# ── Step 1: Check connectivity ──────────────────────────────────────────────
echo -e "${cyan}[1/3]${nc} Checking connected robots..."
ROBOTS=$(curl -s "${BASE}/robots")

if [ -z "$ROBOTS" ] || [ "$ROBOTS" = "[]" ]; then
  echo -e "  ${red}FAIL${nc} — No robots connected to Bastion"
  echo "  Make sure alpha, bravo, and charlie are powered on and connected."
  exit 1
fi

echo "  Connected robots:"
echo "$ROBOTS" | python3 -c "
import sys, json
robots = json.load(sys.stdin)
for r in robots:
    pos = r.get('latest_telemetry', {}).get('position', {})
    heading = r.get('latest_telemetry', {}).get('heading', '?')
    bat = r.get('latest_telemetry', {}).get('battery', '?')
    state = r.get('state', 'unknown')
    x = pos.get('x', '?')
    y = pos.get('y', '?')
    print(f'    {r[\"robot_id\"]:10s}  state={state}  pos=({x}, {y})  heading={heading}°  battery={bat}%')
" 2>/dev/null || echo "$ROBOTS" | head -5

echo ""

# ── Step 2: Dispatch follower control test ──────────────────────────────────
echo -e "${cyan}[2/3]${nc} Dispatching test movements to bravo & charlie (0.3m nudge via BLE relay)..."
echo "  Waiting up to 10 seconds for movement confirmation..."
echo ""

RESULT=$(curl -s -X POST "${BASE}/test/follower-control" \
  -H "Content-Type: application/json" \
  -d '{"leader_id": "alpha", "follower_ids": ["bravo", "charlie"]}')

# ── Step 3: Report results ──────────────────────────────────────────────────
echo -e "${cyan}[3/3]${nc} Results:"
echo ""

echo "$RESULT" | python3 -c "
import sys, json
r = json.load(sys.stdin)
print(f'  Leader: {r[\"leader\"]} (connected: {r[\"leader_connected\"]})')
print()
for fid, info in r.get('followers', {}).items():
    status_parts = []
    if info.get('connected'):
        status_parts.append('connected')
    else:
        status_parts.append('\033[31mNOT connected\033[0m')
    if info.get('dispatched'):
        status_parts.append('dispatched')
    else:
        err = info.get('dispatch_error', 'unknown')
        status_parts.append(f'\033[31mdispatch FAILED: {err}\033[0m')
    if info.get('moved'):
        status_parts.append('\033[32mMOVED\033[0m')
    else:
        status_parts.append('\033[33mno movement detected\033[0m')
    start = info.get('start_pos', {})
    end = info.get('end_pos', {})
    sx = start.get('x', '?')
    sy = start.get('y', '?')
    ex = end.get('x', '?')
    ey = end.get('y', '?')
    print(f'  {fid:10s}  {\" → \".join(status_parts)}')
    print(f'             start=({sx}, {sy})  end=({ex}, {ey})')
print()
verdict = r.get('verdict', '?')
hint = r.get('hint')
if 'PASS' in verdict:
    print(f'  \033[32m✓ {verdict}\033[0m')
elif 'PARTIAL' in verdict:
    print(f'  \033[33m⚠ {verdict}\033[0m')
else:
    print(f'  \033[31m✗ {verdict}\033[0m')
if hint:
    print(f'  Hint: {hint}')
" 2>/dev/null || echo "$RESULT"

echo ""
echo -e "${cyan}═══════════════════════════════════════════════════${nc}"
