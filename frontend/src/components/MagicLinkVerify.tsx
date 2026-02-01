/**
 * MagicLinkVerify - Verifies magic link token from URL
 *
 * This component handles the /auth/verify?token=xxx route.
 * When user clicks magic link in email, they land here.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../lib/auth-service';
import { PasskeySetup } from './PasskeySetup';
import './MagicLinkVerify.css';

type VerifyState = 'verifying' | 'needs-passkey' | 'success' | 'error';

export function MagicLinkVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerifyState>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError('No verification token provided');
      setState('error');
      return;
    }

    verifyToken(token);
  }, [searchParams]);

  const verifyToken = async (token: string) => {
    try {
      const result = await authService.verifyMagicLink(token);

      // Store session
      authService.setSession(result.sessionToken);

      // Check if user needs passkey setup
      if (result.needsPasskeySetup) {
        // User authenticated but needs to set up passkey for full functionality
        setEmail(result.email || 'user');
        setState('needs-passkey');
      } else {
        // User has passkey, redirect to app
        setState('success');
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setState('error');
    }
  };

  const handlePasskeyComplete = () => {
    navigate('/');
  };

  const handleSkipPasskey = () => {
    // Continue with limited functionality
    navigate('/');
  };

  return (
    <div className="magic-link-verify">
      {state === 'verifying' && (
        <div className="verify-loading">
          <div className="spinner" />
          <h2>Verifying your link...</h2>
        </div>
      )}

      {state === 'needs-passkey' && email && (
        <PasskeySetup
          email={email}
          onComplete={handlePasskeyComplete}
          onSkip={handleSkipPasskey}
        />
      )}

      {state === 'success' && (
        <div className="verify-success">
          <div className="success-icon">✓</div>
          <h2>Verified!</h2>
          <p>Redirecting you to BASTION...</p>
        </div>
      )}

      {state === 'error' && (
        <div className="verify-error">
          <div className="error-icon">⚠️</div>
          <h2>Verification Failed</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/login')}>
            Back to Login
          </button>
        </div>
      )}
    </div>
  );
}
