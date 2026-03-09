#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — JPP Instance & Step Products
# ==============================================================================
# Creates a JPP (Joint Planning Process) instance for the CJTF-WestPac
# operational problem set with 7 JP 5-0 steps and step products for steps 1-4.
#
# Steps 1-3 are complete, Step 4 is in_progress (COA Analysis/Wargaming),
# Steps 5-7 are pending — demonstrating a mid-planning walkthrough.
#
# All IDs use DEMO-JPP-* and DEMO-SP-* prefixes for cleanup safety.
# Uses INSERT ON CONFLICT for idempotent re-runs.
#
# Usage: source scripts/seed-jpp.sh
#   (designed to be sourced by seed-demo.sh so JPP_ID propagates)
#
# Requires: PostgreSQL container (bastion-postgres) running
# Depends on: PS_CJTF env var from seed-problem-sets.sh
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding JPP Instance & Step Products ==="
echo ""

# ── Validate prerequisites ───────────────────────────────────────────────────

if [ -z "$PS_CJTF" ]; then
  log_warn "PS_CJTF not set. Using default DEMO-PS-cjtf-westpac"
  PS_CJTF="DEMO-PS-cjtf-westpac"
fi

# ── Ensure JPP tables exist ──────────────────────────────────────────────────
# Backend creates these on first request, but we may seed before backend starts.

