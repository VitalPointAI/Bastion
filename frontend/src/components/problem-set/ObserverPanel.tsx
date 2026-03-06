/**
 * ObserverPanel
 *
 * Read-only problem set panel for observer-role users.
 * Shows problem set info and mission list placeholder.
 * Activity is handled by the dashboard-level ActivityFeed.
 */

import { useProblemSet } from '../../context/ProblemSetContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function echelonBadge(type: string): string {
  switch (type) {
    case 'Organization': return 'bg-blue-900 text-blue-200';
    case 'Unit': return 'bg-purple-900 text-purple-200';
    case 'Team': return 'bg-teal-900 text-teal-200';
    default: return 'bg-gray-700 text-gray-300';
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ObserverPanelProps {
  problemSetId: string;
}

// ─── ObserverPanel ────────────────────────────────────────────────────────────

export function ObserverPanel({ problemSetId: _problemSetId }: ObserverPanelProps) {
  const { activeProblemSet } = useProblemSet();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Problem Set Info — read-only card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Read Only</span>
          <span className="text-gray-600">&#124;</span>
          <span className="text-xs text-gray-500">Observer access</span>
        </div>

        {activeProblemSet ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">{activeProblemSet.name}</h3>
                {activeProblemSet.description && (
                  <p className="text-sm text-gray-400 mt-1">{activeProblemSet.description}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                <span
                  className={`text-xs font-mono px-2 py-1 rounded border ${classificationColor(activeProblemSet.classification)}`}
                >
                  {activeProblemSet.classification}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${echelonBadge(activeProblemSet.echelon)}`}>
                  {activeProblemSet.echelon}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700 rounded p-3 text-center">
                <p className="text-2xl font-bold text-white">{activeProblemSet.memberCount}</p>
                <p className="text-xs text-gray-400 mt-1">Members</p>
              </div>
              <div className="bg-gray-700 rounded p-3 text-center">
                <p className="text-xs text-gray-300 font-medium uppercase tracking-wide mt-1">
                  {activeProblemSet.inviteMode === 'open' ? 'Open Access' : 'Invite Only'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Join mode</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading problem set details...</p>
        )}
      </div>

      {/* Mission List — placeholder until missions are problem set-scoped */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-100 mb-4">Missions</h3>

        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-600 rounded">
          <p className="text-sm text-gray-500">
            Missions assigned to this problem set will appear here.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Use the Campaign tab to view all active missions.
          </p>
        </div>
      </div>

    </div>
  );
}
