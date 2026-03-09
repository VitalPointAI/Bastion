#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Problem Set Hierarchy
# ==============================================================================
# Creates a 3-level problem set hierarchy for the Pacific Strategy AY26 demo:
#   Strategic:   INDOPACOM Theater Campaign
#   Operational: CJTF-WestPac, 7th Fleet, 5th Air Force
#   Tactical:    Strike Alpha, Logistics Bravo, 3rd MEF ARG, CAP Delta, ISR Echo
#
# Also creates operational-mode duplicates (theater + 1 component) to demo
# the Phase 22 training/operational mode transition.
#
# All IDs are deterministic with DEMO-PS- prefix for easy cleanup.
# Uses INSERT ... ON CONFLICT for idempotent re-runs.
#
# Usage: source scripts/seed-problem-sets.sh
#   (designed to be sourced by seed-demo.sh so PS_* env vars propagate)
#
# Requires: PostgreSQL container (bastion-postgres) running
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding Problem Set Hierarchy ==="
echo ""

# ── Ensure problem_sets table exists ──────────────────────────────────────────
# The backend creates this on first request, but we may be seeding before
# the backend has started. Create table if not exists.
psql_exec "
CREATE TABLE IF NOT EXISTS problem_sets (
  id TEXT PRIMARY KEY,
  dao_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  echelon TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  parent_problem_set_id TEXT REFERENCES problem_sets(id),
  invite_mode TEXT NOT NULL DEFAULT 'gated',
  discoverability TEXT NOT NULL DEFAULT 'private',
  problem_statement TEXT,
  mode TEXT NOT NULL DEFAULT 'operational',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_problem_set_parent ON problem_sets(parent_problem_set_id);
CREATE INDEX IF NOT EXISTS idx_problem_set_classification ON problem_sets(classification);
CREATE INDEX IF NOT EXISTS idx_problem_set_echelon ON problem_sets(echelon);
CREATE INDEX IF NOT EXISTS idx_problem_set_mode ON problem_sets(mode);
" > /dev/null

# ── Upsert function ──────────────────────────────────────────────────────────
# Reads a JSON fixture file and upserts each problem set into PostgreSQL.
# Uses INSERT ... ON CONFLICT (id) DO UPDATE for idempotency.
upsert_problem_sets() {
  local fixture_file="$1"
  local level_name="$2"
  local count=0

  log_info "Loading ${level_name} from $(basename "${fixture_file}")..."

  parse_json_array "${fixture_file}" | while IFS= read -r obj; do
    local ps_id ps_dao_id ps_name ps_desc ps_echelon ps_class ps_mode ps_parent ps_invite ps_disc ps_problem ps_created_by
    ps_id=$(echo "$obj" | json_field "id")
    ps_dao_id=$(echo "$obj" | json_field "dao_id")
    ps_name=$(echo "$obj" | json_field "name")
    ps_desc=$(echo "$obj" | json_field "description")
    ps_echelon=$(echo "$obj" | json_field "echelon")
    ps_class=$(echo "$obj" | json_field "classification")
    ps_mode=$(echo "$obj" | json_field "mode")
    ps_parent=$(echo "$obj" | json_field "parent_problem_set_id")
    ps_invite=$(echo "$obj" | json_field "invite_mode")
    ps_disc=$(echo "$obj" | json_field "discoverability")
    ps_problem=$(echo "$obj" | json_field "problem_statement")
    ps_created_by=$(echo "$obj" | json_field "created_by")

    # Handle null parent
    local parent_clause
    if [ -z "$ps_parent" ] || [ "$ps_parent" = "None" ] || [ "$ps_parent" = "null" ]; then
      parent_clause="NULL"
    else
      parent_clause="'${ps_parent}'"
    fi

    # Escape single quotes in text fields
    ps_name="${ps_name//\'/\'\'}"
    ps_desc="${ps_desc//\'/\'\'}"
    ps_problem="${ps_problem//\'/\'\'}"

    psql_exec "
      INSERT INTO problem_sets (
        id, dao_id, name, description, echelon, classification,
        parent_problem_set_id, invite_mode, discoverability,
        problem_statement, mode, created_by, created_at, updated_at
      ) VALUES (
        '${ps_id}', '${ps_dao_id}', '${ps_name}', '${ps_desc}',
        '${ps_echelon}', '${ps_class}', ${parent_clause},
        '${ps_invite}', '${ps_disc}', '${ps_problem}',
        '${ps_mode}', '${ps_created_by}', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        echelon = EXCLUDED.echelon,
        classification = EXCLUDED.classification,
        parent_problem_set_id = EXCLUDED.parent_problem_set_id,
        mode = EXCLUDED.mode,
        problem_statement = EXCLUDED.problem_statement,
        updated_at = NOW();
    " > /dev/null

    log_verbose "  Upserted: ${ps_id} (${ps_name})"
    count=$((count + 1))
  done

  # Count actual rows for this level
  local actual_count
  actual_count=$(echo "$level_name" | grep -iq "theater" && \
    psql_exec "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND echelon = 'strategic'" || \
    echo "$level_name" | grep -iq "component" && \
    psql_exec "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND echelon = 'operational'" || \
    psql_exec "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND echelon = 'tactical'")

  log_success "${level_name}: ${actual_count} problem sets upserted"
}

# ── Execute in dependency order ───────────────────────────────────────────────
# Theater first (no parent references), then component (refs theater), then tactical (refs component)

upsert_problem_sets "${DATA_DIR}/problem-sets/theater-campaign.json" "Theater (Strategic)"
upsert_problem_sets "${DATA_DIR}/problem-sets/component-plans.json" "Component (Operational)"
upsert_problem_sets "${DATA_DIR}/problem-sets/tactical-missions.json" "Tactical Missions"

# ── Export PS IDs for downstream scripts ──────────────────────────────────────
# These env vars are used by seed-command-units.sh, seed-graph.sh, etc.

export PS_THEATER="DEMO-PS-indopacom-theater"
export PS_THEATER_OPS="DEMO-PS-indopacom-theater-ops"
export PS_CJTF="DEMO-PS-cjtf-westpac"
export PS_CJTF_OPS="DEMO-PS-cjtf-westpac-ops"
export PS_7FLEET="DEMO-PS-7fleet"
export PS_5AF="DEMO-PS-5af"
export PS_STRIKE_ALPHA="DEMO-PS-strike-alpha"
export PS_LOGISTICS_BRAVO="DEMO-PS-logistics-bravo"
export PS_3MEF_ARG="DEMO-PS-3mef-arg"
export PS_CAP_DELTA="DEMO-PS-cap-delta"
export PS_ISR_ECHO="DEMO-PS-isr-echo"

# ── Print hierarchy summary ──────────────────────────────────────────────────

TOTAL=$(psql_exec "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-PS-%'")
TRAINING=$(psql_exec "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND mode = 'training'")
OPS=$(psql_exec "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND mode = 'operational'")

echo ""
echo "  ── Problem Set Hierarchy ──"
echo "  Total: ${TOTAL} problem sets (${TRAINING} training, ${OPS} operational)"
echo ""
echo "  TRAINING MODE:"
echo "    Strategic:   ${PS_THEATER}"
echo "    Operational: ${PS_CJTF}, ${PS_7FLEET}, ${PS_5AF}"
echo "    Tactical:    ${PS_STRIKE_ALPHA}, ${PS_LOGISTICS_BRAVO}, ${PS_3MEF_ARG},"
echo "                 ${PS_CAP_DELTA}, ${PS_ISR_ECHO}"
echo ""
echo "  OPERATIONAL MODE:"
echo "    Strategic:   ${PS_THEATER_OPS}"
echo "    Operational: ${PS_CJTF_OPS}"
echo ""

record_count "Problem Sets" "${TOTAL}"
