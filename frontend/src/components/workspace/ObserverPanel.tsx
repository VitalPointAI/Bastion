/**
 * ObserverPanel
 *
 * Read-only workspace panel for observer-role users.
 * Shows workspace info, activity summary (summary-level only), and mission list.
 * No action buttons — purely informational.
 *
 * Phase 19 Plan 07: Role-adaptive dashboard panels.
 */

import { useState, useEffect, useCallback } from 'react';
import { workspaceService, type WorkspaceActivityItem } from '../../lib/workspace-service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function workspaceTypeBadge(type: string): string {
  switch (type) {
    case 'Organization': return 'bg-blue-900 text-blue-200';
    case 'Unit': return 'bg-purple-900 text-purple-200';
    case 'Team': return 'bg-teal-900 text-teal-200';
    default: return 'bg-gray-700 text-gray-300';
  }
}

/**
 * Observer-visible summary of activity — only top-level summary events.
 * Observers see: joins/departures only (by count, not identity).
 */
function summarizeActivity(items: WorkspaceActivityItem[]): string {
  const joins = items.filter((i) => i.activityType === 'member_joined').length;
  const leaves = items.filter((i) => i.activityType === 'member_left').length;
  const parts: string[] = [];
  if (joins > 0) parts.push(`${joins} member${joins !== 1 ? 's' : ''} joined`);
  if (leaves > 0) parts.push(`${leaves} member${leaves !== 1 ? 's' : ''} left`);
  return parts.length > 0 ? parts.join(', ') : 'No recent membership changes';
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ObserverPanelProps {
  workspaceId: string;
}

// ─── ObserverPanel ────────────────────────────────────────────────────────────

export function ObserverPanel({ workspaceId }: ObserverPanelProps) {
  const { activeWorkspace } = useWorkspace();
  const { userDID } = useUser();

  const [activity, setActivity] = useState<WorkspaceActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Load activity ──────────────────────────────────────────────────────────

  const loadActivity = useCallback(async () => {
    if (!userDID) return;
    setLoading(true);
    try {
      const items = await workspaceService.listActivity(workspaceId, userDID, { limit: 20 });
      setActivity(items);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userDID]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  // Observers only see join/leave events with anonymized identity
  const visibleActivity = activity
    .filter((i) => ['member_joined', 'member_left'].includes(i.activityType))
    .slice(0, 5);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Workspace Info — read-only card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Read Only</span>
          <span className="text-gray-600">&#124;</span>
          <span className="text-xs text-gray-500">Observer access</span>
        </div>

        {activeWorkspace ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">{activeWorkspace.name}</h3>
                {activeWorkspace.description && (
                  <p className="text-sm text-gray-400 mt-1">{activeWorkspace.description}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                <span
                  className={`text-xs font-mono px-2 py-1 rounded border ${classificationColor(activeWorkspace.classification)}`}
                >
                  {activeWorkspace.classification}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${workspaceTypeBadge(activeWorkspace.workspaceType)}`}>
                  {activeWorkspace.workspaceType}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700 rounded p-3 text-center">
                <p className="text-2xl font-bold text-white">{activeWorkspace.memberCount}</p>
                <p className="text-xs text-gray-400 mt-1">Members</p>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <p className="text-xs text-gray-300 font-medium uppercase tracking-wide mt-1">
                  {activeWorkspace.inviteMode === 'open' ? 'Open Access' : 'Invite Only'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Join mode</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading workspace details...</p>
        )}
      </div>

      {/* Mission List — placeholder until missions are workspace-scoped */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-100 mb-4">Missions</h3>

        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-600 rounded">
          <p className="text-sm text-gray-500">
            Missions assigned to this workspace will appear here.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Use the Campaign tab to view all active missions.
          </p>
        </div>
      </div>

      {/* Activity Summary — condensed, observer-level visibility */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-100 mb-1">Activity Summary</h3>
        <p className="text-xs text-gray-500 mb-4">Summary-level membership changes only</p>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <>
            {/* Condensed summary line */}
            <div className="mb-4 px-4 py-3 bg-gray-700 rounded text-sm text-gray-300">
              {summarizeActivity(activity)}
            </div>

            {/* Individual visible events */}
            {visibleActivity.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No membership changes to display.</p>
            ) : (
              <ul className="divide-y divide-gray-700">
                {visibleActivity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-300 capitalize">
                      {item.activityType === 'member_joined' ? 'Member joined' : 'Member left'}
                    </span>
                    <span className="text-xs text-gray-500">{timeAgo(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

    </div>
  );
}
