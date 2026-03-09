# Phase 39: Operational Demonstration Data Package - Research

**Researched:** 2026-03-08
**Domain:** Seed data scripting, REST API orchestration, idempotent data population
**Confidence:** HIGH

## Summary

Phase 39 is a pure data/scripts phase -- no new platform features. The goal is creating a comprehensive, repeatable demo data package that populates every BASTION subsystem with realistic Pacific Strategy AY26 content. The existing `seed-graph-data.sh` script establishes the proven pattern: bash scripts using `curl` against the backend REST API and `docker exec bastion-neo4j cypher-shell` for direct Neo4j access. All demo records are tagged with `source: demo-seed` for clean teardown.

The codebase already has 35+ API route files covering every subsystem that needs seeding: problem sets (with hierarchy and inheritance), graph/RAFT actors, OSINT events, documents, exercise operations (scenarios, IPB, COAs, orders, tasks), decision gates, operational design, assessment/METL, command/units, JPP instances, and user mode. The scenario directory contains the full Pacific Strategy AY26 exercise content across 6 phases with blue team, red team, and scenario phase documents -- these serve as the source material for realistic demo content.

**Primary recommendation:** Build modular bash seed scripts following the existing `seed-graph-data.sh` curl + cypher-shell pattern, with JSON fixture files in `scripts/demo-data/` subdirectories, a master orchestrator `scripts/seed-demo.sh` with `--reset` flag, and strict `source: demo-seed` tagging on all records.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Primary audience: military stakeholders + academic/wargaming (war college faculty, students, exercise planners)
- Data tells a coherent operational story following the Pacific Strategy AY26 arc: Competition -> Crisis -> Conflict Day 4/10/22 -> Negotiation
- All 6 exercise phases populated with data
- Demo shows both training mode AND operational mode, demonstrating the Phase 22 transition concept
- AI content: pre-seeded polished outputs for the walkthrough path, plus live agent invocations available for Q&A / ad-hoc exploration
- Full Pacific Strategy AY26 scenario -- all 6 phases
- Problem set hierarchy: 3 levels deep (Theater campaign -> Component plans -> Tactical missions)
- Example: INDOPACOM campaign -> JTF-West plan -> individual strike/logistics missions
- RAFT graph: 15-25 actors (core state actors: US, China, Taiwan, Japan, Philippines, Australia + key non-state actors and institutions)
- Real-world unit designations and geography (USS Ronald Reagan, 3rd MEF, PLA Eastern Theater Command, etc.)
- Data Coverage Must-Haves: Problem set hierarchy + inheritance, RAFT graph + OSINT events, Doctrinal tabs content (Understand/Design/Plan/Direct/COP/Assess), AI agent analysis products, DAO governance artifacts, Documents (PDFs/docs for ingestion)
- Modular per-feature scripts: seed-problem-sets.sh, seed-graph.sh, seed-osint.sh, seed-documents.sh, seed-agents.sh, seed-governance.sh
- Master orchestrator: scripts/seed-demo.sh runs all in dependency order with --reset flag
- Idempotent upsert pattern -- safe to re-run without duplicating data
- Demo data fixtures stored in scripts/demo-data/ with subfolder per feature
- Builds on existing seed-graph-data.sh curl + cypher-shell pattern
- All seeded records tagged with source: demo-seed marker (extends existing x-did: seed-script pattern)
- Cleanup script queries by tag and deletes -- never touches user-created data

### Claude's Discretion
- Exact OSINT event content and timing distribution across phases
- Specific relationships and tension intensities in the RAFT graph
- AI agent output content quality and formatting
- Document templates and sample content structure
- Order of operations within the master orchestrator
- Error handling and retry logic in seed scripts

### Deferred Ideas (OUT OF SCOPE)
- Demo management admin UI (start/pause/end/cleanup from admin page) -- future phase

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bash | system | Seed script orchestration | Matches existing seed-graph-data.sh pattern |
| curl | system | REST API calls to backend | Proven in seed-graph-data.sh |
| python3 | system | JSON parsing in scripts | Used in seed-graph-data.sh for response extraction |
| cypher-shell | neo4j container | Direct Neo4j graph operations | Used in seed-graph-data.sh via docker exec |
| jq | system (install if needed) | JSON fixture file processing | More robust than python3 one-liners for complex JSON |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| docker exec | n/a | Access Neo4j inside container | For cypher-shell commands against bastion-neo4j |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bash + curl | TypeScript seed scripts | TS would match backend code, but curl pattern already proven and simpler for pure data seeding |
| Individual JSON files | Inline JSON in bash | External fixtures are easier to review, edit, and version; inline is harder to maintain |

