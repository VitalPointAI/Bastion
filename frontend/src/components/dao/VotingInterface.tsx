/**
 * VotingInterface Component
 *
 * Comprehensive voting UI with coalition support, human approval, and veto.
 * Commander-focused: clear actions with confirmation for critical decisions.
 */

import { useState } from 'react';
import type { Proposal, CoalitionStatus } from '../../types/dao';
import { VoteType, ExecutionState, ProposalKind } from '../../types/dao';
import './VotingInterface.css';

interface VotingInterfaceProps {
  proposal: Proposal;
  coalitionStatus?: CoalitionStatus | null;
  userParty?: string; // For coalition approval
  canVeto?: boolean;
  onVote: (voteType: VoteType) => Promise<void>;
  onVeto?: () => Promise<void>;
  onHumanApproval?: () => Promise<void>;
  onCoalitionApproval?: (party: string) => Promise<void>;
}

export function VotingInterface({
  proposal,
  coalitionStatus,
  userParty,
  canVeto = false,
  onVote,
  onVeto,
  onHumanApproval,
  onCoalitionApproval,
}: VotingInterfaceProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isStrike = proposal.kind === ProposalKind.StrikeAuthorization;

  // Calculate vote visualization
  const totalVotes = proposal.votesApprove + proposal.votesReject;
  const approvePercent = totalVotes > 0 ? (proposal.votesApprove / totalVotes) * 100 : 50;

  const handleVote = async (voteType: VoteType) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onVote(voteType);
      setSuccess(`Vote "${voteType}" submitted successfully`);
      setShowConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVeto = async () => {
    if (!onVeto) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onVeto();
      setSuccess('Veto submitted successfully');
      setShowConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit veto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHumanApproval = async () => {
    if (!onHumanApproval) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onHumanApproval();
      setSuccess('Human approval submitted successfully');
      setShowConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCoalitionApproval = async (party: string) => {
    if (!onCoalitionApproval) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await onCoalitionApproval(party);
      setSuccess(`Coalition approval for ${party} submitted successfully`);
      setShowConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit coalition approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="voting-interface">
      {/* Vote Tally Visualization */}
      <div className="vote-tally">
        <h4>Current Vote Tally</h4>
        <div className="vote-bar-container">
          <div className="vote-bar-large">
            <div
              className="vote-bar-fill approve"
              style={{ width: `${approvePercent}%` }}
            >
              {approvePercent >= 20 && (
                <span className="vote-count">{proposal.votesApprove}</span>
              )}
            </div>
            <div
              className="vote-bar-fill reject"
              style={{ width: `${100 - approvePercent}%` }}
            >
              {(100 - approvePercent) >= 20 && (
                <span className="vote-count">{proposal.votesReject}</span>
              )}
            </div>
          </div>
          <div className="vote-labels">
            <span className="approve">Approve: {proposal.votesApprove}</span>
            <span className="reject">Reject: {proposal.votesReject}</span>
          </div>
        </div>
      </div>

      {/* My Vote Status */}
      {proposal.myVote && (
        <div className="my-vote-status">
          <span className="label">Your vote:</span>
          <span className={`vote-type ${proposal.myVote.toLowerCase()}`}>
            {proposal.myVote}
          </span>
        </div>
      )}

      {/* Vote Buttons */}
      {!proposal.myVote && proposal.status === 'InProgress' && (
        <div className="vote-buttons">
          <h4>Cast Your Vote</h4>
          <div className="vote-actions">
            <button
              className="vote-btn approve"
              onClick={() => handleVote(VoteType.Approve)}
              disabled={isSubmitting}
            >
              Approve
            </button>
            <button
              className="vote-btn reject"
              onClick={() => handleVote(VoteType.Reject)}
              disabled={isSubmitting}
            >
              Reject
            </button>
            <button
              className="vote-btn abstain"
              onClick={() => handleVote(VoteType.Abstain)}
              disabled={isSubmitting}
            >
              Abstain
            </button>
          </div>
        </div>
      )}

      {/* Coalition Approval Section */}
      {coalitionStatus && userParty && onCoalitionApproval && (
        <div className="coalition-approval-section">
          <h4>Coalition Approval</h4>
          <p className="coalition-info">
            You are authorized to approve as <strong>{userParty}</strong>
          </p>
          <div className="coalition-parties-status">
            {coalitionStatus.requiredParties.map((party) => {
              const approval = coalitionStatus.approvals[party];
              const isMyParty = party === userParty;
              return (
                <div key={party} className={`party-row ${approval?.approved ? 'approved' : 'pending'}`}>
                  <span className="party-name">{party}</span>
                  {approval?.approved ? (
                    <span className="party-status approved">Approved</span>
                  ) : (
                    <span className="party-status pending">Pending</span>
                  )}
                  {isMyParty && !approval?.approved && (
                    <button
                      className="approve-party-btn"
                      onClick={() => handleCoalitionApproval(party)}
                      disabled={isSubmitting}
                    >
                      Approve as {party}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {coalitionStatus.pendingParties.length > 0 && (
            <p className="awaiting-text">
              Awaiting: {coalitionStatus.pendingParties.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Human Approval Section */}
      {proposal.executionState === ExecutionState.AwaitingHumanApproval && onHumanApproval && (
        <div className={`human-approval-section ${isStrike ? 'strike' : ''}`}>
          <h4>Human Approval Required</h4>
          {isStrike && (
            <div className="strike-warning">
              <span className="warning-icon">⚠️</span>
              <div className="warning-text">
                <strong>STRIKE AUTHORIZATION</strong>
                <p>This action authorizes the use of lethal force. Confirm only if you have proper authority.</p>
              </div>
            </div>
          )}
          {showConfirmation === 'approval' ? (
            <div className="confirmation-dialog">
              <p>
                {isStrike
                  ? 'Are you sure you want to authorize this strike? This action cannot be undone.'
                  : 'Are you sure you want to approve this proposal for execution?'}
              </p>
              <div className="confirmation-buttons">
                <button
                  className={`confirm-btn ${isStrike ? 'strike' : ''}`}
                  onClick={handleHumanApproval}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : isStrike ? 'AUTHORIZE STRIKE' : 'Confirm Approval'}
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => setShowConfirmation(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className={`authorize-btn ${isStrike ? 'strike' : ''}`}
              onClick={() => setShowConfirmation('approval')}
              disabled={isSubmitting}
            >
              {isStrike ? 'AUTHORIZE' : 'Submit Human Approval'}
            </button>
          )}
        </div>
      )}

      {/* Veto Section */}
      {proposal.executionState === ExecutionState.InVetoWindow && canVeto && onVeto && (
        <div className="veto-section">
          <h4>Veto Window Active</h4>
          <p className="veto-info">
            You have authority to veto this proposal. Time remaining: <strong>{proposal.timeRemaining}</strong>
          </p>
          {showConfirmation === 'veto' ? (
            <div className="confirmation-dialog">
              <p>Are you sure you want to veto this proposal? This action cannot be undone.</p>
              <div className="confirmation-buttons">
                <button
                  className="confirm-btn veto"
                  onClick={handleVeto}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Veto'}
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => setShowConfirmation(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="veto-btn"
              onClick={() => setShowConfirmation('veto')}
              disabled={isSubmitting}
            >
              VETO
            </button>
          )}
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="message error">
          <span className="icon">⚠️</span>
          {error}
        </div>
      )}
      {success && (
        <div className="message success">
          <span className="icon">✓</span>
          {success}
        </div>
      )}

      {/* Transaction Status */}
      {isSubmitting && (
        <div className="transaction-status">
          <div className="spinner" />
          <span>Processing transaction...</span>
        </div>
      )}
    </div>
  );
}
