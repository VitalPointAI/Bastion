/**
 * WorkspaceTabContainer
 *
 * Shell component that replaces WorkspaceDashboard as the primary workspace
 * view. Renders a horizontal tab bar (Overview | Decide | Design | Campaign |
 * Monitor | Train) with role-gated visibility, URL-driven tab state, and a
 * collapsible OrgTreeSidebar slide-out overlay.
 *
 * Tab content:
 * - Overview: renders existing WorkspaceDashboard (role-adaptive panels + ActivityFeed)
 * - Decide: renders DecideTab scoped to workspace daoId
 * - Design: renders DesignTab (workspace-scoped strategic docs, TODO full scoping)
 * - Campaign: renders CampaignTab (workspace-scoped missions)
 * - Monitor: renders MonitorTab with dynamic workspaceId (not hardcoded 'default')
 * - Train: renders TrainTab wrapping ExerciseDashboard
 *
 * Role gating: each role sees only its allowed tabs (see DEFAULT_TAB_ACCESS).
 * Unknown roles fall back to ['overview', 'monitor'].
 *
 * Phase 20 Plan 04: Wired all tab panels with workspaceId prop injection
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { WorkspaceDashboard } from './WorkspaceDashboard';
import { OrgTreeSidebar } from './OrgTreeSidebar';
import { DecideTab } from '../tabs/DecideTab';
import { DesignTab } from '../tabs/DesignTab';
import { CampaignTab } from '../tabs/CampaignTab';
import { MonitorTab } from '../tabs/MonitorTab';
import { TrainTab } from '../tabs/TrainTab';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const WORKSPACE_TABS = ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'] as const;
type WorkspaceTab = typeof WORKSPACE_TABS[number];

const TAB_LABELS: Record<WorkspaceTab, string> = {
  overview: 'Overview',
  decide: 'Decide',
  design: 'Design',
  campaign: 'Campaign',
  monitor: 'Monitor',
  train: 'Train',
};

// ─── Role → tab access map ────────────────────────────────────────────────────

const DEFAULT_TAB_ACCESS: Record<string, WorkspaceTab[]> = {
  commander: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
  xo: ['overview', 'decide', 'design', 'campaign', 'monitor', 'train'],
  team_lead: ['overview', 'decide', 'campaign', 'monitor', 'train'],
  s2: ['overview', 'decide', 'monitor'],
  s3: ['overview', 'decide', 'campaign'],
  s4: ['overview', 'campaign'],
  s5: ['overview', 'decide', 'design', 'campaign'],
  s6: ['overview'],
  s7: ['overview'],
  s8: ['overview'],
  s9: ['overview'],
  member: ['overview', 'monitor'],
  observer: ['overview'],
};

const FALLBACK_TABS: WorkspaceTab[] = ['overview', 'monitor'];

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
  } = useWorkspace();

  // Sidebar state
  const [orgTreeOpen, setOrgTreeOpen] = useState(false);

  // Sync URL workspaceId → context (same pattern as WorkspaceDashboard)
  useEffect(() => {
    if (workspaceId && workspaceId !== activeWorkspaceId) {
      setActiveWorkspace(workspaceId);
    }
  }, [workspaceId, activeWorkspaceId, setActiveWorkspace]);

  // Derive visible tabs from role
  const visibleTabs = useMemo((): WorkspaceTab[] => {
    if (!userRoleInActive) return FALLBACK_TABS;
    return DEFAULT_TAB_ACCESS[userRoleInActive] ?? FALLBACK_TABS;
  }, [userRoleInActive]);

  // Resolve active tab from URL or default to 'overview'
  const resolvedTab = useMemo((): WorkspaceTab => {
    if (urlTab && WORKSPACE_TABS.includes(urlTab as WorkspaceTab)) {
      const t = urlTab as WorkspaceTab;
      // If role doesn't allow this tab, fall back to overview
      return visibleTabs.includes(t) ? t : 'overview';
    }
    return 'overview';
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

  // Resolved workspace ID to pass into tab components
  const displayId = resolvedId ?? '';

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
    if (activeTab === 'monitor') {
      return <MonitorTab workspaceId={displayId} />;
    }
    if (activeTab === 'train') {
      return <TrainTab workspaceId={displayId} />;
    }
    return null;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full bg-gray-900">

      {/* Horizontal tab bar */}
      <nav
        className="flex border-b border-gray-700 bg-gray-800 shrink-0"
        role="tablist"
        aria-label="Workspace tabs"
      >
        {/* Visible tabs in fixed order */}
        {WORKSPACE_TABS.filter((t) => visibleTabs.includes(t)).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => handleTabClick(tab)}
            className={[
              'px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-gray-400 hover:text-gray-200 border-b-2 border-transparent',
            ].join(' ')}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}

        {/* Org tree toggle — far right */}
        <button
          onClick={() => setOrgTreeOpen(true)}
          className="ml-auto px-4 py-3 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5"
          aria-label="Open organization tree"
        >
          {/* Org icon (simple hierarchy SVG) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h8m-8 6h16"
            />
          </svg>
          Org
        </button>
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {renderTabContent()}
      </div>

      {/* OrgTreeSidebar — rendered outside tab content to avoid overflow clipping */}
      {orgTreeOpen && <OrgTreeSidebar onClose={() => setOrgTreeOpen(false)} />}

    </div>
  );
}

export default WorkspaceTabContainer;
