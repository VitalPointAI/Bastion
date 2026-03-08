/**
 * Resource WebSocket Handler
 *
 * Mounts a WebSocket server at /ws/resources that subscribes clients
 * to real-time telemetry position broadcasts via ResourceTelemetryService.
 */

import type { Server as HTTPServer } from 'http';
import { WebSocketServer } from 'ws';
import { getResourceTelemetryService } from './resource-telemetry.js';

export function setupResourceWebSocket(wss: WebSocketServer): void;
export function setupResourceWebSocket(server: HTTPServer): void;
export function setupResourceWebSocket(serverOrWss: HTTPServer | WebSocketServer): void {
  const wss = serverOrWss instanceof WebSocketServer
    ? serverOrWss
    : new WebSocketServer({ server: serverOrWss, path: '/ws/resources' });

  const telemetry = getResourceTelemetryService();
  telemetry.start();

  wss.on('connection', (ws) => {
    telemetry.addSubscriber(ws);
  });

  console.log('[ResourceWS] WebSocket server mounted at /ws/resources');
}
