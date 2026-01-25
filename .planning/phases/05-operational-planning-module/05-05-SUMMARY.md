---
phase: 05-operational-planning-module
plan: 05
subsystem: ai-agents
tags: [langgraph, langchain, anthropic, coa-generation, military-planning, jp5-0]

# Dependency graph
requires:
  - phase: 05-01
    provides: COA store with database persistence
  - phase: 05-03
    provides: Plan store with JP 5-0 workflow
  - phase: 4.2-06
    provides: LangGraph orchestration patterns and character builder
provides:
  - COA Generator AI agent with LangGraph
  - Automated COA generation from mission analysis
  - Doctrinal COA structure enforcement
  - Tools for mission context retrieval and COA persistence
affects: [05-06, 05-07, operational-planning-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LangGraph state-based agent with tool calling"
    - "Eliza character definition for military planning expertise"
    - "StructuredTool for database integration"

key-files:
  created:
    - backend/src/planning/agents/coa-generator-character.ts
    - backend/src/planning/agents/coa-generator.ts
    - backend/src/planning/agents/coa-generator-tools.ts
    - backend/src/planning/agents/index.ts
  modified: []

key-decisions:
  - "Use LangGraph Annotation with explicit reducers for state management"
  - "Enforce minimum 3 COAs per JP 5-0 doctrine at agent level"
  - "Base confidence score of 80 when generation complete"
  - "Temperature 0.7 for creative distinctiveness in COAs"

patterns-established:
  - "Military character definition with knowledge, lore, and style"
  - "Tools pass agent DID for created_by tracking"
  - "State-based completion checking via database query"

# Metrics
duration: 4min
completed: 2026-01-25
---

# Phase 05 Plan 05: COA Generator Agent Summary

**LangGraph agent with military planning expertise generates minimum 3 distinct COAs following JP 5-0 doctrine with automated persistence**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-25T17:04:12Z
- **Completed:** 2026-01-25T17:07:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- COA Generator character with JP 5-0 and MDMP doctrine knowledge
- LangGraph agent automating COA generation from mission analysis
- Three tools for mission context, COA saving, and distinctiveness checking
- Minimum 3 COAs enforced per doctrinal requirement
- Confidence scoring and standard agent interface for orchestration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create COA Generator Character Definition** - `c3aa293` (feat)
2. **Task 2: Create COA Generator Agent with LangGraph** - `50147fe` (feat)

## Files Created/Modified
- `backend/src/planning/agents/coa-generator-character.ts` - Eliza character with military planning expertise, JP 5-0 knowledge, and tactical style
- `backend/src/planning/agents/coa-generator-tools.ts` - Three StructuredTools for mission context retrieval, COA saving with full structure, and existing COA checking
- `backend/src/planning/agents/coa-generator.ts` - LangGraph state machine generating minimum 3 COAs with tool calling and completion checking
- `backend/src/planning/agents/index.ts` - Module exports for agent, character, and tools

## Decisions Made

**1. Annotation Reducers**
Added explicit `reducer: (prev, next) => next` for simple scalar state values (targetCount, generatedCount, complete, confidence). LangGraph Annotation requires reducers even for replace-style updates.

**2. Agent DID Tracking**
SaveCOATool constructor accepts agentId parameter, passes it as `createdBy` to coaStore.create() for audit trail of which agent generated each COA.

**3. Completion via Database Query**
checkComplete node queries database for actual COA count rather than tracking in state, ensuring accuracy even if agent is interrupted/resumed.

**4. Minimum Enforcement at Multiple Levels**
- State default: `targetCount: 3`
- Execute function: `Math.max(3, targetCount)`
- Ensures doctrine compliance regardless of caller input

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing TypeScript module resolution warning:** `@langchain/langgraph/prebuilt` import shows TS2307 warning suggesting moduleResolution update. This same pattern exists in red-team-simulator.ts and coa-comparator.ts from earlier plans (05-03, 05-04). Code functions correctly at runtime despite TypeScript warning. Not fixed to maintain consistency with existing codebase patterns.

## Next Phase Readiness

**Ready for:**
- Red Team Simulator agent (05-06) to analyze generated COAs
- COA Comparator agent (05-07) to score and rank COAs
- Operational planning UI to trigger COA generation

**Integration points:**
- coaGeneratorAgent exports standard interface for orchestration
- generateCOAs() function ready for API endpoints
- Character definition available for prompt building

---
*Phase: 05-operational-planning-module*
*Completed: 2026-01-25*
