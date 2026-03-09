#!/bin/bash
# ==============================================================================
# BASTION Demo Seed — RAFT Graph Actors, Relationships, and Tensions
# ==============================================================================
# Creates the Indo-Pacific actor network in Neo4j with:
#   - 17 actors (state, military, economic, organizational)
#   - 27 relationships (alliances, rivalries, partnerships, disputes)
#   - 8 tensions with intensity scores
#
# All data uses MERGE for idempotent re-runs and DEMO-ACT-/DEMO-TEN- prefix IDs.
#
# Usage: source scripts/seed-graph.sh
#   (designed to be sourced by seed-demo.sh so WKS_ID propagates)
#
# Requires: Neo4j container (bastion-neo4j) and backend API running
# Depends on: PS_THEATER env var from seed-problem-sets.sh
# ==============================================================================

# Source helpers if not already loaded
if [ -z "$CYPHER" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "${SCRIPT_DIR}/demo-data/_helpers.sh"
fi

echo ""
echo "=== Seeding RAFT Graph — Actors, Relationships & Tensions ==="
echo ""

# ── Validate prerequisites ───────────────────────────────────────────────────

if [ -z "$PS_THEATER" ]; then
  log_warn "PS_THEATER not set. Using default DEMO-PS-indopacom-theater"
  PS_THEATER="DEMO-PS-indopacom-theater"
fi

# ── Create graph workspace ───────────────────────────────────────────────────

log_info "Creating graph workspace for demo data..."
WKS_RESPONSE=$(curl -s -X POST "${API}/graph/workspaces" \
  -H "Content-Type: application/json" \
  -H "x-did: ${DID}" \
  -d '{
    "name": "Indo-Pacific Theater — Demo",
    "description": "RAFT actor network for Pacific Strategy AY26 demonstration. Covers major state and non-state actors in the Indo-Pacific region.",
    "type": "region",
    "tags": ["indo-pacific", "great-power-competition", "demo-seed"],
    "classification": "SECRET",
    "problemSetId": "'"${PS_THEATER}"'"
  }')

WKS_ID=$(echo "$WKS_RESPONSE" | parse_json_field "id" 2>/dev/null || echo "")
if [ -z "$WKS_ID" ]; then
  log_warn "Could not create graph workspace via API (backend may not be running)"
  log_info "Generating deterministic workspace ID for Neo4j seeding"
  WKS_ID="DEMO-WKS-indopac-theater"
fi
log_success "Graph workspace: ${WKS_ID}"
export WKS_ID

# ── Seed Actors ──────────────────────────────────────────────────────────────

log_info "Creating actors in Neo4j via MERGE..."

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ACTOR_COUNT=0

parse_json_array "${DATA_DIR}/graph/actors.json" | while IFS= read -r actor; do
  a_id=$(echo "$actor" | json_field "id")
  a_name=$(echo "$actor" | json_field "name")
  a_type=$(echo "$actor" | json_field "type")
  a_aliases=$(echo "$actor" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('aliases',[])))" 2>/dev/null)
  a_attrs=$(echo "$actor" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('attributes',{})))" 2>/dev/null)

  # Escape single quotes for Cypher
  a_name_esc="${a_name//\'/\\\'}"

  $CYPHER "MERGE (a:Actor {id: '${a_id}'})
    ON CREATE SET
      a.name = '${a_name_esc}',
      a.type = '${a_type}',
      a.aliases = ${a_aliases},
      a.attributes = '${a_attrs}',
      a.workspaceId = '${WKS_ID}',
      a.sourceDocumentIds = [],
      a.createdAt = '${NOW}',
      a.updatedAt = '${NOW}'
    ON MATCH SET
      a.name = '${a_name_esc}',
      a.type = '${a_type}',
      a.aliases = ${a_aliases},
      a.attributes = '${a_attrs}',
      a.workspaceId = '${WKS_ID}',
      a.updatedAt = '${NOW}'
  ;" > /dev/null 2>&1

  log_verbose "  MERGE actor: ${a_id} (${a_name})"
done

ACTOR_COUNT=$(echo "MATCH (a:Actor) WHERE a.id STARTS WITH 'DEMO-ACT-' RETURN count(a)" | $CYPHER 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "?")
log_success "Actors: ${ACTOR_COUNT} created/updated"

# ── Seed Relationships ───────────────────────────────────────────────────────

log_info "Creating relationships in Neo4j via MERGE..."

