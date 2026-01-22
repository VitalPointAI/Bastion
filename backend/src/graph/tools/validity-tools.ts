/**
 * Validity MCP Tools
 *
 * MCP tool definitions for objective validity scoring and alerting.
 * Used for tracking how external evidence affects strategic objective validity.
 */

import { randomUUID } from 'crypto';
import type { MCPToolInput } from '../../agents/character-schema.js';
import { validityService } from '../osint/validity-service.js';
import { getPool } from '../../lib/database.js';
import type { AlertType } from '../osint/types.js';

/**
 * Tool definitions for registration in ToolRegistry
 */
export const validityToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'update_validity_score',
    name: 'Update Validity Score',
    description: 'Calculate and update the validity score for a strategic objective based on linked evidence.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        objectiveId: {
          type: 'string',
          description: 'Strategic objective ID',
        },
        calculatedBy: {
          type: 'string',
          description: 'DID of the calculator',
        },
      },
      required: ['objectiveId', 'calculatedBy'],
    },
    handler: 'builtin',
    permissions: ['tool:update_validity_score'],
    isEnabled: true,
  },
  {
    toolId: 'create_validity_alert',
    name: 'Create Validity Alert',
    description: 'Create a manual validity alert for an objective.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        objectiveId: {
          type: 'string',
          description: 'Strategic objective ID',
        },
        alertType: {
          type: 'string',
          description: 'Type of alert',
          enum: ['validity_decreased', 'validity_increased', 'new_evidence', 'conflict_detected', 'trend_change'],
        },
        severity: {
          type: 'string',
          description: 'Alert severity level',
          enum: ['low', 'medium', 'high', 'critical'],
        },
        title: {
          type: 'string',
          description: 'Alert title',
        },
        details: {
          type: 'string',
          description: 'Alert details',
        },
      },
      required: ['objectiveId', 'alertType', 'severity', 'title', 'details'],
    },
    handler: 'builtin',
    permissions: ['tool:create_validity_alert'],
    isEnabled: true,
  },
  {
    toolId: 'get_validity_history',
    name: 'Get Validity History',
    description: 'Get the validity score history for a strategic objective.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        objectiveId: {
          type: 'string',
          description: 'Strategic objective ID',
        },
        limit: {
          type: 'integer',
          description: 'Maximum history entries to return',
          default: 30,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['objectiveId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_validity_history'],
    isEnabled: true,
  },
  {
    toolId: 'calculate_trend',
    name: 'Calculate Validity Trend',
    description: 'Calculate the validity trend for an objective over a time window.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        objectiveId: {
          type: 'string',
          description: 'Strategic objective ID',
        },
        windowDays: {
          type: 'integer',
          description: 'Number of days to analyze',
          default: 30,
          minimum: 1,
          maximum: 365,
        },
      },
      required: ['objectiveId'],
    },
    handler: 'builtin',
    permissions: ['tool:calculate_trend'],
    isEnabled: true,
  },
];

/**
 * Tool execution handlers
 */
export const validityToolHandlers = {
  /**
   * Update validity score
   */
  async update_validity_score(input: {
    objectiveId: string;
    calculatedBy: string;
  }): Promise<{ score: number; previousScore?: number; reasoning: string }> {
    const result = await validityService.calculateValidity(input.objectiveId, input.calculatedBy);
    return {
      score: result.score,
      previousScore: result.previousScore,
      reasoning: result.reasoning,
    };
  },

  /**
   * Create validity alert
   */
  async create_validity_alert(input: {
    objectiveId: string;
    alertType: AlertType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    details: string;
  }): Promise<{ alertId: string }> {
    const pool = getPool();
    const id = `ALT-${randomUUID().slice(0, 8)}`;

    await pool.query(`
      INSERT INTO validity_alerts (id, objective_id, alert_type, severity, title, details, evidence_ids, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, '{}', NOW())
    `, [id, input.objectiveId, input.alertType, input.severity, input.title, input.details]);

    return { alertId: id };
  },

  /**
   * Get validity history
   */
  async get_validity_history(input: {
    objectiveId: string;
    limit?: number;
  }): Promise<{ history: unknown[] }> {
    const history = await validityService.getValidityHistory(input.objectiveId, input.limit || 30);
    return { history };
  },

  /**
   * Calculate trend
   */
  async calculate_trend(input: {
    objectiveId: string;
    windowDays?: number;
  }): Promise<{ trend: 'improving' | 'declining' | 'stable'; changePercent: number }> {
    return await validityService.calculateTrend(input.objectiveId, input.windowDays || 30);
  },
};
