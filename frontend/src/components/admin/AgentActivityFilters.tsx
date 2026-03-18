/**
 * AgentActivityFilters Component
 *
 * Filter bar for the agent activity feed.
 * Provides dropdowns for agent, team, action type, problem set, date range,
 * and status. Emits onChange when filters change.
 */

import { useState, useEffect } from 'react';
import { adminService } from '../../lib/admin-service';
import type { ActivityFilter } from '../../types/admin';

// Action type display labels
const ACTION_TYPE_LABELS: Record<string, string> = {
  llm_invocation: 'LLM Invocation',
  tool_call: 'Tool Call',
  message_received: 'Message Received',
  message_sent: 'Message Sent',
  action_card: 'Action Card',
  delegation: 'Delegation',
  team_dispatch: 'Team Dispatch',
  specialist_handoff: 'Specialist Handoff',
  checkpoint: 'Checkpoint',
  error: 'Error',
};

const DATE_PRESETS = [
  { label: 'Last 1h', value: '1h' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
  { label: 'All Time', value: 'all' },
];

function getStartDateForPreset(preset: string): string | undefined {
  const now = new Date();
  switch (preset) {
    case '1h': {
      now.setHours(now.getHours() - 1);
      return now.toISOString();
    }
    case '24h': {
      now.setDate(now.getDate() - 1);
      return now.toISOString();
    }
    case '7d': {
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    }
    default:
      return undefined;
  }
}

interface AgentOption {
  agentId: string;
  name: string;
}

interface TeamOption {
  teamId: string;
  name: string;
}

export interface AgentActivityFiltersProps {
  onChange: (filter: ActivityFilter) => void;
  disabled?: boolean;
}

export function AgentActivityFilters({ onChange, disabled }: AgentActivityFiltersProps) {
  const [agentId, setAgentId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [actionType, setActionType] = useState('');
  const [status, setStatus] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);

  // Load agents and teams for dropdowns
  useEffect(() => {
    adminService
      .listAgents()
      .then((data) => {
        setAgents(data.map((a) => ({ agentId: a.agentId, name: a.name })));
      })
      .catch(() => {/* non-critical */});

    adminService
      .listTeams()
      .then((data) => {
        setTeams(data.map((t) => ({ teamId: t.teamId, name: t.name })));
      })
      .catch(() => {/* non-critical */});
  }, []);

  // Emit filter whenever any value changes
  useEffect(() => {
    const startDate = getStartDateForPreset(datePreset);
    onChange({
      agentId: agentId || undefined,
      teamId: teamId || undefined,
      type: actionType || undefined,
      status: status || undefined,
      startDate,
      limit: 50,
      offset: 0,
    });
  }, [agentId, teamId, actionType, status, datePreset, onChange]);

  return (
    <div className="activity-filters">
      <div className="activity-filters-row">
        {/* Agent filter */}
        <select
          className="form-select form-select--compact"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          disabled={disabled}
          aria-label="Filter by agent"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.agentId} value={a.agentId}>
              {a.name}
            </option>
          ))}
        </select>

        {/* Team filter */}
        <select
          className="form-select form-select--compact"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          disabled={disabled}
          aria-label="Filter by team"
        >
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Action type filter */}
        <select
          className="form-select form-select--compact"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          disabled={disabled}
          aria-label="Filter by action type"
        >
          <option value="">All Action Types</option>
          {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          className="form-select form-select--compact"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={disabled}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Date range presets */}
        <select
          className="form-select form-select--compact"
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          disabled={disabled}
          aria-label="Date range"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
