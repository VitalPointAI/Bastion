/**
 * DecisionGateTimeline
 *
 * Compact decision history log for tab sidebars.
 * Shows last 5 decisions by default with "Show all" expand toggle.
 * Each entry is clickable to open ProposalDetail modal.
 *
 * Displays gates that have been acted on (status != 'pending'),
 * sorted by updated_at descending (most recent first).
 */

import { useState, useMemo, useCallback } from 'react';
import { useDecisionGates } from '../../context/DecisionGateContext';
import { GateStatus, type DecisionGate } from '../../lib/gate-service';
import './DecisionGateTimeline.css';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_VISIBLE = 5;

const GATE_TYPE_LABELS: Record<string, string> = {
  objective_approval: 'Objective Approval',
  operational_approach: 'Operational Approach',
  coa_selection: 'COA Selection',
  order_release: 'Order Release',
  reframing: 'Reframing Decision',
  design_revision: 'Design Revision Proposal',
};

const STATUS_LABELS: Record<string, string> = {
  [GateStatus.submitted]: 'Submitted',
  [GateStatus.approved]: 'Approved',
  [GateStatus.rejected]: 'Rejected',
  [GateStatus.escalated]: 'Escalated',
  [GateStatus.overridden]: 'Overridden',
};

// ============================================================================
// Helpers
// ============================================================================

function getStatusColor(status: string): string {
  switch (status) {
    case GateStatus.approved:
      return 'green';
    case GateStatus.rejected:
      return 'red';
    case GateStatus.submitted:
      return 'amber';
    case GateStatus.escalated:
      return 'purple';
    case GateStatus.overridden:
      return 'gray';
    default:
      return 'gray';
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ============================================================================
// Props
// ============================================================================

interface DecisionGateTimelineProps {
  /** Tab ID to filter gates */
  tabId: string;
  /** Callback when an entry is clicked */
  onEntryClick?: (gate: DecisionGate) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DecisionGateTimeline({ tabId, onEntryClick }: DecisionGateTimelineProps) {
  const { gates } = useDecisionGates(tabId);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Filter to gates that have been acted on (not pending)
  const actedGates = useMemo(() => {
    return gates
      .filter((g) => g.status !== GateStatus.pending)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [gates]);

  const visibleGates = expanded ? actedGates : actedGates.slice(0, DEFAULT_VISIBLE);
  const hasMore = actedGates.length > DEFAULT_VISIBLE;

  const handleEntryClick = useCallback(
    (gate: DecisionGate) => {
      if (onEntryClick) {
        onEntryClick(gate);
      }
    },
    [onEntryClick]
  );

  return (
    <div className="decision-gate-timeline">
      {/* Collapsible header */}
      <button
        className="timeline-header"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <span className="timeline-title">Decision History</span>
        <span className={`timeline-chevron ${collapsed ? 'collapsed' : ''}`}>
          {collapsed ? '\u25B6' : '\u25BC'}
        </span>
      </button>

      {!collapsed && (
        <div className="timeline-body">
          {actedGates.length === 0 ? (
            <div className="timeline-empty">No decisions yet</div>
          ) : (
            <>
              <div className="timeline-entries">
                {visibleGates.map((gate) => {
                  const color = getStatusColor(gate.status);
                  const label =
                    gate.target_item_title ||
                    GATE_TYPE_LABELS[gate.gate_type] ||
                    gate.gate_type;
                  const statusLabel = STATUS_LABELS[gate.status] || gate.status;
                  const time = relativeTime(gate.updated_at);

                  return (
                    <button
                      key={gate.id}
                      className="timeline-entry"
                      onClick={() => handleEntryClick(gate)}
                      title={`${label} - ${statusLabel}`}
                    >
                      <span className={`timeline-dot dot-${color}`} />
                      <div className="timeline-entry-content">
                        <span className="timeline-entry-title">{label}</span>
                        <span className="timeline-entry-meta">
                          <span className={`timeline-status status-${color}`}>
                            {statusLabel}
                          </span>
                          <span className="timeline-time">{time}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {hasMore && (
                <button
                  className="timeline-show-all"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded
                    ? 'Show less'
                    : `Show all (${actedGates.length})`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
