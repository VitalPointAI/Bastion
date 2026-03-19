/**
 * BASTION MCP Server
 *
 * Phase 52 Plan 01: Core MCP server using @modelcontextprotocol/sdk.
 * Exposes all BASTION_TOOLS to agents via the Model Context Protocol.
 *
 * Uses the low-level Server API to register tools from raw JSON schema
 * (BASTION_TOOLS uses JSON Schema, not Zod), avoiding any Zod conversion layer.
 *
 * Authorization: DID-based — agents must present a valid x-agent-did header
 * that exists in the allowlist. For Phase 52 MVP, the allowlist is seeded from
 * the MCP_ALLOWED_DIDS environment variable (comma-separated) or defaults to
 * allowing any non-empty DID in development mode.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { BASTION_TOOLS, toolBridge } from '../ironclaw/tool-bridge.js';
import type { MCPToolDefinition } from '../ironclaw/tool-bridge.js';

// ---------------------------------------------------------------------------
// DID Authorization
// ---------------------------------------------------------------------------

/**
 * Resolve the set of authorized agent DIDs from the environment.
 * If MCP_ALLOWED_DIDS is not set, dev mode allows any non-empty DID.
 */
function buildAllowlist(): Set<string> | null {
  const raw = process.env.MCP_ALLOWED_DIDS;
  if (!raw) return null; // null = open in dev mode
  const dids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(dids);
}

const ALLOWED_DIDS: Set<string> | null = buildAllowlist();

function isDIDAuthorized(agentDID: string | undefined): boolean {
  if (!agentDID) return false;
  if (ALLOWED_DIDS === null) return true; // dev mode — open
  return ALLOWED_DIDS.has(agentDID);
}

function isToolAccessAuthorized(
  agentDID: string | undefined,
  tool: MCPToolDefinition,
): { authorized: boolean; reason?: string } {
  if (!agentDID) {
    return { authorized: false, reason: 'No agent DID provided in x-agent-did header' };
  }

  // High-risk tools always require an explicit allowlist entry
  if (tool.riskLevel === 'high') {
    if (ALLOWED_DIDS === null || !ALLOWED_DIDS.has(agentDID)) {
      return {
        authorized: false,
        reason: `Tool "${tool.name}" requires explicit DID authorization (risk level: high). Agent DID "${agentDID}" is not in the allowlist.`,
      };
    }
  }

  if (!isDIDAuthorized(agentDID)) {
    return {
      authorized: false,
      reason: `Agent DID "${agentDID}" is not authorized to use BASTION tools.`,
    };
  }

  return { authorized: true };
}

// ---------------------------------------------------------------------------
// Tool Execution Stub
// ---------------------------------------------------------------------------

/**
 * Execute a BASTION tool call.
 *
 * Routes through toolBridge.handleToolCall() for real domain service execution.
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  agentDID: string,
): Promise<unknown> {
  console.log(`[mcp-server] Tool call: ${toolName}`, {
    agentDID,
    args: JSON.stringify(args),
  });

  const problemSetId = (args.problem_set_id ?? args.id ?? args.parent_id ?? '') as string;
  const result = await toolBridge.handleToolCall(toolName, args, agentDID, problemSetId);
  return result;
}

// ---------------------------------------------------------------------------
// MCP Server Factory
// ---------------------------------------------------------------------------

/**
 * Create and configure the low-level MCP Server with all BASTION tools.
 *
 * Registers handlers for:
 * - tools/list: Returns all BASTION tools with their JSON schemas
 * - tools/call: Validates DID authorization then dispatches to executor
 */
export function createMcpServer(): Server {
  const server = new Server(
    { name: 'bastion-mcp', version: '1.0.0' },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Handler: list all registered tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: BASTION_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handler: execute a tool call
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name: toolName, arguments: rawArgs } = request.params;

    // Find the tool definition
    const toolDef = BASTION_TOOLS.find((t) => t.name === toolName);
    if (!toolDef) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: 'Tool not found', tool: toolName }),
          },
        ],
        isError: true,
      };
    }

    // Extract agent DID from request meta (injected by mcp-router transport layer)
    const agentDID = (extra?._meta?.agentDID as string | undefined) ?? undefined;

    // Authorization check
    const authResult = isToolAccessAuthorized(agentDID, toolDef);
    if (!authResult.authorized) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: 'Unauthorized', reason: authResult.reason }),
          },
        ],
        isError: true,
      };
    }

    const args = (rawArgs ?? {}) as Record<string, unknown>;

    try {
      const result = await executeTool(toolDef.name, args, agentDID!);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[mcp-server] Tool execution error: ${toolDef.name}`, err);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: 'Tool execution failed', message }),
          },
        ],
        isError: true,
      };
    }
  });

  console.log(`[mcp-server] Registered ${BASTION_TOOLS.length} BASTION tools`);
  return server;
}

// ---------------------------------------------------------------------------
// Singleton + connect helper
// ---------------------------------------------------------------------------

let mcpServerInstance: Server | null = null;

export function getMcpServer(): Server {
  if (!mcpServerInstance) {
    mcpServerInstance = createMcpServer();
  }
  return mcpServerInstance;
}

/**
 * Connect the MCP server to a transport.
 * Called once per SSE client connection.
 */
export async function connectMcpServer(transport: Transport): Promise<Server> {
  const server = createMcpServer();
  await server.connect(transport);
  return server;
}
