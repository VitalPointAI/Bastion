/**
 * Ends-Ways-Means MCP Tools
 *
 * MCP tool definitions for E-W-M linkage CRUD and gap analysis.
 * Used by JPP agents (especially COA Development and Plan Development)
 * to create, manage, and analyze linkages between ends (objectives),
 * ways (strategies/LOEs), and means (resources/forces).
 */

import type { MCPToolInput } from '../../agents/character-schema.js';
import type { EWMGap, EWMWayType, EWMMeanType } from '../../jpp/types.js';

/**
 * Tool definitions for registration in ToolRegistry
 */
export const ewmToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'create_ewm_linkage',
    name: 'Create E-W-M Linkage',
    description:
      'Create a linkage between an end (objective), a way (LOE/strategy), and a mean (resource/force). Tracks allocation percentage for resource apportionment.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        jppInstanceId: {
          type: 'string',
          description: 'JPP instance ID this linkage belongs to',
        },
        endObjectiveId: {
          type: 'string',
          description: 'ID of the end/objective being pursued',
        },
        wayId: {
          type: 'string',
          description: 'ID of the way (LOE, strategy, or COA element)',
        },
        wayType: {
          type: 'string',
          description: 'Type of the way element',
          enum: ['loe', 'coa'],
        },
        meanId: {
          type: 'string',
          description: 'ID of the mean (force, capability, or resource). Optional.',
        },
        meanType: {
          type: 'string',
          description: 'Type of the mean element',
          enum: ['force', 'capability', 'resource'],
        },
        allocationPct: {
          type: 'number',
          description: 'Percentage of the mean allocated to this linkage (0-100)',
          minimum: 0,
          maximum: 100,
          default: 0,
        },
      },
      required: ['jppInstanceId', 'endObjectiveId', 'wayId', 'wayType'],
    },
    handler: 'builtin',
    permissions: ['tool:create_ewm_linkage'],
    isEnabled: true,
  },
  {
    toolId: 'delete_ewm_linkage',
    name: 'Delete E-W-M Linkage',
    description: 'Delete an E-W-M linkage by its ID.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        linkageId: {
          type: 'string',
          description: 'ID of the linkage to delete',
        },
      },
      required: ['linkageId'],
    },
    handler: 'builtin',
    permissions: ['tool:delete_ewm_linkage'],
    isEnabled: true,
  },
  {
    toolId: 'get_ewm_linkages',
    name: 'Get E-W-M Linkages',
    description:
      'Get all E-W-M linkages for a JPP instance.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        jppInstanceId: {
          type: 'string',
          description: 'JPP instance ID',
        },
      },
      required: ['jppInstanceId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_ewm_linkages'],
    isEnabled: true,
  },
  {
    toolId: 'find_ewm_gaps',
    name: 'Find E-W-M Gaps',
    description:
      'Run gap analysis on E-W-M linkages for a JPP instance. Identifies: unlinked ends, unsupported ways (no means), unallocated means (0% allocation), and over-allocated means (>100%).',
    category: 'analysis',
    inputSchema: {
      type: 'object',
      properties: {
        jppInstanceId: {
          type: 'string',
          description: 'JPP instance ID to analyze',
        },
      },
      required: ['jppInstanceId'],
    },
    handler: 'builtin',
    permissions: ['tool:find_ewm_gaps'],
    isEnabled: true,
  },
  {
    toolId: 'update_ewm_allocation',
    name: 'Update E-W-M Allocation',
    description:
      'Update the allocation percentage on an existing E-W-M linkage. Used for resource reapportionment.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        linkageId: {
          type: 'string',
          description: 'ID of the linkage to update',
        },
        allocationPct: {
          type: 'number',
          description: 'New allocation percentage (0-100)',
          minimum: 0,
          maximum: 100,
        },
      },
      required: ['linkageId', 'allocationPct'],
    },
    handler: 'builtin',
    permissions: ['tool:update_ewm_allocation'],
    isEnabled: true,
  },
  {
    toolId: 'get_ewm_summary',
    name: 'Get E-W-M Summary',
    description:
      'Get an aggregate summary of E-W-M linkages for a JPP instance. Returns counts of unique ends, ways, means, total linkages, and gap count.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        jppInstanceId: {
          type: 'string',
          description: 'JPP instance ID',
        },
      },
      required: ['jppInstanceId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_ewm_summary'],
    isEnabled: true,
  },
];

