/**
 * MCP Personnel Tool Group (Clearance-Gated)
 *
 * Phase 60 Plan 02: Exposes Bastion personnel data to Ironclaw via MCP.
 * These tools are clearance-gated — callers must present valid DID VC claims
 * with the appropriate clearance level.
 *
 * Access control:
 *   - bastion_personnel_list_staff    → requires CUI+
 *   - bastion_personnel_get_member    → requires CUI+
 *   - bastion_personnel_get_clearances → requires SECRET+
 *
 * Blueprint Section 4.1 — Personnel domain tools (clearance-gated).
 */

import type { MCPToolDefinition } from '../../ironclaw/tool-bridge.js';

/**
 * Minimum clearance level required per tool.
 * Consumed by mcp-server.ts to gate tool execution.
 */
export const PERSONNEL_TOOL_CLEARANCES: Record<string, 'CUI' | 'SECRET' | 'TOP_SECRET'> = {
  'bastion_personnel_list_staff': 'CUI',
  'bastion_personnel_get_member': 'CUI',
  'bastion_personnel_get_clearances': 'SECRET',
};

export const personnelTools: MCPToolDefinition[] = [
  {
    name: 'bastion_personnel_list_staff',
    description:
      '[CLEARANCE REQUIRED: CUI+] List staff members with summary information ' +
      'including name, rank, position, staff section, and contact status. ' +
      'Requires CUI or higher clearance claim.',
    inputSchema: {
      type: 'object',
      properties: {
        staff_section: {
          type: 'string',
          enum: ['Commander', 'S1', 'S2', 'S3', 'S4', 'S6', 'S9', 'XO', 'CSM', 'Other', 'all'],
          description: 'Optional filter by staff section (default: "all")',
        },
        problem_set_id: {
          type: 'string',
          description: 'Optional scope to staff associated with a specific problem set',
        },
        include_contact: {
          type: 'boolean',
          description: 'Whether to include contact information (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of staff members to return (default: 50)',
        },
      },
      required: [],
    },
    riskLevel: 'medium',
  },

  {
    name: 'bastion_personnel_get_member',
    description:
      '[CLEARANCE REQUIRED: CUI+] Get detailed information for a specific staff ' +
      'member including qualifications, assignments, and role history. ' +
      'Requires CUI or higher clearance claim.',
    inputSchema: {
      type: 'object',
      properties: {
        member_id: {
          type: 'string',
          description: 'Unique identifier of the staff member',
        },
        include_assignments: {
          type: 'boolean',
          description: 'Whether to include assignment history (default: false)',
        },
        include_qualifications: {
          type: 'boolean',
          description: 'Whether to include qualifications and certifications (default: false)',
        },
      },
      required: ['member_id'],
    },
    riskLevel: 'medium',
  },

  {
    name: 'bastion_personnel_get_clearances',
    description:
      '[CLEARANCE REQUIRED: SECRET+] Get clearance and access information for ' +
      'a staff member or list of staff members. This tool returns sensitive ' +
      'security data and requires SECRET or higher clearance claim.',
    inputSchema: {
      type: 'object',
      properties: {
        member_id: {
          type: 'string',
          description: 'Unique identifier of the staff member (provide either member_id or member_ids)',
        },
        member_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of staff member IDs to query in batch (provide either member_id or member_ids)',
        },
        include_indoctrinations: {
          type: 'boolean',
          description: 'Whether to include special access program indoctrinations (default: false)',
        },
      },
      required: [],
    },
    riskLevel: 'high',
  },
];
