/**
 * ProblemSetSelector
 *
 * Post-login landing page. Replaces the old global panel tabs as the primary
 * entry point after authentication.
 *
 * Layout: two-column on large screens -- OrgTree on left (1 col), detail card
 * panel on right (2 cols). On small screens: stacked.
 *
 * Behavior:
 * - Clicking a node in OrgTree sets selectedId (shows detail card on right)
 * - "Enter Problem Set" navigates to /problem-set/:id
 * - No memberships: shows CTA to create first problem set
 * - Loading: shows spinner
 *
 * Phase 20 Plan 01: Workspace-first routing foundation.
 * Phase 23 Plan 07: Renamed from WorkspaceSelector to ProblemSetSelector.
 */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { problemSetService, type ProblemSetDetail } from '../../lib/problem-set-service';
import { OrgTree } from './OrgTree';
import { CreateProblemSetWizard } from './CreateProblemSetWizard';

// --- Badge helpers (inlined from ProblemSetDashboard) -------------------------

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function echelonBadge(echelon: string): string {
  switch (echelon) {
    case 'strategic': return 'bg-blue-900/50 text-blue-300 border-blue-700';
    case 'operational': return 'bg-purple-900/50 text-purple-300 border-purple-700';
    case 'tactical': return 'bg-teal-900/50 text-teal-300 border-teal-700';
    default: return 'bg-gray-700 text-gray-300 border-gray-600';
  }
}

const ECHELON_SYMBOLS: Record<string, string> = {
  strategic: 'XX',
  operational: 'III',
  tactical: 'II',
};

const ECHELON_LABELS: Record<string, string> = {
  strategic: 'Strategic',
  operational: 'Operational',
  tactical: 'Tactical',
};

// --- ProblemSetSelector -------------------------------------------------------

export function ProblemSetSelector() {
  const navigate = useNavigate();
  const { memberships, loading } = useProblemSet();
  const { userDID } = useUser();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [detail, setDetail] = useState<ProblemSetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Derive root problem set ID for OrgTree -- prefer strategic echelon, fallback to first
  const rootProblemSetId = useMemo((): string | null => {
    if (memberships.length === 0) return null;
    const strategicMembership = memberships.find((m) => m.echelon === 'strategic');
    return (strategicMembership ?? memberships[0]).problemSetId;
  }, [memberships]);

  // Selected problem set detail from memberships array
  const selectedMembership = useMemo(
    () => (selectedId ? memberships.find((m) => m.problemSetId === selectedId) ?? null : null),
    [selectedId, memberships],
  );

  // Fetch full detail when a node is selected
  useEffect(() => {
    if (!selectedId || !userDID) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    problemSetService.getProblemSet(selectedId, userDID)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, userDID]);

  // --- Loading state ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading problem sets...</p>
        </div>
      </div>
    );
  }

  // --- No memberships state ---

  if (!loading && memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <div className="text-4xl mb-4">&#127970;</div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Problem Sets Yet</h3>
        <p className="text-sm text-gray-500 mb-6">
          Create your first problem set to get started.
        </p>
        <button
          onClick={() => setShowCreateWizard(true)}
          className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
        >
          Create Problem Set
        </button>

        {showCreateWizard && (
          <CreateProblemSetWizard onClose={() => setShowCreateWizard(false)} onCreated={() => setShowCreateWizard(false)} />
        )}
      </div>
    );
  }

  // --- Main selector layout ---

  return (
    <div className="flex flex-col min-h-full bg-gray-900">
      {/* Page header */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Select Problem Set</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Choose a problem set from the hierarchy to enter it.
        </p>
      </div>

      {/* Two-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">

        {/* Left panel: Org hierarchy tree */}
        <aside className="border-r border-gray-700 bg-gray-900 p-4 overflow-auto">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
            Organization Hierarchy
          </h3>
          {rootProblemSetId ? (
            <OrgTree
              rootProblemSetId={rootProblemSetId}
              onNavigate={(id) => setSelectedId(id)}
            />
          ) : (
            <p className="text-sm text-gray-500">No hierarchy available.</p>
          )}
        </aside>

        {/* Right panel: Problem set detail card */}
        <main className="lg:col-span-2 p-6 flex flex-col">
          {selectedMembership ? (
            <div className="max-w-lg">
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                {/* Header: name + echelon symbol + classification */}
                <div className="flex items-start gap-4 mb-4">
                  {/* Echelon military symbol */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-900 border border-gray-600 flex items-center justify-center">
                    <span className="text-lg font-bold font-mono text-gray-300">
                      {ECHELON_SYMBOLS[selectedMembership.echelon] ?? ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white truncate mb-1">
                      {selectedMembership.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${echelonBadge(selectedMembership.echelon)}`}
                      >
                        {ECHELON_LABELS[selectedMembership.echelon] ?? selectedMembership.echelon}
                      </span>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded border ${classificationColor(selectedMembership.classification)}`}
                      >
                        {selectedMembership.classification}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Problem statement */}
                <div className="mb-4 p-3 bg-gray-900/50 rounded border border-gray-700">
                  <dt className="text-gray-500 text-xs uppercase tracking-wide mb-1">Problem Statement</dt>
                  {detailLoading ? (
                    <dd className="text-gray-500 text-sm italic">Loading...</dd>
                  ) : detail?.problemStatement ? (
                    <dd className="text-gray-200 text-sm leading-relaxed">{detail.problemStatement}</dd>
                  ) : (
                    <dd className="text-gray-600 text-sm italic">No problem statement defined</dd>
                  )}
                </div>

                {/* Meta info grid */}
                <dl className="grid grid-cols-3 gap-3 text-sm mb-6">
                  <div className="bg-gray-900/30 rounded p-2 text-center">
                    <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Members</dt>
                    <dd className="text-gray-200 font-semibold">
                      {detail?.memberCount ?? '--'}
                    </dd>
                  </div>
                  <div className="bg-gray-900/30 rounded p-2 text-center">
                    <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Your Role</dt>
                    <dd className="text-gray-200 capitalize font-semibold">{selectedMembership.role}</dd>
                  </div>
                  <div className="bg-gray-900/30 rounded p-2 text-center">
                    <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Status</dt>
                    <dd className="text-gray-200 font-semibold">
                      {selectedMembership.isPrimary ? (
                        <span className="text-yellow-400">Primary</span>
                      ) : (
                        <span className="capitalize">{selectedMembership.status}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {selectedMembership.daoRole && (
                  <div className="text-xs text-gray-500 mb-4">
                    DAO Role: <span className="text-gray-300 capitalize">{selectedMembership.daoRole}</span>
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={() => navigate(`/problem-set/${selectedMembership.problemSetId}`)}
                  className="w-full py-2.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-medium text-sm transition-colors"
                >
                  Enter Problem Set
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
              <div className="text-4xl mb-4 opacity-30">&#127970;</div>
              <p className="text-gray-500 text-sm">
                Select a problem set from the hierarchy to view details
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
