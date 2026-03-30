/**
 * IronclawContext
 *
 * Provides Ironclaw chat state, drawer controls, and actions to all child components.
 * Wraps the useIronclaw hook and renders the floating button + drawer globally.
 *
 * - IronclawProvider wraps app at AuthenticatedShell level (above route layer)
 * - useIronclawContext() returns the full context value
 * - Gets problemSetId from ProblemSetContext (falls back to null)
 * - Derives current tab from react-router location pathname
 * - Replaces AIStaffContext as primary AI surface (coexists during transition)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

import type { IronclawChatMessage, IronclawTaskData, SuggestionData, TrustDecision } from '../types/ironclaw.ts';
import { useIronclaw } from '../hooks/useIronclaw.ts';
import { useDesignInterview } from '../hooks/useDesignInterview.ts';
import { ironclawApi } from '../lib/ironclaw-service.ts';
import { useProblemSet } from './ProblemSetContext.tsx';
import { useUser } from './UserContext.tsx';
import { IronclawButton } from '../components/ironclaw/IronclawButton.tsx';
import { IronclawDrawer } from '../components/ironclaw/IronclawDrawer.tsx';
import { decisionApiService, type Decision } from '../lib/decision-service.ts';

// ─── Tab Derivation ───────────────────────────────────────────────────────────

/**
 * Map route pathname segments to human-readable tab names.
 * Covers the tab structure defined in Phase 24 (Understand/Design/Plan/Direct/COP/Assess).
 */
function deriveTabFromPath(pathname: string): string {
  const lower = pathname.toLowerCase();

  // Match the first meaningful path segment after the domain
  if (lower.includes('/understand')) return 'understand';
  if (lower.includes('/design')) return 'design';
  if (lower.includes('/plan')) return 'plan';
  if (lower.includes('/decide')) return 'decide';
  if (lower.includes('/direct')) return 'direct';
  if (lower.includes('/cop')) return 'cop';
  if (lower.includes('/assess')) return 'assess';
  if (lower.includes('/admin')) return 'admin';
  if (lower.includes('/brain')) return 'brain';
  if (lower.includes('/train')) return 'train';
  if (lower.includes('/campaign')) return 'campaign';
  if (lower.includes('/overview')) return 'overview';

  // Legacy tab names (pre-Phase 24)
  if (lower.includes('/intelligence') || lower.includes('/ipb')) return 'understand';
  if (lower.includes('/planning') || lower.includes('/jpp')) return 'plan';
  if (lower.includes('/operations')) return 'direct';

  return 'home';
}

// ─── Context Value ───────────────────────────────────────────────────────────

/** Dispatched when user accepts a suggestion that targets a field */
export interface FieldWriteEvent {
  targetField: string;
  value: string;
  suggestionId: string;
}

type FieldWriteListener = (event: FieldWriteEvent) => void;

interface IronclawContextValue {
  messages: IronclawChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  isConnected: boolean;
  hasUnread: boolean;
  /** The current tab derived from the URL pathname */
  currentTab: string;
  /** The user's role in the active problem set */
  userRole: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  sendMessage: (content: string, mentionedAgent?: string) => Promise<void>;
  handleActionDecision: (actionId: string, decision: TrustDecision) => Promise<void>;
  acceptSuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;
  /** Subscribe to field write events — returns unsubscribe function */
  onFieldWrite: (listener: FieldWriteListener) => () => void;
  /** Active task for the current problem set (from orchestration loop) */
  activeTask: IronclawTaskData | null;
  /** Approve a task suggestion */
  approveTaskSuggestion: (taskId: string, suggestionId: string) => void;
  /** Dismiss a task suggestion */
  dismissTaskSuggestion: (taskId: string, suggestionId: string) => void;
  /** Request refinement of a task */
  refineTask: (taskId: string, feedback: string) => void;
  /** Pending decisions for the current user's position (proactively surfaced) */
  pendingDecisions: Decision[];
  /** Force re-fetch of pending decisions */
  refreshPendingDecisions: () => void;
}

const IronclawContext = createContext<IronclawContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface IronclawProviderProps {
  children: ReactNode;
}

