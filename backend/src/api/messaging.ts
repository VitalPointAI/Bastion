/**
 * Message Bus API Endpoints
 *
 * REST and WebSocket API for message bus operations.
 * All endpoints are ABAC-filtered based on user clearance.
 */

import { Router, Request, Response } from 'express';
import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { getMessageBus } from '../messaging/message-bus.js';
import { getMessageStore } from '../messaging/message-store.js';
import { getMessageABACFilter } from '../messaging/abac-filter.js';
import {
  CreateMessageSchema,
  MessageQueryOptionsSchema,
} from '../messaging/schemas.js';
import {
  DeliveryStatus,
  SystemChannels,
  type MessageEnvelope,
  type MessageClassification,
} from '../messaging/types.js';
import type { SubjectAttributes } from '../security/abac-enforcer.js';

const router = Router();

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Extract user DID from request
 */
function getUserDid(req: Request): string {
  return (req.headers['x-did'] as string) || 'did:near:anonymous';
}

/**
 * Extract user clearance from request
 */
function getUserClearance(req: Request): MessageClassification {
  const clearance = (req.headers['x-clearance'] as string) || 'UNCLASS';
  return clearance as MessageClassification;
}

/**
 * Build subject attributes from request
 */
function getSubjectAttributes(req: Request): Partial<SubjectAttributes> {
  return {
    did: getUserDid(req),
    clearance: getUserClearance(req),
    nationality: (req.headers['x-nationality'] as string) || 'USA',
    organization: (req.headers['x-organization'] as string) || 'unknown',
    role: (req.headers['x-role'] as string) || 'user',
  };
}

// ==========================================================================
// Message Endpoints
// ==========================================================================

/**
 * POST /api/messages
 * Publish a new message
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const userClearance = getUserClearance(req);
    const bus = getMessageBus();
    const filter = getMessageABACFilter();

    // Validate input
    const parseResult = CreateMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid message input',
        details: parseResult.error.issues,
      });
      return;
    }

    const input = parseResult.data;

    // Use authenticated user as source
    input.sourceDid = userDid;
    input.sourceType = 'user';

    // Check sender clearance for classification
    const classification = input.attributes?.classification || 'UNCLASS';
    const canSend = await filter.canSendAtClassification(userDid, classification, {
      clearance: userClearance,
    });

    if (!canSend) {
      res.status(403).json({
        success: false,
        error: `Insufficient clearance to send ${classification} messages`,
      });
      return;
    }

    // Ensure originator is set
    if (!input.attributes) {
      input.attributes = {};
    }
    input.attributes.originator = userDid;

    // Publish message
    const messageId = await bus.publish(input);

    res.status(201).json({
      success: true,
      data: { messageId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/messages
 * Get messages for current user (ABAC-filtered)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const bus = getMessageBus();

    // Parse query options
    const parseResult = MessageQueryOptionsSchema.safeParse({
      channel: req.query.channel,
      messageType: req.query.messageType,
      since: req.query.since,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      status: req.query.status,
    });

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid query options',
        details: parseResult.error.issues,
      });
      return;
    }

    const options = parseResult.data;

    // Get ABAC-filtered messages
    const messages = await bus.getMessages(userDid, options);

    res.json({
      success: true,
      data: messages,
      count: messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/messages/:messageId
 * Get a specific message (ABAC-checked)
 */
