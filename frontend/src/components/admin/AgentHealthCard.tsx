/**
 * AgentHealthCard Component
 *
 * Phase 51: Per-agent health display widget for the agent dashboard.
 *
 * Displays: agent name, status badge, success rate, avg response time,
 * last invocation as relative time, and validation score bar.
 *
 * Color coding:
 *   - Success rate >0.9 → green
 *   - Success rate >0.7 → yellow
 *   - Otherwise → red
 */

import type { StandardAgentWithHealth } from '../../types/admin';

interface AgentHealthCardProps {
  agent: StandardAgentWithHealth;
  onClick?: () => void;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return '#22c55e';    // green
    case 'degraded': return '#f59e0b';  // yellow
    case 'error': return '#ef4444';     // red
    case 'inactive':
    default: return '#9ca3af';          // gray
  }
}

function getSuccessRateColor(rate: number | null): string {
  if (rate === null) return '#9ca3af';
  if (rate > 0.9) return '#22c55e';
  if (rate > 0.7) return '#f59e0b';
  return '#ef4444';
}

export function AgentHealthCard({ agent, onClick }: AgentHealthCardProps) {
  const successRateColor = getSuccessRateColor(agent.successRate);
  const statusColor = getStatusColor(agent.status);

  return (
    <div
      className="agent-health-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="agent-health-card__header">
        <span
          className="agent-health-card__status-dot"
          style={{ backgroundColor: statusColor }}
          title={agent.status}
        />
        <span className="agent-health-card__name" title={agent.agentId}>
          {agent.name}
        </span>
        <span
          className={`status-badge status-badge--${agent.status}`}
          style={{ fontSize: '0.65rem', padding: '1px 6px' }}
        >
          {agent.status}
        </span>
      </div>

      <div className="agent-health-card__metrics">
        <div className="agent-health-card__metric">
          <span className="agent-health-card__metric-label">Success</span>
          <span
            className="agent-health-card__metric-value"
            style={{ color: successRateColor }}
          >
            {agent.successRate !== null
              ? `${Math.round(agent.successRate * 100)}%`
              : '—'}
          </span>
        </div>

        <div className="agent-health-card__metric">
          <span className="agent-health-card__metric-label">Avg RT</span>
          <span className="agent-health-card__metric-value">
            {agent.avgResponseTimeMs !== null
              ? `${Math.round(agent.avgResponseTimeMs)}ms`
              : '—'}
          </span>
        </div>

        <div className="agent-health-card__metric">
          <span className="agent-health-card__metric-label">Last Run</span>
          <span className="agent-health-card__metric-value">
            {formatRelativeTime(agent.lastInvocation)}
          </span>
        </div>
      </div>

      {agent.validationScore !== null && (
        <div className="agent-health-card__score-row">
          <span className="agent-health-card__metric-label">Validation</span>
          <div className="agent-health-card__score-bar">
            <div
              className="agent-health-card__score-fill"
              style={{
                width: `${Math.round(agent.validationScore * 100)}%`,
                backgroundColor: successRateColor,
              }}
            />
          </div>
          <span className="agent-health-card__score-pct">
            {Math.round(agent.validationScore * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
