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

// ---------------------------------------------------------------------------
// Extended WebSocket type — tracks which robot owns this connection
// ---------------------------------------------------------------------------

interface RobotWS extends WebSocket {
  robotId?: string;
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

  wss.on('connection', (rawWs: WebSocket) => {
    const ws = rawWs as RobotWS;
    console.log('[RobotWS] New robot connection');

    ws.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        console.warn('[RobotWS] Malformed JSON from robot, ignoring');
        return;
      }

      // Extract robot_id from register messages so we can track it on the socket
      if (
        parsed &&
        typeof parsed === 'object' &&
        'type' in parsed &&
        (parsed as { type: string }).type === 'register' &&
        'robot_id' in parsed
      ) {
        ws.robotId = (parsed as { robot_id: string }).robot_id;
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
