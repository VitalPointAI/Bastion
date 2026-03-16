---
phase: 48-robot-swarm-behaviour-end-to-end-demo
plan: "07"
subsystem: robot-governance
tags:
  - dao-governance
  - lethal-escalation
  - blockchain-audit
  - swarm
  - near

dependency_graph:
  requires:
    - 48-03
    - 48-04
  provides:
    - expedited-single-signer-authorization
    - lethal-escalation-gate-lifecycle
    - brain-graph-authorization-events
  affects:
    - backend/src/gates/gate-service.ts
    - backend/src/robot/robot-mission-service.ts
    - backend/src/robot/swarm-graph-writer.ts

tech_stack:
  added: []
  patterns:
    - expedited-single-signer-authorization via signAndSubmitFunctionCall
    - lethal-force escalation_type differentiator in decision_context
    - non-blocking brain graph write pattern (try/catch, non-fatal)
    - swarm:hold / swarm:engage_authorized WebSocket command pattern

key_files:
  created: []
  modified:
    - backend/src/gates/gate-service.ts
    - backend/src/robot/robot-mission-service.ts
    - backend/src/robot/swarm-graph-writer.ts

decisions:
  - "expeditedAuthorize falls back to local record when NEAR unavailable — demo does not stall on testnet issues"
  - "Lethal gates differentiated from standard gates via decision_context.escalation_type=lethal_force"
  - "commander secret parameter is optional — zero-key or absent triggers local-only audit trail"

metrics:
  duration_minutes: 15
  completed_date: "2026-03-16"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 48 Plan 07: DAO Governance — Expedited Authorization + Lethal Escalation Summary

Single-click commander authorization anchored on NEAR blockchain with full lethal escalation gate lifecycle (both approve/deny paths) and brain graph audit trail for every mission lifecycle event.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Expedited authorize + lethal escalation gate lifecycle | 4926b093 | gate-service.ts, robot-mission-service.ts |
| 2 | Brain graph convenience wrappers for all authorization events | e7383d08 | swarm-graph-writer.ts |

## What Was Built

### expeditedAuthorize (gate-service.ts)

Exported function that:
1. Records the authorization decision on NEAR blockchain via `signAndSubmitFunctionCall` using the commander's derived signing keypair
2. Updates gate status locally (`approved` or `rejected`) regardless of blockchain outcome
3. Falls back gracefully when NEAR testnet is unavailable — records locally with `blockchain_status: 'pending'`
4. Returns `{ txHash, gateStatus, blockchainStatus }` for downstream use

### Lethal Escalation Gate Lifecycle (robot-mission-service.ts)

Two new public methods on `RobotMissionService`:

**`createLethalEscalationGate(missionId, swarmId, threatEntityId, threatDesignation, workspaceId?, nationalDid?)`**
- Creates `robot_action_auth` gate with `decision_context.escalation_type = 'lethal_force'`
- Emits `swarm:escalation_requested` via message bus so frontend shows approval UI
- Writes `escalation_requested` event to brain graph (non-blocking)
- Returns gate ID

**`handleEscalationDecision(gateId, decision, commanderDid?, commanderSecret?, workspaceId?, nationalDid?)`**
- Calls `expeditedAuthorize()` — records decision on NEAR blockchain
- **Approve path:** sends `swarm:engage_authorized` to swarm leader WebSocket + broadcasts via message bus
- **Deny path:** sends `swarm:hold` to swarm leader WebSocket + broadcasts via message bus
- Writes `authorization_granted` or `authorization_denied` event to brain graph with DAO tx hash

Standard (non-lethal) gate flow via `createAuthGate()` is unchanged.

### Brain Graph Convenience Wrappers (swarm-graph-writer.ts)

Four new exported wrapper functions:
- `writeEscalationRequestedEvent(workspaceId, missionId, swarmId, threatEntityId, nationalDid)`
- `writeAuthorizationDecisionEvent(workspaceId, missionId, swarmId, decision, daoTxHash, commanderDid, nationalDid)`
- `writeMissionDispatchedEvent(workspaceId, missionId, swarmId, missionType, nationalDid)`
- `writeMissionCompleteEvent(workspaceId, missionId, swarmId, outcome, nationalDid)`

All call `writeSwarmEventToGraph()` internally with correct PROV-O provenance fields.

### Mission Lifecycle Wiring

- `dispatchMission()` now calls `writeMissionDispatchedEvent()` after successful dispatch
- `handleStateUpdate()` now calls `writeMissionCompleteEvent()` on `complete` or `failed` states

## Deviations from Plan

None — plan executed exactly as written. The `decision_context` direct store access (`gateService['store'].update()`) was used to tag lethal escalation context post-creation since `createGate` doesn't take `decision_context` in `CreateGateParams`. This is clean given the service owns the store.

## Self-Check

Verified:
- `expeditedAuthorize` exported from gate-service.ts at line 534
- `writeEscalationRequestedEvent`, `writeAuthorizationDecisionEvent`, `writeMissionDispatchedEvent`, `writeMissionCompleteEvent` all exported from swarm-graph-writer.ts
- `tsc --noEmit` passes with zero errors
