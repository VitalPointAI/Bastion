#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — DAO Governance Decision Gates
# ==============================================================================
# Creates decision gates across Plan/Direct/Design/Assess/Understand tabs with
# commander approvals, voting records, and blockchain audit trail metadata.
#
# Demonstrates BASTION's key differentiator: blockchain-verified decision
# authority with transparent, immutable audit trails for military governance.
#
# Gates span multiple problem sets and tabs:
#   Plan:       Mission Analysis, COA Selection, OPORD Release (pending)
#   Direct:     FRAGO Release, Fire Authority Delegation
#   Design:     Theater Design, Component Design approvals
#   Assess:     AAR Publication, Readiness Certification (pending)
#   Understand: IPB Assessment Validation
#
# Uses direct psql INSERT for reliability (no backend auth required).
# All IDs use DEMO-GATE-* prefix for deterministic cleanup.
#
# Usage: source scripts/seed-governance.sh
#   (designed to be sourced by seed-demo.sh so env vars propagate)
#
# Requires: PostgreSQL container (bastion-postgres) running
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding DAO Governance Decision Gates ==="
echo ""

# ── Default PS IDs if not set by orchestrator ─────────────────────────────────

PS_THEATER="${PS_THEATER:-DEMO-PS-indopacom-theater}"
PS_CJTF="${PS_CJTF:-DEMO-PS-cjtf-westpac}"
PS_STRIKE_ALPHA="${PS_STRIKE_ALPHA:-DEMO-PS-strike-alpha}"

GATE_FIXTURE="${DATA_DIR}/governance/decision-gates.json"

if [ ! -f "$GATE_FIXTURE" ]; then
  log_error "Decision gates fixture not found at ${GATE_FIXTURE}"
  exit 1
fi

# ── Ensure decision_gates table exists ────────────────────────────────────────

