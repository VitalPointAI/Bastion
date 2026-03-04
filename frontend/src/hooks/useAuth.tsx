/**
 * useAuth Hook - Wraps @vitalpoint/near-phantom-auth useAnonAuth
 *
 * Thin adapter that re-exports the package's AnonAuthProvider and useAnonAuth
 * with the interface expected by AuthWrapper and other components.
 *
 * Field mapping:
 *   package.nearAccountId  -> accountId  (used by UserContext, DID init, StrategicDashboard)
 *   package.email          -> email       (from OAuth/magic-link; null for passkey-only)
 *   package.isLoading      -> isLoading
 *   package.isAuthenticated -> isAuthenticated
 *   package.login          -> login
 *   package.logout         -> logout
 *   package.refreshSession -> refreshSession
 */

import { AnonAuthProvider, useAnonAuth } from '@vitalpoint/near-phantom-auth/client';

// Re-export the provider so AuthWrapper can import it as AuthProvider
export { AnonAuthProvider as AuthProvider };

export interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  accountId: string | null;
  email: string | null;
  login: (codename?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

/**
 * Adapter hook: maps package useAnonAuth fields to the AuthContextValue interface
 * used by AuthWrapper and StrategicDashboard.
 *
 * Note: prfAvailable is intentionally removed — the package handles PRF internally.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const auth = useAnonAuth();

  return {
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    // Package uses nearAccountId; map to accountId for all downstream consumers
    accountId: auth.nearAccountId,
    email: auth.email,
    login: auth.login,
    logout: auth.logout,
    refreshSession: auth.refreshSession,
  };
}
