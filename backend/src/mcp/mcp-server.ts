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
import { CONSOLIDATED_TOOLS, CONSOLIDATED_DISPATCH } from './consolidated-tools.js';
import { resolveDIDClaims, requireClearance } from './middleware/did-auth.js';

// ---------------------------------------------------------------------------
// All registered tool groups (merged catalog)
// ---------------------------------------------------------------------------

/**
 * Full tool catalog — used for handler lookup when dispatching consolidated
 * tool calls back to their original handlers.
 */
const ALL_TOOLS_FULL: MCPToolDefinition[] = [
  ...BASTION_TOOLS,
  ...knowledgeTools,
  ...operationsTools,
  ...calendarTools,
  ...resourcesTools,
  ...personnelTools,
  ...intelligenceTools,
];

/**
 * MCP-exposed tool catalog — consolidated category routers.
 * Reduces 80+ tools to ~7 so Haiku's tool-selection step doesn't truncate.
 */
const ALL_TOOLS: MCPToolDefinition[] = CONSOLIDATED_TOOLS;

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
  // When no DID is provided (e.g. Ironclaw routine/heartbeat MCP connections),
  // allow in dev mode (no allowlist configured). Ironclaw connects to the MCP
  // server internally on ironclaw-network without an x-agent-did header.
  if (!agentDID) {
    if (ALLOWED_DIDS === null) {
      // Dev mode: allow internal MCP connections without DID.
      // High-risk tools still blocked without explicit DID.
      if (tool.riskLevel === 'high') {
        return {
          authorized: false,
          reason: `Tool "${tool.name}" requires explicit DID authorization (risk level: high). No agent DID provided.`,
        };
      }
      return { authorized: true };
    }
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
  // For consolidated tools, check the resolved handler name
  const resolvedToolName = (() => {
    const dispatch = CONSOLIDATED_DISPATCH[tool.name];
    if (!dispatch) return tool.name;
    // Can't resolve action here — personnel clearance check is conservative:
    // if any action in this category requires clearance, gate the whole category.
    return tool.name;
  })();
  const requiredClearance = PERSONNEL_TOOL_CLEARANCES[resolvedToolName] ??
    PERSONNEL_TOOL_CLEARANCES[tool.name];
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
  // Resolve consolidated category tools → original handler name
  let resolvedName = toolName;
  const dispatch = CONSOLIDATED_DISPATCH[toolName];
  if (dispatch) {
    const action = args.action as string | undefined;
    if (!action || !dispatch[action]) {
      throw new Error(
        `Invalid action "${action}" for ${toolName}. Valid: ${Object.keys(dispatch).join(', ')}`,
      );
    }
    resolvedName = dispatch[action];
    console.log(`[mcp-server] Consolidated dispatch: ${toolName}.${action} → ${resolvedName}`);
  }

  console.log(`[mcp-server] Tool call: ${resolvedName}`, {
    agentDID,
    args: JSON.stringify(args).slice(0, 1000),
  });

  const problemSetId = (args.problem_set_id ?? args.id ?? args.parent_id ?? '') as string;
  const result = await toolBridge.handleToolCall(resolvedName, args, agentDID, problemSetId);
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

  // Handler: list consolidated tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: CONSOLIDATED_TOOLS.map((tool) => ({
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
    `[mcp-server] Registered ${ALL_TOOLS.length} consolidated tools (routing to ${ALL_TOOLS_FULL.length} handlers)`,
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
