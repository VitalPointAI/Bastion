/**
 * useAuth Hook - Replaces usePrivy for passkey-based authentication
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { authService, type AuthSession } from '../lib/auth-service';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  session: AuthSession | null;
  accountId: string | null;
  prfAvailable: boolean;
}

interface AuthContextValue extends AuthState {
  login: () => void;        // Redirect to login page
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    session: null,
    accountId: null,
    prfAvailable: false
  });

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    const session = await authService.getSession();

    if (session) {
      setState({
        isLoading: false,
        isAuthenticated: true,
        session,
        accountId: session.accountId,
        prfAvailable: session.prfAvailable
      });
    } else {
      setState({
        isLoading: false,
        isAuthenticated: false,
        session: null,
        accountId: null,
        prfAvailable: false
      });
    }
  }, []);

  const login = useCallback(() => {
    // Navigate to login page
    window.location.href = '/login';
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({
      isLoading: false,
      isAuthenticated: false,
      session: null,
      accountId: null,
      prfAvailable: false
    });
    // Redirect to home or login
    window.location.href = '/';
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshSession: checkSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
