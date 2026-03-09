#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — AARs and METL Proficiency Tracking
# ==============================================================================
# Creates assessment data for the Assess tab showing the training evaluation
# loop: AARs from tactical events feeding METL proficiency tracking.
#
# Data created:
#   AARs (3):
#     - Strike Package Alpha AAR (Day 4 strike operations)
#     - Logistics Convoy Bravo AAR (Day 10 sustainment challenges)
#     - Combat Air Patrol Delta AAR (Day 22 air superiority + EW)
#
#   AAR Observations (16):
#     - Sustains and improves linked to specific METL tasks
#
#   METL Tasks (12):
#     - T/P/U proficiency ratings showing realistic training evaluation
#     - Linked to AARs where applicable
#
#   METL Assessments (12):
#     - One assessment per METL task with T/P/U rating
#
# Uses direct psql INSERT for reliability (no backend auth required).
# All IDs use DEMO-AAR-*, DEMO-OBS-*, DEMO-METL-*, DEMO-ASSESS-* prefixes.
#
# Usage: source scripts/seed-assessment.sh
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
echo "=== Seeding Assessment Data (AARs + METL) ==="
echo ""

# ── Default PS IDs if not set by orchestrator ─────────────────────────────────

PS_THEATER="${PS_THEATER:-DEMO-PS-indopacom-theater}"
PS_STRIKE_ALPHA="${PS_STRIKE_ALPHA:-DEMO-PS-strike-alpha}"
PS_LOGISTICS_BRAVO="${PS_LOGISTICS_BRAVO:-DEMO-PS-logistics-bravo}"
PS_CAP_DELTA="${PS_CAP_DELTA:-DEMO-PS-cap-delta}"

AAR_FIXTURE="${DATA_DIR}/assessment/aars.json"
METL_FIXTURE="${DATA_DIR}/assessment/metl-tasks.json"

if [ ! -f "$AAR_FIXTURE" ]; then
  log_error "AAR fixture not found at ${AAR_FIXTURE}"
  exit 1
fi

if [ ! -f "$METL_FIXTURE" ]; then
  log_error "METL fixture not found at ${METL_FIXTURE}"
  exit 1
fi

# ── Ensure assessment tables exist ───────────────────────────────────────────

