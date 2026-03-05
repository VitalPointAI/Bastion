/**
 * EscalationPanel
 *
 * Commander-facing panel for escalating decisions to the parent workspace.
 * Supports urgency selection (urgent/standard), proposal kind selection,
 * and displays applicable escalation rules.
 *
 * Guards:
 * - Top-level workspace (no parent): shows informational message
 * - Non-commander/xo role: shows permission error
 */

import { useState, useEffect, useCallback } from 'react';
import { workspaceService, type EscalationRule } from '../../lib/workspace-service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EscalationPanelProps {
  workspaceId: string;
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

export function EscalationPanel({ workspaceId }: EscalationPanelProps) {
  const { activeWorkspace, userRoleInActive, memberships } = useWorkspace();
  const { userDID } = useUser();

  const [proposalKind, setProposalKind] = useState<string>('General');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'urgent' | 'standard'>('standard');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    escalationId: string;
    parentWorkspaceId: string;
    votingMechanism: string;
    status: string;
  } | null>(null);
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // ─── Derived ─────────────────────────────────────────────────────────────

  const isTopLevel = !activeWorkspace?.parentWorkspaceId;
  const isCommander = userRoleInActive
    ? COMMANDER_ROLES.includes(userRoleInActive)
    : false;

  // Resolve parent workspace name from memberships
  const parentWorkspaceName = activeWorkspace?.parentWorkspaceId
    ? (memberships.find((m) => m.workspaceId === activeWorkspace.parentWorkspaceId)?.name ?? 'Parent Workspace')
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
      const fetchedRules = await workspaceService.getEscalationRules(workspaceId, userDID);
      setRules(fetchedRules);
    } catch {
      // Non-fatal — workspace may have no rules
    } finally {
      setLoadingRules(false);
    }
  }, [workspaceId, userDID]);

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
      const res = await workspaceService.escalateDecision(
        workspaceId,
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
          <p className="font-medium text-gray-300 mb-1">Top-level workspace</p>
          <p>This is a top-level workspace. Decisions cannot be escalated further.</p>
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
          <span className="text-gray-200 font-medium">{parentWorkspaceName}</span>
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
            <p>Sent to: <span className="font-medium text-green-300">{parentWorkspaceName}</span></p>
          </div>
          <button
            className="mt-2 text-xs text-green-400 hover:text-green-300 underline"
            onClick={() => setResult(null)}
          >
            Submit another escalation
          </button>
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
              : `Escalate to ${parentWorkspaceName ?? 'Parent Workspace'}`
            }
          </button>

        </form>
      )}

    </div>
  );
}
