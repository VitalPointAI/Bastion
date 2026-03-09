#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Pre-computed AI Agent Analysis Outputs
# ==============================================================================
# Seeds polished AI agent analysis products into the staff_products table so
# they appear in the UI without requiring live LLM calls during the demo.
#
# Agent outputs span 4 roles:
#   - Strategic Fusion Agent (2 outputs) — cross-document synthesis
#   - Adversary Modeling Agent (3 outputs) — PRC capability/intent/COA analysis
#   - Escalation Modeling Agent (2 outputs) — escalation ladder and cascades
#   - Assumption Audit Agent (2 outputs) — JPP assumption validation
#
# All IDs use DEMO-AGENT-OUTPUT-* prefix for cleanup safety.
# Uses INSERT ON CONFLICT for idempotent re-runs.
#
# Usage: source scripts/seed-agents.sh
#   (designed to be sourced by seed-demo.sh)
#
# Requires: PostgreSQL container (bastion-postgres) running
# Depends on: PS_THEATER, PS_CJTF, DEMO-SCENARIO-pacific-strategy env vars
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding AI Agent Analysis Outputs ==="
echo ""

# ── Validate prerequisites ───────────────────────────────────────────────────

if [ -z "$PS_THEATER" ]; then
  log_warn "PS_THEATER not set. Using default DEMO-PS-indopacom-theater"
  PS_THEATER="DEMO-PS-indopacom-theater"
fi

if [ -z "$PS_CJTF" ]; then
  log_warn "PS_CJTF not set. Using default DEMO-PS-cjtf-westpac"
  PS_CJTF="DEMO-PS-cjtf-westpac"
fi

SCENARIO_ID="${SCENARIO_ID:-DEMO-SCENARIO-pacific-strategy}"

# ── Ensure staff_products table exists ──────────────────────────────────────
# Backend creates this on first request, but we may seed before backend starts.

