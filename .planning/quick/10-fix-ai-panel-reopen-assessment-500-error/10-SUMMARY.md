---
phase: quick-10
plan: 1
subsystem: ui, api, database
tags: [react, express, postgres, race-condition, ai-staff]

requires:
  - phase: 29-ai-staff
    provides: AIStaffPanel, AIStaffContext, useAIStaffFeed
  - phase: 37-assessment
    provides: METL/MOE/MOP/AAR stores with table init
  - phase: 38-inheritance
    provides: strategic guidance router

provides:
  - AI panel reopen toggle button on process tabs
  - Defensive feed response destructuring in useAIStaffFeed
  - Promise-based concurrent init guard for all assessment stores
  - Strategic guidance router mounted at /api/strategic-guidance

affects: [ai-staff, assessment, strategic-guidance]

tech-stack:
  added: []
  patterns: [promise-dedup-init]

key-files:
  created: []
  modified:
    - frontend/src/components/problem-set/ProblemSetTabContainer.tsx
    - frontend/src/hooks/useAIStaffFeed.ts
    - backend/src/index.ts
    - backend/src/assessment/metl-store.ts
    - backend/src/assessment/moe-store.ts
    - backend/src/assessment/mop-store.ts
    - backend/src/assessment/aar-structured-store.ts

key-decisions:
  - "Used Promise deduplication pattern instead of mutex/semaphore for init race fix -- simpler, no dependencies"
  - "Defensive Array.isArray check on getFeed response to handle both array and {items} wrapper shapes"

patterns-established:
  - "Promise-dedup init: Store classes use initPromise with catch-reset instead of boolean flag to prevent concurrent CREATE races"

requirements-completed: [FIX-AI-PANEL-REOPEN, FIX-ASSESSMENT-500, FIX-AI-FEED-TYPEERROR, FIX-STRATEGIC-GUIDANCE-404]

duration: 2min
completed: 2026-03-09
---

# Quick Task 10: Fix AI Panel Reopen, Assessment 500, Feed TypeError, and Strategic Guidance 404

**Four targeted runtime bug fixes: AI panel reopen toggle, Promise-based init to prevent concurrent CREATE INDEX races, defensive feed response destructuring, and strategic guidance router mount**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T01:00:11Z
- **Completed:** 2026-03-09T01:02:27Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- AI panel can now be reopened after closing on process tabs (understand/design/plan) via a vertical edge toggle button
- useAIStaffFeed correctly extracts `.items` from the `{ items, total }` response shape, preventing "I is not iterable" TypeError
- All four assessment stores (METL, MOE, MOP, AAR) use Promise deduplication for init, preventing concurrent `CREATE INDEX IF NOT EXISTS` race on `pg_type_typname_nsp_index`
- Strategic guidance router mounted at `/api/strategic-guidance`, resolving 404 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix AI panel reopen, useAIStaffFeed TypeError, and strategic-guidance mount** - `9c8d208` (fix)
2. **Task 2: Fix assessment METL store concurrent init race condition** - `7122bbf` (fix)

## Files Created/Modified
- `frontend/src/components/problem-set/ProblemSetTabContainer.tsx` - Added AIStaffToggle component for reopening closed AI panel
- `frontend/src/hooks/useAIStaffFeed.ts` - Defensive destructuring of getFeed response in both refresh and initial fetch paths
- `backend/src/index.ts` - Imported and mounted strategicGuidanceRouter
- `backend/src/assessment/metl-store.ts` - Promise-based init replacing boolean flag
- `backend/src/assessment/moe-store.ts` - Same Promise-based init fix
- `backend/src/assessment/mop-store.ts` - Same Promise-based init fix
- `backend/src/assessment/aar-structured-store.ts` - Same Promise-based init fix

## Decisions Made
- Used Promise deduplication pattern (store initPromise, reset on error) rather than a mutex library -- zero dependencies, handles the concurrent init race correctly
- Defensive `Array.isArray(response) ? response : response.items` pattern handles both direct array and wrapper object response shapes from getFeed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Applied Promise-based init to all four assessment stores**
- **Found during:** Task 2 (METL store fix)
- **Issue:** Plan asked to check moe/mop/aar stores and fix if same pattern -- all three had the identical boolean flag race
- **Fix:** Applied the same initPromise pattern to MOEStore, MOPStore, and StructuredAARStore
- **Files modified:** moe-store.ts, mop-store.ts, aar-structured-store.ts
- **Verification:** `grep -c "initialized = false" backend/src/assessment/*.ts` returns 0 for all files
- **Committed in:** 7122bbf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical -- plan anticipated this, but it counts as deviation from the METL-only task scope)
**Impact on plan:** Necessary for correctness. All four stores had the same race. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four bugs resolved, no follow-up needed
- Frontend builds with no type errors

---
*Quick Task: 10-fix-ai-panel-reopen-assessment-500-error*
*Completed: 2026-03-09*
