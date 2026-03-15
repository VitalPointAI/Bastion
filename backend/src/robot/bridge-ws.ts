/**
 * Bridge WebSocket Handler
 *
 * Phase 43 Plan 02: WebSocket server endpoint for bridge connections.
 * Bridges connect to /ws/bridge, register via one-time token (first connect)
 * or DID (subsequent connects), then relay discovery reports and robot messages.
 *
 * Pattern follows robot-ws.ts: overloaded function accepts HTTPServer or
 * WebSocketServer, delegates to RobotMissionService singleton for state.
 */

import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getRobotMissionService } from './robot-mission-service.js';
import { bridgeTokenStore } from './bridge-token-store.js';
import { getResourceRegistry } from '../resources/resource-registry.js';
import { getDiscoveryService } from '../discovery/discovery-service.js';
import type { TransportType } from '../discovery/types.js';
import { notifyCOPChange } from '../cop/index.js';
import type {
  BridgeRegisterMsg,
  BridgeDiscoveryReportMsg,
  BridgeRobotRelayMsg,
  BridgeRegisteredMsg,
} from './robot-types.js';
import { RobotWsMessageType } from './robot-types.js';

// ---------------------------------------------------------------------------
// Extended WebSocket type — tracks which bridge owns this connection
// ---------------------------------------------------------------------------

interface BridgeWS extends WebSocket {
  bridgeId?: string;
}

// ---------------------------------------------------------------------------
// Helper: safe JSON send
// ---------------------------------------------------------------------------

function safeSend(ws: WebSocket, payload: unknown): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  } catch (err) {
    console.error('[BridgeWS] safeSend error:', err);
  }
}

function sendError(ws: WebSocket, message: string): void {
  safeSend(ws, { type: 'error', message });
}

// ---------------------------------------------------------------------------
// Setup (overloaded — accepts either WebSocketServer or HTTPServer)
// ---------------------------------------------------------------------------

export function setupBridgeWebSocket(wss: WebSocketServer): void;
export function setupBridgeWebSocket(server: HTTPServer): void;
export function setupBridgeWebSocket(serverOrWss: HTTPServer | WebSocketServer): void {
  const wss = serverOrWss instanceof WebSocketServer
    ? serverOrWss
    : new WebSocketServer({ server: serverOrWss, path: '/ws/bridge' });

  const service = getRobotMissionService();

  wss.on('connection', (rawWs: WebSocket) => {
    const ws = rawWs as BridgeWS;
    console.log('[BridgeWS] New bridge connection');

    ws.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        console.warn('[BridgeWS] Malformed JSON from bridge, ignoring');
        return;
      }

      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
        sendError(ws, 'Missing message type');
        return;
      }

      const msg = parsed as { type: string };

      switch (msg.type) {
        case RobotWsMessageType.bridge_register:
          handleBridgeRegister(ws, parsed as BridgeRegisterMsg, service).catch((err) =>
            console.error('[BridgeWS] handleBridgeRegister error:', err),
          );
          break;

        case RobotWsMessageType.bridge_discovery_report:
          handleDiscoveryReport(ws, parsed as BridgeDiscoveryReportMsg, service).catch((err) =>
            console.error('[BridgeWS] handleDiscoveryReport error:', err),
          );
          break;

        case RobotWsMessageType.bridge_robot_relay:
          handleRobotRelay(ws, parsed as BridgeRobotRelayMsg, service);
          break;

        default:
          console.warn('[BridgeWS] Unknown message type from bridge:', msg.type);
          sendError(ws, `Unknown message type: ${msg.type}`);
      }
    });

    ws.on('close', () => {
      if (ws.bridgeId) {
        console.log(`[BridgeWS] Bridge disconnected: ${ws.bridgeId}`);
        service.handleBridgeDisconnect(ws.bridgeId);
      } else {
        console.log('[BridgeWS] Unregistered bridge connection closed');
      }
    });

    ws.on('error', (err) => {
      console.error('[BridgeWS] WebSocket error:', err);
    });
  });

  console.log('[BridgeWS] WebSocket server mounted at /ws/bridge');
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