psql_exec "
CREATE TABLE IF NOT EXISTS structured_aars (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  training_event_name TEXT NOT NULL,
  initiated_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  what_was_planned TEXT NOT NULL DEFAULT '',
  what_happened TEXT NOT NULL DEFAULT '',
  why TEXT NOT NULL DEFAULT '',
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aar_problem_set ON structured_aars(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_aar_status ON structured_aars(status);

CREATE TABLE IF NOT EXISTS aar_observations (
  id TEXT PRIMARY KEY,
  aar_id TEXT NOT NULL REFERENCES structured_aars(id),
  observation_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metl_task_id TEXT,
  suggested_by_ai BOOLEAN NOT NULL DEFAULT false,
  ai_accepted BOOLEAN,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aar_obs_aar ON aar_observations(aar_id);

CREATE TABLE IF NOT EXISTS metl_tasks (
  id TEXT PRIMARY KEY,
  problem_set_id TEXT NOT NULL,
  source_problem_set_id TEXT,
  task_name TEXT NOT NULL,
  task_description TEXT,
  competency_area TEXT,
  is_supplemental BOOLEAN NOT NULL DEFAULT false,
  promoted_to_strategic BOOLEAN NOT NULL DEFAULT false,
  decay_days INTEGER NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metl_tasks_ps ON metl_tasks(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_metl_tasks_source ON metl_tasks(source_problem_set_id);

CREATE TABLE IF NOT EXISTS metl_assessments (
  id TEXT PRIMARY KEY,
  metl_task_id TEXT NOT NULL REFERENCES metl_tasks(id),
  problem_set_id TEXT NOT NULL,
  aar_id TEXT,
  rating TEXT NOT NULL,
  assessed_by TEXT NOT NULL,
  ai_suggested_rating TEXT,
  commander_override BOOLEAN NOT NULL DEFAULT false,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_metl_assess_task ON metl_assessments(metl_task_id);
CREATE INDEX IF NOT EXISTS idx_metl_assess_ps ON metl_assessments(problem_set_id);
CREATE INDEX IF NOT EXISTS idx_metl_assess_date ON metl_assessments(assessed_at);
" > /dev/null

# ── Seed METL Tasks first (AARs reference them) ──────────────────────────────

log_info "Seeding METL tasks..."

parse_json_array "${METL_FIXTURE}" | while IFS= read -r obj; do
  m_id=$(echo "$obj" | json_field "id")
  m_ps_id=$(echo "$obj" | json_field "problem_set_id")
  m_name=$(echo "$obj" | json_field "task_name")
  m_desc=$(echo "$obj" | json_field "task_description")
  m_area=$(echo "$obj" | json_field "competency_area")

  # Escape single quotes
  m_name="${m_name//\'/\'\'}"
  m_desc="${m_desc//\'/\'\'}"
  m_area="${m_area//\'/\'\'}"

  psql_exec "
    INSERT INTO metl_tasks (
      id, problem_set_id, task_name, task_description, competency_area,
      is_supplemental, promoted_to_strategic, decay_days, created_at
    ) VALUES (
      '${m_id}', '${m_ps_id}', '${m_name}', '${m_desc}', '${m_area}',
      false, false, 90, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      task_name = EXCLUDED.task_name,
      task_description = EXCLUDED.task_description,
      competency_area = EXCLUDED.competency_area;
  " > /dev/null

  log_verbose "  Upserted METL task: ${m_id}"
done

METL_TOTAL=$(psql_exec "SELECT count(*) FROM metl_tasks WHERE id LIKE 'DEMO-METL-%'")
log_success "METL tasks: ${METL_TOTAL} seeded"

# ── Seed METL Assessments (one per task with proficiency rating) ─────────────

log_info "Seeding METL assessments..."

parse_json_array "${METL_FIXTURE}" | while IFS= read -r obj; do
  m_id=$(echo "$obj" | json_field "id")
  m_ps_id=$(echo "$obj" | json_field "problem_set_id")
  m_prof=$(echo "$obj" | json_field "proficiency")
  m_notes=$(echo "$obj" | json_field "evaluation_notes")
  m_date=$(echo "$obj" | json_field "last_evaluated")

  # Get first linked AAR if any
  m_aar=$(echo "$obj" | python3 -c "import sys,json; ids=json.load(sys.stdin).get('linked_aar_ids',[]); print(ids[0] if ids else '')" 2>/dev/null)

  # Escape single quotes
  m_notes="${m_notes//\'/\'\'}"

  # Build assessment ID from METL task ID
  assess_id="DEMO-ASSESS-${m_id#DEMO-METL-}"

  # Handle null AAR
  if [ -z "$m_aar" ] || [ "$m_aar" = "None" ] || [ "$m_aar" = "null" ]; then
    aar_clause="NULL"
  else
    aar_clause="'${m_aar}'"
  fi

  psql_exec "
    INSERT INTO metl_assessments (
      id, metl_task_id, problem_set_id, aar_id, rating, assessed_by,
      commander_override, assessed_at, notes
    ) VALUES (
      '${assess_id}', '${m_id}', '${m_ps_id}', ${aar_clause},
      '${m_prof}', 'did:near:theater-j7-assessor.near',
      false, '${m_date}'::date, '${m_notes}'
    )
    ON CONFLICT (id) DO UPDATE SET
      rating = EXCLUDED.rating,
      assessed_at = EXCLUDED.assessed_at,
      notes = EXCLUDED.notes;
  " > /dev/null

  log_verbose "  Upserted assessment: ${assess_id} (${m_prof})"
done

ASSESS_TOTAL=$(psql_exec "SELECT count(*) FROM metl_assessments WHERE id LIKE 'DEMO-ASSESS-%'")
log_success "METL assessments: ${ASSESS_TOTAL} seeded"

# ── Seed AARs ────────────────────────────────────────────────────────────────

log_info "Seeding AARs..."

parse_json_array "${AAR_FIXTURE}" | while IFS= read -r obj; do
  a_id=$(echo "$obj" | json_field "id")
  a_ps_id=$(echo "$obj" | json_field "problem_set_id")
  a_event=$(echo "$obj" | json_field "training_event_name")
  a_initiated=$(echo "$obj" | json_field "initiated_by")
  a_status=$(echo "$obj" | json_field "status")
  a_planned=$(echo "$obj" | json_field "what_was_planned")
  a_happened=$(echo "$obj" | json_field "what_happened")
  a_why=$(echo "$obj" | json_field "why")
  a_finalized_by=$(echo "$obj" | json_field "finalized_by")

  # Escape single quotes
  a_event="${a_event//\'/\'\'}"
  a_planned="${a_planned//\'/\'\'}"
  a_happened="${a_happened//\'/\'\'}"
  a_why="${a_why//\'/\'\'}"

  # Handle finalized_by
  if [ -z "$a_finalized_by" ] || [ "$a_finalized_by" = "None" ] || [ "$a_finalized_by" = "null" ]; then
    finalized_clause="NULL"
    finalized_at_clause="NULL"
  else
    finalized_clause="'${a_finalized_by}'"
    finalized_at_clause="NOW()"
  fi

  psql_exec "
    INSERT INTO structured_aars (
      id, problem_set_id, training_event_name, initiated_by, status,
      what_was_planned, what_happened, why,
      finalized_by, finalized_at, created_at, updated_at
    ) VALUES (
      '${a_id}', '${a_ps_id}', '${a_event}', '${a_initiated}', '${a_status}',
      '${a_planned}', '${a_happened}', '${a_why}',
      ${finalized_clause}, ${finalized_at_clause}, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      training_event_name = EXCLUDED.training_event_name,
      status = EXCLUDED.status,
      what_was_planned = EXCLUDED.what_was_planned,
      what_happened = EXCLUDED.what_happened,
      why = EXCLUDED.why,
      finalized_by = EXCLUDED.finalized_by,
      finalized_at = EXCLUDED.finalized_at,
      updated_at = NOW();
  " > /dev/null

  log_verbose "  Upserted AAR: ${a_id}"

  # ── Seed observations for this AAR ──────────────────────────────────────────
  echo "$obj" | python3 -c "
import sys, json
obj = json.load(sys.stdin)
for obs in obj.get('observations', []):
    print(json.dumps(obs))
" | while IFS= read -r obs_obj; do
    o_id=$(echo "$obs_obj" | json_field "id")
    o_type=$(echo "$obs_obj" | json_field "observation_type")
    o_content=$(echo "$obs_obj" | json_field "content")
    o_metl=$(echo "$obs_obj" | json_field "metl_task_id")
    o_created_by=$(echo "$obs_obj" | json_field "created_by")

    # Escape single quotes
    o_content="${o_content//\'/\'\'}"

    # Handle null metl_task_id
    if [ -z "$o_metl" ] || [ "$o_metl" = "None" ] || [ "$o_metl" = "null" ]; then
      metl_clause="NULL"
    else
      metl_clause="'${o_metl}'"
    fi

    psql_exec "
      INSERT INTO aar_observations (
        id, aar_id, observation_type, content, metl_task_id,
        suggested_by_ai, created_by, created_at
      ) VALUES (
        '${o_id}', '${a_id}', '${o_type}', '${o_content}', ${metl_clause},
        false, '${o_created_by}', NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        observation_type = EXCLUDED.observation_type,
        metl_task_id = EXCLUDED.metl_task_id;
    " > /dev/null

    log_verbose "    Observation: ${o_id} (${o_type})"
  done
done

AAR_TOTAL=$(psql_exec "SELECT count(*) FROM structured_aars WHERE id LIKE 'DEMO-AAR-%'")
OBS_TOTAL=$(psql_exec "SELECT count(*) FROM aar_observations WHERE id LIKE 'DEMO-OBS-%'")
log_success "AARs: ${AAR_TOTAL} seeded, Observations: ${OBS_TOTAL} seeded"

# ── Verify and summarize ─────────────────────────────────────────────────────

TRAINED=$(psql_exec "SELECT count(*) FROM metl_assessments WHERE id LIKE 'DEMO-ASSESS-%' AND rating = 'T'")
PRACTICED=$(psql_exec "SELECT count(*) FROM metl_assessments WHERE id LIKE 'DEMO-ASSESS-%' AND rating = 'P'")
UNTRAINED=$(psql_exec "SELECT count(*) FROM metl_assessments WHERE id LIKE 'DEMO-ASSESS-%' AND rating = 'U'")
SUSTAINS=$(psql_exec "SELECT count(*) FROM aar_observations WHERE id LIKE 'DEMO-OBS-%' AND observation_type = 'sustain'")
IMPROVES=$(psql_exec "SELECT count(*) FROM aar_observations WHERE id LIKE 'DEMO-OBS-%' AND observation_type = 'improve'")

echo ""
echo "  -- Assessment Data Summary --"
echo "  AARs: ${AAR_TOTAL} (across strike, logistics, air patrol)"
echo "  Observations: ${OBS_TOTAL} (${SUSTAINS} sustains, ${IMPROVES} improves)"
echo ""
echo "  METL Tasks: ${METL_TOTAL}"
echo "  METL Assessments: ${ASSESS_TOTAL}"
echo "    Trained (T):   ${TRAINED}"
echo "    Practiced (P): ${PRACTICED}"
echo "    Untrained (U): ${UNTRAINED}"
echo ""
echo "  Training evaluation loop demonstrates:"
echo "    - Tactical AARs feed upward to theater METL proficiency"
echo "    - T/P/U ratings aggregate from unit events to readiness picture"
echo "    - Observations linked to specific METL tasks for traceability"
echo ""

record_count "AARs" "${AAR_TOTAL}"
record_count "AAR Observations" "${OBS_TOTAL}"
record_count "METL Tasks" "${METL_TOTAL}"
record_count "METL Assessments" "${ASSESS_TOTAL}"
