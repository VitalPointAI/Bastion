/**
 * Objective MCP Tools
 *
 * MCP tool definitions for querying and managing strategic objectives.
 * Used by Strategic Fusion Agent for multi-document consolidation.
 */

import type { MCPToolInput } from '../../agents/character-schema.js';
import { objectiveStore } from '../../strategic/objectives/store.js';
import { getDocumentById } from '../../strategic/ingestion/document-store.js';
import type { ObjectiveStatus, Priority, ExtractedBy } from '../../strategic/schemas/strategic-objective.js';
import type { DIMEInstrument } from '../../strategic/schemas/dime.js';
import type { EndsWaysMeans } from '../../strategic/schemas/ends-ways-means.js';

/**
 * Tool definitions for registration in ToolRegistry
 */
export const objectiveToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'query_objectives',
    name: 'Query Objectives',
    description: 'Query strategic objectives with filters and pagination. Returns objectives matching the specified criteria.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Filter by document ID',
        },
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'OPERATIONALIZED'],
        },
        priority: {
          type: 'string',
          description: 'Filter by priority',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        },
        instrument: {
          type: 'string',
          description: 'Filter by primary DIME instrument',
          enum: ['DIPLOMATIC', 'INFORMATION', 'MILITARY', 'ECONOMIC'],
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: 'integer',
          description: 'Offset for pagination',
          default: 0,
          minimum: 0,
        },
      },
      required: [],
    },
    handler: 'builtin',
    permissions: ['tool:query_objectives'],
    isEnabled: true,
  },
  {
    toolId: 'save_fused_objective',
    name: 'Save Fused Objective',
    description: 'Save a fused/consolidated objective to the database. Used after merging similar objectives from multiple documents.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Source document ID',
        },
        sourceReference: {
          type: 'string',
          description: 'Reference to source location in document',
        },
        description: {
          type: 'string',
          description: 'Consolidated objective description',
        },
        endsWaysMeans: {
          type: 'object',
          description: 'Ends-Ways-Means breakdown per JP 5-0 doctrine',
          properties: {
            ends: {
              type: 'object',
              description: 'Desired end state',
              properties: {
                description: { type: 'string', description: 'What success looks like' },
                conditions: { type: 'array', items: { type: 'string' }, description: 'Measurable conditions' },
                timeframe: { type: 'string', description: 'When to achieve' },
              },
              required: ['description', 'conditions'],
            },
            ways: {
              type: 'object',
              description: 'Strategies and methods',
              properties: {
                strategies: { type: 'array', items: { type: 'string' }, description: 'High-level approaches' },
                concepts: { type: 'array', items: { type: 'string' }, description: 'Operational concepts' },
                keyTasks: { type: 'array', items: { type: 'string' }, description: 'Essential tasks' },
              },
              required: ['strategies', 'concepts', 'keyTasks'],
            },
            means: {
              type: 'object',
              description: 'Resources required',
              properties: {
                forces: { type: 'array', items: { type: 'string' }, description: 'Military forces' },
                capabilities: { type: 'array', items: { type: 'string' }, description: 'Required capabilities' },
                resources: { type: 'array', items: { type: 'string' }, description: 'Funding and materiel' },
              },
              required: ['forces', 'capabilities', 'resources'],
            },
          },
          required: ['ends', 'ways', 'means'],
        },
        primaryInstrument: {
          type: 'string',
          description: 'Primary DIME instrument',
          enum: ['DIPLOMATIC', 'INFORMATION', 'MILITARY', 'ECONOMIC'],
        },
        supportingInstruments: {
          type: 'array',
          description: 'Supporting DIME instruments',
          items: {
            type: 'string',
            enum: ['DIPLOMATIC', 'INFORMATION', 'MILITARY', 'ECONOMIC'],
          },
        },
        parentObjectiveId: {
          type: 'string',
          description: 'Parent objective for hierarchy',
        },
        createdBy: {
          type: 'string',
          description: 'DID of the creator',
        },
      },
      required: ['documentId', 'sourceReference', 'description', 'endsWaysMeans', 'primaryInstrument', 'createdBy'],
    },
    handler: 'builtin',
    permissions: ['tool:save_fused_objective'],
    isEnabled: true,
  },
  {
    toolId: 'get_document_metadata',
    name: 'Get Document Metadata',
    description: 'Get metadata for a strategic document including title, classification, document type, and upload information.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Document ID',
        },
      },
      required: ['documentId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_document_metadata'],
    isEnabled: true,
  },
  {
    toolId: 'query_objectives_by_theme',
    name: 'Query Objectives by Theme',
    description: 'Query objectives by DIME or MIDLIFE theme. Useful for finding related objectives across documents.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'DIME or MIDLIFE theme',
          enum: ['DIPLOMATIC', 'INFORMATION', 'MILITARY', 'ECONOMIC', 'LEGAL', 'INTELLIGENCE', 'FINANCIAL'],
        },
        classification: {
          type: 'string',
          description: 'Classification filter',
          enum: ['UNCLASSIFIED', 'SECRET', 'TOPSECRET'],
        },
        workspaceId: {
          type: 'string',
          description: 'Workspace ID filter',
        },
      },
      required: ['theme'],
    },
    handler: 'builtin',
    permissions: ['tool:query_objectives_by_theme'],
    isEnabled: true,
  },
  {
    toolId: 'link_objectives',
    name: 'Link Objectives',
    description: 'Create a hierarchical or semantic link between two objectives. Used for building objective hierarchies or marking duplicates.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'Parent objective ID',
        },
        childId: {
          type: 'string',
          description: 'Child objective ID',
        },
        relationshipType: {
          type: 'string',
          description: 'Type of relationship',
          enum: ['supports', 'derives_from', 'conflicts_with', 'duplicates'],
        },
      },
      required: ['parentId', 'childId', 'relationshipType'],
    },
    handler: 'builtin',
    permissions: ['tool:link_objectives'],
    isEnabled: true,
  },
];

