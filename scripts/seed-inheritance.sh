#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — Inheritance Artifacts
# ==============================================================================
# Seeds cross-level inheritance data demonstrating Phase 38's propagation system:
#   - FRAGOs propagating downward (theater -> component -> tactical)
#   - Mission status snapshots reporting upward (tactical -> component -> theater)
#   - Override tracking where subordinates diverge from parent directives
#
# Tables: frago_drafts, mission_status_snapshots, inheritance_annotations,
#         inheritance_changelog
#
# All IDs use DEMO- prefix for safe cleanup.
# Uses INSERT ... ON CONFLICT for idempotent re-runs.
#
# Usage: source scripts/seed-inheritance.sh
#   (designed to be sourced by seed-demo.sh for PS_* env var access)
#
# Requires: PostgreSQL container (bastion-postgres) running
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$PSQL" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding Inheritance Artifacts ==="
echo ""

# ── Ensure inheritance tables exist ──────────────────────────────────────────
# The backend creates these on first use, but we may be seeding before startup.

psql_exec "
CREATE TABLE IF NOT EXISTS frago_drafts (
  id TEXT PRIMARY KEY,
  parent_problem_set_id TEXT NOT NULL,
  child_problem_set_id TEXT NOT NULL,
  source_opord_version TEXT NOT NULL,
  previous_opord_version TEXT NOT NULL,
  changed_paragraphs INTEGER[] NOT NULL,
  ai_draft_content TEXT NOT NULL,
  edited_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  distributed_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_frago_parent ON frago_drafts(parent_problem_set_id);
CREATE INDEX IF NOT EXISTS idx_frago_child ON frago_drafts(child_problem_set_id);
CREATE INDEX IF NOT EXISTS idx_frago_status ON frago_drafts(status);
" > /dev/null 2>&1

psql_exec "
CREATE TABLE IF NOT EXISTS mission_status_snapshots (
  id TEXT PRIMARY KEY,
  child_problem_set_id TEXT NOT NULL UNIQUE,
  child_problem_set_name TEXT NOT NULL,
  parent_problem_set_id TEXT NOT NULL,
  mission_state TEXT NOT NULL,
  mdmp_phase TEXT,
  percent_complete INTEGER DEFAULT 0,
  key_events JSONB DEFAULT '[]',
  resource_status JSONB DEFAULT '{}',
  objective_progress JSONB DEFAULT '[]',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mstat_parent ON mission_status_snapshots(parent_problem_set_id);
CREATE INDEX IF NOT EXISTS idx_mstat_child ON mission_status_snapshots(child_problem_set_id);
" > /dev/null 2>&1

psql_exec "
CREATE TABLE IF NOT EXISTS inheritance_annotations (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  source_problem_set_id TEXT NOT NULL,
  target_item_id TEXT NOT NULL,
  target_item_type TEXT NOT NULL,
  annotation_type TEXT NOT NULL,
  content TEXT NOT NULL,
  based_on_version TEXT,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  visibility TEXT NOT NULL DEFAULT 'upward',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iann_ps ON inheritance_annotations(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_iann_target ON inheritance_annotations(target_item_id);
" > /dev/null 2>&1

psql_exec "
CREATE TABLE IF NOT EXISTS inheritance_changelog (
  id TEXT PRIMARY KEY,
  source_problem_set_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_severity TEXT NOT NULL DEFAULT 'minor',
  item_id TEXT NOT NULL,
  item_title TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iclog_source ON inheritance_changelog(source_problem_set_id);
" > /dev/null 2>&1

# ── Seed FRAGOs ──────────────────────────────────────────────────────────────

FRAGO_COUNT=0
FRAGO_FILE="${DATA_DIR}/inheritance/fragos.json"

log_info "Seeding FRAGOs..."

parse_json_array "$FRAGO_FILE" | while IFS= read -r obj; do
  ID=$(echo "$obj" | json_field "id")
  PARENT_PS=$(echo "$obj" | json_field "parent_problem_set_id")
  CHILD_PS=$(echo "$obj" | json_field "child_problem_set_id")
  SRC_VER=$(echo "$obj" | json_field "source_opord_version")
  PREV_VER=$(echo "$obj" | json_field "previous_opord_version")
  CHANGED=$(echo "$obj" | python3 -c "import sys,json; d=json.load(sys.stdin); print('{' + ','.join(str(x) for x in d['changed_paragraphs']) + '}')")
  CONTENT=$(echo "$obj" | json_field "ai_draft_content")
  EDITED=$(echo "$obj" | json_field "edited_content")
  STATUS=$(echo "$obj" | json_field "status")
  APPROVED=$(echo "$obj" | json_field "approved_by")
  DIST_AT=$(echo "$obj" | json_field "distributed_at")
  ACK_BY=$(echo "$obj" | json_field "acknowledged_by")
  ACK_AT=$(echo "$obj" | json_field "acknowledged_at")

  # Handle nulls for timestamps and optional fields
  DIST_SQL="NULL"
  [ -n "$DIST_AT" ] && DIST_SQL="'${DIST_AT}'"
  ACK_BY_SQL="NULL"
  [ -n "$ACK_BY" ] && ACK_BY_SQL="'${ACK_BY}'"
  ACK_AT_SQL="NULL"
  [ -n "$ACK_AT" ] && ACK_AT_SQL="'${ACK_AT}'"
  APPROVED_SQL="NULL"
  [ -n "$APPROVED" ] && APPROVED_SQL="'${APPROVED}'"
  EDITED_SQL="NULL"
  [ -n "$EDITED" ] && EDITED_SQL="'$(echo "$EDITED" | sed "s/'/''/g")'"

  # Escape single quotes in content
  CONTENT_ESC=$(echo "$CONTENT" | sed "s/'/''/g")

  psql_exec "
    INSERT INTO frago_drafts (
      id, parent_problem_set_id, child_problem_set_id,
      source_opord_version, previous_opord_version, changed_paragraphs,
      ai_draft_content, edited_content, status,
      approved_by, distributed_at, acknowledged_by, acknowledged_at
    ) VALUES (
      '${ID}', '${PARENT_PS}', '${CHILD_PS}',
      '${SRC_VER}', '${PREV_VER}', '${CHANGED}',
      '${CONTENT_ESC}', ${EDITED_SQL}, '${STATUS}',
      ${APPROVED_SQL}, ${DIST_SQL}, ${ACK_BY_SQL}, ${ACK_AT_SQL}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      approved_by = EXCLUDED.approved_by,
      distributed_at = EXCLUDED.distributed_at,
      acknowledged_by = EXCLUDED.acknowledged_by,
      acknowledged_at = EXCLUDED.acknowledged_at;
  " > /dev/null

  log_verbose "  FRAGO: ${ID} (${STATUS}) — ${PARENT_PS} -> ${CHILD_PS}"
done

FRAGO_COUNT=$(psql_exec "SELECT count(*) FROM frago_drafts WHERE id LIKE 'DEMO-%';" 2>/dev/null || echo "0")
log_success "FRAGOs seeded: ${FRAGO_COUNT}"

# ── Seed changelog entries for FRAGOs ────────────────────────────────────────

log_info "Seeding inheritance changelog for FRAGOs..."

psql_exec "
  INSERT INTO inheritance_changelog (id, source_problem_set_id, change_type, change_severity, item_id, item_title, summary)
  VALUES
    ('DEMO-ICLOG-frago-001', 'DEMO-PS-indopacom-theater', 'document_updated', 'significant',
     'DEMO-FRAGO-001', 'FRAGO 001: Shift to Maritime Interdiction',
     'OPORD updated: main effort shifts from deterrence to active maritime interdiction in Taiwan Strait. Paragraphs 2 (Mission) and 3 (Execution) changed.'),
    ('DEMO-ICLOG-frago-002', 'DEMO-PS-indopacom-theater', 'document_updated', 'significant',
     'DEMO-FRAGO-002', 'FRAGO 002: ROE Update — Weapons Hold in Luzon Strait',
     'ROE change: weapons hold posture in Luzon Strait (18N-21N, 120E-122E) pending diplomatic resolution with PRC. Paragraph 3 (Execution) changed.'),
    ('DEMO-ICLOG-frago-003', 'DEMO-PS-cjtf-westpac', 'document_updated', 'significant',
     'DEMO-FRAGO-003', 'FRAGO 003: Logistics Priority Shift',
     'Logistics priority realigned to support maritime interdiction ops. 60% fuel reallocation to 7th Fleet surface combatants. Paragraphs 3 (Execution) and 4 (Sustainment) changed.')
  ON CONFLICT (id) DO UPDATE SET
    summary = EXCLUDED.summary;
" > /dev/null 2>&1

log_success "Changelog entries created for FRAGOs"

# ── Seed Mission Status Snapshots ────────────────────────────────────────────

STATUS_COUNT=0
STATUS_FILE="${DATA_DIR}/inheritance/status-reports.json"

log_info "Seeding mission status snapshots..."

parse_json_array "$STATUS_FILE" | while IFS= read -r obj; do
  ID=$(echo "$obj" | json_field "id")
  CHILD_PS=$(echo "$obj" | json_field "child_problem_set_id")
  CHILD_NAME=$(echo "$obj" | json_field "child_problem_set_name")
  PARENT_PS=$(echo "$obj" | json_field "parent_problem_set_id")
  MISSION_STATE=$(echo "$obj" | json_field "mission_state")
  MDMP_PHASE=$(echo "$obj" | json_field "mdmp_phase")
  PCT=$(echo "$obj" | json_field "percent_complete")

  # Extract JSONB fields
  KEY_EVENTS=$(echo "$obj" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['key_events']))")
  RESOURCE_STATUS=$(echo "$obj" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['resource_status']))")
  OBJ_PROGRESS=$(echo "$obj" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['objective_progress']))")

  # Escape single quotes in JSON and name fields
  CHILD_NAME_ESC=$(echo "$CHILD_NAME" | sed "s/'/''/g")
  KEY_EVENTS_ESC=$(echo "$KEY_EVENTS" | sed "s/'/''/g")
  RESOURCE_ESC=$(echo "$RESOURCE_STATUS" | sed "s/'/''/g")
  OBJ_PROGRESS_ESC=$(echo "$OBJ_PROGRESS" | sed "s/'/''/g")

  psql_exec "
    INSERT INTO mission_status_snapshots (
      id, child_problem_set_id, child_problem_set_name, parent_problem_set_id,
      mission_state, mdmp_phase, percent_complete,
      key_events, resource_status, objective_progress
    ) VALUES (
      '${ID}', '${CHILD_PS}', '${CHILD_NAME_ESC}', '${PARENT_PS}',
      '${MISSION_STATE}', '${MDMP_PHASE}', ${PCT},
      '${KEY_EVENTS_ESC}'::jsonb, '${RESOURCE_ESC}'::jsonb, '${OBJ_PROGRESS_ESC}'::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      mission_state = EXCLUDED.mission_state,
      mdmp_phase = EXCLUDED.mdmp_phase,
      percent_complete = EXCLUDED.percent_complete,
      key_events = EXCLUDED.key_events,
      resource_status = EXCLUDED.resource_status,
      objective_progress = EXCLUDED.objective_progress,
      last_updated = NOW();
  " > /dev/null

  log_verbose "  Status: ${ID} — ${CHILD_PS} (${MISSION_STATE}, ${PCT}%)"
done

STATUS_COUNT=$(psql_exec "SELECT count(*) FROM mission_status_snapshots WHERE id LIKE 'DEMO-%';" 2>/dev/null || echo "0")
log_success "Mission status snapshots seeded: ${STATUS_COUNT}"

# ── Seed Override Annotations ────────────────────────────────────────────────

OVERRIDE_COUNT=0
OVERRIDE_FILE="${DATA_DIR}/inheritance/overrides.json"

log_info "Seeding override annotations..."

parse_json_array "$OVERRIDE_FILE" | while IFS= read -r obj; do
  ID=$(echo "$obj" | json_field "id")
  PS_ID=$(echo "$obj" | json_field "problem_set_id")
  SOURCE_PS=$(echo "$obj" | json_field "source_problem_set_id")
  TARGET_ITEM=$(echo "$obj" | json_field "target_item_id")
  TARGET_TYPE=$(echo "$obj" | json_field "target_item_type")
  ANN_TYPE=$(echo "$obj" | json_field "annotation_type")
  CONTENT=$(echo "$obj" | json_field "content")
  BASED_VER=$(echo "$obj" | json_field "based_on_version")
  IS_STALE=$(echo "$obj" | json_field "is_stale")
  VISIBILITY=$(echo "$obj" | json_field "visibility")

  # Escape single quotes
  CONTENT_ESC=$(echo "$CONTENT" | sed "s/'/''/g")

  BASED_SQL="NULL"
  [ -n "$BASED_VER" ] && BASED_SQL="'${BASED_VER}'"

  # Convert Python True/False to SQL boolean
  STALE_SQL="false"
  [ "$IS_STALE" = "True" ] || [ "$IS_STALE" = "true" ] && STALE_SQL="true"

  psql_exec "
    INSERT INTO inheritance_annotations (
      id, problem_set_id, source_problem_set_id,
      target_item_id, target_item_type, annotation_type,
      content, based_on_version, is_stale, visibility,
      created_by
    ) VALUES (
      '${ID}', '${PS_ID}', '${SOURCE_PS}',
      '${TARGET_ITEM}', '${TARGET_TYPE}', '${ANN_TYPE}',
      '${CONTENT_ESC}', ${BASED_SQL}, ${STALE_SQL}, '${VISIBILITY}',
      'did:near:demo-seed.near'
    )
    ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      is_stale = EXCLUDED.is_stale;
  " > /dev/null

  log_verbose "  Override: ${ID} — ${PS_ID} overrides ${SOURCE_PS}"
done

OVERRIDE_COUNT=$(psql_exec "SELECT count(*) FROM inheritance_annotations WHERE id LIKE 'DEMO-OVERRIDE-%';" 2>/dev/null || echo "0")
log_success "Override annotations seeded: ${OVERRIDE_COUNT}"

# ── Seed changelog entries for overrides ─────────────────────────────────────

log_info "Seeding inheritance changelog for overrides..."

psql_exec "
  INSERT INTO inheritance_changelog (id, source_problem_set_id, change_type, change_severity, item_id, item_title, summary)
  VALUES
    ('DEMO-ICLOG-override-001', 'DEMO-PS-cjtf-westpac', 'document_updated', 'significant',
     'DEMO-OVERRIDE-001', 'Override: Time-Critical Target Authority Delegation',
     'CJTF overrides theater ROE — delegates time-critical target authority to component commanders for maritime targets within MIZ. Justified by C2 latency exceeding engagement windows.'),
    ('DEMO-ICLOG-override-002', 'DEMO-PS-7fleet', 'document_updated', 'significant',
     'DEMO-OVERRIDE-002', 'Override: Emergency Fuel Resupply Priority',
     '7th Fleet adjusts CJTF logistics priority — diverts USNS Rappahannock for emergency UNREP to USS Ronald Reagan. CSG-5 fuel state critical (below 40%).'),
    ('DEMO-ICLOG-override-003', 'DEMO-PS-strike-alpha', 'document_updated', 'minor',
     'DEMO-OVERRIDE-003', 'Override: Sortie Allocation Adjustment',
     'Strike Alpha adjusts sortie mix from 5 interdiction to 3 interdiction + 2 DCA. PLA air activity detected in patrol sector requires defensive counter-air coverage.')
  ON CONFLICT (id) DO UPDATE SET
    summary = EXCLUDED.summary;
" > /dev/null 2>&1

log_success "Changelog entries created for overrides"

# ── Record counts ────────────────────────────────────────────────────────────

record_count "FRAGOs" "${FRAGO_COUNT}"
record_count "Mission Status Snapshots" "${STATUS_COUNT}"
record_count "Override Annotations" "${OVERRIDE_COUNT}"
record_count "Inheritance Changelog" "6"

echo ""
echo "=== Inheritance Artifacts Complete ==="
echo ""
