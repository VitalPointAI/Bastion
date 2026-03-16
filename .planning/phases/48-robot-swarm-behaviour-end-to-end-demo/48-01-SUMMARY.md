---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "01"
subsystem: testing
tags: [pytest, swarm, coalition-caveats, corroboration, json-ld, prov-o, seed-data, taipei, taiwan-defense]

# Dependency graph
requires:
  - phase: 47-json-ld-semantic-brain-cop-fix
    provides: PROV-O provenance model, confidence scoring, weighted fusion formula
  - phase: 46-swarm-formations-and-coordination
    provides: SwarmState, SwarmTelemetry, formation models, coordinator
  - phase: 44-vision-and-intent
    provides: vision detection pipeline, threat classification

provides:
  - Wave 0 test scaffolds for all Phase 48 testable behaviors (11 tests, all skipped)
  - Taiwan defense strategic directive (OPORD-style) for doc-intelligence ingestion
  - PLA + Russian adversary ORBAT (7 vehicles, lat/lng positions on north Taipei axis)
  - Coalition force composition (TW/US/AU — 3 national profiles, 3 robots, caveat table)
  - Taipei Zhongzheng District calibration profile (5x5m room → ~700m x 700m real geography)

affects:
  - 48-02 (swarm COP bridge — depends on test scaffolds for cop_utils, corroboration contracts)
  - 48-03 (coalition caveat service — test_coalition_caveat.py defines exact API contract)
  - 48-04 (brain graph events — test_swarm_graph.py defines dedup and provenance API)
  - 48-05 (doc-intelligence ingestion — taiwan-defense-directive.txt is the live demo input)
  - all phase 48 plans (calibration profile maps room to real Taipei geography for COP)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 scaffold pattern: all tests marked skip with reason='Wave 0 scaffold — implementation pending', enabling green suite before any implementation exists"
    - "Complementary probability fusion formula: fused = 1 - product((1 - conf*weight) for each detection)"
    - "5-second dedup window for swarm event IDs via floor(timestamp / 5) in ID generation"
    - "PROV-O national provenance: prov:wasAttributedTo = national DID on every brain graph assertion"
    - "Coalition caveat enforcement: mission blocked if ANY member's national profile prohibits it"

key-files:
  created:
    - robot/tests/test_swarm_cop.py
    - robot/tests/test_coalition_caveat.py
    - robot/tests/test_corroboration.py
    - robot/tests/test_swarm_graph.py
    - backend/data/demo-taiwan-seed/taiwan-defense-directive.txt
    - backend/data/demo-taiwan-seed/adversary-orbat.json
    - backend/data/demo-taiwan-seed/coalition-forces.json
    - backend/data/calibration-profiles.json
  modified: []

key-decisions:
  - "VISION_PIPELINE_WEIGHT=0.70 used as source weight in corroboration formula — aligns with Phase 47 confidence scoring constants"
  - "5-second dedup window for swarm event IDs — prevents duplicate graph nodes from near-simultaneous multi-robot reports"
  - "Coalition caveat enforcement blocks entire mission if ANY member is restricted — not just restricts that member"
  - "Taipei Zhongzheng District (25.042-25.048N, 121.512-121.518E) selected as demo operational area — covers Presidential Office Building vicinity"
  - "3 robots mapped to 3 different nations (TW=full, US=restricted, AU=observer) to demonstrate all three caveat levels in one demo"

patterns-established:
  - "Wave 0 scaffold: tests define behavioral contracts before implementation — skip reason documents which plan will implement"
  - "National caveat profiles structured as: nation, did, authority_level, allowed_missions, blocked_missions, blocked_contexts"
  - "Adversary ORBAT format: id, designation, type, nation, estimated_position (lat/lng), echelon, strength, notes"
  - "Coalition forces format: nations array with robots sub-array + swarm_config object"

requirements-completed:
  - DEMO-SEED
  - TAIPEI-COORDS
  - WAVE0-TESTS

# Metrics
duration: 5min
completed: "2026-03-16"
---

# Phase 48 Plan 01: Wave 0 Test Scaffolds and Taiwan Demo Seed Data Summary

**11-test Wave 0 pytest scaffold defining swarm COP, coalition caveat, corroboration, and brain graph behavioral contracts, plus OPORD-style Taiwan defense directive, 7-unit PLA/Russian ORBAT, TW/US/AU coalition forces, and Taipei Zhongzheng District calibration profile**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T15:49:44Z
- **Completed:** 2026-03-16T15:54:55Z
- **Tasks:** 2
- **Files modified:** 8 (all created)

## Accomplishments

- 4 test scaffold files created with 11 tests — all marked skip, suite green (0 errors)
- Taiwan defense scenario seed data complete: strategic directive, adversary ORBAT, coalition forces
- Taipei Zhongzheng District calibration profile maps 5x5m physical demo room to real Taiwan geography
- Test scaffolds define exact API contracts for robot/swarm/cop_utils.py, coalition_caveats.py, corroboration.py, and graph_events.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test scaffolds** - `720ccdc7` (test)
2. **Task 2: Taiwan demo seed data + calibration profile** - `c78d6b48` (feat)

**Plan metadata:** (docs commit — created after tasks)

## Files Created/Modified

- `robot/tests/test_swarm_cop.py` — Polygon hull CCW ordering and FORMATION_STATE_COLORS tests
- `robot/tests/test_coalition_caveat.py` — TW/US/AU national caveat enforcement (4 tests)
- `robot/tests/test_corroboration.py` — Weighted complementary probability fusion (3 tests)
- `robot/tests/test_swarm_graph.py` — 5-second dedup window and PROV-O provenance assertion (2 tests)
- `backend/data/demo-taiwan-seed/taiwan-defense-directive.txt` — OPORD-style directive with situation, mission, 3-phase execution, ROE, caveat table
- `backend/data/demo-taiwan-seed/adversary-orbat.json` — 7 adversary vehicles (2x T-99, 2x ZBD-04, T-90, 2x BTR-82) on north Taipei approach
- `backend/data/demo-taiwan-seed/coalition-forces.json` — TW/US/AU profiles + swarm_config with leader assignment and corroboration threshold
- `backend/data/calibration-profiles.json` — Default profile: 5x5m → Zhongzheng District (Presidential Office Building area)

## Decisions Made

- VISION_PIPELINE_WEIGHT=0.70 matches Phase 47 constants — no new constant introduced
- 5-second dedup window bucket approach: `floor(unix_epoch / 5)` makes implementation deterministic
- Coalition caveat blocks entire mission if ANY member restricted (most restrictive wins) — this is the correct doctrinal behavior for coalition ops
- Taipei Zhongzheng District selected for operational area: covers Presidential Office Building (25.0398N, 121.5124E), Taipei Main Station, and NTU Hospital — all mentioned in directive
- robot-tw-01 / robot-us-01 / robot-au-01 as robot IDs align with simple 3-robot demo naming convention

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All test contracts defined — implementation plans (48-02 through 48-07) can now target specific modules
- Taiwan defense directive is ready for live doc-intelligence ingestion during demo
- Calibration profile wires robot room coordinates to Taipei geography for COP display
- Coalition forces file is the source of truth for national profiles used by caveat enforcement service

---
*Phase: 48-robot-swarm-behaviour-end-to-end-demo*
*Completed: 2026-03-16*
