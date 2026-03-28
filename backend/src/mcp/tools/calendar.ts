/**
 * MCP Calendar Tool Group
 *
 * Phase 60 Plan 02: Exposes Bastion exercise and training schedule data to
 * Ironclaw via MCP. Covers schedule retrieval and event listing.
 *
 * Blueprint Section 4.1 — Calendar domain tools.
 */

import type { MCPToolDefinition } from '../../ironclaw/tool-bridge.js';

export const calendarTools: MCPToolDefinition[] = [
  {
    name: 'bastion.calendar.get_schedule',
    description:
      'Get the exercise or training schedule for a problem set, including key ' +
      'events, milestones, phase transitions, and decision points.',
    inputSchema: {
      type: 'object',
      properties: {
        problem_set_id: {
          type: 'string',
          description: 'Unique identifier of the problem set whose schedule to retrieve',
        },
        include_past_events: {
          type: 'boolean',
          description: 'Whether to include past events in the schedule (default: false)',
        },
        schedule_type: {
          type: 'string',
          enum: ['exercise', 'training', 'operational', 'all'],
          description: 'Type of schedule to retrieve (default: "all")',
        },
      },
      required: ['problem_set_id'],
    },
    riskLevel: 'low',
  },

  {
    name: 'bastion.calendar.get_events',
    description:
      'List calendar events within a date range. Returns event title, type, ' +
      'start/end times, location, and associated problem set.',
    inputSchema: {
      type: 'object',
      properties: {
        date_from: {
          type: 'string',
          format: 'date-time',
          description: 'Start of the date range (ISO 8601 datetime)',
        },
        date_to: {
          type: 'string',
          format: 'date-time',
          description: 'End of the date range (ISO 8601 datetime)',
        },
        problem_set_id: {
          type: 'string',
          description: 'Optional filter to scope events to a specific problem set',
        },
        event_type: {
          type: 'string',
          description: 'Optional filter by event type (e.g., "briefing", "AAR", "rehearsal", "decision_gate")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events to return (default: 50)',
        },
      },
      required: ['date_from', 'date_to'],
    },
    riskLevel: 'low',
  },
];
