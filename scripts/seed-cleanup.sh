#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Cleanup
# ==============================================================================
# Removes ALL demo-seeded data (DEMO- prefixed) from PostgreSQL and Neo4j.
# Never touches user-created data.
#
# Usage: bash scripts/seed-cleanup.sh
#   or:  source scripts/seed-cleanup.sh  (when called from seed-demo.sh)
#
# Requires: PostgreSQL (bastion-postgres) and Neo4j (bastion-neo4j) running
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Cleaning Up Demo Data ==="
echo ""

# ── Neo4j Cleanup ─────────────────────────────────────────────────────────────
log_info "Cleaning Neo4j nodes with DEMO- prefix..."

NEO4J_COUNT=$($CYPHER "MATCH (n) WHERE n.id STARTS WITH 'DEMO-' RETURN count(n) AS c;" 2>/dev/null | tail -1 | tr -d '[:space:]' || echo "0")

if [ "$NEO4J_COUNT" != "0" ] && [ -n "$NEO4J_COUNT" ]; then
  $CYPHER "MATCH (n) WHERE n.id STARTS WITH 'DEMO-' DETACH DELETE n;" > /dev/null 2>&1
  log_success "Neo4j: deleted ${NEO4J_COUNT} nodes with DEMO- prefix"
else
  log_info "Neo4j: no DEMO- nodes found"
fi

# ── PostgreSQL Cleanup ────────────────────────────────────────────────────────
# Delete in reverse dependency order to respect foreign key constraints.
# Child tables with ON DELETE CASCADE will auto-clean, but we also handle
# tables that may not have cascade.

log_info "Cleaning PostgreSQL tables..."

# Units (references missions which references exercise_scenarios)
UNITS_DEL=$(psql_exec "DELETE FROM units WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  units: ${UNITS_DEL} deleted"

# Command relationships
CMD_REL_DEL=$(psql_exec "DELETE FROM command_relationships WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  command_relationships: ${CMD_REL_DEL} deleted"

# Decision gates
GATES_DEL=$(psql_exec "DELETE FROM decision_gates WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  decision_gates: ${GATES_DEL} deleted"

# Exercise scenarios (missions)
SCENARIOS_DEL=$(psql_exec "DELETE FROM exercise_scenarios WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  exercise_scenarios: ${SCENARIOS_DEL} deleted"

# Operational design sections
DESIGN_DEL=$(psql_exec "DELETE FROM operational_design_sections WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  operational_design_sections: ${DESIGN_DEL} deleted"

# Documents
DOCS_DEL=$(psql_exec "DELETE FROM documents WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  documents: ${DOCS_DEL} deleted"

# JPP data
JPP_DEL=$(psql_exec "DELETE FROM jpp_steps WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  jpp_steps: ${JPP_DEL} deleted"

# Assessment data
ASSESS_DEL=$(psql_exec "DELETE FROM assessments WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  assessments: ${ASSESS_DEL} deleted"

# Inheritance: changelog
ICLOG_DEL=$(psql_exec "DELETE FROM inheritance_changelog WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  inheritance_changelog: ${ICLOG_DEL} deleted"

# Inheritance: override annotations
IANN_DEL=$(psql_exec "DELETE FROM inheritance_annotations WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  inheritance_annotations: ${IANN_DEL} deleted"

# Inheritance: mission status snapshots
MSTAT_DEL=$(psql_exec "DELETE FROM mission_status_snapshots WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  mission_status_snapshots: ${MSTAT_DEL} deleted"

# Inheritance: FRAGO drafts
FRAGO_DEL=$(psql_exec "DELETE FROM frago_drafts WHERE id LIKE 'DEMO-%' RETURNING id;" 2>/dev/null | wc -l || echo "0")
log_verbose "  frago_drafts: ${FRAGO_DEL} deleted"

# Problem sets (cascade handles members, activities, roles, compartments, etc.)
# Delete tactical first, then operational, then strategic (child before parent)
PS_TACTICAL_DEL=$(psql_exec "DELETE FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND echelon = 'tactical' RETURNING id;" 2>/dev/null | wc -l || echo "0")
PS_OPERATIONAL_DEL=$(psql_exec "DELETE FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND echelon = 'operational' RETURNING id;" 2>/dev/null | wc -l || echo "0")
PS_STRATEGIC_DEL=$(psql_exec "DELETE FROM problem_sets WHERE id LIKE 'DEMO-PS-%' AND echelon = 'strategic' RETURNING id;" 2>/dev/null | wc -l || echo "0")
PS_TOTAL_DEL=$((PS_TACTICAL_DEL + PS_OPERATIONAL_DEL + PS_STRATEGIC_DEL))

log_verbose "  problem_sets: ${PS_TOTAL_DEL} deleted (${PS_STRATEGIC_DEL} strategic, ${PS_OPERATIONAL_DEL} operational, ${PS_TACTICAL_DEL} tactical)"

# ── Summary ───────────────────────────────────────────────────────────────────

PG_TOTAL=$((UNITS_DEL + CMD_REL_DEL + GATES_DEL + SCENARIOS_DEL + DESIGN_DEL + DOCS_DEL + JPP_DEL + ASSESS_DEL + ICLOG_DEL + IANN_DEL + MSTAT_DEL + FRAGO_DEL + PS_TOTAL_DEL))

echo ""
echo "  ── Cleanup Summary ──"
echo "  Neo4j:      ${NEO4J_COUNT} nodes deleted"
echo "  PostgreSQL: ${PG_TOTAL} rows deleted"
echo "    - Problem sets:    ${PS_TOTAL_DEL}"
echo "    - Units:           ${UNITS_DEL}"
echo "    - Relationships:   ${CMD_REL_DEL}"
echo "    - Gates:           ${GATES_DEL}"
echo "    - Scenarios:       ${SCENARIOS_DEL}"
echo "    - Design:          ${DESIGN_DEL}"
echo "    - Documents:       ${DOCS_DEL}"
echo "    - JPP:             ${JPP_DEL}"
echo "    - Assessments:     ${ASSESS_DEL}"
echo "    - FRAGOs:          ${FRAGO_DEL}"
echo "    - Status Snapshots:${MSTAT_DEL}"
echo "    - Annotations:     ${IANN_DEL}"
echo "    - Changelog:       ${ICLOG_DEL}"
echo ""

record_count "Cleanup (Neo4j)" "${NEO4J_COUNT}"
record_count "Cleanup (PostgreSQL)" "${PG_TOTAL}"
