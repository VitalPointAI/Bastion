---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "03"
subsystem: robot
tags: [coalition, caveat, national-policy, did, swarm, typescript, python]

# Dependency graph
requires:
  - phase: 46-swarm-formation-behaviour
    provides: swarm member DID architecture, SwarmMemberHeartbeat with robot_id fields
  - phase: 47-json-ld-semantic-brain-cop-fix
    provides: DID-based resource provenance model (PROV-O)

provides:
  - Coalition caveat profiles JSON (Taiwan/US/Australia national DID policies)
  - TypeScript checkSwarmCaveat — swarm-level policy enforcement before dispatch
  - Python check_swarm_caveat — robot-agent pre-flight validation
  - suggestAlternativeAsset / suggest_alternative_asset — alternative robot suggestion

affects:
  - 48-04 (DAO authorization gateway uses caveat results to block/allow mission dispatch)
  - robot pre-flight validation chain
  - COP coalition status dashboard (per-robot caveat status badges)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Restrictions-first evaluation: check specific restriction entries before allowed_missions fallback"
    - "Swarm-level blocking: ANY member blocked = entire mission blocked (coalition constraint propagation)"
    - "Wildcard restriction with except list: mission_type='*' with except array for observer-status nations"
    - "Module-level profile cache: load once at startup, reuse across calls"

key-files:
  created:
    - backend/data/coalition-profiles.json
    - backend/src/robot/coalition-caveat-service.ts
    - backend/src/robot/coalition-caveat-service.test.ts
    - robot/coalition_caveat.py
    - robot/tests/test_coalition_caveat.py
  modified: []

key-decisions:
  - "Restrictions checked before allowed_missions: ensures specific restriction reasons surface over generic 'not in allowed_missions' message"
  - "US swarm_advance added to allowed_missions (area-specific restriction handles urban block): a mission with only area-specific restrictions is broadly allowed"
  - "Wave 0 scaffold test file rewritten entirely: old API signatures (context param, blocked_robots as string array) replaced with new schema"

patterns-established:
  - "Coalition caveat check pattern: for each swarm member, find profile by DID, walk restrictions, fallback to allowed_missions"
  - "TypeScript and Python implementations mirror each other for cross-stack consistency"

requirements-completed:
  - COALITION-CAVEATS
  - CAVEAT-ENFORCEMENT

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 48 Plan 03: Coalition Caveat Enforcement Summary

**Coalition caveat system enforces national DID policies at swarm level — Taiwan (full authority), US (no urban offensive, no find_engage), Australia (recon only) — with matching TypeScript and Python implementations and 22 passing tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-16T15:50:25Z
- **Completed:** 2026-03-16T15:57:00Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- Coalition profiles JSON with three national caveat profiles keyed by DID
- TypeScript `checkSwarmCaveat` enforces swarm-level policy — blocks mission if ANY member's national DID forbids the mission type
- Python `check_swarm_caveat` mirrors TypeScript logic for robot agent pre-flight validation on Jetson
- `suggestAlternativeAsset` / `suggest_alternative_asset` return a viable replacement robot or null
- 9 TypeScript (vitest) + 13 Python (pytest) tests all passing; TypeScript compiles cleanly

## Task Commits

1. **TDD RED — failing test scaffold** - `b61acbd3` (test)
2. **Task 1: coalition profiles JSON + TypeScript caveat service** - `fef0519a` (feat)
3. **Task 2: Python coalition caveat checker and tests** - `979cc913` (feat)

## Files Created/Modified

- `backend/data/coalition-profiles.json` — Three national profiles: tw-defense (full), us-coalition (restricted urban), au-observer (recon only)
- `backend/src/robot/coalition-caveat-service.ts` — exports `checkSwarmCaveat`, `loadCoalitionProfiles`, `suggestAlternativeAsset`, `CaveatCheckResult`, `CoalitionProfile`
- `backend/src/robot/coalition-caveat-service.test.ts` — 9 vitest behavioral tests
- `robot/coalition_caveat.py` — Python port of caveat service for robot agent pre-flight
- `robot/tests/test_coalition_caveat.py` — 13 pytest tests (rewritten from Wave 0 scaffold)

## Decisions Made

- **Restrictions-first evaluation order:** Specific restriction entries are walked BEFORE checking `allowed_missions`. This ensures US urban advance returns "US national policy: no offensive urban ops" rather than a generic "not in allowed_missions" message. Restriction reason quality matters for the DAO dashboard display.

- **US `swarm_advance` added to `allowed_missions`:** The restriction is area-specific (urban only). Adding it to `allowed_missions` with a restriction rather than omitting it entirely allows rural `swarm_advance` to pass. This matches the behavioral spec.

- **Wave 0 test scaffold fully replaced:** The existing `test_coalition_caveat.py` used a different API signature (`context` parameter, `blocked_robots` as string IDs) and imported from `robot.swarm.coalition_caveats` (a path that doesn't exist). Rewriting the whole file was cleaner than patching incompatible scaffolding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restriction evaluation order fixed to surface specific reasons**
- **Found during:** Task 1 GREEN phase (test run)
- **Issue:** Initial implementation checked `allowed_missions` first — US `swarm_advance` was not in the list, so it returned a generic message instead of the restriction reason "US national policy: no offensive urban ops"
- **Fix:** Reversed evaluation order — restrictions walked first, `allowed_missions` is the fallback. US `swarm_advance` added to `allowed_missions` with urban area restriction.
- **Files modified:** `backend/data/coalition-profiles.json`, `backend/src/robot/coalition-caveat-service.ts`, `backend/src/robot/coalition-caveat-service.test.ts`
- **Verification:** All 9 TypeScript tests pass, including `allows US swarm_advance in rural`
- **Committed in:** fef0519a (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — logic order bug)
**Impact on plan:** Fix required for correct reason strings in blocked mission responses. No scope creep.

## Issues Encountered

- Node.js system version (v12) incompatible with pnpm — used nvm v20 for all TypeScript operations. Standard project practice per MEMORY.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Coalition caveat service ready for integration in plan 48-04 (DAO authorization gateway)
- `checkSwarmCaveat` returns `CaveatCheckResult` with `blockedRobots` array — DAO gateway can surface specific DID caveat details on block
- `suggestAlternativeAsset` ready for pre-flight dashboard to show reassignment suggestion
- Python module ready for import in `pre_flight.py` robot validation chain

---
*Phase: 48-robot-swarm-behaviour-end-to-end-demo*
*Completed: 2026-03-16*

## Self-Check: PASSED

All 7 artifacts verified:
- FOUND: backend/data/coalition-profiles.json
- FOUND: backend/src/robot/coalition-caveat-service.ts
- FOUND: robot/coalition_caveat.py
- FOUND: robot/tests/test_coalition_caveat.py
- FOUND: b61acbd3 (test RED)
- FOUND: fef0519a (feat GREEN TypeScript)
- FOUND: 979cc913 (feat Python)
