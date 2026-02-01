/**
 * AuthWrapper - Authentication wrapper using passkey/magic link auth
 *
 * Replaces the previous Privy-based AuthWrapper.
 * Includes migration check for security upgrades.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AuthProvider } from '../hooks/useAuth';
import { UserProvider } from '../context/UserContext';
import { MigrationFlow } from './MigrationFlow';
import { hasUserDID, buildDID, emitEntityRegistered } from '../lib/identity';

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';

interface AuthWrapperProps {
  children: ReactNode;
}

function AuthContent({ children }: AuthWrapperProps) {
  const { isLoading, isAuthenticated, accountId, prfAvailable } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<'idle' | 'creating-did' | 'ready' | 'error'>('idle');
  const [userDID, setUserDID] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrationEmail, setMigrationEmail] = useState<string>('');

  // Redirect to login if not authenticated and not loading
  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for migration needs
  useEffect(() => {
    const checkMigration = async () => {
      if (!isAuthenticated || !accountId) return;

      try {
        // Check if user needs migration (backend will determine this)
        const response = await fetch(`${BACKEND_URL}/api/auth/migration-status?accountId=${encodeURIComponent(accountId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.needsMigration) {
            setNeedsMigration(true);
            setMigrationEmail(data.email || accountId);
          }
        }
      } catch (error) {
        console.log('Migration check skipped:', error);
        // Don't block on migration check failure
      }
    };

    checkMigration();
  }, [isAuthenticated, accountId]);

  // Initialize DID after authentication
  useEffect(() => {
    const initializeDID = async () => {
      if (!isAuthenticated || !accountId || status !== 'idle') {
        return;
      }

      setStatus('creating-did');
      console.log('=== BASTION Account Initialization (Passkey) ===');
      console.log('Account:', accountId);

      try {
        const didValue = buildDID(accountId);

        // Check if DID exists
        const hasDID = await hasUserDID(accountId);

        if (!hasDID && prfAvailable) {
          // Create DID using PRF-derived secret
          // Note: PRF secret is extracted during authentication and passed to backend
          console.log('Creating DID for new user...');

          const didResponse = await fetch(`${BACKEND_URL}/api/identity/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            console.warn('DID creation deferred - PRF required');
          }
        } else if (hasDID) {
          console.log('DID exists:', didValue);
          setUserDID(didValue);
        } else {
          console.warn('DID creation requires PRF - magic link auth has limited functionality');
        }

        setStatus('ready');
        console.log('====================================');

      } catch (error) {
        console.error('DID initialization failed:', error);
        setStatus('error');
      }
    };

    initializeDID();
  }, [isAuthenticated, accountId, prfAvailable, status, email]);

  // Get display status
  const getStatusMessage = () => {
    if (isLoading) {
      return 'Loading...';
    }
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

  // Build user context value
  const userContextValue = {
    userDID,
    accountId,
    email,
    mpcRegistered: true, // MPC IS used for NEAR accounts (UUID-based derivation)
    isAuthenticated,
  };

  // Show migration flow if needed
  if (needsMigration) {
    return (
      <UserProvider value={userContextValue}>
        <MigrationFlow
          email={migrationEmail}
          onComplete={() => {
            setNeedsMigration(false);
            setStatus('idle'); // Re-trigger DID init after migration
          }}
          onSkip={() => setNeedsMigration(false)}
          migrationType="security-upgrade"
        />
      </UserProvider>
    );
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

export function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <AuthProvider>
      <AuthContent>{children}</AuthContent>
    </AuthProvider>
  );
}
