/**
 * ProblemSetTabContainer
 *
 * Shell component that renders problem set tabs. Horizontal tab bar
 * (COP | Decide | Design | Campaign | Overview) with role-gated
 * visibility, URL-driven tab state, and a collapsible OrgTreeSidebar overlay.
 *
 * Tab content:
 * - COP: renders unified COPTab (map + AI layers + actor graph + activity feeds)
 * - Decide: renders DecideTab scoped to problem set daoId
 * - Design: renders DesignTab (problem set-scoped strategic docs)
 * - Campaign: renders CampaignTab (problem set-scoped missions)
 * - Overview: renders ProblemSetDashboard (simple dashboard alternative)
 *
 * Role gating: each role sees only its allowed tabs (see DEFAULT_TAB_ACCESS).
 * Unknown roles fall back to ['cop', 'overview'].
 *
 * Phase 21 Plan 12: Monitor tab removed; COP replaces it as the primary/default tab.
 * Phase 22 Plan 03: Train tab removed; training is now a global mode, not a problem set tab.
 *
 * Phase 20 Plan 04: Wired all tab panels with problemSetId prop injection
 * Phase 20 Plan 07: Tab notification badges + TabNotificationDropdown + CrossProblemSetLayerToggle
 * Phase 20 Plan 09: Backend-driven panel config with client-side fallback
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { problemSetService } from '../../lib/problem-set-service';
import { ProblemSetDashboard } from './ProblemSetDashboard';
import { OrgTreeSidebar } from './OrgTreeSidebar';
import { NotificationBadge } from './NotificationBadge';
import { TabNotificationDropdown } from './TabNotificationDropdown';
import { ProblemSetInviteModal } from './ProblemSetInviteModal';
import { DecideTab } from '../tabs/DecideTab';
import { DesignTab } from '../tabs/DesignTab';
import { CampaignTab } from '../tabs/CampaignTab';
import { COPTab } from '../cop/COPTab';
import { copService } from '../../lib/cop-service';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const PROBLEM_SET_TABS = ['cop', 'decide', 'design', 'campaign', 'overview'] as const;
type ProblemSetTab = typeof PROBLEM_SET_TABS[number];

const TAB_LABELS: Record<ProblemSetTab, string> = {
  cop: 'COP',
  decide: 'Decide',
  design: 'Design',
  campaign: 'Campaign',
  overview: 'Overview',
};

// ─── Role → tab access map ────────────────────────────────────────────────────

const DEFAULT_TAB_ACCESS: Record<string, ProblemSetTab[]> = {
  commander: ['cop', 'decide', 'design', 'campaign', 'overview'],
  xo: ['cop', 'decide', 'design', 'campaign', 'overview'],
  team_lead: ['cop', 'decide', 'campaign', 'overview'],
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

const FALLBACK_TABS: ProblemSetTab[] = ['cop', 'overview'];

// ─── ProblemSetTabContainer ────────────────────────────────────────────────────

export function ProblemSetTabContainer() {
  const { problemSetId, tab: urlTab } = useParams<{ problemSetId: string; tab?: string }>();
  const navigate = useNavigate();

  const {
    activeProblemSetId,
    activeProblemSet,
    userRoleInActive,
    memberships,
    loading,
    setActiveProblemSet,
    tabNotifications,
    crossProblemSetUpdates,
  } = useProblemSet();

  const { userDID } = useUser();

  // Panel config from backend (null = not loaded yet, use client defaults)
  const [panelConfig, setPanelConfig] = useState<Record<string, string[]> | null>(null);

  // Sidebar state
  const [orgTreeOpen, setOrgTreeOpen] = useState(false);
  // Dropdown state: which tab's notification dropdown is open (null = none)
  const [dropdownTab, setDropdownTab] = useState<string | null>(null);
  // Invite modal state (moved from ProblemSetDashboard)
  const [showInviteModal, setShowInviteModal] = useState(false);

  // COP team status (for badge in tab bar)
  const [copStatus, setCopStatus] = useState<{
    status: 'idle' | 'generating' | 'ready';
    layerCount: number;
  } | null>(null);

  // Sync URL problemSetId → context (same pattern as ProblemSetDashboard)
  useEffect(() => {
    if (problemSetId && problemSetId !== activeProblemSetId) {
      setActiveProblemSet(problemSetId);
    }
  }, [problemSetId, activeProblemSetId, setActiveProblemSet]);

  // Resolved problem set ID to pass into tab components (needed before guards)
  const resolvedId = problemSetId ?? activeProblemSetId;
  const displayId = resolvedId ?? '';

  // Fetch panel config from backend when problem set or user changes
  useEffect(() => {
    if (!displayId || !userDID) return;
    problemSetService.getPanelConfig(displayId, userDID)
      .then(config => setPanelConfig(config.panelVisibility))
      .catch(() => setPanelConfig(null)); // Fall back to client defaults on error
  }, [displayId, userDID]);

  // Poll COP status every 10 seconds for tab badge
  const fetchCopStatus = useCallback(async () => {
    if (!displayId) return;
    try {
      const status = await copService.getStatus(displayId);
      setCopStatus({ status: status.status, layerCount: status.layerCount });
    } catch {
      // Non-fatal — badge just won't show
    }
  }, [displayId]);

  useEffect(() => {
    if (!displayId) return;

    fetchCopStatus();
    const interval = setInterval(fetchCopStatus, 10_000);
    return () => clearInterval(interval);
  }, [displayId, fetchCopStatus]);

  // Derive visible tabs: use backend config if available, fall back to client defaults
  const visibleTabs = useMemo((): ProblemSetTab[] => {
    const source = panelConfig ?? DEFAULT_TAB_ACCESS;
    const tabs = source[userRoleInActive ?? 'member'] ?? FALLBACK_TABS;
    // Maintain fixed tab order — filter PROBLEM_SET_TABS by what's in tabs
    return PROBLEM_SET_TABS.filter(t => tabs.includes(t));
  }, [panelConfig, userRoleInActive]);

  // Resolve active tab from URL or default to 'overview'
  const resolvedTab = useMemo((): ProblemSetTab => {
    if (urlTab && PROBLEM_SET_TABS.includes(urlTab as ProblemSetTab)) {
      const t = urlTab as ProblemSetTab;
      // If role doesn't allow this tab, fall back to overview
      return visibleTabs.includes(t) ? t : 'cop';
    }
    return 'cop';
  }, [urlTab, visibleTabs]);

  const [activeTab, setActiveTab] = useState<ProblemSetTab>(resolvedTab);

  // Keep local state in sync with URL param changes
  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  // Redirect stale/invalid tab URLs (e.g., /problem-set/:id/train) to default tab
  useEffect(() => {
    if (urlTab && !PROBLEM_SET_TABS.includes(urlTab as ProblemSetTab) && problemSetId) {
      navigate(`/problem-set/${problemSetId}/cop`, { replace: true });
    }
  }, [urlTab, problemSetId, navigate]);

  function handleTabClick(tab: ProblemSetTab) {
    setActiveTab(tab);
    if (problemSetId) {
      navigate(`/problem-set/${problemSetId}/${tab}`, { replace: true });
    }
  }

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading problemSet...</p>
        </div>
      </div>
    );
  }

  if (!problemSetId && !activeProblemSetId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Problem Set Selected</h3>
        <p className="text-sm text-gray-500 mb-4">
          Select a problem set from the sidebar or create a new one.
        </p>
        <p className="text-xs text-gray-600">
          Use the problem set switcher in the sidebar to create one.
        </p>
      </div>
    );
  }

  const isMember = memberships.some((m) => m.problemSetId === resolvedId);

  if (resolvedId && !loading && memberships.length > 0 && !isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <div className="text-4xl mb-3">&#128274;</div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Access Denied</h3>
        <p className="text-sm text-gray-500">
          You are not a member of this problemSet.
        </p>
      </div>
    );
  }

  // ─── Tab content ──────────────────────────────────────────────────────────

  function renderTabContent() {
    if (activeTab === 'overview') {
      return <ProblemSetDashboard />;
    }
    if (activeTab === 'decide') {
      return <DecideTab problemSetId={displayId} daoId={activeProblemSet?.daoId} />;
    }
    if (activeTab === 'design') {
      return <DesignTab problemSetId={displayId} />;
    }
    if (activeTab === 'campaign') {
      return <CampaignTab problemSetId={displayId} />;
    }
    if (activeTab === 'cop') {
      return <COPTab problemSetId={displayId} />;
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
        aria-label="Problem Set tabs"
      >
        {/* Visible tabs in fixed order */}
        {PROBLEM_SET_TABS.filter((t) => visibleTabs.includes(t)).map((tab) => (
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
              {tab === 'cop' && copStatus && (
                <span
                  className={[
                    'ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                    copStatus.status === 'generating'
                      ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                      : copStatus.status === 'ready'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-500',
                  ].join(' ')}
                  title={
                    copStatus.status === 'generating'
                      ? 'AI COP team is generating layers...'
                      : copStatus.status === 'ready'
                      ? `${copStatus.layerCount} COP layer${copStatus.layerCount !== 1 ? 's' : ''} ready`
                      : 'AI COP team idle'
                  }
                >
                  {copStatus.status === 'generating' ? 'AI' : copStatus.status === 'ready' ? copStatus.layerCount : ''}
                </span>
              )}
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
                updates={crossProblemSetUpdates}
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
            to={`/problem-set/${displayId}/members`}
            className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Members
          </Link>
          <Link
            to={`/problem-set/${displayId}/directory`}
            className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Directory
          </Link>
          <Link
            to={`/problem-set/${displayId}/settings`}
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
        <ProblemSetInviteModal
          problemSetId={displayId}
          problemSetName={activeProblemSet?.name ?? 'Problem Set'}
          onClose={() => setShowInviteModal(false)}
        />
      )}

    </div>
  );
}

export default ProblemSetTabContainer;
