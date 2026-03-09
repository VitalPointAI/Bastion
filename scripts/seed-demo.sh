#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Master Orchestrator
# ==============================================================================
# Seeds all demo data for the BASTION operational demonstration.
# Runs seed scripts in dependency order, sharing environment variables
# between levels via `source`.
#
# Usage:
#   bash scripts/seed-demo.sh              # Seed all data
#   bash scripts/seed-demo.sh --reset      # Clean first, then seed
#   bash scripts/seed-demo.sh --clean      # Clean only (remove all DEMO- data)
#   bash scripts/seed-demo.sh --verbose    # Show detailed output
#   bash scripts/seed-demo.sh --only=NAME  # Run only a specific seed script
#   bash scripts/seed-demo.sh --help       # Show usage
#
# Dependency order:
#   Level 1: problem-sets, command-units  (foundation — PS IDs needed by all)
#   Level 2: graph, osint, documents      (data layer — uses PS IDs)
#   Level 3: design, jpp, agents, governance, assessment  (workflows)
#   Level 4: inheritance                  (cross-PS links — needs everything)
#
# All seeded data uses DEMO- prefixed IDs for safe cleanup.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Parse flags ───────────────────────────────────────────────────────────────

DO_RESET=false
DO_CLEAN=false
VERBOSE=false
ONLY=""

for arg in "$@"; do
  case "$arg" in
    --reset)    DO_RESET=true ;;
    --clean)    DO_CLEAN=true ;;
    --verbose)  VERBOSE=true ;;
    --only=*)   ONLY="${arg#--only=}" ;;
    --help|-h)
      echo "BASTION Demo Seed — Master Orchestrator"
      echo ""
      echo "Usage: bash scripts/seed-demo.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --reset      Clean all demo data before seeding"
      echo "  --clean      Clean all demo data and exit (no seeding)"
      echo "  --verbose    Show detailed output for each operation"
      echo "  --only=NAME  Run only a specific seed script (e.g., --only=problem-sets)"
      echo "  --help       Show this help message"
      echo ""
      echo "Available seed scripts:"
      echo "  problem-sets     Level 1: Problem set hierarchy (3 echelons)"
      echo "  command-units    Level 1: Military units with SIDC codes"
      echo "  graph            Level 2: Strategic graph data (actors, relationships)"
      echo "  osint            Level 2: OSINT events and intelligence"
      echo "  documents        Level 2: Doctrinal documents"
      echo "  design           Level 3: Operational design sections"
      echo "  jpp              Level 3: Joint Planning Process steps"
      echo "  agents           Level 3: AI agent configurations"
      echo "  governance       Level 3: DAO governance and decision gates"
      echo "  assessment       Level 3: Assessment data"
      echo "  inheritance      Level 4: Cross-problem-set inheritance"
      echo ""
      echo "Dependency order: problem-sets -> command-units -> graph/osint/docs -> design/jpp/agents/governance/assessment -> inheritance"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --help for usage)"
      exit 1
      ;;
  esac
done

export VERBOSE

# ── Source helpers ────────────────────────────────────────────────────────────

source "${SCRIPT_DIR}/demo-data/_helpers.sh"

echo "=============================================="
echo "  BASTION Demo Data Seeder"
echo "=============================================="
echo ""

START_EPOCH=$(date +%s)

# ── Script timing tracker ────────────────────────────────────────────────────

SCRIPT_TIMINGS=()
SCRIPT_RESULTS=()
FAILED_SCRIPTS=()

run_seed_script() {
  local name="$1"
  local script_path="${SCRIPT_DIR}/seed-${name}.sh"

  if ! should_run "$name"; then
    log_info "Skipping ${name} (--only=${ONLY})"
    return 0
  fi

  if [ ! -f "$script_path" ]; then
    log_warn "Skipping ${name} — script not found: ${script_path}"
    return 0
  fi

  local t_start
  t_start=$(date +%s)

  log_info "Running seed-${name}.sh..."

  if source "$script_path"; then
    local t_end
    t_end=$(date +%s)
    local duration=$(( t_end - t_start ))
    SCRIPT_TIMINGS+=("${name}:${duration}s")
    SCRIPT_RESULTS+=("${name}:OK")
    log_success "seed-${name}.sh completed in ${duration}s"
  else
    local t_end
    t_end=$(date +%s)
    local duration=$(( t_end - t_start ))
    SCRIPT_TIMINGS+=("${name}:${duration}s")
    SCRIPT_RESULTS+=("${name}:FAILED")
    FAILED_SCRIPTS+=("$name")
    log_error "seed-${name}.sh FAILED after ${duration}s"
    return 1
  fi
}

