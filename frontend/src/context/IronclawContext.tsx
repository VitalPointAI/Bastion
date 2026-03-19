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
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

import type { IronclawChatMessage, SuggestionData, TrustDecision } from '../types/ironclaw.ts';
import { useIronclaw } from '../hooks/useIronclaw.ts';
import { useProblemSet } from './ProblemSetContext.tsx';
import { useUser } from './UserContext.tsx';
import { IronclawButton } from '../components/ironclaw/IronclawButton.tsx';
import { IronclawDrawer } from '../components/ironclaw/IronclawDrawer.tsx';

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
  if (lower.includes('/direct')) return 'direct';
  if (lower.includes('/cop')) return 'cop';
  if (lower.includes('/assess')) return 'assess';
  if (lower.includes('/admin')) return 'admin';
  if (lower.includes('/brain')) return 'brain';
  if (lower.includes('/train')) return 'train';
  if (lower.includes('/campaign')) return 'campaign';
  if (lower.includes('/overview')) return 'overview';

  // Legacy tab names (pre-Phase 24)
  if (lower.includes('/decide')) return 'decide';
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

  // Field write-back event bus
  const fieldWriteListeners = useRef<Set<FieldWriteListener>>(new Set());

  const onFieldWrite = useCallback((listener: FieldWriteListener) => {
    fieldWriteListeners.current.add(listener);
    return () => { fieldWriteListeners.current.delete(listener); };
  }, []);

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
  }, [ironclaw.messages, activeProblemSetId]);

  const dismissSuggestion = useCallback((_id: string) => {
    // TODO: notify backend of dismissal if needed
  }, []);

  const contextValue: IronclawContextValue = {
    ...ironclaw,
    currentTab,
    userRole: userRoleInActive,
    acceptSuggestion,
    dismissSuggestion,
    onFieldWrite,
  };

  return (
    <IronclawContext.Provider value={contextValue}>
      {children}

      {/* Floating button -- always present */}
      <IronclawButton
        onClick={ironclaw.toggleDrawer}
        hasUnread={ironclaw.hasUnread}
      />

      {/* Slide-out drawer -- renders globally, works with or without a problem set */}
      <IronclawDrawer
        isOpen={ironclaw.isOpen}
        onClose={ironclaw.closeDrawer}
        messages={ironclaw.messages}
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
