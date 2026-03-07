/**
 * DecisionGateBanner
 *
 * Approval banner component displayed at the top of each tab.
 * Commander/XO view: Shows "N items pending your approval" with expand/collapse
 * list, quick approve/reject actions, and details link.
 * Non-commander view: No banner rendered (status badges handle inline display).
 *
 * Banner persists until all items acted on; has a per-session dismiss X button
 * that reappears on next page load.
 */

import { useState, useCallback } from 'react';
import { useDecisionGates } from '../../context/DecisionGateContext';
import type { DecisionGate } from '../../lib/gate-service';
import './DecisionGateBanner.css';

// ============================================================================
// Helpers
// ============================================================================

/** Format gate_type to human-readable label */
function formatGateType(gateType: string): string {
  return gateType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Format relative time from ISO string */
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// Props
// ============================================================================

interface DecisionGateBannerProps {
  tabId: string;
  onOpenDetail?: (gate: DecisionGate) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DecisionGateBanner({ tabId, onOpenDetail }: DecisionGateBannerProps) {
  const {
    pendingApprovals,
    pendingCount,
    isCommander,
    approveGate,
    rejectGate,
  } = useDecisionGates(tabId);

  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [rejectingGateId, setRejectingGateId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Non-commander roles see no banner
  if (!isCommander) return null;

  // No pending approvals or dismissed
  if (pendingCount === 0 || dismissed) return null;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  }, []);

  const handleApprove = useCallback(
    async (gateId: string) => {
      setActionLoading(gateId);
      try {
        await approveGate(gateId);
      } finally {
        setActionLoading(null);
      }
    },
    [approveGate]
  );

  const handleRejectStart = useCallback((gateId: string) => {
    setRejectingGateId(gateId);
    setRejectReason('');
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectingGateId || !rejectReason.trim()) return;
    setActionLoading(rejectingGateId);
    try {
      await rejectGate(rejectingGateId, rejectReason.trim());
      setRejectingGateId(null);
      setRejectReason('');
    } finally {
      setActionLoading(null);
    }
  }, [rejectingGateId, rejectReason, rejectGate]);

  const handleRejectCancel = useCallback(() => {
    setRejectingGateId(null);
    setRejectReason('');
  }, []);

  return (
    <div className="decision-gate-banner">
      <div className="decision-gate-banner-header" onClick={handleToggle}>
        <div className="banner-header-left">
          <span className="banner-pending-count">{pendingCount}</span>
          <span className="banner-message">
            {pendingCount === 1
              ? '1 item pending your approval'
              : `${pendingCount} items pending your approval`}
          </span>
        </div>
        <div className="banner-header-right">
          <button
            className={`banner-toggle-btn ${expanded ? 'expanded' : ''}`}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            &#9660;
          </button>
          <button
            className="banner-dismiss-btn"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            &#10005;
          </button>
        </div>
      </div>

      <div className={`banner-items-list ${expanded ? 'expanded' : ''}`}>
        <div className="banner-items-inner">
          {pendingApprovals.map((gate) => (
            <div key={gate.id}>
              <div className="banner-gate-item">
                <div className="gate-item-info">
                  <span className="gate-item-title">
                    {gate.target_item_title || `Gate: ${gate.id.slice(0, 8)}`}
                  </span>
                  <div className="gate-item-meta">
                    <span className="gate-item-type">
                      {formatGateType(gate.gate_type)}
                    </span>
                    {gate.submitted_at && (
                      <span className="gate-item-time">
                        {formatRelativeTime(gate.submitted_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="gate-item-actions">
                  <button
                    className="gate-action-btn approve"
                    onClick={() => handleApprove(gate.id)}
                    disabled={actionLoading === gate.id}
                  >
                    {actionLoading === gate.id ? '...' : 'Approve'}
                  </button>
                  <button
                    className="gate-action-btn reject"
                    onClick={() => handleRejectStart(gate.id)}
                    disabled={actionLoading === gate.id}
                  >
                    Reject
                  </button>
                  {onOpenDetail && (
                    <button
                      className="gate-action-btn details"
                      onClick={() => onOpenDetail(gate)}
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>

              {/* Reject reason input row */}
              {rejectingGateId === gate.id && (
                <div className="reject-reason-row">
                  <input
                    className="reject-reason-input"
                    type="text"
                    placeholder="Reason for rejection..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRejectConfirm();
                      if (e.key === 'Escape') handleRejectCancel();
                    }}
                    autoFocus
                  />
                  <button
                    className="reject-confirm-btn"
                    onClick={handleRejectConfirm}
                    disabled={!rejectReason.trim() || actionLoading === gate.id}
                  >
                    Confirm
                  </button>
                  <button className="reject-cancel-btn" onClick={handleRejectCancel}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