/**
 * Tool execution handlers
 */
export const ewmToolHandlers = {
  /**
   * Create a new E-W-M linkage
   */
  async create_ewm_linkage(input: {
    jppInstanceId: string;
    endObjectiveId: string;
    wayId: string;
    wayType: string;
    meanId?: string;
    meanType?: string;
    allocationPct?: number;
  }): Promise<{ linkageId: string; success: boolean }> {
    const { ewmStore } = await import('../../jpp/ewm-store.js');
    const linkage = await ewmStore.createLinkage({
      jppInstanceId: input.jppInstanceId,
      endObjectiveId: input.endObjectiveId,
      wayId: input.wayId,
      wayType: input.wayType as EWMWayType,
      meanId: input.meanId ?? null,
      meanType: input.meanType ? (input.meanType as EWMMeanType) : null,
      allocationPct: input.allocationPct ?? 0,
    });
    return { linkageId: linkage.id, success: true };
  },

  /**
   * Delete an E-W-M linkage
   */
  async delete_ewm_linkage(input: {
    linkageId: string;
  }): Promise<{ success: boolean }> {
    const { ewmStore } = await import('../../jpp/ewm-store.js');
    await ewmStore.deleteLinkage(input.linkageId);
    return { success: true };
  },

  /**
   * Get all E-W-M linkages for a JPP instance
   */
  async get_ewm_linkages(input: {
    jppInstanceId: string;
  }): Promise<{ linkages: unknown[]; total: number }> {
    const { ewmStore } = await import('../../jpp/ewm-store.js');
    const linkages = await ewmStore.getLinkagesByInstance(input.jppInstanceId);
    return { linkages, total: linkages.length };
  },

  /**
   * Find gaps in E-W-M linkages
   */
  async find_ewm_gaps(input: {
    jppInstanceId: string;
  }): Promise<{ gaps: EWMGap[]; totalGaps: number }> {
    const { ewmStore } = await import('../../jpp/ewm-store.js');
    const gaps = await ewmStore.findGaps(input.jppInstanceId);
    return { gaps, totalGaps: gaps.length };
  },

  /**
   * Update allocation percentage on a linkage
   */
  async update_ewm_allocation(input: {
    linkageId: string;
    allocationPct: number;
  }): Promise<{ success: boolean }> {
    const { ewmStore } = await import('../../jpp/ewm-store.js');
    await ewmStore.updateAllocation(input.linkageId, input.allocationPct);
    return { success: true };
  },

  /**
   * Get aggregate summary of E-W-M linkages
   */
  async get_ewm_summary(input: {
    jppInstanceId: string;
  }): Promise<{
    endsCount: number;
    waysCount: number;
    meansCount: number;
    linkageCount: number;
    gapCount: number;
  }> {
    const { ewmStore } = await import('../../jpp/ewm-store.js');

    const [ends, ways, means, linkages, gaps] = await Promise.all([
      ewmStore.getEnds(input.jppInstanceId),
      ewmStore.getWays(input.jppInstanceId),
      ewmStore.getMeans(input.jppInstanceId),
      ewmStore.getLinkagesByInstance(input.jppInstanceId),
      ewmStore.findGaps(input.jppInstanceId),
    ]);

    return {
      endsCount: ends.length,
      waysCount: ways.length,
      meansCount: means.length,
      linkageCount: linkages.length,
      gapCount: gaps.length,
    };
  },
};
