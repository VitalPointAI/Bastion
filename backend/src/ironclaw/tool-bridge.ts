/**
 * Ironclaw MCP Tool Bridge
 *
 * Phase 30 Plan 04: Registers BASTION-specific domain tools with the Ironclaw
 * sidecar via MCP protocol. Provides scope validation to enforce problem set
 * boundaries and routes tool calls through the action pipeline.
 *
 * Key design decisions:
 * - Ambiguous scope triggers clarification prompt (never assumes)
 * - Tools without PS-scoped fields are only valid for 'bastion.system.*' types
 * - Registration is non-blocking: logs warning if Ironclaw unreachable
 */

import { actionPipeline } from './action-pipeline.js';
import { actionRegistry } from './action-registry.js';
import { executeApprovedAction } from './builder-handlers.js';
import type { ActionResult } from './action-pipeline.js';
import type { IronclawAction, ActionRiskLevel } from './ironclaw-types.js';
import { PROTECTED_CONFIG_KEYS } from './ironclaw-types.js';
import { ironclawClient } from './ironclaw-client.js';

// ---------------------------------------------------------------------------
// MCP Tool Definition
// ---------------------------------------------------------------------------

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  riskLevel: ActionRiskLevel;
}

// ---------------------------------------------------------------------------
// BASTION Domain Tools
// ---------------------------------------------------------------------------

/**
 * Canonical set of BASTION tools exposed to Ironclaw via MCP.
 * Each tool maps to a domain operation with explicit risk classification.
 */
export const BASTION_TOOLS: MCPToolDefinition[] = [
  {
    name: 'bastion.problem_set.read',
    description: 'Read problem set details and configuration',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion.problem_set.list_children',
    description: 'List child problem sets',
    inputSchema: {
      type: 'object',
      properties: { parent_id: { type: 'string' } },
      required: ['parent_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion.problem_set.update_field',
    description: 'Update a specific field on a problem set',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        field: { type: 'string' },
        value: {},
      },
      required: ['id', 'field', 'value'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.problem_set.create_child',
    description: 'Create a child problem set',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string' },
        name: { type: 'string' },
        echelon: { type: 'string' },
      },
      required: ['parent_id', 'name'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.problem_set.configure_agents',
    description: 'Configure AI agents for a problem set (cannot modify Ironclaw own config)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        agent_config: { type: 'object' },
      },
      required: ['id', 'agent_config'],
    },
    riskLevel: 'high',
  },
  {
    name: 'bastion.resource.create',
    description: 'Create a resource in the registry',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        capabilities: { type: 'object' },
      },
      required: ['problem_set_id', 'type', 'name'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.resource.delete',
    description: 'Delete a resource from the registry',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    riskLevel: 'high',
  },
  {
    name: 'bastion.gate.create',
    description: 'Create a decision gate for approval workflow',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        gate_type: { type: 'string' },
        target_item_id: { type: 'string' },
        target_item_title: { type: 'string' },
      },
      required: ['problem_set_id', 'gate_type', 'target_item_id', 'target_item_title'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.code.create_pr',
    description: 'Create a GitHub PR with proposed code changes',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        branch: { type: 'string' },
        files: { type: 'array' },
      },
      required: ['title', 'description', 'branch', 'files'],
    },
    riskLevel: 'high',
  },
  {
    name: 'bastion.design.update_section',
    description: 'Update a specific section of the operational design from interview output',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        section: {
          type: 'string',
          enum: ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'],
          description: 'Design section to update',
        },
        data: { type: 'object', description: 'Section data to merge/replace' },
        partial: { type: 'boolean', description: 'True for incremental updates, false for full section replacement' },
      },
      required: ['problem_set_id', 'section', 'data'],
    },
    riskLevel: 'medium',
  },
  // ── Knowledge Graph Tools ──
  {
    name: 'bastion.graph.search_actors',
    description: 'Search the knowledge graph for actors (nations, organizations, individuals, military units) by name or type. Returns matching nodes with their properties, relationships, and source documents.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or partial name to search for' },
        type: { type: 'string', description: 'Filter by actor type: state, organization, individual, military, non_state' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion.graph.get_actor',
    description: 'Get full details of a specific actor node including all relationships, tensions, source documents, and linked entities.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact actor name' },
      },
      required: ['name'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion.graph.query',
    description: 'Run a read-only Cypher query against the knowledge graph. Use for complex queries like finding paths between actors, counting relationships, or analyzing the graph structure.',
    inputSchema: {
      type: 'object',
      properties: {
        cypher: { type: 'string', description: 'Read-only Cypher query (MATCH/RETURN only, no CREATE/DELETE/SET)' },
      },
      required: ['cypher'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion.graph.stats',
    description: 'Get knowledge graph statistics: total nodes, relationships, node types, and top actors by relationship count.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion.design.synthesize_current_state',
    description: 'Synthesize the Current State assessment for Problem Framing from knowledge graph actors, relationships, tensions, and strategic documents. Populates the Current State field with a narrative assessment.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.system.update_config',
    description: 'Update system-level configuration',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: {},
      },
      required: ['key', 'value'],
    },
    riskLevel: 'high',
  },
  // ── Map Overlay Tools ──
  {
    name: 'bastion.design.map.add_symbol',
    description: 'Add a military symbol to the operational approach map overlay',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        sidc: { type: 'string', description: 'MIL-STD-2525D SIDC code identifying the symbol type' },
        designation: { type: 'string', description: 'Unit or element designation (e.g. "1st MarDiv")' },
        lat: { type: 'number', description: 'Latitude in decimal degrees' },
        lng: { type: 'number', description: 'Longitude in decimal degrees' },
        mgrs: { type: 'string', description: 'MGRS grid coordinate (alternative to lat/lng)' },
        echelon: { type: 'string', description: 'Echelon size (e.g. battalion, brigade, division)' },
      },
      required: ['problem_set_id', 'sidc'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.design.map.move_symbol',
    description: 'Move an existing symbol to a new position on the map',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        symbol_id: { type: 'string', description: 'ID of the symbol to move' },
        lat: { type: 'number', description: 'New latitude in decimal degrees' },
        lng: { type: 'number', description: 'New longitude in decimal degrees' },
        mgrs: { type: 'string', description: 'New MGRS grid coordinate (alternative to lat/lng)' },
      },
      required: ['problem_set_id', 'symbol_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.design.map.remove_symbol',
    description: 'Remove a symbol from the operational approach map',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        symbol_id: { type: 'string', description: 'ID of the symbol to remove' },
      },
      required: ['problem_set_id', 'symbol_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.design.map.update_symbol',
    description: 'Update properties of an existing symbol',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        symbol_id: { type: 'string', description: 'ID of the symbol to update' },
        sidc: { type: 'string', description: 'New MIL-STD-2525D SIDC code' },
        designation: { type: 'string', description: 'New unit or element designation' },
        echelon: { type: 'string', description: 'New echelon size' },
      },
      required: ['problem_set_id', 'symbol_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.design.map.add_control_measure',
    description: 'Add a control measure (phase line, boundary, objective, etc.) to the map',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        type: {
          type: 'string',
          enum: ['phase_line', 'boundary', 'axis_of_advance', 'objective', 'engagement_area', 'nai', 'fscm', 'flot', 'other'],
          description: 'Control measure type',
        },
        label: { type: 'string', description: 'Label for the control measure (e.g. "PL RED", "OBJ ALPHA")' },
        coordinates: {
          type: 'array',
          items: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
          description: 'Array of {lat, lng} coordinate objects defining the measure geometry',
        },
        affiliation: {
          type: 'string',
          enum: ['friendly', 'enemy', 'neutral'],
          description: 'Force affiliation of the control measure',
        },
      },
      required: ['problem_set_id', 'type', 'label', 'coordinates'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.design.map.add_overlay_graphic',
    description: 'Add an annotation graphic to the map overlay',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        graphic_type: { type: 'string', description: 'Type of annotation graphic (e.g. "arrow", "circle", "text")' },
        label: { type: 'string', description: 'Label or annotation text for the graphic' },
        coordinates: {
          type: 'array',
          items: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
          description: 'Array of {lat, lng} coordinate objects defining the graphic geometry',
        },
      },
      required: ['problem_set_id', 'graphic_type', 'label', 'coordinates'],
    },
    riskLevel: 'medium',
  },
];

