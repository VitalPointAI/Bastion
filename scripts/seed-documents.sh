#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Document Upload
# ==============================================================================
# Uploads scenario documents to problem sets via the exercise API.
# Documents are sourced from the scenario/ directory and mapped to problem sets
# via the document manifest JSON.
#
# Upload endpoint: POST /api/exercise/scenarios/:scenarioId/upload
# Requires a scenario linked to each problem set. Creates scenario entries
# if they don't already exist.
#
# Note: Document extraction (NLP/LLM) runs asynchronously after upload.
# Pre-computed AI outputs for demo walkthrough are seeded separately in plan 05.
#
# Usage: source scripts/seed-documents.sh
#   (designed to be sourced by seed-demo.sh so env vars propagate)
#
# Requires:
#   - Backend API running at localhost:3001
#   - PS_THEATER and PS_CJTF env vars (set by seed-problem-sets.sh)
#   - DEMO-SCENARIO-pacific-strategy scenario (created by seed-command-units.sh)
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding Documents ==="
echo ""

# ── Validate prerequisites ───────────────────────────────────────────────────

MANIFEST="${DATA_DIR}/documents/document-manifest.json"

if [ ! -f "$MANIFEST" ]; then
  log_error "Document manifest not found at ${MANIFEST}"
  exit 1
fi

# We need the backend API for document uploads (multipart/form-data)
if ! check_backend; then
  log_error "Backend API required for document uploads. Start with: docker compose up -d backend"
  exit 1
fi

# ── Resolve scenario IDs per problem set ─────────────────────────────────────
# The upload endpoint requires a scenario ID. We look up or create scenarios
# linked to each problem set that appears in the manifest.

declare -A PS_SCENARIO_MAP

