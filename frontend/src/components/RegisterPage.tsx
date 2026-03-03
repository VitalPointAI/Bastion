/**
 * RegisterPage - New user passkey registration using @vitalpoint/near-phantom-auth
 *
 * Replaces the previous RegisterPage that used custom passkey library.
 * Uses useAnonAuth() from the package (provided by AnonAuthProvider in App.tsx).
 * Email input removed per CONTEXT.md — package uses codename-based registration.
 * DID and UserContext population handled by AuthWrapper after registration completes.
 */

import { useNavigate } from 'react-router-dom';
import { useAnonAuth } from '@vitalpoint/near-phantom-auth/client';
import './RegisterPage.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const {
    isLoading,
    isAuthenticated,
    register,
    error,
    clearError,
    webAuthnSupported,
  } = useAnonAuth();

  // Already authenticated — redirect to app
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleRegister = async () => {
    clearError();
    await register();
    // On success the session cookie is set; isAuthenticated will become true
    // AuthWrapper will handle DID initialization and redirect
  };

  if (!webAuthnSupported) {
    return (
      <div className="register-page">
        <div className="register-card">
          <h1>BASTION</h1>
          <p className="subtitle">Create Your Account</p>
          <div className="warning-message">
            Your browser does not support passkeys (WebAuthn). Please use a modern browser
            such as Chrome, Firefox, or Safari with biometric authentication.
          </div>
          <p className="login-link">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <h1>BASTION</h1>
        <p className="subtitle">Create Your Account</p>

        {error && (
          <div className="error-message">
            {error}{' '}
            <button className="back-link" onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4d', textDecoration: 'underline' }}>
              Dismiss
            </button>
          </div>
        )}

        <div className="register-form">
          <button
            className="register-button primary"
            onClick={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account with Passkey'}
          </button>

          <p className="info-text">
            A passkey will be created using your device's biometric authentication
            (fingerprint, face, or PIN). No password required.
          </p>

          <p className="login-link">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