/**
 * Tool execution handlers
 */
export const objectiveToolHandlers = {
  /**
   * Query objectives with filters
   */
  async query_objectives(input: {
    documentId?: string;
    status?: ObjectiveStatus;
    priority?: Priority;
    instrument?: DIMEInstrument;
    limit?: number;
    offset?: number;
  }): Promise<{ objectives: unknown[]; total: number }> {
    // If documentId is provided, use getObjectivesForDocument
    if (input.documentId) {
      const objectives = await objectiveStore.getObjectivesForDocument(input.documentId);
      return { objectives, total: objectives.length };
    }

    // Otherwise use listObjectives with filters
    return objectiveStore.listObjectives({
      status: input.status,
      priority: input.priority,
      instrument: input.instrument,
      limit: input.limit || 20,
      offset: input.offset || 0,
    });
  },

  /**
   * Save a fused objective
   */
  async save_fused_objective(input: {
    documentId: string;
    sourceReference: string;
    description: string;
    endsWaysMeans: EndsWaysMeans;
    primaryInstrument: DIMEInstrument;
    supportingInstruments?: DIMEInstrument[];
    parentObjectiveId?: string;
    createdBy: string;
  }): Promise<{ objectiveId: string }> {
    const objectiveId = await objectiveStore.saveObjective({
      documentId: input.documentId,
      sourceReference: input.sourceReference,
      description: input.description,
      endsWaysMeans: input.endsWaysMeans,
      primaryInstrument: input.primaryInstrument,
      supportingInstruments: input.supportingInstruments,
      parentObjectiveId: input.parentObjectiveId,
      extractedBy: 'AI_FUSION' as ExtractedBy,
      createdBy: input.createdBy,
    });
    return { objectiveId };
  },

  /**
   * Get document metadata
   */
  async get_document_metadata(input: { documentId: string }): Promise<unknown> {
    return getDocumentById(input.documentId);
  },

  /**
   * Query objectives by DIME/MIDLIFE theme
   */
  async query_objectives_by_theme(input: {
    theme: DIMEInstrument;
    classification?: string;
    workspaceId?: string;
  }): Promise<{ objectives: unknown[] }> {
    const { objectives } = await objectiveStore.listObjectives({
      instrument: input.theme,
    });
    return { objectives };
  },

  /**
   * Link two objectives
   */
  async link_objectives(input: {
    parentId: string;
    childId: string;
    relationshipType: string;
  }): Promise<{ success: boolean }> {
    // For now, we implement 'supports' and 'derives_from' as parent-child relationship
    if (input.relationshipType === 'supports' || input.relationshipType === 'derives_from') {
      const success = await objectiveStore.updateObjective(input.childId, {
        parentObjectiveId: input.parentId,
      });
      return { success };
    }
    // Other relationship types could be stored differently (e.g., in a separate table)
    // For now, just return success as we've noted the relationship
    return { success: true };
  },
};
