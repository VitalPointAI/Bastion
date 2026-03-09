---
phase: 39-operational-demonstration-data-package
plan: 02
subsystem: database, scripts, neo4j
tags: [seed-data, neo4j, raft-graph, osint, actors, relationships, tensions, cypher, demo]

requires:
  - phase: 39-operational-demonstration-data-package
    plan: 01
    provides: problem set IDs (PS_THEATER), _helpers.sh, fixture pattern, DEMO- prefix convention

provides:
  - 17-actor Indo-Pacific RAFT graph network with DEMO-ACT- IDs in Neo4j
  - 27 geopolitical relationships (alliances, rivalries, disputes, partnerships)
  - 8 tensions with intensity scores across military/economic/information domains
  - 29 OSINT events across all 6 exercise phases with DIME domain coverage
  - seed-graph.sh for Neo4j actor network creation via MERGE (idempotent)
  - seed-osint.sh for OSINT event creation via graph API
  - JSON fixture files for graph actors, relationships, tensions, and OSINT events

affects: [39-03, 39-04, 39-05, 39-06]

tech-stack:
  added: []
  patterns:
    - "MERGE-based Neo4j seeding for idempotent actor/relationship/tension creation"
    - "JSON fixture files with parse_json_array iteration for data-driven seeding"
    - "Graph workspace creation via API with fallback to deterministic ID"
    - "OSINT events organized by exercise phase in separate fixture files"

key-files:
  created:
    - scripts/seed-graph.sh
    - scripts/seed-osint.sh
    - scripts/demo-data/graph/actors.json
    - scripts/demo-data/graph/relationships.json
    - scripts/demo-data/graph/tensions.json
    - scripts/demo-data/osint/events-competition.json
    - scripts/demo-data/osint/events-crisis.json
    - scripts/demo-data/osint/events-conflict.json
    - scripts/demo-data/osint/events-negotiation.json
  modified: []

key-decisions:
  - "17 actors (10 nations, 4 organizations, 2 military commands, 1 economic entity) for comprehensive Indo-Pacific coverage"
  - "27 relationships with typed edges (ALLIANCE, COMPETES_WITH, CLAIMS_SOVEREIGNTY, SUBORDINATE_TO, etc.) and strength scores"
  - "8 tensions spanning military/economic/information domains with intensity 4-8 scale"
  - "29 OSINT events split across 4 fixture files by phase grouping (competition, crisis, conflict days 4-22, negotiation)"
  - "Conflict phases combined into single fixture file since they form a continuous operational narrative"

patterns-established:
  - "MERGE-based Neo4j seeding: all graph data uses MERGE ON CREATE SET / ON MATCH SET for safe re-runs"
  - "Phase-organized OSINT fixtures: events-{phase}.json naming convention"
  - "DIME domain tagging: each event tagged with D/I/M/E domain for cross-domain analysis"
  - "Actor cross-referencing: OSINT events reference DEMO-ACT- IDs from graph actors"

requirements-completed: [DEMO-02]

duration: 6min
completed: 2026-03-09
---

# Phase 39 Plan 02: RAFT Graph & OSINT Events Summary

**17-actor Indo-Pacific RAFT graph with 27 relationships and 8 tensions in Neo4j, plus 29 OSINT events across all 6 exercise phases covering DIME domains**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T02:31:30Z
- **Completed:** 2026-03-09T02:37:38Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Built comprehensive 17-actor Indo-Pacific geopolitical network covering US, China, Taiwan, Japan, Philippines, Australia, South Korea, India, Russia, North Korea, ASEAN, QUAD, AUKUS, PLA ETC, US 7th Fleet, BRI, and TSMC
- Created 27 typed relationships with strength scores spanning alliances, sovereignty claims, strategic partnerships, disputes, economic ties, and command hierarchies
- Defined 8 tensions with intensity scores (4-8/10) across military, economic, and information domains
- Authored 29 OSINT events telling a coherent escalation narrative from Competition through Negotiation with full DIME domain coverage

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RAFT graph actors, relationships, and tensions via Neo4j** - `3e06cba` (feat)
2. **Task 2: Create OSINT events across all 6 exercise phases** - `9c4ac97` (feat)

## Files Created/Modified
- `scripts/seed-graph.sh` - Neo4j actor network creation via MERGE with cypher-shell
- `scripts/seed-osint.sh` - OSINT event creation via graph API POST
- `scripts/demo-data/graph/actors.json` - 17 actors (nations, orgs, military, economic)
- `scripts/demo-data/graph/relationships.json` - 27 relationships with types and strength scores
- `scripts/demo-data/graph/tensions.json` - 8 tensions with intensity and trigger/mitigator analysis
- `scripts/demo-data/osint/events-competition.json` - 5 Phase 1 events (D-I-M-M-E)
- `scripts/demo-data/osint/events-crisis.json` - 5 Phase 2 events (D-M-M-I-E)
- `scripts/demo-data/osint/events-conflict.json` - 15 Phases 3-5 events (Days 4/10/22)
- `scripts/demo-data/osint/events-negotiation.json` - 4 Phase 6 events (D-D-E-D)

## Decisions Made
- Used 17 actors (exceeding minimum 15) to ensure comprehensive Indo-Pacific coverage including sub-actors like PLA ETC, US 7th Fleet, and economic entities (BRI, TSMC)
- Combined Conflict Day 4, Day 10, and Day 22 events into a single fixture file since they form a continuous operational narrative (15 events vs 3 separate 5-event files)
- Included SUBORDINATE_TO relationships for military sub-actors and LOCATED_IN for TSMC to enable hierarchical graph queries
- Each OSINT event includes lat/lon geolocation for map visualization, actor references matching graph actor IDs, and DIME domain tags

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Graph actors and OSINT events ready for visualization in Understand tab
- WKS_ID exported for downstream scripts (seed-osint.sh consumes it)
- Actor IDs (DEMO-ACT-*) available for reference by scenario seed scripts (39-03)
- Event IDs (DEMO-EVT-*) tagged with demo-seed for cleanup script compatibility

---
*Phase: 39-operational-demonstration-data-package*
*Completed: 2026-03-09*
