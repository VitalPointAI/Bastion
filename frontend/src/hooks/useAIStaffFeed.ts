/**
 * useAIStaffFeed
 *
 * WebSocket subscription hook for real-time AI staff feed updates.
 * Follows the useStaffNotifications pattern exactly:
 *   - Initial REST fetch on mount
 *   - WebSocket subscription to ai.staff.{problemSetId}
 *   - Exponential backoff reconnect (1s base, 30s max)
 *   - Cleanup on unmount or problemSetId change
 *   - requestAnimationFrame batching (max 5 per frame) per RESEARCH.md pitfall 4
 *
 * Dispatches feed items and annotations into AIStaffContext.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { aiStaffService } from '../lib/ai-staff-service.ts';
import { useAIStaffDispatch } from '../context/AIStaffContext.tsx';
import type { AIFeedItem, AIAnnotation } from '../types/ai-staff.ts';

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseAIStaffFeedResult {
  loading: boolean;
  refresh: () => Promise<void>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/messages`
    : 'ws://localhost:3001/ws/messages';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/** Maximum messages to process per animation frame */
const BATCH_SIZE = 5;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAIStaffFeed(problemSetId: string | null): UseAIStaffFeedResult {
  const [loading, setLoading] = useState(false);
  const dispatch = useAIStaffDispatch();

  // Refs for WebSocket lifecycle
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);
  const channelRef = useRef<string>('');

  // RAF batching queue
  const messageQueueRef = useRef<Array<{ type: string; data: AIFeedItem | AIAnnotation }>>([]);
  const rafIdRef = useRef<number | null>(null);

  // ─── RAF batch processor ─────────────────────────────────────────────────

  const processQueue = useCallback(() => {
    const queue = messageQueueRef.current;
    if (queue.length === 0) {
      rafIdRef.current = null;
      return;
    }

    // Process up to BATCH_SIZE items per frame
    const batch = queue.splice(0, BATCH_SIZE);
    for (const msg of batch) {
      switch (msg.type) {
        case 'ai.feed.new':
          dispatch.addFeedItem(msg.data as AIFeedItem);
          break;
        case 'ai.feed.update':
          // Update is treated as re-adding (reducer handles dedup via sort)
          dispatch.addFeedItem(msg.data as AIFeedItem);
          break;
        case 'ai.annotation.new':
          dispatch.addAnnotation(msg.data as AIAnnotation);
          break;
      }
    }

    // If more items remain, schedule next frame
    if (queue.length > 0) {
      rafIdRef.current = requestAnimationFrame(processQueue);
    } else {
      rafIdRef.current = null;
    }
  }, [dispatch]);

  const enqueueMessage = useCallback(
    (type: string, data: AIFeedItem | AIAnnotation) => {
      messageQueueRef.current.push({ type, data });
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(processQueue);
      }
    },
    [processQueue],
  );

  // ─── Fetch initial feed from REST endpoint ───────────────────────────────

  const refresh = useCallback(async (): Promise<void> => {
    if (!problemSetId) return;
    try {
      const items = await aiStaffService.getFeed(problemSetId);
      if (mountedRef.current) {
        for (const item of items) {
          dispatch.addFeedItem(item);
        }
      }
    } catch (err) {
      console.error('[useAIStaffFeed] refresh failed:', err);
    }
  }, [problemSetId, dispatch]);

  // ─── WebSocket connection ──────────────────────────────────────────────────

  const connectWebSocketRef = useRef<(() => void) | undefined>(undefined);

  const connectWebSocket = useCallback(() => {
    if (!problemSetId || !mountedRef.current) return;

    const channel = `ai.staff.${problemSetId}`;
    channelRef.current = channel;

    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      // Reset backoff on successful connection
      reconnectDelayRef.current = RECONNECT_BASE_MS;
      // Subscribe to the AI staff channel
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: { messageType?: string; payload?: AIFeedItem | AIAnnotation };
        };

        if (msg.type !== 'message' || !msg.data?.messageType || !msg.data?.payload) return;

        const { messageType, payload } = msg.data;

        // Route recognized message types through RAF batching
        if (
          messageType === 'ai.feed.new' ||
          messageType === 'ai.feed.update' ||
          messageType === 'ai.annotation.new'
        ) {
          enqueueMessage(messageType, payload);
        }
      } catch {
        // Non-JSON or unexpected message -- ignore
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
      console.error('[useAIStaffFeed] WebSocket error:', err);
      // onclose fires after onerror -- reconnect logic is in onclose
    };
  }, [problemSetId, enqueueMessage]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // ─── Lifecycle: load + connect on problemSetId change ────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (!problemSetId) {
      return;
    }

    setLoading(true);
    aiStaffService
      .getFeed(problemSetId)
      .then((items) => {
        if (mountedRef.current) {
          for (const item of items) {
            dispatch.addFeedItem(item);
          }
        }
      })
      .catch((err) => {
        console.error('[useAIStaffFeed] initial fetch failed:', err);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    connectWebSocket();

    return () => {
      mountedRef.current = false;

      // Cancel RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      messageQueueRef.current = [];

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
  }, [problemSetId, connectWebSocket, dispatch]);

  return { loading, refresh };
}
