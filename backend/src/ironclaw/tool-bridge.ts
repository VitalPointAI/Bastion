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
    name: 'bastion_code_create_pr',
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
    name: 'bastion_design_update_section',
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
    name: 'bastion_graph_search_actors',
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
    name: 'bastion_graph_get_actor',
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
    name: 'bastion_graph_query',
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
    name: 'bastion_graph_stats',
    description: 'Get knowledge graph statistics: total nodes, relationships, node types, and top actors by relationship count.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    riskLevel: 'low',
  },
  // ── Cross-scope graph & objective hierarchy tools ──
  {
    name: 'bastion_graph_get_objective_hierarchy',
    description: 'Walk up the parent problem set chain and return objectives from each ancestor, grouped by echelon. Provides cross-echelon objective visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID to start the parent-chain walk from' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_graph_adopt_objective',
    description: 'Adopt an objective from a parent problem set into a target workspace. Creates a linked copy with DRAFT status.',
    inputSchema: {
      type: 'object',
      properties: {
        source_objective_id: { type: 'string', description: 'ID of the objective to adopt' },
        target_workspace_id: { type: 'string', description: 'Problem set ID to receive the adopted objective' },
      },
      required: ['source_objective_id', 'target_workspace_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_graph_assess_objectives',
    description: 'Auto-assess and adopt relevant objectives from a parent problem set into a child. Skips already-adopted objectives.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Child problem set ID to populate with parent objectives' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_graph_query_global',
    description: 'Query all actors across the entire knowledge graph without workspace filter. Returns actor nodes with relationship counts.',
    inputSchema: {
      type: 'object',
      properties: {
        classification: { type: 'string', description: 'Optional classification filter' },
        limit: { type: 'number', description: 'Max results (default 50, max 200)' },
      },
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_graph_query_parent',
    description: 'Query actors from both a problem set and its parent workspace. Returns merged nodes tagged with source workspace ID.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID (will also include parent workspace actors)' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_design_synthesize_current_state',
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
    name: 'bastion_design_map_move_symbol',
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
    name: 'bastion_design_map_remove_symbol',
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
    name: 'bastion_design_map_update_symbol',
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
    name: 'bastion_design_map_add_control_measure',
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
    name: 'bastion_design_map_add_overlay_graphic',
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

  // -------------------------------------------------------------------------
  // Intelligence Gap Monitoring
  // -------------------------------------------------------------------------
  {
    name: 'bastion_intel_get_intelligence_gaps',
    description: 'Return current intelligence gaps for a problem set including parent graph suggestions for cross-boundary relevance',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_get_gap_filler_status',
    description: 'Return the gap filler service state: last run time, gaps processed, active cooldowns, next scheduled run',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_prioritize_gap_research',
    description: 'Bump a specific intelligence gap to high priority, clear its cooldown, and optionally trigger immediate research',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        gap_node_id: { type: 'string', description: 'Node ID of the gap to prioritize' },
        reason: { type: 'string', description: 'Reason for prioritization (audit trail)' },
      },
      required: ['problem_set_id', 'gap_node_id', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_request_targeted_research',
    description: 'Request research on a specific topic or entity via the researcher specialist, creating an async pg-boss job',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        query: { type: 'string', description: 'Research topic or entity to investigate' },
        context: { type: 'string', description: 'Additional context for why this research matters' },
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
    description: 'List active PIRs/CCIRs for a problem set ordered by priority',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        type: { type: 'string', enum: ['CCIR', 'PIR', 'FFIR', 'EEFI'], description: 'Filter by type' },
        status: { type: 'string', enum: ['ACTIVE', 'ANSWERED', 'SUPERSEDED', 'CANCELLED'], description: 'Filter by status' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_create_pir_from_assumption',
    description: 'Create a PIR linked to an assumption from the operational design',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        assumption_id: { type: 'string', description: 'Assumption ID to link' },
        assumption_text: { type: 'string', description: 'Text of the assumption' },
        type: { type: 'string', enum: ['CCIR', 'PIR', 'FFIR', 'EEFI'], description: 'Requirement type (default PIR)' },
        priority: { type: 'number', description: 'Priority (1=highest)' },
      },
      required: ['problem_set_id', 'assumption_text'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_answer_pir',
    description: 'Mark a PIR as answered with supporting evidence',
    inputSchema: {
      type: 'object',
      properties: {
        pir_id: { type: 'string', description: 'PIR ID to answer' },
        answer: { type: 'string', description: 'Answer text with evidence' },
        answered_by: { type: 'string', description: 'Who answered' },
      },
      required: ['pir_id', 'answer'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_derive_pirs_from_design',
    description: 'Analyze operational design and recommend PIRs from assumptions, CoG analysis, LOEs, and constraints',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
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
    description: 'Create a PIR alert decision when Ironclaw detects intelligence relevant to an active PIR. Routes to the commander for accept/reject/request-more-info.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
        pir_id: { type: 'string', description: 'ID of the active PIR this intelligence relates to' },
        summary: { type: 'string', description: 'Brief summary of the intelligence finding' },
        evidence: { type: 'string', description: 'Supporting evidence and source references' },
        suggested_answer: { type: 'string', description: 'Suggested answer to the PIR based on the intelligence' },
      },
      required: ['problem_set_id', 'pir_id', 'summary', 'evidence', 'suggested_answer'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_get_pir_alert_history',
    description: 'Get history of PIR alert decisions and their outcomes for a problem set. Includes approved, rejected, and pending alerts.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set ID' },
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
    description: 'Create a new reusable skill that persists across sessions',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Skill name (snake_case)' },
        description: { type: 'string', description: 'What this skill does' },
        category: { type: 'string', description: 'Category (e.g. planning, intelligence, logistics)' },
        systemPromptFragment: { type: 'string', description: 'System prompt instructions for executing this skill' },
        inputSchema: { type: 'object', description: 'JSON Schema for skill input parameters' },
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
        name: { type: 'string', description: 'Agent display name' },
        description: { type: 'string', description: 'Agent role and capabilities' },
        capabilities: { type: 'array', items: { type: 'string' }, description: 'List of capability tags' },
        problem_set_id: { type: 'string', description: 'Problem set to assign agent to' },
      },
      required: ['name', 'description'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_agent_list',
    description: 'List all registered agents with health status',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Filter by problem set (optional)' },
      },
    },
    riskLevel: 'low',
  },

  // -------------------------------------------------------------------------
  // Team Management
  // -------------------------------------------------------------------------
  {
    name: 'bastion_team_create',
    description: 'Create a new agent team for collaborative tasks',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Team name' },
        description: { type: 'string', description: 'Team mission and scope' },
        member_ids: { type: 'array', items: { type: 'string' }, description: 'Agent IDs to add as members' },
        problem_set_id: { type: 'string', description: 'Problem set scope' },
      },
      required: ['name', 'description'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_team_add_member',
    description: 'Add an agent to an existing team',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Team ID' },
        agent_id: { type: 'string', description: 'Agent ID to add' },
      },
      required: ['team_id', 'agent_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_team_assign_task',
    description: 'Assign a task to an agent team for collaborative execution',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Team ID' },
        task_description: { type: 'string', description: 'Description of the task to assign' },
        problem_set_id: { type: 'string', description: 'Problem set scope' },
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
    description: 'Search the web via SearXNG for intelligence on a topic. Returns search results with titles, URLs, and snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        max_results: { type: 'number', description: 'Maximum results (default 5)' },
      },
      required: ['query'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_create_research_event',
    description: 'Create a synthetic OSINT event from autonomous research findings. The event enters the standard ingestion pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set to associate the event with' },
        title: { type: 'string', description: 'Short title for the finding' },
        content: { type: 'string', description: 'Full content of the finding' },
        source_url: { type: 'string', description: 'Optional source URL' },
        source_name: { type: 'string', description: 'Optional source name (defaults to "Ironclaw Research")' },
      },
      required: ['problem_set_id', 'title', 'content'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_process_osint_event',
    description: 'Trigger the OSINT specialist agent pipeline to process an event, extracting entities, relationships, and tensions.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'OSINT event ID (EVT-* format)' },
        problem_set_id: { type: 'string', description: 'Problem set context for entity scoping' },
      },
      required: ['event_id', 'problem_set_id'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_detect_conflicts',
    description: 'Scan the knowledge graph for contradictions, conflicting claims, or opposing intelligence about entities.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set brain slice to scan' },
        entity_name: { type: 'string', description: 'Optional: limit scan to a specific actor name' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_draft_situation_assessment',
    description: 'Gather raw intelligence data for a situation assessment. Returns structured data that Ironclaw synthesizes into a narrative.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set to assess' },
        focus_area: { type: 'string', description: 'Optional focus area or topic' },
        time_window_hours: { type: 'number', description: 'Hours of history to include (default 24)' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_autonomous_log_activity',
    description: "Log an autonomous activity entry visible in the commander's activity feed.",
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set this activity relates to' },
        activity_type: { type: 'string', description: 'Activity category (e.g. "intel_research", "brain_curation")' },
        severity: { type: 'string', description: 'Severity: critical, urgent, routine, informational' },
        summary: { type: 'string', description: 'One-line summary of what was done' },
        detail: { type: 'object', description: 'Optional structured detail (JSON)' },
      },
      required: ['problem_set_id', 'activity_type', 'severity', 'summary'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_autonomous_send_alert',
    description: 'Send an alert to commanders via WebSocket and optionally Telegram. Use for time-sensitive findings.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set this alert relates to' },
        message: { type: 'string', description: 'Alert message text' },
        severity: { type: 'string', enum: ['critical', 'urgent', 'routine'], description: 'Alert severity level' },
        telegram: { type: 'boolean', description: 'If true and severity is critical/urgent, also send via Telegram' },
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
    description: 'Scan the global knowledge graph for actors/relationships relevant to this problem set but not yet in its brain slice. Returns scored candidates.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set to evaluate against the global graph' },
        max_candidates: { type: 'number', description: 'Max candidates to return (default 20)' },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_brain_augment_slice',
    description: "Pull actors into this problem set's brain slice by adding to containerIds. Use when you discover globally relevant actors not yet in this problem set's view.",
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set to augment' },
        actor_ids: { type: 'array', items: { type: 'string' }, description: 'Actor node IDs to add to this slice' },
        reason: { type: 'string', description: 'Reason for augmenting (audit trail)' },
      },
      required: ['problem_set_id', 'actor_ids', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_brain_prune_slice',
    description: "Remove actors from this problem set's brain slice (removes from containerIds only — does not delete from global brain).",
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set to prune' },
        actor_ids: { type: 'array', items: { type: 'string' }, description: 'Actor node IDs to remove from this slice' },
        reason: { type: 'string', description: 'Reason for pruning (audit trail)' },
      },
      required: ['problem_set_id', 'actor_ids', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_brain_get_slice_stats',
    description: "Get statistics about the problem set's brain slice: size vs global brain, staleness, orphan count.",
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: { type: 'string', description: 'Problem set to get brain slice statistics for' },
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
