/**
 * ProblemSetTabContainer
 *
 * Shell component that renders problem set tabs. Horizontal tab bar
 * (Understand | Design | Plan | Direct | COP | Assess) with URL-driven
 * tab state and a collapsible OrgTreeSidebar overlay.
 *
 * Tab content:
 * - Understand: renders UnderstandTab (JP 5-0 Step 1 — mission analysis, intel, OE)
 * - Design: renders DesignTab (JP 5-0 Operational Art — approaches, CoGs, objectives)
 * - Plan: renders PlanTab (JP 5-0 Step 3 — COA development, war-gaming, comparison)
 * - Decide: renders DecideTab (JP 5-0 decision dashboard — RACI-aware, approve/reject/defer/info)
 * - COP: renders unified COPTab (map + AI layers + actor graph + activity feeds)
 * - Assess: renders AssessTab (JP 5-0 continuous — MOEs, MOPs, reframing)
 *
 * All roles see all 6 tabs (Phase 24 decision — can restore per-role gating later).
 * Unknown roles fall back to ['cop', 'assess'].
 *
 * Phase 24 Plan 02: Doctrinal tab restructure — 6 JP 5-0-aligned tabs replace old structure.
 * Phase 20 Plan 04: Wired all tab panels with problemSetId prop injection
 * Phase 20 Plan 07: Tab notification badges + TabNotificationDropdown + CrossProblemSetLayerToggle
 * Phase 20 Plan 09: Backend-driven panel config with client-side fallback
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { problemSetService } from '../../lib/problem-set-service';
import { OrgTreeSidebar } from './OrgTreeSidebar';
import { NotificationBadge } from './NotificationBadge';
import { TabNotificationDropdown } from './TabNotificationDropdown';
// ProblemSetInviteModal moved to ProblemSetMemberManager (manage members screen)
import { UnderstandTab } from '../tabs/UnderstandTab';
import { DesignTab } from '../tabs/DesignTab';
import { PlanTab } from '../tabs/PlanTab';
import { DecideTab } from '../tabs/DecideTab';
import { COPTab } from '../cop/COPTab';
import { AssessEchelonRouter } from '../assess/AssessEchelonRouter';
import { copService } from '../../lib/cop-service';
import { inheritanceApi } from '../../lib/inheritance-service';
import { DecisionGateProvider } from '../../context/DecisionGateContext';
import { useMode } from '../../context/ModeContext';
import { ResourcesTab } from '../resources/ResourcesTab';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const PROBLEM_SET_TABS = ['understand', 'design', 'plan', 'decide', 'cop', 'assess', 'resources'] as const;
type ProblemSetTab = typeof PROBLEM_SET_TABS[number];

const TAB_LABELS: Record<ProblemSetTab, string> = {
  understand: 'Understand',
  design: 'Design',
  plan: 'Plan',
  decide: 'Decide',
  cop: 'COP',
  assess: 'Assess',
  resources: 'Resources',
};

// ─── Role → tab access map ────────────────────────────────────────────────────

// All roles see all tabs (Phase 24 decision — can restore per-role gating later)
const ALL_TABS_LIST: ProblemSetTab[] = ['understand', 'design', 'plan', 'decide', 'cop', 'assess', 'resources'];
const DEFAULT_TAB_ACCESS: Record<string, ProblemSetTab[]> = {
  commander: ALL_TABS_LIST,
  xo: ALL_TABS_LIST,
  team_lead: ALL_TABS_LIST,
  s2: ALL_TABS_LIST,
  s3: ALL_TABS_LIST,
  s4: ALL_TABS_LIST,
  s5: ALL_TABS_LIST,
  s6: ALL_TABS_LIST,
  s7: ALL_TABS_LIST,
  s8: ALL_TABS_LIST,
  s9: ALL_TABS_LIST,
  member: ALL_TABS_LIST,
  observer: ALL_TABS_LIST,
};

const FALLBACK_TABS: ProblemSetTab[] = ['cop', 'assess'];

// ─── Old URL redirects ────────────────────────────────────────────────────────

const OLD_TAB_REDIRECTS: Record<string, ProblemSetTab> = {
  'direct': 'decide',
  'campaign': 'plan',
  'overview': 'cop',
  'monitor': 'cop',
  'train': 'cop',
};

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
  const { isTraining } = useMode();

  // Panel config from backend (null = not loaded yet, use client defaults)
  const [panelConfig, setPanelConfig] = useState<Record<string, string[]> | null>(null);

  // Sidebar state
  const [orgTreeOpen, setOrgTreeOpen] = useState(false);
  // Dropdown state: which tab's notification dropdown is open (null = none)
  const [dropdownTab, setDropdownTab] = useState<string | null>(null);
  // Invite modal moved to ProblemSetMemberManager (manage members screen)

  // COP team status (for badge in tab bar)
  const [copStatus, setCopStatus] = useState<{
    status: 'idle' | 'generating' | 'ready';
    layerCount: number;
  } | null>(null);

  // Inheritance notification count for Understand tab badge
  const [inheritanceNotificationCount, setInheritanceNotificationCount] = useState(0);

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

  // Poll inheritance notification counts for Understand tab badge (30s interval)
  const fetchInheritanceCounts = useCallback(async () => {
    if (!displayId) return;
    try {
      const counts = await inheritanceApi.getNotificationCounts(displayId);
      setInheritanceNotificationCount(counts.total);
    } catch {
      // Non-fatal — badge just won't show
    }
  }, [displayId]);

  useEffect(() => {
    if (!displayId) return;

    fetchInheritanceCounts();
    const interval = setInterval(fetchInheritanceCounts, 30_000);
    return () => clearInterval(interval);
  }, [displayId, fetchInheritanceCounts]);

  // Derive visible tabs: use backend config if available, fall back to client defaults
  const visibleTabs = useMemo((): ProblemSetTab[] => {
    const source = panelConfig ?? DEFAULT_TAB_ACCESS;
    const rawTabs = source[userRoleInActive ?? 'member'] ?? FALLBACK_TABS;
    // Normalize old tab names from stored configs (direct → decide)
    const tabs = rawTabs.map(t => (OLD_TAB_REDIRECTS[t] as ProblemSetTab) ?? t);
    // Maintain fixed tab order — filter PROBLEM_SET_TABS by what's in tabs
    return PROBLEM_SET_TABS.filter(t => tabs.includes(t));
  }, [panelConfig, userRoleInActive]);

  // Resolve active tab from URL or default to 'cop'
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

  // Redirect old/invalid tab URLs to appropriate new tabs
  useEffect(() => {
    if (urlTab && !PROBLEM_SET_TABS.includes(urlTab as ProblemSetTab) && problemSetId) {
      const redirect = OLD_TAB_REDIRECTS[urlTab] ?? 'cop';
      navigate(`/problem-set/${problemSetId}/${redirect}`, { replace: true });
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

  // If finished loading and user has no memberships at all, show empty state
  if (!loading && memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">No Problem Sets</h3>
        <p className="text-sm text-gray-500 mb-4">
          You don't have any problem set memberships yet.
        </p>
        <p className="text-xs text-gray-600">
          Return to the home page to create or join a problem set.
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
    switch (activeTab) {
      case 'understand':
        return <UnderstandTab problemSetId={displayId} />;
      case 'design':
        return <DesignTab problemSetId={displayId} />;
      case 'plan':
        return <PlanTab problemSetId={displayId} daoId={activeProblemSet?.daoId} />;
      case 'decide':
        return <DecideTab problemSetId={displayId} daoId={activeProblemSet?.daoId} />;
      case 'cop':
        return <COPTab problemSetId={displayId} />;
      case 'assess':
        return <AssessEchelonRouter problemSetId={displayId} />;
      case 'resources':
        return <ResourcesTab problemSetId={displayId} />;
      default:
        return null;
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    <div className={['flex flex-col flex-1 min-h-0 bg-gray-900', isTraining ? 'border-t-2 border-amber-500/40' : ''].join(' ')}>

      {/* Horizontal tab bar */}
      <nav
        className={[
          'flex border-b shrink-0 overflow-x-auto',
          isTraining
            ? 'bg-amber-900/30 border-amber-700/50'
            : 'bg-gray-800 border-gray-700',
        ].join(' ')}
        role="tablist"
        aria-label="Problem Set tabs"
        style={{ scrollbarWidth: 'none' }}
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
              {isTraining && (tab === 'understand' || tab === 'assess') && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="Content differs in training mode" />
              )}
              {tab === 'understand' && inheritanceNotificationCount > 0 && (
                <span className="ml-1 inline-block relative align-middle">
                  <NotificationBadge count={inheritanceNotificationCount} />
                </span>
              )}
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
          <Link
            to={`/problem-set/${displayId}/members`}
            className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
          >
            Members
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
      <DecisionGateProvider problemSetId={displayId}>
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex flex-col flex-1 overflow-hidden min-h-0" data-tab-content>
            {renderTabContent()}
          </div>
        </div>
      </DecisionGateProvider>

      {/* Floating AI Activity panel — rendered via portal, position independent */}
      {/* OrgTreeSidebar — rendered outside tab content to avoid overflow clipping */}
      {orgTreeOpen && <OrgTreeSidebar onClose={() => setOrgTreeOpen(false)} />}

    </div>
    </>
  );
}

export default ProblemSetTabContainer;
