/**
 * Inheritance WebSocket Handler
 *
 * Phase 38: Inheritance Deepening — real-time upward status streaming
 *
 * Mounts a WebSocket server at /ws/inheritance that enables:
 * - Child problem sets to publish mission status snapshots upward
 * - Parent problem sets to subscribe to child status updates
 * - Drill-down requests from parent to get full child status detail
 * - Batch status upload for DDIL reconnection flush
 *
 * Connection query params:
 *   ?parentPsId=xxx  — subscribe as parent to receive child status updates
 *   ?childPsId=xxx   — connect as child to publish status updates
 */

import type { Server as HTTPServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { inheritanceStore } from './inheritance-store.js';
import type { MissionStatusSnapshot, StatusUpdateMessage } from './inheritance-types.js';

// Maps for tracking connections
const parentSubscriptions: Map<string, Set<WebSocket>> = new Map();
const childPublishers: Map<string, WebSocket> = new Map();

// DDIL reconnection queue — queued updates when parent is disconnected
const ddilQueue: Map<string, StatusUpdateMessage[]> = new Map();

/**
 * Extract query params from the upgrade request URL.
 */
function parseConnectionParams(request: IncomingMessage): { parentPsId?: string; childPsId?: string } {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  return {
    parentPsId: url.searchParams.get('parentPsId') || undefined,
    childPsId: url.searchParams.get('childPsId') || undefined,
  };
}

/**
 * Broadcast a status update to all parent subscribers for a given parent PS.
 * If no parents are connected, queues the update for DDIL degradation.
 */
export function broadcastStatusUpdate(parentPsId: string, update: StatusUpdateMessage): void {
  const subscribers = parentSubscriptions.get(parentPsId);

  if (!subscribers || subscribers.size === 0) {
    // DDIL degradation: queue for later delivery
    if (!ddilQueue.has(parentPsId)) {
      ddilQueue.set(parentPsId, []);
    }
    const queue = ddilQueue.get(parentPsId)!;
    // Cap queue at 1000 messages to prevent memory issues
    if (queue.length < 1000) {
      queue.push(update);
    }
    return;
  }

  const message = JSON.stringify(update);
  for (const ws of subscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

/**
 * Flush any queued DDIL updates to a newly connected parent subscriber.
 */
function flushDDILQueue(parentPsId: string, ws: WebSocket): void {
  const queue = ddilQueue.get(parentPsId);
  if (!queue || queue.length === 0) return;

  // Send as a batch message
  const batchUpdate: StatusUpdateMessage = {
    type: 'status_batch',
    payload: queue.map(q => q.payload) as MissionStatusSnapshot[],
    timestamp: new Date().toISOString(),
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(batchUpdate));
  }

  // Clear the queue
  ddilQueue.delete(parentPsId);
}

/**
 * Handle a mission_status message from a child publisher.
 */
async function handleMissionStatus(snapshot: MissionStatusSnapshot): Promise<void> {
  // Persist to database
  await inheritanceStore.upsertMissionStatus(snapshot);

  // Broadcast to parent subscribers
  const update: StatusUpdateMessage = {
    type: 'mission_status',
    payload: snapshot,
    timestamp: new Date().toISOString(),
  };
  broadcastStatusUpdate(snapshot.parentProblemSetId, update);
}

/**
 * Handle a status_batch message (DDIL reconnection flush from child).
 */
async function handleStatusBatch(snapshots: MissionStatusSnapshot[]): Promise<void> {
  for (const snapshot of snapshots) {
    await inheritanceStore.upsertMissionStatus(snapshot);

    const update: StatusUpdateMessage = {
      type: 'mission_status',
      payload: snapshot,
      timestamp: new Date().toISOString(),
    };
    broadcastStatusUpdate(snapshot.parentProblemSetId, update);
  }
}

/**
 * Handle a drill_down_request from a parent subscriber.
 */
async function handleDrillDownRequest(
  ws: WebSocket,
  childProblemSetId: string,
): Promise<void> {
  const status = await inheritanceStore.getMissionStatusForChild(childProblemSetId);

  const response: StatusUpdateMessage = {
    type: 'drill_down_response',
    payload: status ?? {},
    timestamp: new Date().toISOString(),
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(response));
  }
}

/**
 * Set up the inheritance WebSocket handler.
 * Overloaded to accept either a WebSocketServer (noServer mode) or HTTPServer.
 */
export function setupInheritanceWebSocket(wss: WebSocketServer): void;
export function setupInheritanceWebSocket(server: HTTPServer): void;
export function setupInheritanceWebSocket(serverOrWss: HTTPServer | WebSocketServer): void {
  const wss = serverOrWss instanceof WebSocketServer
    ? serverOrWss
    : new WebSocketServer({ server: serverOrWss, path: '/ws/inheritance' });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const { parentPsId, childPsId } = parseConnectionParams(request);

    if (parentPsId) {
      // Parent subscribing to child status updates
      if (!parentSubscriptions.has(parentPsId)) {
        parentSubscriptions.set(parentPsId, new Set());
      }
      parentSubscriptions.get(parentPsId)!.add(ws);

      // Flush any queued DDIL updates
      flushDDILQueue(parentPsId, ws);

      console.log(`[InheritanceWS] Parent ${parentPsId} subscribed`);
    } else if (childPsId) {
      // Child connecting to publish status
      childPublishers.set(childPsId, ws);
      console.log(`[InheritanceWS] Child ${childPsId} connected as publisher`);
    } else {
      console.warn('[InheritanceWS] Connection without parentPsId or childPsId — closing');
      ws.close(4000, 'Missing parentPsId or childPsId query parameter');
      return;
    }

    ws.on('message', async (data: Buffer | string) => {
      try {
        const message: StatusUpdateMessage = JSON.parse(
          typeof data === 'string' ? data : data.toString(),
        );

        switch (message.type) {
          case 'mission_status':
            await handleMissionStatus(message.payload as MissionStatusSnapshot);
            break;

          case 'status_batch':
            await handleStatusBatch(message.payload as MissionStatusSnapshot[]);
            break;

          case 'drill_down_request': {
            const req = message.payload as { childProblemSetId: string };
            await handleDrillDownRequest(ws, req.childProblemSetId);
            break;
          }

          default:
            console.warn(`[InheritanceWS] Unknown message type: ${message.type}`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[InheritanceWS] Message handling error:', errMsg);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', payload: { message: errMsg }, timestamp: new Date().toISOString() }));
        }
      }
    });

    ws.on('close', () => {
      if (parentPsId) {
        const subs = parentSubscriptions.get(parentPsId);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) {
            parentSubscriptions.delete(parentPsId);
          }
        }
        console.log(`[InheritanceWS] Parent ${parentPsId} disconnected`);
      }
      if (childPsId) {
        childPublishers.delete(childPsId);
        console.log(`[InheritanceWS] Child ${childPsId} disconnected`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[InheritanceWS] WebSocket error:`, err.message);
    });
  });

  console.log('[InheritanceWS] WebSocket server mounted at /ws/inheritance');
}
