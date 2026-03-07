/**
 * EscalationPanel
 *
 * Commander-facing panel for escalating decisions to the parent problemSet.
 * Supports urgency selection (urgent/standard), proposal kind selection,
 * and displays applicable escalation rules.
 *
 * Guards:
 * - Top-level problem set (no parent): shows informational message
 * - Non-commander/xo role: shows permission error
 */

import { useState, useEffect, useCallback } from 'react';
import { problemSetService, type EscalationRule } from '../../lib/problem-set-service';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { useDecisionGates } from '../../context/DecisionGateContext';
import type { DecisionGate } from '../../lib/gate-service';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EscalationPanelProps {
  problemSetId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPOSAL_KINDS = [
  'ResourceAllocation',
  'PolicyChange',
  'ROEModification',
  'OperationalOrder',
  'General',
];

const COMMANDER_ROLES = ['commander', 'xo', 'Commander', 'XO'];

// ─── EscalationPanel ──────────────────────────────────────────────────────────

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

export function EscalationPanel({ problemSetId }: EscalationPanelProps) {
  const { activeProblemSet, userRoleInActive, memberships } = useProblemSet();
  const { userDID } = useUser();
  const { escalatedGates, approveGate, rejectGate } = useDecisionGates();

  const [proposalKind, setProposalKind] = useState<string>('General');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'urgent' | 'standard'>('standard');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    escalationId: string;
    parentProblemSetId: string;
    votingMechanism: string;
    status: string;
  } | null>(null);
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const isTopLevel = !activeProblemSet?.parentProblemSetId;
  const isCommander = userRoleInActive
    ? COMMANDER_ROLES.includes(userRoleInActive)
    : false;

  // Resolve parent problem set name from memberships
  const parentProblemSetName = activeProblemSet?.parentProblemSetId
    ? (memberships.find((m) => m.problemSetId === activeProblemSet.parentProblemSetId)?.name ?? 'Parent Problem Set')
    : null;

  // Find matching rule for current proposal kind
  const matchingRule = rules.find(
    (r) => r.proposalKind === proposalKind && r.isActive
  );

  // ─── Load escalation rules ────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    if (!userDID) return;
    setLoadingRules(true);
    try {
      const fetchedRules = await problemSetService.getEscalationRules(problemSetId, userDID);
      setRules(fetchedRules);
    } catch {
      // Non-fatal — problem set may have no rules
    } finally {
      setLoadingRules(false);
    }
  }, [problemSetId, userDID]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  // ─── Submit handler ───────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDID) return;
    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await problemSetService.escalateDecision(
        problemSetId,
        { proposalKind, description: description.trim(), urgency },
        userDID
      );
      setResult(res);
      setDescription('');
      setProposalKind('General');
      setUrgency('standard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to escalate decision.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (isTopLevel) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-3">Escalation</h2>
        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 text-sm text-gray-400">
          <p className="font-medium text-gray-300 mb-1">Top-level problem set</p>
          <p>This is a top-level problemSet. Decisions cannot be escalated further.</p>
        </div>
      </div>
    );
  }

  if (!isCommander) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-3">Escalation</h2>
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 text-sm text-yellow-300">
          <p className="font-medium mb-1">Access restricted</p>
          <p>Only commanders and XOs can escalate decisions.</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-gray-100">Escalation</h2>
        <p className="text-sm text-gray-400 mt-1">
          Escalate a decision to{' '}
          <span className="text-gray-200 font-medium">{parentProblemSetName}</span>
          {' '}for resolution.
        </p>
      </div>

      {/* Success state */}
      {result && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-green-300">Decision escalated successfully</p>
          <div className="text-xs text-green-400 space-y-1">
            <p>Escalation ID: <span className="font-mono text-green-300">{result.escalationId}</span></p>
            <p>Voting mechanism: <span className="font-medium text-green-300 capitalize">{result.votingMechanism}</span></p>
            <p>Status: <span className="font-medium text-green-300 capitalize">{result.status}</span></p>
            <p>Sent to: <span className="font-medium text-green-300">{parentProblemSetName}</span></p>
          </div>
          <button
            className="mt-2 text-xs text-green-400 hover:text-green-300 underline"
            onClick={() => setResult(null)}
          >
            Submit another escalation
          </button>
        </div>
      )}

      {/* Gate Escalations Section */}
      {escalatedGates.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">
            Gate Escalations from Child Problem Sets ({escalatedGates.length})
          </h3>
          <div className="space-y-3">
            {escalatedGates.map((gate: DecisionGate) => (
              <GateEscalationCard
                key={gate.id}
                gate={gate}
                isCommander={isCommander}
                onApprove={approveGate}
                onReject={rejectGate}
              />
            ))}
          </div>
        </div>
      )}

      {!result && (
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">

          {/* Proposal kind */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Proposal Kind
            </label>
            {!loadingRules && rules.length > 0 ? (
              <select
                value={proposalKind}
                onChange={(e) => setProposalKind(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              >
                {PROPOSAL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
            ) : (
              <select
                value={proposalKind}
                onChange={(e) => setProposalKind(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              >
                {PROPOSAL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
            )}
          </div>

          {/* Matching rule indicator */}
          {matchingRule && (
            <div className="bg-blue-900/20 border border-blue-700/40 rounded p-3 text-xs text-blue-300">
              <span className="font-medium">Active rule:</span>{' '}
              {proposalKind} escalations use{' '}
              <span className="font-medium capitalize">{matchingRule.votingMechanism}</span>{' '}
              voting.
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
              <span className="text-gray-500 font-normal ml-2">(min 10 characters)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the decision that needs to be escalated..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              minLength={10}
              required
            />
            <p className="text-xs text-gray-500 mt-1">{description.length} characters</p>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Urgency
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="urgency"
                  value="standard"
                  checked={urgency === 'standard'}
                  onChange={() => setUrgency('standard')}
                  className="mt-0.5 text-blue-500"
                />
                <div>
                  <p className="text-sm text-gray-200 font-medium group-hover:text-white">
                    Standard
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Council vote — 7-day deliberation window
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="urgency"
                  value="urgent"
                  checked={urgency === 'urgent'}
                  onChange={() => setUrgency('urgent')}
                  className="mt-0.5 text-orange-500"
                />
                <div>
                  <p className="text-sm text-gray-200 font-medium group-hover:text-white">
                    Urgent
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Commander decision — 1-hour resolution window
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || description.trim().length < 10}
            className="w-full px-4 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            {submitting
              ? 'Escalating...'
              : `Escalate to ${parentProblemSetName ?? 'Parent Problem Set'}`
            }
          </button>

        </form>
      )}

    </div>
  );
}

// ─── GateEscalationCard ─────────────────────────────────────────────────────

interface GateEscalationCardProps {
  gate: DecisionGate;
  isCommander: boolean;
  onApprove: (gateId: string) => Promise<void>;
  onReject: (gateId: string, reason: string) => Promise<void>;
}

function GateEscalationCard({ gate, isCommander, onApprove, onReject }: GateEscalationCardProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const ctx = gate.decision_context || {};
  const escalatedFromTab = (ctx.escalatedFromTab as string) || gate.tab;
  const escalationReason = (ctx.escalation_reason as string) || 'No reason provided';
  const escalatedAt = (ctx.escalated_at as string) || gate.updated_at;

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await onApprove(gate.id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await onReject(gate.id, rejectReason.trim());
      setRejecting(false);
      setRejectReason('');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-100">
            {gate.target_item_title || `Gate: ${gate.id.slice(0, 8)}`}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <span className="bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded">
              {formatGateType(gate.gate_type)}
            </span>
            <span>Source: {gate.problem_set_id.slice(0, 8)}...</span>
            <span>Tab: {escalatedFromTab}</span>
            {escalatedAt && <span>{formatRelativeTime(escalatedAt)}</span>}
          </div>
        </div>
        <span className="text-xs bg-purple-800/50 text-purple-300 px-2 py-1 rounded">
          Escalated
        </span>
      </div>

      <p className="text-xs text-gray-400">
        <span className="text-gray-300 font-medium">Reason:</span> {escalationReason}
      </p>

      {isCommander && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-600">
          <button
            className="px-3 py-1.5 text-xs bg-green-700 hover:bg-green-600 text-white rounded disabled:opacity-50"
            onClick={() => { void handleApprove(); }}
            disabled={actionLoading}
          >
            {actionLoading ? '...' : 'Approve'}
          </button>
          {!rejecting ? (
            <button
              className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded disabled:opacity-50"
              onClick={() => setRejecting(true)}
              disabled={actionLoading}
            >
              Reject
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <input
                className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-400"
                type="text"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleRejectConfirm();
                  if (e.key === 'Escape') { setRejecting(false); setRejectReason(''); }
                }}
                autoFocus
              />
              <button
                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
                onClick={() => { void handleRejectConfirm(); }}
                disabled={!rejectReason.trim() || actionLoading}
              >
                Confirm
              </button>
              <button
                className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                onClick={() => { setRejecting(false); setRejectReason(''); }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
