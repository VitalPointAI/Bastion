import { useState, useCallback, useEffect, useRef } from 'react';

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A proactive pattern alert surfaced by the AI analysis pipeline */
export interface PatternAlert {
  /** Unique alert identifier */
  id: string;
  /** Nature of the detected pattern */
  type: 'trend' | 'anomaly' | 'correlation';
  /** Human-readable description of the detected pattern */
  message: string;
  /** Impact severity — drives color coding */
  severity: 'low' | 'medium' | 'high';
  /** ISO timestamp when the pattern was detected */
  detectedAt: string;
  /** IDs of brain nodes related to this pattern — used to highlight them */
  relatedNodeIds: string[];
}

export interface UseBrainPatternsReturn {
  /** All pattern alerts for this problem set */
  alerts: PatternAlert[];
  /** true while the alerts are being fetched */
  loading: boolean;
  /** Number of alerts that haven't been read yet */
  unreadCount: number;
  /** Mark a single alert as read */
  markAsRead: (alertId: string) => void;
  /** Mark all current alerts as read */
  markAllAsRead: () => void;
  /** Manually trigger a refresh */
  refetch: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Auto-refetch interval in milliseconds (5 minutes) */
const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useBrainPatterns
 *
 * Fetches proactive pattern alerts for a problem set and manages read/unread
 * state in sessionStorage so the badge count persists across re-renders but
 * resets when the browser tab is closed.
 *
 * Pattern alerts represent AI-detected trends, anomalies, and correlations
 * that the analyst may not have noticed yet.
 */
export function useBrainPatterns(problemSetId: string): UseBrainPatternsReturn {
  const [alerts, setAlerts] = useState<PatternAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() => {
    // Restore read state from sessionStorage on mount
    try {
      const stored = sessionStorage.getItem(
        `brain-pattern-read:${problemSetId}`,
      );
      if (stored) {
        return new Set<string>(JSON.parse(stored) as string[]);
      }
    } catch {
      // Ignore parse errors
    }
    return new Set<string>();
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Persist read IDs to sessionStorage whenever they change ───────────────

  useEffect(() => {
    try {
      sessionStorage.setItem(
        `brain-pattern-read:${problemSetId}`,
        JSON.stringify([...readAlertIds]),
      );
    } catch {
      // SessionStorage may be unavailable (private browsing quota) — degrade gracefully
    }
  }, [readAlertIds, problemSetId]);

  // ── Fetch pattern alerts ───────────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    if (!problemSetId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/brain/pattern-alerts?problemSetId=${encodeURIComponent(problemSetId)}`,
      );
      if (!res.ok) throw new Error(`pattern-alerts ${res.status}`);
      const data = await res.json();
      // API returns { alerts: [...] } wrapper
      const list = Array.isArray(data) ? data : Array.isArray(data?.alerts) ? data.alerts : [];
      setAlerts(list);
    } catch (err) {
      console.error('[useBrainPatterns] failed to fetch pattern alerts:', err);
      // Retain existing alerts on error to avoid flickering
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  // Initial fetch and auto-refetch every 5 minutes
  useEffect(() => {
    fetchAlerts();

    intervalRef.current = setInterval(fetchAlerts, REFETCH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAlerts]);

  // ── Read/unread management ─────────────────────────────────────────────────

  const markAsRead = useCallback((alertId: string) => {
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadAlertIds((prev) => {
      const next = new Set(prev);
      for (const alert of alerts) {
        next.add(alert.id);
      }
      return next;
    });
  }, [alerts]);

  // ── Derived state ──────────────────────────────────────────────────────────

  // Only count unread among the alerts currently returned from the API
  const currentAlertIds = new Set(alerts.map((a) => a.id));
  const unreadCount = alerts.filter(
    (a) => currentAlertIds.has(a.id) && !readAlertIds.has(a.id),
  ).length;

  return {
    alerts,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchAlerts,
  };
}
