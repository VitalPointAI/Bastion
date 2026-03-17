/**
 * DAODashboard Component
 *
 * Governance dashboard for commanders.
 * Shows decision gates with inline approve/reject actions.
 */

import { useState, useCallback } from 'react';
import { GateStatusBadge } from '../governance/GateStatusBadge';
import { useDecisionGates } from '../../context/DecisionGateContext';
import './DAODashboard.css';

// ============================================================================
// Helpers
// ============================================================================

const GATE_TYPE_LABELS: Record<string, string> = {
  objective_approval: 'Objective Approval',
  operational_approach: 'Operational Approach',
  coa_selection: 'COA Selection',
  order_release: 'Order Release',
  reframing: 'Reframing',
  robot_action_auth: 'Robot Action Auth',
  design_revision: 'Design Revision',
};

function formatGateTypeLabel(gateType: string): string {
  return GATE_TYPE_LABELS[gateType] || gateType.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatRelativeTime(isoString: string): string {
  const d = new Date(isoString);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// Decision Gates Table with inline actions
// ============================================================================

function DecisionGatesTable({
  gates,
  isCommander,
  onApprove,
  onReject,
}: {
  gates: import('../../lib/gate-service').DecisionGate[];
  isCommander: boolean;
  onApprove: (gateId: string) => Promise<void>;
  onReject: (gateId: string, reason: string) => Promise<void>;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = useCallback(async (gateId: string) => {
    setActionLoading(gateId);
    try { await onApprove(gateId); } finally { setActionLoading(null); }
  }, [onApprove]);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    setActionLoading(rejectingId);
    try {
      await onReject(rejectingId, rejectReason.trim());
      setRejectingId(null);
      setRejectReason('');
    } finally { setActionLoading(null); }
  }, [rejectingId, rejectReason, onReject]);

  const filtered = [...gates]
    .sort((a, b) => {
      const order: Record<string, number> = { submitted: 0, pending: 1, escalated: 2, rejected: 3, approved: 4, overridden: 5 };
      const diff = (order[a.status] ?? 99) - (order[b.status] ?? 99);
      return diff !== 0 ? diff : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (filtered.length === 0) return null;

  // Split into actionable vs resolved
  // Include pending robot_action_auth gates as actionable — backend auto-advances on approve
  const isActionable = (g: typeof filtered[0]) =>
    g.status === 'submitted' || g.status === 'escalated' ||
    (g.status === 'pending' && g.gate_type === 'robot_action_auth');
  const actionable = filtered.filter(isActionable);
  const resolved = filtered.filter((g) => !isActionable(g));

  return (
    <div className="decision-gates-section">
      <h3 className="section-title">Decision Gates</h3>

      {/* Actionable gates — prominent cards */}
      {actionable.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: resolved.length > 0 ? '1rem' : 0 }}>
          {actionable.map((gate) => (
            <div key={gate.id} style={{
              padding: '0.75rem 1rem',
              background: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#e2e8f0', marginBottom: '0.125rem' }}>
                    {gate.target_item_title || formatGateTypeLabel(gate.gate_type)}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                    {formatGateTypeLabel(gate.gate_type)}
                    {' \u2022 '}
                    <span style={{ textTransform: 'capitalize' }}>{gate.tab}</span>
                    {gate.submitted_at && ` \u2022 ${formatRelativeTime(gate.submitted_at)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                  <GateStatusBadge status={gate.status} />
                  {isCommander && (
                    <>
                      <button
                        onClick={() => handleApprove(gate.id)}
                        disabled={actionLoading === gate.id}
                        style={{
                          padding: '0.25rem 0.625rem',
                          borderRadius: '0.25rem',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                          background: 'rgba(34, 197, 94, 0.1)',
                          color: '#4ade80',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: actionLoading === gate.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {actionLoading === gate.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => { setRejectingId(gate.id); setRejectReason(''); }}
                        disabled={actionLoading === gate.id}
                        style={{
                          padding: '0.25rem 0.625rem',
                          borderRadius: '0.25rem',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#f87171',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: actionLoading === gate.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Inline reject reason input */}
              {rejectingId === gate.id && (
                <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Reason for rejection..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRejectConfirm(); if (e.key === 'Escape') setRejectingId(null); }}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #374151',
                      background: '#1e293b',
                      color: '#e2e8f0',
                      fontSize: '0.75rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleRejectConfirm}
                    disabled={!rejectReason.trim()}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #374151',
                      background: 'transparent',
                      color: '#9ca3af',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved gates — compact table */}
      {resolved.length > 0 && (
        <div className="gates-table-wrapper">
          <table className="gates-overview-table">
            <thead>
              <tr>
                <th>Gate</th>
                <th>Tab</th>
                <th>Item</th>
                <th>Status</th>
                <th>Decided</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((gate) => (
                <tr key={gate.id}>
                  <td>{formatGateTypeLabel(gate.gate_type)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{gate.tab}</td>
                  <td>{gate.target_item_title || '--'}</td>
                  <td><GateStatusBadge status={gate.status} /></td>
                  <td>{gate.decided_at ? formatRelativeTime(gate.decided_at) : gate.submitted_at ? formatRelativeTime(gate.submitted_at) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DAODashboard
// ============================================================================

interface DAODashboardProps {
  daoId?: string;
  initialView?: 'governance' | 'proposals';
}

export function DAODashboard(_props: DAODashboardProps) {
  // Always show approve/reject — the backend enforces actual authorization.
  // isCommander from context may be false if membership role isn't set yet.
  const { gates: allGates, loading: gatesLoading, approveGate: approveGateCtx, rejectGate: rejectGateCtx, isCommander } = useDecisionGates();

  if (gatesLoading) {
    return (
      <div className="dao-dashboard loading">
        <div className="loading-content">Loading decision gates...</div>
      </div>
    );
  }

  return (
    <div className="dao-dashboard">
      <div className="dashboard-content">
        {allGates.length > 0 ? (
          <DecisionGatesTable
            gates={allGates}
            isCommander={isCommander || true}
            onApprove={approveGateCtx}
            onReject={rejectGateCtx}
          />
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No decision gates yet. Gates are created when staff submit items for commander approval or when robot missions require authorization.
          </div>
        )}
      </div>
    </div>
  );
}
