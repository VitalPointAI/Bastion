/**
 * COPAgentActivity
 *
 * Phase 21 Plan 10: Agent activity feed for real-time observability.
 * Polls copService.getAgentActivity every 5 seconds to display
 * what COP agents are doing. Color-coded entries, auto-scroll,
 * agent filter, and compact mode.
 *
 * Embeddable in workspace activity feed or COP tab sidebar.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { copService } from '../../lib/cop-service.js';
import type { AgentActivity } from '../../lib/cop-service.js';
import './COPAgentActivity.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPAgentActivityProps {
  /** Workspace ID to poll activity for */
  workspaceId: string;
}

// ─── Action Type Classification ─────────────────────────────────────────────

type ActionType = 'generation' | 'validation' | 'error' | 'transition' | 'default';

function classifyAction(action: string): ActionType {
  const lower = action.toLowerCase();
  if (lower.includes('generat') || lower.includes('creat') || lower.includes('assembl')) {
    return 'generation';
  }
  if (lower.includes('validat') || lower.includes('verif') || lower.includes('check')) {
    return 'validation';
  }
  if (lower.includes('error') || lower.includes('fail') || lower.includes('reject')) {
    return 'error';
  }
  if (lower.includes('transition') || lower.includes('promot') || lower.includes('publish') || lower.includes('review')) {
    return 'transition';
  }
  return 'default';
}

/** Get initials from agent ID for icon */
function getAgentInitials(agentId: string): string {
  // e.g. "force-disposition-agent" -> "FD"
  const parts = agentId.replace(/-agent$/, '').split(/[-_]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return agentId.substring(0, 2).toUpperCase();
}

// ─── Polling Interval ───────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;
const ACTIVITY_LIMIT = 50;

// ─── Component ──────────────────────────────────────────────────────────────

export function COPAgentActivity({ workspaceId }: COPAgentActivityProps) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [compact, setCompact] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const logRef = useRef<HTMLDivElement>(null);

  // ─── Polling ────────────────────────────────────────────────────────────

  const fetchActivity = useCallback(async () => {
    try {
      const result = await copService.getAgentActivity(workspaceId, ACTIVITY_LIMIT);
      setActivities(result);
    } catch (err) {
      console.error('[COPAgentActivity] Failed to fetch activity:', err);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchActivity();
    const timer = setInterval(fetchActivity, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchActivity]);

  // ─── Auto-scroll ────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [activities, autoScroll]);

  const handleScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    // If user scrolled up more than 40px from bottom, pause auto-scroll
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  };

  // ─── Unique Agents for Filter ───────────────────────────────────────────

  const uniqueAgents = useMemo(() => {
    const agents = new Set<string>();
    for (const a of activities) {
      agents.add(a.agentId);
    }
    return Array.from(agents).sort();
  }, [activities]);

  // ─── Filtered Activities ────────────────────────────────────────────────

  const filteredActivities = useMemo(() => {
    if (agentFilter === 'all') return activities;
    return activities.filter((a) => a.agentId === agentFilter);
  }, [activities, agentFilter]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className={`cop-agent-activity${compact ? ' cop-agent-activity--compact' : ''}`}>
      {/* Header */}
      <div className="cop-agent-activity-header">
        <span className="cop-agent-activity-title">
          <span className="cop-agent-activity-live" />
          Agent Activity
        </span>
        <div className="cop-agent-activity-controls">
          {/* Agent filter */}
          <select
            className="cop-agent-activity-filter"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="all">All Agents</option>
            {uniqueAgents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>

          {/* Compact toggle */}
          <button
            className={`cop-agent-activity-control-btn${compact ? ' cop-agent-activity-control-btn--active' : ''}`}
            onClick={() => setCompact(!compact)}
            title="Compact mode"
          >
            Compact
          </button>

          {/* Auto-scroll toggle */}
          <button
            className={`cop-agent-activity-control-btn${autoScroll ? ' cop-agent-activity-control-btn--active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
          >
            {autoScroll ? 'Scroll: ON' : 'Scroll: OFF'}
          </button>
        </div>
      </div>

      {/* Activity Log */}
      <div
        className="cop-agent-activity-log"
        ref={logRef}
        onScroll={handleScroll}
      >
        {filteredActivities.length === 0 && (
          <div className="cop-agent-activity-empty">
            No agent activity yet. Activity will appear here as COP agents process documents.
          </div>
        )}

        {filteredActivities.map((activity, idx) => {
          const actionType = classifyAction(activity.action);
          return (
            <div key={`${activity.agentId}-${activity.timestamp}-${idx}`} className="cop-agent-activity-entry">
              {/* Agent icon */}
              <div className={`cop-agent-activity-icon cop-agent-activity-icon--${actionType}`}>
                {getAgentInitials(activity.agentId)}
              </div>

              {/* Content */}
              <div className="cop-agent-activity-entry-content">
                <div className="cop-agent-activity-entry-top">
                  <span className="cop-agent-activity-agent-name">
                    {activity.agentId}
                  </span>
                  <span className={`cop-agent-activity-action cop-agent-activity-action--${actionType}`}>
                    {activity.action}
                  </span>
                  <span className="cop-agent-activity-timestamp">
                    {formatTime(activity.timestamp)}
                  </span>
                </div>
                <div className="cop-agent-activity-detail" title={activity.detail}>
                  {activity.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}
