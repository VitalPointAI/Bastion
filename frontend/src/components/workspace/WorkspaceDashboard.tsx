/**
 * WorkspaceDashboard
 *
 * Role-adaptive workspace dashboard. Single component that renders role-specific
 * panels based on the user's role — no separate pages per role.
 *
 * Integrated components:
 * - StrategicValidityDashboard (validity map centerpiece — Common Operating Picture)
 * - CommanderPanel / StaffPanel / ObserverPanel (role-adaptive)
 * - ActivityFeed (role-filtered timeline, 15s polling)
 * - WorkspaceInviteModal (opened via "Invite Member" quick action)
 *
 * Quick actions:
 * - "Invite Member" → opens WorkspaceInviteModal inline
 * - "Manage Members" → navigates to /workspace/:id/members
 * - "Directory" → navigates to /workspace/:id/directory
 *
 * Phase 19 Plan 10: Integration and verification.
 * Phase 20 Plan 09: OrgTree sidebar removed (now in global OrgTreeSidebar via WorkspaceTabContainer).
 *                   StrategicValidityDashboard added as centerpiece.
 *
 * Decisions:
 * - Role-to-panel mapping via useMemo (no routing split per role)
 * - useParams() workspaceId → triggers setActiveWorkspace if different from stored
 * - Loading state: spinner while workspace loads
 * - Not a member: access denied message
 * - No workspace: prompt to select or create
 * - ActivityFeed in main content, OrgTree moved to global sidebar
 * - WorkspaceInviteModal opens inline (no route navigation needed)
 */

import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CommanderPanel } from './CommanderPanel';
import { StaffPanel } from './StaffPanel';
import { ObserverPanel } from './ObserverPanel';
import { ActivityFeed } from './ActivityFeed';
import { StrategicValidityDashboard } from '../validity/index.js';

// ─── Role mappings ────────────────────────────────────────────────────────────

const COMMANDER_ROLES = ['commander', 'xo'];

// ─── WorkspaceDashboard ───────────────────────────────────────────────────────

export function WorkspaceDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

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
        <p className="text-xs text-gray-600">
          Use the workspace switcher in the sidebar to create one.
        </p>
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

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 gap-4 p-4">

        {/* Validity map centerpiece — Common Operating Picture */}
        {displayId && (
          <section className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Common Operating Picture</h3>
            <div className="h-64 lg:h-80">
              <StrategicValidityDashboard />
            </div>
          </section>
        )}

        {/* Role-adaptive panel */}
        {displayId ? (
          <RolePanel workspaceId={displayId} staffRole={userRoleInActive ?? undefined} />
        ) : (
          <div className="text-center text-gray-500 text-sm py-12">
            No workspace available. Select one from the sidebar.
          </div>
        )}

        {/* Activity Feed */}
        {displayId && (
          <section className="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Activity Feed</h3>
            <ActivityFeed
              workspaceId={displayId}
              userRole={userRoleInActive}
            />
          </section>
        )}

      </div>

    </div>
  );
}
