/**
 * Robot Mission Service
 *
 * Phase 06 Plan 01: Mission lifecycle management, robot connection tracking,
 * and WebSocket message routing.
 *
 * Singleton pattern via getRobotMissionService(). Maintains an in-memory
 * Map of connected robots keyed by robot_id. Persists missions and connection
 * records to PostgreSQL via robotStore.
 */

import { WebSocket } from 'ws';
import {
  RobotWsMessageType,
  RobotMissionState,
  RobotConnectionState,
  MissionJSONSchema,
} from './robot-types.js';
import type {
  ConnectedRobot,
  ConnectedBridge,
  RobotWsMessage,
  RobotRegisterMsg,
  RobotStateUpdateMsg,
  RobotTelemetryMsg,
  AuthRequestMsg,
  MissionAssignMsg,
  RobotAckMsg,
  MissionJSON,
} from './robot-types.js';
import { robotStore } from './robot-store.js';
import { gateService } from '../gates/gate-service.js';
import { GateType, GateEnforcement } from '../gates/gate-types.js';
import type { AuthResponseMsg } from './robot-types.js';
import { problemSetActivityStore } from '../problem-set/problem-set-activity-store.js';
import { getResourceRegistry } from '../resources/resource-registry.js';
import { getResourceTelemetryService } from '../resources/resource-telemetry.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Calibration profile for room-to-geo coordinate transform
const __rms_filename = fileURLToPath(import.meta.url);
const __rms_dirname = dirname(__rms_filename);
const CALIBRATION_FILE = join(__rms_dirname, '../../data/calibration-profiles.json');

interface CalibrationBounds {
  north: number; south: number; east: number; west: number;
}

function loadDefaultCalibration(): { room_width: number; room_height: number; map_bounds: CalibrationBounds } {
  try {
    if (existsSync(CALIBRATION_FILE)) {
      const profiles = JSON.parse(readFileSync(CALIBRATION_FILE, 'utf-8'));
      if (profiles.default) return profiles.default;
    }
  } catch { /* fallback below */ }
  return {
    room_width: 5,
    room_height: 5,
    map_bounds: { north: 25.001, south: 25.0, east: 121.501, west: 121.5 },
  };
}

