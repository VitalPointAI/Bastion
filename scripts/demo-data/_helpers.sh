#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Shared Helpers
# ==============================================================================
# Sourced by all seed scripts. Provides common variables, functions, and
# connectivity checks for PostgreSQL, Neo4j, and the backend API.
#
# Usage: source scripts/demo-data/_helpers.sh
# ==============================================================================

set -e

# ── Configuration ─────────────────────────────────────────────────────────────

API="http://localhost:3001/api"
DID="did:near:demo-seed.near"

# Docker container names (match docker-compose.yml)
POSTGRES_CONTAINER="bastion-postgres"
NEO4J_CONTAINER="bastion-neo4j"

# Database access commands
PSQL="docker exec ${POSTGRES_CONTAINER} psql -U bastion -d bastion -t -A"
CYPHER="docker exec ${NEO4J_CONTAINER} cypher-shell -u neo4j -p password"

# Script directory (for resolving fixture paths)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${SCRIPT_DIR}/demo-data"

# Verbosity (set by orchestrator)
VERBOSE="${VERBOSE:-false}"

# ── Logging ───────────────────────────────────────────────────────────────────

log_info() {
  echo "  [INFO] $*"
}

log_success() {
  echo "  [OK]   $*"
}

log_error() {
  echo "  [ERR]  $*" >&2
}

log_warn() {
  echo "  [WARN] $*"
}

log_verbose() {
  if [ "$VERBOSE" = "true" ]; then
    echo "  [DBG]  $*"
  fi
}

# ── JSON Parsing ──────────────────────────────────────────────────────────────

# Extract a field from JSON string
# Usage: echo '{"id":"abc"}' | parse_json_field "id"
parse_json_field() {
  local field="$1"
  python3 -c "import sys,json; print(json.load(sys.stdin)['${field}'])" 2>/dev/null
}

# Parse a JSON array file and iterate objects
# Usage: parse_json_array "file.json" | while read -r obj; do ... done
parse_json_array() {
  local file="$1"
  python3 -c "
import json, sys
with open('${file}') as f:
    for obj in json.load(f):
        print(json.dumps(obj))
"
}

# Extract a field from a single-line JSON object
# Usage: echo '{"id":"abc"}' | json_field "id"
json_field() {
  local field="$1"
  python3 -c "import sys,json; print(json.load(sys.stdin).get('${field}',''))"
}

# ── Connectivity Checks ──────────────────────────────────────────────────────

check_backend() {
  log_info "Checking backend API at ${API}..."
  if curl -s -o /dev/null -w "%{http_code}" "${API}/health" 2>/dev/null | grep -q "200"; then
    log_success "Backend API is responsive"
    return 0
  else
    log_warn "Backend API not responsive at ${API}/health (non-fatal for psql-based seeding)"
    return 1
  fi
}

check_postgres() {
  log_info "Checking PostgreSQL via ${POSTGRES_CONTAINER}..."
  if docker exec "${POSTGRES_CONTAINER}" pg_isready -U bastion -d bastion > /dev/null 2>&1; then
    log_success "PostgreSQL is responsive"
    return 0
  else
    log_error "PostgreSQL is not responsive. Is ${POSTGRES_CONTAINER} running?"
    log_error "Try: docker compose up -d postgres"
    return 1
  fi
}

check_neo4j() {
  log_info "Checking Neo4j via ${NEO4J_CONTAINER}..."
  if docker exec "${NEO4J_CONTAINER}" cypher-shell -u neo4j -p password "RETURN 1;" > /dev/null 2>&1; then
    log_success "Neo4j is responsive"
    return 0
  else
    log_error "Neo4j is not responsive. Is ${NEO4J_CONTAINER} running?"
    log_error "Try: docker compose up -d neo4j"
    return 1
  fi
}

# ── SQL Helpers ───────────────────────────────────────────────────────────────

# Execute a SQL statement and return the result
# Usage: psql_exec "SELECT count(*) FROM problem_sets WHERE id LIKE 'DEMO-%'"
psql_exec() {
  docker exec "${POSTGRES_CONTAINER}" psql -U bastion -d bastion -t -A -c "$1" 2>/dev/null
}

# Execute a SQL statement from stdin
psql_stdin() {
  docker exec -i "${POSTGRES_CONTAINER}" psql -U bastion -d bastion -t -A 2>/dev/null
}

# ── Counter / Summary ────────────────────────────────────────────────────────

SEED_COUNTS=()

record_count() {
  local label="$1"
  local count="$2"
  SEED_COUNTS+=("${label}: ${count}")
}

print_summary() {
  echo ""
  echo "  ── Seed Summary ──"
  for entry in "${SEED_COUNTS[@]}"; do
    echo "  ${entry}"
  done
  echo ""
}
