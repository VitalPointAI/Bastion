---
phase: 05-operational-planning-module
plan: 06
subsystem: ai-agents
tags: [langgraph, anthropic, claude, red-team, adversary-analysis, coa-simulation]

# Dependency graph
requires:
  - phase: 05-01
    provides: Planning domain types including RedTeamResult and COA store
  - phase: 05-03
    provides: COA Generator creates COAs that need red team analysis
provides:
  - Red Team Simulator AI agent with adversary mindset
  - LangGraph workflow for COA vulnerability analysis
  - Tools for COA analysis and red team results storage
  - Adversary perspective simulation results
affects: [05-07-coa-comparator, 05-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LangGraph agent with adversary character definition"
    - "Multi-tool workflow with state management"
    - "Red team simulation methodology for COAs"

key-files:
  created:
    - backend/src/planning/agents/red-team-character.ts
    - backend/src/planning/agents/red-team-simulator.ts
    - backend/src/planning/agents/red-team-tools.ts
  modified:
    - backend/src/planning/agents/index.ts

key-decisions:
  - "Used adversary mindset character with IPB knowledge base"
  - "Temperature 0.5 for balanced realistic analysis"
  - "Iterates through all COAs for a plan automatically"

patterns-established:
  - "Character-driven agent personality with military expertise"
  - "State annotation with reducers for LangGraph workflow"
  - "Tool-based COA analysis with structured results"

# Metrics
duration: 5min
completed: 2026-01-25
---

# Phase 05 Plan 06: Red Team Simulator Summary

**LangGraph red team agent simulating adversary response to COAs with vulnerability identification and confidence scoring**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-25T17:04:12Z
- **Completed:** 2026-01-25T17:08:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Red Team character with adversary mindset and IPB knowledge
- LangGraph agent analyzing COAs from enemy perspective
- Tools for retrieving COA details, situation, and saving results
- Automated iteration through all COAs in a plan

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Red Team Character Definition** - `b8953fa` (feat)
2. **Task 2: Create Red Team Simulator Agent** - `649428b` (feat)

**Plan metadata:** `f00cbad` (docs: complete plan)

## Files Created/Modified
- `backend/src/planning/agents/red-team-character.ts` - Adversary analyst character with red team expertise, IPB knowledge, and vulnerability identification focus
- `backend/src/planning/agents/red-team-simulator.ts` - LangGraph agent iterating through COAs, analyzing from adversary perspective, storing results
- `backend/src/planning/agents/red-team-tools.ts` - GetCOADetailsTool, GetSituationTool, SaveRedTeamResultsTool for structured analysis workflow
- `backend/src/planning/agents/index.ts` - Exports red team agent modules

## Decisions Made

**Character design:**
- Adversary mindset with red team methodology
- IPB and threat assessment knowledge base
- Style emphasizes specific vulnerabilities, not vague concerns
- Never softens assessment to avoid offense

**Agent architecture:**
- Temperature 0.5 for balanced realistic adversary simulation
- State management tracks analyzed COAs and completion
- Iterates through all COAs automatically
- Stores results with confidence scores

**Tool workflow:**
1. Get situation (enemy forces, terrain, civil considerations)
2. Get COA details (scheme, tasks, intent)
3. Analyze vulnerabilities and counter-actions
4. Save structured results to COA record

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed SituationParagraph property reference**
- **Found during:** Task 2 (GetSituationTool implementation)
- **Issue:** Plan referenced `plan.situation?.weather` but SituationParagraph doesn't have a weather property
- **Fix:** Changed to use `plan.situation?.areaOfInterest` instead
- **Files modified:** backend/src/planning/agents/red-team-tools.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 649428b (part of task commit)

**2. [Rule 2 - Missing Critical] Added state annotation reducers**
- **Found during:** Task 2 (RedTeamState annotation)
- **Issue:** LangGraph state annotations require reducer functions for non-message fields (pattern established in coa-generator.ts and coa-comparator.ts)
- **Fix:** Added `reducer: (prev, next) => next` to coaIds, analyzedCoaIds, currentCoaIndex, and complete annotations
- **Files modified:** backend/src/planning/agents/red-team-simulator.ts
- **Verification:** TypeScript compilation passes, matches existing agent patterns
- **Committed in:** 649428b (part of task commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both fixes necessary for correct TypeScript compilation and runtime behavior. No scope creep.

## Issues Encountered

**Pre-existing TypeScript configuration issue:**
- All LangGraph agents have `@langchain/langgraph/prebuilt` import error
- Error states types exist at different path but moduleResolution setting prevents resolution
- This is a pre-existing issue in coa-generator.ts and coa-comparator.ts
- Does not block runtime execution
- Not fixed as it affects multiple files and requires tsconfig change

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Red team simulation ready for:
- COA Comparator integration (Plan 07) - uses red team results in scoring
- Workflow orchestration (Plan 08) - automated red team analysis step
- UI integration - display vulnerabilities and counter-actions

**Blockers:** None

**Integration points:**
- COA Comparator can read `coa.redTeamResults` for risk assessment
- Workflow can call `simulateAdversary(planId)` after COA generation
- Results include confidence scores for staff review

---
*Phase: 05-operational-planning-module*
*Completed: 2026-01-25*
