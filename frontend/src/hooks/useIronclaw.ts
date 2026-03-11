/**
 * useIronclaw -- WebSocket + state management hook for Ironclaw chat
 *
 * Manages: drawer open/close, chat messages, WebSocket connection,
 * message send with optimistic update, action confirmations, unread state.
 *
 * Supports two modes:
 * - Problem-set-scoped: channel ironclaw.{problemSetId}, full specialist + action support
 * - Global (no problem set): channel ironclaw._global, per-user conversation, no actions
 *
 * WebSocket pattern follows useStaffNotifications (exponential backoff reconnect).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IronclawChatMessage, TrustDecision } from '../types/ironclaw.ts';
import { ironclawApi } from '../lib/ironclaw-service.ts';

// ─── Constants ───────────────────────────────────────────────────────────────

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/messages`
    : 'ws://localhost:3001/ws/messages';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseIronclawResult {
  messages: IronclawChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  isConnected: boolean;
  hasUnread: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  sendMessage: (content: string, mentionedAgent?: string) => Promise<void>;
  handleActionDecision: (actionId: string, decision: TrustDecision) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useIronclaw(problemSetId: string | null): UseIronclawResult {
  const [messages, setMessages] = useState<IronclawChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Refs for WebSocket lifecycle
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);
  const isOpenRef = useRef(isOpen);
  const channelRef = useRef<string>('');

  // Keep isOpen ref in sync for WebSocket message handler
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // ─── WebSocket connection ──────────────────────────────────────────────────

  const connectWebSocketRef = useRef<(() => void) | undefined>(undefined);

  const connectWebSocket = useCallback((channelOverride?: string) => {
    if (!mountedRef.current) return;

    // Problem-set-scoped channel is deterministic; global channel comes from API.
    // Once we know the global channel (from history API), it's stored in channelRef
    // so reconnects can reuse it without another API call.
    const channel = channelOverride
      ?? (problemSetId ? `ironclaw.${problemSetId}` : null)
      ?? (channelRef.current || null);
    if (!channel) return; // Global mode first connect: wait for channel from history API
    channelRef.current = channel;

    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;
    let openedAt = 0;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      openedAt = Date.now();
      setIsConnected(true);
      // Subscribe to the Ironclaw channel
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: Record<string, unknown>;
        };

        if (msg.type !== 'message' || !msg.data) return;

        // msg.data is a MessageEnvelope — the actual chat message is in .payload
        const envelope = msg.data as Record<string, unknown>;
        const incoming = (envelope.payload ?? envelope) as Record<string, unknown>;

        // Check if this is a step progress update for an existing message
        if (incoming.stepProgress || incoming.step_progress) {
          const actionId = (incoming.action_id ?? incoming.actionId) as string | undefined;
          if (actionId) {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.actionCard?.actionId === actionId || m.stepProgress?.actionId === actionId) {
                  return {
                    ...m,
                    stepProgress: (incoming.stepProgress ?? incoming.step_progress) as IronclawChatMessage['stepProgress'],
                  };
                }
                return m;
              }),
            );
            return;
          }
        }

        // Regular message -- append to list
        const chatMsg: IronclawChatMessage = {
          id: (incoming.id ?? crypto.randomUUID()) as string,
          problemSetId: (incoming.problem_set_id ?? incoming.problemSetId ?? problemSetId ?? '_global') as string,
          content: (incoming.content ?? '') as string,
          sender: (incoming.sender ?? 'ironclaw') as IronclawChatMessage['sender'],
          specialistId: (incoming.specialist_id ?? incoming.specialistId) as string | undefined,
          specialistDisplayName: (incoming.specialist_display_name ?? incoming.specialistDisplayName) as string | undefined,
          delegatedBy: (incoming.delegated_by ?? incoming.delegatedBy) as string | undefined,
          actionCard: (incoming.action_card ?? incoming.actionCard) as IronclawChatMessage['actionCard'],
          stepProgress: (incoming.step_progress ?? incoming.stepProgress) as IronclawChatMessage['stepProgress'],
          suggestion: incoming.suggestion as IronclawChatMessage['suggestion'],
          createdAt: (incoming.created_at ?? incoming.createdAt ?? new Date().toISOString()) as string,
        };

        // Skip user messages (already added optimistically) and deduplicate
        if (chatMsg.sender === 'user') return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === chatMsg.id)) return prev;
          return [...prev, chatMsg];
        });

        // Mark unread if drawer is closed
        if (!isOpenRef.current) {
          setHasUnread(true);
        }

        // Clear loading -- response arrived from Ironclaw
        setIsLoading(false);
      } catch {
        // Non-JSON or unexpected message -- ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      // Only reset backoff if connection was stable (open > 5s)
      if (openedAt && Date.now() - openedAt > 5000) {
        reconnectDelayRef.current = RECONNECT_BASE_MS;
      }
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connectWebSocketRef.current?.();
        }
      }, delay);
    };

    ws.onerror = () => {
      if (reconnectDelayRef.current <= RECONNECT_BASE_MS * 4) {
        console.warn('[useIronclaw] WebSocket connection failed, will retry');
      }
    };
  }, [problemSetId]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // ─── Lifecycle: load history + connect on problemSetId change ──────────────

  useEffect(() => {
    mountedRef.current = true;

    // Fetch history, then connect WebSocket.
    // Global mode: history response includes the per-user channel name.
    ironclawApi
      .getHistory(problemSetId)
      .then(({ messages: history, channel }) => {
        if (!mountedRef.current) return;
        setMessages(history);
        // Connect with the channel from API (global) or derived (problem set)
        connectWebSocket(channel);
      })
      .catch((err) => {
        console.error('[useIronclaw] history fetch failed:', err);
        if (!mountedRef.current) return;

        if (problemSetId) {
          // Problem-set mode: channel is deterministic, connect directly
          connectWebSocket();
        } else {
          // Global mode: channel comes from API which just failed.
          // Retry history fetch after a short delay to get the channel name.
          const retryDelay = 2000;
          reconnectTimerRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            ironclawApi
              .getHistory(null)
              .then(({ messages: history, channel }) => {
                if (!mountedRef.current) return;
                setMessages(history);
                connectWebSocket(channel);
              })
              .catch((retryErr) => {
                console.error('[useIronclaw] global history retry failed:', retryErr);
              });
          }, retryDelay);
        }
      });

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
  }, [problemSetId, connectWebSocket]);

  // ─── Drawer controls ──────────────────────────────────────────────────────

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        // Opening -- clear unread
        setHasUnread(false);
      }
      return !prev;
    });
  }, []);

  // ─── Send message (optimistic) ────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, mentionedAgent?: string): Promise<void> => {
      // Optimistic user message
      const userMessage: IronclawChatMessage = {
        id: crypto.randomUUID(),
        problemSetId: problemSetId ?? '_global',
        content,
        sender: 'user',
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        await ironclawApi.sendMessage(problemSetId, content, mentionedAgent);
        // Response will arrive via WebSocket -- isLoading cleared on ws message
      } catch (err) {
        console.error('[useIronclaw] sendMessage failed:', err);
        setIsLoading(false);
      }
    },
    [problemSetId],
  );

  // ─── Action decision ──────────────────────────────────────────────────────

  const handleActionDecision = useCallback(
    async (actionId: string, decision: TrustDecision): Promise<void> => {
      if (!problemSetId) return;

      // Optimistic update: disable the action card
      setMessages((prev) =>
        prev.map((m) => {
          if (m.actionCard?.actionId === actionId) {
            return {
              ...m,
              actionCard: { ...m.actionCard, options: [] as TrustDecision[] },
            };
          }
          return m;
        }),
      );

      try {
        await ironclawApi.confirmAction(problemSetId, actionId, decision);
      } catch (err) {
        console.error('[useIronclaw] confirmAction failed:', err);
        // Could revert optimistic update here if needed
      }
    },
    [problemSetId],
  );

  return {
    messages,
    isOpen,
    isLoading,
    isConnected,
    hasUnread,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    sendMessage,
    handleActionDecision,
  };
}
