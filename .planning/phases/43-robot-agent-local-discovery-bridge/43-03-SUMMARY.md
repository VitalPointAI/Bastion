---
phase: 43-robot-agent-local-discovery-bridge
plan: "03"
subsystem: robot-agent
tags: [python, websockets, mdns, zeroconf, did, auth, pydantic, asyncio]

# Dependency graph
requires:
  - phase: 43-01
    provides: common/mdns.py browse_service/advertise_service, common/ws_protocol.py stamp/send_stamped, common/models.py with message_id
  - phase: 43-02
    provides: bridge agent implementation context for dual-path connectivity design

provides:
  - robot/config.py extended with REGISTRATION_TOKEN, ROBOT_DID, DID_FILE, BRIDGE_HOST, BRIDGE_PORT, MDNS_BROWSE_TIMEOUT_SEC, load_persisted_did(), persist_did()
  - robot/models.py RegisterMsg with optional token/did/auth_token auth modes and message_id on all outbound types
  - robot/mission_client.py with discover_bridge(), _build_register_msg(), send_stamped for all outbound, dual-path failover
  - robot/tests/test_config.py — 14 tests for new config fields and DID persistence
  - robot/tests/test_robot_models.py — 8 tests for RegisterMsg auth modes and message_id
  - robot/tests/test_mdns_fallback.py — 4 tests for mDNS discovery and fallback
  - robot/tests/test_mission_client.py — 7 tests for auth modes, stamping, and discovery

affects: [43-04, 43-05, 43-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth priority chain: persisted DID > one-time token > legacy auth_token"
    - "discover_bridge() encapsulates mDNS + manual fallback in single coroutine"
    - "_build_register_msg() returns plain dict for stamping before send"
    - "send_stamped() replaces raw _ws_send for all robot outbound messages"
    - "Dual-path failover: direct cloud primary, bridge relay on ConnectionError"

key-files:
  created:
    - robot/tests/test_config.py
    - robot/tests/test_robot_models.py
    - robot/tests/test_mdns_fallback.py
    - robot/tests/test_mission_client.py
  modified:
    - robot/config.py
    - robot/models.py
    - robot/mission_client.py

key-decisions:
  - "AUTH_TOKEN made optional (was required) to enable DID-based auth without breaking legacy deployments"
  - "RegisterMsg.auth_token changed from str to Optional[str] — backward-compatible Pydantic change"
  - "discover_bridge() is a standalone coroutine called once at startup before connection loop"
  - "Dual-path is simple failover (one active connection), not simultaneous dual connections"
  - "Robot advertises itself via mDNS (_bastion-robot._tcp.local.) so bridge and peers can discover it"
  - "DID persistence uses a flat file (DID_FILE env var, default .robot_did) — simple and portable"

patterns-established:
  - "Pattern: stamp-before-send — all outbound robot messages use send_stamped, never raw ws.send"
  - "Pattern: config reload isolation — tests reload config module per test with env overrides"

requirements-completed: [BRIDGE-02, BRIDGE-05]

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 43 Plan 03: Robot Agent mDNS Discovery, DID Auth, and Bridge Fallback Summary

**robot/mission_client.py enhanced with mDNS bridge discovery (browse_service), DID-priority auth chain, send_stamped on all outbound messages, and direct-to-bridge dual-path failover; config and models extended for full DID lifecycle; 33 new tests green**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T21:35:03Z
- **Completed:** 2026-03-12T21:39:00Z
- **Tasks:** 2
- **Files modified:** 7 (3 modified, 4 created)

## Accomplishments

- Robot now discovers local bridge via mDNS before connecting, with configurable timeout (MDNS_BROWSE_TIMEOUT_SEC default 10s) and fallback to BRIDGE_HOST/BRIDGE_PORT env vars
- DID-based auth lifecycle complete: first-time token registration, server returns DID, persisted to DID_FILE, used on subsequent connections; legacy AUTH_TOKEN still works
- All outbound robot messages (registration, telemetry, state updates) now use send_stamped() from common.ws_protocol — all carry message_id
- Dual-path failover implemented: robot tries direct cloud WebSocket first, fails over to bridge relay on disconnect, then back to direct

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend robot config and models for DID auth, bridge fallback, and mDNS** - `c99179b` (feat)
2. **Task 2: Enhance mission_client with mDNS discovery, DID auth, message stamping, bridge fallback** - `f9ecd43` (feat)

_Note: Both tasks used TDD (RED → GREEN) approach_

## Files Created/Modified

- `robot/config.py` — Added REGISTRATION_TOKEN, ROBOT_DID, DID_FILE, BRIDGE_HOST, BRIDGE_PORT, BRIDGE_WS_URL, MDNS_BROWSE_TIMEOUT_SEC; AUTH_TOKEN made optional; added load_persisted_did() and persist_did() helpers
- `robot/models.py` — RegisterMsg.auth_token now Optional, added token= and did= fields, added message_id to StateUpdateMsg/TelemetryMsg/RegisterMsg
- `robot/mission_client.py` — Added discover_bridge(), _build_register_msg(), imported send_stamped/stamp, replaced all _ws_send with send_stamped, added dual-path failover in run(), added mDNS self-advertisement
- `robot/tests/test_config.py` — 14 tests for config env vars, defaults, DID persistence helpers
- `robot/tests/test_robot_models.py` — 8 tests for RegisterMsg auth modes and message_id fields
- `robot/tests/test_mdns_fallback.py` — 4 tests for mDNS discovery, timeout fallback, no-bridge case
- `robot/tests/test_mission_client.py` — 7 tests for auth message building, stamping availability

## Decisions Made

- AUTH_TOKEN changed from `_require()` to `_optional()` to enable DID-first auth without requiring legacy token in env
- RegisterMsg.auth_token changed to Optional[str] — Pydantic allows this without breaking existing callers that pass auth_token explicitly
- discover_bridge() uses a standalone pattern rather than inline in run() — testable in isolation via mock browse_service
- Dual-path is single-active-connection failover, not simultaneous — keeps connection state simple and avoids message duplication
- DID persisted to flat file rather than env var or DB — simpler, survives container restarts, portable to Jetson

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - clean execution throughout.

## User Setup Required

None - no external service configuration required. All new config vars (REGISTRATION_TOKEN, BRIDGE_HOST, etc.) have sensible empty defaults and are purely optional for backward compatibility.

## Next Phase Readiness

- robot/config.py, robot/models.py, and robot/mission_client.py are complete for the robot-side of the bridge protocol
- Ready for 43-04 (bridge server implementation) and 43-05 (end-to-end integration tests)
- 53 total tests green (20 existing + 33 new from this plan)

---
*Phase: 43-robot-agent-local-discovery-bridge*
*Completed: 2026-03-12*
