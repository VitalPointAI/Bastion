/**
 * Discovery WebSocket Handler
 *
 * Phase 32 Plan 06: Real-time streaming of discovery events to connected
 * frontend clients. Follows resource-ws.ts pattern.
 *
 * Subscribes to MessageBus channels for discovery events and broadcasts
 * to all connected WebSocket clients. Clients can optionally filter by
 * transport type or device state.
 */

import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getMessageBus } from '../messaging/message-bus.js';
import type { MessageEnvelope } from '../messaging/types.js';
import type { TransportType, DeviceState } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Outbound message from server to client */
export interface DiscoveryWSMessage {
  type:
    | 'device_discovered'
    | 'device_state_changed'
    | 'device_lost'
    | 'scanner_status'
    | 'status_snapshot';
  data: Record<string, unknown>;
}

/** Inbound message from client to server */
interface ClientAction {
  action: 'subscribe';
  filters?: {
    transportType?: TransportType;
    state?: DeviceState;
  };
}

/** Extended WebSocket with per-client filter state */
interface FilteredWS extends WebSocket {
  discoveryFilters?: {
    transportType?: TransportType;
    state?: DeviceState;
  };
}

// ---------------------------------------------------------------------------
// Discovery channels that we subscribe to on the MessageBus
// ---------------------------------------------------------------------------

const DISCOVERY_CHANNELS = [
  'discovery.device.discovered',
  'discovery.device.state_changed',
  'discovery.device.lost',
  'discovery.scan.status',
];

/** Map MessageBus channel name to outbound WS message type */
function channelToWSType(channel: string): DiscoveryWSMessage['type'] {
  if (channel.includes('discovered')) return 'device_discovered';
  if (channel.includes('state_changed')) return 'device_state_changed';
  if (channel.includes('lost')) return 'device_lost';
  if (channel.includes('scan')) return 'scanner_status';
  return 'device_state_changed';
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Mount a WebSocket server at /ws/discovery for real-time event streaming.
 */
export function setupDiscoveryWS(wss: WebSocketServer): void;
export function setupDiscoveryWS(server: HTTPServer): void;
export function setupDiscoveryWS(serverOrWss: HTTPServer | WebSocketServer): void {
  const wss = serverOrWss instanceof WebSocketServer
    ? serverOrWss
    : new WebSocketServer({ server: serverOrWss, path: '/ws/discovery' });
  const bus = getMessageBus();

  // Subscribe to all discovery channels on the MessageBus
  const subscriberDid = 'system:discovery-ws';

  bus.subscribe(subscriberDid, {
    channels: DISCOVERY_CHANNELS,
    callback: async (envelope: MessageEnvelope): Promise<void> => {
      const channel = envelope.destination?.target || '';
      const wsType = channelToWSType(channel);
      const message: DiscoveryWSMessage = {
        type: wsType,
        data: (envelope.payload as Record<string, unknown>) ?? {},
      };

      broadcast(wss, message);
    },
  });

  // Handle new client connections
  wss.on('connection', (ws: FilteredWS) => {
    // Send current status snapshot on connect (best-effort)
    const snapshot: DiscoveryWSMessage = {
      type: 'status_snapshot',
      data: { connected: true, subscribedChannels: DISCOVERY_CHANNELS },
    };
    safeSend(ws, snapshot);

    // Listen for client filter subscriptions
    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as ClientAction;
        if (parsed.action === 'subscribe' && parsed.filters) {
          ws.discoveryFilters = parsed.filters;
        }
      } catch {
        // Ignore malformed client messages
      }
    });
  });

  console.log('[DiscoveryWS] WebSocket server mounted at /ws/discovery');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Broadcast a message to all connected clients, respecting per-client filters. */
function broadcast(wss: WebSocketServer, message: DiscoveryWSMessage): void {
  const json = JSON.stringify(message);

  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    const filtered = client as FilteredWS;
    if (filtered.discoveryFilters) {
      const data = message.data;
      if (
        filtered.discoveryFilters.transportType &&
        data.transportType !== filtered.discoveryFilters.transportType
      ) {
        continue;
      }
      if (
        filtered.discoveryFilters.state &&
        data.state !== filtered.discoveryFilters.state
      ) {
        continue;
      }
    }

    client.send(json);
  }
}

/** Safely send JSON to a WebSocket (ignore errors on closed sockets). */
function safeSend(ws: WebSocket, message: DiscoveryWSMessage): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  } catch {
    // Socket may have closed between readyState check and send
  }
}
