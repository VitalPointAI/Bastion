/**
 * useCOPGateNotifications
 *
 * React hook that subscribes to decision gate WebSocket events and surfaces
 * them as COP-level notifications. Two tiers:
 *
 *   - **Critical** (lethal force): Triggers a modal overlay on the COP with
 *     approve/reject buttons and auto-zooms the map to the action area.
 *   - **High** (resource allocation): Toast notification with link to Direct tab.
 *   - **Standard**: Silent — handled in the Direct tab as before.
 *
 * Provides pending notifications, a modal gate (if critical), and action handlers.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GateNotification {
  id: string;
  gateId: string;
  eventType: 'gate.created' | 'gate.updated' | 'gate.approved' | 'gate.rejected';
  urgency: 'critical' | 'high' | 'standard';
  isLethal: boolean;
  title: string;
  status: string;
  problemSetId: string;
  /** For map zoom — threat/mission location context */
  missionId?: string;
  threatDesignation?: string;
  decidedBy?: string;
  timestamp: string;
  dismissed: boolean;
}

export interface UseCOPGateNotificationsResult {
  /** All active (non-dismissed) notifications, newest first */
  notifications: GateNotification[];
  /** The current critical gate requiring immediate modal action (null if none) */
  criticalGate: GateNotification | null;
  /** Toast-level notifications (high urgency, non-dismissed) */
  toastNotifications: GateNotification[];
  /** Approve a gate */
  approveGate: (gateId: string) => Promise<void>;
  /** Reject a gate */
  rejectGate: (gateId: string, reason: string) => Promise<void>;
  /** Dismiss a toast notification */
  dismissNotification: (id: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/messages`
    : 'ws://localhost:3001/ws/messages';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCOPGateNotifications(): UseCOPGateNotificationsResult {
  const [notifications, setNotifications] = useState<GateNotification[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);
  const connectFnRef = useRef<(() => void) | undefined>(undefined);

  // ─── WebSocket connection ─────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;
    let openedAt = 0;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      openedAt = Date.now();
      // Subscribe to gate lifecycle channel
      ws.send(JSON.stringify({ type: 'subscribe', channel: 'gate:lifecycle' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: {
            messageType?: string;
            payload?: Record<string, unknown>;
          };
        };

        if (msg.type !== 'message' || !msg.data?.messageType?.startsWith('gate.')) return;

        const payload = msg.data.payload ?? {};
        const eventType = msg.data.messageType as GateNotification['eventType'];
        const urgency = (payload.urgency as string) ?? 'standard';
        const isLethal = (payload.is_lethal as boolean) ?? false;

        // Only surface created events as notifications (approved/rejected are confirmations)
        const isCreation = eventType === 'gate.created';
        const status = payload.status as string ?? 'pending';

        // Skip standard-urgency creations (handled in Direct tab)
        if (isCreation && urgency === 'standard') return;

        const notification: GateNotification = {
          id: `${payload.gate_id}-${Date.now()}`,
          gateId: payload.gate_id as string,
          eventType,
          urgency: urgency as GateNotification['urgency'],
          isLethal,
          title: payload.title as string ?? 'Decision Required',
          status,
          problemSetId: payload.problem_set_id as string ?? '',
          missionId: payload.mission_id as string | undefined,
          threatDesignation: payload.threat_designation as string | undefined,
          decidedBy: payload.decided_by as string | undefined,
          timestamp: new Date().toISOString(),
          dismissed: false,
        };

        if (mountedRef.current) {
          setNotifications((prev) => {
            // Deduplicate: skip if we already have a notification for this gateId
            if (prev.some((n) => n.gateId === notification.gateId)) return prev;
            return [notification, ...prev];
          });
        }
      } catch {
        // Non-JSON or unexpected message — ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      if (openedAt && Date.now() - openedAt > 5000) {
        reconnectDelayRef.current = RECONNECT_BASE_MS;
      }
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectFnRef.current?.();
      }, delay);
    };

    ws.onerror = () => {
      // Silent — onclose will handle reconnect
    };
  }, []);

  useEffect(() => { connectFnRef.current = connect; }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  // ─── Actions ──────────────────────────────────────────────────────────

  const approveGate = useCallback(async (gateId: string) => {
    try {
      const res = await fetch(`/api/gates/${gateId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decidedBy: 'commander' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[useCOPGateNotifications] approve failed:', err.error);
        return;
      }
      // Mark as dismissed
      setNotifications((prev) =>
        prev.map((n) => n.gateId === gateId ? { ...n, dismissed: true, status: 'approved' } : n),
      );
    } catch (err) {
      console.error('[useCOPGateNotifications] approve failed:', err);
    }
  }, []);

  const rejectGate = useCallback(async (gateId: string, reason: string) => {
    try {
      const res = await fetch(`/api/gates/${gateId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decidedBy: 'commander', reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[useCOPGateNotifications] reject failed:', err.error);
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => n.gateId === gateId ? { ...n, dismissed: true, status: 'rejected' } : n),
      );
    } catch (err) {
      console.error('[useCOPGateNotifications] reject failed:', err);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, dismissed: true } : n));
  }, []);

  // ─── Derived state ────────────────────────────────────────────────────

  const active = notifications.filter((n) => !n.dismissed);
  // Critical: lethal authorization (can arrive as gate.created or gate.updated depending on
  // whether the lethal context was added after initial creation)
  const criticalGate = active.find((n) => n.isLethal && (n.eventType === 'gate.created' || n.eventType === 'gate.updated')) ?? null;
  // Toast: non-lethal high-urgency gates (resource allocation, etc.)
  const toastNotifications = active.filter(
    (n) => (n.eventType === 'gate.created' || n.eventType === 'gate.updated') && !n.isLethal && n.urgency !== 'standard',
  );

  return {
    notifications: active,
    criticalGate,
    toastNotifications,
    approveGate,
    rejectGate,
    dismissNotification,
  };
}