psql_exec "
CREATE TABLE IF NOT EXISTS decision_gates (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  gate_type TEXT NOT NULL,
  tab TEXT NOT NULL,
  target_item_id TEXT NOT NULL,
  target_item_type TEXT NOT NULL,
  target_item_title TEXT NOT NULL DEFAULT '',
  enforcement TEXT NOT NULL DEFAULT 'hard_block',
  status TEXT NOT NULL DEFAULT 'pending',
  proposal_id TEXT,
  deadline_at TIMESTAMPTZ,
  timeout_behavior TEXT NOT NULL DEFAULT 'auto_escalate',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decision_context JSONB NOT NULL DEFAULT '{}',
  mode TEXT NOT NULL DEFAULT 'operational',
  training_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set
  ON decision_gates (problem_set_id);
CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set_tab
  ON decision_gates (problem_set_id, tab);
CREATE INDEX IF NOT EXISTS idx_decision_gates_problem_set_status
  ON decision_gates (problem_set_id, status);
" > /dev/null

# ── Upsert gates from fixture ────────────────────────────────────────────────

GATE_COUNT=0
APPROVED_COUNT=0
PENDING_COUNT=0

# Track per-tab counts
PLAN_COUNT=0
DIRECT_COUNT=0
DESIGN_COUNT=0
ASSESS_COUNT=0
UNDERSTAND_COUNT=0

parse_json_array "${GATE_FIXTURE}" | while IFS= read -r obj; do
  g_id=$(echo "$obj" | json_field "id")
  g_ps_id=$(echo "$obj" | json_field "problem_set_id")
  g_gate_type=$(echo "$obj" | json_field "gate_type")
  g_tab=$(echo "$obj" | json_field "tab")
  g_target_id=$(echo "$obj" | json_field "target_item_id")
  g_target_type=$(echo "$obj" | json_field "target_item_type")
  g_target_title=$(echo "$obj" | json_field "target_item_title")
  g_enforcement=$(echo "$obj" | json_field "enforcement")
  g_status=$(echo "$obj" | json_field "status")
  g_timeout=$(echo "$obj" | json_field "timeout_behavior")
  g_mode=$(echo "$obj" | json_field "mode")
  g_submitted_by=$(echo "$obj" | json_field "submitted_by")
  g_decided_by=$(echo "$obj" | json_field "decided_by")

  # Extract decision_context as raw JSON
  g_context=$(echo "$obj" | python3 -c "import sys,json; obj=json.load(sys.stdin); print(json.dumps(obj.get('decision_context', {})))")

  # Escape single quotes in text fields
  g_target_title="${g_target_title//\'/\'\'}"
  g_context="${g_context//\'/\'\'}"

  # Handle null decided_by
  local decided_clause
  if [ -z "$g_decided_by" ] || [ "$g_decided_by" = "None" ] || [ "$g_decided_by" = "null" ]; then
    decided_clause="NULL"
    decided_at_clause="NULL"
  else
    decided_clause="'${g_decided_by}'"
    decided_at_clause="NOW()"
  fi

  # Handle null submitted_by
  local submitted_clause
  if [ -z "$g_submitted_by" ] || [ "$g_submitted_by" = "None" ] || [ "$g_submitted_by" = "null" ]; then
    submitted_clause="NULL"
    submitted_at_clause="NULL"
  else
    submitted_clause="'${g_submitted_by}'"
    submitted_at_clause="NOW()"
  fi

  psql_exec "
    INSERT INTO decision_gates (
      id, problem_set_id, gate_type, tab, target_item_id, target_item_type,
      target_item_title, enforcement, status, timeout_behavior, mode,
      submitted_by, submitted_at, decided_by, decided_at,
      decision_context, created_at, updated_at
    ) VALUES (
      '${g_id}', '${g_ps_id}', '${g_gate_type}', '${g_tab}',
      '${g_target_id}', '${g_target_type}', '${g_target_title}',
      '${g_enforcement}', '${g_status}', '${g_timeout}', '${g_mode}',
      ${submitted_clause}, ${submitted_at_clause},
      ${decided_clause}, ${decided_at_clause},
      '${g_context}'::jsonb, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      problem_set_id = EXCLUDED.problem_set_id,
      gate_type = EXCLUDED.gate_type,
      tab = EXCLUDED.tab,
      target_item_id = EXCLUDED.target_item_id,
      target_item_type = EXCLUDED.target_item_type,
      target_item_title = EXCLUDED.target_item_title,
      enforcement = EXCLUDED.enforcement,
      status = EXCLUDED.status,
      timeout_behavior = EXCLUDED.timeout_behavior,
      mode = EXCLUDED.mode,
      submitted_by = EXCLUDED.submitted_by,
      submitted_at = EXCLUDED.submitted_at,
      decided_by = EXCLUDED.decided_by,
      decided_at = EXCLUDED.decided_at,
      decision_context = EXCLUDED.decision_context,
      updated_at = NOW();
  " > /dev/null

  log_verbose "  Upserted gate: ${g_id} (${g_tab}/${g_status})"
done

# ── Verify and summarize ─────────────────────────────────────────────────────

TOTAL=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%'")
APPROVED=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%' AND status = 'approved'")
PENDING=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%' AND status = 'pending'")

# Per-tab breakdown
TAB_PLAN=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%' AND tab = 'plan'")
TAB_DIRECT=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%' AND tab = 'direct'")
TAB_DESIGN=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%' AND tab = 'design'")
TAB_ASSESS=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%' AND tab = 'assess'")
TAB_UNDERSTAND=$(psql_exec "SELECT count(*) FROM decision_gates WHERE id LIKE 'DEMO-GATE-%' AND tab = 'understand'")

echo ""
echo "  -- Decision Gates Summary --"
echo "  Total: ${TOTAL} gates (${APPROVED} approved, ${PENDING} pending)"
echo ""
echo "  By Tab:"
echo "    Plan:       ${TAB_PLAN} gates"
echo "    Direct:     ${TAB_DIRECT} gates"
echo "    Design:     ${TAB_DESIGN} gates"
echo "    Assess:     ${TAB_ASSESS} gates"
echo "    Understand: ${TAB_UNDERSTAND} gates"
echo ""
echo "  Blockchain audit trails demonstrate:"
echo "    - Immutable voting records with commander DIDs"
echo "    - Timestamped approval chains"
echo "    - ROE constraints and legal review provenance"
echo "    - Gate-blocked workflow enforcement"
echo ""

record_count "Decision Gates" "${TOTAL}"
