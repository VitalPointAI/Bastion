/**
 * ProblemSetContext
 *
 * Provides active problem set state, user memberships, role derivation,
 * and notification count polling across the application.
 *
 * - Loads memberships on auth
 * - Defaults active problem set to primary (or first)
 * - Polls notification counts every 5 seconds
 * - Pauses polling when tab is hidden
 * - Persists active problem set and last-seen timestamps in localStorage
 * - Migrates old workspace-* localStorage keys on first load
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
  problemSetService,
  type ProblemSetMembership,
  type ProblemSetDetail,
} from '../lib/problem-set-service';
import { useUser } from './UserContext';
import { useMode } from './ModeContext';

// ─── localStorage Migration ──────────────────────────────────────────────────

function migrateLocalStorageKeys(): void {
  const migrated = localStorage.getItem('ps-migration-done');
  if (migrated) return;

  const migrations: [string, string][] = [
    ['workspace-active-id-training', 'problem-set-active-id-training'],
    ['workspace-active-id-operational', 'problem-set-active-id-operational'],
    ['workspace-last-seen', 'problem-set-last-seen'],
  ];

  for (const [oldKey, newKey] of migrations) {
    const value = localStorage.getItem(oldKey);
    if (value !== null) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  }

  localStorage.setItem('ps-migration-done', '1');
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const ACTIVE_PROBLEM_SET_KEY_BASE = 'problem-set-active-id';
const LAST_SEEN_KEY = 'problem-set-last-seen';

/** Returns mode-specific localStorage key for active problem set persistence */
function getActiveProblemSetKey(mode: string): string {
  return `${ACTIVE_PROBLEM_SET_KEY_BASE}-${mode}`;
}

// ─── Cross-Problem-Set Types ─────────────────────────────────────────────────

export interface CrossProblemSetUpdate {
  sourceProblemSetId: string;
  sourceProblemSetName: string;
  tab: string;
  updateType: 'new_directive' | 'data_change' | 'escalation';
  summary: string;
  actionableItemId: string;
  timestamp: string;
}

// ─── Context Type ─────────────────────────────────────────────────────────────

interface ProblemSetContextType {
  // State
  activeProblemSetId: string | null;
  memberships: ProblemSetMembership[];
  activeProblemSet: ProblemSetDetail | null;
  userRoleInActive: string | null;
  primaryProblemSetId: string | null;
  notificationCounts: Record<string, number>;
  tabNotifications: Record<string, number>;
  crossProblemSetUpdates: CrossProblemSetUpdate[];
  loading: boolean;

  // Actions
  setActiveProblemSet: (id: string) => void;
  refreshMemberships: () => Promise<void>;
  refreshActiveProblemSet: () => Promise<void>;
  clearTabNotifications: (tab: string) => void;
  refreshCrossProblemSetData: () => Promise<void>;
}

// ─── Context Default ──────────────────────────────────────────────────────────

const defaultContext: ProblemSetContextType = {
  activeProblemSetId: null,
  memberships: [],
  activeProblemSet: null,
  userRoleInActive: null,
  primaryProblemSetId: null,
  notificationCounts: {},
  tabNotifications: {},
  crossProblemSetUpdates: [],
  loading: false,
  setActiveProblemSet: () => undefined,
  refreshMemberships: async () => undefined,
  refreshActiveProblemSet: async () => undefined,
  clearTabNotifications: () => undefined,
  refreshCrossProblemSetData: async () => undefined,
};

const ProblemSetContext = createContext<ProblemSetContextType>(defaultContext);

// ─── Helper: Read last-seen map from localStorage ───────────────────────────

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