export function IronclawProvider({ children }: IronclawProviderProps) {
  const { activeProblemSetId, userRoleInActive, activeProblemSet } = useProblemSet();
  const { userDID } = useUser();
  const location = useLocation();

  // Derive current tab from URL pathname
  const currentTab = useMemo(
    () => deriveTabFromPath(location.pathname),
    [location.pathname],
  );

  const ironclaw = useIronclaw(activeProblemSetId, {
    currentTab,
    problemSetId: activeProblemSetId ?? undefined,
    userRole: userRoleInActive ?? undefined,
  });

  // Design interview state — active when user clicks "Guide Me" on Design tab
  const designInterview = useDesignInterview(activeProblemSetId ?? 'none');

  // ─── "Spring to attention" greeting when drawer opens ──────────────────────
  const greetingShownRef = useRef(false);
  const prevOpenRef = useRef(false);
  const { isOpen: drawerIsOpen, injectMessage } = ironclaw;

  useEffect(() => {
    const justOpened = drawerIsOpen && !prevOpenRef.current;
    prevOpenRef.current = drawerIsOpen;

    if (!justOpened) return;

    // Only greet once per drawer-open cycle (reset on close)
    if (greetingShownRef.current) return;
    greetingShownRef.current = true;

    let cancelled = false;
    ironclawApi.getGreeting(activeProblemSet?.name).then((result) => {
      if (cancelled) return;
      const greetingMsg: IronclawChatMessage = {
        id: `greeting-${Date.now()}`,
        problemSetId: activeProblemSetId ?? '_global',
        content: result.greeting,
        sender: 'ironclaw',
        createdAt: new Date().toISOString(),
      };
      injectMessage(greetingMsg);
    }).catch(() => {
      // Non-blocking — if greeting fails, drawer still works
    });

    return () => { cancelled = true; };
  }, [drawerIsOpen, activeProblemSet?.name, activeProblemSetId, injectMessage]);

  // Reset greeting flag when drawer closes
  useEffect(() => {
    if (!drawerIsOpen) {
      greetingShownRef.current = false;
    }
  }, [drawerIsOpen]);

  // ─── Pending Decisions State (proactive surfacing) ────────────────────────
  const [pendingDecisions, setPendingDecisions] = useState<Decision[]>([]);
  const [pendingDecisionTick, setPendingDecisionTick] = useState(0);

  const refreshPendingDecisions = useCallback(() => {
    setPendingDecisionTick((n) => n + 1);
  }, []);

  // Poll every 60 seconds for pending decisions for the user's position
  useEffect(() => {
    if (!activeProblemSetId || !userRoleInActive) {
      setPendingDecisions([]);
      return;
    }

    let cancelled = false;

    const fetchPending = async () => {
      try {
        const data = await decisionApiService.getPendingForPosition(
          activeProblemSetId,
          userRoleInActive,
        );
        if (!cancelled) setPendingDecisions(data);
      } catch {
        // Non-fatal — pending decisions badge just won't show
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
   
  }, [activeProblemSetId, userRoleInActive, pendingDecisionTick]);

  // ─── Task State ──────────────────────────────────────────────────────────
  const [activeTask, setActiveTask] = useState<IronclawTaskData | null>(null);

  // Fetch active tasks when problem set changes
  useEffect(() => {
    if (!activeProblemSetId) {
      setActiveTask(null);
      return;
    }
    fetch(`/api/ironclaw/tasks/${activeProblemSetId}?status=dispatched`)
      .then((r) => r.json())
      .then((tasks: Array<Record<string, unknown>>) => {
        if (tasks.length > 0) {
          const t = tasks[0];
          setActiveTask({
            taskId: t.taskId as string,
            title: t.title as string,
            status: t.status as string,
            stepProgress: {
              actionId: t.taskId as string,
              steps: ((t.steps as Array<Record<string, unknown>>) ?? []).map((s) => ({
                label: s.label as string,
                status: s.status as 'pending' | 'running' | 'complete' | 'failed',
              })),
              currentStep: (t.currentStep as number) ?? 0,
              startedAt: (t.createdAt as string) ?? new Date().toISOString(),
            },
            suggestions: ((t.suggestions as Array<Record<string, unknown>>) ?? []).map((s) => ({
              id: s.id as string,
              content: s.content as string,
              agentId: s.agentId as string,
              agentDisplayName: (s.agentId as string) ?? 'Agent',
              targetField: s.fieldPath as string | undefined,
              targetFieldLabel: s.fieldLabel as string | undefined,
              fieldValue: s.content as string | undefined,
            })),
            currentStep: (t.currentStep as number) ?? 0,
          });
        }
      })
      .catch(() => { /* Task fetch failed — not critical */ });
  }, [activeProblemSetId]);

  // Listen for step-progress WebSocket messages to update active task
  useEffect(() => {
    const msgs = ironclaw.messages;
    if (msgs.length === 0) return;
    const latest = msgs[msgs.length - 1];
    if (latest.stepProgress && activeTask) {
      setActiveTask((prev) =>
        prev ? { ...prev, stepProgress: latest.stepProgress!, status: 'agent_working' } : prev,
      );
    }
  }, [ironclaw.messages, activeTask]);

  const approveTaskSuggestion = useCallback((taskId: string, suggestionId: string) => {
    fetch(`/api/ironclaw/tasks/${taskId}/approve/${suggestionId}`, { method: 'POST' })
      .catch((err) => console.error('[ironclaw] Task approve failed:', err));
  }, []);

  const dismissTaskSuggestion = useCallback((taskId: string, suggestionId: string) => {
    fetch(`/api/ironclaw/tasks/${taskId}/dismiss/${suggestionId}`, { method: 'POST' })
      .catch((err) => console.error('[ironclaw] Task dismiss failed:', err));
  }, []);

  const refineTask = useCallback((taskId: string, feedback: string) => {
    fetch(`/api/ironclaw/tasks/${taskId}/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    }).catch((err) => console.error('[ironclaw] Task refine failed:', err));
  }, []);

  // Field write-back event bus
  const fieldWriteListeners = useRef<Set<FieldWriteListener>>(new Set());

  const onFieldWrite = useCallback((listener: FieldWriteListener) => {
    fieldWriteListeners.current.add(listener);
    return () => { fieldWriteListeners.current.delete(listener); };
  }, []);

  // Track handled suggestion IDs so they disappear from the message list
  const [handledSuggestionIds, setHandledSuggestionIds] = useState<Set<string>>(new Set());

  // Suggestion handlers — find suggestion in messages, dispatch field write if targeted
  const acceptSuggestion = useCallback((id: string) => {
    const msg = ironclaw.messages.find((m) => m.suggestion?.id === id);
    const suggestion: SuggestionData | undefined = msg?.suggestion;
    if (suggestion?.targetField && suggestion?.fieldValue) {
      // Dispatch local field write event for immediate form updates
      const event: FieldWriteEvent = {
        targetField: suggestion.targetField,
        value: suggestion.fieldValue,
        suggestionId: id,
      };
      fieldWriteListeners.current.forEach((fn) => fn(event));

      // Notify backend of acceptance for persistence
      fetch(`/api/ironclaw/suggestions/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemSetId: activeProblemSetId,
          targetField: suggestion.targetField,
          fieldValue: suggestion.fieldValue,
        }),
      }).catch((err) => {
        console.error('[ironclaw] Failed to apply suggestion:', err);
      });
    }
    // Remove card from view
    setHandledSuggestionIds((prev) => new Set(prev).add(id));
  }, [ironclaw.messages, activeProblemSetId]);

  const dismissSuggestion = useCallback((id: string) => {
    setHandledSuggestionIds((prev) => new Set(prev).add(id));
  }, []);

  const contextValue: IronclawContextValue = {
    ...ironclaw,
    currentTab,
    userRole: userRoleInActive,
    acceptSuggestion,
    dismissSuggestion,
    onFieldWrite,
    activeTask,
    approveTaskSuggestion,
    dismissTaskSuggestion,
    refineTask,
    pendingDecisions,
    refreshPendingDecisions,
  };

  return (
    <IronclawContext.Provider value={contextValue}>
      {children}

      {/* Floating button -- always present */}
      <IronclawButton
        onClick={ironclaw.toggleDrawer}
        hasUnread={ironclaw.hasUnread || pendingDecisions.length > 0}
      />

      {/* Slide-out drawer -- renders globally, works with or without a problem set */}
      <IronclawDrawer
        isOpen={ironclaw.isOpen}
        onClose={ironclaw.closeDrawer}
        messages={ironclaw.messages.filter((m) => !m.suggestion?.id || !handledSuggestionIds.has(m.suggestion.id))}
        onSendMessage={ironclaw.sendMessage}
        onActionDecision={ironclaw.handleActionDecision}
        onAcceptSuggestion={acceptSuggestion}
        onDismissSuggestion={dismissSuggestion}
        isLoading={ironclaw.isLoading}
        isConnected={ironclaw.isConnected}
        isGlobalMode={!activeProblemSetId}
        currentTab={currentTab}
        problemSetName={activeProblemSet?.name ?? null}
        userRole={userRoleInActive}
        userDid={userDID}
        activeTask={activeTask}
        onApproveTaskSuggestion={approveTaskSuggestion}
        onDismissTaskSuggestion={dismissTaskSuggestion}
        onRefineTask={refineTask}
        pendingDecisions={pendingDecisions}
        onStartDesignInterview={async () => { await designInterview.startInterview('new'); }}
        onActOnDecision={activeProblemSetId ? async (decisionId, params) => {
          await decisionApiService.actOnDecision(activeProblemSetId, decisionId, params);
          refreshPendingDecisions();
        } : undefined}
        interview={designInterview}
        threads={ironclaw.threads}
        currentThreadId={ironclaw.currentThreadId}
        onSelectThread={ironclaw.selectThread}
        onCreateThread={ironclaw.createThread}
        onDeleteThread={ironclaw.deleteThread}
        problemSetId={activeProblemSetId}
      />
    </IronclawContext.Provider>
  );
}

// ─── Consumer Hook ───────────────────────────────────────────────────────────

/**
 * Access Ironclaw context. Throws if used outside IronclawProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useIronclawContext(): IronclawContextValue {
  const ctx = useContext(IronclawContext);
  if (!ctx) {
    throw new Error('useIronclawContext must be used within an IronclawProvider');
  }
  return ctx;
}
