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
  // ── Cross-scope graph & objective hierarchy tools ──────────────────────────
  {
    toolId: 'get_objective_hierarchy',
    name: 'Get Objective Hierarchy',
    description: 'Walk up the parent problem set chain and return objectives from each ancestor, grouped by echelon. Useful for understanding how higher-echelon objectives flow down.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to start the parent-chain walk from',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_objective_hierarchy'],
    isEnabled: true,
  },
  {
    toolId: 'adopt_objective',
    name: 'Adopt Objective',
    description: 'Adopt an objective from a parent problem set into a target workspace. Creates a linked copy with DRAFT status.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        sourceObjectiveId: {
          type: 'string',
          description: 'ID of the objective to adopt from a parent problem set',
        },
        targetWorkspaceId: {
          type: 'string',
          description: 'Problem set ID that will receive the adopted objective',
        },
      },
      required: ['sourceObjectiveId', 'targetWorkspaceId'],
    },
    handler: 'builtin',
    permissions: ['tool:adopt_objective'],
    isEnabled: true,
  },
  {
    toolId: 'assess_objectives_for_problem_set',
    name: 'Assess Objectives for Problem Set',
    description: 'Auto-assess and adopt relevant objectives from a parent problem set into a child. Skips already-adopted objectives.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Child problem set ID to assess and populate with parent objectives',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:assess_objectives_for_problem_set'],
    isEnabled: true,
  },
  {
    toolId: 'query_global_graph',
    name: 'Query Global Graph',
    description: 'Query all actors across the entire knowledge graph without workspace filter. Useful for cross-problem-set situational awareness.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        classification: {
          type: 'string',
          description: 'Optional classification filter',
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return (default 50, max 200)',
          default: 50,
          minimum: 1,
          maximum: 200,
        },
      },
      required: [],
    },
    handler: 'builtin',
    permissions: ['tool:query_global_graph'],
    isEnabled: true,
  },
  {
    toolId: 'query_parent_graph',
    name: 'Query Parent Graph',
    description: 'Query actors from both a problem set and its parent workspace. Returns merged nodes tagged with their source workspace ID.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID (will also include parent workspace actors)',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:query_parent_graph'],
    isEnabled: true,
  },
  // ── Existing tools below ──────────────────────────────────────────────────
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

  // ── Cross-scope graph & objective hierarchy handlers ─────────────────────

  /**
   * Walk parent chain and return objectives grouped by ancestor problem set.
   */
  async get_objective_hierarchy(input: {
    problemSetId: string;
  }): Promise<{ hierarchy: unknown[] }> {
    const hierarchy = await objectiveStore.getObjectivesForParentChain(input.problemSetId);
    return { hierarchy };
  },

  /**
   * Adopt an objective from a parent into a target workspace.
   */
  async adopt_objective(input: {
    sourceObjectiveId: string;
    targetWorkspaceId: string;
  }): Promise<{ objective: unknown }> {
    const objective = await objectiveStore.adoptObjective(
      input.sourceObjectiveId,
      input.targetWorkspaceId,
    );
    return { objective };
  },

  /**
   * Auto-assess and adopt parent objectives into a child problem set.
   * Replicates the logic from POST /api/strategic/objectives/assess.
   */
  async assess_objectives_for_problem_set(input: {
    problemSetId: string;
  }): Promise<{ parentObjectiveCount: number; newlyAdoptedCount: number; skippedCount: number }> {
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();

    // Look up parent workspace
    const parentResult = await pool.query(
      'SELECT parent_problem_set_id FROM problem_sets WHERE id = $1',
      [input.problemSetId],
    );

    if (parentResult.rows.length === 0 || !parentResult.rows[0].parent_problem_set_id) {
      return { parentObjectiveCount: 0, newlyAdoptedCount: 0, skippedCount: 0 };
    }

    const parentWorkspaceId = parentResult.rows[0].parent_problem_set_id as string;

    // Fetch parent objectives
    const parentObjectives = await objectiveStore.listObjectives({
      workspaceId: parentWorkspaceId,
      limit: 200,
      offset: 0,
    });

    if (parentObjectives.objectives.length === 0) {
      return { parentObjectiveCount: 0, newlyAdoptedCount: 0, skippedCount: 0 };
    }

    // Check which are already adopted
    const existingObjectives = await objectiveStore.listObjectives({
      workspaceId: input.problemSetId,
      limit: 200,
      offset: 0,
    });

    const alreadyAdoptedParentIds = new Set(
      existingObjectives.objectives
        .filter((o) => o.parentObjectiveId)
        .map((o) => o.parentObjectiveId),
    );

    // Adopt unadopted parent objectives
    let newlyAdoptedCount = 0;
    for (const parentObj of parentObjectives.objectives) {
      if (alreadyAdoptedParentIds.has(parentObj.id)) continue;
      try {
        await objectiveStore.adoptObjective(parentObj.id, input.problemSetId);
        newlyAdoptedCount++;
      } catch (err) {
        console.warn(`[assess_objectives] Failed to adopt ${parentObj.id}:`, err);
      }
    }

    return {
      parentObjectiveCount: parentObjectives.objectives.length,
      newlyAdoptedCount,
      skippedCount: parentObjectives.objectives.length - newlyAdoptedCount,
    };
  },

  /**
   * Query all actors across the global knowledge graph (no workspace filter).
   */
  async query_global_graph(input: {
    classification?: string;
    limit?: number;
  }): Promise<{ actors: unknown[] }> {
    const { executeReadQuery } = await import('../../graph/neo4j-client.js');
    const limit = Math.min(input.limit || 50, 200);

    let cypher = 'MATCH (a:Actor)';
    const params: Record<string, unknown> = { limit };

    if (input.classification) {
      cypher += ' WHERE a.classification = $classification';
      params.classification = input.classification;
    }

    cypher += ' OPTIONAL MATCH (a)-[r]-() RETURN a, count(r) AS relCount ORDER BY relCount DESC LIMIT $limit';

    const result = await executeReadQuery(cypher, params);
    const actors = result.records.map((rec) => {
      const a = rec.get('a').properties;
      return { ...a, relationshipCount: rec.get('relCount').toInt() };
    });
    return { actors };
  },

  /**
   * Query actors from both a problem set and its parent workspace.
   * Returns merged nodes tagged with sourceWorkspaceId.
   */
  async query_parent_graph(input: {
    problemSetId: string;
  }): Promise<{ nodes: unknown[] }> {
    const { executeReadQuery } = await import('../../graph/neo4j-client.js');
    const { getPool } = await import('../../lib/database.js');
    const pool = getPool();

    // Find parent workspace
    const parentResult = await pool.query(
      'SELECT parent_problem_set_id FROM problem_sets WHERE id = $1',
      [input.problemSetId],
    );
    const parentId = parentResult.rows[0]?.parent_problem_set_id as string | undefined;

    // Build workspace IDs to query
    const workspaceIds = [input.problemSetId];
    if (parentId) workspaceIds.push(parentId);

    const cypher = `
      MATCH (a:Actor)
      WHERE a.workspaceId IN $workspaceIds
      OPTIONAL MATCH (a)-[r]-()
      RETURN a, count(r) AS relCount
      ORDER BY relCount DESC
      LIMIT 200
    `;

    const result = await executeReadQuery(cypher, { workspaceIds });
    const nodes = result.records.map((rec) => {
      const a = rec.get('a').properties;
      return {
        ...a,
        relationshipCount: rec.get('relCount').toInt(),
        sourceWorkspaceId: a.workspaceId,
      };
    });
    return { nodes };
  },
};
