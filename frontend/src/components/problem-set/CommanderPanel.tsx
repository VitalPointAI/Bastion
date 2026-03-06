/**
 * CommanderPanel
 *
 * Commander/XO-specific problem set panel.
 * Shows command overview, pending invite approvals, and quick actions.
 * Activity is handled by the dashboard-level ActivityFeed.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  problemSetService,
  type ProblemSetInviteDetail,
  type HierarchyNode,
} from '../../lib/problem-set-service';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { CreateProblemSetWizard } from './CreateProblemSetWizard';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommanderPanelProps {
  problemSetId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── CommanderPanel ───────────────────────────────────────────────────────────

export function CommanderPanel({ problemSetId }: CommanderPanelProps) {
  const navigate = useNavigate();
  const { activeProblemSet } = useProblemSet();
  const { userDID } = useUser();

  const [pendingInvites, setPendingInvites] = useState<ProblemSetInviteDetail[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadInvites = useCallback(async () => {
    if (!userDID) return;
    setLoadingInvites(true);
    try {
      const invites = await problemSetService.listPendingInvites(problemSetId, userDID);
      setPendingInvites(invites);
    } catch {
      // Non-fatal — may not have permission
    } finally {
      setLoadingInvites(false);
    }
  }, [problemSetId, userDID]);

  const loadHierarchy = useCallback(async () => {
    if (!userDID) return;
    setLoadingHierarchy(true);
    try {
      const tree = await problemSetService.getHierarchy(problemSetId, userDID);
      setHierarchy(tree);
    } catch {
      // Non-fatal
    } finally {
      setLoadingHierarchy(false);
    }
  }, [problemSetId, userDID]);

  useEffect(() => {
    void loadInvites();
    void loadHierarchy();
  }, [loadInvites, loadHierarchy]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleApprove = async (inviteId: string) => {
    if (!userDID) return;
    setApprovingId(inviteId);
    setActionError(null);
    try {
      await problemSetService.approveInvite(problemSetId, inviteId, userDID);
      await loadInvites();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve invite');
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancel = async (inviteId: string) => {
    if (!userDID) return;
    setCancellingId(inviteId);
    setActionError(null);
    try {
      await problemSetService.cancelInvite(problemSetId, inviteId, userDID);
      await loadInvites();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel invite');
    } finally {
      setCancellingId(null);
    }
  };

  // ─── Derived ────────────────────────────────────────────────────────────────

  const childCount = hierarchy.reduce((sum, node) => {
    return sum + (node.id === problemSetId ? (node.children?.length ?? 0) : 0);
  }, 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Command Overview */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-blue-400">&#9650;</span>
          Command Overview
        </h3>

        {activeProblemSet ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-white">{activeProblemSet.name}</p>
                <p className="text-sm text-gray-400">{activeProblemSet.echelon}</p>
              </div>
              <span
                className={`text-xs font-mono px-2 py-1 rounded border ${classificationColor(activeProblemSet.classification)}`}
              >
                {activeProblemSet.classification}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-gray-700 rounded p-3 text-center">
                <p className="text-2xl font-bold text-white">{activeProblemSet.memberCount}</p>
                <p className="text-xs text-gray-400 mt-1">Members</p>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <p className="text-2xl font-bold text-white">
                  {loadingHierarchy ? '...' : childCount}
                </p>
                <p className="text-xs text-gray-400 mt-1">Sub-Problem Sets</p>
              </div>
            </div>

            {activeProblemSet.description && (
              <p className="text-sm text-gray-400 pt-1">{activeProblemSet.description}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading problem set details...</p>
        )}
      </div>

      {/* Pending Decisions */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-yellow-400">&#9654;</span>
          Pending Decisions
        </h3>

        {actionError && (
          <div className="mb-3 px-3 py-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">
            {actionError}
          </div>
        )}

        {loadingInvites ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : pendingInvites.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No pending approvals.</p>
        ) : (
          <ul className="space-y-3">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 bg-gray-700 rounded p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {invite.inviteeDid
                      ? invite.inviteeDid.replace('did:near:', '')
                      : invite.inviteeEmail ?? 'Open invite'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Role: {invite.role} &middot; Expires {timeAgo(invite.expiresAt)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="text-xs px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
                    onClick={() => handleApprove(invite.id)}
                    disabled={approvingId === invite.id}
                  >
                    {approvingId === invite.id ? '...' : 'Approve'}
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-gray-200 disabled:opacity-50"
                    onClick={() => handleCancel(invite.id)}
                    disabled={cancellingId === invite.id}
                  >
                    {cancellingId === invite.id ? '...' : 'Cancel'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
          <span className="text-purple-400">&#9654;</span>
          Quick Actions
        </h3>

        <div className="grid grid-cols-1 gap-2">
          <button
            className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
            onClick={() => navigate(`/problem-set/${problemSetId}/members`)}
          >
            <span className="text-blue-400 w-5 text-center">&#128101;</span>
            View Members
          </button>
          <button
            className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
            onClick={() => navigate(`/problem-set/${problemSetId}/invite`)}
          >
            <span className="text-green-400 w-5 text-center">&#43;</span>
            Invite Member
          </button>
          <button
            className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
            onClick={() => setShowCreateWizard(true)}
          >
            <span className="text-yellow-400 w-5 text-center">&#9651;</span>
            Create Sub-Problem Set
          </button>
        </div>
      </div>

      {/* Create Sub-Problem Set modal */}
      {showCreateWizard && (
        <CreateProblemSetWizard
          parentProblemSetId={problemSetId}
          onClose={() => setShowCreateWizard(false)}
          onCreated={(_id, _options?) => {
            setShowCreateWizard(false);
            void loadHierarchy();
          }}
        />
      )}

    </div>
  );
}
