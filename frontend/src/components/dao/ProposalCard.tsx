/**
 * ProposalCard Component
 *
 * Compact card for displaying a proposal in a list view.
 * Shows key info: kind, status, autonomy, deadline, votes, action required.
 */

import type { Proposal } from '../../types/dao';
import { AutonomyLevel, ProposalKind } from '../../types/dao';
import { governanceService } from '../../lib/governance-service';
import './ProposalCard.css';

interface ProposalCardProps {
  proposal: Proposal;
  onClick: () => void;
}

export function ProposalCard({ proposal, onClick }: ProposalCardProps) {
  const kindLabel = governanceService.getKindLabel(proposal.kind);
  const statusLabel = governanceService.getStatusLabel(proposal.status);
  const autonomyLabel = governanceService.getAutonomyLabel(proposal.effectiveAutonomy);

  // Determine kind styling
  const isStrike = proposal.kind === ProposalKind.StrikeAuthorization;
  const isMission = proposal.kind === ProposalKind.MissionOrder;

  // Calculate vote percentages
  const totalVotes = proposal.votesApprove + proposal.votesReject;
  const approvePercent = totalVotes > 0 ? (proposal.votesApprove / totalVotes) * 100 : 0;

  return (
    <div
      className={`proposal-card ${proposal.requiresMyAction ? 'action-required' : ''} ${proposal.isUrgent ? 'urgent' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="proposal-card-header">
        <span className={`proposal-kind-badge ${isStrike ? 'strike' : ''} ${isMission ? 'mission' : ''}`}>
          {kindLabel}
        </span>
        <span className={`proposal-status-badge status-${proposal.status.toLowerCase()}`}>
          {statusLabel}
        </span>
      </div>

      <div className="proposal-card-body">
        <p className="proposal-description">{proposal.description}</p>

        <div className="proposal-meta">
          <div className="proposal-autonomy">
            <span className={`autonomy-indicator ${proposal.effectiveAutonomy.toLowerCase()}`}>
              {proposal.effectiveAutonomy === AutonomyLevel.Autonomous ? '🤖' : '👤'}
            </span>
            <span className="autonomy-label">{autonomyLabel}</span>
          </div>

          <div className="proposal-deadline">
            {proposal.isUrgent && <span className="urgent-badge">URGENT</span>}
            <span className="time-remaining">{proposal.timeRemaining}</span>
          </div>
        </div>
      </div>

      <div className="proposal-card-footer">
        <div className="vote-bar">
          <div className="vote-bar-fill approve" style={{ width: `${approvePercent}%` }} />
          <div className="vote-bar-fill reject" style={{ width: `${100 - approvePercent}%` }} />
        </div>
        <div className="vote-counts">
          <span className="approve-count">✓ {proposal.votesApprove}</span>
          <span className="reject-count">✗ {proposal.votesReject}</span>
        </div>
      </div>

      {proposal.requiresMyAction && (
        <div className="action-required-badge">ACTION REQUIRED</div>
      )}
    </div>
  );
}
