/**
 * Resource WebSocket Handler
 *
 * Mounts a WebSocket server at /ws/resources that subscribes clients
 * to real-time telemetry position broadcasts via ResourceTelemetryService.
 */

import type { Server as HTTPServer } from 'http';
import { WebSocketServer } from 'ws';
import { getResourceTelemetryService } from './resource-telemetry.js';

export function setupResourceWebSocket(server: HTTPServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/resources' });

  const telemetry = getResourceTelemetryService();
  telemetry.start();

  wss.on('connection', (ws) => {
    telemetry.addSubscriber(ws);
  });

  console.log('[ResourceWS] WebSocket server mounted at /ws/resources');
}