# Get unique problem set IDs from manifest
PROBLEM_SET_IDS=$(python3 -c "
import json
with open('${MANIFEST}') as f:
    ids = sorted(set(doc['problemSetId'] for doc in json.load(f)))
    for pid in ids:
        print(pid)
")

for PS_ID in $PROBLEM_SET_IDS; do
  log_verbose "Looking up scenario for problem set: ${PS_ID}"

  # Check if a scenario already exists for this problem set
  SCENARIO_ID=$(psql_exec "
    SELECT id FROM exercise_scenarios
    WHERE problem_set_id = '${PS_ID}'
    ORDER BY created_at DESC
    LIMIT 1
  " 2>/dev/null | tr -d '[:space:]')

  if [ -n "$SCENARIO_ID" ] && [ "$SCENARIO_ID" != "" ]; then
    log_verbose "Found existing scenario: ${SCENARIO_ID} for PS ${PS_ID}"
    PS_SCENARIO_MAP["${PS_ID}"]="${SCENARIO_ID}"
  else
    # Create a demo scenario for this problem set
    SCENARIO_ID="DEMO-SCENARIO-docs-${PS_ID##DEMO-PS-}"
    log_info "Creating scenario ${SCENARIO_ID} for problem set ${PS_ID}"

    psql_exec "
      INSERT INTO exercise_scenarios (id, problem_set_id, name, description, status, created_by, created_at, updated_at)
      VALUES (
        '${SCENARIO_ID}',
        '${PS_ID}',
        'Pacific Strategy AY26 - Document Container',
        'Demo scenario for document uploads',
        'active',
        '${DID}',
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    " 2>/dev/null

    PS_SCENARIO_MAP["${PS_ID}"]="${SCENARIO_ID}"
  fi
done

# ── Upload documents ─────────────────────────────────────────────────────────

UPLOAD_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0
TOTAL=$(python3 -c "import json; print(len(json.load(open('${MANIFEST}'))))")

log_info "Uploading ${TOTAL} documents from manifest..."
echo ""

# Process each document entry
python3 -c "
import json
with open('${MANIFEST}') as f:
    for doc in json.load(f):
        # Tab-separated for easy bash parsing
        print(f\"{doc['id']}\t{doc['filename']}\t{doc['sourcePath']}\t{doc['problemSetId']}\t{doc['team']}\t{doc['phase']}\t{doc['docType']}\")
" | while IFS=$'\t' read -r DOC_ID FILENAME SOURCE_PATH PS_ID TEAM PHASE DOC_TYPE; do

  # Resolve source file from repo root
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
  FILE_PATH="${REPO_ROOT}/${SOURCE_PATH}"

  if [ ! -f "$FILE_PATH" ]; then
    log_warn "File not found: ${SOURCE_PATH} — skipping ${DOC_ID}"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  # Get scenario ID for this problem set
  SCENARIO_ID="${PS_SCENARIO_MAP[${PS_ID}]}"

  # Fall back to looking up again if associative array lost in subshell
  if [ -z "$SCENARIO_ID" ]; then
    SCENARIO_ID=$(psql_exec "
      SELECT id FROM exercise_scenarios
      WHERE problem_set_id = '${PS_ID}'
      ORDER BY created_at DESC
      LIMIT 1
    " 2>/dev/null | tr -d '[:space:]')
  fi

  if [ -z "$SCENARIO_ID" ]; then
    log_error "No scenario found for problem set ${PS_ID} — skipping ${DOC_ID}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  # Check if document already uploaded (by filename match in this scenario)
  EXISTING=$(psql_exec "
    SELECT id FROM scenario_documents
    WHERE scenario_id = '${SCENARIO_ID}'
    AND filename = '$(echo "$FILENAME" | sed "s/'/''/g")'
    LIMIT 1
  " 2>/dev/null | tr -d '[:space:]')

  if [ -n "$EXISTING" ] && [ "$EXISTING" != "" ]; then
    log_verbose "Document already exists: ${FILENAME} (${EXISTING}) — skipping"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  log_info "Uploading: ${FILENAME}"
  log_verbose "  -> Scenario: ${SCENARIO_ID}"
  log_verbose "  -> Team: ${TEAM}, Phase: ${PHASE}, Type: ${DOC_TYPE}"

  # Build tags JSON for the upload
  TAGS_JSON="[{\"team\":\"${TEAM}\",\"exercisePhase\":\"${PHASE}\",\"documentType\":\"${DOC_TYPE}\"}]"

  # Upload via multipart/form-data
  # --max-time 120 because NLP extraction can be slow
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    --max-time 120 \
    -X POST \
    -H "x-did: ${DID}" \
    -F "files=@${FILE_PATH}" \
    -F "tags=${TAGS_JSON}" \
    "${API}/exercise/scenarios/${SCENARIO_ID}/upload" \
    2>/dev/null)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "200" ]; then
    UPLOADED_ID=$(echo "$BODY" | python3 -c "import sys,json; docs=json.load(sys.stdin).get('documents',[]); print(docs[0]['id'] if docs else 'unknown')" 2>/dev/null || echo "unknown")
    log_success "Uploaded ${FILENAME} -> ${UPLOADED_ID}"
    UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
  else
    log_error "Failed to upload ${FILENAME} (HTTP ${HTTP_CODE})"
    log_verbose "Response: ${BODY}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

done

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
log_info "Document upload complete"

# Re-count from database since subshell counters don't propagate
ACTUAL_COUNT=$(psql_exec "
  SELECT count(*) FROM scenario_documents sd
  JOIN exercise_scenarios es ON sd.scenario_id = es.id
  WHERE es.problem_set_id LIKE 'DEMO-PS-%'
" 2>/dev/null | tr -d '[:space:]')

record_count "Documents in DEMO problem sets" "${ACTUAL_COUNT:-0}"

log_info "Note: Document extraction runs asynchronously. Pre-computed AI outputs"
log_info "will be seeded separately (plan 05) for predictable demo walkthroughs."

echo ""
