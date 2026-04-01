/**
 * BASTION MCP Router
 *
 * Phase 52 Plan 01: Express router providing MCP transport endpoints.
 *
 * Supports TWO transports:
 *   1. Streamable HTTP (primary — used by Ironclaw v0.24+):
 *        POST /mcp   — JSON-RPC requests + responses
 *        GET  /mcp   — SSE stream for server-initiated notifications
 *        DELETE /mcp — session termination
 *      Session tracked via Mcp-Session-Id header.
 *
 *   2. Legacy SSE (backwards compatibility):
 *        GET  /mcp/sse       — SSE stream (client connects here)
 *        POST /mcp/messages  — client posts JSON-RPC messages here
 *
 * DID injection: The x-agent-did request header is extracted and stored on
 * the transport session so it flows through to tool call handlers.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { connectMcpServer } from './mcp-server.js';
import { BASTION_TOOLS } from '../ironclaw/tool-bridge.js';

// ---------------------------------------------------------------------------
// Legacy SSE session management
// ---------------------------------------------------------------------------

interface McpSession {
  transport: SSEServerTransport;
  agentDID: string | undefined;
}

// Map of sessionId -> session (legacy SSE only)
const sessions = new Map<string, McpSession>();

// ---------------------------------------------------------------------------
// Streamable HTTP transport management
// ---------------------------------------------------------------------------

// Map of sessionId -> StreamableHTTPServerTransport
const streamableSessions = new Map<string, StreamableHTTPServerTransport>();

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
    sseSessions: sessions.size,
    streamableSessions: streamableSessions.size,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Streamable HTTP Transport (Ironclaw v0.24+ uses this)
// ---------------------------------------------------------------------------

/**
 * POST /mcp — Streamable HTTP: JSON-RPC request handler.
 *
 * If no Mcp-Session-Id header, this is an initialization request —
 * create a new transport and connect it to an MCP server instance.
 * Otherwise, route to the existing session's transport.
 */
mcpRouter.post('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && streamableSessions.has(sessionId)) {
    // Existing session — route to its transport
    const transport = streamableSessions.get(sessionId)!;
    await transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
      req.body,
    );
    return;
  }

  // New session — create transport and connect MCP server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  // Connect a fresh MCP server instance to this transport
  try {
    await connectMcpServer(transport);
  } catch (err) {
    console.error('[mcp-router] Failed to connect MCP server (streamable):', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP server connection failed' });
    }
    return;
  }

  // Handle the initialization request
  await transport.handleRequest(
    req as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    req.body,
  );

  // Register session after successful initialization
  if (transport.sessionId) {
    streamableSessions.set(transport.sessionId, transport);
    console.log(`[mcp-router] Streamable HTTP session ${transport.sessionId} established`);

    // Clean up on close
    transport.onclose = () => {
      if (transport.sessionId) {
        streamableSessions.delete(transport.sessionId);
        console.log(`[mcp-router] Streamable HTTP session ${transport.sessionId} closed`);
      }
    };
  }
});

/**
 * GET /mcp — Streamable HTTP: SSE stream for server-initiated notifications.
 */
mcpRouter.get('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && streamableSessions.has(sessionId)) {
    const transport = streamableSessions.get(sessionId)!;
    await transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    );
    return;
  }

  // No session — could be a health probe or misconfigured client
  res.status(400).json({ error: 'Missing or invalid Mcp-Session-Id header' });
});

/**
 * DELETE /mcp — Streamable HTTP: session termination.
 */
mcpRouter.delete('/', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && streamableSessions.has(sessionId)) {
    const transport = streamableSessions.get(sessionId)!;
    await transport.handleRequest(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    );
    return;
  }

  res.status(404).json({ error: 'Session not found' });
});

// ---------------------------------------------------------------------------
// Legacy SSE Transport (backwards compatibility)
// ---------------------------------------------------------------------------

/**
 * GET /mcp/sse
 *
 * Establishes an SSE connection for a legacy MCP client. The client receives
 * the session endpoint URL via the initial `endpoint` SSE event.
 */
mcpRouter.get('/sse', async (req: Request, res: Response) => {
  const agentDID = req.headers['x-agent-did'] as string | undefined;

  console.log(`[mcp-router] Legacy SSE connection from agent DID: ${agentDID ?? '(none)'}`);

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
  const sseSessionId = transport.sessionId;
  sessions.set(sseSessionId, { transport, agentDID });

  console.log(`[mcp-router] Legacy SSE session ${sseSessionId} established`);

  // Clean up session when SSE connection closes
  res.on('close', () => {
    sessions.delete(sseSessionId);
    console.log(`[mcp-router] Legacy SSE session ${sseSessionId} closed`);
  });

  // Start SSE stream
  await transport.start();
});

/**
 * POST /mcp/messages
 *
 * Receives JSON-RPC messages from legacy SSE MCP clients.
 */
mcpRouter.post('/messages', async (req: Request, res: Response) => {
  const sseSessionId = req.query.sessionId as string | undefined;

  if (!sseSessionId) {
    res.status(400).json({ error: 'Missing sessionId query parameter' });
    return;
  }

  const session = sessions.get(sseSessionId);
  if (!session) {
    res.status(404).json({ error: `Session ${sseSessionId} not found` });
    return;
  }

  try {
    await session.transport.handlePostMessage(req as unknown as Request, res as unknown as Response);
  } catch (err) {
    console.error(`[mcp-router] Error handling message for session ${sseSessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Message handling failed' });
    }
  }
});
