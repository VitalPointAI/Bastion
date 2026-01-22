/**
 * OSINT MCP Tools
 *
 * MCP tool definitions for OSINT event management and evidence linking.
 * Used for ingesting external intelligence and connecting it to objectives.
 */

import type { MCPToolInput } from '../../agents/character-schema.js';
import { osintEventStore } from '../osint/event-store.js';
import type { OSINTSourceType, EventRelevance } from '../osint/types.js';

/**
 * Tool definitions for registration in ToolRegistry
 */
export const osintToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'fetch_osint_feeds',
    name: 'Fetch OSINT Feeds',
    description: 'Fetch events from configured OSINT sources. Returns stored events matching the filter criteria.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          description: 'Source names to query',
          items: { type: 'string' },
        },
        startDate: {
          type: 'string',
          description: 'Start date for filtering (ISO format)',
        },
        endDate: {
          type: 'string',
          description: 'End date for filtering (ISO format)',
        },
        workspaceId: {
          type: 'string',
          description: 'Workspace ID filter',
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return',
          default: 50,
          minimum: 1,
          maximum: 200,
        },
      },
      required: [],
    },
    handler: 'builtin',
    permissions: ['tool:fetch_osint_feeds'],
    isEnabled: true,
  },
  {
    toolId: 'create_osint_event',
    name: 'Create OSINT Event',
    description: 'Store a processed OSINT event from external sources.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title',
          minLength: 1,
        },
        description: {
          type: 'string',
          description: 'Event description',
        },
        sourceType: {
          type: 'string',
          description: 'Type of source',
          enum: ['news', 'social_media', 'government', 'academic', 'satellite', 'signals', 'other'],
        },
        sourceUrl: {
          type: 'string',
          description: 'URL of the source',
        },
        sourceName: {
          type: 'string',
          description: 'Name of the source',
        },
        publishedAt: {
          type: 'string',
          description: 'When the event was published (ISO format)',
        },
        location: {
          type: 'object',
          description: 'Location information',
          properties: {
            name: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            region: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['name'],
        },
        actors: {
          type: 'array',
          description: 'Actor names mentioned in the event',
          items: { type: 'string' },
        },
        tags: {
          type: 'array',
          description: 'Tags for categorization',
          items: { type: 'string' },
        },
        rawContent: {
          type: 'string',
          description: 'Raw content of the source',
        },
        workspaceId: {
          type: 'string',
          description: 'Workspace ID',
        },
      },
      required: ['title', 'description', 'sourceType', 'sourceName', 'publishedAt'],
    },
    handler: 'builtin',
    permissions: ['tool:create_osint_event'],
    isEnabled: true,
  },
  {
    toolId: 'link_event_to_objective',
    name: 'Link Event to Objective',
    description: 'Connect an OSINT event to a strategic objective as evidence.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'OSINT event ID',
        },
        objectiveId: {
          type: 'string',
          description: 'Strategic objective ID',
        },
        relevance: {
          type: 'string',
          description: 'How the event relates to the objective',
          enum: ['supporting', 'contradicting', 'neutral', 'unknown'],
        },
        relevanceScore: {
          type: 'number',
          description: 'Confidence in the relevance assessment (0-1)',
          minimum: 0,
          maximum: 1,
        },
        reasoning: {
          type: 'string',
          description: 'Why this event is relevant to the objective',
        },
        linkedBy: {
          type: 'string',
          description: 'DID of the linker',
        },
      },
      required: ['eventId', 'objectiveId', 'relevance', 'relevanceScore', 'reasoning', 'linkedBy'],
    },
    handler: 'builtin',
    permissions: ['tool:link_event_to_objective'],
    isEnabled: true,
  },
  {
    toolId: 'get_objective_evidence',
    name: 'Get Objective Evidence',
    description: 'Retrieve all evidence linked to a strategic objective.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        objectiveId: {
          type: 'string',
          description: 'Strategic objective ID',
        },
      },
      required: ['objectiveId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_objective_evidence'],
    isEnabled: true,
  },
];

/**
 * Tool execution handlers
 */
export const osintToolHandlers = {
  /**
   * Fetch OSINT events
   */
  async fetch_osint_feeds(input: {
    sources?: string[];
    startDate?: string;
    endDate?: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<{ events: unknown[]; total: number }> {
    // For now, returns stored events. Real OSINT feed integration is configurable per deployment.
    return await osintEventStore.listEvents({
      workspaceId: input.workspaceId,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      limit: input.limit || 50,
    });
  },

  /**
   * Create OSINT event
   */
  async create_osint_event(input: {
    title: string;
    description: string;
    sourceType: OSINTSourceType;
    sourceUrl?: string;
    sourceName: string;
    publishedAt: string;
    location?: {
      name: string;
      latitude?: number;
      longitude?: number;
      region?: string;
      country?: string;
    };
    actors?: string[];
    tags?: string[];
    rawContent?: string;
    workspaceId?: string;
  }): Promise<{ eventId: string }> {
    const event = await osintEventStore.createEvent({
      ...input,
      publishedAt: new Date(input.publishedAt),
      actors: input.actors || [],
      tags: input.tags || [],
      metadata: {},
    });
    return { eventId: event.id };
  },

  /**
   * Link event to objective
   */
  async link_event_to_objective(input: {
    eventId: string;
    objectiveId: string;
    relevance: EventRelevance;
    relevanceScore: number;
    reasoning: string;
    linkedBy: string;
  }): Promise<{ evidenceId: string }> {
    const evidence = await osintEventStore.linkToObjective(
      input.eventId,
      input.objectiveId,
      input.relevance,
      input.relevanceScore,
      input.reasoning,
      input.linkedBy
    );
    return { evidenceId: evidence.id };
  },

  /**
   * Get objective evidence
   */
  async get_objective_evidence(input: { objectiveId: string }): Promise<{ evidence: unknown[] }> {
    const evidence = await osintEventStore.getObjectiveEvidence(input.objectiveId);
    return { evidence };
  },
};
