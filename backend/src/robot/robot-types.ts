/**
 * Robot Type Definitions
 *
 * Phase 06 Plan 01: Core type system for autonomous vehicle integration.
 * Uses const objects (not enums) per project convention (erasableSyntaxOnly).
 *
 * Covers mission JSON schema (zod-validated), WS message types, and
 * in-memory robot connection state.
 */

import { z } from 'zod';
import type { WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Robot Mission State — lifecycle of a dispatched mission
// ---------------------------------------------------------------------------

export const RobotMissionState = {
  pending: 'pending',
  accepted: 'accepted',
  executing: 'executing',
  awaiting_auth: 'awaiting_auth',
  complete: 'complete',
  failed: 'failed',
  rejected: 'rejected',
} as const;

export type RobotMissionState = (typeof RobotMissionState)[keyof typeof RobotMissionState];

// ---------------------------------------------------------------------------
// Robot Connection State — is the robot currently connected?
// ---------------------------------------------------------------------------

export const RobotConnectionState = {
  connected: 'connected',
  disconnected: 'disconnected',
} as const;

export type RobotConnectionState = (typeof RobotConnectionState)[keyof typeof RobotConnectionState];

// ---------------------------------------------------------------------------
// WebSocket Message Types
// ---------------------------------------------------------------------------

export const RobotWsMessageType = {
  register: 'robot:register',
  registered: 'robot:registered',
  state_update: 'robot:state_update',
  telemetry: 'robot:telemetry',
  mission_assign: 'mission:assign',
  mission_rejected: 'mission:rejected',
  auth_request: 'auth_request',
  auth_response: 'auth_response',
  ack: 'ack',
  error: 'error',
  // Bridge message types (Phase 43)
  bridge_register: 'bridge:register',
  bridge_registered: 'bridge:registered',
  bridge_discovery_report: 'bridge:discovery_report',
  bridge_robot_relay: 'bridge:robot_relay',
  // Vision message types (Phase 44)
  vision: 'robot:vision',
  profile_request: 'robot:profile_request',
  profile_response: 'robot:profile_response',
  // Manual control message types
  manual_nudge: 'robot:manual_nudge',
  manual_navigate: 'robot:manual_navigate',
  manual_stop: 'robot:manual_stop',
  // Resource allocation message types
  resource_request: 'resource:request',
  resource_granted: 'resource:granted',
  resource_denied: 'resource:denied',
  resource_released: 'resource:released',
  resource_command: 'resource:command',
  // Swarm message types (Phase 46)
  swarm_telemetry: 'swarm:telemetry',
  swarm_add_resource: 'swarm:add_resource',
  swarm_remove_resource: 'swarm:remove_resource',
} as const;

export type RobotWsMessageType = (typeof RobotWsMessageType)[keyof typeof RobotWsMessageType];

// ---------------------------------------------------------------------------
// Mission JSON Schema (zod-validated)
// ---------------------------------------------------------------------------

export const AutonomyPolicySchema = z.object({
  /** Actions the robot can execute without human authorization */
  autonomous_actions: z.array(z.string()).default([]),
  /** Actions that require human authorization via governance DAO */
  restricted_actions: z.array(z.string()).default([]),
  /** Maximum speed limit (0-255). Missions exceeding this are rejected. */
  max_speed: z.number().int().min(0).max(255).default(255),
  /** Whether lethal effects are permitted at all under this policy */
  lethal_effects_permitted: z.boolean().default(false),
});

export type AutonomyPolicy = z.infer<typeof AutonomyPolicySchema>;

export const MissionJSONSchema = z.object({
  /** Unique mission identifier */
  mission_id: z.string().uuid(),
  /** Target robot identifier */
  robot_id: z.string().min(1),
  /** Mission type */
  command: z.enum(['patrol_route', 'find_engage', 'recon_area', 'visual_search', 'overwatch', 'resupply_route', 'swarm_patrol', 'swarm_recon', 'swarm_advance']),
  /** Mission-specific parameters */
  params: z.object({
    /** Target location for find_engage missions (room-relative coordinates) */
    target_location: z.object({ x: z.number(), y: z.number() }).optional(),
    /** Waypoint sequence for patrol_route missions */
    waypoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    /** Speed setting 0-255 */
    speed: z.number().int().min(0).max(255),
    /** Optional duration cap in seconds */
    duration_sec: z.number().positive().optional(),
    /** Autonomy policy scoping what the robot can do without authorization */
    autonomy_policy: AutonomyPolicySchema,
    /** Behavior profile name to apply for this mission */
    profile_name: z.string().optional(),
    /** Operational area bounding box (room-relative coordinates) */
    area: z.object({
      x_min: z.number(),
      y_min: z.number(),
      x_max: z.number(),
      y_max: z.number(),
    }).optional(),
    /** Base64-encoded reference image for target matching (ORB feature matching) */
    reference_image_b64: z.string().optional(),
  }),
  /** DID of the entity issuing the mission (e.g. DAO account) */
  issued_by: z.string().min(1),
  /** ISO timestamp of mission creation */
  timestamp: z.string().datetime(),
  /** Optional auth token for gate-checked missions */
  auth_token: z.string().optional(),
  /** Problem set context for traceability */
  problem_set_id: z.string().optional(),
});

export type MissionJSON = z.infer<typeof MissionJSONSchema>;

// ---------------------------------------------------------------------------
// WebSocket Message Interfaces (Inbound — Robot → Bastion)
// ---------------------------------------------------------------------------

/** Robot → Bastion: announce connection and capabilities */
export interface RobotRegisterMsg {
  type: typeof RobotWsMessageType.register;
  robot_id: string;
  /** DID assigned by the resource registry (Phase 32) */
  did: string;
  /** Human-readable label for this robot */
  name?: string;
  /** Capability strings advertised by the robot (e.g. 'patrol', 'led_effects') */
  capabilities: string[];
  /** Firmware/model info */
  hardware_info?: Record<string, unknown>;
  /** One-time registration token (used for first-time DID assignment) */
  token?: string;
  /** Deduplication ID for this message */
  message_id?: string;
}

/** Robot → Bastion: report a mission state transition */
export interface RobotStateUpdateMsg {
  type: typeof RobotWsMessageType.state_update;
  robot_id: string;
  mission_id: string;
  state: RobotMissionState;
  /** Reason for rejection or failure (optional) */
  reason?: string;
  /** Current room-relative position at time of state change */
  position?: { x: number; y: number };
  timestamp: string;
  /** Deduplication ID for this message */
  message_id?: string;
}

/** Robot → Bastion: periodic telemetry heartbeat (~2 sec cadence) */
export interface RobotTelemetryMsg {
  type: typeof RobotWsMessageType.telemetry;
  robot_id: string;
  /** Current room-relative position */
  position: { x: number; y: number };
  /** Heading in degrees (0=North, clockwise) */
  heading: number;
  /** Battery level 0-100 */
  battery: number;
  /** Active mission if any */
  mission_id?: string;
  timestamp: string;
  /** Deduplication ID for this message */
  message_id?: string;
}

/** Robot → Bastion: robot requests human auth before executing restricted action */
export interface AuthRequestMsg {
  type: typeof RobotWsMessageType.auth_request;
  robot_id: string;
  mission_id: string;
  /** The restricted action that needs authorization */
  action: string;
  /** Contextual information for the authorization prompt */
  context?: Record<string, unknown>;
  timestamp: string;
  /** Deduplication ID for this message */
  message_id?: string;
}

// ---------------------------------------------------------------------------
// WebSocket Message Interfaces (Outbound — Bastion → Robot)
// ---------------------------------------------------------------------------

/** Bastion → Robot: dispatch a mission */
export interface MissionAssignMsg {
  type: typeof RobotWsMessageType.mission_assign;
  mission: MissionJSON;
}

/** Bastion → Robot: authorization decision for a pending auth request */
export interface AuthResponseMsg {
  type: typeof RobotWsMessageType.auth_response;
  robot_id: string;
  mission_id: string;
  action: string;
  /** true = approved, false = denied */
  approved: boolean;
  decided_by: string;
  timestamp: string;
}

/** Robot → Bastion: request additional resources for a mission */
export interface ResourceRequestMsg {
  type: typeof RobotWsMessageType.resource_request;
  robot_id: string;
  mission_id: string;
  /** What capabilities are needed from the requested resources */
  required_capabilities: string[];
  /** How many resources requested */
  count: number;
  /** Why resources are needed (shown in gate prompt) */
  reason: string;
  /** Optional: specific robot IDs to request */
  preferred_robots?: string[];
  timestamp: string;
}

/** Bastion → Robot: resources have been granted */
export interface ResourceGrantedMsg {
  type: typeof RobotWsMessageType.resource_granted;
  robot_id: string;
  mission_id: string;
  /** List of granted robot IDs the leader can now command */
  granted_robots: Array<{
    robot_id: string;
    capabilities: string[];
  }>;
  timestamp: string;
}

/** Bastion → Robot: resource request denied */
export interface ResourceDeniedMsg {
  type: typeof RobotWsMessageType.resource_denied;
  robot_id: string;
  mission_id: string;
  reason: string;
  timestamp: string;
}

/** Robot → Bastion: command a granted resource (relayed by backend) */
export interface ResourceCommandMsg {
  type: typeof RobotWsMessageType.resource_command;
  /** The leader robot sending the command */
  from_robot_id: string;
  /** The target robot to receive the command */
  target_robot_id: string;
  mission_id: string;
  /** The actual command to execute */
  command: {
    action: string;  // 'drive', 'drive_to_point', 'stop', 'set_leds'
    params: Record<string, unknown>;
  };
}

/** Bastion → Robot: general acknowledgment */
export interface RobotAckMsg {
  type: typeof RobotWsMessageType.ack;
  ref_type: RobotWsMessageType;
  status: 'ok' | 'error';
  message?: string;
}

// ---------------------------------------------------------------------------
// WebSocket Message Interfaces (Bridge — Bridge → Bastion)
// ---------------------------------------------------------------------------

/** Bridge → Bastion: register bridge device, token-based or DID-based */
export interface BridgeRegisterMsg {
  type: typeof RobotWsMessageType.bridge_register;
  bridge_id: string;
  /** One-time registration token (used for first-time DID assignment) */
  token?: string;
  /** DID for re-authentication on subsequent connects */
  did?: string;
  /** Capability strings (e.g. 'scanning', 'relay', 'queueing') */
  capabilities: string[];
  /** Deduplication ID for this message */
  message_id?: string;
}

/** Bastion → Bridge: registration confirmation with assigned DID */
export interface BridgeRegisteredMsg {
  type: typeof RobotWsMessageType.bridge_registered;
  did: string;
  bridge_id: string;
}

/** Bridge → Bastion: report of discovered devices from a scan */
export interface BridgeDiscoveryReportMsg {
  type: typeof RobotWsMessageType.bridge_discovery_report;
  bridge_id: string;
  devices: Array<{
    transport_type: string;
    raw_identifier: string;
    raw_data: Record<string, unknown>;
    signal_strength?: number;
  }>;
  /** ISO timestamp of when the scan was taken */
  scanned_at: string;
  /** Deduplication ID for this message */
  message_id?: string;
}

/** Bridge → Bastion: relay a robot message through the bridge */
export interface BridgeRobotRelayMsg {
  type: typeof RobotWsMessageType.bridge_robot_relay;
  bridge_id: string;
  robot_message: Record<string, unknown>;
  /** Deduplication ID for this message */
  message_id?: string;
}

// ---------------------------------------------------------------------------
// Vision message types (Phase 44)
// ---------------------------------------------------------------------------

/** Detection result from robot vision engine */
export interface VisionDetection {
  class_desc: string;
  confidence: number;
  bbox: { left: number; top: number; right: number; bottom: number };
  center_x?: number;
  center_y?: number;
}

/** Target match result from ORB feature matching */
export interface VisionTargetMatch {
  found: boolean;
  confidence: number;
  match_count: number;
}

/** Robot -> Bastion: vision detection event (asynchronous, on-detection) */
export interface RobotVisionMsg {
  type: typeof RobotWsMessageType.vision;
  robot_id: string;
  mission_id?: string;
  timestamp: string;
  detections: VisionDetection[];
  scene_description?: string;
  target_match?: VisionTargetMatch;
  keyframe_jpeg_b64?: string;
  message_id?: string;
}

/** Robot -> Bastion: request mission behavior profile */
export interface RobotProfileRequestMsg {
  type: typeof RobotWsMessageType.profile_request;
  profile_name?: string;
  command?: string;
  message_id?: string;
}

// ---------------------------------------------------------------------------
// Swarm types (Phase 46)
// ---------------------------------------------------------------------------

export const SwarmFormationType = {
  line: 'line',
  wedge: 'wedge',
  column: 'column',
  echelon_left: 'echelon_left',
  echelon_right: 'echelon_right',
  vee: 'vee',
} as const;

export type SwarmFormationType = (typeof SwarmFormationType)[keyof typeof SwarmFormationType];

export const SwarmState = {
  forming: 'forming',
  ready: 'ready',
  moving: 'moving',
  holding: 'holding',
  dispersing: 'dispersing',
} as const;

export type SwarmState = (typeof SwarmState)[keyof typeof SwarmState];

export const ResourceType = {
  rvr_plus: 'rvr_plus',
  drone: 'drone',
  ugv: 'ugv',
  sensor: 'sensor',
  relay: 'relay',
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

/** Swarm member heartbeat (included in aggregated telemetry) */
export interface SwarmMemberHeartbeat {
  robot_id: string;
  role: 'leader' | 'follower' | 'unassigned';
  position: { x: number; y: number };
  heading: number;
  battery_pct: number;
  slot_index?: number;
}

/** Leader → Bastion: aggregated swarm telemetry */
export interface SwarmTelemetryMsg {
  type: typeof RobotWsMessageType.swarm_telemetry;
  swarm_id: string;
  leader_id: string;
  state: SwarmState;
  formation: SwarmFormationType;
  member_count: number;
  members: SwarmMemberHeartbeat[];
  center_of_mass: { x: number; y: number };
  heading: number;
  timestamp: string;
  message_id?: string;
}

/** Bastion → Leader: DAO directive to add a resource to the swarm */
export interface SwarmAddResourceMsg {
  type: typeof RobotWsMessageType.swarm_add_resource;
  robot_id: string;
  resource_type: ResourceType;
  did?: string;
  capabilities: string[];
  dao_proposal_id?: string;
}

/** Bastion → Leader: DAO directive to remove a resource from the swarm */
export interface SwarmRemoveResourceMsg {
  type: typeof RobotWsMessageType.swarm_remove_resource;
  robot_id: string;
  reason: string;
  dao_proposal_id?: string;
}

// ---------------------------------------------------------------------------
// Union type for all inbound robot messages
// ---------------------------------------------------------------------------

export type RobotWsMessage =
  | RobotRegisterMsg
  | RobotStateUpdateMsg
  | RobotTelemetryMsg
  | AuthRequestMsg
  | BridgeRegisterMsg
  | BridgeDiscoveryReportMsg
  | BridgeRobotRelayMsg
  | RobotVisionMsg
  | RobotProfileRequestMsg
  | SwarmTelemetryMsg;

// ---------------------------------------------------------------------------
// Connected Robot — in-memory state for a live WS connection
// ---------------------------------------------------------------------------

/** Tracks a robot that is currently connected via WebSocket */
export interface ConnectedRobot {
  robot_id: string;
  /** Live WebSocket reference */
  ws: WebSocket;
  /** Current connection state */
  state: RobotConnectionState;
  /** Active mission ID if one is in progress */
  current_mission_id?: string;
  /** DID assigned by resource registry */
  did: string;
  /** Capability strings */
  capabilities: string[];
  /** Epoch ms of last telemetry/heartbeat */
  last_heartbeat: number;
  /** Latest telemetry snapshot */
  latest_telemetry?: {
    position: { x: number; y: number };
    heading: number;
    battery: number;
  };
  /** Latest vision event received from this robot */
  latest_vision?: RobotVisionMsg;
  /** Network metadata captured from WebSocket connection */
  network?: {
    remoteAddress: string;
    remotePort: number;
    connectedAt: string;
  };
}

// ---------------------------------------------------------------------------
// Connected Bridge — in-memory state for a live bridge WS connection
// ---------------------------------------------------------------------------

/** Tracks a bridge that is currently connected via WebSocket */
export interface ConnectedBridge {
  bridge_id: string;
  /** Live WebSocket reference */
  ws: WebSocket;
  /** DID assigned by resource registry */
  did: string;
  /** Capability strings (e.g. 'scanning', 'relay', 'queueing') */
  capabilities: string[];
  /** Epoch ms of last message/heartbeat */
  last_heartbeat: number;
  /** Robot IDs currently proxied through this bridge */
  connected_robots: string[];
  /** Problem set this bridge is associated with (for COP notifications) */
  problemSetId?: string;
  /** Alias for problemSetId */
  workspaceId?: string;
}
