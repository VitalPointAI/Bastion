/**
 * Tool Registry
 *
 * Manages MCP tool registration, assignment to agents, and tool lifecycle.
 * Implements singleton pattern for global access.
 */

import { createToolDID } from './tool-did.js';
import type {
  MCPTool,
  ToolCategory,
  ToolHandler,
  JSONSchema,
  ToolConfig,
} from './types.js';
import {
  MCPToolInputSchema,
  MCPToolUpdateSchema,
  type MCPToolInput,
  type MCPToolUpdate,
} from './character-schema.js';
import { getMidlifeCategorizer } from '../strategic/tools/midlife-categorizer.js';

/**
 * Tool assignment record linking tools to agents.
 */
interface ToolAssignment {
  toolId: string;
  agentId: string;
  assignedAt: string;
  assignedBy: string;
}

/**
 * Tool Registry - manages tool lifecycle, registration, and agent assignments.
 */
export class ToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private assignments: Map<string, ToolAssignment[]> = new Map(); // toolId -> assignments
  private agentTools: Map<string, Set<string>> = new Map(); // agentId -> toolIds
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start async initialization
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the registry asynchronously.
   * Registers built-in tools.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.registerBuiltinTools();
    this.initialized = true;
  }

  /**
   * Ensure initialization is complete before operations.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // ==========================================================================
  // Tool Registration
  // ==========================================================================

  /**
   * Register a new tool.
   * Automatically generates DID if not provided.
   * Returns the registered tool with DID fields populated.
   */
  async registerTool(input: MCPToolInput, createdBy: string): Promise<MCPTool> {
    // Validate input
    const parseResult = MCPToolInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new Error(`Invalid tool input: ${parseResult.error.message}`);
    }

    const validInput = parseResult.data;

    if (this.tools.has(validInput.toolId)) {
      throw new Error(`Tool ${validInput.toolId} already registered`);
    }

    // Generate DID
    const didResult = await createToolDID(validInput.toolId);

    const tool: MCPTool = {
      ...validInput,
      toolDID: didResult.did,
      toolBlindedKey: didResult.blindedKey,
      toolPublicKey: didResult.publicKey,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    this.tools.set(tool.toolId, tool);
    return tool;
  }

  /**
   * Get a tool by ID.
   */
  getTool(toolId: string): MCPTool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get a tool by DID.
   */
  getToolByDID(did: string): MCPTool | undefined {
    for (const tool of this.tools.values()) {
      if (tool.toolDID === did) {
        return tool;
      }
    }
    return undefined;
  }

  /**
   * List all tools, optionally filtered by category.
   */
  listTools(category?: ToolCategory): MCPTool[] {
    const tools = Array.from(this.tools.values());
    if (category) {
      return tools.filter((t) => t.category === category);
    }
    return tools;
  }

  /**
   * Update a tool's configuration.
   */
  updateTool(toolId: string, updates: MCPToolUpdate): MCPTool | undefined {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return undefined;
    }

    // Validate updates
    const parseResult = MCPToolUpdateSchema.safeParse(updates);
    if (!parseResult.success) {
      throw new Error(`Invalid tool update: ${parseResult.error.message}`);
    }

    const validUpdates = parseResult.data;
    const updatedTool: MCPTool = {
      ...tool,
      ...validUpdates,
    };

    this.tools.set(toolId, updatedTool);
    return updatedTool;
  }

  /**
   * Delete a tool.
   * Also removes all agent assignments.
   */
  deleteTool(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return false;
    }

    // Remove all assignments for this tool
    const assignments = this.assignments.get(toolId) || [];
    for (const assignment of assignments) {
      const agentToolSet = this.agentTools.get(assignment.agentId);
      if (agentToolSet) {
        agentToolSet.delete(toolId);
      }
    }
    this.assignments.delete(toolId);

    // Remove the tool
    this.tools.delete(toolId);
    return true;
  }

  // ==========================================================================
  // Tool-Agent Assignment
  // ==========================================================================

  /**
   * Assign a tool to an agent.
   */
  assignToolToAgent(
    toolId: string,
    agentId: string,
    assignedBy: string
  ): ToolAssignment {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    // Check if already assigned
    const existingAssignments = this.assignments.get(toolId) || [];
    const alreadyAssigned = existingAssignments.some(
      (a) => a.agentId === agentId
    );
    if (alreadyAssigned) {
      throw new Error(`Tool ${toolId} already assigned to agent ${agentId}`);
    }

    const assignment: ToolAssignment = {
      toolId,
      agentId,
      assignedAt: new Date().toISOString(),
      assignedBy,
    };

    // Add to tool's assignments
    existingAssignments.push(assignment);
    this.assignments.set(toolId, existingAssignments);

    // Add to agent's tools
    let agentToolSet = this.agentTools.get(agentId);
    if (!agentToolSet) {
      agentToolSet = new Set();
      this.agentTools.set(agentId, agentToolSet);
    }
    agentToolSet.add(toolId);

    return assignment;
  }

  /**
   * Unassign a tool from an agent.
   */
  unassignToolFromAgent(toolId: string, agentId: string): boolean {
    const assignments = this.assignments.get(toolId);
    if (!assignments) {
      return false;
    }

    const idx = assignments.findIndex((a) => a.agentId === agentId);
    if (idx === -1) {
      return false;
    }

    // Remove from tool's assignments
    assignments.splice(idx, 1);
    if (assignments.length === 0) {
      this.assignments.delete(toolId);
    } else {
      this.assignments.set(toolId, assignments);
    }

    // Remove from agent's tools
    const agentToolSet = this.agentTools.get(agentId);
    if (agentToolSet) {
      agentToolSet.delete(toolId);
      if (agentToolSet.size === 0) {
        this.agentTools.delete(agentId);
      }
    }

    return true;
  }

  /**
   * Get all tools assigned to an agent.
   */
  getToolsForAgent(agentId: string): MCPTool[] {
    const toolIds = this.agentTools.get(agentId);
    if (!toolIds) {
      return [];
    }

    const tools: MCPTool[] = [];
    for (const toolId of toolIds) {
      const tool = this.tools.get(toolId);
      if (tool && tool.isEnabled) {
        tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Get all agents assigned to a tool.
   */
  getAgentsForTool(toolId: string): string[] {
    const assignments = this.assignments.get(toolId) || [];
    return assignments.map((a) => a.agentId);
  }

  /**
   * Get assignment count for a tool.
   */
  getAssignmentCount(toolId: string): number {
    return (this.assignments.get(toolId) || []).length;
  }

  // ==========================================================================
  // Built-in Tools
  // ==========================================================================

  /**
   * Register built-in tools.
   */
  private async registerBuiltinTools(): Promise<void> {
    const systemUser = 'system';

    // Web Search Tool
    await this.registerTool(
      {
        toolId: 'web_search',
        name: 'Web Search',
        description: 'Search the web for information using various search engines.',
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
              minLength: 1,
              maxLength: 500,
            },
            maxResults: {
              type: 'integer',
              description: 'Maximum number of results to return',
              default: 10,
              minimum: 1,
              maximum: 50,
            },
          },
          required: ['query'],
        },
        handler: 'builtin',
        permissions: ['tool:web_search'],
        isEnabled: true,
      },
      systemUser
    );

    // Document Analysis Tool
    await this.registerTool(
      {
        toolId: 'document_analysis',
        name: 'Document Analysis',
        description: 'Analyze documents for key information, entities, and summaries.',
        category: 'analysis',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'ID of the document to analyze',
            },
            analysisType: {
              type: 'string',
              description: 'Type of analysis to perform',
              enum: ['summary', 'entities', 'sentiment', 'classification'],
            },
          },
          required: ['documentId', 'analysisType'],
        },
        handler: 'builtin',
        permissions: ['tool:document_analysis'],
        isEnabled: true,
      },
      systemUser
    );

    // Data Query Tool
    await this.registerTool(
      {
        toolId: 'data_query',
        name: 'Data Query',
        description: 'Query structured data sources with SQL-like syntax.',
        category: 'data',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Data source identifier',
            },
            query: {
              type: 'string',
              description: 'Query expression',
            },
            limit: {
              type: 'integer',
              description: 'Maximum rows to return',
              default: 100,
              minimum: 1,
              maximum: 1000,
            },
          },
          required: ['source', 'query'],
        },
        handler: 'builtin',
        permissions: ['tool:data_query'],
        isEnabled: true,
      },
      systemUser
    );

    // Notification Tool
    await this.registerTool(
      {
        toolId: 'notification',
        name: 'Notification',
        description: 'Send notifications to users or systems via various channels.',
        category: 'action',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Notification channel',
              enum: ['email', 'slack', 'webhook'],
            },
            recipient: {
              type: 'string',
              description: 'Recipient identifier (email, channel, URL)',
            },
            subject: {
              type: 'string',
              description: 'Notification subject/title',
              maxLength: 200,
            },
            message: {
              type: 'string',
              description: 'Notification body',
              maxLength: 5000,
            },
            priority: {
              type: 'string',
              description: 'Message priority',
              enum: ['low', 'normal', 'high', 'urgent'],
              default: 'normal',
            },
          },
          required: ['channel', 'recipient', 'message'],
        },
        handler: 'builtin',
        permissions: ['tool:notification'],
        isEnabled: true,
      },
      systemUser
    );

    // MIDLIFE Categorization Tool
    const midlifeCategorizer = getMidlifeCategorizer();
    const midlifeMetadata = midlifeCategorizer.getToolMetadata();
    await this.registerTool(
      {
        toolId: 'categorize-midlife',
        name: 'MIDLIFE Categorizer',
        description: midlifeMetadata.description,
        category: 'analysis',
        inputSchema: midlifeMetadata.inputSchema as JSONSchema,
        handler: 'builtin',
        permissions: ['tool:categorize-midlife'],
        isEnabled: true,
      },
      systemUser
    );
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let registryInstance: ToolRegistry | null = null;

/**
 * Get or create the tool registry singleton.
 */
export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}