**No installation needed** -- all tools are already available in the project environment.

## Architecture Patterns

### Recommended Project Structure
```
scripts/
  seed-demo.sh               # Master orchestrator (--reset, --clean, --verbose flags)
  seed-cleanup.sh             # Standalone cleanup (delete by demo-seed tag)
  seed-problem-sets.sh        # Level 1: Problem set hierarchy (3 levels)
  seed-graph.sh               # Level 2: RAFT actors, relationships, tensions (Neo4j)
  seed-osint.sh               # Level 2: OSINT events across 6 phases
  seed-documents.sh           # Level 2: Document uploads and ingestion
  seed-design.sh              # Level 3: Operational design tab data
  seed-jpp.sh                 # Level 3: JPP instances and step products
  seed-agents.sh              # Level 3: Pre-seeded AI agent outputs
  seed-governance.sh          # Level 3: Decision gates with votes/approvals
  seed-assessment.sh          # Level 3: AARs, METL tasks, MOE/MOP measures
  seed-inheritance.sh         # Level 4: Cross-level inheritance, FRAGOs, status reports
  demo-data/
    problem-sets/             # JSON fixtures for 3-level hierarchy
    graph/                    # Actor, relationship, tension definitions
    osint/                    # OSINT events per exercise phase
    documents/                # Sample doc metadata (real PDFs in scenario/)
    design/                   # Operational design section data
    jpp/                      # JPP step products and E-W-M linkages
    agents/                   # Pre-computed AI agent output JSON
    governance/               # Decision gate definitions and vote records
    assessment/               # AARs, METL tasks, proficiency data
    inheritance/              # Override/annotation/FRAGO/status fixtures
```

### Pattern 1: Idempotent Upsert via API
**What:** Every seed script uses deterministic IDs and the backend's existing UPSERT/ON CONFLICT behavior.
**When to use:** All data seeding operations.
**Example:**
```bash
# Source: existing seed-graph-data.sh pattern
API="http://localhost:3001/api"
DID="demo-seed"  # Tag all records

# Create problem set with deterministic naming
PS_RESULT=$(curl -s -X POST "$API/problem-sets" \
  -H "Content-Type: application/json" \
  -H "x-did: $DID" \
  -d @scripts/demo-data/problem-sets/theater-campaign.json)
PS_ID=$(echo "$PS_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
```

### Pattern 2: Dependency-Ordered Orchestration
**What:** Master script runs modular scripts in dependency order, passing IDs between them.
**When to use:** `seed-demo.sh` orchestrator.
**Example:**
```bash
#!/bin/bash
# seed-demo.sh — Master orchestrator
set -e

VERBOSE=false
RESET=false
for arg in "$@"; do
  case $arg in
    --reset) RESET=true ;;
    --verbose) VERBOSE=true ;;
    --clean) bash scripts/seed-cleanup.sh; exit 0 ;;
  esac
done

if [ "$RESET" = true ]; then
  echo "=== Cleaning up previous demo data ==="
  bash scripts/seed-cleanup.sh
fi

echo "=== Seeding demo data ==="

# Level 1: Foundation (other scripts depend on these IDs)
source scripts/seed-problem-sets.sh   # Exports PS_THEATER, PS_COMPONENT, PS_TACTICAL

# Level 2: Independent data per feature (can run in parallel conceptually)
source scripts/seed-graph.sh          # Uses PS_THEATER
source scripts/seed-osint.sh          # Uses PS_THEATER
source scripts/seed-documents.sh      # Uses PS_THEATER, PS_COMPONENT

# Level 3: Depends on Level 1+2
source scripts/seed-design.sh         # Uses PS_THEATER, PS_COMPONENT
source scripts/seed-jpp.sh            # Uses PS_COMPONENT
source scripts/seed-agents.sh         # Uses PS_THEATER, PS_COMPONENT, PS_TACTICAL
source scripts/seed-governance.sh     # Uses all PS_* IDs

# Level 4: Cross-cutting
source scripts/seed-assessment.sh     # Uses PS_TACTICAL
source scripts/seed-inheritance.sh    # Uses all PS_* IDs

echo "=== Demo seed complete ==="
```

