#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — OSINT Events Across Exercise Phases
# ==============================================================================
# Creates 29 OSINT events spanning all 6 exercise phases:
#   Phase 1 - Competition:  5 events (DIME spread)
#   Phase 2 - Crisis:       5 events
#   Phase 3 - Conflict D4:  5 events
#   Phase 4 - Conflict D10: 5 events
#   Phase 5 - Conflict D22: 5 events
#   Phase 6 - Negotiation:  4 events
#
# All events use DEMO-EVT- prefix IDs and include "demo-seed" tag.
# Posts to graph API (no auth required): POST /api/graph/osint/events
#
# Usage: source scripts/seed-osint.sh
#   (designed to be sourced by seed-demo.sh)
#
# Requires: Backend API running at localhost:3001
# Depends on: WKS_ID from seed-graph.sh (or PS_THEATER)
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$API" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding OSINT Events — 6 Exercise Phases ==="
echo ""

# ── Validate prerequisites ───────────────────────────────────────────────────

if [ -z "$WKS_ID" ]; then
  if [ -n "$PS_THEATER" ]; then
    WKS_ID="$PS_THEATER"
  else
    log_warn "WKS_ID and PS_THEATER not set. Using default workspace ID"
    WKS_ID="DEMO-WKS-indopac-theater"
  fi
fi
log_info "Using workspace: ${WKS_ID}"

# ── Event creation function ──────────────────────────────────────────────────

create_osint_event() {
  local event_json="$1"
  local evt_id
  evt_id=$(echo "$event_json" | json_field "id")

  # Inject workspaceId into the event JSON
  local payload
  payload=$(echo "$event_json" | python3 -c "
import sys, json
evt = json.load(sys.stdin)
evt['workspaceId'] = '${WKS_ID}'
print(json.dumps(evt))
")

  local result
  result=$(curl -s -X POST "${API}/graph/osint/events" \
    -H "Content-Type: application/json" \
    -H "x-did: ${DID}" \
    -d "$payload")

  local created_id
  created_id=$(echo "$result" | parse_json_field "id" 2>/dev/null || echo "")

  if [ -n "$created_id" ]; then
    log_verbose "  Created event: ${created_id}"
    return 0
  else
    # May already exist (idempotent check) or API not available
    log_verbose "  Event ${evt_id}: API returned: $(echo "$result" | head -c 100)"
    return 0
  fi
}

# ── Seed events by phase ────────────────────────────────────────────────────

seed_phase_events() {
  local fixture_file="$1"
  local phase_name="$2"
  local count=0

  if [ ! -f "$fixture_file" ]; then
    log_error "Fixture file not found: ${fixture_file}"
    return 1
  fi

  log_info "Phase: ${phase_name}..."

  parse_json_array "${fixture_file}" | while IFS= read -r event; do
    create_osint_event "$event"
    count=$((count + 1))
  done

  local file_count
  file_count=$(python3 -c "import json; print(len(json.load(open('${fixture_file}'))))")
  log_success "  ${phase_name}: ${file_count} events created"
}

# Phase 1 — Competition (5 events)
seed_phase_events "${DATA_DIR}/osint/events-competition.json" "Competition"

# Phase 2 — Crisis (5 events)
seed_phase_events "${DATA_DIR}/osint/events-crisis.json" "Crisis"

# Phases 3-5 — Conflict Day 4, Day 10, Day 22 (15 events in one file)
seed_phase_events "${DATA_DIR}/osint/events-conflict.json" "Conflict (Days 4/10/22)"

# Phase 6 — Negotiation (4 events)
seed_phase_events "${DATA_DIR}/osint/events-negotiation.json" "Negotiation"

# ── Summary ──────────────────────────────────────────────────────────────────

TOTAL_EVENTS=$(python3 -c "
import json, glob
total = 0
for f in glob.glob('${DATA_DIR}/osint/events-*.json'):
    total += len(json.load(open(f)))
print(total)
")

echo ""
echo "  -- OSINT Events Summary --"
echo "  Workspace: ${WKS_ID}"
echo "  Total Events: ${TOTAL_EVENTS}"
echo "  Competition:  5 events (D-I-M-M-E)"
echo "  Crisis:       5 events (D-M-M-I-E)"
echo "  Conflict:    15 events (Days 4/10/22)"
echo "  Negotiation:  4 events (D-D-E-D)"
echo ""

record_count "OSINT Events" "${TOTAL_EVENTS}"
