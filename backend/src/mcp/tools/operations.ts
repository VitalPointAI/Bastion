/**
 * MCP Operations Tool Group
 *
 * Phase 60 Plan 02: Exposes Bastion operational planning capabilities to Ironclaw
 * via MCP. Covers problem sets, operational design, campaign plans, and courses
 * of action.
 *
 * Blueprint Section 4.1 — Operations domain tools.
 */

import type { MCPToolDefinition } from '../../ironclaw/tool-bridge.js';

export const operationsTools: MCPToolDefinition[] = [
  {
    name: 'bastion.ops.get_problem_set',
    description:
      'Read full details of a problem set including mission, commander\'s intent, ' +
      'operational environment, and current phase status.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Unique identifier of the problem set',
        },
        include_children: {
          type: 'boolean',
          description: 'Whether to include child problem set summaries (default: false)',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion.ops.list_problem_sets',
    description:
      'List all accessible problem sets with summary information. ' +
      'Returns ID, name, phase, status, and last updated timestamp.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: {
          type: 'string',
          description: 'Optional parent problem set ID to list only children',
        },
        status: {
          type: 'string',
          enum: ['active', 'archived', 'draft'],
          description: 'Optional filter by problem set status',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of problem sets to return (default: 50)',
        },
      },
      required: [],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion.ops.get_operational_design',
    description:
      'Read operational design artifacts for a problem set including operational ' +
      'approach, decisive conditions, desired end state, and lines of operation.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Unique identifier of the problem set',
        },
        section: {
          type: 'string',
          enum: ['approach', 'conditions', 'end_state', 'lines_of_operation', 'all'],
          description: 'Specific section to retrieve (default: "all")',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion.ops.get_campaign_plan',
    description:
      'Read campaign plan data for a problem set including phases, objectives, ' +
      'tasks, and synchronization matrix.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Unique identifier of the problem set',
        },
        phase: {
          type: 'string',
          description: 'Optional phase number or name to retrieve a specific phase',
        },
        include_tasks: {
          type: 'boolean',
          description: 'Whether to include task details (default: true)',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion.ops.get_coa',
    description:
      'Read course of action details including scheme of maneuver, tasks to ' +
      'subordinates, risk assessment, and supporting attachments.',
    inputSchema: {
      type: 'object',
      properties: {
        coa_id: {
          type: 'string',
          description: 'Unique identifier of the course of action',
        },
        problem_set_id: {
          type: 'string',
          description: 'Problem set context (required for authorization scope)',
        },
        include_attachments: {
          type: 'boolean',
          description: 'Whether to include attachment metadata (default: false)',
        },
      },
      required: ['coa_id', 'problem_set_id'],
    },
    riskLevel: 'low',
  },
];