### Pattern 3: Tagged Cleanup
**What:** All seeded records use `x-did: demo-seed` header and/or a `source` column marker. Cleanup queries by this tag.
**When to use:** `seed-cleanup.sh` and `--reset` flag.
**Example:**
```bash
#!/bin/bash
# seed-cleanup.sh — Remove all demo-seed tagged data
set -e
API="http://localhost:3001/api"
CYPHER="docker exec bastion-neo4j cypher-shell -u neo4j -p password"

echo "=== Cleaning demo data ==="

# Neo4j: delete all demo-tagged nodes and relationships
$CYPHER "MATCH (n) WHERE n.id STARTS WITH 'DEMO-' DETACH DELETE n"

# PostgreSQL: delete via API or direct SQL
# Problem sets cascade-delete members, activities, etc.
# Use API delete endpoints in reverse dependency order
```

### Pattern 4: ID Convention for Demo Data
**What:** All demo entity IDs use a `DEMO-` prefix for easy identification and cleanup.
**When to use:** All fixture files and seed scripts.
**Example:**
```
Problem sets:  DEMO-PS-theater, DEMO-PS-jtf-west, DEMO-PS-strike-001
Actors:        DEMO-ACT-usa, DEMO-ACT-china, DEMO-ACT-taiwan
OSINT events:  DEMO-EVT-001 through DEMO-EVT-030
Gates:         DEMO-GATE-coa-approval, DEMO-GATE-order-release
```

