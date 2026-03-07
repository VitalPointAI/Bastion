---
phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
plan: 08
subsystem: api
tags: [express, websocket, discovery, em-spectrum, server-wiring]

# Dependency graph
requires:
  - phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
    provides: "Discovery barrel export (Plan 06), EM spectrum collector (Plan 07)"
provides:
  - "Discovery REST API mounted at /api/discovery"
  - "Discovery WebSocket mounted at /ws/discovery"
  - "DiscoveryService initialized on server boot (paused state)"
  - "EM spectrum endpoints (snapshot, own-footprint)"
  - "Graceful shutdown for discovery service"
affects: [32-09-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Lazy singleton initialization with dependency injection for DiscoveryService"]

key-files:
  created: []
  modified:
    - "backend/src/index.ts"
    - "backend/src/discovery/index.ts"
    - "backend/src/discovery/discovery-router.ts"

key-decisions:
  - "DiscoveryService initialized with ResourceRegistry, MessageBus, and GateService from existing singletons"
  - "Discovery service stop() called before pg-boss shutdown in graceful shutdown handler"
  - "Network topology endpoints deferred because network-topology.ts does not yet exist (Plan 07 incomplete)"

patterns-established:
  - "Discovery service initialization pattern: init with deps, do NOT auto-start scanners"

requirements-completed: [DISC-19]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 32 Plan 08: Server Wiring Summary

**Discovery module wired into Express server with REST API at /api/discovery, WebSocket at /ws/discovery, and EM spectrum endpoints -- scanners initialize paused for operator control**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T17:05:08Z
- **Completed:** 2026-03-07T17:09:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Discovery REST router mounted at /api/discovery with all scanner control, device management, access list, and EM spectrum endpoints
- Discovery WebSocket initialized at /ws/discovery for real-time event streaming
- DiscoveryService initialized on server boot with ResourceRegistry, MessageBus, and GateService dependencies -- scanners paused by default
- EM spectrum endpoints added: GET /em/snapshot and GET /em/own-footprint
- Graceful shutdown handler stops discovery service before pg-boss shutdown

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire discovery module into backend server** - `2d0952e` (feat)
2. **Task 2: Update discovery index.ts with EM and topology exports** - `d617545` (feat)

## Files Created/Modified
- `backend/src/index.ts` - Added discovery imports, router mount, WS setup, service init, graceful shutdown
- `backend/src/discovery/index.ts` - Added EMCollector, EMBand, and EM type exports to barrel
- `backend/src/discovery/discovery-router.ts` - Added EM spectrum REST endpoints (snapshot, own-footprint)

## Decisions Made
- Used dynamic import for ResourceRegistry and GateService in server init block to match lazy loading pattern used by other services
- EMCollector lazy singleton in router avoids coupling to DiscoveryService lifecycle
- Network topology endpoints deferred: network-topology.ts not yet created (Plan 07 incomplete)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Skipped network topology endpoints**
- **Found during:** Task 2
- **Issue:** Plan called for NetworkTopology import and topology REST endpoints, but network-topology.ts does not exist (Plan 07 incomplete)
- **Fix:** Skipped topology exports and endpoints to avoid import errors. EM spectrum exports and endpoints were added as specified.
- **Files modified:** None (skipped non-existent imports)
- **Verification:** Build produces no new errors in discovery files

---

**Total deviations:** 1 auto-fixed (1 blocking -- missing file)
**Impact on plan:** Topology endpoints will be added when Plan 07 completes network-topology.ts. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Discovery module fully wired and operational when server starts
- Remaining Plan 09 (frontend integration) can proceed
- Network topology endpoints can be added when Plan 07 network-topology.ts is created

---
*Phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding*
*Completed: 2026-03-07*
