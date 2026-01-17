/**
 * ProposalDetail Component
 *
 * Full proposal view with context chain, coalition status, and voting interface.
 * Commander-focused UX: clear actions, deadlines, autonomy indicators.
 */

import { useState, useEffect } from 'react';
import type {
  Proposal,
  ProposalContext,
  CoalitionStatus,
  Vote,
} from '../../types/dao';
import {
  AutonomyLevel,
  ProposalKind,
  ProposalStatus,
  ExecutionState,
} from '../../types/dao';
import { governanceService } from '../../lib/governance-service';
import './ProposalDetail.css';

interface ProposalDetailProps {
  daoId: string;
  proposalId: number;
  onClose: () => void;
  onVote?: (proposal: Proposal) => void;
}

export function ProposalDetail({ daoId, proposalId, onClose, onVote }: ProposalDetailProps) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [context, setContext] = useState<ProposalContext | null>(null);
  const [coalition, setCoalition] = useState<CoalitionStatus | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProposal() {
      setLoading(true);
      setError(null);
      try {
        const [proposalData, contextData, coalitionData, votesData] = await Promise.all([
          governanceService.getProposal(daoId, proposalId),
          governanceService.getProposalContext(daoId, proposalId),
          governanceService.getCoalitionStatus(daoId, proposalId),
          governanceService.getVotes(daoId, proposalId),
        ]);
        setProposal(proposalData);
        setContext(contextData);
        setCoalition(coalitionData);
        setVotes(votesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposal');
      } finally {
        setLoading(false);
      }
    }
    loadProposal();
  }, [daoId, proposalId]);

  if (loading) {
    return (
      <div className="proposal-detail loading">
        <div className="proposal-detail-header">
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="loading-content">Loading proposal...</div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="proposal-detail error">
        <div className="proposal-detail-header">
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="error-content">
          <p>{error || 'Proposal not found'}</p>
        </div>
      </div>
    );
  }

  const isStrike = proposal.kind === ProposalKind.StrikeAuthorization;
  const kindLabel = governanceService.getKindLabel(proposal.kind);
  const statusLabel = governanceService.getStatusLabel(proposal.status);
  const autonomyLabel = governanceService.getAutonomyLabel(proposal.effectiveAutonomy);
  const executionLabel = governanceService.getExecutionStateLabel(proposal.executionState);
  const classificationLabel = governanceService.getClassificationLabel(proposal.classification);

  // Calculate vote percentages
  const totalVotes = proposal.votesApprove + proposal.votesReject;
  const approvePercent = totalVotes > 0 ? (proposal.votesApprove / totalVotes) * 100 : 50;

  return (
    <div className={`proposal-detail ${isStrike ? 'strike' : ''}`}>
      <div className="proposal-detail-header">
        <div className="header-badges">
          <span className={`kind-badge ${isStrike ? 'strike' : ''}`}>{kindLabel}</span>
          <span className={`status-badge status-${proposal.status.toLowerCase()}`}>{statusLabel}</span>
          <span className={`classification-badge ${proposal.classification.toLowerCase()}`}>
            {classificationLabel}
          </span>
        </div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      {/* Autonomy Section */}
      <div className={`autonomy-section ${proposal.effectiveAutonomy.toLowerCase()}`}>
        <div className="autonomy-header">
          <span className="autonomy-icon">
            {proposal.effectiveAutonomy === AutonomyLevel.Autonomous ? '🤖' : '👤'}
          </span>
          <span className="autonomy-level">{autonomyLabel}</span>
        </div>
        <p className="autonomy-description">
          {proposal.effectiveAutonomy === AutonomyLevel.Autonomous && (
            'This proposal will execute automatically upon approval.'
          )}
          {proposal.effectiveAutonomy === AutonomyLevel.SemiAutonomous && (
            'This proposal will execute after a veto window. Council members can veto.'
          )}
          {proposal.effectiveAutonomy === AutonomyLevel.NotAutonomous && (
            'This proposal requires explicit human approval before execution.'
          )}
        </p>
        {isStrike && (
          <div className="strike-warning">
            <span className="warning-icon">⚠️</span>
            <strong>STRIKE AUTHORIZATION ALWAYS REQUIRES HUMAN APPROVAL</strong>
          </div>
        )}
        {proposal.executionState === ExecutionState.InVetoWindow && (
          <div className="veto-window-notice">
            <span className="countdown-icon">⏱️</span>
            <span>Veto window: {proposal.timeRemaining}</span>
          </div>
        )}
        {proposal.executionState === ExecutionState.AwaitingHumanApproval && (
          <div className="awaiting-approval-notice">
            <span className="approval-icon">✋</span>
            <strong>AWAITING HUMAN APPROVAL</strong>
          </div>
        )}
      </div>

      {/* Description Section */}
      <div className="description-section">
        <h3>Description</h3>
        <p>{proposal.description}</p>
        <div className="proposal-meta">
          <span className="meta-item">
            <strong>Proposer:</strong> {proposal.proposer.substring(0, 20)}...
          </span>
          <span className="meta-item">
            <strong>Deadline:</strong> {proposal.timeRemaining}
            {proposal.isUrgent && <span className="urgent-badge">URGENT</span>}
          </span>
          <span className="meta-item">
            <strong>Execution:</strong> {executionLabel}
          </span>
        </div>
      </div>

      {/* Context Chain Section */}
      {context && (context.parentProposals.length > 0 || context.relatedProposals.length > 0 || context.strategicObjective) && (
        <div className="context-section">
          <h3>Context Chain</h3>
          {context.parentProposals.length > 0 && (
            <div className="context-group">
              <h4>Parent DAO Decisions</h4>
              <ul className="context-list">
                {context.parentProposals.map((p) => (
                  <li key={p.id}>
                    <span className="context-kind">{governanceService.getKindLabel(p.kind)}</span>
                    <span className="context-desc">{p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {context.relatedProposals.length > 0 && (
            <div className="context-group">
              <h4>Related Proposals</h4>
              <ul className="context-list">
                {context.relatedProposals.map((p) => (
                  <li key={p.id}>
                    <span className="context-kind">{governanceService.getKindLabel(p.kind)}</span>
                    <span className="context-desc">{p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {context.strategicObjective && (
            <div className="context-group">
              <h4>Strategic Objective</h4>
              <p className="strategic-objective">{context.strategicObjective}</p>
            </div>
          )}
        </div>
      )}

      {/* Coalition Status Section */}
      {coalition && (
        <div className="coalition-section">
          <h3>Coalition Approval</h3>
          <p className="coalition-requirement">
            {coalition.allPartiesRequired
              ? 'All parties must approve'
              : 'Majority of parties must approve'}
          </p>
          <div className="coalition-parties">
            {coalition.requiredParties.map((party) => {
              const approval = coalition.approvals[party];
              return (
                <div key={party} className={`party-status ${approval?.approved ? 'approved' : 'pending'}`}>
                  <span className="party-flag">{getPartyFlag(party)}</span>
                  <span className="party-name">{party}</span>
                  {approval?.approved ? (
                    <span className="party-check">✓</span>
                  ) : (
                    <span className="party-pending">...</span>
                  )}
                </div>
              );
            })}
          </div>
          {coalition.pendingParties.length > 0 && (
            <p className="awaiting-parties">
              Awaiting: {coalition.pendingParties.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Voting Section */}
      <div className="voting-section">
        <h3>Votes</h3>
        <div className="vote-visualization">
          <div className="vote-bar-large">
            <div className="vote-bar-fill approve" style={{ width: `${approvePercent}%` }}>
              {approvePercent > 15 && <span>{proposal.votesApprove}</span>}
            </div>
            <div className="vote-bar-fill reject" style={{ width: `${100 - approvePercent}%` }}>
              {(100 - approvePercent) > 15 && <span>{proposal.votesReject}</span>}
            </div>
          </div>
          <div className="vote-labels">
            <span className="approve-label">Approve: {proposal.votesApprove}</span>
            <span className="reject-label">Reject: {proposal.votesReject}</span>
          </div>
        </div>

        {votes.length > 0 && (
          <div className="votes-list">
            <h4>Individual Votes</h4>
            <ul>
              {votes.slice(0, 10).map((vote, idx) => (
                <li key={idx} className={`vote-item ${vote.voteType.toLowerCase()}`}>
                  <span className="voter">{vote.voter.substring(0, 16)}...</span>
                  <span className="vote-type">{vote.voteType}</span>
                  <span className="vote-weight">(weight: {vote.weight})</span>
                </li>
              ))}
              {votes.length > 10 && (
                <li className="more-votes">+ {votes.length - 10} more votes</li>
              )}
            </ul>
          </div>
        )}

        {proposal.myVote && (
          <div className="my-vote">
            <span>Your vote:</span>
            <span className={`my-vote-type ${proposal.myVote.toLowerCase()}`}>{proposal.myVote}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {proposal.status === ProposalStatus.InProgress && onVote && (
        <div className="action-buttons">
          <button
            className="action-button vote-button"
            onClick={() => onVote(proposal)}
          >
            Cast Vote
          </button>
        </div>
      )}
    </div>
  );
}

// Helper function for party flags
function getPartyFlag(party: string): string {
  const flags: Record<string, string> = {
    USA: '🇺🇸',
    GBR: '🇬🇧',
    CAN: '🇨🇦',
    AUS: '🇦🇺',
    NZL: '🇳🇿',
    FRA: '🇫🇷',
    DEU: '🇩🇪',
  };
  return flags[party] || '🏳️';
}
