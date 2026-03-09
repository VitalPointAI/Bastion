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

# ── Health checks ─────────────────────────────────────────────────────────────

check_postgres || { log_error "PostgreSQL required. Aborting."; exit 1; }

# Neo4j is optional for Level 1 (psql-only), but warn if missing
check_neo4j || log_warn "Neo4j not available — graph seeding will be skipped"

# Backend API is optional for psql-based seeding
check_backend || log_warn "Backend API not available — using direct database access"

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

if should_run "problem-sets"; then
  source "${SCRIPT_DIR}/seed-problem-sets.sh"
else
  log_info "Skipping problem-sets (--only=${ONLY})"
fi

if should_run "command-units"; then
  source "${SCRIPT_DIR}/seed-command-units.sh"
else
  log_info "Skipping command-units (--only=${ONLY})"
fi

# ── Level 2: Data Layer (graph, OSINT, documents) ────────────────────────────
echo ""
echo "── Level 2: Data Layer ──"

if should_run "graph"; then
  if [ -f "${SCRIPT_DIR}/seed-graph.sh" ]; then
    source "${SCRIPT_DIR}/seed-graph.sh"
  else
    log_info "Skipping graph — not yet implemented"
  fi
else
  log_info "Skipping graph (--only=${ONLY})"
fi

if should_run "osint"; then
  if [ -f "${SCRIPT_DIR}/seed-osint.sh" ]; then
    source "${SCRIPT_DIR}/seed-osint.sh"
  else
    log_info "Skipping osint — not yet implemented"
  fi
else
  log_info "Skipping osint (--only=${ONLY})"
fi

if should_run "documents"; then
  if [ -f "${SCRIPT_DIR}/seed-documents.sh" ]; then
    source "${SCRIPT_DIR}/seed-documents.sh"
  else
    log_info "Skipping documents — not yet implemented"
  fi
else
  log_info "Skipping documents (--only=${ONLY})"
fi

# ── Level 3: Workflows (design, JPP, agents, governance, assessment) ─────────
echo ""
echo "── Level 3: Workflows ──"

if should_run "design"; then
  if [ -f "${SCRIPT_DIR}/seed-design.sh" ]; then
    source "${SCRIPT_DIR}/seed-design.sh"
  else
    log_info "Skipping design — not yet implemented"
  fi
else
  log_info "Skipping design (--only=${ONLY})"
fi

if should_run "jpp"; then
  if [ -f "${SCRIPT_DIR}/seed-jpp.sh" ]; then
    source "${SCRIPT_DIR}/seed-jpp.sh"
  else
    log_info "Skipping jpp — not yet implemented"
  fi
else
  log_info "Skipping jpp (--only=${ONLY})"
fi

if should_run "agents"; then
  if [ -f "${SCRIPT_DIR}/seed-agents.sh" ]; then
    source "${SCRIPT_DIR}/seed-agents.sh"
  else
    log_info "Skipping agents — not yet implemented"
  fi
else
  log_info "Skipping agents (--only=${ONLY})"
fi

if should_run "governance"; then
  if [ -f "${SCRIPT_DIR}/seed-governance.sh" ]; then
    source "${SCRIPT_DIR}/seed-governance.sh"
  else
    log_info "Skipping governance — not yet implemented"
  fi
else
  log_info "Skipping governance (--only=${ONLY})"
fi

if should_run "assessment"; then
  if [ -f "${SCRIPT_DIR}/seed-assessment.sh" ]; then
    source "${SCRIPT_DIR}/seed-assessment.sh"
  else
    log_info "Skipping assessment — not yet implemented"
  fi
else
  log_info "Skipping assessment (--only=${ONLY})"
fi

# ── Level 4: Cross-cutting (inheritance) ─────────────────────────────────────
echo ""
echo "── Level 4: Cross-cutting ──"

if should_run "inheritance"; then
  if [ -f "${SCRIPT_DIR}/seed-inheritance.sh" ]; then
    source "${SCRIPT_DIR}/seed-inheritance.sh"
  else
    log_info "Skipping inheritance — not yet implemented"
  fi
else
  log_info "Skipping inheritance (--only=${ONLY})"
fi

# ── Final Summary ─────────────────────────────────────────────────────────────

END_EPOCH=$(date +%s)
ELAPSED=$((END_EPOCH - START_EPOCH))

echo ""
echo "=============================================="
echo "  BASTION Demo Seed Complete"
echo "=============================================="

print_summary

echo "  Elapsed: ${ELAPSED}s"
echo ""
