---
phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
plan: 05
subsystem: discovery
tags: [onboarding-pipeline, discovery-service, singleton, scanner-orchestration, device-lifecycle, pg-boss, message-bus]

# Dependency graph
requires:
  - phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding
    provides: "Discovery types, store, lifecycle (Plan 01); Transport scanners (Plan 03); Fingerprinting, challenge-auth, acceptance gate (Plan 04)"
  - phase: 27-resource-registry
    provides: "ResourceRegistry singleton, registerResource, ResourceManifest"
provides:
  - "OnboardingPipeline: sequential chain from discovery event through fingerprint -> auth -> gate -> resource registration"
  - "DiscoveryService: singleton orchestrator managing all 4 scanners with start/stop/pause/resume and admin interface restrictions"
  - "Automatic device onboarding at observer trust tier with operator notification"
  - "Ironclaw analysis enqueueing for unknown devices via pg-boss"
  - "Device reconnection handling with persistent connections for higher trust tiers"
affects: [32-06, 32-07, 32-08, 32-09]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Sequential pipeline with stage-by-stage state transitions", "Singleton orchestrator with dependency injection", "Admin-enforced interface restrictions via PROTECTED_CONFIG_KEYS", "Persistent connection tracking by trust tier"]

key-files:
  created:
    - backend/src/discovery/onboarding-pipeline.ts
    - backend/src/discovery/discovery-service.ts
  modified: []

key-decisions:
  - "Devices default to 'sensors' resource category on auto-onboard"
  - "Observer trust tier assigned to all auto-onboarded devices per user decision"
  - "Pipeline errors quarantine devices rather than leaving intermediate state"
  - "Ironclaw jobs enqueued via pg-boss with fallback when boss unavailable"
  - "Persistent connections maintained only for participant/autonomous trust tiers"

patterns-established:
  - "Pipeline stage pattern: each stage updates device state, performs work, then transitions to next state or error"
  - "Discovery service singleton with getDiscoveryService() factory and explicit initialize() with dependency injection"
  - "Scanner event wiring: discovered -> pipeline, lost -> disconnect handler, error -> logging"

requirements-completed: [DISC-10, DISC-11, DISC-12]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 32 Plan 05: Onboarding Pipeline & Discovery Service Summary

**End-to-end onboarding pipeline chaining fingerprint/auth/gate/register stages with singleton discovery service orchestrating 4 transport scanners and enforcing admin interface restrictions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T16:49:47Z
- **Completed:** 2026-03-07T16:55:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- OnboardingPipeline with full deduplication, reconnection, and 6-stage processing (dedup, insert, fingerprint, auth, gate, onboard)
- DiscoveryService singleton orchestrating BLE, WiFi, USB, TAK scanners with lifecycle management
- Admin interface restriction enforcement preventing disabled scanners from starting
- Device reconnection with persistent connection tracking by trust tier

## Task Commits

Each task was committed atomically:

1. **Task 1: Create onboarding pipeline** - `a0cee8f` (feat)
2. **Task 2: Create discovery service singleton orchestrator** - `f95f86e` (feat)

## Files Created/Modified
- `backend/src/discovery/onboarding-pipeline.ts` - Sequential pipeline: dedup -> insert -> fingerprint -> auth -> gate -> onboard with Ironclaw enqueueing and message bus notifications (557 lines)
- `backend/src/discovery/discovery-service.ts` - Singleton orchestrator managing all 4 scanners, enforcing admin restrictions, handling reconnection, publishing lifecycle events (631 lines)

## Decisions Made
- Devices auto-onboard as 'sensors' category since discovery devices are primarily sensor-class
- Observer trust tier assigned to all auto-onboarded devices (can be promoted later via DAO)
- Pipeline errors always quarantine — never leave a device in an intermediate state
- Persistent connections tracked only for participant/autonomous trust tiers (observer is on-demand)
- Scanner events wired asynchronously with fire-and-forget error logging to avoid blocking scan loops

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Onboarding pipeline and discovery service ready for integration with REST/WebSocket API (Plan 06)
- Scanner lifecycle management ready for admin UI controls
- Ironclaw queue ready for Phase 30 tool-bridge consumption
- Device reconnection flow ready for operational use

## Self-Check: PASSED

All files exist and all commits verified.

---
*Phase: 32-network-device-discovery-and-secure-automatic-resource-onboarding*
*Completed: 2026-03-07*
