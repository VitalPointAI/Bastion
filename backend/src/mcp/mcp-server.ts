/**
 * BASTION MCP Server
 *
 * Phase 52 Plan 01: Core MCP server using @modelcontextprotocol/sdk.
 * Exposes all BASTION_TOOLS to agents via the Model Context Protocol.
 *
 * Phase 60 Plan 02: Extended with domain-specific tool groups (knowledge,
 * operations, calendar, resources, personnel) and DID VC claim-based
 * per-tool authorization. Personnel tools are clearance-gated.
 *
 * Uses the low-level Server API to register tools from raw JSON schema
 * (BASTION_TOOLS uses JSON Schema, not Zod), avoiding any Zod conversion layer.
 *
 * Authorization: DID-based — agents must present a valid x-agent-did header.
 * Per blueprint, migrating to per-tool VC claim gating. MCP_ALLOWED_DIDS
 * remains as a fallback allowlist for backwards compatibility.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { BASTION_TOOLS, toolBridge } from '../ironclaw/tool-bridge.js';
import type { MCPToolDefinition } from '../ironclaw/tool-bridge.js';
import { knowledgeTools } from './tools/knowledge.js';
import { operationsTools } from './tools/operations.js';
import { calendarTools } from './tools/calendar.js';
import { resourcesTools } from './tools/resources.js';
import { personnelTools, PERSONNEL_TOOL_CLEARANCES } from './tools/personnel.js';
import { intelligenceTools } from './tools/intelligence.js';
import { resolveDIDClaims, requireClearance } from './middleware/did-auth.js';

// ---------------------------------------------------------------------------
// All registered tool groups (merged catalog)
// ---------------------------------------------------------------------------

/**
 * Complete tool catalog: legacy BASTION_TOOLS plus domain-specific tool groups
 * added in Phase 60 Plan 02.
 */
const ALL_TOOLS: MCPToolDefinition[] = [
  ...BASTION_TOOLS,
  ...knowledgeTools,
  ...operationsTools,
  ...calendarTools,
  ...resourcesTools,
  ...personnelTools,
  ...intelligenceTools,
];

// ---------------------------------------------------------------------------
// DID Authorization
// ---------------------------------------------------------------------------

/**
 * Resolve the set of authorized agent DIDs from the environment.
 * If MCP_ALLOWED_DIDS is not set, dev mode allows any non-empty DID.
 *
 * Per blueprint, migrating to per-tool VC claim gating. This allowlist
 * remains for backwards compatibility with non-clearance tools.
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

async function isToolAccessAuthorized(
  agentDID: string | undefined,
  tool: MCPToolDefinition,
): Promise<{ authorized: boolean; reason?: string }> {
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

  // Per blueprint: per-tool VC claim gating for personnel tools.
  // Resolve DID claims and check minimum clearance level.
  const requiredClearance = PERSONNEL_TOOL_CLEARANCES[tool.name];
  if (requiredClearance) {
    const claims = await resolveDIDClaims(agentDID);
    const hasClearance = requireClearance(claims, requiredClearance);
    if (!hasClearance) {
      return {
        authorized: false,
        reason: `Tool "${tool.name}" requires ${requiredClearance} clearance. Agent DID "${agentDID}" does not have a sufficient VC claim.`,
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
      tools: ALL_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Handler: execute a tool call
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name: toolName, arguments: rawArgs } = request.params;

    // Find the tool definition across all registered tool groups
    const toolDef = ALL_TOOLS.find((t) => t.name === toolName);
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

    // Authorization check (async: may resolve DID VC claims for clearance-gated tools)
    const authResult = await isToolAccessAuthorized(agentDID, toolDef);
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

  console.log(
    `[mcp-server] Registered ${ALL_TOOLS.length} tools total` +
    ` (${BASTION_TOOLS.length} legacy BASTION_TOOLS + ${ALL_TOOLS.length - BASTION_TOOLS.length} domain tools)`,
  );
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
