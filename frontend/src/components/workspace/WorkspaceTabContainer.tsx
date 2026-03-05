/**
 * WorkspaceTabContainer
 *
 * Shell component that renders workspace tabs. Horizontal tab bar
 * (COP | Decide | Design | Campaign | Train | Overview) with role-gated
 * visibility, URL-driven tab state, and a collapsible OrgTreeSidebar overlay.
 *
 * Tab content:
 * - COP: renders unified COPTab (map + AI layers + actor graph + activity feeds)
 * - Decide: renders DecideTab scoped to workspace daoId
 * - Design: renders DesignTab (workspace-scoped strategic docs)
 * - Campaign: renders CampaignTab (workspace-scoped missions)
 * - Train: renders TrainTab wrapping ExerciseDashboard
 * - Overview: renders WorkspaceDashboard (simple dashboard alternative)
 *
 * Role gating: each role sees only its allowed tabs (see DEFAULT_TAB_ACCESS).
 * Unknown roles fall back to ['cop', 'overview'].
 *
 * Phase 21 Plan 12: Monitor tab removed; COP replaces it as the primary/default tab.
 *
 * Phase 20 Plan 04: Wired all tab panels with workspaceId prop injection
 * Phase 20 Plan 07: Tab notification badges + TabNotificationDropdown + CrossWorkspaceLayerToggle
 * Phase 20 Plan 09: Backend-driven panel config with client-side fallback
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';
import { workspaceService } from '../../lib/workspace-service';
import { WorkspaceDashboard } from './WorkspaceDashboard';
import { OrgTreeSidebar } from './OrgTreeSidebar';
import { NotificationBadge } from './NotificationBadge';
import { TabNotificationDropdown } from './TabNotificationDropdown';
import { WorkspaceInviteModal } from './WorkspaceInviteModal';
import { DecideTab } from '../tabs/DecideTab';
import { DesignTab } from '../tabs/DesignTab';
import { CampaignTab } from '../tabs/CampaignTab';
import { TrainTab } from '../tabs/TrainTab';
import { COPTab } from '../cop/COPTab';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const WORKSPACE_TABS = ['cop', 'decide', 'design', 'campaign', 'train', 'overview'] as const;
type WorkspaceTab = typeof WORKSPACE_TABS[number];

const TAB_LABELS: Record<WorkspaceTab, string> = {
  cop: 'COP',
  decide: 'Decide',
  design: 'Design',
  campaign: 'Campaign',
  train: 'Train',
  overview: 'Overview',
};

// ─── Role → tab access map ────────────────────────────────────────────────────

const DEFAULT_TAB_ACCESS: Record<string, WorkspaceTab[]> = {
  commander: ['cop', 'decide', 'design', 'campaign', 'train', 'overview'],
  xo: ['cop', 'decide', 'design', 'campaign', 'train', 'overview'],
  team_lead: ['cop', 'decide', 'campaign', 'train', 'overview'],
  s2: ['cop', 'decide', 'overview'],
  s3: ['cop', 'decide', 'campaign', 'overview'],
  s4: ['cop', 'campaign', 'overview'],
  s5: ['cop', 'decide', 'design', 'campaign', 'overview'],
  s6: ['cop', 'overview'],
  s7: ['cop', 'overview'],
  s8: ['cop', 'overview'],
  s9: ['cop', 'overview'],
  member: ['cop', 'overview'],
  observer: ['cop', 'overview'],
};

const FALLBACK_TABS: WorkspaceTab[] = ['cop', 'overview'];

// ─── WorkspaceTabContainer ────────────────────────────────────────────────────

export function WorkspaceTabContainer() {
  const { workspaceId, tab: urlTab } = useParams<{ workspaceId: string; tab?: string }>();
  const navigate = useNavigate();

  const {
    activeWorkspaceId,
    activeWorkspace,
    userRoleInActive,
    memberships,
    loading,
    setActiveWorkspace,
    tabNotifications,
    crossWorkspaceUpdates,
  } = useWorkspace();

  const { userDID } = useUser();

  // Panel config from backend (null = not loaded yet, use client defaults)
  const [panelConfig, setPanelConfig] = useState<Record<string, string[]> | null>(null);

  // Sidebar state
  const [orgTreeOpen, setOrgTreeOpen] = useState(false);
  // Dropdown state: which tab's notification dropdown is open (null = none)
  const [dropdownTab, setDropdownTab] = useState<string | null>(null);
  // Invite modal state (moved from WorkspaceDashboard)
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Sync URL workspaceId → context (same pattern as WorkspaceDashboard)
  useEffect(() => {
    if (workspaceId && workspaceId !== activeWorkspaceId) {
      setActiveWorkspace(workspaceId);
    }
  }, [workspaceId, activeWorkspaceId, setActiveWorkspace]);

  // Resolved workspace ID to pass into tab components (needed before guards)
  const resolvedId = workspaceId ?? activeWorkspaceId;
  const displayId = resolvedId ?? '';

  // Fetch panel config from backend when workspace or user changes
  useEffect(() => {
    if (!displayId || !userDID) return;
    workspaceService.getPanelConfig(displayId, userDID)
      .then(config => setPanelConfig(config.panelVisibility))
      .catch(() => setPanelConfig(null)); // Fall back to client defaults on error
  }, [displayId, userDID]);

  // Derive visible tabs: use backend config if available, fall back to client defaults
  const visibleTabs = useMemo((): WorkspaceTab[] => {
    const source = panelConfig ?? DEFAULT_TAB_ACCESS;
    const tabs = source[userRoleInActive ?? 'member'] ?? FALLBACK_TABS;
    // Maintain fixed tab order — filter WORKSPACE_TABS by what's in tabs
    return WORKSPACE_TABS.filter(t => tabs.includes(t));
  }, [panelConfig, userRoleInActive]);

  // Resolve active tab from URL or default to 'overview'
  const resolvedTab = useMemo((): WorkspaceTab => {
    if (urlTab && WORKSPACE_TABS.includes(urlTab as WorkspaceTab)) {
      const t = urlTab as WorkspaceTab;
      // If role doesn't allow this tab, fall back to overview
      return visibleTabs.includes(t) ? t : 'cop';
    }
    return 'cop';
  }, [urlTab, visibleTabs]);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(resolvedTab);

  // Keep local state in sync with URL param changes
  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  function handleTabClick(tab: WorkspaceTab) {
    setActiveTab(tab);
    if (workspaceId) {
      navigate(`/workspace/${workspaceId}/${tab}`, { replace: true });
    }
  }

  // ─── Guards ───────────────────────────────────────────────────────────────

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

  // ─── Tab content ──────────────────────────────────────────────────────────

  function renderTabContent() {
    if (activeTab === 'overview') {
      return <WorkspaceDashboard />;
    }
    if (activeTab === 'decide') {
      return <DecideTab workspaceId={displayId} daoId={activeWorkspace?.daoId} />;
    }
    if (activeTab === 'design') {
      return <DesignTab workspaceId={displayId} />;
    }
    if (activeTab === 'campaign') {
      return <CampaignTab workspaceId={displayId} />;
    }
    if (activeTab === 'train') {
      return <TrainTab workspaceId={displayId} />;
    }
    if (activeTab === 'cop') {
      return <COPTab workspaceId={displayId} />;
    }
    return null;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-900">

      {/* Horizontal tab bar */}
      <nav
        className="flex border-b border-gray-700 bg-gray-800 shrink-0"
        role="tablist"
        aria-label="Workspace tabs"
      >
        {/* Visible tabs in fixed order */}
        {WORKSPACE_TABS.filter((t) => visibleTabs.includes(t)).map((tab) => (
          <div key={tab} className="relative">
            <button
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => handleTabClick(tab)}
              className={[
                'px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap relative',
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-white'
                  : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent',
              ].join(' ')}
            >
              {TAB_LABELS[tab]}
              {(tabNotifications[tab] ?? 0) > 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownTab(dropdownTab === tab ? null : tab);
                  }}
                  className="ml-1 inline-block relative align-middle cursor-pointer"
                  role="button"
                  aria-label={`${tabNotifications[tab]} notifications for ${TAB_LABELS[tab]}`}
                >
                  <NotificationBadge count={tabNotifications[tab] ?? 0} />
                </span>
              )}
            </button>
            {dropdownTab === tab && (
              <TabNotificationDropdown
                tab={tab}
                updates={crossWorkspaceUpdates}
                onClose={() => setDropdownTab(null)}
                onAction={(_update) => {
                  // The tab is already active; close dropdown and focus it
                  // Future: navigate to specific item via _update.actionableItemId
                  setActiveTab(tab);
                  setDropdownTab(null);
                }}
              />
            )}
          </div>
        ))}

        {/* Right-aligned actions + Org toggle */}
        <div className="ml-auto hidden lg:flex items-center gap-1 pr-1">
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
          >
            Invite
          </button>
          <Link
            to={`/workspace/${displayId}/members`}
            className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Members
          </Link>
          <Link
            to={`/workspace/${displayId}/directory`}
            className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Directory
          </Link>
          <Link
            to={`/workspace/${displayId}/settings`}
            className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Settings
          </Link>

          <span className="w-px h-5 bg-gray-700 mx-1" />

          <button
            onClick={() => setOrgTreeOpen(true)}
            className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
            aria-label="Open organization tree"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
            Org
          </button>
        </div>

        {/* Mobile: just Org toggle */}
        <button
          onClick={() => setOrgTreeOpen(true)}
          className="lg:hidden ml-auto px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
          aria-label="Open organization tree"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
          </svg>
          Org
        </button>
      </nav>

      {/* Tab content */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {renderTabContent()}
      </div>

      {/* OrgTreeSidebar — rendered outside tab content to avoid overflow clipping */}
      {orgTreeOpen && <OrgTreeSidebar onClose={() => setOrgTreeOpen(false)} />}

      {/* Invite modal */}
      {showInviteModal && displayId && (
        <WorkspaceInviteModal
          workspaceId={displayId}
          workspaceName={activeWorkspace?.name ?? 'Workspace'}
          onClose={() => setShowInviteModal(false)}
        />
      )}

    </div>
  );
}

export default WorkspaceTabContainer;
