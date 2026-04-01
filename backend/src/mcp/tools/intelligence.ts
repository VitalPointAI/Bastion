/**
 * MCP Intelligence Tool Group
 *
 * Phase 65 Plan 02: Exposes autonomous intelligence operations to Ironclaw
 * via MCP. Covers web search, synthetic OSINT event creation, agent pipeline
 * processing, conflict detection, situation assessment, activity logging,
 * alerting, and brain slice curation.
 *
 * Blueprint Section 4.2 — Intelligence and Brain Curation domain tools.
 */

import type { MCPToolDefinition } from '../../ironclaw/tool-bridge.js';

export const intelligenceTools: MCPToolDefinition[] = [
  // ── Web Intelligence ──
  {
    name: 'bastion_intel_web_search',
    description:
      'Search the web via SearXNG for intelligence on a topic. Returns search results with ' +
      'titles, URLs, and snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to submit to the web search provider',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_create_research_event',
    description:
      'Create a synthetic OSINT event from autonomous research findings. ' +
      'The event enters the standard ingestion pipeline and is stored in the OSINT event log.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set to associate this event with',
        },
        title: {
          type: 'string',
          description: 'Short title summarizing the research finding',
        },
        content: {
          type: 'string',
          description: 'Full content / body of the research finding',
        },
        source_url: {
          type: 'string',
          description: 'URL of the source (optional)',
        },
        source_name: {
          type: 'string',
          description: 'Name of the source (optional, defaults to "Ironclaw Research")',
        },
      },
      required: ['problem_set_id', 'title', 'content'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_intel_process_osint_event',
    description:
      'Trigger the OSINT specialist agent pipeline to process an event, extracting entities, ' +
      'relationships, and tensions into the knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'ID of the OSINT event to process (EVT-* format)',
        },
        problem_set_id: {
          type: 'string',
          description: 'Problem set context for entity scoping',
        },
      },
      required: ['event_id', 'problem_set_id'],
    },
    riskLevel: 'medium',
  },

  // ── Analysis ──
  {
    name: 'bastion_intel_detect_conflicts',
    description:
      'Scan the knowledge graph for contradictions, conflicting claims, or opposing intelligence ' +
      'about entities. Returns conflicts as an array with entity, competing claims, and sources.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set whose brain slice to scan',
        },
        entity_name: {
          type: 'string',
          description: 'Optional: limit scan to a specific actor name',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_intel_draft_situation_assessment',
    description:
      'Gather raw intelligence data for a situation assessment. Returns structured data ' +
      '(recent events, graph changes, active PIRs, gaps) that Ironclaw synthesizes into a narrative.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set to assess',
        },
        focus_area: {
          type: 'string',
          description: 'Optional focus area or topic to concentrate the assessment on',
        },
        time_window_hours: {
          type: 'number',
          description: 'Hours of history to include in assessment (default: 24)',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },

  // ── Autonomous Activity ──
  {
    name: 'bastion_autonomous_log_activity',
    description:
      'Log an autonomous activity entry visible in the commander\'s activity feed. ' +
      'Use to record what Ironclaw is doing in the background.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set this activity relates to',
        },
        activity_type: {
          type: 'string',
          description: 'Activity category (e.g. "intel_research", "brain_curation", "conflict_detection")',
        },
        severity: {
          type: 'string',
          description: 'Severity level: critical, urgent, routine, informational',
        },
        summary: {
          type: 'string',
          description: 'One-line summary of what Ironclaw did',
        },
        detail: {
          type: 'object',
          description: 'Optional structured detail object (JSON)',
        },
      },
      required: ['problem_set_id', 'activity_type', 'severity', 'summary'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_autonomous_send_alert',
    description:
      'Send an alert to commanders via WebSocket and optionally Telegram. ' +
      'Use for time-sensitive findings that require commander attention.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set this alert relates to',
        },
        message: {
          type: 'string',
          description: 'Alert message text',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'urgent', 'routine'],
          description: 'Alert severity level — critical and urgent may trigger Telegram push',
        },
        telegram: {
          type: 'boolean',
          description: 'If true and severity is critical/urgent, also send via Telegram (requires bot config)',
        },
      },
      required: ['problem_set_id', 'message', 'severity'],
    },
    riskLevel: 'medium',
  },

  // ── Brain Curation ──
  {
    name: 'bastion_brain_evaluate_relevance',
    description:
      'Scan the global knowledge graph for actors/relationships that are relevant to this ' +
      'problem set but not yet in its brain slice. Returns scored candidates with reasons for relevance.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set whose brain slice to evaluate against the global graph',
        },
        max_candidates: {
          type: 'number',
          description: 'Maximum number of candidate actors to return (default: 20)',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
  {
    name: 'bastion_brain_augment_slice',
    description:
      'Pull actors into this problem set\'s brain slice. Updates containerIds so they appear ' +
      'in the problem set\'s focused view. Use when you discover actors in the global brain ' +
      'that are relevant to this problem set.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set to augment',
        },
        actor_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of actor node IDs to add to this problem set\'s slice',
        },
        reason: {
          type: 'string',
          description: 'Reason for augmenting (audit trail)',
        },
      },
      required: ['problem_set_id', 'actor_ids', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_brain_prune_slice',
    description:
      'Remove actors from this problem set\'s brain slice that are no longer relevant ' +
      '(stale, disproven, superseded). Does not delete from the global brain — only removes ' +
      'from this problem set\'s view.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set to prune',
        },
        actor_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of actor node IDs to remove from this problem set\'s slice',
        },
        reason: {
          type: 'string',
          description: 'Reason for pruning (audit trail)',
        },
      },
      required: ['problem_set_id', 'actor_ids', 'reason'],
    },
    riskLevel: 'medium',
  },
  {
    name: 'bastion_brain_get_slice_stats',
    description:
      'Get statistics about the problem set\'s brain slice: size vs global brain, ' +
      'staleness metrics, orphan count. Useful for deciding whether curation is needed.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Problem set to get brain slice statistics for',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },
];