### Anti-Patterns to Avoid
- **Hardcoded UUIDs that collide with real data:** Use DEMO- prefix convention instead of random UUIDs
- **Non-idempotent INSERT without conflict handling:** Always check for existing records or use UPSERT
- **Seeding without cleanup path:** Every INSERT must be reversible via tag-based cleanup
- **Embedding large JSON inline in bash:** Use external fixture files in demo-data/ directory
- **Sequential when parallel is possible:** Group independent API calls where feasible

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing in bash | sed/awk regex on JSON | python3 -c or jq | JSON structure is fragile with regex |
| Problem set hierarchy | Manual SQL inserts | POST /api/problem-sets with parentProblemSetId | API handles DAO contract calls, cascading setup |
| Decision gate lifecycle | Direct DB inserts | POST/PATCH /api/gates/* | Gate service handles status transitions, DAO integration |
| Document processing | Manual DB inserts | POST /api/exercise/scenarios/:id/documents/upload | Upload pipeline handles extraction, parsing, NLP |
| Inheritance propagation | Manual parent-child linking | Existing inheritance API routes | Service handles change notifications, override tracking |
| RAFT graph with relationships | REST-only graph API | cypher-shell for Neo4j actors + relationships | Existing pattern; REST graph API creates workspaces, Neo4j creates actors directly |

**Key insight:** The backend API is authoritative for data integrity. Always seed through API endpoints rather than direct SQL inserts, with the sole exception of Neo4j actor/relationship creation which uses cypher-shell (matching the existing pattern).

## Common Pitfalls

### Pitfall 1: Authentication Bypass
**What goes wrong:** Seed scripts fail because API routes require authentication (requireAuth middleware).
**Why it happens:** The `x-did` header is used for ownership tagging, but many routes use `requireAuth`.
**How to avoid:** Check which routes require auth. The existing seed-graph-data.sh does NOT use auth tokens -- the graph API workspace/OSINT routes may not require auth. For routes that do, either: (a) create a demo user first and use its session, or (b) seed directly via stores/SQL for auth-gated endpoints.
**Warning signs:** 401/403 responses from curl calls.

### Pitfall 2: Dependency Ordering
**What goes wrong:** Seed script fails because it references a problem set ID that hasn't been created yet.
**Why it happens:** Scripts run out of order or a previous script failed silently.
**How to avoid:** Use `set -e` in all scripts. Pass IDs via environment variables from master orchestrator. Validate IDs are non-empty before proceeding.
**Warning signs:** Empty ID variables, "not found" API errors.

### Pitfall 3: Cleanup Misses Orphaned Records
**What goes wrong:** Some demo data remains after cleanup because it was created via a code path that didn't tag properly.
**Why it happens:** Cascade deletes in PostgreSQL handle most FK relationships, but Neo4j nodes, IPFS uploads, and independently-created records may not cascade.
**How to avoid:** Use DEMO- prefix on ALL IDs. Cleanup script handles PostgreSQL (cascade from problem set delete), Neo4j (MATCH by ID prefix), and any other stores separately.
**Warning signs:** Stale demo data appearing in the UI after cleanup.

### Pitfall 4: Large Document Upload Timeouts
**What goes wrong:** Document upload/processing takes too long and curl times out.
**Why it happens:** Document ingestion triggers NLP extraction, which is CPU-intensive.
**How to avoid:** Use `--max-time 120` on curl for document uploads. For AI processing, seed the pre-computed outputs directly rather than triggering live extraction for all documents.
**Warning signs:** Curl timeout errors, incomplete document extraction.

### Pitfall 5: Neo4j Container Not Running
**What goes wrong:** cypher-shell commands fail because the Neo4j container isn't up.
**Why it happens:** Docker compose may not have been started, or Neo4j is still initializing.
**How to avoid:** Add a health check at the top of the master orchestrator that verifies both backend API and Neo4j are responsive.
**Warning signs:** "Could not connect to Neo4j" errors.

### Pitfall 6: Mode Context Missing
**What goes wrong:** Problem sets created without mode context don't appear in training or operational views.
**Why it happens:** Phase 22 mode toggle filters problem sets by mode; demo data needs both modes.
**How to avoid:** Create some problem sets in training mode and some in operational mode. Set user mode before demonstrating the toggle feature.
**Warning signs:** Empty problem set list after mode switch.

## Code Examples

### Problem Set Hierarchy Creation (3 Levels)
```bash
# Source: backend/src/api/problem-sets.ts CreateProblemSetSchema
API="http://localhost:3001/api"
DID="demo-seed"

# Theater level (strategic)
THEATER=$(curl -s -X POST "$API/problem-sets" \
  -H "Content-Type: application/json" \
  -H "x-did: $DID" \
  -d '{
    "name": "INDOPACOM Theater Campaign",
    "description": "Pacific Strategy AY26 — Indo-Pacific theater-level campaign plan",
    "echelon": "strategic",
    "classification": "SECRET",
    "mode": "training"
  }')
PS_THEATER=$(echo "$THEATER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Component level (operational) — child of theater
COMPONENT=$(curl -s -X POST "$API/problem-sets" \
  -H "Content-Type: application/json" \
  -H "x-did: $DID" \
  -d "{
    \"name\": \"CJTF-WestPac Campaign Plan\",
    \"description\": \"Combined Joint Task Force Western Pacific — operational campaign\",
    \"echelon\": \"operational\",
    \"classification\": \"SECRET\",
    \"parentProblemSetId\": \"$PS_THEATER\",
    \"mode\": \"training\"
  }")
PS_COMPONENT=$(echo "$COMPONENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Tactical mission — child of component
TACTICAL=$(curl -s -X POST "$API/problem-sets" \
  -H "Content-Type: application/json" \
  -H "x-did: $DID" \
  -d "{
    \"name\": \"Strike Package Alpha — Taiwan Strait\",
    \"description\": \"Carrier strike group maritime interdiction mission\",
    \"echelon\": \"tactical\",
    \"classification\": \"SECRET\",
    \"parentProblemSetId\": \"$PS_COMPONENT\",
    \"mode\": \"training\"
  }")
PS_TACTICAL=$(echo "$TACTICAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
```

### Decision Gate with Approval
```bash
# Source: backend/src/gates/gate-types.ts, gate-routes.ts
# Create a COA selection gate
curl -s -X POST "$API/gates" \
  -H "Content-Type: application/json" \
  -d "{
    \"problemSetId\": \"$PS_COMPONENT\",
    \"gateType\": \"coa_selection\",
    \"tab\": \"plan\",
    \"title\": \"COA 2 Selection — Maritime Blockade\",
    \"description\": \"Commander approval for COA 2: Maritime blockade with air superiority\",
    \"enforcement\": \"hard_block\",
    \"status\": \"approved\",
    \"decisionContext\": {
      \"selectedCoa\": \"COA 2 — Maritime Blockade\",
      \"rationale\": \"Best balances risk with decisive effect in strait\",
      \"commanderDid\": \"$DID\",
      \"approvedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }
  }"
```

### OSINT Event Creation
```bash
# Source: backend/src/api/graph.ts OSINT endpoints (existing pattern from seed-graph-data.sh)
GRAPH_API="http://localhost:3001/api/graph"

curl -s -X POST "$GRAPH_API/osint/events" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "PLA Eastern Theater Command mobilization detected",
    "description": "Satellite imagery confirms PLA ETC units moving to staging areas opposite Taiwan. 3 amphibious assault ships repositioned from Zhanjiang to Fuzhou.",
    "sourceType": "intelligence",
    "sourceName": "NGA Assessment",
    "publishedAt": "2026-03-01T06:00:00Z",
    "location": {"name": "Fuzhou, Fujian", "latitude": 26.08, "longitude": 119.30, "region": "East Asia", "country": "China"},
    "actors": ["PRC", "Taiwan"],
    "tags": ["military", "mobilization", "pla-etc", "taiwan", "demo-seed"],
    "workspaceId": "'$WKS_ID'"
  }'
```

### Operational Design Seeding
```bash
# Source: backend/src/api/design.ts PATCH endpoints
curl -s -X PATCH "$API/design/$PS_COMPONENT/problem-framing" \
  -H "Content-Type: application/json" \
  -d '{
    "problemStatement": "How does CJTF-WestPac deter PRC aggression against Taiwan while maintaining regional stability and alliance cohesion in the Indo-Pacific?",
    "desiredEndState": "PRC deterred from military action; Taiwan sovereignty preserved; alliance network strengthened; freedom of navigation maintained",
    "limitations": ["ROE constraints on first-strike", "Coalition partner caveats on offensive operations", "Logistics sustainment beyond 30 days"],
    "assumptions": ["Japan provides basing access per treaty obligations", "Australia commits naval assets to SCS patrols", "PRC will not use nuclear weapons first"],
    "status": "complete"
  }'
```

## Data Coverage Map

This maps each required data domain to the API endpoints and fixture needs:

| Domain | API Endpoint(s) | Script | Fixture Count (est.) |
|--------|-----------------|--------|---------------------|
| Problem set hierarchy | POST /api/problem-sets | seed-problem-sets.sh | 7-10 (3 levels, multiple per level) |
| RAFT graph actors | cypher-shell (Neo4j) | seed-graph.sh | 15-25 actors |
| RAFT relationships | cypher-shell (Neo4j) | seed-graph.sh | 25-40 relationships |
| RAFT tensions | cypher-shell (Neo4j) | seed-graph.sh | 6-10 tensions |
| OSINT events | POST /api/graph/osint/events | seed-osint.sh | 20-30 events (3-5 per phase) |
| Documents | POST /api/exercise/scenarios/:id/documents/upload | seed-documents.sh | 8-12 documents |
| Operational design | PATCH /api/design/:psId/:section | seed-design.sh | 4 sections x 2-3 problem sets |
| JPP instances | POST /api/jpp/:psId | seed-jpp.sh | 2-3 instances, 7 steps each |
| AI agent outputs | Direct DB or POST /api/exercise/... | seed-agents.sh | 10-15 pre-computed outputs |
| Decision gates | POST /api/gates | seed-governance.sh | 8-12 gates across tabs |
| Assessment/AARs | POST /api/assessment/* | seed-assessment.sh | 3-5 AARs, 10-15 METL tasks |
| Inheritance artifacts | POST /api/problem-sets/:id/... | seed-inheritance.sh | FRAGOs, status snapshots, overrides |
| Command units | POST /api/command/units | seed-problem-sets.sh | 10-15 units with SIDC codes |

## Scenario Content Mapping

The existing scenario directory provides source material:

| Exercise Phase | Scenario Files Available | Data to Generate |
|----------------|------------------------|------------------|
| Phase 1: Competition | Background readings, country sheets, competition OOB, planning templates | Strategic environment, initial RAFT graph, competition OSINT events |
| Phase 2: Crisis | Crisis situation updates (blue + red), crisis planning template, crisis OOB | Crisis escalation OSINT events, updated tensions, initial COA development |
| Phase 3: Conflict Day 4 | Day 4 preparation docs, conflict templates, Day 4 OOB | Blue/red sitreps, tactical missions spawned, first FRAGO |
| Phase 4: Conflict Day 10 | Day 10 preparation docs, conflict templates, Day 10 OOB | Updated sitreps, assessment data, METL observations |
| Phase 5: Conflict Day 22 | Day 22 preparation docs, BLUE FRAGO, Day 22 OOB | FRAGO propagation demo, campaign assessment, status reports |
| Phase 6: Negotiation | Negotiating instructions, situation overviews, ceasefire terms, news items | Governance gates for ceasefire decisions, final assessment |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic seed script | Modular per-feature scripts with orchestrator | Phase 39 (new) | Enables selective seeding, easier maintenance |
| workspace terminology | problem set terminology | Phase 23 | All API endpoints and seed scripts use "problem-sets" |
| No mode context | Training/operational mode toggle | Phase 22 | Demo data needs mode: "training" on problem sets |
| Flat problem sets | 3-level hierarchy with inheritance | Phases 26/38 | Seed scripts must create parent-child relationships |

## Open Questions

1. **Authentication for seed scripts**
   - What we know: seed-graph-data.sh doesn't use auth tokens, suggesting some routes are unprotected. Problem set creation has requireAuth middleware.
   - What's unclear: Which routes require auth and which don't? Can we create a demo user programmatically?
   - Recommendation: Test each endpoint without auth first. For auth-required routes, either create a seed user via direct SQL INSERT into user_profiles or temporarily bypass auth in dev mode.

2. **Document processing latency**
   - What we know: Document upload triggers async NLP extraction which can take 30-60+ seconds per document.
   - What's unclear: Will seeding 8-12 documents overwhelm the extraction pipeline?
   - Recommendation: Seed documents with pre-computed extraction results rather than waiting for live processing. Use direct DB inserts for the extraction output while uploading the files through the API.

3. **Neo4j ID stability across re-runs**
   - What we know: The existing seed-graph-data.sh uses CREATE (not MERGE), which would create duplicates on re-run.
   - What's unclear: Whether Neo4j uniqueness constraints exist on the id property.
   - Recommendation: Use MERGE instead of CREATE in cypher-shell commands for idempotent behavior. Pattern: `MERGE (a:Actor {id: 'DEMO-ACT-usa'}) SET a.name = 'United States', ...`

4. **Pre-seeded AI outputs -- storage location**
   - What we know: AI agent outputs are stored via the exercise subsystem (staff products, AI runs, etc.)
   - What's unclear: Exact table structure for pre-inserting agent outputs without running the actual LLM.
   - Recommendation: Investigate staff_products and ai_run_logs tables. Seed via the StaffProductStore directly or through the exercise API's staff product endpoints.

## Sources

### Primary (HIGH confidence)
- `scripts/seed-graph-data.sh` -- existing seed script pattern, curl + cypher-shell, full working example
- `backend/src/api/problem-sets.ts` -- CreateProblemSetSchema with echelon, mode, parentProblemSetId
- `backend/src/api/design.ts` -- Operational design CRUD, section-based PATCH
- `backend/src/gates/gate-types.ts` -- GateType, GateTab, GateStatus const objects
- `backend/src/api/assessment-routes.ts` -- AAR, METL, MOE/MOP endpoints
- `backend/src/api/inheritance.ts` -- FRAGO, status snapshots, annotations, RFIs
- `backend/src/api/command.ts` -- Unit creation with MIL-STD-2525D SIDC codes
- `backend/src/api/jpp.ts` -- JPP instance management, entity resolution
- `scenario/` directory -- Full Pacific Strategy AY26 exercise content (6 phases, blue/red teams)

### Secondary (MEDIUM confidence)
- `backend/src/api/exercise.ts` -- Document upload pipeline, AI workspace singletons (complex, many imports)
- `backend/src/api/dao.ts` -- DAO governance API (may need auth context that's hard to simulate in seed scripts)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- directly extends proven seed-graph-data.sh pattern
- Architecture: HIGH -- clear modular structure maps 1:1 to existing API surface
- Pitfalls: HIGH -- identified from direct code inspection of auth middleware, Neo4j patterns, and mode context requirements
- Data coverage: HIGH -- mapped every required domain to specific API endpoints
- Open questions: MEDIUM -- auth bypass and document processing latency need runtime validation

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependencies, all internal codebase patterns)
