/**
 * ModeContext
 *
 * Provides global training/operational mode state, toggle function,
 * confirmation flow, and exercise banner rendering.
 *
 * - Loads persisted mode from /api/user-mode on mount
 * - Defaults to 'operational' if no persisted mode
 * - Shows confirmation modal before switching
 * - Renders amber EXERCISE banner when in training mode
 * - Navigates to workspace selector after confirmed switch
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from './UserContext';
import { ModeConfirmationModal } from '../components/ModeConfirmationModal';
import { ExerciseBanner } from '../components/ExerciseBanner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AppMode = 'training' | 'operational';

export interface ModeContextType {
  mode: AppMode;
  isTraining: boolean;
  requestModeSwitch: (target: AppMode) => void;
  confirmModeSwitch: () => Promise<void>;
  cancelModeSwitch: () => void;
  pendingMode: AppMode | null;
  loading: boolean;
}

// ─── Default ─────────────────────────────────────────────────────────────────

const defaultContext: ModeContextType = {
  mode: 'operational',
  isTraining: false,
  requestModeSwitch: () => undefined,
  confirmModeSwitch: async () => undefined,
  cancelModeSwitch: () => undefined,
  pendingMode: null,
  loading: false,
};

const ModeContext = createContext<ModeContextType>(defaultContext);

// Use environment variable or empty string for relative URLs (Vite proxy)
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Provider ────────────────────────────────────────────────────────────────

export function ModeProvider({ children }: { children: ReactNode }) {
  const { userDID, isAuthenticated } = useUser();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AppMode>('operational');
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch user mode from backend on auth
  useEffect(() => {
    if (!isAuthenticated || !userDID) {
      setMode('operational');
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/user-mode`, {
      credentials: 'include',
      headers: { 'X-DID': userDID },
    })
      .then((res) => res.json())
      .then((data: { mode?: AppMode }) => {
        if (!cancelled && (data.mode === 'training' || data.mode === 'operational')) {
          setMode(data.mode);
        }
      })
      .catch(() => {
        // Default to operational on error
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isAuthenticated, userDID]);

  const requestModeSwitch = useCallback((target: AppMode) => {
    setPendingMode(target);
  }, []);

  const confirmModeSwitch = useCallback(async () => {
    if (!pendingMode || !userDID) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/user-mode`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-DID': userDID,
        },
        body: JSON.stringify({ mode: pendingMode }),
      });

      if (res.ok) {
        const data = await res.json();
        setMode(data.mode ?? pendingMode);
        setPendingMode(null);
        navigate('/');
      }
    } catch {
      // Silently fail — mode stays unchanged
    } finally {
      setLoading(false);
    }
  }, [pendingMode, userDID, navigate]);

  const cancelModeSwitch = useCallback(() => {
    setPendingMode(null);
  }, []);

  const isTraining = mode === 'training';

  const value: ModeContextType = {
    mode,
    isTraining,
    requestModeSwitch,
    confirmModeSwitch,
    cancelModeSwitch,
    pendingMode,
    loading,
  };

  return (
    <ModeContext.Provider value={value}>
      {isTraining && <ExerciseBanner />}
      {children}
      {pendingMode !== null && (
        <ModeConfirmationModal
          targetMode={pendingMode}
          onConfirm={confirmModeSwitch}
          onCancel={cancelModeSwitch}
        />
      )}
    </ModeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export const useMode = () => useContext(ModeContext);
