/**
 * MCP Knowledge Tool Group
 *
 * Phase 60 Plan 02: Exposes Bastion knowledge graph capabilities to Ironclaw
 * via MCP. Covers entity search, entity details, relationships, and full-text
 * document search.
 *
 * Blueprint Section 4.1 — Knowledge domain tools.
 */

import type { MCPToolDefinition } from '../../ironclaw/tool-bridge.js';

export const knowledgeTools: MCPToolDefinition[] = [
  {
    name: 'bastion_knowledge_search',
    description:
      'Search knowledge graph entities by keyword query and optional entity type filter. ' +
      'Returns matching entities with ID, type, label, and relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms to match against entity labels, aliases, and properties',
        },
        entity_type: {
          type: 'string',
          description: 'Optional filter to restrict results to a specific entity type (e.g., "Person", "Organization", "Location")',
        },
        problem_set_id: {
          type: 'string',
          description: 'Scope search to a specific problem set context',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20, max: 100)',
        },
      },
      required: ['query'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion_knowledge_get_entity',
    description:
      'Get full details for a knowledge graph entity by its ID. ' +
      'Returns all properties, metadata, and source attribution.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'Unique identifier of the knowledge graph entity',
        },
        include_relationships: {
          type: 'boolean',
          description: 'Whether to include related entity IDs in the response (default: false)',
        },
      },
      required: ['entity_id'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion_knowledge_get_relationships',
    description:
      'Get all relationships for a knowledge graph entity. ' +
      'Returns source entity, relationship type, target entity, and confidence score.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: {
          type: 'string',
          description: 'Unique identifier of the entity whose relationships to retrieve',
        },
        relationship_type: {
          type: 'string',
          description: 'Optional filter to return only relationships of this type',
        },
        direction: {
          type: 'string',
          enum: ['outgoing', 'incoming', 'both'],
          description: 'Direction of relationships to return (default: "both")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of relationships to return (default: 50)',
        },
      },
      required: ['entity_id'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion_knowledge_search_documents',
    description:
      'Full-text search across BASTION documents, reports, and intelligence products. ' +
      'Returns document titles, excerpts, and source metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Full-text search query',
        },
        document_type: {
          type: 'string',
          description: 'Optional filter by document type (e.g., "SITREP", "intelligence_report", "campaign_plan")',
        },
        problem_set_id: {
          type: 'string',
          description: 'Scope search to a specific problem set context',
        },
        date_from: {
          type: 'string',
          format: 'date',
          description: 'Optional start date filter (ISO 8601 date)',
        },
        date_to: {
          type: 'string',
          format: 'date',
          description: 'Optional end date filter (ISO 8601 date)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
    riskLevel: 'low',
  },
];
