/**
 * Robot Module — Barrel Export
 *
 * Phase 06 Plan 01: Server-side foundation for autonomous vehicle integration.
 * Re-exports all public symbols from the robot module.
 */

// WebSocket setup
export { setupRobotWebSocket } from './robot-ws.js';

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
  RobotWsMessage,
  RobotRegisterMsg,
  RobotStateUpdateMsg,
  RobotTelemetryMsg,
  MissionAssignMsg,
  AuthRequestMsg,
  AuthResponseMsg,
  RobotAckMsg,
} from './robot-types.js';
