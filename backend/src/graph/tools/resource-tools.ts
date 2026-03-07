/**
 * Resource Registry MCP Tools
 *
 * Phase 27 Plan 04: AI agent tool definitions for querying the resource registry.
 * Tools enable agents to find resources by capability, geographic area, or ID/DID.
 */

import type { MCPToolInput } from '../../agents/character-schema.js';

/**
 * Tool definitions for registration in ToolRegistry.
 * Handlers call ResourceRegistry singleton methods.
 */
export const resourceToolDefinitions: MCPToolInput[] = [
  // ==========================================================================
  // Resource Query Tools
  // ==========================================================================
  {
    toolId: 'find_resources_by_capability',
    name: 'Find Resources by Capability',
    description:
      'Find resources with a specific capability (e.g., ISR, CASEVAC, air_defense, SIGINT). Returns resources matching the capability tag. Optionally filter by mission.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        capability: {
          type: 'string',
          description: 'Capability tag to search for (e.g., ISR, CASEVAC, air_defense, SIGINT)',
        },
        missionId: {
          type: 'string',
          description: 'Optional mission ID to filter results to a specific mission',
        },
      },
      required: ['capability'],
    },
    handler: 'builtin',
    permissions: ['tool:find_resources_by_capability'],
    isEnabled: true,
  },
  {
    toolId: 'find_resources_in_area',
    name: 'Find Resources in Area',
    description:
      'Find resources within a geographic bounding box. Useful for identifying assets near an area of operations.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        north: {
          type: 'number',
          description: 'Northern latitude boundary (degrees)',
        },
        south: {
          type: 'number',
          description: 'Southern latitude boundary (degrees)',
        },
        east: {
          type: 'number',
          description: 'Eastern longitude boundary (degrees)',
        },
        west: {
          type: 'number',
          description: 'Western longitude boundary (degrees)',
        },
      },
      required: ['north', 'south', 'east', 'west'],
    },
    handler: 'builtin',
    permissions: ['tool:find_resources_in_area'],
    isEnabled: true,
  },
  {
    toolId: 'get_resource_status',
    name: 'Get Resource Status',
    description:
      'Get detailed status and capabilities for a specific resource by ID or DID. Returns full resource details including specifications, capabilities, group, and trust tier.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        resourceId: {
          type: 'string',
          description: 'Resource ID (format: RES-{uuid})',
        },
        did: {
          type: 'string',
          description: 'Resource DID (format: did:bastion:resource:{id})',
        },
      },
      required: [],
    },
    handler: 'builtin',
    permissions: ['tool:get_resource_status'],
    isEnabled: true,
  },
];