export function ProblemSetProvider({ children }: { children: ReactNode }) {
  // Run localStorage migration before any state initialization
  migrateLocalStorageKeys();

  const { userDID, isAuthenticated } = useUser();
  const { mode } = useMode();

  const [memberships, setMemberships] = useState<ProblemSetMembership[]>([]);
  const [activeProblemSetId, setActiveProblemSetIdState] = useState<string | null>(null);
  const [activeProblemSetDetail, setActiveProblemSetDetail] = useState<ProblemSetDetail | null>(null);
  const [notificationCounts, setNotificationCounts] = useState<Record<string, number>>({});
  const [tabNotifications, setTabNotifications] = useState<Record<string, number>>({});
  const [crossProblemSetUpdates, setCrossProblemSetUpdates] = useState<CrossProblemSetUpdate[]>([]);
  const [loading, setLoading] = useState(false);

  // Track whether tab is visible for polling
  const isVisibleRef = useRef(true);
  // Store interval id for cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const primaryProblemSetId =
    memberships.find((m) => m.isPrimary)?.problemSetId ?? null;

  const userRoleInActive = activeProblemSetId
    ? (memberships.find((m) => m.problemSetId === activeProblemSetId)?.role ?? null)
    : null;

  // ─── Load memberships ───────────────────────────────────────────────────────

  const loadMemberships = useCallback(async () => {
    if (!isAuthenticated || !userDID) return;
    setLoading(true);
    try {
      const result = await problemSetService.listMyMemberships(userDID, mode);
      setMemberships(result);

      // If active problem set is no longer in the filtered list, clear it
      if (activeProblemSetId && !result.some((m) => m.problemSetId === activeProblemSetId)) {
        setActiveProblemSetIdState(null);
        setActiveProblemSetDetail(null);
        localStorage.removeItem(getActiveProblemSetKey(mode));
      }

      return result;
    } catch {
      // Silently fail — user may have no memberships yet
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userDID, mode, activeProblemSetId]);

  const refreshMemberships = useCallback(async () => {
    await loadMemberships();
  }, [loadMemberships]);

  // ─── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated || !userDID) {
      setMemberships([]);
      setActiveProblemSetIdState(null);
      setActiveProblemSetDetail(null);
      setNotificationCounts({});
      setTabNotifications({});
      setCrossProblemSetUpdates([]);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const result = await problemSetService.listMyMemberships(userDID, mode);
        setMemberships(result);

        // Determine initial active problem set (mode-keyed persistence)
        const modeKey = getActiveProblemSetKey(mode);
        const savedId = localStorage.getItem(modeKey);
        const savedValid = savedId && result.some((m) => m.problemSetId === savedId);

        const primary = result.find((m) => m.isPrimary);
        const firstMembership = result[0];

        const initialId = savedValid
          ? savedId
          : (primary?.problemSetId ?? firstMembership?.problemSetId ?? null);

        if (initialId) {
          setActiveProblemSetIdState(initialId);
          localStorage.setItem(modeKey, initialId);
        } else {
          // No problem sets in this mode — clear active
          setActiveProblemSetIdState(null);
          setActiveProblemSetDetail(null);
          localStorage.removeItem(modeKey);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, userDID, mode]);

  // ─── Load active problem set details ────────────────────────────────────────

  const refreshActiveProblemSet = useCallback(async () => {
    if (!activeProblemSetId || !userDID) return;
    try {
      const detail = await problemSetService.getProblemSet(activeProblemSetId, userDID);
      setActiveProblemSetDetail(detail);
    } catch {
      setActiveProblemSetDetail(null);
    }
  }, [activeProblemSetId, userDID]);

  useEffect(() => {
    void refreshActiveProblemSet();
  }, [refreshActiveProblemSet]);

  // ─── Notification polling ───────────────────────────────────────────────────

  const pollNotifications = useCallback(async () => {
    if (!userDID || !isAuthenticated || !isVisibleRef.current) return;
    if (memberships.length === 0) return;

    try {
      const lastSeenMap = readLastSeenMap();
      const counts = await problemSetService.getNotificationCounts(lastSeenMap, userDID);
      setNotificationCounts(counts);
    } catch {
      // Silently fail — polling errors should not disrupt UX
    }

    // Derive tab-level notifications from cross-problem-set activity types.
    // Uses the active problem set's activity feed filtered for cross-problem-set events.
    if (activeProblemSetId) {
      try {
        const { activities } = await problemSetService.listActivity(activeProblemSetId, userDID, { limit: 50 });

        // Map activity types to tab names for badge counts
        const activityTypeToTab: Record<string, string> = {
          escalation_received: 'direct',
          directive_received: 'direct',
          data_change: 'understand',
          subscription_approved: 'understand',
          subscription_rejected: 'understand',
        };

        const crossProblemSetActivityTypes = new Set(Object.keys(activityTypeToTab));
        const crossActivities = activities.filter((a) => crossProblemSetActivityTypes.has(a.activityType));

        // Derive tab notification counts from unread cross-problem-set activities
        const tabCounts: Record<string, number> = {};
        const updates: CrossProblemSetUpdate[] = [];

        for (const activity of crossActivities) {
          const tab = activityTypeToTab[activity.activityType];
          if (tab) {
            tabCounts[tab] = (tabCounts[tab] ?? 0) + 1;
          }

          // Build CrossProblemSetUpdate items for actionable directives and escalations
          if (activity.activityType === 'escalation_received' || activity.activityType === 'directive_received') {
            const meta = activity.metadata as {
              sourceProblemSetId?: string;
              sourceProblemSetName?: string;
              summary?: string;
              itemId?: string;
            };
            updates.push({
              sourceProblemSetId: meta.sourceProblemSetId ?? '',
              sourceProblemSetName: meta.sourceProblemSetName ?? 'Unknown Problem Set',
              tab: activityTypeToTab[activity.activityType] ?? 'understand',
              updateType: activity.activityType === 'escalation_received' ? 'escalation' : 'new_directive',
              summary: meta.summary ?? activity.activityType,
              actionableItemId: meta.itemId ?? activity.id,
              timestamp: activity.createdAt,
            });
          }
        }

        setTabNotifications(tabCounts);
        setCrossProblemSetUpdates(updates);
      } catch {
        // Silently fail — tab notification errors should not disrupt UX
      }
    }
  }, [userDID, isAuthenticated, memberships, activeProblemSetId]);

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

  // ─── setActiveProblemSet action ─────────────────────────────────────────────

  const setActiveProblemSet = useCallback(
    (id: string) => {
      // Update last-seen timestamp for the problem set being left
      if (activeProblemSetId && activeProblemSetId !== id) {
        const lastSeenMap = readLastSeenMap();
        lastSeenMap[activeProblemSetId] = new Date().toISOString();
        writeLastSeenMap(lastSeenMap);
      }

      setActiveProblemSetIdState(id);
      localStorage.setItem(getActiveProblemSetKey(mode), id);
    },
    [activeProblemSetId, mode]
  );

  // ─── Tab notification actions ──────────────────────────────────────────────

  const clearTabNotifications = useCallback((tab: string) => {
    setTabNotifications(prev => ({ ...prev, [tab]: 0 }));
  }, []);

  const refreshCrossProblemSetData = useCallback(async () => {
    if (!activeProblemSetId || !userDID) return;
    // Future: fetch from dedicated cross-problem-set data endpoints
    // For now, trigger a re-poll of notifications which includes cross-problem-set activity
    await pollNotifications();
  }, [activeProblemSetId, userDID, pollNotifications]);

  // ─── Context value ──────────────────────────────────────────────────────────

  const value: ProblemSetContextType = {
    activeProblemSetId,
    memberships,
    activeProblemSet: activeProblemSetDetail,
    userRoleInActive,
    primaryProblemSetId,
    notificationCounts,
    tabNotifications,
    crossProblemSetUpdates,
    loading,
    setActiveProblemSet,
    refreshMemberships,
    refreshActiveProblemSet,
    clearTabNotifications,
    refreshCrossProblemSetData,
  };

  return (
    <ProblemSetContext.Provider value={value}>
      {children}
    </ProblemSetContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const useProblemSet = () => useContext(ProblemSetContext);
