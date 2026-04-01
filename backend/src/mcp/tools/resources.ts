/**
 * MCP Resources Tool Group
 *
 * Phase 60 Plan 02: Exposes Bastion resource registry capabilities to Ironclaw
 * via MCP. Covers resource listing, status/readiness queries, and capability
 * search.
 *
 * Blueprint Section 4.1 — Resources domain tools.
 */

import type { MCPToolDefinition } from '../../ironclaw/tool-bridge.js';

export const resourcesTools: MCPToolDefinition[] = [
  {
    name: 'bastion_resources_list',
    description:
      'List resources registered in the Bastion resource registry, optionally ' +
      'filtered by type or capability. Returns resource ID, name, type, status, ' +
      'and owning organization.',
    inputSchema: {
      type: 'object',
      properties: {
        resource_type: {
          type: 'string',
          description: 'Optional filter by resource type (e.g., "unit", "equipment", "facility", "agent")',
        },
        capability: {
          type: 'string',
          description: 'Optional filter to resources that possess a specific capability',
        },
        problem_set_id: {
          type: 'string',
          description: 'Optional scope to resources associated with a specific problem set',
        },
        status: {
          type: 'string',
          enum: ['available', 'committed', 'offline', 'all'],
          description: 'Filter by availability status (default: "all")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
        },
      },
      required: [],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion_resources_get_status',
    description:
      'Get current status and readiness information for a specific resource. ' +
      'Returns availability, readiness level, last updated timestamp, and any ' +
      'active commitments or tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        resource_id: {
          type: 'string',
          description: 'Unique identifier of the resource',
        },
        include_history: {
          type: 'boolean',
          description: 'Whether to include recent status history (default: false)',
        },
      },
      required: ['resource_id'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion_resources_search_capabilities',
    description:
      'Search resources by capability requirements. Returns resources that match ' +
      'the requested capabilities, sorted by best fit.',
    inputSchema: {
      type: 'object',
      properties: {
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of required capabilities to match (e.g., ["ISR", "EW", "long-range-fires"])',
        },
        match_mode: {
          type: 'string',
          enum: ['all', 'any'],
          description: 'Whether resources must match all capabilities or any (default: "any")',
        },
        problem_set_id: {
          type: 'string',
          description: 'Optional scope to resources within a specific problem set',
        },
        available_only: {
          type: 'boolean',
          description: 'Whether to restrict results to currently available resources (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
        },
      },
      required: ['capabilities'],
    },
    riskLevel: 'low',
  },
];
