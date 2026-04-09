/**
 * useIronclaw -- SSE + state management hook for Ironclaw chat
 *
 * Manages: drawer open/close, chat messages, SSE (EventSource) connection,
 * message send with optimistic update, action confirmations, unread state.
 *
 * Supports two modes:
 * - Problem-set-scoped: EventSource to /api/ironclaw/:problemSetId/stream
 * - Global (no problem set): EventSource to /api/ironclaw/global/stream
 *
 * EventSource auto-reconnects with Last-Event-ID — no manual backoff needed.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  IronclawChatMessage, TrustDecision,
  AckPayload, ToolCallPayload, ToolResultPayload,
  DelegationPayload, ResponsePayload, ErrorPayload,
  StreamingResponse, ToolCallState, DelegationState, InlineErrorState,
  SSEConnectionState,
} from '../types/ironclaw.ts';
import { ironclawApi } from '../lib/ironclaw-service.ts';

// ─── Message Context ─────────────────────────────────────────────────────────

/** UI context attached to each message to help Ironclaw tailor responses. */
export interface MessageContext {
  currentTab?: string;
  problemSetId?: string;
  userRole?: string;
}

// ─── Public interface ────────────────────────────────────────────────────────

export interface IronclawThread {
  id: string;
  name: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
}

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
  /** Inject a synthetic message (e.g. greeting) into the message list */
  injectMessage: (msg: IronclawChatMessage) => void;
  // Thread management
  threads: IronclawThread[];
  currentThreadId: string | null;
  selectThread: (threadId: string) => Promise<void>;
  createThread: (name: string) => Promise<void>;
  renameThread: (threadId: string, name: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  // SSE state
  sseState: SSEConnectionState;
  streamingResponse: StreamingResponse | null;
  toolCalls: ToolCallState[];
  delegations: DelegationState[];
  inlineErrors: InlineErrorState[];
  setToolCalls: React.Dispatch<React.SetStateAction<ToolCallState[]>>;
  setInlineErrors: React.Dispatch<React.SetStateAction<InlineErrorState[]>>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useIronclaw(
  problemSetId: string | null,
  messageContext?: MessageContext,
): UseIronclawResult {
  const [messages, setMessages] = useState<IronclawChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [threads, setThreads] = useState<IronclawThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

  // SSE-specific state
  const [sseState, setSseState] = useState<SSEConnectionState>('closed');
  const [streamingResponse, setStreamingResponse] = useState<StreamingResponse | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCallState[]>([]);
  const [delegations, setDelegations] = useState<DelegationState[]>([]);
  const [inlineErrors, setInlineErrors] = useState<InlineErrorState[]>([]);

  // Keep messageContext in a ref so sendMessage doesn't need to re-bind when context changes.
  const messageContextRef = useRef<MessageContext | undefined>(messageContext);
  useEffect(() => {
    messageContextRef.current = messageContext;
  }, [messageContext]);

  // Track current tab for thread refs (avoids rebinding callbacks)
  const currentTabRef = useRef<string | undefined>(messageContext?.currentTab);
  useEffect(() => {
    currentTabRef.current = messageContext?.currentTab;
  }, [messageContext?.currentTab]);

  // Track the active tab thread ID in a ref for sendMessage
  const currentThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
  }, [currentThreadId]);

  // Idle extraction timer ref
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Extraction trigger ───────────────────────────────────────────────────

  /**
   * Fire-and-forget extraction trigger.
   * Sends a POST to /api/ironclaw/:problemSetId/extract and ignores the result.
   * Called on idle timeout, thread switch, and drawer close.
   */
  const triggerExtraction = useCallback((threadId: string) => {
    if (!threadId || !problemSetId) return;
    fetch(`/api/ironclaw/${problemSetId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
    }).catch(() => {}); // Silent failure — fire-and-forget
  }, [problemSetId]);

  // SSE EventSource refs
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const isOpenRef = useRef(isOpen);

  // Keep isOpen ref in sync
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // ─── SSE connection ───────────────────────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (!mountedRef.current) return;

    // Close existing connection if any
    esRef.current?.close();

    const url = problemSetId
      ? `/api/ironclaw/${problemSetId}/stream`
      : `/api/ironclaw/global/stream`;

    setSseState('connecting');
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setSseState('open');
      setIsConnected(true);
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      setSseState(es.readyState === EventSource.CONNECTING ? 'connecting' : 'closed');
      setIsConnected(false);
      // EventSource auto-reconnects with Last-Event-ID — no manual backoff needed
    };

    // --- Event Listeners ---

    es.addEventListener('ack', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data: AckPayload = JSON.parse(e.data as string);
        setIsLoading(false);
        // Filter by current thread if applicable
        if (data.threadId && currentThreadIdRef.current && data.threadId !== currentThreadIdRef.current) return;
      } catch {
        // Malformed event data — discard silently (T-67-08)
      }
    });

    es.addEventListener('response', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data: ResponsePayload = JSON.parse(e.data as string);
        // Filter by thread
        if (data.threadId && currentThreadIdRef.current && data.threadId !== currentThreadIdRef.current) return;

        if (data.delta) {
          // Streaming token chunk — update streaming response
          setStreamingResponse(prev => ({
            content: (prev?.content ?? '') + data.content,
            isStreaming: true,
            threadId: data.threadId,
          }));
        } else if (data.done) {
          // Final response — clear streaming, add to messages
          setStreamingResponse(null);
          const chatMsg: IronclawChatMessage = {
            id: data.messageId || crypto.randomUUID(),
            problemSetId: problemSetId || '',
            content: data.content,
            sender: data.sender,
            specialistId: data.specialistId,
            specialistDisplayName: data.specialistDisplayName,
            threadId: data.threadId,
            createdAt: new Date().toISOString(),
          };
          setMessages(prev => [...prev, chatMsg]);
          if (!isOpenRef.current) setHasUnread(true);
          setIsLoading(false);
        } else {
          // Non-delta, non-done: treat as complete single response
          const chatMsg: IronclawChatMessage = {
            id: data.messageId || crypto.randomUUID(),
            problemSetId: problemSetId || '',
            content: data.content,
            sender: data.sender,
            specialistId: data.specialistId,
            specialistDisplayName: data.specialistDisplayName,
            threadId: data.threadId,
            createdAt: new Date().toISOString(),
          };
          setMessages(prev => [...prev, chatMsg]);
          if (!isOpenRef.current) setHasUnread(true);
          setIsLoading(false);
        }
      } catch {
        // Malformed event data — discard silently (T-67-08)
      }
    });

    es.addEventListener('tool_call', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data: ToolCallPayload = JSON.parse(e.data as string);
        setToolCalls(prev => {
          const existing = prev.findIndex(tc => tc.toolName === data.toolName && tc.status === 'running');
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...data, expanded: prev[existing].expanded };
            return updated;
          }
          return [...prev, { ...data, expanded: false }];
        });
      } catch {
        // Malformed event data — discard silently (T-67-08)
      }
    });

    es.addEventListener('tool_result', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data: ToolResultPayload = JSON.parse(e.data as string);
        setToolCalls(prev => prev.map(tc =>
          tc.toolName === data.toolName && tc.status === 'running'
            ? { ...tc, status: 'complete' as const, output: data.output, summary: data.summary, elapsed: data.elapsed, statusMessage: data.summary }
            : tc
        ));
      } catch {
        // Malformed event data — discard silently (T-67-08)
      }
    });

    es.addEventListener('delegation', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const data: DelegationPayload = JSON.parse(e.data as string);
        setDelegations(prev => {
          const existing = prev.findIndex(d => d.specialistId === data.specialistId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = data;
            return updated;
          }
          return [...prev, data];
        });
      } catch {
        // Malformed event data — discard silently (T-67-08)
      }
    });

    es.addEventListener('progress', (_e: MessageEvent) => {
      if (!mountedRef.current) return;
      // Progress events currently handled via tool_call status updates
    });

    es.addEventListener('error', (e: MessageEvent) => {
      if (!mountedRef.current) return;
      // SSE protocol error (no data) vs application error (has data)
      if (!e.data) return; // Protocol error — connection indicator handles this
      try {
        const data: ErrorPayload = JSON.parse(e.data as string);
        setInlineErrors(prev => [...prev, { ...data, retrying: false }]);
        setIsLoading(false);
      } catch {
        // Malformed event data — discard silently (T-67-08)
      }
    });

  }, [problemSetId]);

  // ─── Lifecycle: load history + connect SSE on problemSetId change ──────────

  useEffect(() => {
    mountedRef.current = true;

    // Fetch history, then connect SSE.
    // Problem-set mode: skip unthreaded history load — the tab thread effect
    // handles thread-scoped history.
    ironclawApi
      .getHistory(problemSetId)
      .then(({ messages: history }) => {
        if (!mountedRef.current) return;
        // Only set messages from this fetch in global mode (no tab threads).
        if (!problemSetId) {
          setMessages(history);
        }
        connectSSE();
      })
      .catch((err) => {
        console.error('[useIronclaw] history fetch failed:', err);
        if (!mountedRef.current) return;
        // Connect SSE regardless of history fetch failure
        connectSSE();
      });

    return () => {
      mountedRef.current = false;

      // Cancel idle extraction timer
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      // Close SSE connection
      esRef.current?.close();
      esRef.current = null;
    };
  }, [problemSetId, connectSSE]);

  // ─── Drawer controls ──────────────────────────────────────────────────────

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    // Extract from current thread on drawer close
    if (currentThreadIdRef.current) {
      triggerExtraction(currentThreadIdRef.current);
    }
    // Clear idle timer — drawer is closing
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, [triggerExtraction]);

  const injectMessage = useCallback((msg: IronclawChatMessage) => {
    setMessages((prev) => [...prev, msg]);
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

      // Detect honorific preference from user message (e.g. "Sir", "Ma'am", "call me Sir")
      const honorificMatch = content.match(/\b(sir|ma'am|maam)\b/i);
      if (honorificMatch) {
        const honorific = honorificMatch[1].toLowerCase().startsWith('s') ? 'Sir' : "Ma'am";
        ironclawApi.setHonorific(honorific).catch(() => { /* best-effort */ });
      }

      try {
        await ironclawApi.sendMessage(
          problemSetId, content, mentionedAgent,
          messageContextRef.current, currentThreadIdRef.current ?? undefined,
        );
        // Response will arrive via SSE — isLoading cleared on ack or response event

        // Reset idle extraction timer — 5 minutes of inactivity triggers extraction
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        const activeThreadId = currentThreadIdRef.current;
        if (activeThreadId) {
          idleTimerRef.current = setTimeout(() => {
            triggerExtraction(activeThreadId);
          }, 5 * 60 * 1000); // 5 minutes
        }
      } catch (err) {
        console.error('[useIronclaw] sendMessage failed:', err);
        setIsLoading(false);
      }
    },
    [problemSetId, triggerExtraction],
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

  // ─── Thread management ──────────────────────────────────────────────────

  // Auto-resolve tab thread when tab or problem set changes
  const currentTab = messageContext?.currentTab;
  useEffect(() => {
    if (!problemSetId || !currentTab) { setThreads([]); setCurrentThreadId(null); return; }

    let cancelled = false;

    // Resolve tab thread, load its history, and refresh thread list
    (async () => {
      try {
        const thread = await ironclawApi.getTabThread(problemSetId, currentTab);
        if (cancelled) return;
        setCurrentThreadId(thread.id);

        // Load history for this tab's thread
        const { messages: history } = await ironclawApi.getHistory(problemSetId, undefined, thread.id);
        if (cancelled) return;
        setMessages(history);
      } catch {
        // Tab thread not available — fall back to unthreaded
        if (cancelled) return;
        setCurrentThreadId(null);
      }

      // Also refresh the thread list for the thread selector
      try {
        const list = await ironclawApi.listThreads(problemSetId);
        if (!cancelled) setThreads(list);
      } catch { /* threads not available */ }
    })();

    return () => { cancelled = true; };
  }, [problemSetId, currentTab]);

  const selectThread = useCallback(async (threadId: string) => {
    // Extract from previous thread before switching
    if (currentThreadIdRef.current && currentThreadIdRef.current !== threadId) {
      triggerExtraction(currentThreadIdRef.current);
    }
    // Clear idle timer when switching threads
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    setCurrentThreadId(threadId);
    currentThreadIdRef.current = threadId;
    if (!problemSetId) return;
    try {
      const { messages: history } = await ironclawApi.getHistory(problemSetId, undefined, threadId);
      setMessages(history);
    } catch (err) {
      console.error('[useIronclaw] selectThread failed:', err);
    }
  }, [problemSetId, triggerExtraction]);

  const createThread = useCallback(async (name: string) => {
    if (!problemSetId) return;
    try {
      const thread = await ironclawApi.createThread(problemSetId, name);
      setThreads((prev) => [{ ...thread, message_count: 0, last_message_at: null }, ...prev]);
      setCurrentThreadId(thread.id);
      setMessages([]);
    } catch (err) {
      console.error('[useIronclaw] createThread failed:', err);
    }
  }, [problemSetId]);

  const renameThread = useCallback(async (threadId: string, name: string) => {
    if (!problemSetId) return;
    try {
      await ironclawApi.renameThread(problemSetId, threadId, name);
      setThreads((prev) => prev.map((t) => t.id === threadId ? { ...t, name } : t));
    } catch (err) {
      console.error('[useIronclaw] renameThread failed:', err);
    }
  }, [problemSetId]);

  const deleteThread = useCallback(async (threadId: string) => {
    if (!problemSetId) return;
    try {
      await ironclawApi.deleteThread(problemSetId, threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('[useIronclaw] deleteThread failed:', err);
    }
  }, [problemSetId, currentThreadId]);

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
    injectMessage,
    threads,
    currentThreadId,
    selectThread,
    createThread,
    renameThread,
    deleteThread,
    sseState,
    streamingResponse,
    toolCalls,
    delegations,
    inlineErrors,
    setToolCalls,
    setInlineErrors,
  };
}
