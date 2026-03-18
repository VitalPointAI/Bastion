---
phase: 50-universal-intelligence-input
plan: 03
subsystem: ui
tags: [react, typescript, vitest, testing-library, drag-drop, aria, hooks]

# Dependency graph
requires:
  - phase: 50-universal-intelligence-input
    plan: 01
    provides: "Backend classifier API and ingest endpoint types (/api/ingest/classify, /api/ingest/submit)"

provides:
  - "useUniversalIngest hook: full item lifecycle state machine (queued->classifying->routing->processing->complete/error)"
  - "UniversalInputZone component: drag-drop, paste, keyboard URL/text submission with per-item status"
  - "IngestItemStatus chip: per-item inline status with retry/dismiss actions"
  - "UniversalInputZone.css: styles for drop zone, drag-over state, status chips, mobile responsive"

affects:
  - "50-04 IngestionSidebar wiring (UniversalInputZone ready to integrate)"
  - "brain components requiring content ingestion UI"

# Tech tracking
tech-stack:
  added:
    - "@testing-library/react 16.3.2 (DOM component tests)"
    - "@testing-library/jest-dom 6.9.1 (jest-dom matchers)"
    - "jsdom 29.0.0 (DOM environment for vitest)"
  patterns:
    - "TDD with vitest + renderHook for React hook state machine testing"
    - "Map<id, IngestItem> internal state with ref mirror for synchronous reads in async callbacks"
    - "Promise.allSettled for batch file submission (one failure does not cancel batch)"
    - "Monotonically increasing _insertionOrder counter for stable newest-first sort"

key-files:
  created:
    - "frontend/src/components/brain/hooks/useUniversalIngest.ts"
    - "frontend/src/components/brain/hooks/useUniversalIngest.test.ts"
    - "frontend/src/components/brain/UniversalInputZone.tsx"
    - "frontend/src/components/brain/UniversalInputZone.test.tsx"
    - "frontend/src/components/brain/UniversalInputZone.css"
    - "frontend/src/components/brain/IngestItemStatus.tsx"
    - "frontend/src/test-setup.ts"
  modified:
    - "frontend/vite.config.ts (added vitest jsdom config + test-setup)"
    - "frontend/pnpm-lock.yaml (added testing deps)"

key-decisions:
  - "Used ref mirror (itemsMapRef) alongside useState Map to enable synchronous reads in async retryItem callbacks without setState callback hacks"
  - "Monotonically increasing _insertionOrder counter rather than timestamp sort — avoids same-millisecond ambiguity in batch submissions"
  - "handleSSEEvent is imperative (caller-driven) not effect-based — IngestionSidebar owns the SSE connection and dispatches events"
  - "retryItem updates item in-place with same ID rather than calling submitText (which creates a new item)"
  - "UniversalInputZone paste handler checks clipboard files first, then text — avoids double-handling"
  - "isInterviewRequired does NOT disable the input — RSS/URL feeds may not require interview per UNIV-09"

requirements-completed: [UNIV-01, UNIV-09, UNIV-11, UNIV-14, UNIV-19, UNIV-20]

# Metrics
duration: 11min
completed: 2026-03-18
---

# Phase 50 Plan 03: Universal Input Zone Frontend Summary

**React hook state machine and drag-drop input zone for universal content ingestion, with per-item lifecycle tracking (queued->classifying->routing->processing->complete/error) and full ARIA accessibility**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-18T16:03:08Z
- **Completed:** 2026-03-18T16:14:28Z
- **Tasks:** 2 (TDD — 4 commits: 2 RED + 2 GREEN)
- **Files modified:** 9

## Accomplishments

- `useUniversalIngest` hook manages full item lifecycle with `submitText`, `submitFiles` (Promise.allSettled batch), `handleSSEEvent`, `retryItem`, `dismissItem`, `clearCompleted` — 23 tests pass
- `UniversalInputZone` renders drag-drop zone, paste handler, keyboard Enter/Escape submit, interview-required banner, clear-completed link — 20 tests pass
- `IngestItemStatus` chip shows per-item status icon, progress bar, retry button (retryCount < 3), dismiss button — all ARIA labels present
- Test infrastructure upgraded: installed @testing-library/react + jsdom, configured vitest jsdom environment

## Task Commits

Each task was committed atomically (TDD pattern with RED then GREEN commits):

1. **Task 1 RED: useUniversalIngest hook tests** - `7210c830` (test)
2. **Task 1 GREEN: useUniversalIngest hook implementation** - `d98489b5` (feat)
3. **Task 2 RED: UniversalInputZone + IngestItemStatus DOM tests** - `75ce757a` (test)
4. **Task 2 GREEN: UniversalInputZone + IngestItemStatus + CSS** - `249d293a` (feat)