psql_exec "
CREATE TABLE IF NOT EXISTS staff_products (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  role_key TEXT NOT NULL,
  product_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  structured JSONB DEFAULT '{}',
  content TEXT DEFAULT '',
  agent_team_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,
  published_by TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_products_scenario_role
  ON staff_products(scenario_id, role_key);
" > /dev/null

# ── Mapping: agent role → staff role key + product type ──────────────────────
# Agent outputs are stored as staff products with the appropriate role mapping

declare -A ROLE_MAP
ROLE_MAP["strategic-fusion"]="j2"
ROLE_MAP["adversary-modeling"]="j2"
ROLE_MAP["escalation-modeling"]="j5_plans"
ROLE_MAP["assumption-auditing"]="j5_plans"

declare -A PRODUCT_TYPE_MAP
PRODUCT_TYPE_MAP["strategic-fusion"]="ai_strategic_fusion"
PRODUCT_TYPE_MAP["adversary-modeling"]="ai_adversary_model"
PRODUCT_TYPE_MAP["escalation-modeling"]="ai_escalation_model"
PRODUCT_TYPE_MAP["assumption-auditing"]="ai_assumption_audit"

# ── Seed agent outputs from fixture files ───────────────────────────────────

seed_agent_outputs() {
  local fixture_file="$1"
  local agent_type="$2"
  local count=0

  local role_key="${ROLE_MAP[$agent_type]}"
  local product_type="${PRODUCT_TYPE_MAP[$agent_type]}"

  log_info "Seeding ${agent_type} outputs from $(basename "${fixture_file}")..."

  parse_json_array "${fixture_file}" | while IFS= read -r output; do
    local out_id out_title out_content out_status out_metadata out_agent_role out_problem_set_id
    out_id=$(echo "$output" | json_field "id")
    out_title=$(echo "$output" | json_field "title")
    out_content=$(echo "$output" | python3 -c "import sys,json; print(json.load(sys.stdin).get('content',''))")
    out_status=$(echo "$output" | json_field "status")
    out_agent_role=$(echo "$output" | json_field "agentRole")
    out_problem_set_id=$(echo "$output" | json_field "problemSetId")
    out_metadata=$(echo "$output" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('metadata',{})))")

    # Escape single quotes for SQL
    out_title_esc="${out_title//\'/\'\'}"
    out_content_esc="${out_content//\'/\'\'}"
    out_metadata_esc="${out_metadata//\'/\'\'}"

    # Map agent status to staff product status
    local sp_status="draft"
    if [ "$out_status" = "complete" ]; then
      sp_status="published"
    fi

    psql_exec "
    INSERT INTO staff_products (
      id, scenario_id, role_key, product_type, title, status,
      structured, content, agent_team_id, version,
      published_at, published_by, created_by, created_at, updated_at
    ) VALUES (
      '${out_id}', '${SCENARIO_ID}', '${role_key}', '${product_type}',
      '${out_title_esc}', '${sp_status}',
      '${out_metadata_esc}'::jsonb, '${out_content_esc}',
      '${out_agent_role}', 1,
      $([ "$sp_status" = "published" ] && echo "NOW()" || echo "NULL"),
      $([ "$sp_status" = "published" ] && echo "'ai-agent-${out_agent_role}'" || echo "NULL"),
      'ai-agent-${out_agent_role}', NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      status = EXCLUDED.status,
      structured = EXCLUDED.structured,
      content = EXCLUDED.content,
      agent_team_id = EXCLUDED.agent_team_id,
      published_at = EXCLUDED.published_at,
      published_by = EXCLUDED.published_by,
      updated_at = NOW();
    " > /dev/null

    log_verbose "  Upserted: ${out_id} (${out_title})"
    count=$((count + 1))
  done
}

# ── Seed all agent output types ─────────────────────────────────────────────

seed_agent_outputs "${DATA_DIR}/agents/strategic-fusion-outputs.json" "strategic-fusion"
seed_agent_outputs "${DATA_DIR}/agents/adversary-modeling-outputs.json" "adversary-modeling"
seed_agent_outputs "${DATA_DIR}/agents/escalation-modeling-outputs.json" "escalation-modeling"
seed_agent_outputs "${DATA_DIR}/agents/assumption-audit-outputs.json" "assumption-auditing"

# ── Count results ────────────────────────────────────────────────────────────

TOTAL_OUTPUTS=$(psql_exec "SELECT count(*) FROM staff_products WHERE id LIKE 'DEMO-AGENT-OUTPUT-%'")
FUSION_COUNT=$(psql_exec "SELECT count(*) FROM staff_products WHERE id LIKE 'DEMO-AGENT-OUTPUT-strategic-fusion%'")
ADVERSARY_COUNT=$(psql_exec "SELECT count(*) FROM staff_products WHERE id LIKE 'DEMO-AGENT-OUTPUT-adversary-model%'")
ESCALATION_COUNT=$(psql_exec "SELECT count(*) FROM staff_products WHERE id LIKE 'DEMO-AGENT-OUTPUT-escalation-model%'")
ASSUMPTION_COUNT=$(psql_exec "SELECT count(*) FROM staff_products WHERE id LIKE 'DEMO-AGENT-OUTPUT-assumption-audit%'")

log_success "Agent outputs: ${TOTAL_OUTPUTS} total"

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "  -- AI Agent Output Summary --"
echo "  Scenario: ${SCENARIO_ID}"
echo "  Total Outputs: ${TOTAL_OUTPUTS}"
echo ""
echo "  By Agent Role:"
echo "    Strategic Fusion:    ${FUSION_COUNT} outputs"
echo "    Adversary Modeling:  ${ADVERSARY_COUNT} outputs"
echo "    Escalation Modeling: ${ESCALATION_COUNT} outputs"
echo "    Assumption Audit:    ${ASSUMPTION_COUNT} outputs"
echo ""

record_count "AI Agent Outputs" "${TOTAL_OUTPUTS}"
record_count "  Strategic Fusion" "${FUSION_COUNT}"
record_count "  Adversary Modeling" "${ADVERSARY_COUNT}"
record_count "  Escalation Modeling" "${ESCALATION_COUNT}"
record_count "  Assumption Audit" "${ASSUMPTION_COUNT}"
