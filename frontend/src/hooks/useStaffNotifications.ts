/**
 * useStaffNotifications
 *
 * Phase 15 Plan 04: Custom React hook for real-time cross-staff notification state.
 *
 * Provides:
 *   - Global notification list (all roles, sorted newest-first)
 *   - Unread badge count (global and per-active-role)
 *   - WebSocket subscription on exercise.staff.{scenarioId} for real-time delivery
 *   - markRead / markIntegrated actions with optimistic local state update
 *   - Exponential-backoff reconnect (1s → 2s → 4s … max 30s)
 *   - Cleanup on unmount or scenarioId change
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { exerciseService } from '../services/exercise-service';
import type { StaffNotification } from '../types/exercise';

// ─── Public interface ──────────────────────────────────────────────────────────

export interface UseStaffNotificationsResult {
  notifications: StaffNotification[];
  unreadCount: number;
  roleUnreadCount: number;
  loading: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markIntegrated: (notificationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/messages`
    : 'ws://localhost:3001/ws/messages';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useStaffNotifications(
  scenarioId: string | null,
  activeRole: string,
): UseStaffNotificationsResult {
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(false);

  // WebSocket ref — persists across renders without causing re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);
  const channelRef = useRef<string>('');

  // ─── Fetch all notifications from REST endpoint ───────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    if (!scenarioId) return;
    try {
      const data = await exerciseService.getStaffNotifications(scenarioId);
      if (mountedRef.current) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('[useStaffNotifications] refresh failed:', err);
    }
  }, [scenarioId]);

  // ─── WebSocket connection ─────────────────────────────────────────────────

  const connectWebSocketRef = useRef<(() => void) | undefined>(undefined);

  const connectWebSocket = useCallback(() => {
    if (!scenarioId || !mountedRef.current) return;

    const channel = `exercise.staff.${scenarioId}`;
    channelRef.current = channel;

    const url = `${WS_BASE_URL}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      // Reset backoff on successful connection
      reconnectDelayRef.current = RECONNECT_BASE_MS;
      // Subscribe to the exercise staff channel
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: { messageType?: string; channel?: string };
        };
        // Only act on messages from our channel that indicate a published product
        if (
          msg.type === 'message' &&
          msg.data?.messageType === 'staff.product.published'
        ) {
          void refresh();
        }
      } catch {
        // Non-JSON or unexpected message — ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Attempt reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connectWebSocketRef.current?.();
        }
      }, delay);
    };

    ws.onerror = (err) => {
      console.error('[useStaffNotifications] WebSocket error:', err);
      // onclose fires after onerror — reconnect logic is in onclose
    };
  }, [scenarioId, refresh]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // ─── Lifecycle: load + connect on scenarioId change ──────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (!scenarioId) {
       
      setNotifications([]);
      return;
    }

    setLoading(true);
    exerciseService
      .getStaffNotifications(scenarioId)
      .then((data) => {
        if (mountedRef.current) {
          setNotifications(data);
        }
      })
      .catch((err) => {
        console.error('[useStaffNotifications] initial fetch failed:', err);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    connectWebSocket();

    return () => {
      mountedRef.current = false;

      // Cancel any pending reconnect
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Unsubscribe and close WebSocket
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'unsubscribe',
            channel: channelRef.current,
          }),
        );
        ws.close();
      }
      wsRef.current = null;
    };
  }, [scenarioId, connectWebSocket]);

  // ─── Mark read (optimistic update) ───────────────────────────────────────

  const markRead = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!scenarioId) return;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
      );
      try {
        await exerciseService.markNotificationRead(scenarioId, notificationId);
      } catch (err) {
        console.error('[useStaffNotifications] markRead failed:', err);
        // Revert on failure
        await refresh();
      }
    },
    [scenarioId, refresh],
  );

  // ─── Mark integrated (optimistic update) ─────────────────────────────────

  const markIntegrated = useCallback(
    async (notificationId: string): Promise<void> => {
      if (!scenarioId) return;
      // Optimistic update — integrated implies read
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true, isIntegrated: true } : n,
        ),
      );
      try {
        await exerciseService.markNotificationIntegrated(
          scenarioId,
          notificationId,
        );
      } catch (err) {
        console.error('[useStaffNotifications] markIntegrated failed:', err);
        await refresh();
      }
    },
    [scenarioId, refresh],
  );

  // ─── Derived counts ───────────────────────────────────────────────────────

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const roleUnreadCount = notifications.filter(
    (n) => !n.isRead && n.targetRole === activeRole,
  ).length;

  return {
    notifications,
    unreadCount,
    roleUnreadCount,
    loading,
    markRead,
    markIntegrated,
    refresh,
  };
}
