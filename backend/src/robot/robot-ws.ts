/**
 * Robot WebSocket Handler
 *
 * Phase 06 Plan 01: WebSocket server endpoint for robot connections.
 * Follows the pattern established by resource-ws.ts and discovery-ws.ts.
 *
 * Robots (Jetson clients) connect to /ws/robot, register themselves,
 * and exchange mission/telemetry messages via RobotMissionService.
 */

import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getRobotMissionService } from './robot-mission-service.js';
import { bridgeTokenStore } from './bridge-token-store.js';
import { getResourceRegistry } from '../resources/resource-registry.js';
import { RobotWsMessageType } from './robot-types.js';
import type { RobotAckMsg } from './robot-types.js';

// ---------------------------------------------------------------------------
// Extended WebSocket type — tracks which robot owns this connection
// ---------------------------------------------------------------------------

interface RobotWS extends WebSocket {
  robotId?: string;
}

// ---------------------------------------------------------------------------
// Token-based first-time registration helper
// ---------------------------------------------------------------------------

/**
 * Handle first-time robot registration via one-time token.
 * On success: consume the token, register robot as resource, assign DID,
 * and send back ack with the assigned DID so the robot can persist it.
 */
async function handleTokenRegistration(
  ws: RobotWS,
  msg: Record<string, unknown>,
  service: ReturnType<typeof import('./robot-mission-service.js').getRobotMissionService>,
): Promise<void> {
  const robotId = msg.robot_id as string;
  const token = msg.token as string;
  const capabilities = (msg.capabilities as string[]) ?? [];

  const result = await bridgeTokenStore.consume(token);
  if (!result.valid) {
    const errMsg: RobotAckMsg = {
      type: RobotWsMessageType.ack,
      ref_type: RobotWsMessageType.register,
      status: 'error',
      message: 'Token invalid or expired — contact administrator for a new token',
    };
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(errMsg));
    } catch { /* ignore */ }
    console.warn(`[RobotWS] Rejected robot ${robotId} — invalid registration token`);
    return;
  }

  // Register robot as a resource to get its DID
  const registry = getResourceRegistry();
  await registry.ensureInitialized();

  const resource = await registry.registerResource({
    name: (msg.name as string) || `Robot ${robotId}`,
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

  // Track on socket and register in service
  ws.robotId = robotId;

  // Re-call handleRobotMessage with a complete register message now that we have a DID
  service.handleRobotMessage(ws, {
    type: RobotWsMessageType.register,
    robot_id: robotId,
    did: resource.did,
    name: msg.name as string | undefined,
    capabilities,
    hardware_info: msg.hardware_info as Record<string, unknown> | undefined,
  });

  // Send robot:registered with DID so the Python client can persist it
  const registeredMsg = {
    type: RobotWsMessageType.registered,
    did: resource.did,
    robot_id: robotId,
  };
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(registeredMsg));
  } catch { /* ignore */ }

  console.log(`[RobotWS] Robot ${robotId} registered via token (DID: ${resource.did})`);
}

// ---------------------------------------------------------------------------
// Setup (overloaded — accepts either WebSocketServer or HTTPServer)
// ---------------------------------------------------------------------------

export function setupRobotWebSocket(wss: WebSocketServer): void;
export function setupRobotWebSocket(server: HTTPServer): void;
export function setupRobotWebSocket(serverOrWss: HTTPServer | WebSocketServer): void {
  const wss = serverOrWss instanceof WebSocketServer
    ? serverOrWss
    : new WebSocketServer({ server: serverOrWss, path: '/ws/robot' });

  const service = getRobotMissionService();

  wss.on('connection', (rawWs: WebSocket, request: import('http').IncomingMessage) => {
    const ws = rawWs as RobotWS;
    const remoteAddress = request.socket.remoteAddress ?? 'unknown';
    const remotePort = request.socket.remotePort ?? 0;
    console.log(`[RobotWS] New robot connection from ${remoteAddress}:${remotePort}`);
    // Stash network info on the socket for use during registration
    (ws as unknown as Record<string, unknown>)._remoteAddress = remoteAddress;
    (ws as unknown as Record<string, unknown>)._remotePort = remotePort;

    ws.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        console.warn('[RobotWS] Malformed JSON from robot, ignoring');
        return;
      }

      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      const msg = parsed as Record<string, unknown>;

      // Handle first-time token-based registration (robot has token but no DID yet)
      if (
        'type' in msg &&
        msg.type === RobotWsMessageType.register &&
        'robot_id' in msg &&
        'token' in msg &&
        !('did' in msg && msg.did)
      ) {
        handleTokenRegistration(ws, msg, service).catch((err) =>
          console.error('[RobotWS] Token registration error:', err),
        );
        return;
      }

      // Extract robot_id from register messages so we can track it on the socket
      if (
        'type' in msg &&
        msg.type === RobotWsMessageType.register &&
        'robot_id' in msg
      ) {
        ws.robotId = msg.robot_id as string;
      }

      service.handleRobotMessage(ws, parsed);
    });

    ws.on('close', () => {
      if (ws.robotId) {
        console.log(`[RobotWS] Robot disconnected: ${ws.robotId}`);
        service.handleRobotDisconnect(ws.robotId);
      } else {
        console.log('[RobotWS] Unregistered robot connection closed');
      }
    });

    ws.on('error', (err) => {
      console.error('[RobotWS] WebSocket error:', err);
    });
  });

  console.log('[RobotWS] WebSocket server mounted at /ws/robot');
}
