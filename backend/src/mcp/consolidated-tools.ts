/**
 * Consolidated MCP Tool Definitions
 *
 * Exposes a SINGLE `bastion` MCP tool to minimize Ironclaw's select_tools
 * token usage. The tool takes `category` + `action` parameters that route
 * internally to the original handler via CONSOLIDATED_DISPATCH.
 *
 * This means Ironclaw adds only 1 BASTION tool to its tool selection step,
 * keeping total tools manageable for Haiku.
 */

import type { MCPToolDefinition } from '../ironclaw/tool-bridge.js';

// ---------------------------------------------------------------------------
// Dispatch Map: (category, action) → original handler name
// ---------------------------------------------------------------------------

export const CONSOLIDATED_DISPATCH: Record<string, Record<string, string>> = {
  design: {
    update_section: 'bastion_design_update_section',
    synthesize_current_state: 'bastion_design_synthesize_current_state',
    map_add_symbol: 'design.map.add_symbol',
    map_move_symbol: 'design.map.move_symbol',
    map_remove_symbol: 'design.map.remove_symbol',
    map_update_symbol: 'design.map.update_symbol',
    map_add_control_measure: 'design.map.add_control_measure',
    map_add_overlay_graphic: 'design.map.add_overlay_graphic',
  },
  intel: {
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
  graph: {
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
  brain: {
    evaluate: 'bastion_brain_evaluate_relevance',
    augment: 'bastion_brain_augment_slice',
    prune: 'bastion_brain_prune_slice',
    stats: 'bastion_brain_get_slice_stats',
  },
  ops: {
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
  admin: {
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
  staff: {
    list: 'bastion_personnel_list_staff',
    get_member: 'bastion_personnel_get_member',
    get_clearances: 'bastion_personnel_get_clearances',
  },
};

// Build action enum from all categories
const ALL_ACTIONS: string[] = [];
for (const [cat, actions] of Object.entries(CONSOLIDATED_DISPATCH)) {
  for (const action of Object.keys(actions)) {
    ALL_ACTIONS.push(`${cat}.${action}`);
  }
}

// ---------------------------------------------------------------------------
// Single unified tool
// ---------------------------------------------------------------------------

export const CONSOLIDATED_TOOLS: MCPToolDefinition[] = [
  {
    name: 'bastion',
    description: 'BASTION C2 platform tool. Specify category.action (e.g. "design.update_section", "graph.search", "intel.web_search"). For CoG analysis: category=design, action=update_section, section=cog-analysis, data={nested CC→CR→CV structure}.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: Object.keys(CONSOLIDATED_DISPATCH),
          description: 'Tool category: design, intel, graph, brain, ops, admin, staff',
        },
        action: {
          type: 'string',
          description: 'Action within category (e.g. update_section, search, web_search)',
        },
        problem_set_id: {
          type: 'string',
          description: 'Problem set ID — REQUIRED for all design/intel/brain/ops operations. Use the ID from the commander\'s current context.',
        },
        // Design params
        section: { type: 'string' },
        data: { type: 'object' },
        // Graph params
        query: { type: 'string' },
        name: { type: 'string' },
        cypher: { type: 'string' },
        // Intel params
        pir_id: { type: 'string' },
        event_id: { type: 'string' },
        assumption_text: { type: 'string' },
        answer: { type: 'string' },
        // Brain params
        actor_ids: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' },
        // General params
        id: { type: 'string' },
        type: { type: 'string' },
        label: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        summary: { type: 'string' },
        message: { type: 'string' },
        severity: { type: 'string' },
        description: { type: 'string' },
        field: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['category', 'action', 'problem_set_id'],
    },
    riskLevel: 'medium',
  },
];
