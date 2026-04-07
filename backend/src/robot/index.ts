/**
 * Robot Module — Barrel Export
 *
 * Phase 06 Plan 01: Server-side foundation for autonomous vehicle integration.
 * Phase 43 Plan 02: Bridge WebSocket handler, token store, and REST router added.
 * Re-exports all public symbols from the robot module.
 */

// WebSocket setup
export { setupRobotWebSocket } from './robot-ws.js';

// Bridge WebSocket setup and router (Phase 43)
export { setupBridgeWebSocket } from './bridge-ws.js';
export { bridgeRouter } from './bridge-router.js';

// Bridge token store (Phase 43)
export { bridgeTokenStore } from './bridge-token-store.js';
export type { TokenDeviceProperties } from './bridge-token-store.js';

// Mission service
export { getRobotMissionService, RobotMissionService } from './robot-mission-service.js';

// Store
export { robotStore, ensureRobotTables } from './robot-store.js';

// Types
export {
  RobotMissionState,
  RobotConnectionState,
  RobotWsMessageType,
  MissionJSONSchema,
} from './robot-types.js';

export type {
  MissionJSON,
  AutonomyPolicy,
  ConnectedRobot,
  ConnectedBridge,
  RobotWsMessage,
  RobotRegisterMsg,
  RobotStateUpdateMsg,
  RobotTelemetryMsg,
  MissionAssignMsg,
  AuthRequestMsg,
  AuthResponseMsg,
  RobotAckMsg,
  BridgeRegisterMsg,
  BridgeRegisteredMsg,
  BridgeDiscoveryReportMsg,
  BridgeRobotRelayMsg,
  SwarmTelemetryMsg,
  SwarmMemberHeartbeat,
  SwarmAddResourceMsg,
  SwarmRemoveResourceMsg,
} from './robot-types.js';

export {
  SwarmFormationType,
  SwarmState,
  ResourceType,
} from './robot-types.js';
