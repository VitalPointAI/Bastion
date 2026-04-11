/**
 * Ironclaw MCP Tool Bridge
 *
 * Phase 30 Plan 04: Registers BASTION-specific domain tools with the Ironclaw
 * sidecar via MCP protocol. Provides scope validation to enforce problem set
 * boundaries and routes tool calls through the action pipeline.
 *
 * Key design decisions:
 * - Ambiguous scope triggers clarification prompt (never assumes)
 * - Tools without PS-scoped fields are only valid for 'bastion_system_*' types
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
    name: 'bastion_problem_set_read',
    description: 'Read problem set details and configuration',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_problem_set_list_children',
    description: 'List child problem sets',
    inputSchema: {
      type: 'object',
      properties: { parent_id: { type: 'string' } },
      required: ['parent_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_problem_set_update_field',
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
    name: 'bastion_problem_set_create_child',
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
    name: 'bastion_problem_set_configure_agents',
    description: 'Configure AI agents for a problem set (not Ironclaw)',
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
    name: 'bastion_resource_create',
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
    name: 'bastion_resource_delete',
    description: 'Delete a resource from the registry',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    riskLevel: 'high',
  },
  {
    name: 'bastion_gate_create',
    description: 'Create decision gate for approval workflow',
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
    name: 'bastion_code_create_pr',
    description: 'Create GitHub PR with code changes',
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
    name: 'bastion_design_update_section',
    description: 'Persist design section data (CoG, framing, LOE, op approach)',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        section: {
          type: 'string',
          enum: ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'],
        },
        data: { type: 'object' },
      },
      required: ['problem_set_id', 'section', 'data'],
    },
    riskLevel: 'medium',
  },
  // ── Knowledge Graph Tools ──
  {
    name: 'bastion_graph_search_actors',
    description: 'Search knowledge graph actors by name or type',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        type: { type: 'string', description: 'state|organization|individual|military|non_state' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_graph_get_actor',
    description: 'Get full actor details with relationships and sources',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_graph_query',
    description: 'Run read-only Cypher query against knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        cypher: { type: 'string', description: 'MATCH/RETURN only, no writes' },
      },
      required: ['cypher'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_graph_stats',
    description: 'Get knowledge graph node/relationship statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    riskLevel: 'low',
  },
  // ── Cross-scope graph & objective hierarchy tools ──
  {
    name: 'bastion_graph_get_objective_hierarchy',
    description: 'Get objectives from ancestor problem sets by echelon',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_graph_adopt_objective',
    description: 'Adopt a parent objective into a problem set as DRAFT',
    inputSchema: {
      type: 'object',
      properties: {
        source_objective_id: { type: 'string' },
        target_workspace_id: { type: 'string' },
      },
      required: ['source_objective_id', 'target_workspace_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_graph_assess_objectives',
    description: 'Auto-adopt relevant parent objectives into child',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_graph_query_global',
    description: 'Query all actors across global knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        classification: { type: 'string' },
        limit: { type: 'number' },
      },
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_graph_query_parent',
    description: 'Query actors from problem set and its parent',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_design_synthesize_current_state',
    description: 'Synthesize current state from knowledge graph into problem framing',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_system_update_config',
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
    name: 'bastion_design_map_add_symbol',
    description: 'Add military symbol to map overlay',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        sidc: { type: 'string', description: 'MIL-STD-2525D SIDC' },
        designation: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        mgrs: { type: 'string', description: 'MGRS coord (alt to lat/lng)' },
        echelon: { type: 'string' },
      },
      required: ['problem_set_id', 'sidc'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_design_map_move_symbol',
    description: 'Move map symbol to new position',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        symbol_id: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        mgrs: { type: 'string', description: 'MGRS coord (alt to lat/lng)' },
      },
      required: ['problem_set_id', 'symbol_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_design_map_remove_symbol',
    description: 'Remove symbol from map overlay',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        symbol_id: { type: 'string' },
      },
      required: ['problem_set_id', 'symbol_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_design_map_update_symbol',
    description: 'Update map symbol properties',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        symbol_id: { type: 'string' },
        sidc: { type: 'string', description: 'MIL-STD-2525D SIDC' },
        designation: { type: 'string' },
        echelon: { type: 'string' },
      },
      required: ['problem_set_id', 'symbol_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_design_map_add_control_measure',
    description: 'Add control measure (phase line, boundary, etc.) to map',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        type: {
          type: 'string',
          enum: ['phase_line', 'boundary', 'axis_of_advance', 'objective', 'engagement_area', 'nai', 'fscm', 'flot', 'other'],
        },
        label: { type: 'string' },
        coordinates: {
          type: 'array',
          items: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
        },
        affiliation: {
          type: 'string',
          enum: ['friendly', 'enemy', 'neutral'],
        },
      },
      required: ['problem_set_id', 'type', 'label', 'coordinates'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_design_map_add_overlay_graphic',
    description: 'Add annotation graphic to map overlay',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        graphic_type: { type: 'string', description: 'arrow|circle|text etc.' },
        label: { type: 'string' },
        coordinates: {
          type: 'array',
          items: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
        },
      },
      required: ['problem_set_id', 'graphic_type', 'label', 'coordinates'],
    },
    riskLevel: 'medium',
  },

  // -------------------------------------------------------------------------
  // Intelligence Gap Monitoring
  // -------------------------------------------------------------------------
  {
    name: 'bastion_intel_get_intelligence_gaps',
    description: 'Get intelligence gaps with parent graph suggestions',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_get_gap_filler_status',
    description: 'Get gap filler service status and cooldowns',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_prioritize_gap_research',
    description: 'Prioritize intel gap and clear cooldown',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        gap_node_id: { type: 'string' },
        reason: { type: 'string', description: 'Audit trail' },
      },
      required: ['problem_set_id', 'gap_node_id', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_request_targeted_research',
    description: 'Request targeted research via researcher specialist',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        query: { type: 'string', description: 'Topic or entity to research' },
        context: { type: 'string', description: 'Why this research matters' },
      },
      required: ['problem_set_id', 'query', 'context'],
    },
    riskLevel: 'medium',
  },

  // -------------------------------------------------------------------------
  // PIR/CCIR Management
  // -------------------------------------------------------------------------
  {
    name: 'bastion_intel_get_priority_intel_requirements',
    description: 'List PIRs/CCIRs ordered by priority',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        type: { type: 'string', enum: ['CCIR', 'PIR', 'FFIR', 'EEFI'] },
        status: { type: 'string', enum: ['ACTIVE', 'ANSWERED', 'SUPERSEDED', 'CANCELLED'] },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_create_pir_from_assumption',
    description: 'Create PIR linked to an operational design assumption',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        assumption_id: { type: 'string' },
        assumption_text: { type: 'string' },
        type: { type: 'string', enum: ['CCIR', 'PIR', 'FFIR', 'EEFI'] },
        priority: { type: 'number', description: '1=highest' },
      },
      required: ['problem_set_id', 'assumption_text'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_answer_pir',
    description: 'Mark PIR as answered with evidence',
    inputSchema: {
      type: 'object',
      properties: {
        pir_id: { type: 'string' },
        answer: { type: 'string' },
        answered_by: { type: 'string' },
      },
      required: ['pir_id', 'answer'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_derive_pirs_from_design',
    description: 'Derive recommended PIRs from operational design',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },

  // -------------------------------------------------------------------------
  // PIR Alert Tools
  // -------------------------------------------------------------------------
  {
    name: 'bastion_intel_create_pir_alert',
    description: 'Create PIR alert for commander review',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        pir_id: { type: 'string' },
        summary: { type: 'string' },
        evidence: { type: 'string' },
        suggested_answer: { type: 'string' },
      },
      required: ['problem_set_id', 'pir_id', 'summary', 'evidence', 'suggested_answer'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_get_pir_alert_history',
    description: 'Get PIR alert decision history',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },

  // -------------------------------------------------------------------------
  // Skill Management
  // -------------------------------------------------------------------------
  {
    name: 'bastion_skill_create',
    description: 'Create reusable skill persisted across sessions',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'snake_case name' },
        description: { type: 'string' },
        category: { type: 'string' },
        systemPromptFragment: { type: 'string', description: 'System prompt for execution' },
        inputSchema: { type: 'object' },
      },
      required: ['name', 'description', 'category', 'systemPromptFragment'],
    },
    riskLevel: 'medium',
  },

  // -------------------------------------------------------------------------
  // Agent Management
  // -------------------------------------------------------------------------
  {
    name: 'bastion_agent_create',
    description: 'Create and register a new AI agent',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        capabilities: { type: 'array', items: { type: 'string' } },
        problem_set_id: { type: 'string' },
      },
      required: ['name', 'description'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_agent_list',
    description: 'List registered agents with health status',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
    },
    riskLevel: 'low',
  },

  // -------------------------------------------------------------------------
  // Team Management
  // -------------------------------------------------------------------------
  {
    name: 'bastion_team_create',
    description: 'Create agent team for collaborative tasks',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        member_ids: { type: 'array', items: { type: 'string' } },
        problem_set_id: { type: 'string' },
      },
      required: ['name', 'description'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_team_add_member',
    description: 'Add agent to existing team',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string' },
        agent_id: { type: 'string' },
      },
      required: ['team_id', 'agent_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_team_assign_task',
    description: 'Assign task to agent team',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string' },
        task_description: { type: 'string' },
        problem_set_id: { type: 'string' },
      },
      required: ['team_id', 'task_description', 'problem_set_id'],
    },
    riskLevel: 'medium',
  },

  // -------------------------------------------------------------------------
  // Autonomous Intelligence Tools (Phase 65 Plan 02)
  // -------------------------------------------------------------------------
  {
    name: 'bastion_intel_web_search',
    description: 'Web search via SearXNG for intelligence',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'number' },
      },
      required: ['query'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_create_research_event',
    description: 'Create OSINT event from research findings',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        source_url: { type: 'string' },
        source_name: { type: 'string' },
      },
      required: ['problem_set_id', 'title', 'content'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_process_osint_event',
    description: 'Process OSINT event through specialist pipeline',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'EVT-* format' },
        problem_set_id: { type: 'string' },
      },
      required: ['event_id', 'problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_detect_conflicts',
    description: 'Detect contradictions in knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        entity_name: { type: 'string', description: 'Limit to specific actor' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_draft_situation_assessment',
    description: 'Gather raw intel data for situation assessment',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        focus_area: { type: 'string' },
        time_window_hours: { type: 'number' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_autonomous_log_activity',
    description: "Log activity to commander's feed",
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        activity_type: { type: 'string' },
        severity: { type: 'string', description: 'critical|urgent|routine|informational' },
        summary: { type: 'string' },
        detail: { type: 'object' },
      },
      required: ['problem_set_id', 'activity_type', 'severity', 'summary'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_autonomous_send_alert',
    description: 'Send alert to commanders via WebSocket/Telegram',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        message: { type: 'string' },
        severity: { type: 'string', enum: ['critical', 'urgent', 'routine'] },
        telegram: { type: 'boolean', description: 'Also send via Telegram' },
      },
      required: ['problem_set_id', 'message', 'severity'],
    },
    riskLevel: 'medium',
  },

  // -------------------------------------------------------------------------
  // Brain Curation Tools (Phase 65 Plan 02)
  // -------------------------------------------------------------------------
  {
    name: 'bastion_brain_evaluate_relevance',
    description: 'Find global graph actors relevant but missing from slice',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        max_candidates: { type: 'number' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_brain_augment_slice',
    description: 'Pull global actors into problem set brain slice',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        actor_ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string', description: 'Audit trail' },
      },
      required: ['problem_set_id', 'actor_ids', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_brain_prune_slice',
    description: 'Remove actors from brain slice (not global)',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
        actor_ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string', description: 'Audit trail' },
      },
      required: ['problem_set_id', 'actor_ids', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_brain_get_slice_stats',
    description: 'Get brain slice stats vs global graph',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
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
   * - If no PS-scoped field in args: valid only for 'bastion_system_*' tools.
   */
  validateScope(
    toolName: string,
    args: Record<string, unknown>,
    userProblemSetId: string,
  ): ScopeValidationResult {
    // System-scoped tools do not require PS scope
    if (toolName.startsWith('bastion_system_')) {
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

    // 2. Determine risk level and autonomous context
    const toolDef = BASTION_TOOLS.find((t) => t.name === toolName);
    const riskLevel = toolDef?.riskLevel ?? 'medium';
    const isAutonomousContext = !userDid || userDid === 'system' || userDid === 'default';

    // 3. For autonomous/MCP contexts (no real user DID), low/medium-risk tools
    //    execute directly without scope validation or the action pipeline.
    //    The pipeline requires interactive user confirmation which is impossible
    //    during routine/heartbeat execution. High-risk tools are still blocked.
    if (isAutonomousContext && riskLevel !== 'high') {
      const execResult = await executeApprovedAction(toolName, args, userDid || 'system');
      if (execResult.success) {
        return { status: 'executed', result: execResult.result };
      }
      return { status: 'denied', error: `Execution failed: ${execResult.error}` };
    }

    // 4. Validate scope (interactive contexts only)
    const scopeResult = this.validateScope(toolName, args, problemSetId);
    if (!scopeResult.valid) {
      return {
        status: 'denied',
        error: scopeResult.error ?? 'Scope validation failed',
      };
    }

    // 5. Create action from tool call
    const action: IronclawAction = {
      id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: toolName,
      description: `MCP tool call: ${toolName}`,
      payload: args,
      problem_set_id: problemSetId,
      requested_by: userDid,
    };

    // 6. Route through action pipeline (interactive contexts)
    const result = await actionPipeline.processAction(action, userDid);

    // 7. Execute builder CRUD when action pipeline approves
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
   * - bastion_system_update_config targeting any PROTECTED_CONFIG_KEYS
   * - bastion_problem_set_configure_agents targeting Ironclaw's own config
   */
  private checkSelfModification(
    toolName: string,
    args: Record<string, unknown>,
  ): string | null {
    if (toolName === 'bastion_system_update_config') {
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

    if (toolName === 'bastion_problem_set_configure_agents') {
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
