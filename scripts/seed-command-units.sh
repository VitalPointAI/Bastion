#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Command Units
# ==============================================================================
# Creates military units with real designations and MIL-STD-2525D SIDC codes.
# Units are associated with problem sets and arranged in a command hierarchy.
#
# Uses direct PostgreSQL INSERT since the units API requires a mission_id FK
# referencing the missions table, and we seed problem sets (not missions) as
# the top-level organizational structure.
#
# All IDs use deterministic DEMO-UNIT- prefix for easy cleanup.
#
# Usage: source scripts/seed-command-units.sh
#   (designed to be sourced by seed-demo.sh after seed-problem-sets.sh)
#
# Requires: PS_* env vars from seed-problem-sets.sh, PostgreSQL running
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding Command Units ==="
echo ""

# ── Verify problem set env vars exist ─────────────────────────────────────────
if [ -z "$PS_THEATER" ]; then
  log_error "PS_THEATER not set. Run seed-problem-sets.sh first."
  return 1 2>/dev/null || exit 1
fi

# ── Ensure units table exists (without FK to missions) ────────────────────────
# We create a separate demo_units table that doesn't require the missions FK,
# or we create units in the existing table by also inserting a demo mission.
# Strategy: Create a demo exercise_scenario first, then use its ID as mission_id.

# Ensure exercise_scenarios table exists
psql_exec "
CREATE TABLE IF NOT EXISTS exercise_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  designation TEXT,
  exercise_phases TEXT[] DEFAULT '{}',
  current_phase_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  enabled_roles TEXT[] DEFAULT '{}',
  role_assignments JSONB DEFAULT '{}',
  problem_set_id TEXT REFERENCES problem_sets(id),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
" > /dev/null 2>&1

# Ensure units table exists
psql_exec "
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES exercise_scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sidc TEXT NOT NULL,
  parent_did TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_unit_mission ON units(mission_id);
CREATE INDEX IF NOT EXISTS idx_unit_parent_did ON units(parent_did);
" > /dev/null 2>&1

# Create a demo exercise scenario to serve as the mission_id for units
psql_exec "
INSERT INTO exercise_scenarios (id, name, designation, status, problem_set_id, created_by)
VALUES (
  'DEMO-SCENARIO-pacific-strategy',
  'Pacific Strategy AY26',
  'friendly',
  'active',
  '${PS_THEATER}',
  '${DID}'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();
" > /dev/null

DEMO_MISSION_ID="DEMO-SCENARIO-pacific-strategy"

log_info "Created demo exercise scenario: ${DEMO_MISSION_ID}"

# ── Insert units from fixtures ────────────────────────────────────────────────

FIXTURE_FILE="${DATA_DIR}/command/units.json"
UNIT_COUNT=0

log_info "Loading units from units.json..."

parse_json_array "${FIXTURE_FILE}" | while IFS= read -r obj; do
  local u_id u_name u_sidc u_parent u_lat u_lng u_notes
  u_id=$(echo "$obj" | json_field "id")
  u_name=$(echo "$obj" | json_field "name")
  u_sidc=$(echo "$obj" | json_field "sidc")
  u_parent=$(echo "$obj" | json_field "parent_unit_id")
  u_lat=$(echo "$obj" | python3 -c "import sys,json; d=json.load(sys.stdin); loc=d.get('location',{}); print(loc.get('lat','') if loc else '')" 2>/dev/null)
  u_lng=$(echo "$obj" | python3 -c "import sys,json; d=json.load(sys.stdin); loc=d.get('location',{}); print(loc.get('lng','') if loc else '')" 2>/dev/null)

  # Escape single quotes
  u_name="${u_name//\'/\'\'}"

  # Handle null parent
  local parent_clause
  if [ -z "$u_parent" ] || [ "$u_parent" = "None" ] || [ "$u_parent" = "null" ]; then
    parent_clause="NULL"
  else
    parent_clause="'${u_parent}'"
  fi

  # Handle null coordinates
  local lat_clause lng_clause
  if [ -z "$u_lat" ] || [ "$u_lat" = "None" ]; then
    lat_clause="NULL"
    lng_clause="NULL"
  else
    lat_clause="${u_lat}"
    lng_clause="${u_lng}"
  fi

  psql_exec "
    INSERT INTO units (id, mission_id, name, sidc, parent_did, location_lat, location_lng, created_at)
    VALUES (
      '${u_id}', '${DEMO_MISSION_ID}', '${u_name}', '${u_sidc}',
      ${parent_clause}, ${lat_clause}, ${lng_clause}, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      sidc = EXCLUDED.sidc,
      parent_did = EXCLUDED.parent_did,
      location_lat = EXCLUDED.location_lat,
      location_lng = EXCLUDED.location_lng;
  " > /dev/null

  log_verbose "  Upserted unit: ${u_id} (${u_name})"
done

# ── Summary ───────────────────────────────────────────────────────────────────

TOTAL_UNITS=$(psql_exec "SELECT count(*) FROM units WHERE id LIKE 'DEMO-UNIT-%'")

echo ""
echo "  ── Command Units ──"
echo "  Total: ${TOTAL_UNITS} units created"
echo "  Mission: ${DEMO_MISSION_ID}"
echo ""

# Export mission ID for downstream scripts
export DEMO_MISSION_ID

record_count "Command Units" "${TOTAL_UNITS}"
