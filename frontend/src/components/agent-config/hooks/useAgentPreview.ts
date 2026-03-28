/**
 * useAgentPreview
 *
 * Phase 60 Plan 04: Hook for sending preview messages to Ironclaw
 * using the current AgentConfig persona settings.
 *
 * Preview mode: sends a single message to the global Ironclaw endpoint
 * with a preview_mode flag in the context payload. The response streams
 * via WebSocket on the user's global channel.
 *
 * Provides:
 * - sendPreviewMessage(text): sends the message and waits for streaming response
 * - response: the last response text received
 * - streaming: true while response is arriving
 * - error: any error that occurred
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { AgentConfig } from '../../../types/agent-config.ts';

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/messages`
    : 'ws://localhost:3001/ws/messages';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseAgentPreviewResult {
  sendPreviewMessage: (text: string) => Promise<void>;
  response: string | null;
  streaming: boolean;
  error: string | null;
  clearResponse: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAgentPreview(_config: AgentConfig): UseAgentPreviewResult {
  const [response, setResponse] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const channelRef = useRef<string>('');
  const responseBufferRef = useRef<string>('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clean up any open WebSocket on unmount
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // ─── Ensure we have a WebSocket channel ─────────────────────────────────

  const ensureChannel = useCallback(async (): Promise<string> => {
    // Fetch history to get the global channel name
    const res = await fetch(`${API_BASE}/api/ironclaw/global/history?limit=1`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`Failed to get channel: HTTP ${res.status}`);
    const data = await res.json() as { channel?: string };
    return data.channel ?? '';
  }, []);

  // ─── Connect WebSocket and wait for a response ───────────────────────────

  const listenForResponse = useCallback(async (
    channel: string,
    resolve: (text: string) => void,
    reject: (err: Error) => void,
  ) => {
    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;
    responseBufferRef.current = '';

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Preview response timed out after 30 seconds'));
    }, 30000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<string, unknown>;

        if (msg.type === 'ironclaw_message' || msg.type === 'message') {
          const content = (msg.content as string) ?? '';

          if (msg.streaming === true) {
            // Streaming chunk — accumulate
            responseBufferRef.current += content;
            if (mountedRef.current) {
              setResponse(responseBufferRef.current);
            }
          } else if (msg.sender === 'ironclaw' || msg.role === 'ironclaw') {
            // Final complete message
            clearTimeout(timeout);
            const finalText = content || responseBufferRef.current;
            ws.close();
            wsRef.current = null;
            resolve(finalText);
          }
        } else if (msg.type === 'stream_chunk') {
          // Alternative streaming format
          const delta = (msg.delta as string) ?? '';
          responseBufferRef.current += delta;
          if (mountedRef.current) {
            setResponse(responseBufferRef.current);
          }
        } else if (msg.type === 'stream_end') {
          clearTimeout(timeout);
          const finalText = responseBufferRef.current;
          ws.close();
          wsRef.current = null;
          resolve(finalText);
        }
      } catch {
        // Non-JSON or unparseable message — ignore
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      ws.close();
      wsRef.current = null;
      reject(new Error('WebSocket error during preview'));
    };

    ws.onclose = (ev) => {
      clearTimeout(timeout);
      // If we didn't resolve yet and have buffered content, resolve with it
      if (responseBufferRef.current) {
        resolve(responseBufferRef.current);
      } else if (!ev.wasClean) {
        reject(new Error('WebSocket closed unexpectedly'));
      }
    };
  }, []);

  // ─── sendPreviewMessage ──────────────────────────────────────────────────

  const sendPreviewMessage = useCallback(async (text: string) => {
    if (!mountedRef.current) return;

    // Close any existing WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setError(null);
    setStreaming(true);
    setResponse(null);
    responseBufferRef.current = '';

    try {
      // Step 1: Get channel (needed for WebSocket subscription)
      let channel = channelRef.current;
      if (!channel) {
        channel = await ensureChannel();
        channelRef.current = channel;
      }

      // Step 2: Start listening for response before sending
      const responsePromise = new Promise<string>((resolve, reject) => {
        void listenForResponse(channel, resolve, reject);
      });

      // Step 3: Send the message with preview_mode context
      const sendRes = await fetch(`${API_BASE}/api/ironclaw/global/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          context: {
            preview_mode: true,
            currentTab: 'agent-config-preview',
          },
        }),
      });

      if (!sendRes.ok) {
        const body = await sendRes.json().catch(() => ({ error: 'Request failed' }));
        throw new Error((body as { error?: string }).error || `HTTP ${sendRes.status}`);
      }

      // Step 4: Wait for the response via WebSocket
      const finalResponse = await responsePromise;

      if (mountedRef.current) {
        setResponse(finalResponse || '[No response received]');
        setStreaming(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message || 'Preview failed');
        setStreaming(false);
      }
    }
  }, [ensureChannel, listenForResponse]);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setError(null);
    responseBufferRef.current = '';
  }, []);

  return {
    sendPreviewMessage,
    response,
    streaming,
    error,
    clearResponse,
  };
}
