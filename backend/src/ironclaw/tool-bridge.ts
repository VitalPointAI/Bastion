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
