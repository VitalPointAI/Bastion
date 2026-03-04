/**
 * WorkspaceDashboard
 *
 * Role-adaptive workspace dashboard. Single component that renders role-specific
 * panels based on the user's role — no separate pages per role.
 *
 * - Commander/XO: CommanderPanel (pending decisions, command overview, quick actions)
 * - Staff sections (S1-S9): StaffPanel (role-labeled content, activity)
 * - Observers / no-role: ObserverPanel (read-only info and activity summary)
 *
 * Phase 19 Plan 07: Role-adaptive dashboard with conditional panel rendering.
 *
 * Decisions:
 * - Role-to-panel mapping via useMemo (no routing split per role)
 * - useParams() workspaceId → triggers setActiveWorkspace if different from stored
 * - Loading state: spinner while workspace loads
 * - Not a member: access denied message
 * - No workspace: prompt to select or create
 */

import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CommanderPanel } from './CommanderPanel';
import { StaffPanel } from './StaffPanel';
import { ObserverPanel } from './ObserverPanel';

// ─── Role mappings ────────────────────────────────────────────────────────────

const COMMANDER_ROLES = ['commander', 'xo'];

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

// ─── WorkspaceDashboard ───────────────────────────────────────────────────────

export function WorkspaceDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const {
    activeWorkspaceId,
    activeWorkspace,
    userRoleInActive,
    memberships,
    loading,
    setActiveWorkspace,
  } = useWorkspace();

  // If the URL workspaceId differs from stored active, switch to it
  useEffect(() => {
    if (workspaceId && workspaceId !== activeWorkspaceId) {
      setActiveWorkspace(workspaceId);
    }
  }, [workspaceId, activeWorkspaceId, setActiveWorkspace]);

  // ─── Role-to-panel mapping ──────────────────────────────────────────────────

  const RolePanel = useMemo(() => {
    if (!userRoleInActive) return ObserverPanel;
    if (COMMANDER_ROLES.includes(userRoleInActive)) return CommanderPanel;
    // All named staff roles (s1-s9 and any other non-commander role) → StaffPanel
    return StaffPanel;
  }, [userRoleInActive]);

  // ─── Guards ─────────────────────────────────────────────────────────────────

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // No workspace ID in URL and no active workspace
  if (!workspaceId && !activeWorkspaceId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Workspace Selected</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select a workspace from the sidebar or create a new one.
        </p>
        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
          onClick={() => navigate('/workspace/new')}
        >
          Create Workspace
        </button>
      </div>
    );
  }

  // Workspace resolved but user is not a member
  const resolvedId = workspaceId ?? activeWorkspaceId;
  const isMember = memberships.some((m) => m.workspaceId === resolvedId);

  if (resolvedId && !loading && memberships.length > 0 && !isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <div className="text-4xl mb-3">&#128274;</div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Access Denied</h3>
        <p className="text-sm text-gray-500">
          You are not a member of this workspace.
        </p>
      </div>
    );
  }

  const displayId = workspaceId ?? activeWorkspaceId ?? '';

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-gray-900">

      {/* Dashboard Header */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-start justify-between gap-4">

          {/* Workspace identity */}
          <div className="flex-1 min-w-0">
            {activeWorkspace ? (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold text-white truncate">
                    {activeWorkspace.name}
                  </h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${workspaceTypeBadge(activeWorkspace.workspaceType)}`}
                  >
                    {activeWorkspace.workspaceType}
                  </span>
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded border ${classificationColor(activeWorkspace.classification)}`}
                  >
                    {activeWorkspace.classification}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {activeWorkspace.memberCount} member{activeWorkspace.memberCount !== 1 ? 's' : ''}
                  {userRoleInActive && (
                    <>
                      {' '}&middot;{' '}
                      <span className="text-gray-300 capitalize">{userRoleInActive}</span>
                    </>
                  )}
                </p>
              </>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-gray-400">Workspace</h2>
                <p className="text-sm text-gray-600">Loading details...</p>
              </div>
            )}
          </div>

          {/* Sidebar quick links — desktop only */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <Link
              to={`/workspace/${displayId}/members`}
              className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
            >
              Members
            </Link>
            <Link
              to={`/workspace/${displayId}/invite`}
              className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
            >
              Invites
            </Link>
          </div>

        </div>
      </div>

      {/* Main content — role-specific panel */}
      <div className="flex-1 p-6">
        {displayId ? (
          <RolePanel workspaceId={displayId} staffRole={userRoleInActive ?? undefined} />
        ) : (
          <div className="text-center text-gray-500 text-sm py-12">
            No workspace available. Select one from the sidebar.
          </div>
        )}
      </div>

    </div>
  );
}