# ── Health checks with retry ─────────────────────────────────────────────────

check_postgres || { log_error "PostgreSQL required. Aborting."; exit 1; }

# Neo4j is optional for Level 1 (psql-only), but warn if missing
check_neo4j || log_warn "Neo4j not available — graph seeding will be skipped"

# Backend API with retry logic (up to 30 seconds, 5-second intervals)
BACKEND_READY=false
for attempt in 1 2 3 4 5 6; do
  if check_backend; then
    BACKEND_READY=true
    break
  fi
  if [ "$attempt" -lt 6 ]; then
    log_info "Backend not ready, retrying in 5s (attempt ${attempt}/6)..."
    sleep 5
  fi
done
if [ "$BACKEND_READY" = "false" ]; then
  log_warn "Backend API not available after 30s — using direct database access"
fi

# ── Clean mode ────────────────────────────────────────────────────────────────

if [ "$DO_RESET" = "true" ] || [ "$DO_CLEAN" = "true" ]; then
  source "${SCRIPT_DIR}/seed-cleanup.sh"
  if [ "$DO_CLEAN" = "true" ]; then
    echo "Clean complete. Exiting."
    exit 0
  fi
fi

# ── Selective execution ──────────────────────────────────────────────────────

should_run() {
  local name="$1"
  if [ -n "$ONLY" ]; then
    [ "$ONLY" = "$name" ]
  else
    return 0
  fi
}

# ── Level 1: Foundation (problem sets + command units) ────────────────────────
echo ""
echo "── Level 1: Foundation ──"

run_seed_script "problem-sets" || { log_error "Foundation failed — cannot continue."; exit 1; }
run_seed_script "command-units" || { log_error "Foundation failed — cannot continue."; exit 1; }

# ── Level 2: Data Layer (graph, OSINT, documents) ────────────────────────────
echo ""
echo "── Level 2: Data Layer ──"

run_seed_script "graph" || true
run_seed_script "osint" || true
run_seed_script "documents" || true

# ── Level 3: Workflows (design, JPP, agents, governance, assessment) ─────────
echo ""
echo "── Level 3: Workflows ──"

run_seed_script "design" || true
run_seed_script "jpp" || true
run_seed_script "agents" || true
run_seed_script "governance" || true
run_seed_script "assessment" || true

# ── Level 4: Cross-cutting (inheritance) ─────────────────────────────────────
echo ""
echo "── Level 4: Cross-cutting ──"

run_seed_script "inheritance" || true

# ── Final Summary ─────────────────────────────────────────────────────────────

END_EPOCH=$(date +%s)
ELAPSED=$((END_EPOCH - START_EPOCH))

echo ""
echo "=============================================="
echo "  BASTION Demo Seed Complete"
echo "=============================================="
echo ""

# Per-script timing table
echo "  ── Script Execution Summary ──"
echo ""
printf "  %-20s %-10s %-8s\n" "Script" "Status" "Duration"
printf "  %-20s %-10s %-8s\n" "--------------------" "----------" "--------"
for i in "${!SCRIPT_TIMINGS[@]}"; do
  timing="${SCRIPT_TIMINGS[$i]}"
  result="${SCRIPT_RESULTS[$i]}"
  name="${timing%%:*}"
  duration="${timing#*:}"
  status="${result#*:}"
  printf "  %-20s %-10s %-8s\n" "$name" "$status" "$duration"
done
echo ""

# Data counts from seed scripts
print_summary

echo "  Total elapsed: ${ELAPSED}s"
echo ""

# Report failures
if [ ${#FAILED_SCRIPTS[@]} -gt 0 ]; then
  echo "  WARNING: ${#FAILED_SCRIPTS[@]} script(s) failed:"
  for script in "${FAILED_SCRIPTS[@]}"; do
    echo "    - seed-${script}.sh"
  done
  echo ""
  exit 1
fi
