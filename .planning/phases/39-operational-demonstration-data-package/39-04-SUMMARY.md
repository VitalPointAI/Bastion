---
phase: 39-operational-demonstration-data-package
plan: 04
subsystem: database, scripts
tags: [seed-data, jpp, jp5-0, ai-agents, staff-products, demo, military-planning]

requires:
  - phase: 39-operational-demonstration-data-package
    plan: 01
    provides: problem set IDs (PS_CJTF, PS_THEATER), _helpers.sh, fixture pattern, DEMO- prefix convention
  - phase: 39-operational-demonstration-data-package
    plan: 02
    provides: RAFT graph actors referenced by agent outputs

provides:
  - JPP instance (DEMO-JPP-cjtf-westpac) with 7-step statuses at operational echelon
  - 9 JPP step products across steps 1-4 with doctrinal content (planning initiation, mission analysis, COA development, COA analysis)
  - 9 pre-computed AI agent analysis outputs across 4 agent roles
  - seed-jpp.sh for JPP instance and step product creation via psql
  - seed-agents.sh for AI agent output seeding via staff_products table
  - JSON fixture files for JPP and agent data

affects: [39-05, 39-06]

tech-stack:
  added: []
  patterns:
    - "JPP step products seeded via direct psql INSERT into jpp_step_products table"
    - "AI agent outputs stored as staff_products with agent role mapping to staff role keys"
    - "Agent metadata stored in structured JSONB field (model, confidence, sources)"

key-files:
  created:
    - scripts/seed-jpp.sh
    - scripts/seed-agents.sh
    - scripts/demo-data/jpp/cjtf-jpp-instance.json
    - scripts/demo-data/jpp/jpp-step-products.json
    - scripts/demo-data/agents/strategic-fusion-outputs.json
    - scripts/demo-data/agents/adversary-modeling-outputs.json
    - scripts/demo-data/agents/escalation-modeling-outputs.json
    - scripts/demo-data/agents/assumption-audit-outputs.json
  modified: []

key-decisions:
  - "Direct psql INSERT for JPP data (consistent with 39-01 pattern — API requires near-phantom-auth)"
  - "AI agent outputs stored as staff_products (leverages existing table/UI rather than new storage)"
  - "9 step products covering steps 1-4, steps 5-7 left pending for demo progression narrative"
  - "Agent role to staff role mapping: strategic-fusion/adversary-modeling -> j2, escalation/assumption -> j5_plans"

patterns-established:
  - "JPP seed via psql: direct INSERT into jpp_instances and jpp_step_products with ON CONFLICT upsert"
  - "Agent output as staff product: agent analysis seeded into staff_products table with agent_team_id tracking source agent"
  - "Role mapping: associative arrays mapping agent roles to staff role keys and product types"

requirements-completed: [DEMO-04, DEMO-05]

duration: 9min
completed: 2026-03-09
---

# Phase 39 Plan 04: JPP Instance & AI Agent Outputs Summary

**7-step JPP instance for CJTF-WestPac at COA Analysis with 9 step products, plus 9 pre-seeded AI agent outputs across strategic fusion, adversary modeling, escalation modeling, and assumption auditing**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-09T02:40:52Z
- **Completed:** 2026-03-09T02:49:52Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- JPP instance at step 4 (COA Analysis/Wargaming) with steps 1-3 complete and 5-7 pending, demonstrating mid-planning workflow
- 9 step products with detailed doctrinal content: initiating directive, mission statement, task analysis, facts/assumptions, risk matrix, 3 COAs (maritime blockade, distributed ops, air-maritime defense), and wargaming results
- 9 AI agent outputs with polished military analysis: cross-document strategic synthesis, PLA ETC capability assessment, PRC strategic calculus, adversary COAs (most likely/dangerous/unusual), escalation ladder, effect cascades, assumption validation, and freshness monitoring
- All content is walkthrough-quality with realistic military terminology, cross-references between products, and confidence scoring

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JPP instance with 7-step products for CJTF-WestPac** - `78ee34f` (feat)
2. **Task 2: Create pre-seeded AI agent analysis output fixtures and seed script** - `85324d1` (feat)

## Files Created/Modified
- `scripts/seed-jpp.sh` - JPP instance and step product creation via psql with table creation and upsert
- `scripts/seed-agents.sh` - AI agent output seeding via staff_products table with role mapping
- `scripts/demo-data/jpp/cjtf-jpp-instance.json` - JPP instance fixture for CJTF-WestPac operational problem set
- `scripts/demo-data/jpp/jpp-step-products.json` - 9 step products across JP 5-0 steps 1-4
- `scripts/demo-data/agents/strategic-fusion-outputs.json` - 2 strategic fusion outputs (objective synthesis, change detection)
- `scripts/demo-data/agents/adversary-modeling-outputs.json` - 3 adversary modeling outputs (capability, calculus, COAs)
- `scripts/demo-data/agents/escalation-modeling-outputs.json` - 2 escalation outputs (ladder analysis, effect cascades)
- `scripts/demo-data/agents/assumption-audit-outputs.json` - 2 assumption audit outputs (validation, freshness monitor)

## Decisions Made
- Used direct PostgreSQL INSERT (consistent with 39-01 pattern) rather than JPP API endpoints because API requires near-phantom-auth session
- Stored AI agent outputs as staff_products rather than creating a new table, since staff_products already has the right schema (scenario_id, role_key, product_type, content, agent_team_id) and the UI already renders them
- Mapped agent roles to staff role keys: strategic-fusion and adversary-modeling to j2 (intelligence), escalation-modeling and assumption-auditing to j5_plans (planning)
- Created 9 step products (more than minimum 7 from plan) to provide richer content for each completed step
- Left steps 5-7 empty to demonstrate mid-planning state and allow demo progression narrative

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- JPP_ID exported for downstream scripts that may reference JPP instance
- Step products reference real entities (units, actors, problem sets) from 39-01 and 39-02 seeds
- AI agent outputs cross-reference JPP products (assumption audit references Step 2 assumptions)
- All data uses DEMO- prefix for cleanup compatibility with seed-cleanup.sh

---
*Phase: 39-operational-demonstration-data-package*
*Completed: 2026-03-09*
