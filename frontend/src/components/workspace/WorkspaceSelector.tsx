/**
 * WorkspaceSelector
 *
 * Post-login landing page. Replaces the old global panel tabs as the primary
 * entry point after authentication.
 *
 * Layout: two-column on large screens — OrgTree on left (1 col), detail card
 * panel on right (2 cols). On small screens: stacked.
 *
 * Behavior:
 * - Clicking a node in OrgTree sets selectedId (shows detail card on right)
 * - "Enter Workspace" navigates to /workspace/:id
 * - No memberships: shows CTA to create first workspace
 * - Loading: shows spinner
 *
 * Phase 20 Plan 01: Workspace-first routing foundation.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { OrgTree } from './OrgTree';
import { CreateWorkspaceWizard } from './CreateWorkspaceWizard';

// ─── Badge helpers (inlined from WorkspaceDashboard) ─────────────────────────

function classificationColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'TOPSECRET': return 'bg-red-900 text-red-200 border-red-700';
    case 'SECRET': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
    default: return 'bg-green-900 text-green-200 border-green-700';
  }
}

function workspaceTypeBadge(type: string): string {
  switch (type) {
    case 'Organization': return 'bg-blue-900/50 text-blue-300 border-blue-700';
    case 'Unit': return 'bg-purple-900/50 text-purple-300 border-purple-700';
    case 'Team': return 'bg-teal-900/50 text-teal-300 border-teal-700';
    default: return 'bg-gray-700 text-gray-300 border-gray-600';
  }
}

// ─── WorkspaceSelector ────────────────────────────────────────────────────────

export function WorkspaceSelector() {
  const navigate = useNavigate();
  const { memberships, loading } = useWorkspace();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // Derive root workspace ID for OrgTree — prefer Organization-type, fallback to first
  const rootWorkspaceId = useMemo((): string | null => {
    if (memberships.length === 0) return null;
    const orgMembership = memberships.find((m) => m.workspaceType === 'Organization');
    return (orgMembership ?? memberships[0]).workspaceId;
  }, [memberships]);

  // Selected workspace detail from memberships array
  const selectedMembership = useMemo(
    () => (selectedId ? memberships.find((m) => m.workspaceId === selectedId) ?? null : null),
    [selectedId, memberships],
  );

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  // ─── No memberships state ────────────────────────────────────────────────────

  if (!loading && memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <div className="text-4xl mb-4">&#127970;</div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Workspaces Yet</h3>
        <p className="text-sm text-gray-500 mb-6">
          Create your first workspace to get started.
        </p>
        <button
          onClick={() => setShowCreateWizard(true)}
          className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
        >
          Create Workspace
        </button>

        {showCreateWizard && (
          <CreateWorkspaceWizard onClose={() => setShowCreateWizard(false)} onCreated={() => setShowCreateWizard(false)} />
        )}
      </div>
    );
  }

  // ─── Main selector layout ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-gray-900">
      {/* Page header */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Select Workspace</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Choose a workspace from the hierarchy to enter it.
        </p>
      </div>

      {/* Two-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">

        {/* Left panel: Org hierarchy tree */}
        <aside className="border-r border-gray-700 bg-gray-900 p-4 overflow-auto">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
            Organization Hierarchy
          </h3>
          {rootWorkspaceId ? (
            <OrgTree
              rootWorkspaceId={rootWorkspaceId}
              onNavigate={(id) => setSelectedId(id)}
            />
          ) : (
            <p className="text-sm text-gray-500">No hierarchy available.</p>
          )}
        </aside>

        {/* Right panel: Workspace detail card */}
        <main className="lg:col-span-2 p-6 flex flex-col">
          {selectedMembership ? (
            <div className="max-w-lg">
              {/* Workspace identity */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white truncate mb-2">
                      {selectedMembership.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${workspaceTypeBadge(selectedMembership.workspaceType)}`}
                      >
                        {selectedMembership.workspaceType}
                      </span>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded border ${classificationColor(selectedMembership.classification)}`}
                      >
                        {selectedMembership.classification}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meta info */}
                <dl className="grid grid-cols-2 gap-3 text-sm mb-6">
                  <div>
                    <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Members</dt>
                    <dd className="text-gray-200">
                      {'—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Your Role</dt>
                    <dd className="text-gray-200 capitalize">{selectedMembership.role}</dd>
                  </div>
                  {selectedMembership.daoRole && (
                    <div>
                      <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">DAO Role</dt>
                      <dd className="text-gray-200 capitalize">{selectedMembership.daoRole}</dd>
                    </div>
                  )}
                  {selectedMembership.isPrimary && (
                    <div>
                      <dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Status</dt>
                      <dd className="text-yellow-400 text-xs font-medium">Primary Workspace</dd>
                    </div>
                  )}
                </dl>

                {/* CTA */}
                <button
                  onClick={() => navigate(`/workspace/${selectedMembership.workspaceId}`)}
                  className="w-full py-2.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-medium text-sm transition-colors"
                >
                  Enter Workspace
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
              <div className="text-4xl mb-4 opacity-30">&#127970;</div>
              <p className="text-gray-500 text-sm">
                Select a workspace from the hierarchy to view details
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
