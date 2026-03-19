/**
 * DecisionDashboard
 *
 * Shows status summary cards (pending/approved/rejected/deferred/info_requested)
 * and a filterable list of decision cards with inline action buttons.
 *
 * Phase 53 Plan 05.
 */

import { useState } from 'react';
import type { Decision, DecisionSummary, ActOnDecisionParams, DecisionAuditTrail, DAOVote } from '../../lib/decision-service.js';
import { decisionApiService } from '../../lib/decision-service.js';
import { PendingDecisionModal } from './PendingDecisionModal.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeSince(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${diffDays}d ago`;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  pending: {
    label: 'Pending',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  approved: {
    label: 'Approved',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rejected: {
    label: 'Rejected',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deferred: {
    label: 'Deferred',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  info_requested: {
    label: 'Info Req.',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryCardProps {
  status: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function SummaryCard({ status, count, isActive, onClick }: SummaryCardProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: '#94a3b8',
    bgColor: 'rgba(148,163,184,0.1)',
    borderColor: 'rgba(148,163,184,0.3)',
  };

  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: '100px',
        padding: '0.875rem 1rem',
        background: isActive ? cfg.bgColor : 'var(--surface-secondary, #1e293b)',
        border: `1px solid ${isActive ? cfg.color : 'var(--border-color, #334155)'}`,
        borderRadius: '0.5rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: cfg.color, lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.25rem' }}>
        {cfg.label}
      </div>
    </button>
  );
}

interface DecisionCardProps {
  decision: Decision;
  problemSetId: string;
  onAction: (decision: Decision, action: ActOnDecisionParams['action']) => void;
}

function VoteRecord({ votes }: { votes: DAOVote[] }) {
  if (votes.length === 0) {
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic' }}>
        No votes recorded yet.
      </div>
    );
  }

  const VOTE_COLOR: Record<string, string> = {
    Approve: '#10b981',
    Reject: '#ef4444',
    Abstain: '#94a3b8',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {votes.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem' }}>
          <span style={{
            color: VOTE_COLOR[v.vote_type] ?? '#94a3b8',
            fontWeight: 600,
            minWidth: '50px',
          }}>
            {v.vote_type}
          </span>
          <span style={{ color: 'var(--text-secondary, #94a3b8)', fontFamily: 'monospace' }}>
            {v.voter.length > 20 ? `${v.voter.substring(0, 8)}…${v.voter.substring(v.voter.length - 6)}` : v.voter}
          </span>
        </div>
      ))}
    </div>
  );
}