// ---------------------------------------------------------------------------
// Scope Validation Result
// ---------------------------------------------------------------------------

export interface ScopeValidationResult {
  valid: boolean;
  error?: string;
  needsClarification?: boolean;
}

// ---------------------------------------------------------------------------
// ToolBridge
// ---------------------------------------------------------------------------

/**
 * Fields in tool arguments that identify the target problem set.
 * Checked in priority order.
 */
const PS_SCOPED_FIELDS = ['id', 'problem_set_id', 'parent_id'] as const;

export class ToolBridge {
  /**
   * Register all BASTION tools with the Ironclaw sidecar via MCP.
   *
   * Non-blocking: logs a warning if Ironclaw is unreachable but does not
   * throw, allowing the backend to start without the sidecar running.
   */
  async registerTools(): Promise<void> {
    try {
      // Register each tool's risk level with the action registry
      for (const tool of BASTION_TOOLS) {
        actionRegistry.registerAction(tool.name, tool.riskLevel);
      }

      // Lock the registry — no further risk level modifications permitted.
      // Prevents the agent from downgrading action risk levels at runtime.
      actionRegistry.lock();

      console.log(
        `[tool-bridge] Registered ${BASTION_TOOLS.length} BASTION tool risk levels in action registry`,
      );

      // Verify Ironclaw sidecar is reachable
      const healthy = await ironclawClient.healthCheck();
      if (healthy) {
        console.log('[tool-bridge] Ironclaw sidecar is reachable');
      } else {
        console.warn(
          '[tool-bridge] Ironclaw sidecar is not reachable (tools will work when sidecar starts)',
        );
      }
    } catch (err) {
      // Lock even on failure so the canonical ACTION_RISK levels are immutable
      if (!actionRegistry.isLocked()) actionRegistry.lock();

      console.warn(
        '[tool-bridge] Failed to register tools (sidecar may not be running):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Validate that a tool invocation targets the user's current problem set scope.
   *
   * Rules:
   * - If tool args contain a PS-scoped field matching userProblemSetId: valid.
   * - If tool args target a child PS: valid (TODO: full hierarchy check via inheritance-store).
   * - If tool args target a different PS and not a child: needsClarification (never assumes).
   * - If no PS-scoped field in args: valid only for 'bastion.system.*' tools.
   */
  validateScope(
    toolName: string,
    args: Record<string, unknown>,
    userProblemSetId: string,
  ): ScopeValidationResult {
    // System-scoped tools do not require PS scope
    if (toolName.startsWith('bastion.system.')) {
      return { valid: true };
    }

    // Extract target problem set ID from args
    let targetPsId: string | undefined;
    for (const field of PS_SCOPED_FIELDS) {
      if (typeof args[field] === 'string') {
        targetPsId = args[field] as string;
        break;
      }
    }

    // No PS-scoped field found in a non-system tool: invalid
    if (!targetPsId) {
      return {
        valid: false,
        needsClarification: true,
        error:
          'This action does not specify a target problem set. Please clarify which problem set you mean.',
      };
    }

    // Exact match: valid
    if (targetPsId === userProblemSetId) {
      return { valid: true };
    }

    // TODO: Integrate with inheritance-store for full hierarchy check.
    // For now, any non-matching PS triggers clarification per locked decision
    // "agent always asks to clarify, never assumes".
    return {
      valid: false,
      needsClarification: true,
      error:
        'This action targets a different problem set. Please clarify which problem set you mean.',
    };
  }

  /**
   * Handle an MCP tool call from Ironclaw.
   *
   * 1. Block self-modification attempts (agent cannot change its own governance).
   * 2. Validate scope against user's current problem set.
   * 3. Create an IronclawAction from the tool call.
   * 4. Route through the action pipeline for confirmation/execution.
   */
  async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    userDid: string,
    problemSetId: string,
  ): Promise<ActionResult> {
    // 1. Block self-modification: agent cannot alter its own governance
    const selfModCheck = this.checkSelfModification(toolName, args);
    if (selfModCheck) {
      console.warn(
        `[tool-bridge] BLOCKED self-modification attempt: ${toolName}`,
        { args, userDid, reason: selfModCheck },
      );
      return { status: 'denied', error: selfModCheck };
    }

    // 2. Validate scope
    const scopeResult = this.validateScope(toolName, args, problemSetId);
    if (!scopeResult.valid) {
      return {
        status: 'denied',
        error: scopeResult.error ?? 'Scope validation failed',
      };
    }

    // 3. Create action from tool call
    const action: IronclawAction = {
      id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: toolName,
      description: `MCP tool call: ${toolName}`,
      payload: args,
      problem_set_id: problemSetId,
      requested_by: userDid,
    };

    // 4. Route through action pipeline
    const result = await actionPipeline.processAction(action, userDid);

    // 5. Execute builder CRUD when action pipeline approves
    if (result.status === 'executed') {
      const execResult = await executeApprovedAction(action.type, action.payload, userDid);
      if (execResult.success) {
        result.result = execResult.result;
      } else {
        result.status = 'denied';
        result.error = `Execution failed: ${execResult.error}`;
      }
    }

    return result;
  }

  /**
   * Detect and block agent self-modification attempts.
   *
   * Returns an error message if the action is blocked, or null if allowed.
   *
   * Blocked patterns:
   * - bastion.system.update_config targeting any PROTECTED_CONFIG_KEYS
   * - bastion.problem_set.configure_agents targeting Ironclaw's own config
   */
  private checkSelfModification(
    toolName: string,
    args: Record<string, unknown>,
  ): string | null {
    if (toolName === 'bastion.system.update_config') {
      const key = args.key as string | undefined;
      if (!key) return null;

      // Check exact match
      if (PROTECTED_CONFIG_KEYS.has(key)) {
        return `Agent cannot modify protected config key "${key}". This setting governs agent authority and must be changed by a human administrator directly.`;
      }

      // Check prefix match (e.g., "ironclaw.risk_levels.ps.read" matches "ironclaw.risk_levels")
      for (const protectedKey of PROTECTED_CONFIG_KEYS) {
        if (key.startsWith(protectedKey + '.') || key.startsWith(protectedKey + '/')) {
          return `Agent cannot modify config under protected namespace "${protectedKey}". This setting governs agent authority and must be changed by a human administrator directly.`;
        }
      }
    }

    if (toolName === 'bastion.problem_set.configure_agents') {
      const agentConfig = args.agent_config as Record<string, unknown> | undefined;
      if (agentConfig) {
        // Block if the config references Ironclaw's own settings
        const configStr = JSON.stringify(agentConfig).toLowerCase();
        if (configStr.includes('ironclaw') || configStr.includes('chief_of_staff') || configStr.includes('chief-of-staff')) {
          return 'Agent cannot modify its own configuration. Ironclaw agent settings must be changed by a human administrator directly.';
        }
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const toolBridge = new ToolBridge();
