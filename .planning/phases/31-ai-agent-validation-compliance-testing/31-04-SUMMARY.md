---
phase: 31-ai-agent-validation-compliance-testing
plan: 04
subsystem: testing
tags: [zod, validation, fixtures, golden-prompts, adversarial-testing, doctrinal-compliance]

requires:
  - phase: 31-01
    provides: "validation-types.ts with TestFixture, TestScenario, AdversarialScenario interfaces"
provides:
  - "Fixture loader with zod runtime validation (loadAllFixtures, loadFixture, validateFixtureCompleteness)"
  - "Fixture generator for baseline fixture creation from agent-library.ts definitions"
  - "10 hand-crafted golden prompt fixture files for high-priority roles"
  - "Doctrine mapping (DOCTRINE_MAP) for all 31 role keys"
affects: [31-04b, 31-05, 31-06, 31-07]

tech-stack:
  added: [zod-schema-validation-for-fixtures]
  patterns: [fixture-json-files-per-role, zod-parse-at-load-time, doctrine-mapping-constant]

key-files:
  created:
    - backend/src/validation/fixture-loader.ts
    - backend/src/validation/fixture-generator.ts
    - backend/src/validation/fixtures/commander.json
    - backend/src/validation/fixtures/j2.json
    - backend/src/validation/fixtures/j3.json
    - backend/src/validation/fixtures/j5.json
    - backend/src/validation/fixtures/cos.json
    - backend/src/validation/fixtures/fires.json
    - backend/src/validation/fixtures/sja.json
    - backend/src/validation/fixtures/j1.json
    - backend/src/validation/fixtures/j35.json
    - backend/src/validation/fixtures/j4.json
  modified: []

key-decisions:
  - "Used zod v4 two-arg z.record(z.string(), z.unknown()) for metadata schemas to match project patterns"
  - "Fixture loader skips invalid files with warnings rather than throwing, enabling partial test runs"
  - "validateFixtureCompleteness checks all three validation categories (determinism, reliability, authority) are covered"

patterns-established:
  - "Fixture JSON per role: one file per roleKey in backend/src/validation/fixtures/"
  - "Zod parse at load time: FixtureSchema.parse() validates every fixture before use"
  - "DOCTRINE_MAP constant: roleKey to primary doctrine publication mapping for all 31 roles"

requirements-completed: []

duration: 9min
completed: 2026-03-07
---

# Phase 31 Plan 04: Test Fixtures & Golden Prompts Summary

**Zod-validated fixture loader, baseline fixture generator with doctrine mapping, and 10 hand-crafted golden prompt fixtures covering commander/J2/J3/J5/COS/fires/SJA/J1/J35/J4 roles**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-07T14:55:16Z
- **Completed:** 2026-03-07T15:04:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Fixture loader validates JSON fixtures against zod schema at load time, gracefully skips invalid files
- Fixture generator creates role-appropriate baseline fixtures from agent-library.ts definitions with doctrine-to-role mapping for all 31 roles
- 10 hand-crafted fixture files with 42 golden prompt scenarios and 25 adversarial scenarios across high-priority roles
- High-stakes roles (commander, sja, fires, j2, j3) have runCount=5 for determinism testing; others have runCount=3
- Each fixture covers all three validation categories (determinism, reliability, authority) with Pacific Strategy AY26 scenario context

## Task Commits

Each task was committed atomically:

1. **Task 1: Create fixture loader and fixture generator** - `5b34c85` (feat)
2. **Task 2: Create hand-crafted fixtures for 10 high-priority roles** - `6ee25cb` (feat)

## Files Created/Modified
- `backend/src/validation/fixture-loader.ts` - Zod-validated fixture loading with loadAllFixtures, loadFixture, validateFixtureCompleteness
- `backend/src/validation/fixture-generator.ts` - Baseline fixture generation from agent-library.ts with DOCTRINE_MAP and role-appropriate scoring
- `backend/src/validation/fixtures/commander.json` - 5 scenarios, 3 adversarial (intent, mission analysis, decision points, ROE)
- `backend/src/validation/fixtures/j2.json` - 5 scenarios, 3 adversarial (IPB, threat analysis, intel estimate)
- `backend/src/validation/fixtures/j3.json` - 5 scenarios, 3 adversarial (OPORD, synch matrix, ops assessment)
- `backend/src/validation/fixtures/j5.json` - 4 scenarios, 2 adversarial (strategic estimate, COA development)
- `backend/src/validation/fixtures/cos.json` - 4 scenarios, 2 adversarial (staff coordination, battle rhythm)
- `backend/src/validation/fixtures/fires.json` - 5 scenarios, 3 adversarial (fire support plan, targeting)
- `backend/src/validation/fixtures/sja.json` - 5 scenarios, 3 adversarial (ROE review, targeting legality, LOAC)
- `backend/src/validation/fixtures/j1.json` - 3 scenarios, 2 adversarial (personnel status, casualty reporting)
- `backend/src/validation/fixtures/j35.json` - 4 scenarios, 2 adversarial (future plans, branch/sequel)
- `backend/src/validation/fixtures/j4.json` - 4 scenarios, 2 adversarial (logistics estimate, supply chain)

## Decisions Made
- Used zod v4 two-arg `z.record(z.string(), z.unknown())` syntax for metadata/context schemas (project convention)
- Fixture loader skips invalid files with console.warn rather than throwing, enabling partial test runs when some fixtures are malformed
- validateFixtureCompleteness enforces all three validation categories (determinism, reliability, authority) are covered beyond schema validation
- Scoring methods assigned by role type: semantic_similarity for free-text roles (commander, sja, cos), structured_diff for structured output roles (j2), both for mixed roles

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zod v4 z.record() API**
- **Found during:** Task 1 (fixture loader)
- **Issue:** `z.record(z.unknown())` requires 2 arguments in zod v4 (key schema + value schema)
- **Fix:** Changed to `z.record(z.string(), z.unknown())` matching project patterns
- **Files modified:** backend/src/validation/fixture-loader.ts
- **Verification:** tsc --noEmit passes with no errors in fixture files
- **Committed in:** 5b34c85 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor API compatibility fix. No scope creep.

## Issues Encountered
- System node.js v12 incompatible with installed TypeScript (requires v14+). Used nvm to switch to v20.19.4 for type checking. Pre-existing environment issue, not caused by this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04b can use generateAllMissingFixtures() to create baseline fixtures for remaining 21 roles
- Plans 05-07 can use loadAllFixtures() to load fixtures for test execution
- FixtureSchema exported for any external validation needs

---
*Phase: 31-ai-agent-validation-compliance-testing*
*Completed: 2026-03-07*

## Self-Check: PASSED

- All 12 created files verified present on disk
- Both task commits (5b34c85, 6ee25cb) verified in git log
- 10/10 fixture files parse as valid JSON with required scenario counts
