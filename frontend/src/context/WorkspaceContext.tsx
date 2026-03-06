/**
 * WorkspaceContext
 *
 * Provides active workspace state, user memberships, role derivation,
 * and notification count polling across the application.
 *
 * - Loads memberships on auth
 * - Defaults active workspace to primary (or first)
 * - Polls notification counts every 5 seconds
 * - Pauses polling when tab is hidden
 * - Persists active workspace and last-seen timestamps in localStorage
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  workspaceService,
  type WorkspaceMembership,
  type WorkspaceDetail,
} from '../lib/workspace-service';
import { useUser } from './UserContext';
import { useMode } from './ModeContext';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const ACTIVE_WORKSPACE_KEY_BASE = 'workspace-active-id';
const LAST_SEEN_KEY = 'workspace-last-seen';

/** Returns mode-specific localStorage key for active workspace persistence */
function getActiveWorkspaceKey(mode: string): string {
  return `${ACTIVE_WORKSPACE_KEY_BASE}-${mode}`;
}

// ─── Cross-Workspace Types ────────────────────────────────────────────────────

export interface CrossWorkspaceUpdate {
  sourceWorkspaceId: string;
  sourceWorkspaceName: string;
  tab: string;
  updateType: 'new_directive' | 'data_change' | 'escalation';
  summary: string;
  actionableItemId: string;
  timestamp: string;
}

// ─── Context Type ─────────────────────────────────────────────────────────────

interface WorkspaceContextType {
  // State
  activeWorkspaceId: string | null;
  memberships: WorkspaceMembership[];
  activeWorkspace: WorkspaceDetail | null;
  userRoleInActive: string | null;
  primaryWorkspaceId: string | null;
  notificationCounts: Record<string, number>;
  tabNotifications: Record<string, number>;
  crossWorkspaceUpdates: CrossWorkspaceUpdate[];
  loading: boolean;

  // Actions
  setActiveWorkspace: (id: string) => void;
  refreshMemberships: () => Promise<void>;
  refreshActiveWorkspace: () => Promise<void>;
  clearTabNotifications: (tab: string) => void;
  refreshCrossWorkspaceData: () => Promise<void>;
}

// ─── Context Default ──────────────────────────────────────────────────────────

const defaultContext: WorkspaceContextType = {
  activeWorkspaceId: null,
  memberships: [],
  activeWorkspace: null,
  userRoleInActive: null,
  primaryWorkspaceId: null,
  notificationCounts: {},
  tabNotifications: {},
  crossWorkspaceUpdates: [],
  loading: false,
  setActiveWorkspace: () => undefined,
  refreshMemberships: async () => undefined,
  refreshActiveWorkspace: async () => undefined,
  clearTabNotifications: () => undefined,
  refreshCrossWorkspaceData: async () => undefined,
};

const WorkspaceContext = createContext<WorkspaceContextType>(defaultContext);

// ─── Helper: Read last-seen map from localStorage ─────────────────────────────

function readLastSeenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeLastSeenMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { userDID, isAuthenticated } = useUser();
  const { mode } = useMode();

  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [activeWorkspaceDetail, setActiveWorkspaceDetail] = useState<WorkspaceDetail | null>(null);
  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({});
  const [tabNotifications, setTabNotifications] = useState<Record<string, number>>({});
  const [crossWorkspaceUpdates, setCrossWorkspaceUpdates] = useState<CrossWorkspaceUpdate[]>([]);
  const [loading, setLoading] = useState(false);

  // Track whether tab is visible for polling
  const isVisibleRef = useRef(true);
  // Store interval id for cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const primaryWorkspaceId =
    memberships.find((m) => m.isPrimary)?.workspaceId ?? null;

  const userRoleInActive = activeWorkspaceId
    ? (memberships.find((m) => m.workspaceId === activeWorkspaceId)?.role ?? null)
    : null;

  // ─── Load memberships ───────────────────────────────────────────────────────

  const loadMemberships = useCallback(async () => {
    if (!isAuthenticated || !userDID) return;
    setLoading(true);
    try {
      const result = await workspaceService.listMyMemberships(userDID, mode);
      setMemberships(result);

      // If active workspace is no longer in the filtered list, clear it
      if (activeWorkspaceId && !result.some((m) => m.workspaceId === activeWorkspaceId)) {
        setActiveWorkspaceIdState(null);
        setActiveWorkspaceDetail(null);
        localStorage.removeItem(getActiveWorkspaceKey(mode));
      }

      return result;
    } catch {
      // Silently fail — user may have no memberships yet
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userDID, mode, activeWorkspaceId]);

  const refreshMemberships = useCallback(async () => {
    await loadMemberships();
  }, [loadMemberships]);

  // ─── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !userDID) {
      setMemberships([]);
      setActiveWorkspaceIdState(null);
      setActiveWorkspaceDetail(null);
      setNotificationCounts({});
      setTabNotifications({});
      setCrossWorkspaceUpdates([]);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const result = await workspaceService.listMyMemberships(userDID, mode);
        setMemberships(result);

        // Determine initial active workspace (mode-keyed persistence)
        const modeKey = getActiveWorkspaceKey(mode);
        const savedId = localStorage.getItem(modeKey);
        const savedValid = savedId && result.some((m) => m.workspaceId === savedId);

        const primary = result.find((m) => m.isPrimary);
        const firstMembership = result[0];

        const initialId = savedValid
          ? savedId
          : (primary?.workspaceId ?? firstMembership?.workspaceId ?? null);

        if (initialId) {
          setActiveWorkspaceIdState(initialId);
          localStorage.setItem(modeKey, initialId);
        } else {
          // No workspaces in this mode — clear active
          setActiveWorkspaceIdState(null);
          setActiveWorkspaceDetail(null);
          localStorage.removeItem(modeKey);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, userDID, mode]);

  // ─── Load active workspace details ──────────────────────────────────────────

  const refreshActiveWorkspace = useCallback(async () => {
    if (!activeWorkspaceId || !userDID) return;
    try {
      const detail = await workspaceService.getWorkspace(activeWorkspaceId, userDID);
      setActiveWorkspaceDetail(detail);
    } catch {
      setActiveWorkspaceDetail(null);
    }
  }, [activeWorkspaceId, userDID]);

  useEffect(() => {
    void refreshActiveWorkspace();
  }, [refreshActiveWorkspace]);

  // ─── Notification polling ───────────────────────────────────────────────────

  const pollNotifications = useCallback(async () => {
    if (!userDID || !isAuthenticated || !isVisibleRef.current) return;
    if (memberships.length === 0) return;

    try {
      const lastSeenMap = readLastSeenMap();
      const counts = await workspaceService.getNotificationCounts(lastSeenMap, userDID);
      setNotificationCounts(counts);
    } catch {
      // Silently fail — polling errors should not disrupt UX
    }

    // Derive tab-level notifications from cross-workspace activity types.
    // Uses the active workspace's activity feed filtered for cross-workspace events.
    if (activeWorkspaceId) {
      try {
        const { activities } = await workspaceService.listActivity(activeWorkspaceId, userDID, { limit: 50 });

        // Map activity types to tab names for badge counts
        const activityTypeToTab: Record<string, string> = {
          escalation_received: 'escalations',
          directive_received: 'directives',
          data_change: 'intelligence',
          subscription_approved: 'intelligence',
          subscription_rejected: 'intelligence',
        };

        const crossWorkspaceActivityTypes = new Set(Object.keys(activityTypeToTab));
        const crossActivities = activities.filter((a) => crossWorkspaceActivityTypes.has(a.activityType));

        // Derive tab notification counts from unread cross-workspace activities
        const tabCounts: Record<string, number> = {};
        const updates: CrossWorkspaceUpdate[] = [];

        for (const activity of crossActivities) {
          const tab = activityTypeToTab[activity.activityType];
          if (tab) {
            tabCounts[tab] = (tabCounts[tab] ?? 0) + 1;
          }

          // Build CrossWorkspaceUpdate items for actionable directives and escalations
          if (activity.activityType === 'escalation_received' || activity.activityType === 'directive_received') {
            const meta = activity.metadata as {
              sourceWorkspaceId?: string;
              sourceWorkspaceName?: string;
              summary?: string;
              itemId?: string;
            };
            updates.push({
              sourceWorkspaceId: meta.sourceWorkspaceId ?? '',
              sourceWorkspaceName: meta.sourceWorkspaceName ?? 'Unknown Workspace',
              tab: activityTypeToTab[activity.activityType] ?? 'intelligence',
              updateType: activity.activityType === 'escalation_received' ? 'escalation' : 'new_directive',
              summary: meta.summary ?? activity.activityType,
              actionableItemId: meta.itemId ?? activity.id,
              timestamp: activity.createdAt,
            });
          }
        }

        setTabNotifications(tabCounts);
        setCrossWorkspaceUpdates(updates);
      } catch {
        // Silently fail — tab notification errors should not disrupt UX
      }
    }
  }, [userDID, isAuthenticated, memberships, activeWorkspaceId]);

  // Set up polling interval
  useEffect(() => {
    if (!isAuthenticated || !userDID) return;

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => {
        void pollNotifications();
      }, 5000);
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisibleRef.current = false;
        stopPolling();
      } else {
        isVisibleRef.current = true;
        void pollNotifications();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [isAuthenticated, userDID, pollNotifications]);

  // ─── setActiveWorkspace action ──────────────────────────────────────────────

  const setActiveWorkspace = useCallback(
    (id: string) => {
      // Update last-seen timestamp for the workspace being left
      if (activeWorkspaceId && activeWorkspaceId !== id) {
        const lastSeenMap = readLastSeenMap();
        lastSeenMap[activeWorkspaceId] = new Date().toISOString();
        writeLastSeenMap(lastSeenMap);
      }

      setActiveWorkspaceIdState(id);
      localStorage.setItem(getActiveWorkspaceKey(mode), id);
    },
    [activeWorkspaceId, mode]
  );

  // ─── Tab notification actions ────────────────────────────────────────────────

  const clearTabNotifications = useCallback((tab: string) => {
    setTabNotifications(prev => ({ ...prev, [tab]: 0 }));
  }, []);

  const refreshCrossWorkspaceData = useCallback(async () => {
    if (!activeWorkspaceId || !userDID) return;
    // Future: fetch from dedicated cross-workspace data endpoints
    // For now, trigger a re-poll of notifications which includes cross-workspace activity
    await pollNotifications();
  }, [activeWorkspaceId, userDID, pollNotifications]);

  // ─── Context value ──────────────────────────────────────────────────────────

  const value: WorkspaceContextType = {
    activeWorkspaceId,
    memberships,
    activeWorkspace: activeWorkspaceDetail,
    userRoleInActive,
    primaryWorkspaceId,
    notificationCounts,
    tabNotifications,
    crossWorkspaceUpdates,
    loading,
    setActiveWorkspace,
    refreshMemberships,
    refreshActiveWorkspace,
    clearTabNotifications,
    refreshCrossWorkspaceData,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => useContext(WorkspaceContext);
