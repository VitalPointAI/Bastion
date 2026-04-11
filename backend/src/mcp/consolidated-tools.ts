/**
 * Consolidated MCP Tool Definitions
 *
 * Reduces 80+ individual tools to ~8 category routers so Haiku's
 * tool-selection step doesn't exceed its output token limit.
 *
 * Each category tool takes an `action` enum to route internally.
 * The MCP server dispatches (category, action) → original handler
 * via CONSOLIDATED_DISPATCH.
 */

import type { MCPToolDefinition } from '../ironclaw/tool-bridge.js';

// ---------------------------------------------------------------------------
// Tab-based Tool Filtering
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Dispatch Map: (categoryTool, action) → original handler name
// ---------------------------------------------------------------------------

export const CONSOLIDATED_DISPATCH: Record<string, Record<string, string>> = {
  bastion_design: {
    update_section: 'bastion_design_update_section',
    synthesize_current_state: 'bastion_design_synthesize_current_state',
    map_add_symbol: 'design.map.add_symbol',
    map_move_symbol: 'design.map.move_symbol',
    map_remove_symbol: 'design.map.remove_symbol',
    map_update_symbol: 'design.map.update_symbol',
    map_add_control_measure: 'design.map.add_control_measure',
    map_add_overlay_graphic: 'design.map.add_overlay_graphic',
  },
  bastion_intel: {
    get_gaps: 'bastion_intel_get_intelligence_gaps',
    get_gap_status: 'bastion_intel_get_gap_filler_status',
    prioritize_gap: 'bastion_intel_prioritize_gap_research',
    request_research: 'bastion_intel_request_targeted_research',
    get_pirs: 'bastion_intel_get_priority_intel_requirements',
    create_pir: 'bastion_intel_create_pir_from_assumption',
    answer_pir: 'bastion_intel_answer_pir',
    derive_pirs: 'bastion_intel_derive_pirs_from_design',
    create_alert: 'bastion_intel_create_pir_alert',
    get_alert_history: 'bastion_intel_get_pir_alert_history',
    web_search: 'bastion_intel_web_search',
    create_event: 'bastion_intel_create_research_event',
    process_event: 'bastion_intel_process_osint_event',
    detect_conflicts: 'bastion_intel_detect_conflicts',
    draft_assessment: 'bastion_intel_draft_situation_assessment',
  },
  bastion_graph: {
    search: 'bastion_graph_search_actors',
    get_actor: 'bastion_graph_get_actor',
    query: 'bastion_graph_query',
    stats: 'bastion_graph_stats',
    query_global: 'bastion_graph_query_global',
    query_parent: 'bastion_graph_query_parent',
    get_hierarchy: 'bastion_graph_get_objective_hierarchy',
    adopt_objective: 'bastion_graph_adopt_objective',
    assess_objectives: 'bastion_graph_assess_objectives',
    search_documents: 'bastion_knowledge_search_documents',
  },
  bastion_brain: {
    evaluate: 'bastion_brain_evaluate_relevance',
    augment: 'bastion_brain_augment_slice',
    prune: 'bastion_brain_prune_slice',
    stats: 'bastion_brain_get_slice_stats',
  },
  bastion_ops: {
    read_problem_set: 'bastion_problem_set_read',
    list_children: 'bastion_problem_set_list_children',
    update_field: 'bastion_problem_set_update_field',
    create_child: 'bastion_problem_set_create_child',
    configure_agents: 'bastion_problem_set_configure_agents',
    get_design: 'bastion_ops_get_operational_design',
    get_campaign: 'bastion_ops_get_campaign_plan',
    get_coa: 'bastion_ops_get_coa',
    list_all: 'bastion_ops_list_problem_sets',
    create_gate: 'bastion_gate_create',
    log_activity: 'bastion_autonomous_log_activity',
    send_alert: 'bastion_autonomous_send_alert',
    get_schedule: 'bastion_calendar_get_schedule',
    get_events: 'bastion_calendar_get_events',
  },
  bastion_admin: {
    agent_create: 'bastion_agent_create',
    agent_list: 'bastion_agent_list',
    team_create: 'bastion_team_create',
    team_add_member: 'bastion_team_add_member',
    team_assign_task: 'bastion_team_assign_task',
    skill_create: 'bastion_skill_create',
    resource_create: 'bastion_resource_create',
    resource_delete: 'bastion_resource_delete',
    resource_list: 'bastion_resources_list',
    resource_status: 'bastion_resources_get_status',
    resource_search: 'bastion_resources_search_capabilities',
    system_config: 'bastion_system_update_config',
    code_pr: 'bastion_code_create_pr',
  },
  bastion_staff: {
    list: 'bastion_personnel_list_staff',
    get_member: 'bastion_personnel_get_member',
    get_clearances: 'bastion_personnel_get_clearances',
  },
};

