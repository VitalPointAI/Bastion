#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Operational Design Content
# ==============================================================================
# Populates the Design tab with JP 5-0 operational design methodology content
# for theater (INDOPACOM) and component (CJTF-WestPac) problem sets.
#
# Sections populated per problem set:
#   1. Problem Framing — problem statement, end state, assumptions, constraints
#   2. CoG Analysis — friendly/adversary centers of gravity with Strange's model
#   3. Lines of Effort — LOEs with decisive points and COG linkages
#   4. Operational Approach — phases, transitions, decision points, narrative
#
# API: PATCH /api/design/:problemSetId/:section
# Sections: problem-framing, cog-analysis, lines-of-effort, operational-approach
#
# Usage: source scripts/seed-design.sh
#   (designed to be sourced by seed-demo.sh so env vars propagate)
#
# Requires:
#   - Backend API running at localhost:3001
#   - PS_THEATER and PS_CJTF env vars (set by seed-problem-sets.sh)
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding Operational Design Content ==="
echo ""

# ── Validate prerequisites ───────────────────────────────────────────────────

# Default PS IDs if not set by orchestrator
PS_THEATER="${PS_THEATER:-DEMO-PS-indopacom-theater}"
PS_CJTF="${PS_CJTF:-DEMO-PS-cjtf-westpac}"

THEATER_FIXTURE="${DATA_DIR}/design/theater-design.json"
COMPONENT_FIXTURE="${DATA_DIR}/design/component-design.json"

if [ ! -f "$THEATER_FIXTURE" ]; then
  log_error "Theater design fixture not found at ${THEATER_FIXTURE}"
  exit 1
fi

if [ ! -f "$COMPONENT_FIXTURE" ]; then
  log_error "Component design fixture not found at ${COMPONENT_FIXTURE}"
  exit 1
fi

# We need the backend API for design PATCH calls
if ! check_backend; then
  log_error "Backend API required for design seeding. Start with: docker compose up -d backend"
  exit 1
fi

# ── Design section seeder function ───────────────────────────────────────────

# Seed a single design section for a problem set
# Usage: seed_design_section <problemSetId> <section> <fixtureFile> <jsonPath>
seed_design_section() {
  local PS_ID="$1"
  local SECTION="$2"
  local FIXTURE="$3"
  local JSON_PATH="$4"

  log_info "  PATCH ${PS_ID}/${SECTION}"

  # Extract the section data from the fixture JSON
  SECTION_DATA=$(python3 -c "
import json, sys
with open('${FIXTURE}') as f:
    data = json.load(f)
section = data.get('${JSON_PATH}')
if section is None:
    print('ERROR: section ${JSON_PATH} not found', file=sys.stderr)
    sys.exit(1)
print(json.dumps(section))
")

  if [ $? -ne 0 ] || [ -z "$SECTION_DATA" ]; then
    log_error "Failed to extract ${JSON_PATH} from ${FIXTURE}"
    return 1
  fi

  # PATCH the section via the design API
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    --max-time 30 \
    -X PATCH \
    -H "Content-Type: application/json" \
    -H "x-did: ${DID}" \
    -d "${SECTION_DATA}" \
    "${API}/design/${PS_ID}/${SECTION}" \
    2>/dev/null)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)

  if [ "$HTTP_CODE" = "200" ]; then
    log_success "  ${SECTION} updated successfully"
    return 0
  else
    BODY=$(echo "$RESPONSE" | sed '$d')
    log_error "  ${SECTION} failed (HTTP ${HTTP_CODE})"
    log_verbose "  Response: ${BODY}"
    return 1
  fi
}

# ── Seed all sections for a problem set ──────────────────────────────────────

seed_all_sections() {
  local PS_ID="$1"
  local FIXTURE="$2"
  local LABEL="$3"
  local SUCCESS=0
  local TOTAL=4

  echo ""
  log_info "Seeding design for ${LABEL} (${PS_ID})..."

  seed_design_section "$PS_ID" "problem-framing" "$FIXTURE" "problemFraming" && SUCCESS=$((SUCCESS + 1))
  seed_design_section "$PS_ID" "cog-analysis" "$FIXTURE" "cogAnalysis" && SUCCESS=$((SUCCESS + 1))
  seed_design_section "$PS_ID" "lines-of-effort" "$FIXTURE" "linesOfEffort" && SUCCESS=$((SUCCESS + 1))
  seed_design_section "$PS_ID" "operational-approach" "$FIXTURE" "operationalApproach" && SUCCESS=$((SUCCESS + 1))

  log_info "${LABEL}: ${SUCCESS}/${TOTAL} sections seeded"
  return $((TOTAL - SUCCESS))
}

# ── Execute seeding ──────────────────────────────────────────────────────────

TOTAL_SUCCESS=0
TOTAL_SECTIONS=8

# Theater level — INDOPACOM
seed_all_sections "$PS_THEATER" "$THEATER_FIXTURE" "INDOPACOM Theater"
TOTAL_SUCCESS=$((TOTAL_SUCCESS + 4 - $?))

# Component level — CJTF-WestPac
seed_all_sections "$PS_CJTF" "$COMPONENT_FIXTURE" "CJTF-WestPac Component"
TOTAL_SUCCESS=$((TOTAL_SUCCESS + 4 - $?))

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
record_count "Design sections populated" "${TOTAL_SUCCESS}/${TOTAL_SECTIONS}"

if [ "$TOTAL_SUCCESS" -eq "$TOTAL_SECTIONS" ]; then
  log_success "All design sections seeded successfully"
else
  log_warn "Some design sections failed: ${TOTAL_SUCCESS}/${TOTAL_SECTIONS}"
fi

echo ""