async function handleBridgeRegister(
  ws: BridgeWS,
  msg: BridgeRegisterMsg,
  service: ReturnType<typeof getRobotMissionService>,
): Promise<void> {
  const { bridge_id, token, did, capabilities } = msg;

  if (!bridge_id) {
    sendError(ws, 'bridge:register requires bridge_id');
    return;
  }

  // First-time registration via one-time token
  if (token && !did) {
    const result = await bridgeTokenStore.consume(token);
    if (!result.valid) {
      sendError(ws, 'bridge:register: invalid or expired token');
      console.warn(`[BridgeWS] Rejected bridge ${bridge_id} — invalid token`);
      return;
    }

    // Register bridge as a resource in the registry (dedup by bridge_id name)
    const registry = getResourceRegistry();
    await registry.ensureInitialized();

    const bridgeName = `Bridge ${bridge_id}`;
    const existing = registry.getAllResources().find(r => r.name === bridgeName);

    let assignedDid: string;
    if (existing) {
      // Bridge already registered — reuse existing resource/DID
      assignedDid = existing.did;
      console.log(`[BridgeWS] Found existing resource for ${bridge_id} (DID: ${assignedDid}), skipping duplicate`);
    } else {
      const resource = await registry.registerResource({
        name: bridgeName,
        category: 'other',
        specifications: {
          otherType: 'engineering',
          description: `Local discovery bridge: ${bridge_id}`,
        },
        isAutonomous: false,
        capabilities: capabilities?.length ? capabilities : ['scanning', 'relay', 'queueing'],
      });
      assignedDid = resource.did;
    }

    // Register in service (auto-accepts at participant trust tier)
    service.registerBridge(bridge_id, ws, assignedDid, capabilities ?? []);
    ws.bridgeId = bridge_id;

    const response: BridgeRegisteredMsg = {
      type: RobotWsMessageType.bridge_registered,
      did: assignedDid,
      bridge_id,
    };
    safeSend(ws, response);
    console.log(`[BridgeWS] Bridge registered: ${bridge_id} (DID: ${assignedDid})`);
    return;
  }

  // Subsequent connection via DID
  if (did) {
    const registry = getResourceRegistry();
    await registry.ensureInitialized();
    const existing = registry.getByDID(did);

    if (!existing) {
      sendError(ws, `bridge:register: DID not found in registry — use token for first-time registration`);
      return;
    }

    service.registerBridge(bridge_id, ws, did, capabilities ?? []);
    ws.bridgeId = bridge_id;

    const response: BridgeRegisteredMsg = {
      type: RobotWsMessageType.bridge_registered,
      did,
      bridge_id,
    };
    safeSend(ws, response);
    console.log(`[BridgeWS] Bridge reconnected: ${bridge_id} (DID: ${did})`);
    return;
  }

  sendError(ws, 'bridge:register requires either token (first-time) or did (reconnect)');
}

async function handleDiscoveryReport(
  ws: BridgeWS,
  msg: BridgeDiscoveryReportMsg,
  service: ReturnType<typeof getRobotMissionService>,
): Promise<void> {
  const { bridge_id, devices, message_id } = msg;

  // Dedup check
  if (service.isDuplicate(message_id)) {
    console.debug(`[BridgeWS] Dropped duplicate discovery report from ${bridge_id} (id: ${message_id})`);
    return;
  }

  if (!devices || devices.length === 0) return;

  const now = Date.now();
  const discoveryService = getDiscoveryService();
  let ingested = 0;

  // Route each device through the onboarding pipeline (fingerprint → auth → gate → register)
  for (const device of devices) {
    try {
      const result = await discoveryService.ingestBridgeDiscovery({
        transportType: (device.transport_type ?? 'mdns') as TransportType,
        rawIdentifier: device.raw_identifier,
        signalStrength: device.signal_strength,
        firstSeen: now,
        lastSeen: now,
        rawData: {
          ...device.raw_data,
          origin: 'bridge',
          bridge_id,
        },
      });
      if (result.success) ingested++;
    } catch (err) {
      console.error(`[BridgeWS] Failed to ingest device from bridge ${bridge_id}:`, err);
    }
  }

  console.log(`[BridgeWS] Ingested ${ingested}/${devices.length} device(s) from bridge ${bridge_id}`);

  // Notify COP so discovered devices can appear on the operating picture
  // Look up workspace from bridge registration (bridgeId → problemSetId mapping)
  if (ingested > 0) {
    const bridgeInfo = service.getBridgeInfo?.(bridge_id);
    const workspaceId = bridgeInfo?.problemSetId ?? bridgeInfo?.workspaceId;
    if (workspaceId) {
      notifyCOPChange(workspaceId, `bridge-discovery-${bridge_id}`);
    }
  }
}

function handleRobotRelay(
  ws: BridgeWS,
  msg: BridgeRobotRelayMsg,
  service: ReturnType<typeof getRobotMissionService>,
): void {
  const { bridge_id, robot_message, message_id } = msg;

  // Dedup check on the relay envelope
  if (service.isDuplicate(message_id)) {
    console.debug(`[BridgeWS] Dropped duplicate relay from bridge ${bridge_id} (id: ${message_id})`);
    return;
  }

  // Also check inner message_id if present
  const innerMessageId = robot_message?.message_id as string | undefined;
  if (service.isDuplicate(innerMessageId)) {
    console.debug(`[BridgeWS] Dropped duplicate robot message relayed by bridge ${bridge_id} (inner id: ${innerMessageId})`);
    return;
  }

  // Forward to mission service as if sent directly from the robot
  service.handleRobotMessage(ws, robot_message);
}
