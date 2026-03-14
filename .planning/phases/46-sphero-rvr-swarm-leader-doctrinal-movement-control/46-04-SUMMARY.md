# Phase 46 Plan 04 Summary: Backend Swarm Types, Coordination Service & REST API

## Status: COMPLETE

## What was built

### Backend Swarm Types (`backend/src/robot/robot-types.ts`)
- Extended `MissionJSONSchema` with 3 swarm commands
- 3 new WS message types: `swarm_telemetry`, `swarm_add_resource`, `swarm_remove_resource`
- Const objects: `SwarmFormationType` (6 types), `SwarmState` (5 states), `ResourceType` (5 types)
- Interfaces: `SwarmMemberHeartbeat`, `SwarmTelemetryMsg`, `SwarmAddResourceMsg`, `SwarmRemoveResourceMsg`

### Swarm Coordination in Mission Service (`backend/src/robot/robot-mission-service.ts`)
- `handleSwarmTelemetry()`: stores swarm state, forwards **all member positions to COP resource layer** via `ResourceTelemetryService.ingestTelemetry()`, publishes to message bus
- `getSwarmState()` / `getActiveSwarms()`: query swarm state
- `sendSwarmAddResource()` / `sendSwarmRemoveResource()`: forward DAO directives to leader's WebSocket
- Pre-flight validation: `swarm_leader` capability required for swarm commands
- Intent translator: swarm commands, formation types, movement techniques added to LLM prompt

### REST API (`backend/src/api/robot-routes.ts`)
- `GET /swarms` — list all active swarms with members, formation, state
- `GET /swarms/:swarmId` — specific swarm state
- `POST /swarms/:leaderId/add-resource` — DAO add resource directive
- `POST /swarms/:leaderId/remove-resource` — DAO remove resource directive

### Barrel Exports (`backend/src/robot/index.ts`)
- All new types and const objects exported

## Files Modified
- `backend/src/robot/robot-types.ts`
- `backend/src/robot/robot-mission-service.ts`
- `backend/src/api/robot-routes.ts`
- `backend/src/robot/index.ts`

## Key Design Decision
Swarm telemetry pushes **every swarm member's position** to the COP resource layer, not just the leader. This ensures all swarm members (RVR+ units, drones, UGVs, sensors) are visible on the associated COP layer as individual resources.
