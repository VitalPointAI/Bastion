import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { encoding, decoding, mutex } from 'lib0';
import { yjsProvider } from './yjs-provider.js';
import { awarenessManager } from './awareness.js';
import { CollaborationUser, YjsDocument } from './types.js';

const messageSync = 0;
const messageAwareness = 1;

/**
 * Create WebSocket server for Yjs document sync
 */
export function createSyncServer(wss: WebSocketServer): WebSocketServer;
export function createSyncServer(server: http.Server, path?: string): WebSocketServer;
export function createSyncServer(serverOrWss: http.Server | WebSocketServer, path: string = '/ws/collab'): WebSocketServer {
  const wss = serverOrWss instanceof WebSocketServer
    ? serverOrWss
    : new WebSocketServer({ server: serverOrWss, path });

  // Track connections per document
  const connections = new Map<string, Set<WebSocket>>();

  wss.on('connection', async (ws: WebSocket, req) => {
    // Parse document ID and user info from URL params
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const documentId = url.searchParams.get('documentId');
    const planId = url.searchParams.get('planId');
    const userDID = url.searchParams.get('did');
    const userName = url.searchParams.get('name') || 'Anonymous';
    const userRole = url.searchParams.get('role') || 'Staff';

    if (!documentId || !planId) {
      ws.close(4000, 'Missing documentId or planId');
      return;
    }

    // Get or create Yjs document
    let yjsDoc: YjsDocument;
    try {
      yjsDoc = await yjsProvider.getDocument(planId, documentId);
    } catch (_error) {
      ws.close(4001, 'Failed to load document');
      return;
    }

    const user: CollaborationUser = {
      did: userDID || 'anonymous',
      name: userName,
      role: userRole,
      color: ''
    };

    // Track this connection
    if (!connections.has(documentId)) {
      connections.set(documentId, new Set());
    }
    connections.get(documentId)!.add(ws);

    const clientId = yjsDoc.doc.clientID;
    yjsDoc.connectedUsers.set(clientId, user);

    // Create awareness instance for this connection
    const awareness = new awarenessProtocol.Awareness(yjsDoc.doc);
    awarenessManager.setUserState(awareness, user);

    // Sync lock for this connection
    const mux = mutex.createMutex();

    // Send initial sync state
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, yjsDoc.doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send awareness state
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        awareness,
        Array.from(awareness.getStates().keys())
      )
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      mux(() => {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case messageSync: {
            const syncEncoder = encoding.createEncoder();
            encoding.writeVarUint(syncEncoder, messageSync);
            syncProtocol.readSyncMessage(decoder, syncEncoder, yjsDoc.doc, null);

            if (encoding.length(syncEncoder) > 1) {
              ws.send(encoding.toUint8Array(syncEncoder));
            }

            const update = Y.encodeStateAsUpdate(yjsDoc.doc);
            broadcastToOthers(documentId, ws, messageSync, update);
            break;
          }

          case messageAwareness: {
            awarenessProtocol.applyAwarenessUpdate(
              awareness,
              decoding.readVarUint8Array(decoder),
              ws
            );

            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
              awareness,
              [clientId]
            );
            broadcastToOthers(documentId, ws, messageAwareness, awarenessUpdate);
            break;
          }
        }
      });
    });

    // Handle disconnect
    ws.on('close', () => {
      yjsDoc.connectedUsers.delete(clientId);
      connections.get(documentId)?.delete(ws);

      // Remove awareness
      awarenessProtocol.removeAwarenessStates(awareness, [clientId], null);

      // Broadcast awareness removal
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [clientId]);
      broadcastToOthers(documentId, null, messageAwareness, update);

      // Release document if no more connections
      if (connections.get(documentId)?.size === 0) {
        connections.delete(documentId);
        yjsProvider.releaseDocument(documentId);
      }
    });
  });

  function broadcastToOthers(
    documentId: string,
    exclude: WebSocket | null,
    messageType: number,
    data: Uint8Array
  ): void {
    const clients = connections.get(documentId);
    if (!clients) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageType);
    encoding.writeVarUint8Array(encoder, data);
    const message = encoding.toUint8Array(encoder);

    clients.forEach(client => {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  return wss;
}
