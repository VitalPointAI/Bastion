/**
 * IronclawContext
 *
 * Provides Ironclaw chat state, drawer controls, and actions to all child components.
 * Wraps the useIronclaw hook and renders the floating button + drawer globally.
 *
 * - IronclawProvider wraps app at AuthenticatedShell level (above route layer)
 * - useIronclawContext() returns the full context value
 * - Gets problemSetId from ProblemSetContext (falls back to null)
 * - Replaces AIStaffContext as primary AI surface (coexists during transition)
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import type { IronclawChatMessage, TrustDecision } from '../types/ironclaw.ts';
import { useIronclaw } from '../hooks/useIronclaw.ts';
import { useProblemSet } from './ProblemSetContext.tsx';
import { IronclawButton } from '../components/ironclaw/IronclawButton.tsx';
import { IronclawDrawer } from '../components/ironclaw/IronclawDrawer.tsx';

// ─── Context Value ───────────────────────────────────────────────────────────

interface IronclawContextValue {
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

const IronclawContext = createContext<IronclawContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface IronclawProviderProps {
  children: ReactNode;
}

export function IronclawProvider({ children }: IronclawProviderProps) {
  const { activeProblemSetId } = useProblemSet();

  const ironclaw = useIronclaw(activeProblemSetId);

  return (
    <IronclawContext.Provider value={ironclaw}>
      {children}

      {/* Floating button -- always present */}
      <IronclawButton
        onClick={ironclaw.toggleDrawer}
        hasUnread={ironclaw.hasUnread}
      />

      {/* Slide-out drawer -- renders globally */}
      <IronclawDrawer
        isOpen={ironclaw.isOpen}
        onClose={ironclaw.closeDrawer}
        messages={ironclaw.messages}
        onSendMessage={ironclaw.sendMessage}
        onActionDecision={ironclaw.handleActionDecision}
        isLoading={ironclaw.isLoading}
      />
    </IronclawContext.Provider>
  );
}

// ─── Consumer Hook ───────────────────────────────────────────────────────────

/**
 * Access Ironclaw context. Throws if used outside IronclawProvider.
 */
export function useIronclawContext(): IronclawContextValue {
  const ctx = useContext(IronclawContext);
  if (!ctx) {
    throw new Error('useIronclawContext must be used within an IronclawProvider');
  }
  return ctx;
}
