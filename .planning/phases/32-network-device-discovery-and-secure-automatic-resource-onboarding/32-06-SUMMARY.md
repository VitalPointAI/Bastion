---
phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
plan: 06
subsystem: api
tags: [websocket, rest-api, express, zod, anomaly-detection, welford, real-time]

# Dependency graph
requires:
  - phase: 32-01
    provides: discovery-store.ts with device/access/baseline CRUD, types.ts
  - phase: 32-05
    provides: discovery-service.ts singleton orchestrator
provides:
  - WebSocket handler for real-time discovery event streaming
  - REST API router for scanner control, device management, access lists
  - Behavioral baseline anomaly detection with Welford's online algorithm
  - Barrel export index.ts for clean module boundary
affects: [frontend-discovery-panel, 32-07, 32-08, 32-09]

# Tech tracking
tech-stack:
  added: []
  patterns: [welford-online-algorithm, websocket-event-streaming, barrel-export]

key-files:
  created:
    - backend/src/discovery/discovery-ws.ts
    - backend/src/discovery/discovery-router.ts
    - backend/src/discovery/behavioral-baseline.ts
    - backend/src/discovery/index.ts
  modified: []

key-decisions:
  - "Used in-memory Welford cache with lazy DB loading to avoid per-metric DB reads"
  - "Population variance (M2/count) instead of sample variance for numerical stability with streaming data"
  - "Dynamic import for discovery-service.ts in router to avoid compile-time coupling with Plan 05"

patterns-established:
  - "Welford online algorithm: O(1) per-sample mean/variance update for anomaly detection"
  - "WebSocket event filtering: per-client filter state on extended WebSocket interface"
  - "Discovery barrel export: clean module boundary via index.ts re-exports"

requirements-completed: [DISC-13, DISC-14, DISC-15]

# Metrics
duration: 9min
completed: 2026-03-07
---

# Phase 32 Plan 06: WebSocket, REST API, Anomaly Detection & Module Export Summary

**Real-time WebSocket streaming, full REST API for discovery management, Welford's algorithm 3-sigma anomaly detection, and barrel export completing the discovery backend**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-07T16:50:31Z
- **Completed:** 2026-03-07T16:59:31Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- WebSocket handler at /ws/discovery streams discovery events via MessageBus with per-client transport/state filtering
- REST API with 13 endpoints: scanner control (status/start/stop/pause/resume), device CRUD with pagination, access list management, Ironclaw callback, emergency disconnect
- Behavioral baseline using Welford's online algorithm detects anomalies beyond 3-sigma after minimum 10 samples
- Module barrel export provides clean public API boundary for discovery subsystem

## Task Commits

Each task was committed atomically:

1. **Task 1: Create WebSocket handler and REST API router** - `98b5941` (feat)
2. **Task 2: Create behavioral baseline anomaly detection and module barrel export** - `f316a2a` (feat)

## Files Created/Modified
- `backend/src/discovery/discovery-ws.ts` - WebSocket handler subscribing to MessageBus discovery channels, broadcasting to filtered clients
- `backend/src/discovery/discovery-router.ts` - Express router with auth, zod validation, static-before-parametric route registration
- `backend/src/discovery/behavioral-baseline.ts` - BehavioralBaseline class with Welford's algorithm, anomaly check, device health aggregation
- `backend/src/discovery/index.ts` - Barrel export re-exporting types, services, router, WS handler, gate, baseline, lifecycle

## Decisions Made
- Used in-memory Welford accumulator cache keyed by deviceDid:metricType to avoid DB reads on every telemetry sample; lazy-loaded from store on first access
- Population variance (M2/count) instead of sample variance (M2/(count-1)) for better numerical stability with streaming data where exact statistical inference is less important than anomaly detection
- Dynamic import (`Function('return import(...)')`) for discovery-service.ts in the router to break compile-time coupling -- allows router to compile even when service module is not yet built

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Map iteration for downlevelIteration compatibility**
- **Found during:** Task 2 (behavioral-baseline.ts)
- **Issue:** `for...of` on Map triggers TS2802 with project's current tsconfig target
- **Fix:** Replaced with `forEach` + collect-then-delete pattern
- **Files modified:** backend/src/discovery/behavioral-baseline.ts
- **Verification:** tsc --noEmit --skipLibCheck shows no errors in our files
- **Committed in:** f316a2a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor syntactic fix for tsconfig compatibility. No scope creep.

## Issues Encountered
- Task 1 commit initially went to wrong branch (gsd/phase-31-validation-v3 instead of current branch). Recovered file contents and re-committed on correct branch.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Discovery backend subsystem is now complete with all layers: types, store, scanners, service, pipeline, gate, fingerprinting, challenge-auth, WS handler, REST API, anomaly detection
- Ready for frontend discovery panel (Plan 07+) and integration testing
- REST API mounted at /api/discovery, WebSocket at /ws/discovery

---
*Phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding*
*Completed: 2026-03-07*
