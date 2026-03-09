---
phase: 39-operational-demonstration-data-package
plan: 01
subsystem: database, scripts
tags: [seed-data, postgresql, bash, problem-sets, military-units, sidc, demo]

requires:
  - phase: 23-problem-set-model
    provides: problem_sets table schema and ProblemSetStore
  - phase: 22-training-operational-mode
    provides: mode column on problem_sets for training/operational filtering

provides:
  - 3-level problem set hierarchy (strategic/operational/tactical) with DEMO-PS- IDs
  - Cleanup script for DEMO- prefixed data (PostgreSQL + Neo4j)
  - Master orchestrator skeleton with --reset/--clean/--verbose/--only flags
  - Shared _helpers.sh with psql/neo4j/logging utilities
  - 13 military command units with MIL-STD-2525D SIDC codes
  - JSON fixture data for problem sets and units
  - Exported PS_* environment variables for downstream seed scripts

affects: [39-02, 39-03, 39-04, 39-05, 39-06]

tech-stack:
  added: []
  patterns:
    - "Direct psql INSERT via docker exec for auth-protected tables"
    - "DEMO- prefix convention for deterministic cleanup-safe IDs"
    - "INSERT ON CONFLICT DO UPDATE for idempotent seed re-runs"
    - "source-based script chaining for env var propagation"

key-files:
  created:
    - scripts/seed-demo.sh
    - scripts/seed-problem-sets.sh
    - scripts/seed-cleanup.sh
    - scripts/seed-command-units.sh
    - scripts/demo-data/_helpers.sh
    - scripts/demo-data/problem-sets/theater-campaign.json
    - scripts/demo-data/problem-sets/component-plans.json
    - scripts/demo-data/problem-sets/tactical-missions.json
    - scripts/demo-data/command/units.json
  modified: []

key-decisions:
  - "Direct psql INSERT instead of API calls for problem sets (API requires auth via near-phantom-auth)"
  - "Direct psql for units too (units table FK requires exercise_scenarios mission_id, so created demo scenario)"
  - "11 total problem sets: 9 training mode + 2 operational mode duplicates for Phase 22 demo"
  - "13 command units spanning INDOPACOM/PACFLT/PACAF through squadron-level designations"

patterns-established:
  - "DEMO- prefix: All seed data uses DEMO- prefixed IDs for safe cleanup isolation"
  - "Fixture-driven: JSON fixture files in scripts/demo-data/ with bash scripts reading them"
  - "Source chaining: seed-demo.sh sources sub-scripts to propagate PS_* env vars"
  - "Idempotent upserts: INSERT ON CONFLICT DO UPDATE enables safe re-runs"

requirements-completed: [DEMO-01, DEMO-09, DEMO-10]

duration: 8min
completed: 2026-03-09
---

# Phase 39 Plan 01: Foundation Seed Scripts Summary

**3-level problem set hierarchy (11 sets), 13 military units with SIDC codes, cleanup script, and master orchestrator with dependency-ordered execution**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-09T02:22:55Z
- **Completed:** 2026-03-09T02:31:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created 11 problem sets across 3 echelons (strategic/operational/tactical) with training and operational mode variants
- Built 13 military command units with real designations (INDOPACOM, PACFLT, 7th Fleet, VFA-102 Diamondbacks, etc.) and MIL-STD-2525D SIDC codes
- Master orchestrator with 4-level dependency execution, --reset/--clean/--verbose/--only flags, health checks, and placeholder slots for all future seed scripts
- Cleanup script safely removes only DEMO- prefixed data from both PostgreSQL and Neo4j

## Task Commits

Each task was committed atomically:

1. **Task 1: Create problem set hierarchy seed script with fixtures** - `d5b218c` (feat)
2. **Task 2: Create cleanup script, command units seed, and master orchestrator** - `a8b4c0e` (feat)

## Files Created/Modified
- `scripts/seed-demo.sh` - Master orchestrator with flags and dependency-ordered execution
- `scripts/seed-problem-sets.sh` - 3-level problem set hierarchy via direct psql upserts
- `scripts/seed-cleanup.sh` - Removes all DEMO- prefixed data from PostgreSQL and Neo4j
- `scripts/seed-command-units.sh` - 13 military units with SIDC codes via psql
- `scripts/demo-data/_helpers.sh` - Shared helpers: psql/neo4j access, logging, JSON parsing
- `scripts/demo-data/problem-sets/theater-campaign.json` - 2 strategic problem sets (training + ops)
- `scripts/demo-data/problem-sets/component-plans.json` - 4 operational problem sets
- `scripts/demo-data/problem-sets/tactical-missions.json` - 5 tactical mission problem sets
- `scripts/demo-data/command/units.json` - 13 military units from INDOPACOM HQ to squadron level

## Decisions Made
- Used direct PostgreSQL INSERT instead of API calls for problem sets because POST /api/problem-sets requires near-phantom-auth session authentication that cannot be easily obtained from a shell script
- Used direct psql for units as well because the units table has a FK to exercise_scenarios (mission_id), so we create a demo exercise scenario as the anchor
- Created 2 operational-mode problem set duplicates (theater + 1 component) per the user decision to demo Phase 22 training/operational mode transition
- Used 15-char MIL-STD-2525D SIDC codes for military symbology accuracy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Units require exercise_scenario FK**
- **Found during:** Task 2 (seed-command-units.sh)
- **Issue:** The units table has `mission_id TEXT NOT NULL REFERENCES exercise_scenarios(id)` -- cannot insert units without a valid exercise scenario
- **Fix:** Created a demo exercise scenario (DEMO-SCENARIO-pacific-strategy) linked to the theater problem set, then used it as the mission_id for all units
- **Files modified:** scripts/seed-command-units.sh
- **Verification:** Script passes bash -n syntax check
- **Committed in:** a8b4c0e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary adaptation for database FK constraints. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Problem set IDs (PS_*) and demo scenario ID exported as env vars for all downstream scripts
- Fixture pattern established for plans 02-06 to follow
- Master orchestrator has placeholder slots for all remaining seed scripts
- Cleanup script ready to reset demo state between runs

---
*Phase: 39-operational-demonstration-data-package*
*Completed: 2026-03-09*
