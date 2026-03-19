/**
 * BASTION MCP Container Entry Point
 *
 * Phase 52 Plan 01: Standalone Docker container running the BASTION MCP server.
 * Exposes BASTION tools to AI agents via the Model Context Protocol over HTTP/SSE.
 *
 * Port: 3334 (follows bastion port convention: 3001 backend, 3333 ironclaw, 3334 mcp)
 */

import express from 'express';
import { mcpRouter } from './mcp-router.js';
import { BASTION_TOOLS } from '../ironclaw/tool-bridge.js';

const PORT = parseInt(process.env.MCP_PORT ?? '3334', 10);

const app = express();

// Parse JSON bodies for POST /mcp/messages
app.use(express.json());

// Mount MCP routes at /mcp
app.use('/mcp', mcpRouter);

// Top-level health check (container orchestration probe)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'bastion-mcp',
    tools: BASTION_TOOLS.length,
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[bastion-mcp] Server started on port ${PORT}`);
  console.log(`[bastion-mcp] ${BASTION_TOOLS.length} BASTION tools registered`);
  console.log(`[bastion-mcp] Health:    http://0.0.0.0:${PORT}/health`);
  console.log(`[bastion-mcp] MCP SSE:   http://0.0.0.0:${PORT}/mcp/sse`);
  console.log(`[bastion-mcp] MCP POST:  http://0.0.0.0:${PORT}/mcp/messages`);
  console.log(`[bastion-mcp] MCP tools: http://0.0.0.0:${PORT}/mcp/health`);
});
