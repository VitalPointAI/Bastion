---
phase: 14-friendly-adversary-ipb-complete-cycle
plan: 05
subsystem: api
tags: [express, rest-api, exercise, information-barrier, multer, typescript]

# Dependency graph
requires:
  - phase: 14-friendly-adversary-ipb-complete-cycle
    plan: 01
    provides: "Exercise stores (ScenarioStore, DocumentStore, IPBStore, COAStore, OrderStore, TaskStore, GateStore), withExerciseBarrier middleware"
  - phase: 14-friendly-adversary-ipb-complete-cycle
    plan: 02
    provides: "ExerciseExtractionService, inferTagsFromPath"
  - phase: 14-friendly-adversary-ipb-complete-cycle
    plan: 03
    provides: "IPBService, COAScoringService"
  - phase: 14-friendly-adversary-ipb-complete-cycle
    plan: 04
    provides: "ExerciseOrderGenerator, PlanningBoardService"
provides:
  - "Express router (exerciseRouter) at /api/exercise/* with 30+ REST endpoints"
  - "Scenario CRUD, document upload with async extraction, IPB assembly and versioning"
  - "COA lifecycle (create, score, wargame, compare, commander decision)"
  - "Order generation (WARNORD/OPORD/FRAGO), draft creation, publish → task creation"
  - "Planning board (task list, summary, status update, reassign)"
  - "Gate lifecycle (create, list, open, phase-ready check)"
  - "IPBService and COAScoringService added to exercise/index.ts barrel"
affects:
  - "14-06 through 14-10 (frontend components consuming these endpoints)"
  - "exercise module consumers needing IPBService/COAScoringService imports"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Router-level middleware: withExerciseBarrier applied once covers all exercise routes"
    - "Lazy service instantiation: services created per-request to pick up latest DB pool state"
    - "qstr() helper: safely extract string from Express query params typed as string | string[] | ParsedQs"
    - "req.params.id as string: consistent cast pattern matching strategic.ts convention"
    - "Async extraction: setImmediate() queues LLM extraction after upload response returns 202"

key-files:
  created:
    - "backend/src/api/exercise.ts"
  modified:
    - "backend/src/index.ts"
    - "backend/src/exercise/index.ts"

key-decisions:
  - "Async document extraction: upload returns 202 immediately; extraction runs via setImmediate() to avoid blocking upload response on slow LLM calls"
  - "Lazy service construction: IPBService/COAScoringService/OrderGenerator created per-request (not singletons) to ensure fresh DB pool handles and LLM config"
  - "qstr() helper: safer than casting req.query as Record<string,string> — prevents runtime errors if client sends array query params"
  - "IPBService and COAScoringService added to exercise/index.ts barrel for downstream phase consumption"

patterns-established:
  - "Exercise API pattern: all routes use withExerciseBarrier middleware at router level; all store calls pass req.visibleTeams"
  - "Upload pattern: multer.array('files') + DocumentParser.parse() + inferTagsFromPath() + async extraction"

requirements-completed:
  - EX-11

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 14 Plan 05: Exercise REST API Summary

