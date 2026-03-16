---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "02"
subsystem: robot-swarm-cop-bridge
tags: [swarm, cop, telemetry, bridge, types, robot]
dependency_graph:
  requires: []
  provides:
    - SwarmFormationSpec type in layer-types.ts
    - swarm-cop-bridge.ts service
    - COP event bus swarm update emission
  affects:
    - backend/src/cop/layers/layer-types.ts
    - backend/src/robot/robot-mission-service.ts
tech_stack:
  added: []
  patterns:
    - Dynamic import pattern (mirrors vision-cop-pipeline.ts)
    - Calibration profile fallback (mirrors robot-mission-service.ts roomToGeo)
    - Message bus publish for COP channel emission
key_files:
  created:
    - backend/src/robot/swarm-cop-bridge.ts
  modified:
    - backend/src/cop/layers/layer-types.ts
    - backend/src/robot/robot-mission-service.ts
decisions:
  - Used message bus publish (not WebSocket broadcast) for COP emission, consistent with existing swarm telemetry pattern
  - inferTechnique heuristic maps SwarmState to movement technique since SwarmTelemetryMsg has no technique field
  - roomToGeo exported from swarm-cop-bridge.ts (reusable), mirrors private function in robot-mission-service.ts
  - copState mapped with string cast to handle 'contact' state not in SwarmState union but valid in SwarmFormationSpec
metrics:
  duration: "~8 min"
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_modified: 3
---

# Phase 48 Plan 02: Swarm COP Layer Types and Bridge Service Summary

Swarm telemetry bridge — converts robot-space SwarmTelemetryMsg to geo-coordinate SwarmFormationSpec and emits to COP event bus.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend layer-types.ts with swarm COP types | 2e9d368f | backend/src/cop/layers/layer-types.ts |
| 2 | Create swarm-cop-bridge service and wire into robot-mission-service | eac9ea97 | backend/src/robot/swarm-cop-bridge.ts, backend/src/robot/robot-mission-service.ts |

## What Was Built

**layer-types.ts** — Added `'swarm'` to `COPLayerType` union and three new exported interfaces:
- `SwarmMemberSpec`: individual member in geo coordinates (robotId, role, position, slotIndex, batteryPct, optional nationalDid)
- `DetectionAttribution`: links a robot's vision detection to a COP symbol entity for provenance tracking
- `SwarmFormationSpec`: full formation description with swarmId, leaderId, state, formation, technique, memberCount, members, centerOfMass, heading, optional missionId and detectionAttributions

**swarm-cop-bridge.ts** — New service with two exports:
- `roomToGeo(x, y, calibration?)`: converts room-space meters to geo LatLng — reusable, mirrors the private function in robot-mission-service.ts
- `bridgeSwarmTelemetryToCOP(msg, emit)`: converts SwarmTelemetryMsg to SwarmFormationSpec (with full geo coordinate mapping), assigns leader/follower roles, infers movement technique from swarm state, calls `emit('swarm:cop_update', spec)`, returns spec

**robot-mission-service.ts** — In `handleSwarmTelemetry()`, after `swarmStates.set()`, calls `bridgeSwarmTelemetryToCOP` with a message bus emit callback targeting `swarm:cop_update` channel. Non-fatal error handling wraps the call.

## Decisions Made

1. **Message bus over WebSocket broadcast**: Used `getMessageBus().publish()` to emit the COP update, consistent with how existing swarm telemetry and vision events are propagated. COP clients subscribe to the message bus channel.

2. **Technique inference heuristic**: `SwarmTelemetryMsg` has no `technique` field (robot-types.ts). A state-based heuristic maps `moving→traveling`, `holding→traveling_overwatch`, `contact→bounding_overwatch`, else `traveling`.

3. **State type mapping**: `SwarmState` in robot-types.ts does not include `'contact'` but `SwarmFormationSpec.state` does. A string-cast mapping handles this safely with the cast only applied when the value is literally `'contact'`.

4. **Calibration profile reuse**: swarm-cop-bridge.ts has its own `loadDefaultCalibration()` (same logic, same fallback) rather than importing from robot-mission-service.ts to avoid circular imports and keep the bridge module self-contained.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] State type mismatch: 'contact' not in SwarmState union**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `SwarmFormationSpec.state` includes `'contact'` but `SwarmTelemetryMsg['state']` is typed as `SwarmState` which only has `forming|ready|moving|holding|dispersing`
- **Fix:** Added explicit string cast in state mapping in `swarm-cop-bridge.ts`; changed `inferTechnique` parameter from `SwarmTelemetryMsg['state']` to `string` to accommodate future state additions
- **Files modified:** backend/src/robot/swarm-cop-bridge.ts
- **Commit:** eac9ea97 (included in Task 2 commit)

## Verification

- `npx tsc --noEmit` passes cleanly (only pre-existing test file error unrelated to this plan)
- `backend/src/robot/swarm-cop-bridge.ts` exists and exports `bridgeSwarmTelemetryToCOP` and `roomToGeo`
- `backend/src/cop/layers/layer-types.ts` includes `'swarm'` in COPLayerType union
- `robot-mission-service.ts` imports and calls `bridgeSwarmTelemetryToCOP` in `handleSwarmTelemetry`

## Self-Check: PASSED

- [x] backend/src/robot/swarm-cop-bridge.ts exists
- [x] backend/src/cop/layers/layer-types.ts modified
- [x] backend/src/robot/robot-mission-service.ts modified
- [x] Commit 2e9d368f exists (Task 1)
- [x] Commit eac9ea97 exists (Task 2)