// ---------------------------------------------------------------------------
// Consolidated Tool Definitions
// ---------------------------------------------------------------------------

export const CONSOLIDATED_TOOLS: MCPToolDefinition[] = [
  {
    name: 'bastion_design',
    description: 'Design tab: update CoG/LOE/approach sections, manage map symbols. ALWAYS use update_section to write to canvas. CoG data MUST be nested: CC contains CRs, each CR contains CVs.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH.bastion_design),
        },
        problem_set_id: { type: 'string' },
        section: { type: 'string', enum: ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'] },
        data: { type: 'object' },
        sidc: { type: 'string' },
        symbol_id: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        mgrs: { type: 'string' },
        designation: { type: 'string' },
        echelon: { type: 'string' },
        type: { type: 'string' },
        label: { type: 'string' },
        coordinates: { type: 'array' },
        graphic_type: { type: 'string' },
      },
      required: ['action', 'problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel',
    description: 'Intelligence: PIRs, OSINT events, web search, gap analysis, situation assessment',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH.bastion_intel),
        },
        problem_set_id: { type: 'string' },
        query: { type: 'string' },
        pir_id: { type: 'string' },
        event_id: { type: 'string' },
        assumption_text: { type: 'string' },
        answer: { type: 'string' },
        gap_node_id: { type: 'string' },
        reason: { type: 'string' },
        context: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        summary: { type: 'string' },
        evidence: { type: 'string' },
        suggested_answer: { type: 'string' },
      },
      required: ['action'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_graph',
    description: 'Knowledge graph: search actors, run Cypher queries, get stats, manage objectives',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH.bastion_graph),
        },
        query: { type: 'string' },
        name: { type: 'string' },
        cypher: { type: 'string' },
        problem_set_id: { type: 'string' },
        source_objective_id: { type: 'string' },
        target_workspace_id: { type: 'string' },
        entity_id: { type: 'string' },
        type: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['action'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_brain',
    description: 'Brain curation: evaluate relevance, add/remove actors from brain slice',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH.bastion_brain),
        },
        problem_set_id: { type: 'string' },
        actor_ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' },
      },
      required: ['action', 'problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_ops',
    description: 'Operations: problem sets, gates, alerts, schedule, campaign plans',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH.bastion_ops),
        },
        problem_set_id: { type: 'string' },
        id: { type: 'string' },
        parent_id: { type: 'string' },
        field: { type: 'string' },
        value: { type: 'string' },
        name: { type: 'string' },
        gate_type: { type: 'string' },
        target_item_id: { type: 'string' },
        target_item_title: { type: 'string' },
        activity_type: { type: 'string' },
        severity: { type: 'string' },
        summary: { type: 'string' },
        message: { type: 'string' },
        coa_id: { type: 'string' },
        date_from: { type: 'string' },
        date_to: { type: 'string' },
        agent_config: { type: 'object' },
      },
      required: ['action'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_admin',
    description: 'Admin: manage agents, teams, skills, resources, system config',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH.bastion_admin),
        },
        name: { type: 'string' },
        description: { type: 'string' },
        team_id: { type: 'string' },
        agent_id: { type: 'string' },
        task_description: { type: 'string' },
        problem_set_id: { type: 'string' },
        category: { type: 'string' },
        systemPromptFragment: { type: 'string' },
        type: { type: 'string' },
        id: { type: 'string' },
        resource_id: { type: 'string' },
        capabilities: { type: 'array' },
        key: { type: 'string' },
        value: { type: 'string' },
        title: { type: 'string' },
        branch: { type: 'string' },
        files: { type: 'array' },
      },
      required: ['action'],
    },
    riskLevel: 'high',
  },
  {
    name: 'bastion_staff',
    description: 'Personnel: list staff, get member details, check clearances',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH.bastion_staff),
        },
        member_id: { type: 'string' },
      },
      required: ['action'],
    },
    riskLevel: 'medium',
  },
];
