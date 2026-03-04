/**
 * CommanderPanel
 *
 * Commander/XO-specific workspace panel.
 * Shows command overview, pending invite approvals, quick actions, and recent activity.
 *
 * Phase 19 Plan 07: Role-adaptive dashboard panels.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  workspaceService,
  type WorkspaceActivityItem,
  type WorkspaceInviteDetail,
  type HierarchyNode,
} from '../../lib/workspace-service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommanderPanelProps {
  workspaceId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function formatActivityType(activityType: string): string {
  return activityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── CommanderPanel ───────────────────────────────────────────────────────────

export function CommanderPanel({ workspaceId }: CommanderPanelProps) {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();
  const { userDID } = useUser();

  const [activity, setActivity] = useState<WorkspaceActivityItem[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInviteDetail[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadActivity = useCallback(async () => {
    if (!userDID) return;
    setLoadingActivity(true);
    try {
      const items = await workspaceService.listActivity(workspaceId, userDID, { limit: 5 });
      setActivity(items);
    } catch {
      // Non-fatal
    } finally {
      setLoadingActivity(false);
    }
  }, [workspaceId, userDID]);

  const loadInvites = useCallback(async () => {
    if (!userDID) return;
    setLoadingInvites(true);
    try {
      const invites = await workspaceService.listPendingInvites(workspaceId, userDID);
      setPendingInvites(invites);
    } catch {
      // Non-fatal — may not have permission
    } finally {
      setLoadingInvites(false);
    }
  }, [workspaceId, userDID]);

  const loadHierarchy = useCallback(async () => {
    if (!userDID) return;
    setLoadingHierarchy(true);
    try {
      const tree = await workspaceService.getHierarchy(workspaceId, userDID);
      setHierarchy(tree);
    } catch {
      // Non-fatal
    } finally {
      setLoadingHierarchy(false);
    }
  }, [workspaceId, userDID]);

  useEffect(() => {
    void loadActivity();
    void loadInvites();
    void loadHierarchy();
  }, [loadActivity, loadInvites, loadHierarchy]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleApprove = async (inviteId: string) => {
    if (!userDID) return;
    setApprovingId(inviteId);
    setActionError(null);
    try {
      await workspaceService.approveInvite(workspaceId, inviteId, userDID);
      await loadInvites();
      await loadActivity();
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
      await workspaceService.cancelInvite(workspaceId, inviteId, userDID);
      await loadInvites();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel invite');
    } finally {
      setCancellingId(null);
    }
  };

  // ─── Derived ────────────────────────────────────────────────────────────────

  const childCount = hierarchy.reduce((sum, node) => {
    const countChildren = (n: HierarchyNode): number =>
      1 + (n.children ?? []).reduce((s, c) => s + countChildren(c), 0);
    return sum + (node.id === workspaceId ? (node.children?.length ?? 0) : 0);
  }, 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Left column: Command Overview + Pending Decisions */}
      <div className="flex flex-col gap-6">

        {/* Command Overview */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <span className="text-blue-400">&#9650;</span>
            Command Overview
          </h3>

          {activeWorkspace ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-white">{activeWorkspace.name}</p>
                  <p className="text-sm text-gray-400">{activeWorkspace.workspaceType}</p>
                </div>
                <span
                  className={`text-xs font-mono px-2 py-1 rounded border ${classificationColor(activeWorkspace.classification)}`}
                >
                  {activeWorkspace.classification}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-gray-700 rounded p-3 text-center">
                  <p className="text-2xl font-bold text-white">{activeWorkspace.memberCount}</p>
                  <p className="text-xs text-gray-400 mt-1">Members</p>
                </div>
                <div className="bg-gray-700 rounded p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {loadingHierarchy ? '...' : childCount}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Sub-Workspaces</p>
                </div>
              </div>

              {activeWorkspace.description && (
                <p className="text-sm text-gray-400 pt-1">{activeWorkspace.description}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Loading workspace details...</p>
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

      </div>

      {/* Right column: Quick Actions + Recent Activity */}
      <div className="flex flex-col gap-6">

        {/* Quick Actions */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h3 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <span className="text-purple-400">&#9654;</span>
            Quick Actions
          </h3>

          <div className="grid grid-cols-1 gap-2">
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
              onClick={() => navigate(`/workspace/${workspaceId}/members`)}
            >
              <span className="text-blue-400 w-5 text-center">&#128101;</span>
              View Members
            </button>
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
              onClick={() => navigate(`/workspace/${workspaceId}/invite`)}
            >
              <span className="text-green-400 w-5 text-center">&#43;</span>
              Invite Member
            </button>
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
              onClick={() => navigate('/workspace/new')}
            >
              <span className="text-yellow-400 w-5 text-center">&#9651;</span>
              Create Sub-Workspace
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex-1">
          <h3 className="text-base font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <span className="text-gray-400">&#9679;</span>
            Recent Activity
          </h3>

          {loadingActivity ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-2 border-b border-gray-700 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200">{formatActivityType(item.activityType)}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.actorDid.replace('did:near:', '')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{timeAgo(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