psql_exec "
CREATE TABLE IF NOT EXISTS jpp_instances (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  parent_jpp_id TEXT,
  echelon TEXT NOT NULL DEFAULT 'operational',
  current_step TEXT NOT NULL DEFAULT 'planning_initiation',
  step_statuses JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jpp_instances_problem_set ON jpp_instances(problem_set_id);

CREATE TABLE IF NOT EXISTS jpp_step_products (
  id TEXT PRIMARY KEY,
  jpp_instance_id TEXT NOT NULL,
  step TEXT NOT NULL,
  role_id TEXT,
  content JSONB DEFAULT '{}',
  ai_drafted_by TEXT,
  reviewed_by TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jpp_step_products_instance_step ON jpp_step_products(jpp_instance_id, step);
" > /dev/null

# ── Create JPP Instance ─────────────────────────────────────────────────────

log_info "Creating JPP instance for CJTF-WestPac..."

# Read instance fixture
INSTANCE_FILE="${DATA_DIR}/jpp/cjtf-jpp-instance.json"
JPP_ID=$(python3 -c "import json; print(json.load(open('${INSTANCE_FILE}'))['id'])")
JPP_PS_ID=$(python3 -c "import json; print(json.load(open('${INSTANCE_FILE}'))['problem_set_id'])")
JPP_ECHELON=$(python3 -c "import json; print(json.load(open('${INSTANCE_FILE}'))['echelon'])")
JPP_CURRENT_STEP=$(python3 -c "import json; print(json.load(open('${INSTANCE_FILE}'))['current_step'])")
JPP_STEP_STATUSES=$(python3 -c "import json; print(json.dumps(json.load(open('${INSTANCE_FILE}'))['step_statuses']))")
JPP_STATUS=$(python3 -c "import json; print(json.load(open('${INSTANCE_FILE}'))['status'])")
JPP_CREATED_BY=$(python3 -c "import json; print(json.load(open('${INSTANCE_FILE}'))['created_by'])")

psql_exec "
INSERT INTO jpp_instances (
  id, problem_set_id, parent_jpp_id, echelon, current_step,
  step_statuses, status, created_by, created_at, updated_at
) VALUES (
  '${JPP_ID}', '${JPP_PS_ID}', NULL, '${JPP_ECHELON}', '${JPP_CURRENT_STEP}',
  '${JPP_STEP_STATUSES}'::jsonb, '${JPP_STATUS}', '${JPP_CREATED_BY}', NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
  current_step = EXCLUDED.current_step,
  step_statuses = EXCLUDED.step_statuses,
  status = EXCLUDED.status,
  updated_at = NOW();
" > /dev/null

log_success "JPP Instance: ${JPP_ID} (${JPP_CURRENT_STEP})"
export JPP_ID

# ── Create Step Products ─────────────────────────────────────────────────────

log_info "Creating step products for steps 1-4..."

PRODUCT_COUNT=0
PRODUCT_FILE="${DATA_DIR}/jpp/jpp-step-products.json"

parse_json_array "${PRODUCT_FILE}" | while IFS= read -r product; do
  sp_id=$(echo "$product" | json_field "id")
  sp_step=$(echo "$product" | json_field "step")
  sp_role_id=$(echo "$product" | json_field "role_id")
  sp_status=$(echo "$product" | json_field "status")
  sp_ai_drafted_by=$(echo "$product" | json_field "ai_drafted_by")
  sp_reviewed_by=$(echo "$product" | json_field "reviewed_by")
  sp_content=$(echo "$product" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['content']))")

  # Escape single quotes in content JSON for SQL
  sp_content_esc="${sp_content//\'/\'\'}"

  # Handle null reviewed_by
  local reviewed_clause
  if [ -z "$sp_reviewed_by" ] || [ "$sp_reviewed_by" = "None" ] || [ "$sp_reviewed_by" = "null" ]; then
    reviewed_clause="NULL"
  else
    reviewed_clause="'${sp_reviewed_by}'"
  fi

  # Handle null ai_drafted_by
  local ai_clause
  if [ -z "$sp_ai_drafted_by" ] || [ "$sp_ai_drafted_by" = "None" ] || [ "$sp_ai_drafted_by" = "null" ]; then
    ai_clause="NULL"
  else
    ai_clause="'${sp_ai_drafted_by}'"
  fi

  psql_exec "
  INSERT INTO jpp_step_products (
    id, jpp_instance_id, step, role_id, content,
    ai_drafted_by, reviewed_by, status, created_at, updated_at
  ) VALUES (
    '${sp_id}', '${JPP_ID}', '${sp_step}', '${sp_role_id}',
    '${sp_content_esc}'::jsonb,
    ${ai_clause}, ${reviewed_clause}, '${sp_status}', NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content,
    ai_drafted_by = EXCLUDED.ai_drafted_by,
    reviewed_by = EXCLUDED.reviewed_by,
    status = EXCLUDED.status,
    updated_at = NOW();
  " > /dev/null

  log_verbose "  Upserted product: ${sp_id} (${sp_step})"
done

# ── Count results ────────────────────────────────────────────────────────────

PRODUCT_COUNT=$(psql_exec "SELECT count(*) FROM jpp_step_products WHERE id LIKE 'DEMO-SP-%'")
INSTANCE_COUNT=$(psql_exec "SELECT count(*) FROM jpp_instances WHERE id LIKE 'DEMO-JPP-%'")

log_success "Step Products: ${PRODUCT_COUNT} created/updated"

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "  -- JPP Seed Summary --"
echo "  Instance: ${JPP_ID}"
echo "  Problem Set: ${PS_CJTF}"
echo "  Current Step: ${JPP_CURRENT_STEP} (Step 4 of 7)"
echo "  Step Products: ${PRODUCT_COUNT}"
echo ""
echo "  Steps:"
echo "    1. Planning Initiation   [COMPLETE]  2 products"
echo "    2. Mission Analysis      [COMPLETE]  3 products"
echo "    3. COA Development       [COMPLETE]  3 products"
echo "    4. COA Analysis          [IN PROGRESS] 1 product (wargaming)"
echo "    5. COA Comparison        [PENDING]"
echo "    6. COA Approval          [PENDING]"
echo "    7. Plan/Order Development [PENDING]"
echo ""

record_count "JPP Instances" "${INSTANCE_COUNT}"
record_count "JPP Step Products" "${PRODUCT_COUNT}"
