/**
 * DAODashboard Component
 *
 * Main governance dashboard for commanders.
 * Shows DAOs, proposals, action required items, and recent activity.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DAOMetadata, Proposal, CoalitionStatus } from '../../types/dao';
import { VoteType } from '../../types/dao';
import { governanceService } from '../../lib/governance-service';
import { useUser } from '../../context/UserContext';
import { ProposalList } from './ProposalList';
import { ProposalDetail } from './ProposalDetail';
import { VotingInterface } from './VotingInterface';
import { MDMPGovernancePanel } from '../governance/MDMPGovernancePanel';
import { GateStatusBadge } from '../governance/GateStatusBadge';
import { useDecisionGates } from '../../context/DecisionGateContext';
import './DAODashboard.css';

// ============================================================================
// Helpers for Decision Gates display
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

  const filtered = gates
    .filter((g) => !(g.status === 'pending' && g.gate_type === 'robot_action_auth'))
    .sort((a, b) => {
      const order: Record<string, number> = { submitted: 0, pending: 1, escalated: 2, rejected: 3, approved: 4, overridden: 5 };
      const diff = (order[a.status] ?? 99) - (order[b.status] ?? 99);
      return diff !== 0 ? diff : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (filtered.length === 0) return null;

  // Split into actionable vs resolved
  const actionable = filtered.filter((g) => g.status === 'submitted' || g.status === 'escalated');
  const resolved = filtered.filter((g) => g.status !== 'submitted' && g.status !== 'escalated');

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

interface DAODashboardProps {
  daoId?: string; // If not provided, show all user's DAOs
  initialView?: 'governance' | 'proposals' | 'mdmp';
}

export function DAODashboard({ daoId: initialDaoId, initialView }: DAODashboardProps) {
  const { userDID } = useUser();
  const [daos, setDaos] = useState<DAOMetadata[]>([]);
  const [selectedDaoId, setSelectedDaoId] = useState<string | null>(initialDaoId ?? null);
  const [actionRequired, setActionRequired] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showVoting, setShowVoting] = useState(false);
  const [coalitionStatus, setCoalitionStatus] = useState<CoalitionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMDMPWorkflow, setShowMDMPWorkflow] = useState(initialView === 'mdmp');

  // Load DAOs and action required proposals
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [daosData, actionData] = await Promise.all([
        governanceService.listDAOs(),
        governanceService.getMyActionRequired(),
      ]);
      setDaos(daosData);
      setActionRequired(actionData);

      // Auto-select first DAO if none selected
      if (!selectedDaoId && daosData.length > 0) {
        setSelectedDaoId(daosData[0].daoId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedDaoId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Load coalition status when proposal is selected
  useEffect(() => {
    async function loadCoalition() {
      if (selectedProposal) {
        const status = await governanceService.getCoalitionStatus(
          selectedProposal.daoId,
          selectedProposal.id
        );
        setCoalitionStatus(status);
      } else {
        setCoalitionStatus(null);
      }
    }
    loadCoalition();
  }, [selectedProposal]);

  const handleSelectProposal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowVoting(false);
  };

  const handleCloseDetail = () => {
    setSelectedProposal(null);
    setShowVoting(false);
    setCoalitionStatus(null);
  };

  const handleOpenVoting = () => {
    setShowVoting(true);
  };

  const handleVote = async (voteType: VoteType) => {
    if (!selectedProposal) return;
    const tx = await governanceService.buildVoteTx(
      selectedProposal.daoId,
      selectedProposal.id,
      voteType
    );
    // In production, this would send to wallet for signing
    console.log('Vote transaction:', tx);
    // Refresh data after vote
    await loadDashboardData();
  };

  const handleVeto = async () => {
    if (!selectedProposal) return;
    const tx = await governanceService.buildVetoTx(
      selectedProposal.daoId,
      selectedProposal.id
    );
    console.log('Veto transaction:', tx);
    await loadDashboardData();
  };

  const handleHumanApproval = async () => {
    if (!selectedProposal) return;
    const tx = await governanceService.buildHumanApprovalTx(
      selectedProposal.daoId,
      selectedProposal.id
    );
    console.log('Human approval transaction:', tx);
    await loadDashboardData();
  };

  const handleCoalitionApproval = async (party: string) => {
    if (!selectedProposal) return;
    const tx = await governanceService.buildCoalitionApprovalTx(
      selectedProposal.daoId,
      selectedProposal.id,
      party
    );
    console.log('Coalition approval transaction:', tx);
    await loadDashboardData();
  };

  // Decision gates cross-tab overview
  const { gates: allGates, loading: gatesLoading, approveGate: approveGateCtx, rejectGate: rejectGateCtx, isCommander } = useDecisionGates();

  const selectedDao = daos.find((d) => d.daoId === selectedDaoId);

  if (loading && daos.length === 0) {
    return (
      <div className="dao-dashboard loading">
        <div className="loading-content">Loading governance dashboard...</div>
      </div>
    );
  }

  if (error && daos.length === 0) {
    return (
      <div className="dao-dashboard error">
        <div className="error-content">
          <p>{error}</p>
          <button onClick={loadDashboardData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dao-dashboard">
      <header className="dashboard-header">
        <h1>Governance</h1>
        <div className="header-actions">
          <button
            className={`mdmp-workflow-toggle ${showMDMPWorkflow ? 'active' : ''}`}
            onClick={() => {
              setShowMDMPWorkflow(!showMDMPWorkflow);
              setSelectedProposal(null);
              setShowVoting(false);
            }}
          >
            {showMDMPWorkflow ? '← Back to Proposals' : 'MDMP Workflow →'}
          </button>
          <div className="dao-selector">
            <select
              value={selectedDaoId ?? ''}
              onChange={(e) => setSelectedDaoId(e.target.value || null)}
            >
              <option value="">All DAOs</option>
              {daos.map((dao) => (
                <option key={dao.daoId} value={dao.daoId}>
                  {dao.name} ({dao.activeProposalCount} active)
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-value">{daos.reduce((sum, d) => sum + d.activeProposalCount, 0)}</div>
            <div className="card-label">Active Proposals</div>
          </div>
          <div className={`summary-card ${actionRequired.length > 0 ? 'highlight' : ''}`}>
            <div className="card-value">{actionRequired.length}</div>
            <div className="card-label">Action Required</div>
          </div>
          <div className="summary-card">
            <div className="card-value">{daos.length}</div>
            <div className="card-label">DAOs</div>
          </div>
        </div>

        {/* Decision Gates Cross-Tab Overview */}
        {!gatesLoading && allGates.length > 0 && (
          <DecisionGatesTable
            gates={allGates}
            isCommander={isCommander}
            onApprove={approveGateCtx}
            onReject={rejectGateCtx}
          />
        )}

        <div className="dashboard-main">
          {/* MDMP Workflow Panel */}
          {showMDMPWorkflow && selectedDaoId && (
            <div className="mdmp-workflow-section">
              <MDMPGovernancePanel
                missionId="placeholder-mission-001"
                daoId={selectedDaoId}
                userDID={userDID || 'anonymous'}
              />
            </div>
          )}

          {/* Sidebar: DAOs list (when no DAO selected) */}
          {!showMDMPWorkflow && !selectedDaoId && (
            <aside className="daos-sidebar">
              <h3>My DAOs</h3>
              <div className="dao-list">
                {daos.map((dao) => (
                  <div
                    key={dao.daoId}
                    className="dao-item"
                    onClick={() => setSelectedDaoId(dao.daoId)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && setSelectedDaoId(dao.daoId)}
                  >
                    <div className="dao-name">{dao.name}</div>
                    <div className="dao-meta">
                      <span className="member-count">{dao.memberCount} members</span>
                      <span className="proposal-count">{dao.activeProposalCount} active</span>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          )}

          {/* Main Content */}
          {!showMDMPWorkflow && (
            <main className="proposals-main">
            {/* Action Required Section */}
            {actionRequired.length > 0 && !selectedProposal && (
              <section className="action-required-section">
                <h2>Action Required</h2>
                <div className="action-required-list">
                  {actionRequired.slice(0, 5).map((proposal) => (
                    <div
                      key={`${proposal.daoId}-${proposal.id}`}
                      className="action-item"
                      onClick={() => handleSelectProposal(proposal)}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => e.key === 'Enter' && handleSelectProposal(proposal)}
                    >
                      <div className="action-item-header">
                        <span className="dao-name">{daos.find((d) => d.daoId === proposal.daoId)?.name}</span>
                        <span className={`urgency ${proposal.isUrgent ? 'urgent' : ''}`}>
                          {proposal.isUrgent ? 'URGENT' : proposal.timeRemaining}
                        </span>
                      </div>
                      <div className="action-item-description">{proposal.description}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Proposal List (when DAO selected) */}
            {selectedDaoId && !selectedProposal && (
              <section className="proposals-section">
                <div className="section-header">
                  <h2>{selectedDao?.name || 'Proposals'}</h2>
                  {selectedDao && (
                    <p className="dao-description">{selectedDao.description}</p>
                  )}
                </div>
                <ProposalList
                  daoId={selectedDaoId}
                  onSelectProposal={handleSelectProposal}
                />
              </section>
            )}

            {/* Proposal Detail */}
            {selectedProposal && !showVoting && (
              <section className="proposal-detail-section">
                <ProposalDetail
                  daoId={selectedProposal.daoId}
                  proposalId={selectedProposal.id}
                  onClose={handleCloseDetail}
                  onVote={handleOpenVoting}
                />
              </section>
            )}

            {/* Voting Interface */}
            {selectedProposal && showVoting && (
              <section className="voting-section">
                <div className="section-header">
                  <button className="back-button" onClick={() => setShowVoting(false)}>
                    ← Back to Proposal
                  </button>
                  <h2>Cast Your Vote</h2>
                </div>
                <VotingInterface
                  proposal={selectedProposal}
                  coalitionStatus={coalitionStatus}
                  onVote={handleVote}
                  onVeto={handleVeto}
                  onHumanApproval={handleHumanApproval}
                  onCoalitionApproval={handleCoalitionApproval}
                  canVeto={true} // Would check permissions in production
                />
              </section>
            )}
          </main>
          )}
        </div>
      </div>
    </div>
  );
}