_TDD: RED commits establish behavioral contracts, GREEN commits implement to pass._

## Files Created/Modified

- `frontend/src/components/brain/hooks/useUniversalIngest.ts` — State machine hook for ingest item lifecycle + API calls
- `frontend/src/components/brain/hooks/useUniversalIngest.test.ts` — 23 behavioral tests for hook
- `frontend/src/components/brain/UniversalInputZone.tsx` — Universal input widget with drag-drop, paste, keyboard
- `frontend/src/components/brain/UniversalInputZone.test.tsx` — 20 DOM tests for component
- `frontend/src/components/brain/UniversalInputZone.css` — Drop zone styles, drag-over state, status chips, mobile
- `frontend/src/components/brain/IngestItemStatus.tsx` — Per-item status chip with retry/dismiss
- `frontend/src/test-setup.ts` — @testing-library/jest-dom import for vitest
- `frontend/vite.config.ts` — Added vitest jsdom environment + test-setup config
- `frontend/pnpm-lock.yaml` — Added @testing-library/react, jest-dom, jsdom

## Decisions Made

- **Ref mirror for synchronous reads:** `itemsMapRef` mirrors the useState Map so `retryItem` can read the current item synchronously in an async callback without the setState-callback-as-reader anti-pattern.
- **_insertionOrder counter:** Monotonically increasing counter added to each IngestItem as `_order` field — ensures stable newest-first sort even when items are created in the same millisecond.
- **Imperative SSEEvent handler:** `handleSSEEvent` is called by the IngestionSidebar (which owns the SSE connection) rather than the hook managing its own EventSource — keeps concerns separate.
- **retryItem in-place:** Retry updates the existing item with the same ID rather than calling `submitText` (which would add a duplicate item).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing DOM test infrastructure**
- **Found during:** Task 1 setup
- **Issue:** vitest config had no environment, @testing-library/react and jsdom not installed — renderHook and component tests would fail
- **Fix:** Installed @testing-library/react, @testing-library/jest-dom, jsdom via pnpm; added vitest jsdom config to vite.config.ts; created src/test-setup.ts
- **Files modified:** frontend/vite.config.ts, frontend/src/test-setup.ts, pnpm-lock.yaml
- **Verification:** Existing useBrainTimeline tests still pass after config change
- **Committed in:** 7210c830 (Task 1 RED commit)

**2. [Rule 1 - Bug] Fixed same-millisecond sort ambiguity in items list**
- **Found during:** Task 1 GREEN (items list newest-first test)
- **Issue:** Sorting by `createdAt` ISO timestamp failed when two items were created in the same millisecond (same-tick sequential `submitText` calls)
- **Fix:** Added `_order: ++_insertionOrder` monotonically increasing counter to each item; sort by `_order` instead of `createdAt`
- **Files modified:** frontend/src/components/brain/hooks/useUniversalIngest.ts
- **Verification:** "items list is newest first" test passes
- **Committed in:** d98489b5 (Task 1 GREEN commit)

**3. [Rule 1 - Bug] Fixed retryItem not reading current state synchronously**
- **Found during:** Task 1 GREEN (retryItem retryCount test)
- **Issue:** Using `setState` callback as a read mechanism doesn't work — the `capturedItem` variable was never populated before the async continuation
- **Fix:** Added `itemsMapRef` ref that mirrors `itemsMap` state, updated all setState callers to keep ref in sync; retryItem reads from `itemsMapRef.current` directly
- **Files modified:** frontend/src/components/brain/hooks/useUniversalIngest.ts
- **Verification:** "increments retryCount and resets status to queued" test passes
- **Committed in:** d98489b5 (Task 1 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 blocking infrastructure, 2 bugs found during TDD GREEN)
**Impact on plan:** All fixes essential for correctness. No scope creep.

## Issues Encountered

- pnpm version mismatch during testing-library install (store path v10 vs v10/v3) — resolved by upgrading to pnpm v10.32.1 which uses v3 sub-path correctly with the existing store.

## User Setup Required

None — no external service configuration required. Tests run with vitest locally.

## Next Phase Readiness

- `UniversalInputZone` is self-contained and ready for Plan 04 IngestionSidebar wiring
- `handleSSEEvent` exposes the contract IngestionSidebar needs to relay SSE events to tracked items
- TypeScript compilation clean (tsc --noEmit passes)
- 56 total brain component tests passing

---
*Phase: 50-universal-intelligence-input*
*Completed: 2026-03-18*
