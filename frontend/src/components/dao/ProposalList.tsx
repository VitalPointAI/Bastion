/**
 * ProposalList Component
 *
 * Displays a filtered list of proposals for a DAO.
 * Supports filtering by status and highlights action-required proposals.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Proposal } from '../../types/dao';
import { ProposalStatus } from '../../types/dao';
import { governanceService } from '../../lib/governance-service';
import { ProposalCard } from './ProposalCard';
import './ProposalList.css';

interface ProposalListProps {
  daoId: string;
  filter?: 'all' | 'active' | 'action-required' | 'my-votes';
  onSelectProposal: (proposal: Proposal) => void;
}

type FilterType = 'all' | 'active' | 'action-required' | 'my-votes';

export function ProposalList({ daoId, filter = 'all', onSelectProposal }: ProposalListProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(filter);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = activeFilter === 'active' ? ProposalStatus.InProgress : undefined;
      const data = await governanceService.listProposals(daoId, status);
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [daoId, activeFilter]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  // Filter proposals based on active filter
  const filteredProposals = proposals.filter((p) => {
    switch (activeFilter) {
      case 'action-required':
        return p.requiresMyAction;
      case 'active':
        return p.status === ProposalStatus.InProgress;
      case 'my-votes':
        return p.myVote !== undefined;
      default:
        return true;
    }
  });

  // Sort: action required first, then by deadline (soonest first)
  const sortedProposals = [...filteredProposals].sort((a, b) => {
    if (a.requiresMyAction && !b.requiresMyAction) return -1;
    if (!a.requiresMyAction && b.requiresMyAction) return 1;
    return a.votingDeadline - b.votingDeadline;
  });

  // Separate action-required proposals for top section
  const actionRequired = sortedProposals.filter((p) => p.requiresMyAction);
  const otherProposals = sortedProposals.filter((p) => !p.requiresMyAction);

  return (
    <div className="proposal-list">
      <div className="proposal-list-filters">
        <button
          className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-tab ${activeFilter === 'active' ? 'active' : ''}`}
          onClick={() => setActiveFilter('active')}
        >
          Active
        </button>
        <button
          className={`filter-tab ${activeFilter === 'action-required' ? 'active' : ''}`}
          onClick={() => setActiveFilter('action-required')}
        >
          Action Required
          {actionRequired.length > 0 && (
            <span className="filter-count">{actionRequired.length}</span>
          )}
        </button>
        <button
          className={`filter-tab ${activeFilter === 'my-votes' ? 'active' : ''}`}
          onClick={() => setActiveFilter('my-votes')}
        >
          My Votes
        </button>
      </div>

      {loading && (
        <div className="proposal-list-loading">
          <div className="loading-skeleton">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </div>
      )}

      {error && (
        <div className="proposal-list-error">
          <p>{error}</p>
          <button onClick={loadProposals}>Retry</button>
        </div>
      )}

      {!loading && !error && sortedProposals.length === 0 && (
        <div className="proposal-list-empty">
          <p>
            {activeFilter === 'action-required'
              ? 'No proposals require your action.'
              : activeFilter === 'active'
                ? 'No active proposals.'
                : activeFilter === 'my-votes'
                  ? 'You have not voted on any proposals.'
                  : 'No proposals found.'}
          </p>
        </div>
      )}

      {!loading && !error && sortedProposals.length > 0 && (
        <div className="proposal-list-content">
          {activeFilter !== 'action-required' && actionRequired.length > 0 && (
            <div className="action-required-section">
              <h3 className="section-header">Action Required</h3>
              <div className="proposal-cards">
                {actionRequired.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onClick={() => onSelectProposal(proposal)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeFilter === 'action-required' ? (
            <div className="proposal-cards">
              {sortedProposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onClick={() => onSelectProposal(proposal)}
                />
              ))}
            </div>
          ) : (
            otherProposals.length > 0 && (
              <div className="other-proposals-section">
                {actionRequired.length > 0 && <h3 className="section-header">Other Proposals</h3>}
                <div className="proposal-cards">
                  {otherProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onClick={() => onSelectProposal(proposal)}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