**Express router at /api/exercise/* with 30+ endpoints covering scenario CRUD, multi-file upload with async LLM extraction, IPB assembly/versioning, COA scoring/comparison, order generation, planning board, and gate management — all enforcing information barriers via withExerciseBarrier middleware**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-28T20:12:19Z
- **Completed:** 2026-02-28T20:20:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `backend/src/api/exercise.ts` with 30+ REST endpoints across 7 resource types: scenarios, documents, IPB, COAs, orders, tasks, and gates
- Multi-file upload route uses multer.array('files') with automatic tag inference and async LLM extraction that returns 202 without blocking
- Mounted exerciseRouter at `/api/exercise/*` in `backend/src/index.ts` alongside all other API routers
- Added IPBService and COAScoringService to `exercise/index.ts` barrel file for downstream imports

## Task Commits

Each task was committed atomically:

1. **Task 1: Exercise REST API Routes** - `3a61d11` (feat)
2. **Task 2: Register Exercise Router in Main API** - `80042d9` (feat)

**Plan metadata:** `[see final commit below]` (docs: complete plan)

## Files Created/Modified
- `backend/src/api/exercise.ts` - Complete exercise REST API router (1056 lines, 30+ endpoints)
- `backend/src/index.ts` - Added exercise router import and mount at /api/exercise
- `backend/src/exercise/index.ts` - Added IPBService and COAScoringService barrel exports

## Decisions Made
- Async document extraction: upload returns 202 immediately; extraction runs via setImmediate() to avoid blocking the response on slow LLM calls
- Lazy service construction: IPBService, COAScoringService, ExerciseOrderGenerator created per-request (not singletons) to ensure fresh DB pool handles
- Added `qstr()` helper to safely extract string values from Express query params (typed as `string | string[] | ParsedQs`) — prevents runtime errors if client sends array query params
- IPBService and COAScoringService added to exercise/index.ts barrel since plans 06-10 will need to import them directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ProviderConfig type — used `type` property not `provider`**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Initial `getLLMConfig()` used `{ provider: 'openai-compatible' }` but `ProviderConfig` requires `{ type: ProviderType }` where `ProviderType` is `'anthropic' | 'openai' | ...`
- **Fix:** Changed config shape to use `type: 'openai'` and `type: 'anthropic'` per the actual ProviderConfig interface
- **Files modified:** `backend/src/api/exercise.ts`
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 3a61d11

**2. [Rule 1 - Bug] Fixed DocumentParser.parse() returns DocumentContent object, not string**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `DocumentParser.parse()` returns `DocumentContent` with `{ text, metadata, pageCount? }` — code was assigning the whole object to `textContent: string`
- **Fix:** Changed to `const parsed = await documentParser.parse(...); textContent = parsed.text;`
- **Files modified:** `backend/src/api/exercise.ts`
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 3a61d11

**3. [Rule 1 - Bug] Fixed designation type — valid values are 'training/exercise' | 'operational'**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Default `designation` was set to `'UNCLASSIFIED'` which is not a valid `ExerciseScenario['designation']` value
- **Fix:** Changed default to `'training/exercise'` with proper type cast
- **Files modified:** `backend/src/api/exercise.ts`
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 3a61d11

**4. [Rule 1 - Bug] Fixed CreateScenarioCOA requires all non-id fields including narrative, doctScores, etc.**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `CreateScenarioCOA = Omit<ScenarioCOA, 'id' | 'createdAt' | 'updatedAt'>` requires narrative, doctScores, combinedScore, commanderDecision, commanderDecisionNotes, decisionHash, blockchainTx
- **Fix:** Added all required nullable fields with null/empty defaults in the COA create handler
- **Files modified:** `backend/src/api/exercise.ts`
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 3a61d11

---

**Total deviations:** 4 auto-fixed (Rule 1 type/bug fixes during TypeScript compilation)
**Impact on plan:** All auto-fixes were TypeScript correctness fixes. No scope creep. Information barrier enforcement and route structure match plan exactly.

## Issues Encountered
- TypeScript compilation required multiple fix passes for: ProviderConfig shape, DocumentContent vs string, designation enum values, CreateScenarioCOA required fields, and req.params/req.query type casts — all resolved via Rule 1 auto-fixes.

## User Setup Required
None - no external service configuration required beyond what was established in prior plans (LLM API keys via OPENAI_API_KEY / ANTHROPIC_API_KEY env vars).

## Next Phase Readiness
- All 30+ exercise API endpoints are live at `/api/exercise/*`
- Frontend plans (14-06 through 14-10) can now build against the exercise REST API
- Information barrier is enforced on every route via withExerciseBarrier middleware
- Multi-file upload with async extraction pipeline is operational

---
*Phase: 14-friendly-adversary-ipb-complete-cycle*
*Completed: 2026-02-28*