REL_COUNT=0

parse_json_array "${DATA_DIR}/graph/relationships.json" | while IFS= read -r rel; do
  r_id=$(echo "$rel" | json_field "id")
  r_source=$(echo "$rel" | json_field "source")
  r_target=$(echo "$rel" | json_field "target")
  r_type=$(echo "$rel" | json_field "type")
  r_strength=$(echo "$rel" | json_field "strength")
  r_desc=$(echo "$rel" | json_field "description")
  r_evidence=$(echo "$rel" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('evidence',[])))" 2>/dev/null)

  # Escape single quotes for Cypher
  r_desc_esc="${r_desc//\'/\\\'}"

  $CYPHER "
    MATCH (a:Actor {id: '${r_source}'}), (b:Actor {id: '${r_target}'})
    MERGE (a)-[r:RELATES_TO {id: '${r_id}'}]->(b)
    ON CREATE SET
      r.type = '${r_type}',
      r.strength = ${r_strength},
      r.description = '${r_desc_esc}',
      r.evidence = ${r_evidence},
      r.workspaceId = '${WKS_ID}',
      r.sourceDocumentIds = [],
      r.createdAt = '${NOW}',
      r.updatedAt = '${NOW}'
    ON MATCH SET
      r.type = '${r_type}',
      r.strength = ${r_strength},
      r.description = '${r_desc_esc}',
      r.evidence = ${r_evidence},
      r.updatedAt = '${NOW}'
  ;" > /dev/null 2>&1

  log_verbose "  MERGE relationship: ${r_id} (${r_source} -> ${r_target})"
done

REL_COUNT=$(echo "MATCH ()-[r:RELATES_TO]->() WHERE r.id STARTS WITH 'DEMO-REL-' RETURN count(r)" | $CYPHER 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "?")
log_success "Relationships: ${REL_COUNT} created/updated"

# ── Seed Tensions ────────────────────────────────────────────────────────────

log_info "Creating tensions in Neo4j via MERGE..."

parse_json_array "${DATA_DIR}/graph/tensions.json" | while IFS= read -r tension; do
  t_id=$(echo "$tension" | json_field "id")
  t_desc=$(echo "$tension" | json_field "description")
  t_intensity=$(echo "$tension" | json_field "intensity")
  t_domain=$(echo "$tension" | json_field "domain")
  t_actors=$(echo "$tension" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('actors',[])))" 2>/dev/null)
  t_triggers=$(echo "$tension" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('triggers',[])))" 2>/dev/null)
  t_mitigators=$(echo "$tension" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin).get('mitigators',[])))" 2>/dev/null)

  # Escape single quotes for Cypher
  t_desc_esc="${t_desc//\'/\\\'}"

  $CYPHER "MERGE (t:Tension {id: '${t_id}'})
    ON CREATE SET
      t.description = '${t_desc_esc}',
      t.intensity = '${t_intensity}',
      t.domain = '${t_domain}',
      t.actorIds = ${t_actors},
      t.triggers = ${t_triggers},
      t.mitigators = ${t_mitigators},
      t.linkedObjectiveIds = [],
      t.workspaceId = '${WKS_ID}',
      t.sourceDocumentIds = [],
      t.createdAt = '${NOW}',
      t.updatedAt = '${NOW}'
    ON MATCH SET
      t.description = '${t_desc_esc}',
      t.intensity = '${t_intensity}',
      t.domain = '${t_domain}',
      t.actorIds = ${t_actors},
      t.triggers = ${t_triggers},
      t.mitigators = ${t_mitigators},
      t.updatedAt = '${NOW}'
  ;" > /dev/null 2>&1

  log_verbose "  MERGE tension: ${t_id}"
done

TEN_COUNT=$(echo "MATCH (t:Tension) WHERE t.id STARTS WITH 'DEMO-TEN-' RETURN count(t)" | $CYPHER 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "?")
log_success "Tensions: ${TEN_COUNT} created/updated"

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "  -- RAFT Graph Summary --"
echo "  Workspace: ${WKS_ID}"
echo "  Actors:        ${ACTOR_COUNT}"
echo "  Relationships: ${REL_COUNT}"
echo "  Tensions:      ${TEN_COUNT}"
echo ""

record_count "Graph Actors" "${ACTOR_COUNT}"
record_count "Graph Relationships" "${REL_COUNT}"
record_count "Graph Tensions" "${TEN_COUNT}"
