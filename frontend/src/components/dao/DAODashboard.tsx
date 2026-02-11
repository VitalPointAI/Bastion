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
import { ProposalList } from './ProposalList';
import { ProposalDetail } from './ProposalDetail';
import { VotingInterface } from './VotingInterface';
import { MDMPGovernancePanel } from '../governance/MDMPGovernancePanel';
import './DAODashboard.css';

interface DAODashboardProps {
  daoId?: string; // If not provided, show all user's DAOs
}

export function DAODashboard({ daoId: initialDaoId }: DAODashboardProps) {
  const [daos, setDaos] = useState<DAOMetadata[]>([]);
  const [selectedDaoId, setSelectedDaoId] = useState<string | null>(initialDaoId ?? null);
  const [actionRequired, setActionRequired] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showVoting, setShowVoting] = useState(false);
  const [coalitionStatus, setCoalitionStatus] = useState<CoalitionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMDMPWorkflow, setShowMDMPWorkflow] = useState(false);

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

        <div className="dashboard-main">
          {/* MDMP Workflow Panel */}
          {showMDMPWorkflow && selectedDaoId && (
            <div className="mdmp-workflow-section">
              <MDMPGovernancePanel
                missionId="placeholder-mission-001"
                daoId={selectedDaoId}
                userDID="user-did-placeholder"
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
