---
phase: 43-robot-agent-local-discovery-bridge
plan: 02
subsystem: api
tags: [websocket, bridge, token-auth, deduplication, discovery, robot, near-did, postgresql]

# Dependency graph
requires:
  - phase: 32-network-device-discovery
    provides: insertDiscoveredDevice and DiscoveredDevice types for device ingestion
  - phase: 27-resource-registry
    provides: ResourceRegistry.registerResource() and DID assignment
  - phase: 06-robot-agent
    provides: RobotMissionService singleton, robot-types.ts, robot-ws.ts patterns

provides:
  - /ws/bridge WebSocket endpoint with token and DID-based registration
  - bridge-token-store: DB-backed one-time tokens (create/consume/cleanup) in bridge_tokens table
  - bridge-ws.ts: discovery report ingestion via discovery-store, robot relay with dedup
  - bridge-router.ts: POST /api/admin/bridge-tokens, GET /api/bridge/status
  - RobotMissionService: isDuplicate(30s window), registerBridge, handleBridgeDisconnect, getConnectedBridges
  - dispatchMission: bridge fallback when robot not directly connected
  - robot-ws.ts: token-based first-time DID assignment for robots
  - ConnectedBridge interface and bridge message types in robot-types.ts

affects: [43-03-robot-agent, 43-04-bridge-agent, 43-05-integration, 43-06-whitepaper]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-time token registration: bridgeTokenStore.consume() in SELECT FOR UPDATE transaction ensures single-use semantics"
    - "Message deduplication: seenMessageIds Map with 30s TTL window, periodic cleanup via setInterval"
    - "Bridge fallback dispatch: dispatchMission checks connectedBridges if robot not directly connected"
    - "Token-based DID registration: robots/bridges can get their DID assigned on first connect via one-time token"

key-files:
  created:
    - backend/src/robot/bridge-token-store.ts
    - backend/src/robot/bridge-ws.ts
    - backend/src/robot/bridge-router.ts
  modified:
    - backend/src/robot/robot-types.ts
    - backend/src/robot/robot-mission-service.ts
    - backend/src/robot/robot-ws.ts
    - backend/src/robot/index.ts

key-decisions:
  - "Raw device data from bridge stored in ironclawAnalysis JSONB field (with origin=bridge, bridge_id) since DiscoveredDevice has no rawData field"
  - "isDuplicate() is public method on RobotMissionService so bridge-ws.ts can call it for relay envelope dedup"
  - "connectedBridges Map is public (not private) on RobotMissionService for bridge-router status endpoint access"
  - "Bridge relay of inner robot message checks both outer envelope message_id and inner robot_message.message_id for full dedup coverage"

patterns-established:
  - "Token store pattern: SELECT FOR UPDATE transaction for atomic consume-and-mark prevents race conditions on concurrent token use"
  - "WS handler pattern: mirrors robot-ws.ts overloaded function accepting HTTPServer or WebSocketServer"

requirements-completed: [BRIDGE-03, BRIDGE-04, BRIDGE-06]

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 43 Plan 02: Bridge Backend Infrastructure Summary

**Bridge WebSocket handler, one-time token store, REST admin router, and 30s message dedup added to the cloud backend — cloud side ready for bridge and robot connections**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T20:24:36Z
- **Completed:** 2026-03-12T20:31:46Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- Created `bridge-token-store.ts` with DB-backed one-time token lifecycle (create/consume/cleanup) using SELECT FOR UPDATE transaction to prevent double-use
- Created `bridge-ws.ts` handling /ws/bridge connections: token registration, DID reconnect, discovery report ingestion via `discoveryStore.insertDiscoveredDevice`, robot relay with dedup
- Created `bridge-router.ts` with POST /api/admin/bridge-tokens (token generation) and GET /api/bridge/status (connected bridge list)
- Added `isDuplicate()` (30s window, periodic cleanup), bridge tracking methods, and bridge fallback to `dispatchMission()` in RobotMissionService
- Extended `robot-ws.ts` to handle token-based first-time DID assignment for robots (mirrors bridge pattern)
- Extended `robot-types.ts` with bridge message interfaces, ConnectedBridge, and message_id on all inbound types

## Task Commits

1. **Task 1: Extend robot-types.ts with bridge message types and message_id** - `33fa8b4` (feat)
2. **Task 2: Create bridge infrastructure files and update mission service** - `dfd1c35` (feat)

## Files Created/Modified
- `backend/src/robot/bridge-token-store.ts` - DB-backed one-time token store with create/consume/cleanup
- `backend/src/robot/bridge-ws.ts` - /ws/bridge WebSocket handler with full message routing
- `backend/src/robot/bridge-router.ts` - REST endpoints for admin token generation and bridge status
- `backend/src/robot/robot-types.ts` - Bridge interfaces, ConnectedBridge, message_id on inbound types
- `backend/src/robot/robot-mission-service.ts` - isDuplicate, bridge tracking, bridge dispatch fallback
- `backend/src/robot/robot-ws.ts` - Token-based first-time registration support
- `backend/src/robot/index.ts` - Re-exports for all new bridge symbols

## Decisions Made
- Raw device data from bridge stored in `ironclawAnalysis` JSONB field (tagged with `origin: 'bridge'` and `bridge_id`) since `DiscoveredDevice` has no `rawData` field — enables traceability without schema changes
- `isDuplicate()` made public on `RobotMissionService` so `bridge-ws.ts` can share the same dedup map for relay messages (single source of truth for seen message IDs)
- `connectedBridges` Map left as public field (not private) so `bridge-router.ts` status endpoint can query it via the service singleton

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] insertDiscoveredDevice not exported as named export from discovery-store**
- **Found during:** Task 2 (bridge-ws.ts creation)
- **Issue:** Plan specified `import { insertDiscoveredDevice } from '../discovery/discovery-store.js'` but the function is exported via the `discoveryStore` singleton object, not as a named export
- **Fix:** Used `discoveryStore.insertDiscoveredDevice()` instead; verified grep pattern `insertDiscoveredDevice` still matches in bridge-ws.ts
- **Files modified:** backend/src/robot/bridge-ws.ts
- **Verification:** TypeScript compiled cleanly
- **Committed in:** dfd1c35 (Task 2 commit)

**2. [Rule 1 - Bug] DiscoveredDevice.fingerprint requires null not undefined**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** `fingerprint: DeviceFingerprint | null` in DiscoveredDevice — passing `undefined` caused TS error TS2322
- **Fix:** Changed `fingerprint: undefined` to `fingerprint: null` in the insertDiscoveredDevice call
- **Files modified:** backend/src/robot/bridge-ws.ts
- **Verification:** TypeScript EXIT: 0
- **Committed in:** dfd1c35 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both auto-fixes were minor API surface corrections; no scope creep.

## Issues Encountered
- None beyond the two auto-fixed type issues above.

## User Setup Required
None - no external service configuration required. The `bridge_tokens` table is auto-created on first use by `bridge-token-store.ts`.

## Next Phase Readiness
- Cloud-side bridge infrastructure complete — bridge WebSocket endpoint, token store, and dedup all ready
- Plan 43-03 (robot agent Python client) can connect to /ws/robot with token-based registration
- Plan 43-04 (bridge Python agent) can connect to /ws/bridge with token-based registration
- Plan 43-05 integration tests can exercise the full bridge→cloud path

---
*Phase: 43-robot-agent-local-discovery-bridge*
*Completed: 2026-03-12*