/** Convert room-space (x, y) meters to geo (lat, lng) using calibration profile. */
function roomToGeo(x: number, y: number): { lat: number; lng: number } {
  const cal = loadDefaultCalibration();
  const { north, south, east, west } = cal.map_bounds;
  return {
    lat: south + (y / cal.room_height) * (north - south),
    lng: west + (x / cal.room_width) * (east - west),
  };
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class RobotMissionService {
  /** In-memory map of currently connected robots, keyed by robot_id */
  private connectedRobots = new Map<string, ConnectedRobot>();

  /** In-memory map of currently connected bridges, keyed by bridge_id */
  connectedBridges = new Map<string, ConnectedBridge>();

  /** Message IDs seen in the dedup window, value is receipt timestamp (epoch ms) */
  private seenMessageIds = new Map<string, number>();

  /** Dedup window: messages seen within this interval are considered duplicates */
  private readonly DEDUP_WINDOW_MS = 30_000;

  constructor() {
    // Periodically evict expired entries from the dedup map (every 60 seconds)
    setInterval(() => {
      const cutoff = Date.now() - this.DEDUP_WINDOW_MS;
      for (const [id, ts] of this.seenMessageIds) {
        if (ts < cutoff) this.seenMessageIds.delete(id);
      }
    }, 60_000);
  }

  // -------------------------------------------------------------------------
  // Message deduplication
  // -------------------------------------------------------------------------

  /**
   * Check if a message with this ID has already been processed.
   * If messageId is undefined or null, always returns false (no dedup).
   * Otherwise records the message_id and returns false on first seen,
   * true on subsequent sightings within the dedup window.
   */
  isDuplicate(messageId: string | undefined): boolean {
    if (!messageId) return false;
    if (this.seenMessageIds.has(messageId)) return true;
    this.seenMessageIds.set(messageId, Date.now());
    return false;
  }

  // -------------------------------------------------------------------------
  // Bridge connection management
  // -------------------------------------------------------------------------

  /** Register a newly connected bridge. Called from bridge-ws.ts after token/DID validation. */
  registerBridge(bridge_id: string, ws: WebSocket, did: string, capabilities: string[]): void {
    const bridge: ConnectedBridge = {
      bridge_id,
      ws,
      did,
      capabilities,
      last_heartbeat: Date.now(),
      connected_robots: [],
    };
    this.connectedBridges.set(bridge_id, bridge);
    console.log(`[RobotMissionService] Bridge registered: ${bridge_id} (DID: ${did})`);
  }

  /** Handle bridge WebSocket close — remove from connected bridges map. */
  handleBridgeDisconnect(bridge_id: string): void {
    this.connectedBridges.delete(bridge_id);
    console.log(`[RobotMissionService] Bridge disconnected: ${bridge_id}`);
  }

  /** Return all currently connected bridges for status reporting. */
  getConnectedBridges(): ConnectedBridge[] {
    return Array.from(this.connectedBridges.values());
  }

  // -------------------------------------------------------------------------
  // Main message router
  // -------------------------------------------------------------------------

  /** Route an inbound WS message to the appropriate handler. */
  handleRobotMessage(ws: WebSocket, raw: unknown): void {
    let msg: RobotWsMessage;
    try {
      msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as RobotWsMessage;
    } catch {
      console.warn('[RobotMissionService] Failed to parse message:', raw);
      this.sendError(ws, 'Invalid JSON');
      return;
    }

    if (!msg || typeof msg !== 'object' || !('type' in msg)) {
      this.sendError(ws, 'Missing message type');
      return;
    }

    // Deduplication check — drop messages we've already processed
    const msgWithId = msg as { message_id?: string };
    if (this.isDuplicate(msgWithId.message_id)) {
      console.debug(`[RobotMissionService] Dropped duplicate message (id: ${msgWithId.message_id})`);
      return;
    }

    switch (msg.type) {
      case RobotWsMessageType.register:
        this.handleRegister(ws, msg as RobotRegisterMsg).catch((err) =>
          console.error('[RobotMissionService] handleRegister error:', err),
        );
        break;
      case RobotWsMessageType.state_update:
        this.handleStateUpdate(ws, msg as RobotStateUpdateMsg).catch((err) =>
          console.error('[RobotMissionService] handleStateUpdate error:', err),
        );
        break;
      case RobotWsMessageType.telemetry:
        this.handleTelemetry(ws, msg as RobotTelemetryMsg).catch((err) =>
          console.error('[RobotMissionService] handleTelemetry error:', err),
        );
        break;
      case RobotWsMessageType.auth_request:
        this.handleAuthRequest(ws, msg as AuthRequestMsg).catch((err) =>
          console.error('[RobotMissionService] handleAuthRequest error:', err),
        );
        break;
      default:
        console.warn('[RobotMissionService] Unknown message type:', (msg as { type: string }).type);
        this.sendError(ws, `Unknown message type: ${(msg as { type: string }).type}`);
    }
  }

  // -------------------------------------------------------------------------
  // Register
  // -------------------------------------------------------------------------

  private async handleRegister(ws: WebSocket, msg: RobotRegisterMsg): Promise<void> {
    const { robot_id, did, capabilities } = msg;

    if (!robot_id || !did) {
      this.sendError(ws, 'register: robot_id and did are required');
      return;
    }

    const connected: ConnectedRobot = {
      robot_id,
      ws,
      state: RobotConnectionState.connected,
      did,
      capabilities: capabilities ?? [],
      last_heartbeat: Date.now(),
    };

    this.connectedRobots.set(robot_id, connected);

    // Persist connection record
    try {
      await robotStore.saveConnection({ robot_id, did, capabilities: capabilities ?? [] });
    } catch (err) {
      console.error('[RobotMissionService] Failed to persist connection:', err);
    }

    console.log(`[RobotMissionService] Robot registered: ${robot_id} (DID: ${did})`);

    // Auto-register robot as a resource in the resource discovery system
    this.bridgeToResourceRegistry(robot_id, did, capabilities ?? []).catch((err) =>
      console.warn('[RobotMissionService] Resource bridge registration failed (non-fatal):', err),
    );

    const ack: RobotAckMsg = {
      type: RobotWsMessageType.ack,
      ref_type: RobotWsMessageType.register,
      status: 'ok',
      message: `Registered as ${robot_id}`,
    };
    this.safeSend(ws, ack);
  }

  // -------------------------------------------------------------------------
  // State update
  // -------------------------------------------------------------------------

  private async handleStateUpdate(ws: WebSocket, msg: RobotStateUpdateMsg): Promise<void> {
    const { robot_id, mission_id, state, reason } = msg;

    if (!robot_id || !mission_id || !state) {
      this.sendError(ws, 'state_update: robot_id, mission_id, and state are required');
      return;
    }

    // Update in-memory robot entry
    const robot = this.connectedRobots.get(robot_id);
    if (robot) {
      if (state === RobotMissionState.complete || state === RobotMissionState.failed) {
        robot.current_mission_id = undefined;
      } else {
        robot.current_mission_id = mission_id;
      }
    }

    // Persist state change
    try {
      await robotStore.updateMissionState(mission_id, state, {
        rejectionReason: reason,
      });
    } catch (err) {
      console.error('[RobotMissionService] Failed to update mission state:', err);
    }

    console.log(`[RobotMissionService] Mission ${mission_id} → ${state}${reason ? ` (${reason})` : ''}`);

    // Log to activity feed for COP visibility
    this.logMissionActivity(robot_id, mission_id, state, reason).catch((err) =>
      console.warn('[RobotMissionService] Failed to log activity:', err),
    );

    // Create governance gate when mission enters awaiting_auth
    if (state === RobotMissionState.awaiting_auth) {
      this.createAuthGate(robot_id, mission_id).catch((err) =>
        console.error('[RobotMissionService] Failed to create auth gate:', err),
      );
    }

    const ack: RobotAckMsg = {
      type: RobotWsMessageType.ack,
      ref_type: RobotWsMessageType.state_update,
      status: 'ok',
    };
    this.safeSend(ws, ack);
  }

  // -------------------------------------------------------------------------
  // Telemetry
  // -------------------------------------------------------------------------

  private async handleTelemetry(ws: WebSocket, msg: RobotTelemetryMsg): Promise<void> {
    const { robot_id, position, heading, battery } = msg;

    if (!robot_id || !position) {
      this.sendError(ws, 'telemetry: robot_id and position are required');
      return;
    }

    const robot = this.connectedRobots.get(robot_id);
    if (robot) {
      robot.last_heartbeat = Date.now();
      robot.latest_telemetry = { position, heading, battery };
    }

    // Persist heartbeat timestamp
    try {
      await robotStore.updateConnectionHeartbeat(robot_id);
    } catch (err) {
      // Non-fatal — telemetry is high-frequency, don't crash on transient DB error
      console.warn('[RobotMissionService] Failed to update heartbeat:', err);
    }

    // Forward position to ResourceTelemetryService for COP resource layer
    this.forwardTelemetryToResources(robot_id, position);
  }

  // -------------------------------------------------------------------------
  // Auth request
  // -------------------------------------------------------------------------

  private async handleAuthRequest(_ws: WebSocket, msg: AuthRequestMsg): Promise<void> {
    const { robot_id, mission_id, action } = msg;

    console.log(
      `[RobotMissionService] Auth request from ${robot_id}: mission=${mission_id}, action=${action}`,
    );

    // Transition mission to awaiting_auth in the DB
    try {
      await robotStore.updateMissionState(mission_id, RobotMissionState.awaiting_auth);
    } catch (err) {
      console.error('[RobotMissionService] Failed to update mission to awaiting_auth:', err);
    }

    // Create governance gate for human authorization
    await this.createAuthGate(robot_id, mission_id, action).catch((err) =>
      console.error('[RobotMissionService] Failed to create auth gate from auth_request:', err),
    );
  }

  // -------------------------------------------------------------------------
  // Disconnect
  // -------------------------------------------------------------------------

  handleRobotDisconnect(robotId: string): void {
    if (!robotId) return;

    // Get robot DID before removing from map (needed for resource status update)
    const robot = this.connectedRobots.get(robotId);
    const robotDid = robot?.did;

    this.connectedRobots.delete(robotId);

    robotStore.removeConnection(robotId).catch((err) =>
      console.error('[RobotMissionService] Failed to mark robot disconnected:', err),
    );

    // Mark resource as NMC (Non-Mission Capable) on disconnect
    if (robotDid) {
      this.updateResourceStatusOnDisconnect(robotDid).catch((err) =>
        console.warn('[RobotMissionService] Failed to update resource status on disconnect:', err),
      );
    }

    console.log(`[RobotMissionService] Robot disconnected: ${robotId}`);
  }

  // -------------------------------------------------------------------------
  // Mission dispatch
  // -------------------------------------------------------------------------

  async dispatchMission(missionJson: unknown): Promise<{ success: boolean; error?: string }> {
    // Validate mission schema
    const parseResult = MissionJSONSchema.safeParse(missionJson);
    if (!parseResult.success) {
      const errors = parseResult.error.flatten().fieldErrors;
      console.warn('[RobotMissionService] Invalid mission JSON:', errors);
      return { success: false, error: `Mission validation failed: ${JSON.stringify(errors)}` };
    }

    const mission: MissionJSON = parseResult.data;

    // Find connected robot — direct connection or via bridge
    const robot = this.connectedRobots.get(mission.robot_id);

    // Check if any bridge has this robot in its connected_robots list
    let bridgeForRobot: ConnectedBridge | undefined;
    if (!robot) {
      for (const bridge of this.connectedBridges.values()) {
        if (bridge.connected_robots.includes(mission.robot_id)) {
          bridgeForRobot = bridge;
          break;
        }
      }
    }

    if (!robot && !bridgeForRobot) {
      return {
        success: false,
        error: `Robot ${mission.robot_id} is not connected (direct or via bridge)`,
      };
    }

    // Authority check: speed limit from autonomy policy
    const { speed, autonomy_policy } = mission.params;
    if (speed > autonomy_policy.max_speed) {
      const reason = `speed (${speed}) exceeds authority limit (${autonomy_policy.max_speed})`;
      console.warn(`[RobotMissionService] Mission ${mission.mission_id} rejected — ${reason}`);
      // Persist rejection
      await robotStore.saveMission({
        mission_id: mission.mission_id,
        robot_id: mission.robot_id,
        problem_set_id: mission.problem_set_id,
        command: mission.command,
        params: mission.params,
        issued_by: mission.issued_by,
        state: RobotMissionState.rejected,
      });
      await robotStore.updateMissionState(mission.mission_id, RobotMissionState.rejected, {
        rejectionReason: reason,
      });
      return { success: false, error: reason };
    }

    // Persist mission as pending
    try {
      await robotStore.saveMission({
        mission_id: mission.mission_id,
        robot_id: mission.robot_id,
        problem_set_id: mission.problem_set_id,
        command: mission.command,
        params: mission.params,
        issued_by: mission.issued_by,
        state: RobotMissionState.pending,
      });
    } catch (err) {
      console.error('[RobotMissionService] Failed to save mission:', err);
      return { success: false, error: 'DB error saving mission' };
    }

    const assignMsg: MissionAssignMsg = {
      type: RobotWsMessageType.mission_assign,
      mission,
    };

    if (robot) {
      // Direct connection — send to robot over WS
      robot.current_mission_id = mission.mission_id;
      this.safeSend(robot.ws, assignMsg);
      console.log(
        `[RobotMissionService] Dispatched mission ${mission.mission_id} to robot ${mission.robot_id} (direct)`,
      );
    } else if (bridgeForRobot) {
      // Relay via bridge
      this.safeSend(bridgeForRobot.ws, {
        type: 'bridge:mission_relay',
        robot_id: mission.robot_id,
        mission_assign: assignMsg,
      });
      console.log(
        `[RobotMissionService] Dispatched mission ${mission.mission_id} to robot ${mission.robot_id} via bridge ${bridgeForRobot.bridge_id}`,
      );
    }

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Activity feed integration
  // -------------------------------------------------------------------------

  /**
   * Log a robot mission state change to the problem set activity feed.
   */
  private async logMissionActivity(
    robotId: string,
    missionId: string,
    state: string,
    reason?: string,
  ): Promise<void> {
    const mission = await robotStore.getMission(missionId);
    if (!mission?.problem_set_id) return;

    const robot = this.connectedRobots.get(robotId);

    await problemSetActivityStore.log(
      mission.problem_set_id,
      `robot_mission_${state}`,
      robot?.did || robotId,
      null,
      {
        robot_id: robotId,
        mission_id: missionId,
        mission_command: mission.command,
        reason,
      },
    );
  }

  // -------------------------------------------------------------------------
  // Gate integration
  // -------------------------------------------------------------------------

  /**
   * Create a governance gate when a robot mission needs human authorization.
   */
  private async createAuthGate(robotId: string, missionId: string, action?: string): Promise<void> {
    // Look up mission to get problem_set_id
    const mission = await robotStore.getMission(missionId);
    if (!mission) {
      console.warn(`[RobotMissionService] Cannot create gate — mission ${missionId} not found`);
      return;
    }

    const problemSetId = mission.problem_set_id || 'default';

    const gate = await gateService.createGate({
      problem_set_id: problemSetId,
      gate_type: GateType.robot_action_auth,
      target_item_id: missionId,
      target_item_type: 'robot_mission',
      target_item_title: `Robot Authorization — ${action || 'restricted action'} — Mission ${missionId}`,
      enforcement: GateEnforcement.hard_block,
      mode: 'operational',
    });

    // Store gate_id on the mission record
    await robotStore.updateMissionState(missionId, RobotMissionState.awaiting_auth, {
      gateId: gate.id,
    });

    console.log(`[RobotMissionService] Gate ${gate.id} created for mission ${missionId}`);

    // Start polling for gate resolution
    this.pollGateResolution(gate.id, missionId, robotId);
  }

  /**
   * Handle gate resolution — send auth response to robot via WS.
   * Called by gate polling or manual auth endpoint.
   */
  async handleGateResolution(missionId: string, approved: boolean, decidedBy?: string): Promise<void> {
    const mission = await robotStore.getMission(missionId);
    if (!mission) {
      console.warn(`[RobotMissionService] Cannot resolve auth — mission ${missionId} not found`);
      return;
    }

    const robot = this.connectedRobots.get(mission.robot_id);
    if (!robot) {
      console.warn(`[RobotMissionService] Robot ${mission.robot_id} not connected for auth response`);
    }

    // Send auth response to robot
    if (robot) {
      const authResponse: AuthResponseMsg = {
        type: RobotWsMessageType.auth_response,
        robot_id: mission.robot_id,
        mission_id: missionId,
        action: 'restricted_action',
        approved,
        decided_by: decidedBy || 'system',
        timestamp: new Date().toISOString(),
      };
      this.safeSend(robot.ws, authResponse);
    }

    // Update mission state
    if (approved) {
      await robotStore.updateMissionState(missionId, RobotMissionState.executing);
      const r = this.connectedRobots.get(mission.robot_id);
      if (r) r.current_mission_id = missionId;
    } else {
      await robotStore.updateMissionState(missionId, RobotMissionState.failed, {
        rejectionReason: 'authorization_denied',
      });
      const r = this.connectedRobots.get(mission.robot_id);
      if (r) r.current_mission_id = undefined;
    }

    console.log(`[RobotMissionService] Mission ${missionId} auth ${approved ? 'approved' : 'denied'}`);
  }

  /**
   * Poll gate status until resolved. Checks every 2 seconds.
   */
  private pollGateResolution(gateId: string, missionId: string, robotId: string): void {
    const interval = setInterval(async () => {
      try {
        const gate = await gateService.getGateById(gateId);
        if (!gate) {
          clearInterval(interval);
          return;
        }

        if (gate.status === 'approved') {
          clearInterval(interval);
          await this.handleGateResolution(missionId, true, gate.decided_by || 'gate');
        } else if (gate.status === 'rejected') {
          clearInterval(interval);
          await this.handleGateResolution(missionId, false, gate.decided_by || 'gate');
        }
        // Otherwise keep polling (pending/submitted/escalated)
      } catch (err) {
        console.error(`[RobotMissionService] Gate poll error for ${gateId}:`, err);
        clearInterval(interval);
      }
    }, 2000);

    // Safety timeout: stop polling after 10 minutes
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
  }

  // -------------------------------------------------------------------------
  // Resource discovery bridge
  // -------------------------------------------------------------------------

  /** Robot DID -> resource ID mapping for telemetry forwarding */
  private robotResourceIds = new Map<string, string>();

  /**
   * Auto-register a connected robot as a Resource in the resource discovery system.
   * Creates or updates a 'vehicles' category resource with the robot's DID and capabilities.
   */
  private async bridgeToResourceRegistry(
    robotId: string,
    did: string,
    capabilities: string[],
  ): Promise<void> {
    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    // Check if resource already exists by DID
    const existing = registry.getByDID(did);
    if (existing) {
      // Robot already registered — update status to FMC (back online)
      await registry.updateResourceStatus(existing.id, 'FMC');
      this.robotResourceIds.set(did, existing.id);
      console.log(`[RobotMissionService] Resource bridge: updated existing resource ${existing.id} to FMC`);
      return;
    }

    // Register new resource — requires a missionId; use a system-level placeholder
    // since robots aren't scoped to a single mission
    const registered = await registry.registerResource({
      name: `Robot ${robotId}`,
      category: 'vehicles',
      missionId: 'system', // robots span across missions
      specifications: {
        robot_id: robotId,
        type: 'autonomous_ground_vehicle',
        connection: 'websocket',
      },
      isAutonomous: true,
      capabilities: capabilities.length > 0 ? capabilities : ['patrol', 'ISR'],
    });

    this.robotResourceIds.set(did, registered.id);
    console.log(`[RobotMissionService] Resource bridge: registered robot ${robotId} as resource ${registered.id} (DID: ${registered.did})`);
  }

  /**
   * Forward robot telemetry (room-space position) to the ResourceTelemetryService
   * so the robot appears on the COP resource layer alongside other resources.
   */
  private forwardTelemetryToResources(
    robotId: string,
    position: { x: number; y: number },
  ): void {
    const robot = this.connectedRobots.get(robotId);
    if (!robot) return;

    const resourceId = this.robotResourceIds.get(robot.did);
    if (!resourceId) return;

    // Convert room coordinates to geo coordinates using calibration profile
    const geo = roomToGeo(position.x, position.y);

    const telemetryService = getResourceTelemetryService();
    telemetryService.ingestTelemetry(resourceId, {
      lat: geo.lat,
      lng: geo.lng,
      heading: robot.latest_telemetry?.heading,
      speed: undefined, // room-space speed not directly convertible
    });
  }

  /**
   * Mark the robot's resource as NMC (Non-Mission Capable) when it disconnects.
   */
  private async updateResourceStatusOnDisconnect(did: string): Promise<void> {
    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    const resourceId = this.robotResourceIds.get(did);
    if (resourceId) {
      await registry.updateResourceStatus(resourceId, 'NMC');
      this.robotResourceIds.delete(did);
      console.log(`[RobotMissionService] Resource bridge: marked resource ${resourceId} as NMC (disconnected)`);
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getConnectedRobots(): ConnectedRobot[] {
    return Array.from(this.connectedRobots.values());
  }

  async getMissionStatus(
    missionId: string,
  ): Promise<{ state: RobotMissionState } | null> {
    try {
      const row = await robotStore.getMission(missionId);
      if (!row) return null;
      return { state: row.state };
    } catch (err) {
      console.error('[RobotMissionService] getMissionStatus error:', err);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private safeSend(ws: WebSocket, payload: unknown): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    } catch (err) {
      console.error('[RobotMissionService] safeSend error:', err);
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    const errMsg: RobotAckMsg = {
      type: RobotWsMessageType.ack,
      ref_type: RobotWsMessageType.error as RobotWsMessageType,
      status: 'error',
      message,
    };
    this.safeSend(ws, errMsg);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: RobotMissionService | null = null;

export function getRobotMissionService(): RobotMissionService {
  if (!_instance) {
    _instance = new RobotMissionService();
  }
  return _instance;
}
