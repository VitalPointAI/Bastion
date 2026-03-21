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
  RobotVisionMsg,
  RobotProfileRequestMsg,
  SwarmTelemetryMsg,
  SwarmMemberHeartbeat,
} from './robot-types.js';
import { robotStore } from './robot-store.js';
import { gateService, expeditedAuthorize } from '../gates/gate-service.js';
import { GateType, GateEnforcement, GateStatus } from '../gates/gate-types.js';
import type { AuthResponseMsg } from './robot-types.js';
import { problemSetActivityStore } from '../problem-set/problem-set-activity-store.js';
import { getResourceRegistry } from '../resources/resource-registry.js';
import { resourceStore } from '../resources/resource-store.js';
import { getResourceTelemetryService } from '../resources/resource-telemetry.js';
import { getMissionProfileService } from './mission-profile-service.js';
import type { MissionProfile } from './mission-profile-service.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { bridgeSwarmTelemetryToCOP } from './swarm-cop-bridge.js';
import {
  writeEscalationRequestedEvent,
  writeAuthorizationDecisionEvent,
  writeMissionDispatchedEvent,
  writeMissionCompleteEvent,
  writeSwarmEventToGraph,
} from './swarm-graph-writer.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
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
    map_bounds: { north: 25.0480, south: 25.0420, east: 121.5180, west: 121.5120 },
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

  /** Get bridge info by bridge_id. Returns undefined if not connected. */
  getBridgeInfo(bridge_id: string): ConnectedBridge | undefined {
    return this.connectedBridges.get(bridge_id);
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
      case RobotWsMessageType.vision:
        this.handleVisionMsg(msg as RobotVisionMsg);
        break;
      case RobotWsMessageType.profile_request: {
        const profileReq = msg as RobotProfileRequestMsg;
        const resolvedProfile = this.resolveProfile(profileReq.profile_name, profileReq.command);
        this.safeSend(ws, {
          type: RobotWsMessageType.profile_response,
          profile: resolvedProfile,
          ref_message_id: profileReq.message_id,
        });
        break;
      }
      case RobotWsMessageType.swarm_telemetry:
        this.handleSwarmTelemetry(msg as SwarmTelemetryMsg).catch((err) =>
          console.error('[RobotMissionService] handleSwarmTelemetry error:', err),
        );
        break;
      default:
        console.warn('[RobotMissionService] Unknown message type:', (msg as { type: string }).type, JSON.stringify(msg).slice(0, 200));
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

    // Extract network info stashed on the socket by robot-ws.ts connection handler
    const wsAny = ws as unknown as Record<string, unknown>;
    const remoteAddress = (wsAny._remoteAddress as string) ?? 'unknown';
    const remotePort = (wsAny._remotePort as number) ?? 0;

    const connected: ConnectedRobot = {
      robot_id,
      ws,
      state: RobotConnectionState.connected,
      did,
      capabilities: capabilities ?? [],
      last_heartbeat: Date.now(),
      network: {
        remoteAddress,
        remotePort,
        connectedAt: new Date().toISOString(),
      },
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

    // Gate creation for awaiting_auth is handled by the autonomous orchestrator
    // when it manages the mission. For non-orchestrated missions (standalone
    // robot commands), the mission service creates the gate.
    if (state === RobotMissionState.awaiting_auth) {
      if (!await this.isOrchestratorManaged(mission_id)) {
        this.createAuthGate(robot_id, mission_id).catch((err) =>
          console.error('[RobotMissionService] Failed to create auth gate:', err),
        );
      }
    }

    // Write mission_complete event to brain graph on terminal states (non-blocking)
    if (state === RobotMissionState.complete || state === RobotMissionState.failed) {
      const missionForGraph = await robotStore.getMission(mission_id).catch(() => null);
      writeMissionCompleteEvent(
        missionForGraph?.problem_set_id || 'default',
        mission_id,
        robot_id,
        state === RobotMissionState.complete ? 'success' : `failed${reason ? `: ${reason}` : ''}`,
        'did:near:bastion.testnet',
      ).catch((err) => {
        console.warn('[RobotMissionService] Failed to write mission_complete graph event (non-fatal):', err);
      });
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
      console.warn(`[RobotMissionService] telemetry rejected: robot_id=${robot_id}, position=${JSON.stringify(position)}`);
      this.sendError(ws, 'telemetry: robot_id and position are required');
      return;
    }

    const robot = this.connectedRobots.get(robot_id);
    if (robot) {
      robot.last_heartbeat = Date.now();
      robot.latest_telemetry = { position, heading, battery };
    } else {
      console.warn(`[RobotMissionService] telemetry for unknown robot: ${robot_id} (known: ${[...this.connectedRobots.keys()].join(',')})`);
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

    // Resolve behavior profile before dispatch
    const profile = this.resolveProfile(mission.params.profile_name, mission.command);
    console.log(
      `[RobotMissionService] Mission ${mission.mission_id} using profile '${profile.name}'`,
    );

    // Pre-flight validation (DID, capabilities, speed, autonomy level)
    const robotDid = robot?.did ?? '';
    if (robotDid) {
      const preflight = await this.runPreFlightValidation(mission, robotDid);
      if (!preflight.valid) {
        const reason = preflight.reason ?? 'pre-flight validation failed';
        console.warn(`[RobotMissionService] Mission ${mission.mission_id} rejected — ${reason}`);
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

    // Write mission_dispatched event to brain graph (non-blocking)
    writeMissionDispatchedEvent(
      mission.problem_set_id || 'default',
      mission.mission_id,
      mission.robot_id,
      mission.command,
      'did:near:bastion.testnet',
    ).catch((err) => {
      console.warn('[RobotMissionService] Failed to write mission_dispatched graph event (non-fatal):', err);
    });

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
  private pollGateResolution(gateId: string, missionId: string, _robotId: string): void {
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
  // Lethal escalation gate lifecycle (Phase 48 Plan 07)
  // -------------------------------------------------------------------------

  /**
   * Create a lethal escalation gate ad-hoc when the swarm detects a threat
   * and requests engagement authority from the commander.
   *
   * The gate uses decision_context.escalation_type = 'lethal_force' to
   * differentiate it from standard robot_action_auth gates.
   *
   * @returns The created gate ID
   */
  async createLethalEscalationGate(
    missionId: string,
    swarmId: string,
    threatEntityId: string,
    threatDesignation: string,
    workspaceId?: string,
    nationalDid?: string,
  ): Promise<string> {
    // Derive problem_set_id from mission record
    const mission = await robotStore.getMission(missionId).catch(() => null);
    const problemSetId = mission?.problem_set_id || 'default';
    const resolvedWorkspaceId = workspaceId || problemSetId;
    const resolvedNationalDid = nationalDid || 'did:near:bastion.testnet';

    // Build lethal context BEFORE creating gate so the gate.created event
    // published by gateService includes is_lethal=true for COP notifications
    const lethalContext = {
      escalation_type: 'lethal_force' as const,
      threat_entity: threatEntityId,
      threat_designation: threatDesignation,
      swarm_id: swarmId,
      mission_id: missionId,
    };

    // Pre-set decision_context via store so it's present when publishGateEvent fires
    const gate = await gateService.createGate({
      problem_set_id: problemSetId,
      gate_type: GateType.robot_action_auth,
      target_item_id: threatEntityId,
      target_item_type: 'threat_entity',
      target_item_title: `Lethal Force Authorization — ${threatDesignation} — Swarm ${swarmId}`,
      enforcement: GateEnforcement.hard_block,
      mode: 'operational',
    });

    // Tag the gate with lethal context and advance to 'submitted' so it can
    // be approved (approveGate requires status='submitted' or 'escalated')
    await gateService['store'].update(gate.id, {
      status: 'submitted' as GateStatus,
      decision_context: {
        ...gate.decision_context,
        ...lethalContext,
      },
    });

    // Re-fetch gate with context and re-publish as update so frontend gets the lethal flag
    // (gate.created was already published by createGate — don't duplicate it)
    const updatedGate = await gateService.getGateById(gate.id);
    if (updatedGate) {
      gateService['publishGateEvent']('gate.updated', updatedGate);
    }

    console.log(
      `[RobotMissionService] Lethal escalation gate ${gate.id} created for swarm=${swarmId} threat=${threatDesignation}`,
    );

    // Also emit on swarm channel for swarm-specific listeners
    const messageBus = getMessageBus();
    messageBus.publish({
      sourceDid: resolvedNationalDid,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'swarm:escalation_requested',
      messageType: 'swarm.escalation.requested',
      payload: {
        gate_id: gate.id,
        swarm_id: swarmId,
        mission_id: missionId,
        threat_entity_id: threatEntityId,
        threat_designation: threatDesignation,
      },
    }).catch((err) => {
      console.warn('[RobotMissionService] Failed to publish escalation event:', err);
    });

    // Write to brain graph (non-blocking)
    writeEscalationRequestedEvent(
      resolvedWorkspaceId,
      missionId,
      swarmId,
      threatEntityId,
      resolvedNationalDid,
    ).catch((err) => {
      console.warn('[RobotMissionService] Failed to write escalation graph event (non-fatal):', err);
    });

    return gate.id;
  }

  /**
   * Handle a commander's decision on a lethal escalation gate.
   *
   * - 'approve': send swarm:engage_authorized, record blockchain audit trail
   * - 'deny': send swarm:hold to halt swarm, record blockchain audit trail
   *
   * Both paths write to the brain graph with DAO tx hash for provenance.
   */
  async handleEscalationDecision(
    gateId: string,
    decision: 'approve' | 'deny',
    commanderDid?: string,
    commanderSecret?: Uint8Array,
    workspaceId?: string,
    nationalDid?: string,
  ): Promise<void> {
    // Look up gate to get swarm/mission context
    const gate = await gateService.getGateById(gateId);
    if (!gate) {
      console.warn(`[RobotMissionService] handleEscalationDecision: gate ${gateId} not found`);
      return;
    }

    const ctx = gate.decision_context as Record<string, unknown>;
    const swarmId = (ctx.swarm_id as string) || 'unknown';
    const missionId = (ctx.mission_id as string) || gate.target_item_id;
    const threatEntityId = (ctx.threat_entity as string) || gate.target_item_id;
    const resolvedWorkspaceId = workspaceId || gate.problem_set_id;
    const resolvedNationalDid = nationalDid || 'did:near:bastion.testnet';
    const resolvedCommanderDid = commanderDid || 'did:near:commander.bastion.testnet';

    // Record decision on blockchain and update gate status
    const { txHash, gateStatus, blockchainStatus } = await expeditedAuthorize(
      gateId,
      decision,
      {
        swarm_id: swarmId,
        mission_id: missionId,
        threat_entity: threatEntityId,
        commander_did: resolvedCommanderDid,
        national_did: resolvedNationalDid,
        escalation_type: 'lethal_force',
      },
      commanderSecret,
    );

    console.log(
      `[RobotMissionService] Escalation ${decision}: gate=${gateId} gateStatus=${gateStatus} tx=${txHash} blockchain=${blockchainStatus}`,
    );

    // Look up leader robot for the swarm
    const mission = await robotStore.getMission(missionId).catch(() => null);
    const leaderId = mission?.robot_id;

    const messageBus = getMessageBus();

    if (decision === 'approve') {
      // Send engage_authorized to swarm leader
      if (leaderId) {
        const leader = this.connectedRobots.get(leaderId);
        if (leader) {
          this.safeSend(leader.ws, {
            type: 'swarm:engage_authorized',
            swarm_id: swarmId,
            target_entity_id: threatEntityId,
            gate_id: gateId,
            dao_tx_hash: txHash,
          });
        }
      }

      // Broadcast approval to COP via message bus
      messageBus.publish({
        sourceDid: resolvedNationalDid,
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'swarm:escalation_approved',
        messageType: 'swarm.escalation.approved',
        payload: {
          gate_id: gateId,
          swarm_id: swarmId,
          mission_id: missionId,
          threat_entity_id: threatEntityId,
          dao_tx_hash: txHash,
          commander_did: resolvedCommanderDid,
        },
      }).catch((err) => {
        console.warn('[RobotMissionService] Failed to publish escalation approval:', err);
      });
    } else {
      // Send hold command to swarm leader
      if (leaderId) {
        const leader = this.connectedRobots.get(leaderId);
        if (leader) {
          this.safeSend(leader.ws, {
            type: 'swarm:hold',
            swarm_id: swarmId,
            gate_id: gateId,
            reason: 'escalation_denied',
            dao_tx_hash: txHash,
          });
        }
      }

      // Broadcast denial to COP via message bus
      messageBus.publish({
        sourceDid: resolvedNationalDid,
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: 'swarm:escalation_denied',
        messageType: 'swarm.escalation.denied',
        payload: {
          gate_id: gateId,
          swarm_id: swarmId,
          mission_id: missionId,
          threat_entity_id: threatEntityId,
          dao_tx_hash: txHash,
          commander_did: resolvedCommanderDid,
        },
      }).catch((err) => {
        console.warn('[RobotMissionService] Failed to publish escalation denial:', err);
      });
    }

    // Write authorization decision to brain graph (non-blocking)
    writeAuthorizationDecisionEvent(
      resolvedWorkspaceId,
      missionId,
      swarmId,
      decision === 'approve' ? 'granted' : 'denied',
      txHash,
      resolvedCommanderDid,
      resolvedNationalDid,
    ).catch((err) => {
      console.warn('[RobotMissionService] Failed to write auth decision graph event (non-fatal):', err);
    });
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
      // Robot already registered — update status and sync capabilities (DB + cache)
      await registry.updateResourceStatus(existing.id, 'FMC');
      if (capabilities.length > 0) {
        await resourceStore.updateResource(existing.id, { capabilities });
        // Sync cache — getByDID returns the cached reference
        (existing as { capabilities: string[] }).capabilities = capabilities;
      }
      this.robotResourceIds.set(did, existing.id);
      console.log(`[RobotMissionService] Resource bridge: updated existing resource ${existing.id} to FMC (capabilities: ${capabilities.join(', ')})`);
      return;
    }

    // Register new resource — no missionId since robots span across missions
    const registered = await registry.registerResource({
      name: `Robot ${robotId}`,
      category: 'vehicles',
      specifications: {
        type: 'ground',
        maxSpeed: 1.5,
        maxRange: 100,
        payload: 0,
        fuelType: 'electric',
        autonomyLevel: 3,
      },
      isAutonomous: true,
      capabilities: capabilities.length > 0 ? capabilities : ['patrol', 'ISR'],
    });

    // Overwrite auto-generated DID with the robot's actual DID so pre-flight
    // validation (which looks up by robot DID) can find the resource.
    if (registered.did !== did) {
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();
      await pool.query('UPDATE resources SET did = $1 WHERE id = $2', [did, registered.id]);
      registry.reindexResourceDID(registered.id, registered.did, did);
    }

    this.robotResourceIds.set(did, registered.id);
    console.log(`[RobotMissionService] Resource bridge: registered robot ${robotId} as resource ${registered.id} (DID: ${did})`);
  }

  /**
   * Auto-register a swarm member robot in the resource registry via leader trust delegation.
   * Called from handleSwarmTelemetry when a member's DID is connected but not yet registered.
   * Trust metadata is stored in specifications so it survives in the DB record.
   */
  private async autoRegisterSwarmMember(
    member: SwarmMemberHeartbeat,
    leaderDid: string,
    leaderNationalDid: string,
  ): Promise<void> {
    const robot = this.connectedRobots.get(member.robot_id);
    if (!robot) return; // member not connected via WebSocket relay — skip

    const { did } = robot;

    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    // Idempotency — already registered
    if (registry.getByDID(did)) {
      if (!this.robotResourceIds.has(did)) {
        // Cache miss (e.g. server restart) — rebuild the map entry
        const existing = registry.getByDID(did);
        if (existing) this.robotResourceIds.set(did, existing.id);
      }
      return;
    }

    // Derive capabilities from swarm role
    const roleCapabilities: Record<string, string[]> = {
      leader:     ['patrol', 'ISR', 'command'],
      follower:   ['patrol', 'ISR'],
      unassigned: ['patrol'],
    };
    // Prefer robot's own capabilities if richer; fall back to role-derived
    const baseCaps = roleCapabilities[member.role] ?? ['patrol'];
    const effectiveCaps = robot.capabilities.length > 0 ? robot.capabilities : baseCaps;

    const registered = await registry.registerResource({
      name: `Robot ${member.robot_id} (swarm)`,
      category: 'vehicles',
      specifications: {
        type: 'ground',
        maxSpeed: 1.5,
        maxRange: 100,
        payload: 0,
        fuelType: 'electric',
        autonomyLevel: 3,
        // Trust delegation metadata
        trust_source: 'swarm_leader',
        trusted_by: leaderDid,
        coalition_national_did: leaderNationalDid,
      },
      isAutonomous: true,
      capabilities: effectiveCaps,
    });

    this.robotResourceIds.set(did, registered.id);
    console.log(
      `[RobotMissionService] Swarm member ${member.robot_id} auto-registered via leader trust ` +
      `(DID: ${registered.did}, trusted_by: ${leaderDid})`,
    );
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
  // Vision message handling (Phase 44)
  // -------------------------------------------------------------------------

  /** Handle an inbound robot:vision message from the robot. */
  handleVisionMsg(msg: RobotVisionMsg): void {
    const robot = this.connectedRobots.get(msg.robot_id);
    if (robot) {
      robot.latest_vision = msg;
    }

    if (msg.mission_id) {
      console.log(
        `[RobotMissionService] Vision event from ${msg.robot_id}, mission=${msg.mission_id}, detections=${msg.detections.length}`,
      );
    } else {
      console.log(
        `[RobotMissionService] Vision event from ${msg.robot_id} (idle), detections=${msg.detections.length}`,
      );
    }

    // Publish to message bus for UI and downstream consumers
    const messageBus = getMessageBus();
    messageBus.publish({
      sourceDid: robot?.did ?? msg.robot_id,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'robot:vision',
      messageType: 'robot.vision.detection',
      payload: msg as unknown as Record<string, unknown>,
    }).catch((err) => {
      console.warn('[RobotMissionService] Failed to publish vision event to message bus:', err);
    });

    // Log keyframe size for bandwidth monitoring
    if (msg.keyframe_jpeg_b64) {
      const sizeKb = Math.round((msg.keyframe_jpeg_b64.length * 3) / 4 / 1024);
      console.log(`[RobotMissionService] Vision keyframe from ${msg.robot_id}: ~${sizeKb} KB`);
    }

    // Directly notify the autonomous orchestrator of vision detections.
    // This bypasses the message bus (which routes through DB + ABAC + pg-boss)
    // to ensure reliable, low-latency threat detection during missions.
    if (msg.detections.length > 0) {
      import('./autonomous-mission-orchestrator.js').then(({ getAutonomousOrchestrator }) => {
        getAutonomousOrchestrator().handleVisionDetection(
          msg.robot_id,
          msg.detections.map((d) => ({
            class_desc: d.class_desc,
            confidence: d.confidence,
            center_x: d.center_x,
            center_y: d.center_y,
          })),
        );
      }).catch(() => { /* orchestrator not available */ });
    }

    // Process threat detections → COP layer + knowledge graph (non-blocking)
    if (msg.detections.length > 0) {
      const robotTelemetry = robot?.latest_telemetry;
      const robotPosition = robotTelemetry?.position
        ? roomToGeo(robotTelemetry.position.x, robotTelemetry.position.y)
        : null;

      // Resolve workspace: prefer problem_set_id on message, fall back to DB lookup
      const resolveWorkspace = async (): Promise<string | undefined> => {
        // Direct from simulator (avoids DB dependency)
        const directPsId = (msg as unknown as Record<string, unknown>).problem_set_id as string | undefined;
        if (directPsId) return directPsId;
        // Fall back to DB lookup via mission record
        if (msg.mission_id) {
          const mission = await robotStore.getMission(msg.mission_id).catch(() => null);
          return mission?.problem_set_id || undefined;
        }
        return undefined;
      };

      resolveWorkspace().then((workspaceId) => {
        console.log(`[RobotMissionService] Vision pipeline: workspace=${workspaceId ?? 'default'}, position=${robotPosition ? `${robotPosition.lat.toFixed(4)},${robotPosition.lng.toFixed(4)}` : 'null'}`);
        import('./vision-cop-pipeline.js').then(({ processVisionDetections }) => {
          processVisionDetections(msg, workspaceId, robotPosition).catch(err =>
            console.error('[RobotMissionService] Vision pipeline error:', err),
          );
        }).catch((err) => {
          console.error('[RobotMissionService] Vision pipeline module load failure:', err);
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // Manual control (D-pad nudge, navigate-to-point, emergency stop)
  // -------------------------------------------------------------------------

  /**
   * Send a manual control command to a connected robot.
   * Used by the COP D-pad and map click-to-navigate features.
   */
  sendManualCommand(
    robotId: string,
    command: { type: string; [key: string]: unknown },
  ): { success: boolean; error?: string } {
    const robot = this.connectedRobots.get(robotId);
    if (!robot) {
      return { success: false, error: `Robot '${robotId}' not connected` };
    }

    console.log(`[RobotMissionService] Manual command to ${robotId}: ${command.type}`);
    this.safeSend(robot.ws, command);
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Profile resolution (Phase 44)
  // -------------------------------------------------------------------------

  /** Resolve a mission behavior profile by name, falling back to command-based default. */
  resolveProfile(profileName?: string, command?: string): MissionProfile {
    const profileService = getMissionProfileService();

    if (profileName) {
      const resolved = profileService.resolveProfile(profileName);
      if (resolved) {
        console.log(`[RobotMissionService] Resolved profile '${profileName}' for command '${command ?? 'unspecified'}'`);
        return resolved;
      }
      console.warn(`[RobotMissionService] Profile '${profileName}' not found, falling back to command default`);
    }

    const defaultProfile = profileService.getDefaultProfileForCommand(command ?? '');
    console.log(
      `[RobotMissionService] Using default profile '${defaultProfile.name}' for command '${command ?? 'unspecified'}'`,
    );
    return defaultProfile;
  }

  // -------------------------------------------------------------------------
  // Swarm telemetry (Phase 46)
  // -------------------------------------------------------------------------

  /** Latest swarm telemetry from each swarm leader, keyed by swarm_id */
  private swarmStates = new Map<string, SwarmTelemetryMsg>();

  /**
   * Handle aggregated swarm telemetry from the leader.
   * Updates COP resource layer with positions of ALL swarm members.
   */
  private async handleSwarmTelemetry(msg: SwarmTelemetryMsg): Promise<void> {
    const { swarm_id, leader_id, members, state, formation, member_count } = msg;

    console.log(
      `[RobotMissionService] Swarm telemetry from ${leader_id}: swarm=${swarm_id}, ` +
      `state=${state}, formation=${formation}, members=${member_count}`,
    );

    const prevState = this.swarmStates.get(swarm_id);

    // Write swarm_formed event when a new swarm_id appears for the first time
    if (!prevState) {
      writeSwarmEventToGraph({
        swarmId: swarm_id,
        eventType: 'swarm_formed',
        timestamp: msg.timestamp || new Date().toISOString(),
        nationalDid: 'did:near:bastion.testnet',
        workspaceId: 'default',
        members: members.map((m) => m.robot_id),
        payload: {
          leader_id,
          formation,
          state,
          member_count,
        },
      }).catch((err) => {
        console.warn('[RobotMissionService] Failed to write swarm_formed graph event (non-fatal):', err);
      });
    }

    // Write formation_changed event when the formation type changes
    if (prevState && prevState.formation !== formation) {
      writeSwarmEventToGraph({
        swarmId: swarm_id,
        eventType: 'formation_changed',
        timestamp: msg.timestamp || new Date().toISOString(),
        nationalDid: 'did:near:bastion.testnet',
        workspaceId: 'default',
        members: members.map((m) => m.robot_id),
        payload: {
          previous_formation: prevState.formation,
          new_formation: formation,
          state,
        },
      }).catch((err) => {
        console.warn('[RobotMissionService] Failed to write formation_changed graph event (non-fatal):', err);
      });
    }

    this.swarmStates.set(swarm_id, msg);

    // Bridge swarm telemetry to COP layer as a SwarmFormationSpec (Phase 48)
    try {
      const messageBus = getMessageBus();
      bridgeSwarmTelemetryToCOP(msg, (event, data) => {
        messageBus.publish({
          sourceDid: this.connectedRobots.get(leader_id)?.did ?? leader_id,
          sourceType: 'system',
          destinationType: 'channel',
          destinationTarget: event,
          messageType: 'swarm.cop.update',
          payload: data as Record<string, unknown>,
        }).catch((err) => {
          console.warn('[RobotMissionService] Failed to publish swarm COP update:', err);
        });
      });
    } catch (err) {
      console.warn('[RobotMissionService] swarm-cop-bridge error (non-fatal):', err);
    }

    // Auto-register connected swarm members that lack a resource-registry entry
    // (leader trust delegation — no registration token required)
    const leaderRobot = this.connectedRobots.get(leader_id);
    const leaderResourceId = leaderRobot?.did ? this.robotResourceIds.get(leaderRobot.did) : undefined;
    if (leaderRobot && leaderResourceId) {
      // Leader is registered — use its national DID for coalition caveat inheritance
      const leaderNationalDid = 'did:near:bastion.testnet'; // default; extend if leaders carry national DID in future
      for (const member of members) {
        if (member.robot_id === leader_id) continue; // skip leader itself
        this.autoRegisterSwarmMember(member, leaderRobot.did, leaderNationalDid).catch((err) => {
          console.warn(`[RobotMissionService] Swarm member auto-registration failed for ${member.robot_id} (non-fatal):`, err);
        });
      }
    }

    // Forward each swarm member's position to the COP resource layer
    const telemetryService = getResourceTelemetryService();
    for (const member of members) {
      const geo = roomToGeo(member.position.x, member.position.y);
      const robot = this.connectedRobots.get(member.robot_id);
      const resourceId = robot?.did ? this.robotResourceIds.get(robot.did) : undefined;

      if (resourceId) {
        telemetryService.ingestTelemetry(resourceId, {
          lat: geo.lat,
          lng: geo.lng,
          heading: member.heading,
          speed: undefined,
        });
      }
    }

    // Publish swarm state to message bus for UI consumers
    const messageBus = getMessageBus();
    messageBus.publish({
      sourceDid: this.connectedRobots.get(leader_id)?.did ?? leader_id,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: 'swarm:telemetry',
      messageType: 'swarm.telemetry.update',
      payload: msg as unknown as Record<string, unknown>,
    }).catch((err) => {
      console.warn('[RobotMissionService] Failed to publish swarm telemetry to message bus:', err);
    });
  }

  /** Get current swarm state for a given swarm_id. */
  getSwarmState(swarmId: string): SwarmTelemetryMsg | undefined {
    return this.swarmStates.get(swarmId);
  }

  /** Get all active swarms. */
  getActiveSwarms(): SwarmTelemetryMsg[] {
    return Array.from(this.swarmStates.values());
  }

  /**
   * Send a DAO directive to add a resource to a swarm.
   * Forwards the message to the swarm leader's WebSocket.
   */
  sendSwarmAddResource(
    leaderId: string,
    robotId: string,
    resourceType: string,
    did?: string,
    capabilities: string[] = [],
    daoProposalId?: string,
  ): boolean {
    const leader = this.connectedRobots.get(leaderId);
    if (!leader) {
      console.warn(`[RobotMissionService] Swarm add: leader ${leaderId} not connected`);
      return false;
    }

    this.safeSend(leader.ws, {
      type: RobotWsMessageType.swarm_add_resource,
      robot_id: robotId,
      resource_type: resourceType,
      did,
      capabilities,
      dao_proposal_id: daoProposalId,
    });

    console.log(
      `[RobotMissionService] Sent swarm:add_resource for ${robotId} (${resourceType}) to leader ${leaderId}`,
    );
    return true;
  }

  /**
   * Send a DAO directive to remove a resource from a swarm.
   * Forwards the message to the swarm leader's WebSocket.
   */
  sendSwarmRemoveResource(
    leaderId: string,
    robotId: string,
    reason: string = 'dao_directive',
    daoProposalId?: string,
  ): boolean {
    const leader = this.connectedRobots.get(leaderId);
    if (!leader) {
      console.warn(`[RobotMissionService] Swarm remove: leader ${leaderId} not connected`);
      return false;
    }

    this.safeSend(leader.ws, {
      type: RobotWsMessageType.swarm_remove_resource,
      robot_id: robotId,
      reason,
      dao_proposal_id: daoProposalId,
    });

    console.log(
      `[RobotMissionService] Sent swarm:remove_resource for ${robotId} to leader ${leaderId}`,
    );
    return true;
  }

  // -------------------------------------------------------------------------
  // Pre-flight validation (Phase 44)
  // -------------------------------------------------------------------------

  /**
   * Run pre-flight validation before dispatching a mission.
   * Checks DID registration, capabilities, autonomy level, speed, and issuer DID format.
   */
  async runPreFlightValidation(
    mission: MissionJSON,
    robotDid: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    // Validate issuer DID format — must start with "did:"
    if (!mission.issued_by.startsWith('did:')) {
      return { valid: false, reason: `issued_by must be a valid DID (got: ${mission.issued_by})` };
    }

    // Look up robot in the resource registry
    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    const resource = registry.getByDID(robotDid);
    if (!resource) {
      return { valid: false, reason: `Robot not registered (DID: ${robotDid})` };
    }

    // Map command to required capability
    const commandCapabilityMap: Record<string, string> = {
      patrol_route: 'patrol',
      find_engage: 'find_engage',
      recon_area: 'ISR',
      visual_search: 'ISR',
      overwatch: 'patrol',
      resupply_route: 'resupply',
      swarm_patrol: 'swarm_leader',
      swarm_recon: 'swarm_leader',
      swarm_advance: 'swarm_leader',
    };

    const requiredCapability = commandCapabilityMap[mission.command];
    if (requiredCapability) {
      const hasCapability = resource.capabilities.includes(requiredCapability) ||
        resource.capabilities.includes('ISR') ||
        resource.capabilities.includes('patrol');

      if (!hasCapability && !['patrol_route', 'overwatch'].includes(mission.command)) {
        return {
          valid: false,
          reason: `Robot lacks required capability '${requiredCapability}' for command '${mission.command}'`,
        };
      }
    }

    // Check autonomy level — find_engage requires autonomyLevel >= 3
    const autonomyLevel = resource.specifications?.autonomyLevel as number | undefined;
    if (mission.command === 'find_engage' && autonomyLevel !== undefined && autonomyLevel < 3) {
      return {
        valid: false,
        reason: `Command 'find_engage' requires autonomy level >= 3 (robot has: ${autonomyLevel})`,
      };
    }

    // Resolve the profile to check speed limit
    const profile = this.resolveProfile(mission.params.profile_name, mission.command);
    if (mission.params.speed > profile.max_speed) {
      return {
        valid: false,
        reason: `Mission speed (${mission.params.speed}) exceeds profile '${profile.name}' max_speed (${profile.max_speed})`,
      };
    }

    return { valid: true };
  }

  // -------------------------------------------------------------------------
  // Intent translation (Phase 44)
  // -------------------------------------------------------------------------

  /**
   * Translate natural language intent into a MissionJSON array using Anthropic Claude.
   * This is the cloud path of the dual intent translation architecture.
   */
  async translateIntent(text: string, robotId: string, issuedBy: string): Promise<MissionJSON[]> {
    let llm;
    try {
      llm = await createLLMForAgent({ agentId: 'mission-translator' });
    } catch {
      console.error('[RobotMissionService] translateIntent: No LLM available');
      return [];
    }

    const systemPrompt = `You are a military mission planner. Convert natural language intent into structured mission JSON.

Available commands:
- patrol_route: Navigate a series of waypoints (params: waypoints array with x,y coords)
- find_engage: Search and engage a target (params: target_location with x,y, requires autonomy)
- recon_area: Reconnaissance of an area (params: area bounding box x_min,y_min,x_max,y_max)
- visual_search: Visual search for a target using camera (params: area, optionally reference_image_b64)
- overwatch: Hold position and monitor (params: target_location or area)
- resupply_route: Navigate a resupply corridor (params: waypoints)
- swarm_patrol: Formation patrol with multiple robots (params: waypoints, formation, spacing_m, technique)
- swarm_recon: Coordinated area recon with swarm (params: area, formation, spacing_m, technique)
- swarm_advance: Doctrinal advance toward target (params: target_location, formation, spacing_m, technique)

Formation types: line, wedge, column, echelon_left, echelon_right, vee
Movement techniques: traveling, traveling_overwatch, bounding_overwatch, successive_bounds

Output a JSON array of mission objects. Each mission must have:
- mission_id: a UUID v4
- robot_id: the robot ID provided
- command: one of the commands above
- params: object with speed (0-255), autonomy_policy (autonomous_actions:[], restricted_actions:[], max_speed:255, lethal_effects_permitted:false), and command-specific params
- issued_by: the issuer DID provided
- timestamp: current ISO timestamp

Return ONLY valid JSON, no markdown.`;

    try {
      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Robot ID: ${robotId}\nIssued by: ${issuedBy}\nIntent: ${text}`),
      ]);

      const responseText = typeof response.content === 'string'
        ? response.content
        : (response.content as Array<{ type: string; text?: string }>).find(b => b.type === 'text')?.text ?? '';

      let parsed: unknown;
      try {
        // Strip markdown code fences if present
        const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[RobotMissionService] translateIntent: failed to parse LLM response as JSON', parseErr);
        return [];
      }

      if (!Array.isArray(parsed)) {
        console.error('[RobotMissionService] translateIntent: LLM response is not an array');
        return [];
      }

      const missions: MissionJSON[] = [];
      for (const item of parsed) {
        const result = MissionJSONSchema.safeParse(item);
        if (result.success) {
          missions.push(result.data);
        } else {
          console.warn('[RobotMissionService] translateIntent: skipped invalid mission item:', result.error.flatten());
        }
      }

      console.log(`[RobotMissionService] translateIntent: generated ${missions.length} mission(s) from intent`);
      return missions;
    } catch (err) {
      console.error('[RobotMissionService] translateIntent: LLM call failed:', err);
      return [];
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
  ): Promise<{ state: RobotMissionState; command?: string } | null> {
    try {
      const row = await robotStore.getMission(missionId);
      if (!row) return null;
      return { state: row.state, command: row.command };
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

  // -------------------------------------------------------------------------
  // Simulation helpers (for virtual robot testing without hardware)
  // -------------------------------------------------------------------------

  /**
   * Register a simulated robot using a fake WebSocket.
   * The fake WS captures mission:assign messages and drives the simulation.
   * Returns a promise that resolves once the resource registry bridge completes
   * (needed so dispatchMission pre-flight validation can find the resource).
   */
  /**
   * Remove all simulated robots from the connected robots map.
   * Called before starting a real mission to prevent conflicts.
   */
  cleanupSimulatedRobots(): void {
    const simDids = ['did:near:sim-robot-alpha', 'did:near:sim-robot-bravo', 'did:near:sim-robot-charlie'];
    for (const [id, robot] of this.connectedRobots) {
      if (simDids.includes(robot.did) || robot.did.startsWith('did:near:sim-robot-')) {
        this.connectedRobots.delete(id);
        console.log(`[RobotMissionService] Cleaned up simulated robot: ${id} (${robot.did})`);
      }
    }
  }

  async registerSimulatedRobot(
    robotId: string,
    did: string,
    capabilities: string[],
    fakeWs: WebSocket,
  ): Promise<void> {
    const robot: ConnectedRobot = {
      robot_id: robotId,
      did,
      capabilities,
      ws: fakeWs,
      state: RobotConnectionState.connected,
      current_mission_id: undefined,
      last_heartbeat: Date.now(),
      network: { remoteAddress: '127.0.0.1', remotePort: 0, connectedAt: new Date().toISOString() },
    };
    this.connectedRobots.set(robotId, robot);
    console.log(`[RobotMissionService] Simulated robot registered: ${robotId} (DID: ${did})`);

    // Register directly in resource registry cache (no DB writes) so pre-flight
    // validation works immediately without depending on database availability
    const registry = getResourceRegistry();
    const simResourceId = `RES-sim-${robotId}`;
    registry.registerSimulated({
      id: simResourceId,
      did,
      name: `Robot ${robotId}`,
      category: 'vehicles',
      capabilities,
      specifications: { type: 'ground', maxSpeed: 1.5, maxRange: 100, payload: 0, fuelType: 'electric', autonomyLevel: 3 },
    });
    this.robotResourceIds.set(did, simResourceId);
    console.log(`[RobotMissionService] Sim robot ${robotId} registered in cache (DID: ${did}, resourceId: ${simResourceId})`);
  }

  /**
   * Handle a simulated state update (replaces the WS message path).
   */
  handleSimulatedStateUpdate(
    robotId: string,
    missionId: string,
    state: string,
  ): void {
    const robot = this.connectedRobots.get(robotId);
    if (!robot) return;

    // Create a synthetic state update message and process it
    const msg = {
      type: 'robot:state_update' as const,
      robot_id: robotId,
      mission_id: missionId,
      state,
    };

    // Use the same handler but skip WS ack (simulated)
    this.handleStateUpdateInternal(robot, msg).catch((err) =>
      console.error('[RobotMissionService] Simulated state update error:', err),
    );
  }

  /**
   * Update telemetry for a simulated robot (replaces the WS telemetry path).
   */
  updateSimulatedTelemetry(
    robotId: string,
    position: { x: number; y: number },
    heading: number,
    battery: number,
  ): void {
    const robot = this.connectedRobots.get(robotId);
    if (robot) {
      robot.last_heartbeat = Date.now();
      robot.latest_telemetry = { position, heading, battery };
    }

    // Forward to resource telemetry for COP
    this.forwardTelemetryToResources(robotId, position);
  }

  /**
   * Internal state update handler (shared between real WS and simulation).
   */
  private async handleStateUpdateInternal(
    robot: ConnectedRobot,
    msg: { robot_id: string; mission_id: string; state: string },
  ): Promise<void> {
    const { robot_id, mission_id, state } = msg;
    const stateEnum = state as RobotMissionState;

    // Update in-memory state
    if (stateEnum === RobotMissionState.executing || stateEnum === RobotMissionState.awaiting_auth) {
      robot.current_mission_id = mission_id;
    } else if (
      stateEnum === RobotMissionState.complete ||
      stateEnum === RobotMissionState.failed ||
      stateEnum === RobotMissionState.rejected
    ) {
      if (robot.current_mission_id === mission_id) {
        robot.current_mission_id = undefined;
      }
    }

    // Persist state change
    try {
      await robotStore.updateMissionState(mission_id, stateEnum);
    } catch { /* non-fatal for simulation */ }

    // Log to activity feed
    this.logMissionActivity(robot_id, mission_id, stateEnum).catch(() => {});

    // Gate creation for awaiting_auth — deferred to the single check
    if (stateEnum === RobotMissionState.awaiting_auth) {
      if (!await this.isOrchestratorManaged(mission_id)) {
        this.createAuthGate(robot_id, mission_id).catch(() => {});
      }
    }
  }

  /**
   * Check if a mission is managed by the autonomous orchestrator.
   * When managed, the orchestrator handles all gate decisions — the mission
   * service should NOT create its own gates.
   */
  private async isOrchestratorManaged(missionId: string): Promise<boolean> {
    try {
      const { getAutonomousOrchestrator } = await import('./autonomous-mission-orchestrator.js');
      const orchestrator = getAutonomousOrchestrator();
      return orchestrator.listSequences().some(
        (s: { missions: Record<string, string> }) => Object.values(s.missions).includes(missionId),
      );
    } catch {
      return false;
    }
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
