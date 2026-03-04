/**
 * AuthWrapper - Authentication wrapper using @vitalpoint/near-phantom-auth
 *
 * Replaces the previous custom passkey/magic-link AuthWrapper.
 * AnonAuthProvider is provided at the App.tsx level — this component
 * handles redirect logic, DID initialization, and UserContext population.
 * MigrationFlow and prfAvailable removed — clean break; users re-register.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserProvider } from '../context/UserContext';
import { hasUserDID, buildDID, emitEntityRegistered } from '../lib/identity';

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';

interface AuthWrapperProps {
  children: ReactNode;
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { isLoading, isAuthenticated, accountId, email } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<'idle' | 'creating-did' | 'ready' | 'error'>('idle');
  const [userDID, setUserDID] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [orgEmail, setOrgEmail] = useState<string | null>(null);

  // Initialize DID after authentication
  // prfAvailable removed — package handles PRF internally; DID always created on auth
  useEffect(() => {
    const initializeDID = async () => {
      if (!isAuthenticated || !accountId || status !== 'idle') return;

      setStatus('creating-did');
      console.log('=== BASTION Account Initialization ===');
      console.log('Account:', accountId);

      try {
        const didValue = buildDID(accountId);

        // Check if DID exists in identity registry
        const hasDID = await hasUserDID(accountId);

        if (!hasDID) {
          // Create DID for new user — credentials: 'include' for cookie-based auth
          console.log('Creating DID for new user...');

          const didResponse = await fetch(`${BACKEND_URL}/api/identity/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              accountId: accountId,
              entityType: 'Human'
            })
          });

          if (didResponse.ok) {
            console.log('DID created:', didValue);
            setUserDID(didValue);
            emitEntityRegistered({ entityType: 'Human', name: email || 'User' }, didValue);
          } else {
            console.warn('DID creation failed, status:', didResponse.status);
            // Still set DID locally so app can continue; registry entry retried on next login
            setUserDID(didValue);
          }
        } else {
          console.log('DID exists:', didValue);
          setUserDID(didValue);
        }

        // Load user profile (display name + org email)
        try {
          const profileRes = await fetch(`${BACKEND_URL}/api/user-profile`, {
            credentials: 'include',
          });
          if (profileRes.ok) {
            const profile = await profileRes.json() as { displayName: string; orgEmail: string | null };
            setDisplayName(profile.displayName);
            setOrgEmail(profile.orgEmail);
          }
        } catch {
          // Profile not found is fine — user may not have set one yet
        }

        setStatus('ready');
        console.log('======================================');

      } catch (error) {
        console.error('DID initialization failed:', error);
        setStatus('error');
      }
    };

    initializeDID();
  }, [isAuthenticated, accountId, status]);

  // Get display status
  const getStatusMessage = () => {
    if (isLoading || !isAuthenticated) return null;
    switch (status) {
      case 'creating-did':
        return 'Setting up your secure identity...';
      case 'error':
        return 'Setup failed. Please try again.';
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();

  // Build user context value from package auth state
  const userContextValue = {
    userDID,
    accountId,
    email,
    displayName,
    orgEmail,
    mpcRegistered: true, // MPC IS used for NEAR accounts
    isAuthenticated,
  };

  // Redirect to login if not authenticated and not loading
  // NOTE: After all hooks — React Rules of Hooks compliance
  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <UserProvider value={userContextValue}>
      {/* Status overlay during initialization */}
      {statusMessage && (
        <div className="status-overlay">
          <div className="status-message">
            <div className="status-spinner" />
            <p>{statusMessage}</p>
          </div>
        </div>
      )}
      {/* Render children */}
      {children}
    </UserProvider>
  );
}
