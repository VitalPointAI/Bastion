/**
 * BASTION MCP Router
 *
 * Phase 52 Plan 01: Express router providing SSE transport endpoints for
 * MCP client connections. Each SSE connection spawns a dedicated MCP server
 * instance connected via SSEServerTransport.
 *
 * Routes:
 *   GET  /mcp/sse       — SSE stream (client connects here)
 *   POST /mcp/messages  — client posts JSON-RPC messages here
 *   GET  /mcp/health    — health check with tool count
 *
 * DID injection: The x-agent-did request header is extracted and stored on
 * the transport session so it flows through to tool call handlers.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { connectMcpServer } from './mcp-server.js';
import { BASTION_TOOLS } from '../ironclaw/tool-bridge.js';

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

interface McpSession {
  transport: SSEServerTransport;
  agentDID: string | undefined;
}

// Map of sessionId -> session
const sessions = new Map<string, McpSession>();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const mcpRouter = Router();

/**
 * GET /mcp/health
 *
 * Returns server status and registered tool count.
 */
mcpRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'bastion-mcp',
    tools: BASTION_TOOLS.length,
    sessions: sessions.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /mcp/sse
 *
 * Establishes an SSE connection for a new MCP client. The client receives
 * the session endpoint URL via the initial `endpoint` SSE event.
 *
 * The x-agent-did header identifies the connecting agent for authorization.
 */
mcpRouter.get('/sse', async (req: Request, res: Response) => {
  const agentDID = req.headers['x-agent-did'] as string | undefined;

  console.log(`[mcp-router] SSE connection from agent DID: ${agentDID ?? '(none)'}`);

  // Create SSE transport — client will post messages to /mcp/messages
  const transport = new SSEServerTransport('/mcp/messages', res);

  // Connect a fresh MCP server instance to this transport
  try {
    await connectMcpServer(transport);
  } catch (err) {
    console.error('[mcp-router] Failed to connect MCP server to transport:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP server connection failed' });
    }
    return;
  }

  // Register session
  const sessionId = transport.sessionId;
  sessions.set(sessionId, { transport, agentDID });

  console.log(`[mcp-router] Session ${sessionId} established`);

  // Clean up session when SSE connection closes
  res.on('close', () => {
    sessions.delete(sessionId);
    console.log(`[mcp-router] Session ${sessionId} closed`);
  });

  // Start SSE stream
  await transport.start();
});

/**
 * POST /mcp/messages
 *
 * Receives JSON-RPC messages from the MCP client and routes them to the
 * correct session's transport.
 *
 * The client includes the sessionId as a query parameter:
 *   POST /mcp/messages?sessionId=<id>
 */
mcpRouter.post('/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;

  if (!sessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: `Session ${sessionId} not found` });
    return;
  }

  try {
    await session.transport.handlePostMessage(req as any, res as any);
  } catch (err) {
    console.error(`[mcp-router] Error handling message for session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Message handling failed' });
    }
  }
});
