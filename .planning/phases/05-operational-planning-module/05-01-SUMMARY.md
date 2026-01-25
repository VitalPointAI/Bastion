---
phase: 05-operational-planning-module
plan: 01
subsystem: database
tags: [operational-planning, jp-5-0, postgresql, zod, json-rules-engine, yjs]

# Dependency graph
requires:
  - phase: 04-strategic-planning
    provides: Strategic objectives for operational plan linkage
  - phase: 4.4-mission-context-force-onboarding
    provides: Mission workspace and participant context
provides:
  - Operational plan data models following JP 5-0 Joint Planning Process
  - COA (Course of Action) storage with Red Team and comparison scoring
  - ROE (Rules of Engagement) with json-rules-engine compatibility
  - Plan version history with Yjs snapshot support
  - Database stores with singleton pattern and lazy initialization
affects: [05-operational-planning-module, agent-workflows, mission-execution]

# Tech tracking
tech-stack:
  added: [json-rules-engine]
  patterns: [jp-5-0-workflow, 5-paragraph-order, singleton-stores, uuid-prefixes]

key-files:
  created:
    - backend/src/planning/types.ts
    - backend/src/planning/schemas.ts
    - backend/src/planning/stores/plan-store.ts
    - backend/src/planning/stores/coa-store.ts
    - backend/src/planning/stores/version-store.ts
    - backend/src/planning/stores/roe-store.ts
    - backend/src/planning/index.ts
  modified:
    - backend/package.json

key-decisions:
  - "JP 5-0 workflow modeled as 8 sequential steps with status tracking per step"
  - "COA minimum of 3 enforced via validateMinimumCOAs() method, not database constraint"
  - "ROE override justification validated at store layer (non-empty, non-whitespace)"
  - "UUID prefixes for entity identification: OPLAN-, COA-, VER-, ROE-, OVR-"
  - "Zod record() requires two type parameters in v4.x: record(string, T) not record(T)"
  - "Commander approval tracked separately for COA and plan with DID and timestamp"

patterns-established:
  - "JP 5-0 workflow: 8-step planning process from initiation to plan approval"
  - "5-paragraph order structure: Situation, Mission, Execution, Sustainment, Command/Signal"
  - "Klein's 7 facets for Commander's Intent: purpose, keyTasks, endState, context, constraints, criticalFactors, antigoals"
  - "Red Team agent integration: adversaryActions, vulnerabilities, counterActions with confidence scoring"
  - "COA comparison scoring: feasibility, acceptability, suitability, distinguishability, completeness"

# Metrics
duration: 7min
completed: 2026-01-25
---

# Phase 05 Plan 01: Operational Planning Data Foundation Summary

**Operational planning data models with JP 5-0 workflow, 5-paragraph orders, COA scoring, ROE rules, and version history using PostgreSQL stores**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-25T16:47:21Z
- **Completed:** 2026-01-25T16:54:21Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Complete operational planning domain with 30+ TypeScript interfaces following military doctrine
- JP 5-0 Joint Planning Process workflow with step-by-step status tracking
- COA development support with Red Team simulation and comparison scoring interfaces
- ROE rules engine-compatible structure with override audit trail
- Plan version history with Yjs state snapshot storage

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Type Definitions and Zod Schemas** - `1f066fc` (feat)
   - OperationalPlan, COA, ROERule, ROEOverride, PlanVersion types
   - JP 5-0 workflow steps and 5-paragraph order structures
   - Zod schemas with LLM extraction hints
   - Installed json-rules-engine package

2. **Task 2: Create Plan and COA Stores** - `e782816` (feat)
   - PlanStore with JP 5-0 step management
   - COAStore with 3-minimum validation
   - VersionStore with auto-incrementing versions
   - PostgreSQL tables with proper indexes

3. **Task 3: Create ROE Store and Module Exports** - `d417f4d` (feat)
   - ROEStore with active/inactive rule management
   - Override tracking with justification validation
   - Module exports for all types, schemas, and stores

## Files Created/Modified

- `backend/src/planning/types.ts` - 30+ interfaces for operational planning domain
- `backend/src/planning/schemas.ts` - Zod validation schemas with .describe() hints
- `backend/src/planning/stores/plan-store.ts` - CRUD for operational plans with step tracking
- `backend/src/planning/stores/coa-store.ts` - CRUD for COAs with 3-minimum enforcement
- `backend/src/planning/stores/version-store.ts` - Plan version history with Yjs snapshots
- `backend/src/planning/stores/roe-store.ts` - ROE rules and override management
- `backend/src/planning/index.ts` - Module exports for all planning domain components
- `backend/package.json` - Added json-rules-engine dependency

## Decisions Made

**1. Zod 4.x record() syntax fix**
- **Issue:** Zod 4.x requires two type parameters for `record()` (key type, value type)
- **Solution:** Changed `z.record(z.string())` to `z.record(z.string(), z.string())`
- **Affected:** schemas.ts callSigns, codewords, actionContext, annexes fields
- **Rationale:** Breaking change in Zod 4.x from 3.x single-parameter syntax

**2. COA minimum validation as method, not constraint**
- **Decision:** Implemented `validateMinimumCOAs()` as query method vs database constraint
- **Rationale:** More flexible - allows plans to be created with <3 COAs during development, validation enforced at workflow transition time
- **Pattern:** Similar to workflow state validation in Phase 4.4

**3. ROE override validation at store layer**
- **Decision:** Justification validation (non-empty, non-whitespace) in store, not just schema
- **Rationale:** Defense-in-depth - schema validation can be bypassed, store is final enforcement
- **Implementation:** `createOverride()` throws error if justification empty or whitespace-only

**4. Commander approval dual tracking**
- **Decision:** Separate tracking for COA approval and plan approval with timestamps and DIDs
- **Rationale:** JP 5-0 requires commander approval at COA selection (step 6) AND plan approval (step 8) - different decision points in workflow
- **Structure:** `{ coaApproved, planApproved, coaApprovedAt, planApprovedAt, coaApprovedBy, planApprovedBy }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Zod 4.x record() syntax**
- **Found during:** Task 1 (Schema creation)
- **Issue:** TypeScript compilation failed with "Expected 2-3 arguments, but got 1" for `z.record(z.string())`
- **Fix:** Updated to Zod 4.x syntax `z.record(z.string(), z.string())` for all record fields
- **Files modified:** backend/src/planning/schemas.ts (4 locations)
- **Verification:** `pnpm exec tsc --noEmit` passes
- **Committed in:** 1f066fc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for TypeScript compilation. Zod 4.x breaking change from project's earlier Zod 3.x usage patterns.

## Issues Encountered

None - plan executed smoothly after Zod syntax fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 05 Plan 02 (Real-time Collaborative Editing):**
- Operational plan data models complete with yjsDocumentId field
- Version store ready for Yjs snapshot storage
- Plan store provides CRUD foundation for collaborative editing layer

**Ready for Agent Integration:**
- COA interfaces ready for Red Team agent (redTeamResults field)
- COA comparison scoring ready for Comparator agent (comparisonScore field)
- ROE rules ready for json-rules-engine integration

**Ready for API Development:**
- All stores export singleton instances via planning/index.ts
- CRUD operations follow established patterns from mission-store.ts
- Zod schemas provide request validation for REST endpoints

**Architecture Notes:**
- JP 5-0 workflow state machine ready for XState integration (similar to Phase 4 approval workflows)
- Commander approval tracking supports human-in-the-loop decision points
- 3-COA minimum validation supports doctrine-compliant planning process

---
*Phase: 05-operational-planning-module*
*Completed: 2026-01-25*
