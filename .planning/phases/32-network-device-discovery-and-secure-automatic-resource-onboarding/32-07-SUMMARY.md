---
phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
plan: 07
subsystem: discovery
tags: [em-spectrum, opsec, network-topology, hopping, signal-intelligence, graph, postgresql-jsonb]

# Dependency graph
requires:
  - phase: 32-05
    provides: "DiscoveryService singleton, OnboardingPipeline, scanner lifecycle events"
  - phase: 32-06
    provides: "MessageBus integration, barrel export index.ts"
provides:
  - "EMCollector: EM spectrum awareness aggregating environmental signals and own emissions from scanner events"
  - "EMDataSource interface: clean SDR extension point for Tier 2 EM measurement"
  - "NetworkTopology: full device/connection/network graph with BFS pathfinding"
  - "Configurable network hopping through participant/autonomous bridge devices"
  - "Topology persistence via PostgreSQL JSONB snapshots with debounced saves"
affects: [32-08, 32-09, frontend-discovery-panel]

# Tech tracking
tech-stack:
  added: []
  patterns: [sliding-window-signal-aggregation, graph-topology-with-bfs, debounced-persistence, em-spectrum-two-tier-architecture]

key-files:
  created:
    - backend/src/discovery/em-spectrum/em-types.ts
    - backend/src/discovery/em-spectrum/em-collector.ts
    - backend/src/discovery/network-topology.ts
  modified:
    - backend/src/discovery/index.ts

key-decisions:
  - "Two-tier EM architecture: Tier 1 inferred from scanner RSSI (always available), Tier 2 SDR via EMDataSource interface (future)"
  - "Own-emission tracking keyed by band:frequency to deduplicate active transmissions"
  - "Network hopping disabled by default per user decision — requires explicit enablement"
  - "Bridge devices must be participant or autonomous trust tier (observers rejected)"
  - "Topology debounced save (5s) prevents excessive DB writes during rapid discovery"
  - "TAK default frequency set to 150 MHz (VHF) — most common for ATAK radios"

patterns-established:
  - "EM signal inference: derive band/frequency from transport type and raw scanner data"
  - "Own-emission lifecycle: scanner start -> record emission, scanner stop -> clear emission"
  - "Topology graph: bastion center node (hop 0), direct devices (hop 1), hopped (2+)"
  - "Network hop chain: BFS path from bastion to any device showing bridge sequence"

requirements-completed: [DISC-16, DISC-17, DISC-18]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 32 Plan 07: EM Spectrum Awareness & Network Topology Summary

**EM spectrum collector tracking environmental signals and Bastion's own emissions for OPSEC, plus network topology mapper with configurable bridge-device hopping and PostgreSQL persistence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T17:05:12Z
- **Completed:** 2026-03-07T17:11:00Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments
- EMCollector aggregates EM signals from all scanner discovery events with 5-minute sliding window
- Own-emission tracking shows Bastion's electromagnetic footprint (BLE scanning, WiFi probes) for OPSEC
- EMDataSource interface provides clean SDR extension point without current hardware dependency
- NetworkTopology builds full device/connection/network graph with BFS shortest pathfinding
- Network hopping discovers adjacent networks through trusted bridge devices with configurable depth limits
- Topology persists to PostgreSQL as JSONB with debounced saves and load-on-init

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EM spectrum awareness types and collector** - `f30e6b8` (feat)
2. **Task 2: Create network topology mapper with configurable network hopping** - `a43ce51` (feat)

## Files Created/Modified
- `backend/src/discovery/em-spectrum/em-types.ts` - EMBand const, EMSignalEntry, EMFootprint, EMSnapshot, EMDataSource interface (101 lines)
- `backend/src/discovery/em-spectrum/em-collector.ts` - EMCollector class with signal ingestion, own-emission tracking, MessageBus subscription, sliding window (309 lines)
- `backend/src/discovery/network-topology.ts` - NetworkTopology class with graph management, BFS path, hopping, JSONB persistence (444 lines)
- `backend/src/discovery/index.ts` - Added barrel exports for EMCollector, EMBand, EM types, NetworkTopology, topology types

## Decisions Made
- Two-tier EM: Tier 1 (scanner RSSI inference) is always available; Tier 2 (SDR) plugs in via EMDataSource without refactoring
- Own emissions keyed by band:frequency pair for deduplication — one entry per active transmission
- Network hopping disabled by default (user decision) — must be explicitly enabled by operator
- Bridge trust tier enforcement: only participant/autonomous can serve as network bridges (observers rejected)
- Debounced 5-second save prevents DB write storms during rapid device discovery bursts
- TAK defaults to 150 MHz VHF since ATAK tactical radios most commonly operate in that band

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed MessageBus.subscribe signature**
- **Found during:** Task 1 (em-collector.ts)
- **Issue:** Subscribe called with 3 args (subscriberDid, channel, callback) but MessageBus.subscribe takes 2 args (subscriberDid, SubscriptionOptions)
- **Fix:** Wrapped channel and callback into SubscriptionOptions object with channels array
- **Files modified:** backend/src/discovery/em-spectrum/em-collector.ts
- **Verification:** tsc --noEmit --skipLibCheck shows no errors in our files
- **Committed in:** f30e6b8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor API signature fix for MessageBus compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EM spectrum awareness ready for frontend visualization (band summary, own-footprint OPSEC view)
- Network topology graph ready for map/graph rendering in discovery panel
- Hopping infrastructure ready for admin configuration UI
- All new exports available through discovery barrel index.ts

## Self-Check: PASSED

All files exist and all commits verified.

---
*Phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding*
*Completed: 2026-03-07*
