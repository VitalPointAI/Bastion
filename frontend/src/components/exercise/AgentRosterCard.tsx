/**
 * AgentRosterCard
 *
 * Phase 16 Plan 04: Initial workspace state card shown when an AI role is assigned
 * but agents haven't started yet (or after a run completes/fails).
 *
 * Displays the agent team roster (rank, name, branch, focus) with a Begin button
 * that triggers POST /runs. Begin is disabled in read-only observer mode.
 */

import type { StaffAgentDef } from '../../types/exercise';
import { STAFF_ROLE_CONFIG } from '../../types/exercise';
import './AgentRosterCard.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AgentRosterCardProps {
  roleKey: string;
  scenarioId: string;
  agents: StaffAgentDef[];
  onBegin: () => void;
  isBeginning: boolean;
  isReadOnly?: boolean;
}

// ─── Rank sort priority ───────────────────────────────────────────────────────

/**
 * Higher number = higher priority (shown first).
 * Covers common US military officer/warrant/enlisted prefixes.
 */
function rankSortPriority(rank: string): number {
  const r = rank.toUpperCase();
  if (r.startsWith('O-6') || r === 'COL' || r === 'CAPT' || r.includes('COLONEL')) return 60;
  if (r.startsWith('O-5') || r === 'LTC' || r === 'CDR' || r.includes('LIEUTENANT COLONEL')) return 50;
  if (r.startsWith('O-4') || r === 'MAJ' || r === 'LCDR' || r.includes('MAJOR')) return 40;
  if (r.startsWith('O-3') || r === 'CPT' || r === 'CAPT' || r.includes('CAPTAIN')) return 30;
  if (r.startsWith('CW') || r.startsWith('W')) return 25;
  if (r.startsWith('E')) return 10;
  return 20; // unknown / warrant
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentRosterCard({
  roleKey,
  scenarioId: _scenarioId,
  agents,
  onBegin,
  isBeginning,
  isReadOnly,
}: AgentRosterCardProps) {
  const roleEntry = STAFF_ROLE_CONFIG[roleKey];
  const roleLabel = roleEntry?.label ?? roleKey;

  // Sort agents by rank priority descending (senior first)
  const sortedAgents = [...agents].sort(
    (a, b) => rankSortPriority(b.rank) - rankSortPriority(a.rank)
  );

  const isDisabled = isBeginning || agents.length === 0 || isReadOnly;

  return (
    <div className="agent-roster-card">
      {/* Header */}
      <div className="arc-header">
        <span className="arc-title">{roleLabel} Agent Team</span>
        <span className="arc-badge arc-badge-ai">AI</span>
      </div>

      {/* Agent list */}
      <div className="arc-agent-list">
        {agents.length === 0 ? (
          /* Empty / loading skeleton */
          <div className="arc-empty">
            <div className="arc-skeleton arc-skeleton-row" />
            <div className="arc-skeleton arc-skeleton-row arc-skeleton-row--short" />
            <div className="arc-skeleton arc-skeleton-row" />
            <span className="arc-empty-label">Loading agent team...</span>
          </div>
        ) : (
          sortedAgents.map((agent) => (
            <div key={agent.id} className="arc-agent-row">
              <div className="arc-agent-identity">
                <span className="arc-agent-rank-name">
                  {agent.rank} {agent.name}
                </span>
                <span className="arc-agent-branch">{agent.branch}</span>
              </div>
              <div className="arc-agent-focus" title={agent.focus}>
                {agent.focus.length > 80 ? agent.focus.slice(0, 77) + '...' : agent.focus}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="arc-footer">
        <button
          className={`arc-begin-btn${isReadOnly ? ' arc-begin-btn--readonly' : ''}`}
          onClick={onBegin}
          disabled={isDisabled}
          type="button"
          title={
            isReadOnly
              ? 'Observer access — only supervisors and commanders can begin'
              : isBeginning
              ? 'Starting agents...'
              : 'Begin agent team execution'
          }
        >
          {isBeginning ? (
            <>
              <span className="arc-spinner" aria-hidden="true" />
              Starting...
            </>
          ) : (
            'Begin'
          )}
        </button>
      </div>
    </div>
  );
}
