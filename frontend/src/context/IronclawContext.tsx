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
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

import type { IronclawChatMessage, TrustDecision } from '../types/ironclaw.ts';
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

  const contextValue: IronclawContextValue = {
    ...ironclaw,
    currentTab,
    userRole: userRoleInActive,
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