function DecisionCard({ decision, problemSetId, onAction }: DecisionCardProps) {
  const statusCfg = STATUS_CONFIG[decision.status] ?? STATUS_CONFIG['pending'];
  const isPending = decision.status === 'pending';
  const isDecided = ['approved', 'rejected', 'deferred'].includes(decision.status);
  const hasOnChain = decision.dao_proposal_id != null;

  const [showAudit, setShowAudit] = useState(false);
  const [auditTrail, setAuditTrail] = useState<DecisionAuditTrail | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  async function handleToggleAudit() {
    if (showAudit) {
      setShowAudit(false);
      return;
    }
    setShowAudit(true);
    if (auditTrail) return; // already loaded

    setAuditLoading(true);
    setAuditError(null);
    try {
      const trail = await decisionApiService.getAuditTrail(problemSetId, decision.id);
      setAuditTrail(trail);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: '0.875rem 1rem',
        background: 'var(--surface-secondary, #1e293b)',
        border: '1px solid var(--border-color, #334155)',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #e2e8f0)' }}>
            {decision.title}
          </div>
          {decision.description && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginTop: '0.125rem' }}>
              {decision.description}
            </div>
          )}
        </div>
        {/* Badges row: status + on-chain */}
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexShrink: 0 }}>
          {/* On-chain badge (decided decisions with dao_proposal_id) */}
          {isDecided && hasOnChain && (
            <button
              onClick={handleToggleAudit}
              title="View on-chain audit trail"
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: '#7c3aed',
                background: 'rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.35)',
                borderRadius: '9999px',
                padding: '0.125rem 0.5rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              On-Chain #{decision.dao_proposal_id}
            </button>
          )}
          {/* Pending: show "Awaiting on-chain recording" if no proposal yet */}
          {isPending && !hasOnChain && (
            <span
              title="DAO proposal is being recorded on-chain"
              style={{
                fontSize: '0.65rem',
                color: '#94a3b8',
                background: 'rgba(148, 163, 184, 0.08)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '9999px',
                padding: '0.125rem 0.5rem',
                whiteSpace: 'nowrap',
              }}
            >
              Awaiting on-chain
            </span>
          )}
          {/* Status badge */}
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: statusCfg.color,
              background: statusCfg.bgColor,
              border: `1px solid ${statusCfg.borderColor}`,
              borderRadius: '9999px',
              padding: '0.125rem 0.5rem',
              whiteSpace: 'nowrap',
            }}
          >
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
          {decision.decision_type.replace(/_/g, ' ')}
        </span>
        {decision.requested_by && (
          <span>by {decision.requested_by}</span>
        )}
        <span>{formatTimeSince(decision.created_at)}</span>
      </div>

      {/* On-chain audit trail (expanded) */}
      {showAudit && (
        <div
          style={{
            marginTop: '0.25rem',
            padding: '0.625rem 0.75rem',
            background: 'rgba(124, 58, 237, 0.05)',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            borderRadius: '0.375rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7c3aed' }}>
            On-Chain Audit Trail
          </div>
          {auditLoading && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Loading...</div>
          )}
          {auditError && (
            <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>{auditError}</div>
          )}
          {auditTrail && !auditLoading && (
            <>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                <span>Proposal ID: <strong style={{ color: '#7c3aed' }}>#{auditTrail.daoProposal?.id ?? decision.dao_proposal_id}</strong></span>
                {auditTrail.daoProposal && (
                  <span>Status: <strong>{auditTrail.daoProposal.status}</strong></span>
                )}
                <span style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.7)' }}>
                  [encrypted on-chain]
                </span>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Voting Record
                </div>
                <VoteRecord votes={auditTrail.votes} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Action buttons — only for pending decisions */}
      {isPending && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <button
            onClick={() => onAction(decision, 'approve')}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Approve
          </button>
          <button
            onClick={() => onAction(decision, 'reject')}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
          <button
            onClick={() => onAction(decision, 'defer')}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(148, 163, 184, 0.15)',
              color: '#94a3b8',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Defer
          </button>
          <button
            onClick={() => onAction(decision, 'info')}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(96, 165, 250, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(96, 165, 250, 0.3)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Need Info
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DecisionDashboard ────────────────────────────────────────────────────────

interface DecisionDashboardProps {
  decisions: Decision[];
  summary: DecisionSummary | null;
  loading: boolean;
  error: string | null;
  problemSetId: string;
  onActOnDecision: (decisionId: string, params: ActOnDecisionParams) => Promise<void>;
  onFilterChange: (filters: { status?: string; decision_type?: string }) => void;
}

export function DecisionDashboard({
  decisions,
  summary,
  loading,
  error,
  problemSetId,
  onActOnDecision,
  onFilterChange,
}: DecisionDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [textSearch, setTextSearch] = useState('');
  const [modalDecision, setModalDecision] = useState<Decision | null>(null);
  const [modalAction, setModalAction] = useState<ActOnDecisionParams['action'] | null>(null);

  // Extract unique decision types from decisions list
  const decisionTypes = Array.from(new Set(decisions.map((d) => d.decision_type)));

  function handleStatusCardClick(status: string) {
    const newStatus = statusFilter === status ? '' : status;
    setStatusFilter(newStatus);
    onFilterChange({ status: newStatus || undefined, decision_type: typeFilter || undefined });
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setTypeFilter(val);
    onFilterChange({ status: statusFilter || undefined, decision_type: val || undefined });
  }

  function handleStatusDropdownChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setStatusFilter(val);
    onFilterChange({ status: val || undefined, decision_type: typeFilter || undefined });
  }

  function handleActionClick(decision: Decision, action: ActOnDecisionParams['action']) {
    setModalDecision(decision);
    setModalAction(action);
  }

  async function handleModalConfirm(comment?: string) {
    if (!modalDecision || !modalAction) return;
    await onActOnDecision(modalDecision.id, { action: modalAction, comment });
    setModalDecision(null);
    setModalAction(null);
  }

  function handleModalClose() {
    setModalDecision(null);
    setModalAction(null);
  }

  // Filter decisions by text search (client-side)
  const filtered = decisions.filter((d) => {
    if (!textSearch) return true;
    const q = textSearch.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q) ||
      d.decision_type.toLowerCase().includes(q)
    );
  });

  const selectStyle: React.CSSProperties = {
    padding: '0.375rem 0.75rem',
    fontSize: '0.8rem',
    background: 'var(--surface-secondary, #1e293b)',
    color: 'var(--text-primary, #e2e8f0)',
    border: '1px solid var(--border-color, #334155)',
    borderRadius: '0.375rem',
    cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.375rem 0.75rem',
    fontSize: '0.8rem',
    background: 'var(--surface-secondary, #1e293b)',
    color: 'var(--text-primary, #e2e8f0)',
    border: '1px solid var(--border-color, #334155)',
    borderRadius: '0.375rem',
    outline: 'none',
    minWidth: '160px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Status summary cards */}
      {summary && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(['pending', 'approved', 'rejected', 'deferred', 'info_requested'] as const).map((s) => (
            <SummaryCard
              key={s}
              status={s}
              count={summary[s]}
              isActive={statusFilter === s}
              onClick={() => handleStatusCardClick(s)}
            />
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={inputStyle}
          placeholder="Search decisions..."
          value={textSearch}
          onChange={(e) => setTextSearch(e.target.value)}
        />
        <select style={selectStyle} value={statusFilter} onChange={handleStatusDropdownChange}>
          <option value="">All statuses</option>
          {(['pending', 'approved', 'rejected', 'deferred', 'info_requested'] as const).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
          ))}
        </select>
        {decisionTypes.length > 0 && (
          <select style={selectStyle} value={typeFilter} onChange={handleTypeChange}>
            <option value="">All types</option>
            {decisionTypes.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        )}
      </div>

      {/* Decision list */}
      {loading ? (
        <div style={{ color: 'var(--text-secondary, #94a3b8)', padding: '2rem', textAlign: 'center' }}>
          Loading decisions...
        </div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-secondary, #94a3b8)', padding: '2rem', textAlign: 'center', fontSize: '0.875rem' }}>
          No decisions found.
          {(statusFilter || typeFilter || textSearch) && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              Try clearing the filters.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              problemSetId={problemSetId}
              onAction={handleActionClick}
            />
          ))}
        </div>
      )}

      {/* Action modal */}
      {modalDecision && modalAction && (
        <PendingDecisionModal
          decision={modalDecision}
          initialAction={modalAction}
          onConfirm={handleModalConfirm}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
