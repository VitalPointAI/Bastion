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

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const ACTIVE_WORKSPACE_KEY = 'workspace-active-id';
const LAST_SEEN_KEY = 'workspace-last-seen';

// ─── Context Type ─────────────────────────────────────────────────────────────

interface WorkspaceContextType {
  // State
  activeWorkspaceId: string | null;
  memberships: WorkspaceMembership[];
  activeWorkspace: WorkspaceDetail | null;
  userRoleInActive: string | null;
  primaryWorkspaceId: string | null;
  notificationCounts: Record<string, number>;
  loading: boolean;

  // Actions
  setActiveWorkspace: (id: string) => void;
  refreshMemberships: () => Promise<void>;
  refreshActiveWorkspace: () => Promise<void>;
}

// ─── Context Default ──────────────────────────────────────────────────────────

const defaultContext: WorkspaceContextType = {
  activeWorkspaceId: null,
  memberships: [],
  activeWorkspace: null,
  userRoleInActive: null,
  primaryWorkspaceId: null,
  notificationCounts: {},
  loading: false,
  setActiveWorkspace: () => undefined,
  refreshMemberships: async () => undefined,
  refreshActiveWorkspace: async () => undefined,
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

  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [activeWorkspaceDetail, setActiveWorkspaceDetail] = useState<WorkspaceDetail | null>(null);
  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({});
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
      const result = await workspaceService.listMyMemberships(userDID);
      setMemberships(result);
      return result;
    } catch {
      // Silently fail — user may have no memberships yet
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userDID]);

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
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const result = await workspaceService.listMyMemberships(userDID);
        setMemberships(result);

        // Determine initial active workspace
        const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        const savedValid = savedId && result.some((m) => m.workspaceId === savedId);

        const primary = result.find((m) => m.isPrimary);
        const firstMembership = result[0];

        const initialId = savedValid
          ? savedId
          : (primary?.workspaceId ?? firstMembership?.workspaceId ?? null);

        if (initialId) {
          setActiveWorkspaceIdState(initialId);
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, initialId);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, userDID]);

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
  }, [userDID, isAuthenticated, memberships]);

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
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    },
    [activeWorkspaceId]
  );

  // ─── Context value ──────────────────────────────────────────────────────────

  const value: WorkspaceContextType = {
    activeWorkspaceId,
    memberships,
    activeWorkspace: activeWorkspaceDetail,
    userRoleInActive,
    primaryWorkspaceId,
    notificationCounts,
    loading,
    setActiveWorkspace,
    refreshMemberships,
    refreshActiveWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useWorkspace = () => useContext(WorkspaceContext);
