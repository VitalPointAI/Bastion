/**
 * ObserverPanel
 *
 * Read-only workspace panel for observer-role users.
 * Shows workspace info and mission list placeholder.
 * Activity is handled by the dashboard-level ActivityFeed.
 */

import { useWorkspace } from '../../context/WorkspaceContext';

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ObserverPanelProps {
  workspaceId: string;
}

// ─── ObserverPanel ────────────────────────────────────────────────────────────

export function ObserverPanel({ workspaceId: _workspaceId }: ObserverPanelProps) {
  const { activeWorkspace } = useWorkspace();

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

    </div>
  );
}