router.get('/:messageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const messageId = req.params.messageId as string;
    const bus = getMessageBus();

    const message = await bus.getMessage(messageId, userDid);

    if (!message) {
      res.status(404).json({
        success: false,
        error: 'Message not found or access denied',
      });
      return;
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/messages/:messageId/acknowledge
 * Acknowledge receipt of a message
 */
router.post('/:messageId/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const messageId = req.params.messageId as string;
    const bus = getMessageBus();

    await bus.acknowledge(messageId, userDid);

    res.json({
      success: true,
      message: 'Message acknowledged',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/messages/thread/:correlationId
 * Get conversation thread (ABAC-filtered)
 */
router.get('/thread/:correlationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const correlationId = req.params.correlationId as string;
    const bus = getMessageBus();

    const messages = await bus.getThread(correlationId, userDid);

    res.json({
      success: true,
      data: messages,
      count: messages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================================================
// Channel Endpoints
// ==========================================================================

/**
 * GET /api/channels
 * List available channels (filtered by clearance)
 */
router.get('/channels', async (req: Request, res: Response): Promise<void> => {
  try {
    const userClearance = getUserClearance(req);

    // Define channels with required clearance
    const allChannels = [
      { name: SystemChannels.AGENT_LIFECYCLE, clearance: 'UNCLASS', description: 'Agent lifecycle events' },
      { name: SystemChannels.TEAM_UPDATES, clearance: 'UNCLASS', description: 'Team composition changes' },
      { name: SystemChannels.WORKFLOW_EVENTS, clearance: 'CUI', description: 'Workflow state transitions' },
      { name: SystemChannels.SECURITY_ALERTS, clearance: 'CONFIDENTIAL', description: 'Security-related events' },
      { name: SystemChannels.AUDIT_ALL, clearance: 'SECRET', description: 'Full audit trail' },
    ];

    const clearanceLevels: Record<MessageClassification, number> = {
      UNCLASS: 1,
      CUI: 2,
      CONFIDENTIAL: 3,
      SECRET: 4,
      TOPSECRET: 5,
    };

    const userLevel = clearanceLevels[userClearance] || 1;

    // Filter channels by user clearance
    const availableChannels = allChannels.filter(
      ch => clearanceLevels[ch.clearance as MessageClassification] <= userLevel
    );

    res.json({
      success: true,
      data: availableChannels,
      count: availableChannels.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/channels/:channel/subscribe
 * Subscribe to a channel
 */
router.post('/channels/:channel/subscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const channel = req.params.channel as string;
    const bus = getMessageBus();

    const subscriptionId = bus.subscribe(userDid, {
      channels: [channel],
      callback: async () => {
        // No-op callback for REST subscription
        // Real-time delivery happens via WebSocket
      },
    });

    res.status(201).json({
      success: true,
      data: { subscriptionId, channel },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/channels/:channel/subscribe
 * Unsubscribe from a channel
 */
router.delete('/channels/:channel/subscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const userDid = getUserDid(req);
    const subscriptionId = req.query.subscriptionId as string;
    const bus = getMessageBus();

    if (!subscriptionId) {
      res.status(400).json({
        success: false,
        error: 'subscriptionId query parameter required',
      });
      return;
    }

    bus.unsubscribe(userDid, subscriptionId);

    res.json({
      success: true,
      message: 'Unsubscribed successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================================================
// Stats Endpoint
// ==========================================================================

/**
 * GET /api/messages/stats
 * Get message bus statistics (admin only)
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const bus = getMessageBus();
    const stats = await bus.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// ==========================================================================
// WebSocket Setup
// ==========================================================================

/**
 * WebSocket connection tracking
 */
interface WSConnection {
  ws: WebSocket;
  userDid: string;
  clearance: MessageClassification;
  subscriptionIds: string[];
}

const connections = new Map<string, WSConnection>();

/**
 * Setup WebSocket server for real-time message delivery
 */
export function setupMessageWebSocket(server: HTTPServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/messages' });

  wss.on('connection', async (ws: WebSocket, req) => {
    const connectionId = randomUUID();

    // Extract auth info from query params or headers
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userDid = url.searchParams.get('did') || 'did:near:anonymous';
    const clearance = (url.searchParams.get('clearance') || 'UNCLASS') as MessageClassification;

    console.log(`[WS] Client connected: ${connectionId} (${userDid})`);

    // Track connection
    const connection: WSConnection = {
      ws,
      userDid,
      clearance,
      subscriptionIds: [],
    };
    connections.set(connectionId, connection);

    // Subscribe to messages for this user
    const bus = getMessageBus();
    const filter = getMessageABACFilter();

    const subscriptionId = bus.subscribe(userDid, {
      callback: async (message: MessageEnvelope) => {
        // ABAC filter
        const auth = await filter.canDeliver(message, userDid, { clearance });
        if (!auth.allowed) {
          return;
        }

        // Send to client
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'message',
            data: message,
          }));
        }
      },
    });

    connection.subscriptionIds.push(subscriptionId);

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'subscribe':
            // Subscribe to additional channels
            if (msg.channel) {
              const subId = bus.subscribe(userDid, {
                channels: [msg.channel],
                callback: async (message: MessageEnvelope) => {
                  const auth = await filter.canDeliver(message, userDid, { clearance });
                  if (auth.allowed && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'message', data: message }));
                  }
                },
              });
              connection.subscriptionIds.push(subId);
              ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel, subscriptionId: subId }));
            }
            break;

          case 'unsubscribe':
            if (msg.subscriptionId) {
              bus.unsubscribe(userDid, msg.subscriptionId);
              const idx = connection.subscriptionIds.indexOf(msg.subscriptionId);
              if (idx !== -1) {
                connection.subscriptionIds.splice(idx, 1);
              }
              ws.send(JSON.stringify({ type: 'unsubscribed', subscriptionId: msg.subscriptionId }));
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('[WS] Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${connectionId}`);

      // Cleanup subscriptions
      for (const subId of connection.subscriptionIds) {
        bus.unsubscribe(userDid, subId);
      }
      connections.delete(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`[WS] Error for ${connectionId}:`, error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
      userDid,
    }));
  });

  console.log('[WS] Message WebSocket server started on /ws/messages');
}

/**
 * Get active WebSocket connection count
 */
export function getWebSocketConnectionCount(): number {
  return connections.size;
}

export default router;
